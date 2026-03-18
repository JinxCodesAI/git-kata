# Git Kata - Agent Guidelines

> **Important**: This application is designed to run in Docker only. Do NOT run it locally with `npm run dev`. Always use Docker-based development and production environments as described in the Production (Docker) section below.

> never ask for access to /tmp

> never ask for access to .env unless user explicitly asked you to check it

For detailed system design and requirements, see [Functional Specification](docs/functional_specification.md).

## Project Overview

Git Kata is a web-based application for practicing Git commands through structured exercises (kata). Users receive real-time feedback on their attempts with LLM-powered evaluation. The application uses:

- **Framework**: Next.js 14 with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Sandbox**: Docker containers for isolated Git environments
- **LLM**: MiniMax API for solution evaluation

> **Note**: The `minimax_chat/` directory contains an example application (chat with AI) that uses similar technology (Next.js, Prisma, MiniMax API) but implements a different idea. It can serve as a reference for similar patterns but is not part of Git Kata.

---

## Build/Lint/Test Commands

### Development
```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations (creates/updates tables)
npx prisma db push

# Start development server
npm run dev

# Lint code
npm run lint
```

### Database Operations
```bash
# Generate Prisma client (after schema changes)
npm run db:generate

# Push schema to database
npm run db:push

# Seed database with exercises
npm run db:seed

# Scan exercises directory and index in database
npm run scan-exercises
```

### Production (Docker)
```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Running a Single Test
This project does not have a formal test framework. To test functionality:
1. Start the development server: `npm run dev`
2. Manually test the feature via the browser at `http://localhost:3000`
3. For API testing, use curl/Postman against the running server

---

## Code Style Guidelines

### TypeScript

- **Strict Mode**: Always enabled in `tsconfig.json`
- **Type Annotations**: Use explicit types for function parameters and return values
- **Interfaces over Types**: Prefer `interface` for object shapes
- **No `any`**: Avoid `any` type; use `unknown` when type is truly unknown

