import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import { logger } from './logger';

const execFileAsync = promisify(execFile);

interface PooledContainer {
  name: string;
  containerId: string;
  createdAt: Date;
}

const MAX_ACTIVE = parseInt(process.env.MAX_ACTIVE_SESSIONS || '20');
const POOL_SIZE = parseInt(process.env.POOL_SIZE || '5');
const PREFIX = process.env.POOL_CONTAINER_PREFIX || 'gitkata-pool';

const warmPool: PooledContainer[] = [];
const activeContainers = new Map<string, PooledContainer>(); // sessionId → container

// Create a single blank container
async function createBlankContainer(): Promise<PooledContainer> {
  const name = `${PREFIX}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sessionsHostPath = process.env.SESSIONS_HOST_PATH || '/sessions';
  // FIXED: Use the same path for both mkdir and volume mount
  const poolHostDir = `${sessionsHostPath}/.pool/${name}`;

  // Ensure the dedicated pool directory exists on the host side
  await fs.mkdir(poolHostDir, { recursive: true });

  const { stdout } = await execFileAsync('docker', [
    'run', '-d',
    '--name', name,
    '-v', `${poolHostDir}:/workspace`,
    '--memory', '256m',
    '--memory-reservation', '128m',
    '--cpu-quota', '50000',
    '--cpu-shares', '512',
    '--pids-limit', '64',
    '--network', 'none',
    '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges',
    process.env.SANDBOX_IMAGE || 'gitkata-sandbox:latest',
  ]);

  return { name, containerId: stdout.trim(), createdAt: new Date() };
}

// ── Async Mutex ──────────────────────────────────────────────────────
// All pool-mutating operations (acquire, release, replenish) serialize
// through this mutex.  This eliminates every class of race condition:
//   - capacity check + increment (acquire)
//   - warmPool.pop() double-pop (acquire)
//   - container-in-limbo TOCTOU (release)
//   - duplicate replenish storms
//
// Implementation: a simple promise-chain.  Each caller awaits the
// previous holder's promise before entering the critical section.
// Because the lock/unlock are synchronous relative to each await,
// Node.js guarantees no interleaving within the critical section.
// ─────────────────────────────────────────────────────────────────────
let mutexChain: Promise<void> = Promise.resolve();

function withPoolLock<T>(fn: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const next = new Promise<void>(r => { release = r; });
  const prev = mutexChain;
  mutexChain = next;
  return prev.then(async () => {
    try {
      return await fn();
    } finally {
      release();
    }
  });
}

// Grab a container for a session
async function acquire(sessionId: string): Promise<PooledContainer> {
  return withPoolLock(async () => {
    if (activeContainers.size >= MAX_ACTIVE) {
      throw new Error('Server at capacity');
    }

    let container: PooledContainer;
    if (warmPool.length > 0) {
      container = warmPool.pop()!;
      logger.info('Acquired pooled container:', container.name, 'for session:', sessionId);
    } else {
      // Pool exhausted — create on demand (slow path)
      logger.warn('Pool empty, creating container on demand for:', sessionId);
      container = await createBlankContainer();
    }

    activeContainers.set(sessionId, container);
    return container;
  }).then(container => {
    // Replenish runs after the lock is released so it doesn't block
    // the caller.  replenish() itself serializes via withPoolLock.
    replenish().catch(e => logger.error('Replenish error:', e));
    return container;
  });
}

// Return a container to the pool
async function release(sessionId: string): Promise<void> {
  return withPoolLock(async () => {
    const container = activeContainers.get(sessionId);
    if (!container) return;

    // Wipe the dedicated workspace for this container safely
    try {
      await execFileAsync('docker', [
        'exec', container.name, 'sh', '-c',
        'rm -rf /workspace/* /workspace/.[!.]* 2>/dev/null; true'
      ]);
      warmPool.push(container);
      logger.info('Released container back to pool:', container.name);
    } catch (e) {
      // Container may be dead — destroy it, replenish will replace
      logger.warn('Container unhealthy, destroying:', container.name);
      await destroyContainer(container.name);
    }

    activeContainers.delete(sessionId);
  }).then(() => {
    // Trigger replenish after lock is released in case a container was destroyed
    replenish().catch(e => logger.error('Replenish error:', e));
  });
}

// Top up the warm pool
async function replenish(): Promise<void> {
  return withPoolLock(async () => {
    while (warmPool.length < POOL_SIZE) {
      try {
        const container = await createBlankContainer();
        warmPool.push(container);
        logger.info('Replenished pool, warm count:', warmPool.length);
      } catch (e) {
        logger.error('Failed to create container for pool:', e);
        break;
      }
    }
  });
}

// Create initial pool on startup
async function initialize(): Promise<void> {
  logger.info('Initializing container pool:', 'poolSize=', POOL_SIZE, 'maxActive=', MAX_ACTIVE);
  // Clean up any orphaned pool containers from previous run
  await cleanupOrphans();
  await replenish();
  logger.info('Container pool ready, warm containers:', warmPool.length);
}

// Destroy all containers on shutdown
async function drainAll(): Promise<void> {
  for (const c of warmPool) await destroyContainer(c.name);
  for (const [, c] of activeContainers) await destroyContainer(c.name);
  warmPool.length = 0;
  activeContainers.clear();
}

async function cleanupOrphans(): Promise<void> {
  try {
    const { stdout } = await execFileAsync('docker', [
      'ps', '-a', '--filter', `name=${PREFIX}`, '--format', '{{.Names}}'
    ]);
    for (const name of stdout.trim().split('\n').filter(Boolean)) {
      // Only destroy if not currently tracked by our runtime
      // (prevents killing active sessions if incorrectly called during runtime)
      const isActive = Array.from(activeContainers.values()).some(c => c.name === name);
      const isWarm = warmPool.some(c => c.name === name);
      if (!isActive && !isWarm) {
        await destroyContainer(name);
      }
    }
  } catch { /* no orphans */ }
}

async function destroyContainer(name: string): Promise<void> {
  try {
    await execFileAsync('docker', ['kill', name]);
    await execFileAsync('docker', ['rm', name]);
  } catch { /* container may not exist */ }
}

function getActiveCount(): number { return activeContainers.size; }
function getWarmCount(): number { return warmPool.length; }
function getContainerForSession(sessionId: string): PooledContainer | undefined {
  return activeContainers.get(sessionId);
}

export const containerPool = {
  initialize,
  acquire,
  release,
  drainAll,
  getActiveCount,
  getWarmCount,
  getContainerForSession,
};