# Git Kata - Implementation Plan

## 1. Project Setup

### 1.1 Initial Structure

```
git-kata/
├── app/
│ ├── page.tsx
│ ├── layout.tsx
│ ├── globals.css
│ ├── profile/
│ │ └── page.tsx
│ ├── leaderboard/
│ │ └── page.tsx
│ ├── challenge/
│ │ └── [id]/
│ │ └── page.tsx
│ ├── api/
│ │ ├── exercises/
│ │ │ ├── route.ts
│ │ │ └── [id]/
│ │ │ └── route.ts
│ │ ├── sandbox/
│ │ │ ├── create/
│ │ │ │ └── route.ts
│ │ │ ├── exec/
│ │ │ │ └── route.ts
│ │ │ ├── state/
│ │ │ │ └── [sessionId]/
│ │ │ │ └── route.ts
│ │ │ └── [sessionId]/
│ │ │ └── route.ts
│ │ ├── attempt/
│ │ │ └── route.ts
│ │ ├── profile/
│ │ │ └── route.ts
│ │ └── leaderboard/
│ │ └── route.ts
│ └── components/
│ ├── Navbar.tsx
│ ├── Terminal.tsx
│ ├── ExercisePanel.tsx
│ ├── FeedbackModal.tsx
│ └── AsciiArt.tsx
├── lib/
│ ├── prisma.ts
│ ├── sandbox.ts
│ ├── minimax.ts
│ ├── types.ts
│ ├── session-manager.ts
│ └── exercise-loader.ts
├── prisma/
│ ├── schema.prisma
│ └── seed.ts
├── scripts/
│ ├── start.sh
│ └── scan-exercises.ts
├── sandbox/
│ └── Dockerfile
├── exercises/
│ ├── problems/
│ │ └── (exercise folders)/
│ │ └── (each contains content/ + spec.yaml)
│ └── solutions/
│ └── (solution folders)/
│ └── (each contains content/ + verify.sh)
├── public/
│ └── ascii-logo.txt
├── docs/
│ ├── functional_specification.md
│ └── implementation_plan.md
├── docker-compose.yaml
├── Dockerfile
├── package.json
├── tsconfig.json
├── next.config.mjs
├── .env.example
└── .gitignore
```

### 1.2 Dependencies

```json
{
  "name": "git-kata",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:push": "prisma db push",
    "db:generate": "prisma generate",
    "db:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "^5.10.2",
    "lucide-react": "^0.344.0",
    "next": "^14.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-markdown": "^10.1.0",
    "rehype-raw": "^7.0.0",
    "remark-gfm": "^4.0.1"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "prisma": "^5.10.2",
    "tsx": "^4.7.0",
    "typescript": "^5"
  }
}
```

---

## 2. Implementation Phases

### Phase 1: Foundation (Priority: Critical)

**Duration:** ~3 hours

#### Tasks

| ID | Task | Files | Status |
|----|------|-------|--------|
| F-01 | Create package.json with dependencies | `package.json` | Pending |
| F-02 | Create tsconfig.json | `tsconfig.json` | Pending |
| F-03 | Create next.config.mjs | `next.config.mjs` | Pending |
| F-04 | Create Prisma schema | `prisma/schema.prisma` | Pending |
| F-05 | Create lib/prisma.ts singleton | `lib/prisma.ts` | Pending |
| F-06 | Create lib/types.ts | `lib/types.ts` | Pending |
| F-07 | Create app/globals.css (Matrix theme) | `app/globals.css` | Pending |
| F-08 | Create app/layout.tsx | `app/layout.tsx` | Pending |
| F-09 | Create .env.example | `.env.example` | Pending |
| F-10 | Create .gitignore | `.gitignore` | Pending |

#### Detailed Implementation

**F-01: package.json**
```json
{
  "name": "git-kata",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:push": "prisma db push",
    "db:generate": "prisma generate",
    "db:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "^5.10.2",
    "lucide-react": "^0.344.0",
    "next": "^14.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-markdown": "^10.1.0",
    "rehype-raw": "^7.0.0",
    "remark-gfm": "^4.0.1"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "prisma": "^5.10.2",
    "tsx": "^4.7.0",
    "typescript": "^5"
  }
}
```

**F-04: Prisma Schema**
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id         String     @id @default(uuid())
  name       String     @default("anonymous")
  createdAt  DateTime   @default(now())
  lastActive DateTime   @updatedAt
  attempts   Attempt[]
  scores     Score[]
}

