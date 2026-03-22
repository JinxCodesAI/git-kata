# Container Pool & Rate Limiting

## Problem

The current architecture creates a Docker container on every exercise start and destroys it when the session ends. This has two problems:

1. **No resource cap.** There is no limit on how many containers can be active simultaneously. A malicious or buggy client can exhaust Docker resources by spamming `POST /api/sandbox/create`.
2. **Slow exercise start.** `docker run` takes 1-3 seconds. This is acceptable for training mode but too slow for the planned challenge mode (60-second timed sequences where exercises must switch instantly).
3. **No command throttling.** `POST /api/sandbox/exec` has no rate limit — a script could spam thousands of commands per second.

## Solution

Two components, each independent:

1. **Container pool** — pre-warm blank containers; acquire/release instead of create/destroy per exercise.
2. **Per-endpoint rate limiter** — simple in-memory sliding window, keyed by `userId`.

---

## Container Pool

### Architecture

```
App startup:
  Pool creates POOL_SIZE blank containers (warm pool)

User starts exercise:
  1. pool.acquire() → grab container from warm pool
  2. Copy exercise files to session dir, mount into container
  3. Container is now "active"
  4. Background: replenish warm pool if below POOL_SIZE

User finishes / switches exercise / times out:
  1. pool.release() → wipe /workspace
  2. Container returns to warm pool
  3. Cleanup session dir + verify script

Server shutdown:
  pool.drainAll() → destroy all containers
```

### Config

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_ACTIVE_SESSIONS` | `20` | Max containers assigned to active sessions |
| `POOL_SIZE` | `5` | Number of pre-warmed idle containers to keep ready |
| `POOL_CONTAINER_PREFIX` | `gitkata-pool` | Naming prefix for pooled containers |

### Volume Mount Strategy

Current approach mounts a host-specific session directory per container via `-v`. For pooling, a blank container cannot know its session id at creation time. However, to maintain **cross-tenant isolation**, we must NOT mount the entire `/sessions` root.

**Approach:** Create blank containers with a dedicated isolated staging directory on the host. When a session is acquired, the backend copies exercise files into that specific container's isolated staging directory.

```
# Warm pool containers mount their own dedicated staging dir:
docker run -d --name gitkata-pool-xyz \
  -v ${SESSIONS_HOST_PATH}/.pool/gitkata-pool-xyz:/workspace \
  --memory 256m ... \
  gitkata-sandbox:latest

# On acquire, the backend copies files to /app/sessions/.pool/gitkata-pool-xyz.
# The container already mounts this to /workspace.
```

This ensures a sandbox container only ever has access to its own `.pool` staging directory, preventing cross-user data exposure.

---

### Changes Required

#### [NEW] `lib/container-pool.ts`

Core pool manager (~120 lines):

```typescript
import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';

const execFileAsync = promisify(execFile);

interface PooledContainer {
  name: string;
  containerId: string;
  createdAt: Date;
}

const MAX_ACTIVE = parseInt(process.env.MAX_ACTIVE_SESSIONS || '20');
const POOL_SIZE = parseInt(process.env.POOL_SIZE || '5');
const PREFIX = 'gitkata-pool';

const warmPool: PooledContainer[] = [];
const activeContainers = new Map<string, PooledContainer>(); // sessionId → container

// Create a single blank container
import * as fs from 'fs/promises';

