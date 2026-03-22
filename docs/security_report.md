# Git Kata — Security Audit Report

**Date:** 2026-03-22  
**Last updated:** 2026-03-22  
**Scope:** Full application — Docker infrastructure, backend API, sandbox isolation, frontend  

---

## Summary

| Severity | Total | Fixed | Remaining |
|----------|-------|-------|-----------|
| 🔴 Critical | 3 | 3 | 0 |
| 🟠 High | 5 | 1 | 4 |
| 🟡 Medium | 5 | 1 | 4 |
| 🔵 Low | 3 | 0 | 3 |

---

## 🔴 Critical Findings

---

### C1 — Docker Socket Mounted in App Container → Full Host Compromise

**Severity:** 🔴 Critical  
**Status:** ✅ FIXED  
**Affected files:** `docker-compose.yaml`, `docker-compose.dev.yaml`

#### Description

The Docker daemon socket is bind-mounted into the app container:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

Access to the Docker socket is **equivalent to unrestricted root access on the host machine**. Any process inside the app container can issue arbitrary Docker API calls — spawning privileged containers, mounting the host root filesystem, reading secrets, modifying host binaries, etc.

#### Attack Scenario

1. Attacker exploits any code-execution vulnerability in the Node.js application (e.g. prototype pollution in a dependency, SSRF, or — as shown in C3 — a trivially exploitable `verify.sh` escape).
2. Attacker runs: `docker run -v /:/hostfs --privileged alpine sh`
3. Attacker now has full read/write access to the host filesystem, including SSH keys, `/etc/shadow`, and all `.env` files with database credentials and API keys.

#### Why It Exists

The app needs to create/destroy sandbox Docker containers. The simplest approach is giving it the Docker socket, but this violates the principle of least privilege.

#### Recommendation

1. **Docker Socket Proxy:** Deploy [Tecnativa/docker-socket-proxy](https://github.com/Tecnativa/docker-socket-proxy) as a sidecar service. Configure it to only allow the specific Docker API endpoints needed (container create, exec, kill, remove). Block all others (volumes, images, networks, system).

   ```yaml
   docker-proxy:
     image: tecnativa/docker-socket-proxy
     environment:
       CONTAINERS: 1
       POST: 1
     volumes:
       - /var/run/docker.sock:/var/run/docker.sock
   ```

   Then configure the app to use `DOCKER_HOST=tcp://docker-proxy:2375` instead of the raw socket.

2. **Dedicated Sidecar:** Write a small API service (Go, Python, etc.) that exposes only the three operations the app needs: `createSandbox`, `execInSandbox`, `destroySandbox`. The app communicates with this sidecar over a Unix socket or internal HTTP. Only the sidecar has the Docker socket mounted.

3. **Host-level hardening:** Enable user namespace remapping (`--userns-remap`) on the Docker daemon. Apply AppArmor/SELinux profiles to the app container.

#### Resolution

Deployed `tecnativa/docker-socket-proxy` as a sidecar service in both `docker-compose.yaml` and `docker-compose.dev.yaml`. The Docker socket is mounted **read-only** into the proxy only. The app container no longer has any Docker socket mount and uses `DOCKER_HOST=tcp://docker-proxy:2375`. The proxy restricts access to container and exec operations only (images, volumes, networks, services, nodes, and build are all denied).

---

### C2 — Command Injection via Shell String Interpolation

**Severity:** 🔴 Critical  
**Status:** ✅ FIXED  
**Affected file:** `lib/sandbox.ts`

#### Description

Multiple functions in `sandbox.ts` construct shell commands by interpolating variables into strings and executing them via `child_process.exec`:

```typescript
// createContainer — line 39
const runCmd = `docker run -d \
  --name ${containerName} \
  -v ${hostSessionDir}:/workspace \
  ...`;
const { stdout } = await execAsync(runCmd);

// execInContainer — line 105
const dockerCmd = `docker exec -w /workspace ${containerName} sh -c "${command.replace(/"/g, '\\"')}"`;