model Exercise {
  id String @id @default(uuid())
  level Int
  category String
  title String
  path String @db.Text
  timeLimit Int @default(600)
  order Int @default(0)
  attempts Attempt[]
  scores Score[]

  @@index([level, category])
  @@index([order])
}

model Attempt {
  id         String   @id @default(uuid())
  userId     String
  exerciseId String
  user       User     @relation(fields: [userId], references: [id])
  exercise   Exercise @relation(fields: [exerciseId], references: [id])
  commands   String   @db.Text
  output     String   @db.Text
  passed     Boolean
  score      Int
  feedback   String   @db.Text
  duration   Int
  createdAt  DateTime @default(now())

  @@index([userId, exerciseId])
  @@index([createdAt])
}

model Score {
  id          String   @id @default(uuid())
  userId      String
  exerciseId  String
  user        User     @relation(fields: [userId], references: [id])
  exercise    Exercise @relation(fields: [exerciseId], references: [id])
  bestScore   Int      @default(0)
  completions Int      @default(0)
  bestTime    Int?

  @@unique([userId, exerciseId])
}

model Config {
  key   String @id
  value String
}
```

**F-07: globals.css (Matrix Theme)**
```css
:root {
  --bg-primary: #0a0a0a;
  --bg-secondary: #0d1117;
  --bg-tertiary: #161b22;
  --text-primary: #00ff41;
  --text-dim: #008f11;
  --text-bright: #ffffff;
  --accent: #00ff41;
  --error: #ff0040;
  --success: #00ff41;
  --border: #008f11;
  --border-dim: #003d00;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
  font-size: 14px;
  line-height: 1.5;
  overflow: hidden;
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--bg-primary);
}

::-webkit-scrollbar-thumb {
  background: var(--border-dim);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--border);
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
}

.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--border-dim);
  background: var(--bg-secondary);
}

.navbar-logo {
  font-weight: bold;
  color: var(--text-primary);
  text-decoration: none;
}

.navbar-links {
  display: flex;
  gap: 1rem;
}

.navbar-link {
  color: var(--text-dim);
  text-decoration: none;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--border-dim);
  transition: all 0.2s;
}

.navbar-link:hover {
  color: var(--text-primary);
  border-color: var(--border);
  background: rgba(0, 255, 65, 0.1);
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.terminal-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-dim);
  margin: 1rem;
  background: var(--bg-secondary);
}

.terminal-header {
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--border-dim);
  color: var(--text-dim);
  font-size: 12px;
}

.terminal-output {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  white-space: pre-wrap;
  word-break: break-all;
}

.terminal-line {
  margin: 0;
  padding: 0;
}

.terminal-line.command {
  color: var(--text-bright);
}

.terminal-line.output {
  color: var(--text-dim);
}

.terminal-line.error {
  color: var(--error);
}

.terminal-input-container {
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  border-top: 1px solid var(--border-dim);
}

.terminal-prompt {
  color: var(--text-primary);
  margin-right: 0.5rem;
}

.terminal-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-family: inherit;
  font-size: inherit;
  outline: none;
}

.btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:hover {
  background: rgba(0, 255, 65, 0.1);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--text-primary);
  color: var(--bg-primary);
}

.btn-primary:hover {
  background: var(--text-dim);
}