async function createBlankContainer(): Promise<PooledContainer> {
  const name = `${PREFIX}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sessionsHostPath = process.env.SESSIONS_HOST_PATH || '/sessions';
  const poolHostDir = `${sessionsHostPath}/.pool/${name}`;
  
  // Ensure the dedicated pool directory exists on the host side
  await fs.mkdir(`/app/sessions/.pool/${name}`, { recursive: true });
  
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
    'gitkata-sandbox:latest',
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
  initialize, acquire, release, drainAll,
  getActiveCount, getWarmCount, getContainerForSession,
};
```

---

#### [MODIFY] `lib/sandbox.ts`

**Remove:** `createContainer()` function (pool replaces it).  
**Remove:** `destroyContainer()` function (pool handles lifecycle).  

**Remove:** Explicit `containerName` string building (`gitkata-${sessionId}`). The name is now provided by the pool.

**Change `execInContainer()`** — currently hardcodes `/workspace`. This remains correct with the new Volume Strategy, but it no longer builds the container string.

```diff
  async function execInContainer(
    containerName: string,
    command: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
      const { stdout, stderr } = await execFileAsync('docker', [
        'exec', '-w', '/workspace', containerName, 'sh', '-c', command,
      ]);
```

**Change `copyExerciseToSession()`** — Instead of copying to `/app/sessions/{userId}/{sessionId}`, it copies to the container's isolated pool directory:

```diff
- async function copyExerciseToSession(..., sessionDir: string, sessionId: string)
+ async function copyExerciseToSession(..., containerName: string, sessionId: string) {
+     const sessionDir = `/app/sessions/.pool/${containerName}`;
```

---

#### [MODIFY] `lib/session-manager.ts`

The `Session` interface gains a `containerName` field (from pool):

```diff
  interface Session {
    id: string;
    userId: string;
    exerciseId: string;
-   containerId: string;
+   containerName: string;
    createdAt: Date;
    lastActivity: Date;
    commands: { command: string; output: string; timestamp: Date }[];
  }
```

**Change `destroySession()`** — calls `containerPool.release()` instead of `sandbox.destroyContainer()`:

```diff
+ import { containerPool } from './container-pool';

  async function destroySession(sessionId: string): Promise<void> {
    const session = sessions.get(sessionId);
    if (session) {
-     await sandbox.destroyContainer(session.containerId);
+     await containerPool.release(sessionId);
      sessions.delete(sessionId);
    }
  }
```

---

#### [MODIFY] `app/api/sandbox/create/route.ts`

Replace `sandbox.createContainer()` with `containerPool.acquire()`:

```diff
+ import { containerPool } from '@/lib/container-pool';

  // Replace the container creation block:
- const containerId = await sandbox.createContainer(sessionId, userId);
+ // Check capacity
+ if (containerPool.getActiveCount() >= MAX_ACTIVE) {
+   return NextResponse.json(
+     { error: 'Server at capacity, please try again shortly' },
+     { status: 503 }
+   );
+ }
+ 
+ const poolContainer = await containerPool.acquire(sessionId);

  // Copy exercise content to session directory
- const sessionDir = `/app/sessions/${userId}/${sessionId}`;
- await sandbox.copyExerciseToSession(exercise.path, sessionDir, sessionId);
+ // pass containerName instead of sessionDir
+ await sandbox.copyExerciseToSession(exercise.path, poolContainer.name, sessionId);

- const session = sessionManager.createSession(userId, exerciseId, containerId, sessionId);
+ const session = sessionManager.createSession(userId, exerciseId, poolContainer.name, sessionId);
```

---

#### [MODIFY] `app/api/sandbox/exec/route.ts`

Use the session's `containerName` instead of constructing it:

```diff
- const containerName = `gitkata-${sessionId}`;
- const result = await sandbox.execInContainer(containerName, trimmedCommand);
+ const result = await sandbox.execInContainer(session.containerName, trimmedCommand);
```

---

#### [MODIFY] `app/api/sandbox/[sessionId]/route.ts`

Replace `sandbox.destroyContainer()` + `sessionManager.destroySession()` with just `sessionManager.destroySession()` (which internally calls `containerPool.release()`):

```diff
- await sandbox.destroyContainer(`gitkata-${sessionId}`);
  await sandbox.cleanupSessionDir(sessionId, session.userId);
  await sandbox.cleanupVerifyScript(sessionId);
- sessionManager.destroySession(sessionId);
+ await sessionManager.destroySession(sessionId);
```

---

#### [MODIFY] `app/api/sandbox/state/[sessionId]/route.ts`

Use session's container name:

```diff
- const containerName = `gitkata-${sessionId}`;
- const state = await sandbox.getRepoState(containerName);
+ const state = await sandbox.getRepoState(session.containerName);
```

---

#### [MODIFY] `app/api/attempt/route.ts`

Update `verifyCommand` to run against the container's isolated pool directory, rather than the old `/{userId}/{sessionId}` path.

```diff
- const sessionDir = `/app/sessions/${userId}/${sessionId}`;
+ const sessionDir = `/app/sessions/.pool/${session.containerName}`;
  const verifyCommand = `bash ${verifyScriptPath} ${sessionDir} ${sessionDir}`;
```

---

#### [MODIFY] `scripts/start.sh`

Initialize the pool on startup, before starting the app:

```diff
  # Scan exercises to index them
  echo "Scanning exercises..."
  # ...

+ # Initialize container pool
+ echo "Pre-warming container pool..."
+ # Pool initialization happens in the Node.js process on startup

  # Start the application
```

The actual pool initialization should happen in the Next.js app startup. Add an initialization call in a server-side module that runs on import (or in a custom server entry):

```typescript
// lib/startup.ts
import { containerPool } from './container-pool';

// Initialize pool when this module is first imported
containerPool.initialize().catch(e => {
  console.error('Failed to initialize container pool:', e);
  process.exit(1);
});
```

Import this from `app/layout.tsx` or a route handler that guarantees early execution.

---

#### [MODIFY] `docker-compose.yaml` and `docker-compose.dev.yaml`

Add new environment variables:

```yaml
environment:
  MAX_ACTIVE_SESSIONS: ${MAX_ACTIVE_SESSIONS:-20}
  POOL_SIZE: ${POOL_SIZE:-5}
```

---

## Rate Limiter

### Architecture

Simple in-memory sliding window. No dependencies.

#### [NEW] `lib/rate-limit.ts`

```typescript
interface RateLimitWindow {
  timestamps: number[];
}

const windows = new Map<string, RateLimitWindow>();

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, window] of windows.entries()) {
    window.timestamps = window.timestamps.filter(t => now - t < 120_000);
    if (window.timestamps.length === 0) windows.delete(key);
  }
}, 60_000);

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const window = windows.get(key) || { timestamps: [] };
  
  // Clean expired
  window.timestamps = window.timestamps.filter(t => now - t < windowMs);
  
  if (window.timestamps.length >= maxRequests) {
    const oldest = window.timestamps[0];
    return { allowed: false, retryAfterMs: windowMs - (now - oldest) };
  }
  
  // State mutation logic is synchronous, which guarantees atomicity in Node.js
  // (no await statements = no context switching between check and record).
  window.timestamps.push(now);
  windows.set(key, window);
  return { allowed: true, retryAfterMs: 0 };
}
```

### Endpoint Limits

| Endpoint | Limit | Window | Key | Rationale |
|----------|-------|--------|-----|-----------|
| `POST /api/sandbox/create` | 5 | 60s | `userId` | Pool has a global cap, this prevents rapid churn |
| `POST /api/sandbox/exec` | 120 | 60s | `userId` | 2 commands/second sustained is generous for real use |
| `POST /api/attempt` | 5 | 60s | `userId` | Each attempt calls MiniMax API |
| `GET /api/leaderboard` | 30 | 60s | IP | Read-only, low risk |

### Application in Routes

Add at the top of each route handler, after validation:

```typescript
import { checkRateLimit } from '@/lib/rate-limit';

// In the handler:
const { allowed, retryAfterMs } = checkRateLimit(`exec:${userId}`, 120, 60_000);
if (!allowed) {
  return NextResponse.json(
    { error: 'Rate limit exceeded' },
    { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
  );
}
```

---

## Summary of All File Changes

| File | Change | New/Modify |
|------|--------|------------|
| `lib/container-pool.ts` | Pool manager: acquire, release, replenish, initialize | **NEW** |
| `lib/rate-limit.ts` | Sliding window rate limiter | **NEW** |
| `lib/sandbox.ts` | Remove create/destroyContainer, add workDir to execInContainer/getRepoState | MODIFY |
| `lib/session-manager.ts` | Add containerName/workDir to Session, use pool.release | MODIFY |
| `app/api/sandbox/create/route.ts` | Use pool.acquire, add 503 capacity check, add rate limit | MODIFY |
| `app/api/sandbox/exec/route.ts` | Use session.containerName/workDir, add rate limit | MODIFY |
| `app/api/sandbox/[sessionId]/route.ts` | Remove destroyContainer call, session destroy handles pool release | MODIFY |
| `app/api/sandbox/state/[sessionId]/route.ts` | Use session.containerName/workDir | MODIFY |
| `app/api/attempt/route.ts` | Add rate limit | MODIFY |
| `app/api/leaderboard/route.ts` | Add rate limit (by IP) | MODIFY |
| `docker-compose.yaml` | Add MAX_ACTIVE_SESSIONS, POOL_SIZE env vars | MODIFY |
| `docker-compose.dev.yaml` | Same | MODIFY |
