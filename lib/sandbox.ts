import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import yaml from 'js-yaml';
import type { ExerciseSpec } from './types';
import { logger } from './logger';

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

// createContainer and destroyContainer are now handled by lib/container-pool.ts

// sessionDir is now computed as: ${SESSIONS_HOST_PATH}/.pool/${containerName}
// BUT fs.cp runs inside the container, so we need to use the container path
// Sessions are mounted at /app/sessions inside the container (from ./sessions:/app/sessions)
async function copyExerciseToSession(
  exercisePath: string,
  containerName: string,
  sessionId: string
): Promise<void> {
  // Use container path for fs.cp since it runs inside the container
  const sessionsContainerPath = '/app/sessions';
  const sessionDir = path.join(sessionsContainerPath, '.pool', containerName);

  // exercisePath is stored as 'problems/init-basic-01'
  // We need to extract just 'init-basic-01' to avoid doubling 'problems/'
  const exerciseName = exercisePath.replace(/^problems\//, '');
  const exerciseRepoPath = path.join(process.env.EXERCISES_PATH || '/exercises', 'problems', exerciseName, 'content');
  await fs.cp(exerciseRepoPath, sessionDir, { recursive: true });
  logger.info('Exercise content copied:', exerciseName, '->', sessionDir);

  // Fix ownership for sandbox non-root user (kata, uid 1000).
  // This must happen AFTER fs.cp since cp runs as root and would reset ownership.
  await execFileAsync('chown', ['-R', '1000:1000', sessionDir]);

  // Copy verify.sh to a separate directory that the sandbox cannot access.
  // The sandbox only mounts the session directory at /workspace, so any path
  // outside of /app/sessions/.pool/${containerName} is inaccessible to it.
  const verifyDir = path.join(VERIFY_SCRIPTS_DIR, sessionId);
  await fs.mkdir(verifyDir, { recursive: true });
  const verifyScriptSrc = path.join(process.env.EXERCISES_PATH || '/exercises', 'solutions', exerciseName, 'verify.sh');
  const verifyScriptDst = path.join(verifyDir, 'verify.sh');
  try {
    await fs.copyFile(verifyScriptSrc, verifyScriptDst);
    // Make verify.sh read-only to prevent modification
    await fs.chmod(verifyScriptDst, 0o444);
    logger.info('verify.sh copied:', verifyScriptSrc, '->', verifyScriptDst);
  } catch (e) {
    logger.error('Failed to copy verify.sh:', verifyScriptSrc, e);
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
    logger.debug('Exec command in container:', containerName, command);
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
    logger.debug('Exec command in webapp:', command);
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

// Cleanup the pool-based session directory (called after container is released)
// Uses container path since fs.rm runs inside the container
async function cleanupSessionDir(sessionId: string, containerName: string): Promise<void> {
  const sessionsContainerPath = '/app/sessions';
  const sessionDir = path.join(sessionsContainerPath, '.pool', containerName);
  try {
    await fs.rm(sessionDir, { recursive: true, force: true });
    logger.info('Session directory cleaned up:', sessionDir);
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
    logger.debug('Verify script directory cleaned up:', verifyDir);
  } catch (e) {
    // Directory might not exist
  }
}

// Git server configuration for remote exercises
const GIT_SERVER_HOST = process.env.GIT_SERVER_HOST || 'host.docker.internal';
const GIT_SERVER_PORT = process.env.GIT_SERVER_PORT || '9418';

/**
 * Create a bare repository on the git server.
 * This is called when setting up a remote exercise.
 */
async function createBareRepo(repoName: string): Promise<void> {
  const repoPath = `/repos/${repoName}.git`;
  await execInWebApp(`mkdir -p /repos && git init --bare ${repoPath}`);
  logger.info('Created bare repo on git server:', repoPath);
}

/**
 * Get the git URL for a repository on the git server.
 */
function getGitUrl(repoName: string): string {
  return `git://${GIT_SERVER_HOST}:${GIT_SERVER_PORT}/${repoName}.git`;
}

/**
 * Clone a repository from the git server to the user's workspace.
 * Used in exercises where user starts with a cloned repo.
 */
async function cloneFromGitServer(
  containerName: string,
  repoName: string
): Promise<void> {
  const gitUrl = getGitUrl(repoName);
  await execInContainer(containerName, `git clone ${gitUrl} /workspace`);
  logger.info('Cloned repo from git server:', gitUrl);
}

/**
 * Add a remote pointing to the git server.
 * Used when setting up exercise context.
 */
async function addRemoteToContainer(
  containerName: string,
  repoName: string,
  remoteName: string = 'origin'
): Promise<void> {
  const gitUrl = getGitUrl(repoName);
  await execInContainer(containerName, `git remote add ${remoteName} ${gitUrl}`);
  logger.info('Added remote to container:', remoteName, gitUrl);
}

export const sandbox = {
  ensureSessionsDir,
  copyExerciseToSession,
  loadExerciseSpec,
  getSolutionRepo,
  getSolutionPath,
  execInContainer,
  execInWebApp,
  getRepoState,
  cleanupSessionDir,
  getVerifyScriptPath,
  cleanupVerifyScript,
  createBareRepo,
  getGitUrl,
  cloneFromGitServer,
  addRemoteToContainer,
};
