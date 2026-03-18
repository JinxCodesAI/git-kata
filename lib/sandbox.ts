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

const SESSIONS_DIR = '/sessions';

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
  
  const runCmd = `docker run -d \
    --name ${containerName} \
    -v ${sessionDir}:/workspace \
    --memory="${CONTAINER_LIMITS.memory}" \
    --memory-reservation="${CONTAINER_LIMITS.memoryReservation}" \
    --cpu-quota=${CONTAINER_LIMITS.cpuQuota} \
    --cpu-shares=${CONTAINER_LIMITS.cpuShares} \
    --pids-limit=${CONTAINER_LIMITS.pidsLimit} \
    --network=none \
    gitkata-sandbox:latest`;

  const { stdout } = await execAsync(runCmd);
  return stdout.trim();
}

async function copyExerciseToSession(
  exercisePath: string,
  sessionDir: string
): Promise<void> {
  const exerciseRepoPath = path.join(process.env.EXERCISES_PATH || '/exercises', 'problems', exercisePath, 'content');
  await fs.cp(exerciseRepoPath, sessionDir, { recursive: true });
}

async function loadExerciseSpec(exercisePath: string): Promise<ExerciseSpec> {
  const specPath = path.join(process.env.EXERCISES_PATH || '/exercises', 'problems', exercisePath, 'spec.yaml');
  const specContent = await fs.readFile(specPath, 'utf-8');
  return yaml.load(specContent) as ExerciseSpec;
}

async function getSolutionRepo(exercisePath: string): Promise<string> {
  return path.join(process.env.EXERCISES_PATH || '/exercises', 'solutions', exercisePath, 'content');
}

async function getSolutionPath(exercisePath: string): Promise<string> {
  return path.join(process.env.EXERCISES_PATH || '/exercises', 'solutions', exercisePath);
}

async function execInContainer(
  containerName: string,
  command: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execAsync(
      `docker exec ${containerName} sh -c "${command.replace(/"/g, '\\"')}"`
    );
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
  } catch (e) {
    // Container might not exist
  }
}

async function cleanupSessionDir(sessionId: string, userId: string): Promise<void> {
  const sessionDir = path.join(SESSIONS_DIR, userId, sessionId);
  try {
    await fs.rm(sessionDir, { recursive: true, force: true });
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
  getRepoState,
  destroyContainer,
  cleanupSessionDir,
};
