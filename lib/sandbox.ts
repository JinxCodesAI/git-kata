import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import yaml from 'js-yaml';
import type { ExerciseSpec } from './types';

const execAsync = promisify(exec);

const CONTAINER_LIMITS = {
  memory: '256m',
  memoryReservation: '128m',
  cpuQuota: 50000,
  cpuShares: 512,
  pidsLimit: 64,
};

const SESSIONS_DIR = '/app/sessions';

async function ensureSessionsDir(): Promise<void> {
  try {
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
  } catch (e) {
    // Directory might already exist
  }
}

async function createContainer(sessionId: string, userId: string): Promise<string> {
  const sessionDir = path.join(SESSIONS_DIR, userId, sessionId);
  await fs.mkdir(sessionDir, { recursive: true });

  const containerName = `gitkata-${sessionId}`;
  
  // SESSIONS_HOST_PATH is the host path that Docker daemon can access
  // SESSIONS_DIR is the internal container path
  const sessionsHostPath = process.env.SESSIONS_HOST_PATH || '/sessions';
  const hostSessionDir = path.join(sessionsHostPath, userId, sessionId);
  
  const runCmd = `docker run -d \
    --name ${containerName} \
    -v ${hostSessionDir}:/workspace \
    --memory="${CONTAINER_LIMITS.memory}" \
    --memory-reservation="${CONTAINER_LIMITS.memoryReservation}" \
    --cpu-quota=${CONTAINER_LIMITS.cpuQuota} \
    --cpu-shares=${CONTAINER_LIMITS.cpuShares} \
    --pids-limit=${CONTAINER_LIMITS.pidsLimit} \
    --network=none \
    gitkata-sandbox:latest`;

  const { stdout } = await execAsync(runCmd);
  const containerId = stdout.trim();
  console.log(`[DOCKER] Container created: ${containerName} (${containerId})`);
  console.log(`[DOCKER] Volume mount: ${hostSessionDir}:/workspace`);
  return containerId;
}