// destroyContainer — lines 204–205
await execAsync(`docker kill ${containerName}`);
await execAsync(`docker rm ${containerName}`);
```

The `containerName` is derived from `sessionId` which is generated server-side (currently safe), but:

- **`userId`** is user-supplied and used to construct `hostSessionDir` (line 37):
  ```typescript
  const hostSessionDir = path.join(sessionsHostPath, userId, sessionId);
  ```
  This path is then interpolated into the `docker run -v` command. While `path.join` normalizes `..` traversals, the Docker daemon interprets the `-v` argument independently. A `userId` containing spaces or shell metacharacters could break the command or inject additional Docker flags.

- **`command`** (user's git command) is passed through `execInContainer` with only double-quote escaping. The command is wrapped in `sh -c "..."`, and while the exec route blocks `$`, `` ` ``, `&&`, `||`, `;`, this blocking happens at the API layer — `execInContainer` itself has no validation and is called by `getRepoState` and other internal functions too.

- `exec()` (string form) passes through `/bin/sh -c`, which interprets all shell metacharacters. `execFile()` (array form) does not.

#### Attack Scenario

1. Attacker sends a `userId` like `foo -v /etc/passwd:/workspace/leak` to `/api/sandbox/create`.
2. The constructed Docker command becomes: `docker run -d --name gitkata-session-... -v /sessions/foo -v /etc/passwd:/workspace/leak/session-...:/workspace ...`
3. Depending on shell parsing, additional `-v` flags or arguments could be injected, mounting arbitrary host paths.

#### Recommendation

1. **Replace `exec` with `execFile` everywhere.** `execFile` takes an argument array and does not invoke a shell:
   ```typescript
   import { execFile } from 'child_process';
   const { stdout } = await execFileAsync('docker', [
     'run', '-d',
     '--name', containerName,
     '-v', `${hostSessionDir}:/workspace`,
     '--memory', CONTAINER_LIMITS.memory,
     // ... all flags as separate array elements
     'gitkata-sandbox:latest'
   ]);
   ```

2. **Validate `userId` at every API boundary** with a strict allowlist regex: `^[a-zA-Z0-9_-]{1,100}$`. Currently only `/api/profile` validates this.

3. **Validate `sessionId` format** at every endpoint that accepts it, not just at creation.

4. **Create a shared validation module** (`lib/validators.ts`) used by all routes.

#### Resolution

All `exec()` (string-form) calls in `lib/sandbox.ts` replaced with `execFile()` (array-form) — `createContainer`, `execInContainer`, `destroyContainer`, and `execInWebApp` now use `execFileAsync('docker', [...args])` or `execFileAsync('bash', ['-c', cmd], { cwd })`. A shared `lib/validators.ts` module was created with `validateUserId()` and `validateSessionId()`, and validation is applied in all 5 API routes: `sandbox/create`, `sandbox/exec`, `sandbox/state/[sessionId]`, `sandbox/[sessionId]`, and `attempt`.

---

### C3 — Container Escape via User-Modifiable `verify.sh`

**Severity:** 🔴 Critical  
**Status:** ✅ FIXED  
**Affected files:** `lib/sandbox.ts`, `app/api/attempt/route.ts`

#### Description

When a sandbox is created, `verify.sh` is copied from the exercises directory into the **session directory**:

```typescript
// sandbox.ts — copyExerciseToSession
const verifyScriptDst = path.join(sessionDir, 'verify.sh');
await fs.copyFile(verifyScriptSrc, verifyScriptDst);
```

The session directory is **volume-mounted** into the sandbox container at `/workspace`. When the user submits their solution, `verify.sh` is executed **in the app container** (not the sandbox):

```typescript
// attempt/route.ts
const verifyCommand = `bash ${sessionDir}/verify.sh ${sessionDir} ${sessionDir}`;
const verifyResult = await sandbox.execInWebApp(verifyCommand, sessionDir);
```

`execInWebApp` runs the command directly in the app container's shell — the same container that has:
- Docker socket access (see C1)
- `DATABASE_URL` with database credentials
- `MINIMAX_API_KEY`
- Full filesystem access

#### Attack Scenario

This is **trivially exploitable**:

