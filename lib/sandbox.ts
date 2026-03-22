import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import yaml from 'js-yaml';
import type { ExerciseSpec } from './types';

const execFileAsync = promisify(execFile);

const CONTAINER_LIMITS = {
  memory: '256m',
  memoryReservation: '128m',
  cpuQuota: 50000,
  cpuShares: 512,
  pidsLimit: 64,
};

const SESSIONS_DIR = '/app/sessions';
const VERIFY_SCRIPTS_DIR = '/app/verify-scripts';

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
  
  const { stdout } = await execFileAsync('docker', [
    'run', '-d',
    '--name', containerName,
    '-v', `${hostSessionDir}:/workspace`,
    '--memory', CONTAINER_LIMITS.memory,
    '--memory-reservation', CONTAINER_LIMITS.memoryReservation,
    '--cpu-quota', String(CONTAINER_LIMITS.cpuQuota),
    '--cpu-shares', String(CONTAINER_LIMITS.cpuShares),
    '--pids-limit', String(CONTAINER_LIMITS.pidsLimit),
    '--network', 'none',
    '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges',
    'gitkata-sandbox:latest',
  ]);
  const containerId = stdout.trim();
  console.log(`[DOCKER] Container created: ${containerName} (${containerId})`);
  console.log(`[DOCKER] Volume mount: ${hostSessionDir}:/workspace`);
  return containerId;
}

async function copyExerciseToSession(
  exercisePath: string,
  sessionDir: string,
  sessionId: string
): Promise<void> {
  // exercisePath is stored as 'problems/init-basic-01'
  // We need to extract just 'init-basic-01' to avoid doubling 'problems/'
  const exerciseName = exercisePath.replace(/^problems\//, '');
  const exerciseRepoPath = path.join(process.env.EXERCISES_PATH || '/exercises', 'problems', exerciseName, 'content');
  await fs.cp(exerciseRepoPath, sessionDir, { recursive: true });
  console.log(`[DOCKER] Exercise content copied: ${exerciseName} to ${sessionDir}`);

  // Fix ownership for sandbox non-root user (kata, uid 1000).
  // This must happen AFTER fs.cp since cp runs as root and would reset ownership.
  await execFileAsync('chown', ['-R', '1000:1000', sessionDir]);

  // Copy verify.sh to a separate directory that the sandbox cannot access.
  // The sandbox only mounts the session directory at /workspace, so any path
  // outside of /app/sessions/{userId}/{sessionId} is inaccessible to it.
  const verifyDir = path.join(VERIFY_SCRIPTS_DIR, sessionId);
  await fs.mkdir(verifyDir, { recursive: true });
  const verifyScriptSrc = path.join(process.env.EXERCISES_PATH || '/exercises', 'solutions', exerciseName, 'verify.sh');
  const verifyScriptDst = path.join(verifyDir, 'verify.sh');
  try {
    await fs.copyFile(verifyScriptSrc, verifyScriptDst);
    // Make verify.sh read-only to prevent modification
    await fs.chmod(verifyScriptDst, 0o444);
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
    console.log(`[DOCKER] Exec command in ${containerName}: ${command}`);
    const { stdout, stderr } = await execFileAsync('docker', [
      'exec', '-w', '/workspace', containerName, 'sh', '-c', command,
    ]);
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
    console.log(`[WEBAPP] Exec command: ${command}`);
    const { stdout, stderr } = await execFileAsync('bash', ['-c', command], {
      cwd: workingDir,
      env: {
        ...process.env,
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'safe.directory',
        GIT_CONFIG_VALUE_0: workingDir || '*',
      },
    });
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
    await execFileAsync('docker', ['kill', containerName]);
    await execFileAsync('docker', ['rm', containerName]);
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

function getVerifyScriptPath(sessionId: string): string {
  return path.join(VERIFY_SCRIPTS_DIR, sessionId, 'verify.sh');
}

async function cleanupVerifyScript(sessionId: string): Promise<void> {
  const verifyDir = path.join(VERIFY_SCRIPTS_DIR, sessionId);
  try {
    await fs.rm(verifyDir, { recursive: true, force: true });
    console.log(`[DOCKER] Verify script directory cleaned up: ${verifyDir}`);
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
  getVerifyScriptPath,
  cleanupVerifyScript,
};