async function copyExerciseToSession(
  exercisePath: string,
  sessionDir: string
): Promise<void> {
  // exercisePath is stored as 'problems/init-basic-01'
  // We need to extract just 'init-basic-01' to avoid doubling 'problems/'
  const exerciseName = exercisePath.replace(/^problems\//, '');
  const exerciseRepoPath = path.join(process.env.EXERCISES_PATH || '/exercises', 'problems', exerciseName, 'content');
  await fs.cp(exerciseRepoPath, sessionDir, { recursive: true });
  console.log(`[DOCKER] Exercise content copied: ${exerciseName} to ${sessionDir}`);
  
  // Also copy verify.sh from solutions folder into session directory
  // This is needed because verify.sh runs in web-app context (not sandbox)
  // and needs access to the session directory
  const verifyScriptSrc = path.join(process.env.EXERCISES_PATH || '/exercises', 'solutions', exerciseName, 'verify.sh');
  const verifyScriptDst = path.join(sessionDir, 'verify.sh');
  try {
    await fs.copyFile(verifyScriptSrc, verifyScriptDst);
    console.log(`[DOCKER] verify.sh copied: ${verifyScriptSrc} -> ${verifyScriptDst}`);
  } catch (e) {
    console.error(`[DOCKER] Failed to copy verify.sh: ${e}`);
    throw e; // Re-throw since verify.sh is critical for evaluation
  }
}

async function loadExerciseSpec(exercisePath: string): Promise<ExerciseSpec> {
  const specPath = path.join(process.env.EXERCISES_PATH || '/exercises', 'problems', exercisePath, 'spec.yaml');
  const specContent = await fs.readFile(specPath, 'utf-8');
  return yaml.load(specContent) as ExerciseSpec;
}

async function getSolutionRepo(exercisePath: string): Promise<string> {
  // exercisePath is 'problems/commit-basic-01', need to strip 'problems/' to get 'commit-basic-01'
  const exerciseName = exercisePath.replace(/^problems\//, '');
  return path.join(process.env.EXERCISES_PATH || '/exercises', 'solutions', exerciseName, 'content');
}

async function getSolutionPath(exercisePath: string): Promise<string> {
  // exercisePath is 'problems/commit-basic-01', need to strip 'problems/' to get 'commit-basic-01'
  const exerciseName = exercisePath.replace(/^problems\//, '');
  return path.join(process.env.EXERCISES_PATH || '/exercises', 'solutions', exerciseName);
}

async function execInContainer(
  containerName: string,
  command: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const dockerCmd = `docker exec -w /workspace ${containerName} sh -c "${command.replace(/"/g, '\\"')}"`;
    console.log(`[DOCKER] Exec command: ${dockerCmd}`);
    const { stdout, stderr } = await execAsync(dockerCmd);
    return { stdout, stderr, exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
      exitCode: error.code || 1,
    };
  }
}

/**
 * Execute a command in the web-app container context (not sandbox).
 * Used for running verification scripts that need access to session directories.
 * Session directories are mounted at SESSIONS_DIR in the web-app container.
 */
async function execInWebApp(
  command: string,
  workingDir?: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    // Configure git safe.directory to allow git operations on session directories
    // This is needed because session directories may be created by different users/containers
    // and git's security check prevents access to directories not owned by the current user
    await execAsync('git config --global --add safe.directory "*" 2>/dev/null || true');
    
    // Escape double quotes in the command
    const escapedCommand = command.replace(/"/g, '\\"');
    const cdCmd = workingDir ? `cd "${workingDir}" && ${escapedCommand}` : escapedCommand;
    console.log(`[WEBAPP] Exec command: ${cdCmd}`);
    const { stdout, stderr } = await execAsync(cdCmd);
    return { stdout, stderr, exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
      exitCode: error.code || 1,
    };
  }
}

async function getRepoState(containerName: string): Promise<{
  branch: string;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  recentCommits: { hash: string; message: string }[];
}> {
  const { stdout: branch } = await execInContainer(
    containerName,
    'git branch --show-current'
  );
  
  const { stdout: status } = await execInContainer(
    containerName,
    'git status --porcelain'
  );
  
  const { stdout: log } = await execInContainer(
    containerName,
    'git log --oneline -10'
  );
  
  const staged: string[] = [];
  const unstaged: string[] = [];
  const untracked: string[] = [];
  
  status.split('\n').forEach((line) => {
    if (!line.trim()) return;
    const index = line[0];
    const workTree = line[1];
    const file = line.substring(3);
    
    if (index !== ' ' && index !== '?') staged.push(file);
    if (workTree !== ' ' && workTree !== '?') unstaged.push(file);
    if (index === '?' && workTree === '?') untracked.push(file);
  });
  
  const recentCommits = log
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const [hash, ...msgParts] = line.split(' ');
      return { hash, message: msgParts.join(' ') };
    });
  
  return {
    branch: branch.trim(),
    staged,
    unstaged,
    untracked,
    recentCommits,
  };
}

async function destroyContainer(containerName: string): Promise<void> {
  try {
    await execAsync(`docker kill ${containerName}`);
    await execAsync(`docker rm ${containerName}`);
    console.log(`[DOCKER] Container destroyed: ${containerName}`);
  } catch (e) {
    // Container might not exist
  }
}

async function cleanupSessionDir(sessionId: string, userId: string): Promise<void> {
  const sessionDir = path.join(SESSIONS_DIR, userId, sessionId);
  try {
    await fs.rm(sessionDir, { recursive: true, force: true });
    console.log(`[DOCKER] Session directory cleaned up: ${sessionDir}`);
  } catch (e) {
    // Directory might not exist
  }
}

export const sandbox = {
  ensureSessionsDir,
  createContainer,
  copyExerciseToSession,
  loadExerciseSpec,
  getSolutionRepo,
  getSolutionPath,
  execInContainer,
  execInWebApp,
  getRepoState,
  destroyContainer,
  cleanupSessionDir,
};