```typescript
// Good
interface User {
    id: string;
    name: string;
}

async function getUser(id: string): Promise<User | null> {
    // ...
}

// Avoid
function getUser(id: any): any {
    // ...
}
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `session-manager.ts` |
| Functions | camelCase | `createSession()` |
| Classes | PascalCase | `SessionManager` |
| Interfaces | PascalCase | `ExerciseSetup` |
| Constants | UPPER_SNAKE | `SESSION_TIMEOUT_MS` |
| React Components | PascalCase | `FeedbackModal` |
| CSS Classes | kebab-case | `terminal-container` |

### Import Organization

Order imports within each group:

1. **External packages**: `next`, `react`, `prisma`, `lucide-react`
2. **Internal aliases** (`@/`): `lib/`, `app/`, `components/`
3. **Relative imports**: `./`, `../`

```typescript
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sandbox } from '@/lib/sandbox';
import { sessionManager } from '@/lib/session-manager';
```

### React/Next.js Patterns

- Use **server components** by default; add `'use client'` only when needed
- Use `async/await` in server components and Route Handlers
- Prefer **Route Handlers** (`route.ts`) over API routes in `pages/`
- Use `tsx` extension for files with JSX

```typescript
// app/api/example/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({ data: 'example' });
}
```

### Error Handling

- Always use `try/catch` in async functions
- Return appropriate HTTP status codes:
  - `400` for bad request / validation errors
  - `404` for not found
  - `500` for internal server errors
- Log errors with `console.error()` before returning response

```typescript
export async function POST(request: Request) {
    try {
        const { userId } = await request.json();
        
        if (!userId) {
            return NextResponse.json(
                { error: 'userId is required' },
                { status: 400 }
            );
        }
        
        // ... process request
        
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error processing request:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
```

### Database (Prisma)

- Use the **singleton pattern** for Prisma client to prevent connection exhaustion:

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => new PrismaClient();

declare global {
    var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') {
    globalThis.prismaGlobal = prisma;
}
```

- Always use **transactions** for operations that modify multiple tables
- Validate input data before database queries

### CSS/Styling

- Use **CSS variables** for theming (Matrix theme colors)
- Follow the established CSS class naming pattern (see below)
- Keep styles modular; component-specific styles go with the component concept

### Matrix Theme CSS Variables

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
```

### File Structure

```
git-kata/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # Route Handlers
│   │   ├── exercises/
│   │   ├── sandbox/
│   │   ├── attempt/
│   │   ├── profile/
│   │   └── leaderboard/
│   ├── components/        # React components
│   ├── page.tsx           # Landing page
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── lib/                    # Backend utilities
│   ├── prisma.ts          # Prisma singleton
│   ├── sandbox.ts         # Docker sandbox operations
│   ├── session-manager.ts # Session lifecycle
│   ├── minimax.ts         # LLM integration
│   ├── exercise-loader.ts # Exercise loading utilities
│   └── types.ts           # Shared TypeScript types
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Database seeding
├── exercises/              # Exercise content (git repos)
│   ├── problems/          # Exercise starting states
│   └── solutions/         # Reference solutions + verify.sh
├── sandbox/                # Sandbox Docker image
├── scripts/                # Utility scripts
├── docs/                   # Documentation
└── docker-compose.yaml    # Container orchestration
```

---

## Security Guidelines

### Command Validation
- Git commands in sandbox must start with `git `
- Block dangerous patterns: `&&`, `||`, `;`, `$`, backticks, `$(`, `$\(`
- Commands run in isolated containers with no network access

### Input Validation
- Validate all request JSON with explicit checks
- Use UUID format for user/exercise IDs
- Never trust user input; always sanitize

### Docker Security
- Sandbox containers run with resource limits (256MB RAM, 50% CPU)
- No network access (`--network=none`)
- Non-root user in container
- Session timeout: 15 minutes inactivity

---

## Exercise Creation

### Directory Structure
```
exercises/problems/{exercise-name}/
├── content/           # Git repository with starting state
│   └── (git repo files)
└── spec.yaml         # Exercise metadata

exercises/solutions/{exercise-name}/
├── content/          # Reference solution Git repository
└── verify.sh         # Validation script
```

### spec.yaml Format
```yaml
name: merge-basic-01
title: Merge a Feature Branch
level: 2
category: merge
timeLimit: 600
description: |
  Exercise description in markdown format.
initialBranch: feature
```

### verify.sh Guidelines
- Outputs natural language, NOT structured data
- Use `PASS:` and `FAIL:` prefixes for check results
- LLM interprets the output for final evaluation
- Example:
```bash
#!/bin/bash
echo "Checking branch merge..."
if git -C "$USER_DIR" log --oneline main | grep -q "feature"; then
    echo "PASS: feature branch merged correctly"
else
    echo "FAIL: feature branch not found in main"
fi
```

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# MiniMax API
MINIMAX_API_KEY=your_api_key
MINIMAX_BASE_URL=https://api.minimax.io/anthropic/v1/messages

# Sandbox
SANDBOX_IMAGE=gitkata-sandbox:latest
EXERCISES_PATH=/exercises
```

---

## Common Tasks

### Creating a New Exercise
1. Create problem directory: `mkdir -p exercises/problems/my-exercise/content`
2. Initialize git repo in `content/`: `cd content && git init && git commit`
3. Create `spec.yaml` with metadata
4. Create solution directory with `verify.sh`
5. Run `npm run scan-exercises` to index

### Adding a New API Route
1. Create `app/api/{resource}/route.ts`
2. Implement HTTP methods: `GET`, `POST`, `PUT`, `DELETE`
3. Return `NextResponse.json()` with appropriate status codes
4. Add error handling with try/catch

### Database Changes
1. Update `prisma/schema.prisma`
2. Run `npx prisma db push` to apply changes
3. Run `npx prisma generate` to regenerate client