1. User starts an exercise (sandbox is created, `verify.sh` is copied to `/workspace/verify.sh`)
2. In the sandbox terminal, user runs:
   ```
   git init /tmp/x  # just to satisfy the "must start with git" validation
   ```
   Then modifies verify.sh in the workspace:
   ```
   # The sandbox volume-mounts /workspace, which IS the session directory
   # verify.sh is in /workspace/verify.sh and is writable
   ```
   Actually, the user can simply run a git command that has a side effect of modifying verify.sh. For example:
   ```
   git config core.hooksPath /workspace
   ```
   And then create a script. Or more directly, since the workspace is writable and the user has shell-like access via git:
   ```
   git init /workspace/exploit
   ```
   The simplest approach — the verify.sh file is in the writable `/workspace` directory. The user modifies it via any means available in the container (the container runs as root, see H2).

3. User submits their solution via the UI.
4. The app container runs the **modified** `verify.sh` which now contains:
   ```bash
   #!/bin/bash
   # Exfiltrate all secrets
   echo "DATABASE_URL=$DATABASE_URL"
   echo "MINIMAX_API_KEY=$MINIMAX_API_KEY"
   # Or: use docker socket to escape to host
   docker run --privileged -v /:/hostfs alpine cat /hostfs/etc/shadow
   ```
5. The output is returned in `verificationOutput` and included in the API response.

#### Recommendation

1. **Never run verify.sh from the session directory.** Store verification scripts in a location the sandbox container cannot access:
   ```typescript
   // Use a separate, non-mounted directory for verification scripts
   const verifyDir = `/app/verify-scripts/${sessionId}`;
   await fs.mkdir(verifyDir, { recursive: true });
   await fs.copyFile(verifyScriptSrc, path.join(verifyDir, 'verify.sh'));
   ```

2. **Better: run verify.sh in an ephemeral, unprivileged container:**
   ```typescript
   const verifyCmd = `docker run --rm \
     --network=none \
     --cap-drop=ALL \
     --read-only \
     -v ${hostSessionDir}:/workspace:ro \
     -v ${verifyScriptHostPath}:/verify.sh:ro \
     gitkata-sandbox:latest \
     bash /verify.sh /workspace /workspace`;
   ```

3. **Ensure verify.sh is immutable** after copying — use `fs.chmod` to remove write permissions, and validate its checksum before execution.

#### Resolution

`verify.sh` is now copied to `/app/verify-scripts/{sessionId}/verify.sh` — a directory that the sandbox container cannot access (sandbox only mounts the session directory at `/workspace`). The file is also `chmod 0o444` (read-only) after copying. The attempt route reads from the isolated path via `sandbox.getVerifyScriptPath(sessionId)`. Cleanup of verify scripts happens on session deletion via `sandbox.cleanupVerifyScript(sessionId)`.

---

## 🟠 High Findings

---

### H1 — No User Ownership Checks on Sandbox Exec / State / Delete

**Severity:** 🟠 High  
**Affected files:**
- `app/api/sandbox/exec/route.ts` (lines 18–21)
- `app/api/sandbox/state/[sessionId]/route.ts` (lines 12–16)
- `app/api/sandbox/[sessionId]/route.ts` (lines 13–17)

#### Description

These three endpoints only verify that a session **exists** — they do not check who owns it:

```typescript
// exec/route.ts
const session = sessionManager.getSession(sessionId);
if (!session) {
  return NextResponse.json({ error: 'Session not found' }, { status: 404 });
}
// ← No check: session.userId === the requesting user's ID
```

By contrast, the `attempt` route **does** perform this check:

```typescript
// attempt/route.ts
if (session.userId !== userId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
}
```

#### Attack Scenario

1. User A creates a sandbox session. The `sessionId` is returned in the API response.
2. User B (or an attacker who observes/guesses session IDs — see M1) sends requests:
   - `POST /api/sandbox/exec` with User A's `sessionId` → executes commands in User A's container
   - `GET /api/sandbox/state/{sessionId}` → reads User A's repository state, commit history
   - `DELETE /api/sandbox/{sessionId}` → destroys User A's session (denial of service)

#### Recommendation

Add ownership verification to all sandbox endpoints. Every request should include `userId` (from localStorage on the client) and the server must verify:

