# Security Fixes Implementation Plan — Critical (C1/C2/C3)

**Date:** 2026-03-22  
**Reference:** [security_report.md](file:///home/adam/projects/git-kata/docs/security_report.md)

---

## Overview

Three critical vulnerabilities allow escalation from an unprivileged user inside a sandbox container to **full host compromise**. They form a chain:

1. **C3** — User can overwrite `verify.sh` in the sandbox → it runs in the privileged app container
2. **C2** — Shell string interpolation in `sandbox.ts` allows command injection
3. **C1** — Docker socket is mounted in the app container, amplifying any code-exec to host-level

This plan fixes all three. The fixes are independent and can be applied in any order, but the recommended order is C3 → C2 → C1 because C3 is the easiest exploit and C1 has the widest blast radius.

---

## Fix C3 — Isolate `verify.sh` from Sandbox-Writable Directories

### Problem

`verify.sh` is copied into the session directory (`/app/sessions/{userId}/{sessionId}/verify.sh`), which is volume-mounted into the sandbox container at `/workspace`. The user can modify this file, then submit — the app runs their modified script via `execInWebApp` in the app container context (which has Docker socket + env secrets).

### Solution

Store `verify.sh` in a **separate directory** that the sandbox container does not have access to. The sandbox only mounts `/workspace` (the session dir), so any other path on the app container is inaccessible.

### Changes

#### [MODIFY] [sandbox.ts](file:///home/adam/projects/git-kata/lib/sandbox.ts)

1. **Add a new constant** `VERIFY_SCRIPTS_DIR = '/app/verify-scripts'` for storing verification scripts separately from session data.

2. **Modify `copyExerciseToSession()`** — stop copying `verify.sh` into the session directory. Instead, copy it to `/app/verify-scripts/{sessionId}/verify.sh`:

   ```diff
   - const verifyScriptDst = path.join(sessionDir, 'verify.sh');
   + const verifyDir = path.join(VERIFY_SCRIPTS_DIR, sessionId);
   + await fs.mkdir(verifyDir, { recursive: true });
   + const verifyScriptDst = path.join(verifyDir, 'verify.sh');
   ```

3. **Add a new function** `getVerifyScriptPath(sessionId: string): string` that returns `/app/verify-scripts/{sessionId}/verify.sh`. This is used by the attempt route.

4. **Add a new function** `cleanupVerifyScript(sessionId: string): Promise<void>` that removes the verify script directory when a session is destroyed.

5. **Update `cleanupSessionDir()`** to also clean up the verify script directory, or call `cleanupVerifyScript` alongside it.

#### [MODIFY] [route.ts](file:///home/adam/projects/git-kata/app/api/attempt/route.ts)

Update the verify command to read from the isolated path:

```diff
- const verifyCommand = `bash ${sessionDir}/verify.sh ${sessionDir} ${sessionDir}`;
+ const verifyScriptPath = sandbox.getVerifyScriptPath(sessionId);
+ const verifyCommand = `bash ${verifyScriptPath} ${sessionDir} ${sessionDir}`;
```

#### [MODIFY] [route.ts](file:///home/adam/projects/git-kata/app/api/sandbox/[sessionId]/route.ts)

Add cleanup of verify script when session is deleted:

```diff
  await sandbox.destroyContainer(`gitkata-${sessionId}`);
  await sandbox.cleanupSessionDir(sessionId, session.userId);
+ await sandbox.cleanupVerifyScript(sessionId);
```

---

## Fix C2 — Replace `exec` with `execFile` + Validate Inputs

### Problem

`sandbox.ts` builds shell commands via string interpolation and runs them through `exec()`, which invokes `/bin/sh -c`. This means any shell metacharacters in the interpolated values could alter the command's behavior.

### Solution

Replace all `execAsync(string)` calls with `execFileAsync(binary, argsArray)`, which passes arguments directly to the specified binary without a shell. Also add input validation.

### Changes

#### [NEW] [validators.ts](file:///home/adam/projects/git-kata/lib/validators.ts)

Create a shared validation module:

```typescript
const USER_ID_REGEX = /^[a-zA-Z0-9_-]{1,100}$/;
const SESSION_ID_REGEX = /^session-[a-zA-Z0-9_-]+$/;

export function validateUserId(userId: unknown): userId is string {
  return typeof userId === 'string' && USER_ID_REGEX.test(userId);
}

export function validateSessionId(sessionId: unknown): sessionId is string {
  return typeof sessionId === 'string' && SESSION_ID_REGEX.test(sessionId);
}
```

#### [MODIFY] [sandbox.ts](file:///home/adam/projects/git-kata/lib/sandbox.ts)

1. **Replace `exec` import** with `execFile`:
   ```diff
   - import { exec } from 'child_process';
   + import { execFile } from 'child_process';
   ```

2. **Rewrite `createContainer()`** to use `execFile` with argument arrays:
   ```typescript
   const args = [
     'run', '-d',
     '--name', containerName,
     '-v', `${hostSessionDir}:/workspace`,
     '--memory', CONTAINER_LIMITS.memory,
     '--memory-reservation', CONTAINER_LIMITS.memoryReservation,
     '--cpu-quota', String(CONTAINER_LIMITS.cpuQuota),
     '--cpu-shares', String(CONTAINER_LIMITS.cpuShares),
     '--pids-limit', String(CONTAINER_LIMITS.pidsLimit),
     '--network', 'none',
     'gitkata-sandbox:latest',
   ];
   const { stdout } = await execFileAsync('docker', args);
   ```

3. **Rewrite `execInContainer()`** using `execFile`:
   ```typescript
   const args = ['exec', '-w', '/workspace', containerName, 'sh', '-c', command];
   const { stdout, stderr } = await execFileAsync('docker', args);
   ```
   Note: the `command` still runs through `sh -c` inside the container, which is fine — it's isolated in the sandbox container, not the app container.

4. **Rewrite `destroyContainer()`** using `execFile`:
   ```typescript
   await execFileAsync('docker', ['kill', containerName]);
   await execFileAsync('docker', ['rm', containerName]);
   ```

5. **Rewrite `execInWebApp()`** — this still needs shell for `cd && cmd` chaining. Refactor to use `execFile` with `sh` explicitly, or separate the `cd` into a `cwd` option:
   ```typescript
   const { stdout, stderr } = await execFileAsync('bash', ['-c', command], {
     cwd: workingDir,
   });
   ```
   This avoids string-building the `cd` prefix, using `cwd` option instead.

#### [MODIFY] API Routes — Add Input Validation

Apply `validateUserId` and `validateSessionId` at the beginning of each route handler:

- **`app/api/sandbox/create/route.ts`** — validate `userId`
- **`app/api/sandbox/exec/route.ts`** — validate `sessionId`
- **`app/api/attempt/route.ts`** — validate `userId` and `sessionId`
- **`app/api/sandbox/[sessionId]/route.ts`** — validate `sessionId` from URL params
- **`app/api/sandbox/state/[sessionId]/route.ts`** — validate `sessionId` from URL params

Example pattern:
```typescript
import { validateUserId, validateSessionId } from '@/lib/validators';

if (!validateUserId(userId)) {
  return NextResponse.json({ error: 'Invalid userId format' }, { status: 400 });
}
```

---

## Fix C1 — Docker Socket Proxy

### Problem

The Docker socket (`/var/run/docker.sock`) is mounted directly into the app container, giving it unrestricted Docker API access equivalent to root on the host.

### Solution

Deploy [Tecnativa/docker-socket-proxy](https://github.com/Tecnativa/docker-socket-proxy) as a sidecar service. It limits which Docker API endpoints the app can access.

### Changes

#### [MODIFY] [docker-compose.yaml](file:///home/adam/projects/git-kata/docker-compose.yaml)

1. **Add a new `docker-proxy` service:**
   ```yaml
   docker-proxy:
     image: tecnativa/docker-socket-proxy:latest
     environment:
       CONTAINERS: 1    # Allow container operations (create, start, stop, kill, rm)
       POST: 1          # Allow POST requests (needed for create/exec)
       EXEC: 1          # Allow exec operations
       IMAGES: 0        # Deny image operations
       VOLUMES: 0       # Deny volume operations
       NETWORKS: 0      # Deny network operations
       SERVICES: 0      # Deny service operations
       NODES: 0         # Deny node operations
       BUILD: 0         # Deny build operations
     volumes:
       - /var/run/docker.sock:/var/run/docker.sock:ro
     restart: unless-stopped
   ```

2. **Remove Docker socket mount from `app` service** and add `DOCKER_HOST` env var:
   ```diff
     app:
       environment:
   +     DOCKER_HOST: tcp://docker-proxy:2375
       volumes:
   -     - /var/run/docker.sock:/var/run/docker.sock
         - ./sessions:/app/sessions
         - ./exercises:/exercises:ro
   +   depends_on:
   +     docker-proxy:
   +       condition: service_started
   ```

#### [MODIFY] [docker-compose.dev.yaml](file:///home/adam/projects/git-kata/docker-compose.dev.yaml)

Apply the same changes as above to the development compose file.

#### [MODIFY] [sandbox.ts](file:///home/adam/projects/git-kata/lib/sandbox.ts)

No changes needed in sandbox.ts for this fix — the `docker` CLI automatically reads `DOCKER_HOST` from the environment and connects to the proxy instead of the local socket. The `execFile('docker', ...)` calls work transparently.

> [!IMPORTANT]
> After this change, the app container **no longer has any Docker socket access**. All Docker operations go through the proxy, which only allows container and exec operations. Even if an attacker achieves code execution in the app container, they cannot use Docker to escape to the host.

---

## Verification Plan

### Automated Tests (run inside dev container)

```bash
docker compose -f docker-compose.dev.yaml exec app npm test
```

Existing tests cover:
- Session creation/retrieval/cleanup (`tests/sandbox.test.ts`, `tests/sandbox-create.test.ts`)
- Command validation (valid git commands, dangerous patterns)

These tests mock the `child_process` module, so switching from `exec` to `execFile` requires updating the mocks from `exec: jest.fn()` to `execFile: jest.fn()` in `tests/sandbox.test.ts`.

### Manual Integration Tests (run in Docker)

After applying all three fixes, rebuild and run the full stack:

```bash
docker compose down
docker compose up -d --build
```

Then test the following scenarios via the web UI at `http://localhost:12000`:

1. **Normal flow works:**
   - Pick a level → start an exercise
   - Run git commands in the terminal (`git status`, `git add .`, `git commit -m "test"`)
   - Click "Submit Solution"
   - Verify you get a score/evaluation back

2. **C3 is fixed — verify.sh cannot be tampered:**
   - Start an exercise
   - In the terminal, check that `/workspace/verify.sh` does NOT exist (the sandbox should not have access to it)
   - Submit solution — it should still evaluate correctly

3. **C1 is fixed — Docker socket is not in app container:**
   - Open a shell in the app container:
     ```bash
     docker compose exec app sh
     ```
   - Verify `/var/run/docker.sock` does NOT exist:
     ```bash
     ls -la /var/run/docker.sock
     # Should return: No such file or directory
     ```
   - Verify Docker still works via proxy:
     ```bash
     docker ps
     # Should list running containers
     ```

4. **C2 is fixed — malicious userId is rejected:**
   - Open browser devtools → Network tab
   - Attempt to create a sandbox with a malicious userId by modifying the request in console:
     ```javascript
     fetch('/api/sandbox/create', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ exerciseId: '<any-valid-exercise-id>', userId: '../../../etc' })
     }).then(r => r.json()).then(console.log)
     ```
   - Should return `400` with `"Invalid userId format"`