.level-btn {
  display: inline-block;
  padding: 1rem 2rem;
  margin: 0.5rem;
  border: 2px solid var(--border);
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.level-btn:hover {
  background: rgba(0, 255, 65, 0.1);
  transform: translateY(-2px);
}

.level-btn[data-level="1"] { border-color: #00ff41; }
.level-btn[data-level="2"] { border-color: #00cc33; }
.level-btn[data-level="3"] { border-color: #009922; }
.level-btn[data-level="4"] { border-color: #006611; }

.ascii-art {
  white-space: pre;
  font-size: 12px;
  line-height: 1.2;
  color: var(--text-primary);
  margin: 2rem 0;
}

.exercise-panel {
  border: 1px solid var(--border-dim);
  padding: 1rem;
  margin: 1rem;
  background: var(--bg-secondary);
}

.exercise-title {
  font-size: 1.2rem;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.exercise-meta {
  font-size: 0.85rem;
  color: var(--text-dim);
  margin-bottom: 1rem;
}

.timer {
  font-size: 1rem;
  color: var(--text-primary);
}

.timer.warning {
  color: var(--error);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  padding: 2rem;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--border-dim);
  padding-bottom: 1rem;
}

.modal-close {
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 1.5rem;
  cursor: pointer;
}

.modal-close:hover {
  color: var(--text-primary);
}

.score-display {
  font-size: 2rem;
  text-align: center;
  margin: 1rem 0;
}

.feedback-section {
  margin-top: 1rem;
  padding: 1rem;
  border: 1px solid var(--border-dim);
  background: var(--bg-primary);
}

.leaderboard-table {
  width: 100%;
  border-collapse: collapse;
}

.leaderboard-table th,
.leaderboard-table td {
  padding: 0.5rem;
  border-bottom: 1px solid var(--border-dim);
  text-align: left;
}

.leaderboard-table th {
  color: var(--text-dim);
  font-weight: normal;
}

.leaderboard-table tr.current-user {
  background: rgba(0, 255, 65, 0.1);
}

.progress-bar {
  height: 20px;
  background: var(--bg-primary);
  border: 1px solid var(--border-dim);
  position: relative;
}

.progress-bar-fill {
  height: 100%;
  background: var(--text-primary);
  transition: width 0.3s;
}

.progress-bar-text {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  color: var(--bg-primary);
  font-size: 12px;
  line-height: 20px;
}

@media (max-width: 768px) {
  .navbar {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .level-btn {
    padding: 0.75rem 1.5rem;
    font-size: 0.9rem;
  }
  
  .terminal-container {
    margin: 0.5rem;
  }
}
```

---

### Phase 2: Docker Infrastructure (Priority: Critical)

**Duration:** ~2 hours

#### Tasks

| ID | Task | Files | Status |
|----|------|-------|--------|
| D-01 | Create sandbox Dockerfile | `sandbox/Dockerfile` | Pending |
| D-02 | Create app Dockerfile | `Dockerfile` | Pending |
| D-03 | Create docker-compose.yaml | `docker-compose.yaml` | Pending |
| D-04 | Create scripts/start.sh | `scripts/start.sh` | Pending |
| D-05 | Create scripts/scan-exercises.ts | `scripts/scan-exercises.ts` | Pending |
| D-06 | Create sample exercise structure | `exercises/problems/*/` | Pending |

#### Detailed Implementation

**D-01: Sandbox Dockerfile**
```dockerfile
FROM alpine:3.19

RUN apk add --no-cache \
    git \
    bash \
    coreutils \
    && git config --global user.email "kata@git.local" \
    && git config --global user.name "Kata User" \
    && git config --global init.defaultBranch main

WORKDIR /workspace

CMD ["sleep", "infinity"]
```

**D-02: App Dockerfile**
```dockerfile
FROM node:20-alpine AS base

WORKDIR /app

RUN apk add --no-cache \
    openssl \
    docker-cli \
    bash

COPY package.json ./
RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

RUN chmod +x scripts/start.sh

EXPOSE 3000

CMD ["./scripts/start.sh"]
```

**D-03: docker-compose.yaml**
```yaml
services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: gitkata
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 5s
      timeout: 5s
      retries: 5

  sandbox-base:
    build:
      context: ./sandbox
      dockerfile: Dockerfile
    image: gitkata-sandbox:latest
    restart: "no"

  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "12000:3000"
    environment:
      DATABASE_URL: ${DB_URL}
      MINIMAX_API_KEY: ${MINIMAX_API_KEY}
      MINIMAX_BASE_URL: ${MINIMAX_BASE_URL:-https://api.minimax.io/anthropic/v1/messages}
      SANDBOX_IMAGE: gitkata-sandbox:latest
      EXERCISES_PATH: /exercises
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - sessions:/sessions
      - ./exercises:/exercises:ro
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  volumes:
    pgdata:
    sessions:
```

**D-04: scripts/start.sh**
```bash
#!/bin/sh

echo "Waiting for database to be ready..."
until nc -z db 5432; do
  sleep 1
done
echo "Database is ready!"

echo "Pushing database schema..."
npx prisma db push

echo "Scanning exercises..."
node scripts/scan-exercises.js

echo "Starting application..."
npm run start
```

---

### Phase 3: Sandbox System (Priority: Critical)

**Duration:** ~3 hours

#### Tasks

| ID | Task | Files | Status |
|----|------|-------|--------|
| S-01 | Create session manager | `lib/session-manager.ts` | Pending |
| S-02 | Create sandbox lib | `lib/sandbox.ts` | Pending |
| S-03 | Create exercise loader | `lib/exercise-loader.ts` | Pending |
| S-04 | Create sandbox API routes | `app/api/sandbox/*` | Pending |
| S-05 | Implement session cleanup | `lib/session-manager.ts` | Pending |

#### Detailed Implementation

**S-01: Session Manager**
```typescript
// lib/session-manager.ts

interface Session {
  id: string;
  userId: string;
  exerciseId: string;
  containerId: string;
  createdAt: Date;
  lastActivity: Date;
  commands: { command: string; output: string; timestamp: Date }[];
}

const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const sessions = new Map<string, Session>();
const cleanupInterval = setInterval(cleanupSessions, 60 * 1000);

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function createSession(userId: string, exerciseId: string, containerId: string): Session {
  const session: Session = {
    id: generateSessionId(),
    userId,
    exerciseId,
    containerId,
    createdAt: new Date(),
    lastActivity: new Date(),
    commands: [],
  };
  sessions.set(session.id, session);
  return session;
}

function getSession(sessionId: string): Session | undefined {
  return sessions.get(sessionId);
}

function updateActivity(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActivity = new Date();
  }
}

function addCommand(sessionId: string, command: string, output: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.commands.push({
      command,
      output,
      timestamp: new Date(),
    });
    session.lastActivity = new Date();
  }
}

async function destroySession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (session) {
    await destroyContainer(session.containerId);
    sessions.delete(sessionId);
  }
}

async function cleanupSessions(): Promise<void> {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.lastActivity.getTime() > SESSION_TIMEOUT_MS) {
      await destroySession(id);
    }
  }
}

export const sessionManager = {
  createSession,
  getSession,
  updateActivity,
  addCommand,
  destroySession,
  cleanupSessions,
};
```

**S-02: Sandbox Lib**
```typescript
// lib/sandbox.ts

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { sessionManager } from './session-manager';

const execAsync = promisify(exec);

const CONTAINER_LIMITS = {
  memory: '256m',
  memoryReservation: '128m',
  cpuQuota: 50000,
  cpuShares: 512,
  pidsLimit: 64,
};

const SESSIONS_DIR = '/sessions';

interface ExerciseSetup {
  branches: { name: string; commits: string[] }[];
  files: { path: string; content: string }[];
  currentBranch?: string;
}

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
  return yaml.parse(specContent);
}

async function getSolutionRepo(exercisePath: string): Promise<string> {
  // Returns path to the solution content directory
  return path.join(process.env.EXERCISES_PATH || '/exercises', 'solutions', exercisePath, 'content');
}

async function getSolutionPath(exercisePath: string): Promise<string> {
  // Returns path to the solution directory (for verify.sh access)
  return path.join(process.env.EXERCISES_PATH || '/exercises', 'solutions', exercisePath);
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
  initializeExercise,
  execInContainer,
  getRepoState,
  destroyContainer,
  cleanupSessionDir,
};
```

**S-03: Sandbox API Routes**

```typescript
// app/api/sandbox/create/route.ts

import { NextResponse } from 'next/server';
import { sandbox } from '@/lib/sandbox';
import { sessionManager } from '@/lib/session-manager';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { exerciseId, userId } = await request.json();
    
    if (!exerciseId || !userId) {
      return NextResponse.json(
        { error: 'exerciseId and userId are required' },
        { status: 400 }
      );
    }
    
    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
    });
    
    if (!exercise) {
      return NextResponse.json({ error: 'Exercise not found' }, { status: 404 });
    }
    
    await sandbox.ensureSessionsDir();
    
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const containerName = `gitkata-${sessionId}`;
    
    const containerId = await sandbox.createContainer(sessionId, userId);
    
    const setup = JSON.parse(exercise.initialSetup);
    await sandbox.initializeExercise(containerName, setup);
    
    const session = sessionManager.createSession(userId, exerciseId, containerId);
    
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    
    return NextResponse.json({
      sessionId: session.id,
      containerName,
      expiresAt,
      exercise: {
        id: exercise.id,
        title: exercise.title,
        description: exercise.description,
        timeLimit: exercise.timeLimit,
      },
    });
  } catch (error) {
    console.error('Error creating sandbox:', error);
    return NextResponse.json(
      { error: 'Failed to create sandbox' },
      { status: 500 }
    );
  }
}
```

```typescript
// app/api/sandbox/exec/route.ts

import { NextResponse } from 'next/server';
import { sandbox } from '@/lib/sandbox';
import { sessionManager } from '@/lib/session-manager';

export async function POST(request: Request) {
  try {
    const { sessionId, command } = await request.json();
    
    if (!sessionId || !command) {
      return NextResponse.json(
        { error: 'sessionId and command are required' },
        { status: 400 }
      );
    }
    
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    
    sessionManager.updateActivity(sessionId);
    
    // Validate command - must start with 'git'
    const trimmedCommand = command.trim();
    if (!trimmedCommand.startsWith('git ')) {
      return NextResponse.json({
        output: 'Error: Only git commands are allowed. Commands must start with "git"',
        exitCode: 1,
      });
    }
    
    // Basic command injection prevention
    const dangerousPatterns = [
      /&&/,
      /\|\|/,
      /;/,
      /\$/,
      /`/,
      /\$\(/,
      /\$\(/,
    ];
    
    if (dangerousPatterns.some((p) => p.test(trimmedCommand))) {
      return NextResponse.json({
        output: 'Error: Invalid characters in command',
        exitCode: 1,
      });
    }
    
    const containerName = `gitkata-${sessionId}`;
    const result = await sandbox.execInContainer(containerName, trimmedCommand);
    
    sessionManager.addCommand(sessionId, trimmedCommand, result.stdout + result.stderr);
    
    return NextResponse.json({
      output: result.stdout || result.stderr,
      exitCode: result.exitCode,
    });
  } catch (error) {
    console.error('Error executing command:', error);
    return NextResponse.json(
      { error: 'Failed to execute command' },
      { status: 500 }
    );
  }
}
```

```typescript
// app/api/sandbox/[sessionId]/route.ts

import { NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-manager';
import { sandbox } from '@/lib/sandbox';

export async function DELETE(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    const session = sessionManager.getSession(sessionId);
    
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    
    await sandbox.destroyContainer(`gitkata-${sessionId}`);
    await sandbox.cleanupSessionDir(sessionId, session.userId);
    sessionManager.destroySession(sessionId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error destroying session:', error);
    return NextResponse.json(
      { error: 'Failed to destroy session' },
      { status: 500 }
    );
  }
}
```

---

### Phase 4: LLM Evaluation (Priority: High)

**Duration:** ~2 hours

#### Tasks

| ID | Task | Files | Status |
|----|------|-------|--------|
| L-01 | Create MiniMax integration | `lib/minimax.ts` | Pending |
| L-02 | Create attempt API route | `app/api/attempt/route.ts` | Pending |

#### Detailed Implementation

**L-01: MiniMax Integration**
```typescript
// lib/minimax.ts

interface EvaluationResult {
  passed: boolean;
  score: number;
  feedback: string;
}

interface EvaluationContext {
  exerciseTitle: string;
  exerciseDescription: string;
  userCommands: string[];
  verificationOutput: string;  // Output from verify.sh
}

async function evaluateAttempt(context: EvaluationContext): Promise<EvaluationResult> {
  const prompt = buildPrompt(context);
  
  const response = await fetch(process.env.MINIMAX_BASE_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.MINIMAX_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'MiniMax-M2.5-highspeed',
      max_tokens: 1024,
      system: `You are a Git instructor evaluating a student's solution.
Provide constructive, encouraging feedback.
Be strict but fair in your evaluation.
Always respond with valid JSON in this exact format:
{"passed": boolean, "score": number, "feedback": "string"}

Score guidelines:
- 90-100: Perfect solution with good practices
- 70-89: Correct solution but could be improved
- 50-69: Partially correct, missing key steps
- 0-49: Incorrect or incomplete solution`,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });
  
  if (!response.ok) {
    throw new Error(`MiniMax API error: ${response.status}`);
  }
  
  const data = await response.json();
  const content = data.content?.[0]?.text || '';
  
  // Parse JSON from response
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Failed to parse LLM response:', content);
  }
  
  // Fallback
  return {
    passed: false,
    score: 0,
    feedback: 'Failed to evaluate submission. Please try again.',
  };
}

function buildPrompt(context: EvaluationContext): string {
  return `Evaluate this Git exercise submission:

## Exercise: ${context.exerciseTitle}

### Description:
${context.exerciseDescription}

### Student's Commands:
${context.userCommands.map((c, i) => `${i + 1}. ${c}`).join('\n')}

### Verification Script Output:
This is the output from running the exercise's verification script, which checks
if the student completed the exercise correctly. Read this natural language output
and evaluate whether the student passed or failed.

${context.verificationOutput}

### Evaluation Instructions:
1. Read the verification script output carefully
2. Determine if the student achieved the exercise goal based on the verification results
3. Consider the Student's Commands to understand their approach
4. Provide specific, actionable feedback
5. Assign a score from 0-100 based on how well they completed the exercise

Respond with JSON only: {"passed": boolean, "score": number, "feedback": "string"}`;
}

export const minimax = {
  evaluateAttempt,
};
```

**L-02: Attempt API Route**
```typescript
// app/api/attempt/route.ts

import { NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-manager';
import { sandbox } from '@/lib/sandbox';
import { minimax } from '@/lib/minimax';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { sessionId, exerciseId, userId, duration } = await request.json();
    
    if (!sessionId || !exerciseId || !userId) {
      return NextResponse.json(
        { error: 'sessionId, exerciseId, and userId are required' },
        { status: 400 }
      );
    }
    
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    
    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
    });
    
    if (!exercise) {
      return NextResponse.json({ error: 'Exercise not found' }, { status: 404 });
    }
    
    // Get user commands
    const commands = session.commands.map((c) => c.command);
    
    // Run verify.sh to validate the solution
    const containerName = `gitkata-${sessionId}`;
    const sessionDir = `/sessions/${userId}/${sessionId}`;
    const solutionPath = await sandbox.getSolutionRepo(exercise.path);
    const verifyScriptPath = `${solutionPath}/../verify.sh`;
    
    let verificationOutput = '';
    try {
      // Run verify.sh with user workspace and solution paths
      const verifyResult = await sandbox.execInContainer(
        containerName,
        `bash /exercises/solutions/${exercise.path}/verify.sh /workspace /workspace`
      );
      verificationOutput = verifyResult.stdout + verifyResult.stderr;
    } catch (e) {
      verificationOutput = 'Error running verification script: ' + String(e);
    }
    
    // Evaluate with LLM using verification output
    const evaluation = await minimax.evaluateAttempt({
      exerciseTitle: exercise.title,
      exerciseDescription: exercise.description,
      userCommands: commands,
      verificationOutput,
    });
    
    // Save attempt
    await prisma.attempt.create({
      data: {
        userId,
        exerciseId,
        commands: JSON.stringify(commands),
        output: JSON.stringify(session.commands),
        passed: evaluation.passed,
        score: evaluation.score,
        feedback: evaluation.feedback,
        duration,
      },
    });
    
    // Update score if this is a new best
    if (evaluation.passed) {
      await prisma.score.upsert({
        where: {
          userId_exerciseId: {
            userId,
            exerciseId,
          },
        },
        create: {
          userId,
          exerciseId,
          bestScore: evaluation.score,
          completions: 1,
          bestTime: duration,
        },
        update: {
          bestScore: Math.max(
            (await prisma.score.findUnique({
              where: {
                userId_exerciseId: { userId, exerciseId },
              },
            }))?.bestScore || 0,
            evaluation.score
          ),
          completions: { increment: 1 },
          bestTime: duration,
        },
      });
    }
    
    return NextResponse.json({
      ...evaluation,
      verificationOutput,
    });
  } catch (error) {
    console.error('Error processing attempt:', error);
    return NextResponse.json(
      { error: 'Failed to process attempt' },
      { status: 500 }
    );
  }
}
```

---

### Phase 5: Frontend Implementation (Priority: High)

**Duration:** ~4 hours

#### Tasks

| ID | Task | Files | Status |
|----|------|-------|--------|
| F-01 | Create Landing page | `app/page.tsx` | Pending |
| F-02 | Create Navbar component | `app/components/Navbar.tsx` | Pending |
| F-03 | Create Terminal component | `app/components/Terminal.tsx` | Pending |
| F-04 | Create ExercisePanel component | `app/components/ExercisePanel.tsx` | Pending |
| F-05 | Create FeedbackModal component | `app/components/FeedbackModal.tsx` | Pending |
| F-06 | Create Challenge page | `app/challenge/[id]/page.tsx` | Pending |
| F-07 | Create Profile page | `app/profile/page.tsx` | Pending |
| F-08 | Create Leaderboard page | `app/leaderboard/page.tsx` | Pending |
| F-09 | Create exercise list API | `app/api/exercises/route.ts` | Pending |
| F-10 | Create profile API | `app/api/profile/route.ts` | Pending |
| F-11 | Create leaderboard API | `app/api/leaderboard/route.ts` | Pending |

---

### Phase 6: Exercise Content (Priority: Medium)

**Duration:** ~2 hours

#### Tasks

| ID | Task | Files | Status |
|----|------|-------|--------|
| E-01 | Create exercise scanner script | `scripts/scan-exercises.ts` | Pending |
| E-02 | Create exercise loader utility | `lib/exercise-loader.ts` | Pending |
| E-03 | Create sample Level 1 exercises (10) | `exercises/problems/` | Pending |
| E-04 | Create sample Level 2 exercises (10) | `exercises/problems/` | Pending |
| E-05 | Create sample Level 3 exercises (10) | `exercises/problems/` | Pending |
| E-06 | Create sample Level 4 exercises (10) | `exercises/problems/` | Pending |
| E-07 | Create sample solutions with verify.sh | `exercises/solutions/` | Pending |

#### Exercise Examples

**Level 1 - Beginner:**

Example directory structure for `exercises/problems/init-basic-01/`:

```
init-basic-01/
├── content/
│   └── (empty directory - user will init here)
└── spec.yaml
```

spec.yaml:
```yaml
name: init-basic-01
title: Create Your First Repository
level: 1
category: init
timeLimit: 300
description: |
  Initialize a new Git repository in the current directory.
  
  Use `git init` to create a new repository.
initialBranch: null
```

Corresponding solution structure `exercises/solutions/init-basic-01/`:

```
init-basic-01/
├── content/
│   └── .git/
└── verify.sh     # Validates git init was run correctly
```

verify.sh example for init-basic-01:
```bash
#!/bin/bash
USER_DIR="$1"
SOLUTION_DIR="$2"

echo "VERIFICATION_START"
echo ""

echo "Checking .git directory exists..."
if [ -d "$USER_DIR/.git" ]; then
  echo "PASS: .git directory was created"
else
  echo "FAIL: .git directory not found - did you run git init?"
fi

echo ""
echo "Checking git config works..."
if git -C "$USER_DIR" config user.email >/dev/null 2>&1; then
  echo "PASS: git repository is properly initialized"
else
  echo "FAIL: git repository is not functional"
fi

echo ""
echo "VERIFICATION_END"
```

Example for `exercises/problems/stage-file-01/`:

```
stage-file-01/
├── content/
│   ├── .git/
│   │   └── (initialized repo)
│   └── README.md
└── spec.yaml
```

spec.yaml:
```yaml
name: stage-file-01
title: Stage a File
level: 1
category: stage
timeLimit: 300
description: |
  Stage the file "hello.txt" for commit.
  
  First create the file with any content, then add it to the staging area.
initialBranch: main
```

Corresponding solution structure `exercises/solutions/stage-file-01/`:

```
stage-file-01/
├── content/
│   └── .git/
└── verify.sh
```

verify.sh example for stage-file-01:
```bash
#!/bin/bash
USER_DIR="$1"
SOLUTION_DIR="$2"

echo "VERIFICATION_START"
echo ""

echo "Checking hello.txt exists..."
if [ -f "$USER_DIR/hello.txt" ]; then
  echo "PASS: hello.txt exists"
else
  echo "FAIL: hello.txt not found"
fi

echo ""
echo "Checking hello.txt is staged..."
if git -C "$USER_DIR" diff --cached --quiet; then
  if git -C "$USER_DIR" diff --cached hello.txt | grep -q .; then
    echo "PASS: hello.txt is staged for commit"
  else
    echo "FAIL: hello.txt is not staged"
  fi
else
  echo "FAIL: staging area is empty"
fi

echo ""
echo "VERIFICATION_END"
```

**Level 2 - Intermediate:**

Example for `exercises/problems/merge-basic-01/`:

```
merge-basic-01/
├── content/
│   ├── .git/
│   │   └── (repo with main and feature branches)
│   └── feature.txt
└── spec.yaml
```

spec.yaml:
```yaml
name: merge-basic-01
title: Merge a Feature Branch
level: 2
category: merge
timeLimit: 600
description: |
  You have a 'feature' branch with 2 new commits.
  Merge it into 'main' branch.
  
  Hint: Switch to main first, then merge.
initialBranch: feature
```

Corresponding solution structure `exercises/solutions/merge-basic-01/`:

```
merge-basic-01/
├── content/
│   ├── .git/
│   └── feature.txt
└── verify.sh
```

verify.sh example for merge-basic-01:
```bash
#!/bin/bash
USER_DIR="$1"
SOLUTION_DIR="$2"

echo "VERIFICATION_START"
echo ""

echo "Checking main branch contains all commits from feature..."
USER_FEATURE_COMMITS=$(git -C "$USER_DIR" log --oneline main ^feature 2>/dev/null | wc -l)
if [ "$USER_FEATURE_COMMITS" -eq 0 ]; then
  echo "PASS: main branch contains all commits from feature"
else
  echo "FAIL: main branch is missing commits from feature branch"
fi

echo ""
echo "Checking feature branch still exists..."
if git -C "$USER_DIR" rev-parse --verify feature >/dev/null 2>&1; then
  echo "PASS: feature branch still exists"
else
  echo "FAIL: feature branch was deleted"
fi

echo ""
echo "Checking for uncommitted changes..."
if [ -z "$(git -C "$USER_DIR" status --porcelain)" ]; then
  echo "PASS: no uncommitted files"
else
  echo "FAIL: there are uncommitted changes"
fi

echo ""
echo "VERIFICATION_END"
```

---

### Phase 7: Testing & Polish (Priority: Medium)

**Duration:** ~2 hours

#### Tasks

| ID | Task | Status |
|----|------|--------|
| T-01 | Test Docker build process | Pending |
| T-02 | Test sandbox container lifecycle | Pending |
| T-03 | Test command execution | Pending |
| T-04 | Test LLM evaluation | Pending |
| T-05 | Test session timeout cleanup | Pending |
| T-06 | Mobile responsive testing | Pending |
| T-07 | Error handling review | Pending |
| T-08 | Performance testing | Pending |

---

## 3. Environment Variables

```bash
# .env.example

# Database
DB_USER=gitkata
DB_PASSWORD=your_secure_password
DB_URL=postgresql://gitkata:your_secure_password@db:5432/gitkata

# MiniMax API
MINIMAX_API_KEY=your_minimax_api_key
MINIMAX_BASE_URL=https://api.minimax.io/anthropic/v1/messages

# Sandbox
SANDBOX_IMAGE=gitkata-sandbox:latest
EXERCISES_PATH=/exercises
```

---

## 4. Build & Run Instructions

### Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma db push

# Scan exercises directory and index in database
npm run scan-exercises

# Start development server
npm run dev
```

### Creating New Exercises

```bash
# Create a new exercise directory
mkdir -p exercises/problems/my-exercise/content

# Initialize a git repo with the starting state
cd exercises/problems/my-exercise/content
git init
# Make commits, create branches, etc.
cd ../../../..

# Create spec.yaml
cat > exercises/problems/my-exercise/spec.yaml << EOF
name: my-exercise
title: My Exercise
level: 1
category: commit
timeLimit: 300
description: |
  Description of the exercise.
initialBranch: main
EOF

# Create solution with verify.sh
mkdir -p exercises/solutions/my-exercise/content

# Copy the solved version to solution content
cp -r exercises/problems/my-exercise/content exercises/solutions/my-exercise/

# Create verify.sh
cat > exercises/solutions/my-exercise/verify.sh << 'EOF'
#!/bin/bash
USER_DIR="$1"
SOLUTION_DIR="$2"

echo "VERIFICATION_START"
echo ""

# Add your verification checks here
# Each check should output "PASS: ..." or "FAIL: ..." in natural language
# The LLM will read this output and make the final decision

echo "Checking your solution..."
# Example: verify some git state
# if git -C "$USER_DIR" log --oneline | grep -q "expected-commit"; then
#   echo "PASS: commit found"
# else
#   echo "FAIL: commit not found"
# fi

echo ""
echo "VERIFICATION_END"
EOF

chmod +x exercises/solutions/my-exercise/verify.sh

# Re-scan to index the new exercise
npm run scan-exercises
```

### Production (Docker)

```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f app

# Stop
docker-compose down
```

---

## 5. Timeline Summary

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| 1. Foundation | 3 hours | None |
| 2. Docker Infrastructure | 2 hours | Phase 1 |
| 3. Sandbox System | 3 hours | Phase 2 |
| 4. LLM Evaluation | 2 hours | Phase 3 |
| 5. Frontend | 4 hours | Phase 4 |
| 6. Exercise Content | 2 hours | Phase 1 |
| 7. Testing & Polish | 2 hours | All phases |
| **Total** | **~18 hours** | |

---

## 6. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Docker socket security | Run app container with limited privileges, validate all inputs |
| LLM API rate limits | Implement request queuing, cache common evaluations |
| Session memory leaks | Strict cleanup intervals, force-kill containers |
| Container escape attempts | Network isolation, read-only root filesystem, non-root user |
| Exercise repo corruption | Source repos mounted read-only, fresh copy per session |

---

## 7. Success Criteria

- [ ] User can complete an exercise from start to finish
- [ ] Git commands execute correctly in sandbox
- [ ] LLM provides meaningful feedback
- [ ] Progress is persisted across sessions
- [ ] Leaderboard shows correct rankings
- [ ] All containers start and communicate properly
- [ ] Session cleanup works after 15 min inactivity
- [ ] UI renders correctly in Matrix theme
- [ ] Exercises load from filesystem correctly
- [ ] Exercise scanner indexes all available exercises