```typescript
const { sessionId, userId } = await request.json();
const session = sessionManager.getSession(sessionId);
if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
if (session.userId !== userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
```

For the `GET` and `DELETE` endpoints, accept `userId` as a query parameter or header.

---

### H2 — Sandbox Container Runs as Root

**Severity:** 🟠 High  
**Affected file:** `sandbox/Dockerfile`

#### Description

The sandbox Dockerfile does not include a `USER` directive:

```dockerfile
FROM alpine:3.19
RUN apk add --no-cache git bash coreutils \
    && git config --global user.email "kata@git.local" \
    && git config --global user.name "Kata User" \
    && git config --global init.defaultBranch main
WORKDIR /workspace
CMD ["sleep", "infinity"]
```

The container process runs as **UID 0 (root)**. This means:
- Files written to the volume-mounted `/workspace` are owned by root on the host
- If any container escape vulnerability exists in the Docker runtime, root in the container maps to root on the host (unless user namespace remapping is configured)
- The user has more privileges than needed inside the container — they only need to run `git` commands

#### Recommendation

Add a non-root user:

```dockerfile
RUN adduser -D -u 1000 kata
# Set git config for the new user
USER kata
RUN git config --global user.email "kata@git.local" \
    && git config --global user.name "Kata User" \
    && git config --global init.defaultBranch main
WORKDIR /workspace
```

Ensure the session directory is writable by UID 1000 when created.

---

### H3 — No Capability Dropping or Security Options on Sandbox Containers

**Severity:** 🟠 High  
**Affected file:** `lib/sandbox.ts` (lines 39–48)

#### Description

The `docker run` command applies resource limits and `--network=none`, which is a good start. However, it does not apply any Linux security hardening:

```typescript
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
```

**Missing security flags:**

| Flag | Purpose | Risk if Missing |
|------|---------|-----------------|
| `--cap-drop=ALL` | Remove all Linux capabilities | Container retains default caps including `CAP_SYS_ADMIN`, `CAP_NET_RAW`, `CAP_SETUID`, etc. |
| `--security-opt=no-new-privileges` | Prevent privilege escalation via setuid binaries | Setuid binaries in the container could escalate privileges |
| `--read-only` | Read-only root filesystem | User can modify any file in the container (e.g. install additional tools, modify system files) |
| `--tmpfs /tmp` | Writable temp directory when using `--read-only` | Needed for git operations to work with read-only root |
| `--security-opt seccomp=<profile>` | Restrict available syscalls | Container can use any syscall including `mount`, `ptrace`, etc. |

#### Recommendation

Update the `docker run` command:

```typescript
const runCmd = `docker run -d \
  --name ${containerName} \
  -v ${hostSessionDir}:/workspace \
  --memory="${CONTAINER_LIMITS.memory}" \
  --memory-reservation="${CONTAINER_LIMITS.memoryReservation}" \
  --cpu-quota=${CONTAINER_LIMITS.cpuQuota} \
  --cpu-shares=${CONTAINER_LIMITS.cpuShares} \
  --pids-limit=${CONTAINER_LIMITS.pidsLimit} \
  --network=none \
  --cap-drop=ALL \
  --security-opt=no-new-privileges \
  --read-only \
  --tmpfs /tmp \
  gitkata-sandbox:latest`;
```

---

### H4 — Blanket `git config --global safe.directory "*"` Disables Git Security

**Severity:** 🟠 High  
**Affected file:** `lib/sandbox.ts` (line 131)

#### Description

```typescript
await execAsync('git config --global --add safe.directory "*" 2>/dev/null || true');
```

This is called every time `execInWebApp` runs. It disables Git's [CVE-2022-24765](https://github.blog/2022-04-12-git-security-vulnerability-announced/) protection **globally** in the app container. This protection was added to prevent privilege escalation attacks where a malicious `.git` directory in a shared/world-writable location could be used to execute arbitrary code when an administrator runs git commands in that directory.

By setting `safe.directory` to `*`, the app container will trust **any** `.git` directory, regardless of ownership. Since the session directories contain user-controlled git repositories, this creates an exploitation vector.

#### Recommendation

Set `safe.directory` only for the specific session directory being processed:

```typescript
const safeDir = `/app/sessions/${userId}/${sessionId}`;
await execAsync(`git config --global --add safe.directory "${safeDir}" 2>/dev/null || true`);
```

Or better yet, set it as an environment variable for the specific command:

```typescript
const cdCmd = `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=safe.directory GIT_CONFIG_VALUE_0="${workingDir}" ${escapedCommand}`;
```

---

### H5 — Database Port Exposed to All Interfaces in Dev Compose

**Severity:** 🟠 High  
**Status:** ✅ FIXED  
**Affected file:** `docker-compose.dev.yaml`

#### Description

```yaml
ports:
  - "5432:5432"
```

The development compose file exposes PostgreSQL on `0.0.0.0:5432` — all network interfaces. If the development machine has a public IP (e.g. a cloud VM, or a machine on an open Wi-Fi network), the database is accessible from the internet without any firewall.

The database credentials are in `.env` and may be weak defaults. PostgreSQL's `pg_hba.conf` in the official Docker image allows password authentication from any IP by default.

#### Recommendation

Bind to localhost only:

```yaml
ports:
  - "127.0.0.1:5432:5432"
```

Or remove the port mapping entirely if local access is not needed (the app communicates with the DB over Docker's internal network).

#### Resolution

Dev compose DB port binding changed from `"5432:5432"` to `"127.0.0.1:5432:5432"`.

---

## 🟡 Medium Findings

---

### M1 — Session IDs Are Predictable

**Severity:** 🟡 Medium  
**Affected file:** `app/api/sandbox/create/route.ts` (line 61)

#### Description

```typescript
const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
```

The session ID consists of:
- `session-` — constant prefix
- `Date.now()` — millisecond timestamp, trivially predictable if the attacker knows the approximate creation time
- `Math.random().toString(36).substr(2, 9)` — 9 characters from base-36, generated by `Math.random()` which is **not cryptographically secure**

`Math.random()` in V8 (Node.js) uses the xorshift128+ algorithm, which has a state of 128 bits but can be reversed from a small number of outputs. In practice, the entropy of this session ID is far less than the theoretical maximum.

Combined with H1 (no ownership checks), a predictable session ID allows an attacker to access another user's sandbox.

#### Recommendation

Use `crypto.randomUUID()` which is cryptographically secure:

```typescript
import { randomUUID } from 'crypto';
const sessionId = `session-${randomUUID()}`;
```

---

### M2 — Inconsistent `userId` Validation Across API Endpoints

**Severity:** 🟡 Medium  
**Status:** ✅ FIXED (as part of C2 fix)  
**Affected files:**
- `app/api/profile/route.ts` — ✅ validates format
- `app/api/sandbox/create/route.ts` — ✅ validates format
- `app/api/attempt/route.ts` — ✅ validates format

#### Description

The profile endpoint validates `userId` with a strict regex:

```typescript
if (!userId || userId.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(userId)) {
  return NextResponse.json({ error: 'Invalid userId format' }, { status: 400 });
}
```

But `sandbox/create` and `attempt` accept **any string** as `userId` — including strings with:
- Path separators (`/`, `\`) → path traversal in session directories
- Shell metacharacters → exploitation in shell commands (see C2)
- Very long strings → filesystem path length exhaustion
- Unicode characters → potential encoding-based bypasses

Additionally, `sandbox/create` auto-creates a user record with any `userId` via `prisma.user.upsert`, making it trivial to pollute the User table.

#### Recommendation

Create a shared validation utility and apply it consistently:

```typescript
// lib/validators.ts
export function validateUserId(userId: unknown): userId is string {
  return typeof userId === 'string'
    && userId.length > 0
    && userId.length <= 100
    && /^[a-zA-Z0-9_-]+$/.test(userId);
}
```

Use it in every route that accepts `userId`.

#### Resolution

Shared `lib/validators.ts` module created with `validateUserId()` and `validateSessionId()`. Both validators are applied consistently across all API routes that accept these parameters: `sandbox/create`, `sandbox/exec`, `sandbox/state/[sessionId]`, `sandbox/[sessionId]`, and `attempt`.

---

### M3 — Git Command Validation Can Be Bypassed via Git's Built-in Capabilities

**Severity:** 🟡 Medium → 🔵 **Low** (risk reduced — see note)  
**Status:** ⚠️ REMAINING  
**Affected file:** `app/api/sandbox/exec/route.ts` (lines 25–50)

> [!NOTE]
> **Risk reduced by C3 fix.** The primary exploitation chain for M3 was using git subcommand tricks to modify `verify.sh`, which would then execute in the privileged app container (C3). Since C3 is now fixed (`verify.sh` is stored outside the sandbox-accessible directory), M3 can only affect the user's own sandbox container, which is isolated with `--network=none` and resource limits. The effective severity is now **Low**.

#### Description

The command validation is:

```typescript
// Must start with 'git '
if (!trimmedCommand.startsWith('git ')) { ... }

// Block dangerous shell patterns
const dangerousPatterns = [/&&/, /\|\|/, /;/, /\$/, /`/, /\$\(/, /\$\(/];
if (dangerousPatterns.some((p) => p.test(trimmedCommand))) { ... }
```

This blocks shell injection but does **not** account for Git's own ability to execute arbitrary commands:

| Vector | Example | Effect |
|--------|---------|--------|
| `-c` config override | `git -c core.pager='cat /etc/passwd' log` | Runs arbitrary command as pager |
| `-c` config override | `git -c core.editor='malicious_cmd' commit --amend` | Runs arbitrary command as editor |
| `-c` alias | `git -c alias.x='!cat /etc/passwd' x` | Runs shell command via alias |
| Config alias | `git config alias.x '!cat /etc/passwd'` then `git x` | Persists a shell alias |
| Hooks | `git config core.hooksPath /workspace/.hooks` | Triggers hooks on next git operation |

Note: The sandbox has `--network=none` which limits the impact (no data exfiltration over network), and with C3 fixed, all effects are contained to the user's own sandbox container.

Additionally, the pattern `\$(` is listed **twice** (duplicated), and `\` (backslash) is not blocked.

#### Recommendation

1. **Whitelist allowed git subcommands.** Only allow known-safe subcommands:
   ```typescript
   const ALLOWED_SUBCOMMANDS = [
     'add', 'branch', 'checkout', 'cherry-pick', 'clone', 'commit',
     'config', 'diff', 'fetch', 'init', 'log', 'merge', 'pull',
     'push', 'rebase', 'reflog', 'remote', 'reset', 'restore',
     'revert', 'rm', 'show', 'stash', 'status', 'switch', 'tag',
   ];
   ```

2. **Block the `-c` flag** which allows arbitrary config overrides:
   ```typescript
   if (trimmedCommand.includes(' -c ') || trimmedCommand.match(/^git\s+-c/)) {
     return error('The -c flag is not allowed');
   }
   ```

3. **Block `!` in arguments** (used for shell execution in aliases):
   ```typescript
   if (trimmedCommand.includes('!')) {
     return error('Shell execution via ! is not allowed');
   }
   ```

4. **Remove the duplicate** `\$(` pattern from `dangerousPatterns`.

---

### M4 — App Container Runs as Root

**Severity:** 🟡 Medium  
**Status:** ⚠️ REMAINING (risk reduced — see note)  
**Affected file:** `Dockerfile`

> [!NOTE]
> **Risk reduced by C1 fix.** Previously, running as root combined with the Docker socket mount meant root-in-container could directly control the Docker daemon. Since C1 is now fixed (Docker socket replaced by proxy), running as root still increases the blast radius of any vulnerability but no longer enables direct host escape via Docker.

#### Description

The main application Dockerfile does not include a `USER` directive in either the production or development stage:

```dockerfile
FROM base AS production
# ... copies, chmod, etc.
CMD ["./scripts/start.sh"]

FROM base AS development
# ... copies, etc.
CMD ["./scripts/start.sh"]
```

The app runs as root inside the container. Even without the Docker socket, running as root increases the blast radius of any vulnerability — the app can modify any file in the container, bind to privileged ports, and if a container escape exists, maps to root on the host.

#### Recommendation

Add a non-root user:

```dockerfile
FROM base AS production
RUN adduser -D -u 1000 appuser
# ... copies ...
USER appuser
CMD ["./scripts/start.sh"]
```

---

### M5 — `SESSIONS_HOST_PATH` Defaults to Hardcoded Developer Path

**Severity:** 🟡 Medium  
**Affected files:** `docker-compose.yaml` (line 38), `docker-compose.dev.yaml` (line 44)

#### Description

```yaml
SESSIONS_HOST_PATH: ${SESSIONS_HOST_PATH:-/home/adam/projects/git-kata/sessions}
```

The environment variable defaults to a hardcoded developer's home directory. In production:
- If `SESSIONS_HOST_PATH` is not set in `.env`, Docker will attempt to use `/home/adam/projects/git-kata/sessions` on the host
- If this directory doesn't exist, container volume mounts will fail silently with empty directories
- If it does exist (left over from development), it may contain stale session data

This is more of a reliability/misconfiguration issue than a direct vulnerability, but in a security context, unexpected file paths can lead to information leakage or denial of service.

#### Recommendation

1. Remove the default value — fail explicitly if `SESSIONS_HOST_PATH` is not set:
   ```yaml
   SESSIONS_HOST_PATH: ${SESSIONS_HOST_PATH:?SESSIONS_HOST_PATH must be set}
   ```

2. Add a check in `start.sh` to verify the sessions directory exists and is writable.

3. Document the required environment variables clearly in `.env.example`.

---

## 🔵 Low Findings

---

### L1 — Leaderboard API Exposes Internal User IDs

**Severity:** 🔵 Low  
**Affected file:** `app/api/leaderboard/route.ts` (line 39)

#### Description

The leaderboard response includes the internal `userId` (UUID) for every participant:

```typescript
return {
  userId: user.id,     // ← exposed
  userName: user.name,
  score: totalScore,
  exercisesCompleted,
  avgTime: Math.round(avgTime),
};
```

Since the application relies on `userId` as the sole authentication mechanism (stored in localStorage, sent with every request), exposing user IDs on the leaderboard allows any user to:
- View another user's profile: `GET /api/profile?userId={leaked_id}`
- Impersonate another user by setting their UUID in localStorage
- Create sandbox sessions as another user
- Submit attempts as another user

#### Recommendation

1. **Remove `userId` from the leaderboard response.** Use only `userName` for display.
2. In the long term, implement proper authentication (e.g. session cookies, JWT tokens) rather than relying on client-provided UUIDs.

---

### L2 — No Rate Limiting on Any Endpoint

**Severity:** 🔵 Low  
**Affected files:** All API routes

#### Description

No rate limiting exists on any endpoint. There is no middleware, no per-IP throttling, and no per-user throttling. This allows:

| Attack | Endpoint | Impact |
|--------|----------|--------|
| Container bomb | `POST /api/sandbox/create` | Exhaust Docker resources, DoS the host |
| API credit drain | `POST /api/attempt` | Each attempt calls the MiniMax API; unbounded calls drain credits |
| Session ID brute-force | `POST /api/sandbox/exec` | Try random session IDs to find active sessions (see M1, H1) |
| Database DoS | `GET /api/leaderboard` | Complex aggregation query with no caching |

#### Recommendation

Add rate limiting middleware. Options for Next.js:
- [`next-rate-limit`](https://www.npmjs.com/package/next-rate-limit) — simple in-memory rate limiter
- Custom middleware using a `Map<IP, timestamps[]>` with sliding window
- For Docker deployments, add rate limiting at the reverse proxy level (nginx, Traefik)

Suggested limits:
- `/api/sandbox/create`: 5 requests per minute per IP
- `/api/sandbox/exec`: 60 requests per minute per session
- `/api/attempt`: 3 requests per minute per user
- `/api/leaderboard`: 10 requests per minute per IP

---

### L3 — Verbose Console Logging Leaks Sensitive Data in Production

**Severity:** 🔵 Low  
**Affected files:** All API routes, `lib/minimax.ts`, `lib/sandbox.ts`, `lib/session-manager.ts`

#### Description

Extensive `console.log` and `console.error` statements are present throughout the codebase, logging sensitive information:

```typescript
// minimax.ts
console.log('[MINIMAX] Full prompt:\n', prompt);
console.log('[MINIMAX] API response data:', JSON.stringify(data));

// sandbox.ts
console.log(`[DOCKER] Exec command: ${dockerCmd}`);

// session-manager.ts
console.log(`[SESSION] Created session ${sessionId} for user ${userId} exercise ${exerciseId} container ${containerId}`);

// attempt/route.ts
console.log('[ATTEMPT] Request body:', { sessionId, exerciseId, userId, duration });
```

In production, Docker captures all stdout/stderr via `docker compose logs`. Anyone with access to the logs can see:
- Full LLM prompts and responses (including exercise solutions)
- Session IDs and user IDs
- Docker commands being executed (including volume mount paths)
- Database query results

#### Recommendation

1. Replace `console.log` with a structured logger (e.g. `pino`, `winston`) that supports log levels.
2. Set the log level to `info` or `warn` in production.
3. Never log full API responses, prompts, or credentials at any log level.
4. Use `debug` level for detailed diagnostic information.

---

## ✅ Positive Security Findings

The following security practices are already in place and should be maintained:

| Practice | Status | Details |
|----------|--------|---------|
| `.env` excluded from git | ✅ | `.env` is in `.gitignore` |
| Sandbox network isolation | ✅ | `--network=none` prevents outbound connections |
| Sandbox resource limits | ✅ | Memory (256MB), CPU (50%), PID (64) limits applied |
| Attempt ownership check | ✅ | `attempt/route.ts` verifies `session.userId !== userId` |
| No API keys in frontend | ✅ | No `NEXT_PUBLIC_*` variables expose secrets |
| No credentials in client code | ✅ | Frontend has no access to `DATABASE_URL` or `MINIMAX_API_KEY` |
| Prisma singleton pattern | ✅ | Prevents connection pool exhaustion |
| Exercises mounted read-only | ✅ | `./exercises:/exercises:ro` in docker-compose |
| Input validation consistent | ✅ | `lib/validators.ts` applied across all routes (M2 fixed) |
| Docker socket isolated | ✅ | App uses socket proxy, no direct socket mount (C1 fixed) |
| No shell injection in sandbox.ts | ✅ | All calls use `execFile` array form (C2 fixed) |
| verify.sh isolated from sandbox | ✅ | Stored in `/app/verify-scripts/`, inaccessible to sandbox (C3 fixed) |
| Dev DB bound to localhost | ✅ | Port `127.0.0.1:5432` only (H5 fixed) |

---

## Remaining Remediation Priority

| Priority | Finding | Effort | Impact |
|----------|---------|--------|--------|
| 1 | **H1** — Ownership checks | Low | Prevents cross-user access to sandboxes |
| 2 | **H2+H3** — Sandbox hardening | Low | Defense in depth for container isolation |
| 3 | **M1** — Crypto session IDs | Low | Prevents session ID prediction |
| 4 | **H4** — safe.directory | Low | Restores Git's ownership security check |
| 5 | **M3** — Git subcommand whitelist | Medium | Limits abuse within sandbox (low risk now) |
| 6 | **L1** — Leaderboard user IDs | Low | Reduces information exposure |
| 7 | **L2** — Rate limiting | Medium | Prevents resource exhaustion |
| 8 | **L3** — Logging | Medium | Prevents sensitive data in logs |
| 9 | **M4** — App non-root | Medium | Reduces blast radius (lower risk with C1 fixed) |
| 10 | **M5** — Host path default | Low | Prevents misconfiguration |

---

## Resolved Findings

| Finding | Fix Date | Resolution |
|---------|----------|------------|
| **C1** — Docker socket exposure | 2026-03-22 | Docker socket proxy sidecar deployed |
| **C2** — Shell command injection | 2026-03-22 | `exec` → `execFile` + shared input validators |
| **C3** — verify.sh container escape | 2026-03-22 | verify.sh isolated to `/app/verify-scripts/` |
| **H5** — Dev DB port exposed | 2026-03-22 | Bound to `127.0.0.1` |
| **M2** — Inconsistent userId validation | 2026-03-22 | `lib/validators.ts` applied to all routes |
