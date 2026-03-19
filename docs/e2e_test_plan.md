# E2E Test Plan: Exercise API Integration Tests

## Overview

This document describes the end-to-end (E2E) integration test strategy for Git Kata, specifically focusing on testing the Exercise API endpoints with a real database.

## Problem Statement

The current `GET /api/exercises/[id]` endpoint fails because it attempts to select a `description` field from the database:

```
PrismaClientValidationError: Unknown field `description` for select statement on model `Exercise`
```

According to the functional specification, `description` is stored in `spec.yaml` files on the filesystem, not in the database. The database only stores metadata (id, level, category, title, path, timeLimit).

## Test Strategy

### Key Insight: Isolated Test Database Volume

We use Docker volumes to create an isolated PostgreSQL database for testing:

1. **Production DB**: Uses volume `pgdata` (defined in docker-compose.yaml)
2. **Test DB**: Uses volume `gitkata_test_pgdata` (separate, dedicated for tests)

This ensures:
- Tests don't interfere with development data
- Tests can freely create/destroy data without consequences
- Cleanup is as simple as deleting the volume

### Test Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Docker Compose                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │   app       │  │    db      │  │  sandbox-base   │   │
│  │  (Next.js)  │  │ (Postgres) │  │   (Alpine+Git)  │   │
│  └──────┬──────┘  └──────┬─────┘  └─────────────────┘   │
│         │                 │                               │
│         │          ┌──────┴──────┐                        │
│         │          │  pgdata     │ (production volume)    │
│         │          └─────────────┘                        │
└─────────┼──────────────────┼──────────────────────────────┘
          │                  │
          │         ┌────────┴────────┐
          │         │gitkata_test_pgdata│ (test volume)
          │         └─────────────────┘
          │
          ▼
┌─────────────────────────────────┐
│        E2E Test Runner          │
│  - Jest                         │
│  - Runs inside app container    │
│  - Uses separate TEST_DB_VOLUME │
│  - Cleans up after itself       │
└─────────────────────────────────┘
```

## Test Implementation

### File: `tests/exercises-api.e2e.test.ts`

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Exercise API E2E Tests', () => {
  const TEST_VOLUME = 'gitkata_test_pgdata';
  const TEST_DB_NAME = 'gitkata_test';
  const TEST_DB_USER = 'gitkata';
  const TEST_DB_PASSWORD = 'testpass';
  const TEST_DB_URL = `postgresql://${TEST_DB_USER}:${TEST_DB_PASSWORD}@db:5432/${TEST_DB_NAME}`;

  // Unique test exercise ID
  const TEST_EXERCISE_ID = 'e2e-test-exercise-001';

  beforeAll(async () => {
    // 1. Create isolated test volume
    console.log('Creating test volume...');
    await execAsync(`docker volume create ${TEST_VOLUME}`, { cwd: '/home/adam/projects/git-kata' });

    // 2. Start temporary postgres container with test volume
    console.log('Starting temporary postgres for setup...');
    await execAsync(`
      docker run -d \
        --name gitkata_test_setup \
        -e POSTGRES_USER=${TEST_DB_USER} \
        -e POSTGRES_PASSWORD=${TEST_DB_PASSWORD} \
        -e POSTGRES_DB=${TEST_DB_NAME} \
        -v ${TEST_VOLUME}:/var/lib/postgresql/data \
        postgres:15-alpine
    `, { cwd: '/home/adam/projects/git-kata' });

    // 3. Wait for postgres to be ready
    console.log('Waiting for postgres to be ready...');
    let retries = 30;
    while (retries > 0) {
      try {
        await execAsync(`docker exec gitkata_test_setup pg_isready -U ${TEST_DB_USER}`);
        break;
      } catch {
        await new Promise(r => setTimeout(r, 1000));
        retries--;
      }
    }

    // 4. Run prisma db push on test database
    console.log('Running prisma db push...');
    await execAsync(`docker exec gitkata_test_setup psql -U ${TEST_DB_USER} -d ${TEST_DB_NAME} -c "CREATE DATABASE ${TEST_DB_NAME};"`, { cwd: '/home/adam/projects/git-kata' }).catch(() => {
      // Database might already exist, ignore error
    });

    // 5. Set DATABASE_URL and run prisma db push
    const dbPushResult = await execAsync(`
      docker exec -e DATABASE_URL=${TEST_DB_URL} gitkata_test_setup sh -c "npx prisma db push --skip-generate"
    `, { cwd: '/home/adam/projects/git-kata' });
    console.log('Prisma db push output:', dbPushResult.stdout);

    // 6. Seed test exercise into the database
    console.log('Seeding test exercise...');
    const seedResult = await execAsync(`
      docker exec -e DATABASE_URL=${TEST_DB_URL} gitkata_test_setup psql -U ${TEST_DB_USER} -d ${TEST_DB_NAME} -c "
        INSERT INTO \"Exercise\" (id, \"level\", \"category\", \"title\", \"path\", \"timeLimit\", \"order\")
        VALUES ('${TEST_EXERCISE_ID}', 1, 'init', 'Init Basic 01', 'init-basic-01', 300, 1)
        ON CONFLICT (id) DO NOTHING;
      "
    `, { cwd: '/home/adam/projects/git-kata' });
    console.log('Seed output:', seedResult.stdout);

    // 7. Stop the setup container (volume persists)
    console.log('Stopping setup container...');
    await execAsync(`docker stop gitkata_test_setup`);
    await execAsync(`docker rm gitkata_test_setup`);

    // 8. Start app container connected to test volume
    console.log('Starting app container with test database...');
    await execAsync(`
      docker run -d \
        --name gitkata_test_app \
        --network gitkata_default \
        -e DATABASE_URL=${TEST_DB_URL} \
        -e MINIMAX_API_KEY=test-key \
        -v ${TEST_VOLUME}:/var/lib/postgresql/data \
        -p 13000:3000 \
        gitkata:dev
    `, { cwd: '/home/adam/projects/git-kata' });

    // Wait for app to be ready
    console.log('Waiting for app to be ready...');
    retries = 60;
    while (retries > 0) {
      try {
        const response = await fetch('http://localhost:13000/api/exercises');
        if (response.ok) break;
      } catch {}
      await new Promise(r => setTimeout(r, 1000));
      retries--;
    }

    console.log('Test environment ready!');
  }, 120000); // 2 minute timeout

  afterAll(async () => {
    console.log('Cleaning up test environment...');

    // Stop and remove test containers
    await execAsync('docker stop gitkata_test_app gitkata_test_setup 2>/dev/null || true', { cwd: '/home/adam/projects/git-kata' });
    await execAsync('docker rm gitkata_test_app gitkata_test_setup 2>/dev/null || true', { cwd: '/home/adam/projects/git-kata' });

    // Remove test volume
    await execAsync(`docker volume rm ${TEST_VOLUME} 2>/dev/null || true`, { cwd: '/home/adam/projects/git-kata' });

    console.log('Cleanup complete!');
  }, 60000);

  describe('GET /api/exercises/:id', () => {
    it('should return exercise with description from spec.yaml (NOT from database)', async () => {
      // This test will FAIL with current implementation because
      // the code tries to select 'description' from database,
      // but 'description' only exists in spec.yaml files

      const response = await fetch(`http://localhost:13000/api/exercises/${TEST_EXERCISE_ID}`);
      
      expect(response.status).toBe(200);

      const exercise = await response.json();

      // These fields should come from database
      expect(exercise.id).toBe(TEST_EXERCISE_ID);
      expect(exercise.level).toBe(1);
      expect(exercise.category).toBe('init');
      expect(exercise.title).toBe('Init Basic 01');
      expect(exercise.timeLimit).toBe(300);

      // This field should come from spec.yaml, NOT from database
      // The database has no 'description' column, so this will fail
      // until we fix the API to load description from spec.yaml
      expect(exercise.description).toBeDefined();
      expect(typeof exercise.description).toBe('string');
      expect(exercise.description.length).toBeGreaterThan(0);
      
      // Verify it's the actual description from spec.yaml
      expect(exercise.description).toContain('Initialize');
    }, 30000);

    it('should return 404 for non-existent exercise', async () => {
      const response = await fetch('http://localhost:13000/api/exercises/non-existent-id');
      expect(response.status).toBe(404);
    });
  });
});
```

## Running the Tests

### Run All E2E Tests
```bash
docker compose run --rm app npm run test -- --testPathPattern=e2e
```

### Run Only Exercise API E2E Tests
```bash
docker compose run --rm app npm run test -- --testPathPattern=exercises-api.e2e
```

## Expected Behavior

### Before Fix (Current State)
The test will **FAIL** with:
```
PrismaClientValidationError: Unknown field `description` for select statement on model `Exercise`
```

This is the expected failure that validates the bug exists.

### After Fix
The test should **PASS**, demonstrating that:
1. The API correctly returns exercise data
2. `description` is loaded from `spec.yaml` files on the filesystem
3. Database fields (id, level, category, title, timeLimit) come from PostgreSQL

## Cleanup Strategy

The `afterAll` hook ensures complete cleanup:

1. **Stops containers**: `docker stop gitkata_test_app`
2. **Removes containers**: `docker rm gitkata_test_app`
3. **Deletes volume**: `docker volume rm gitkata_test_pgdata`

This leaves no trace in the system after tests complete.

## Alternative Approaches Considered

### 1. Reuse Production Database
**Rejected** - Risk of data corruption, tests could interfere with each other.

### 2. Use SQLite for Tests
**Rejected** - Production uses PostgreSQL; SQLite has different behavior (text types, etc.)

### 3. Mock Database Layer
**Rejected** - We want to test the full stack, including Prisma query generation and PostgreSQL behavior.

### 4. Transaction Rollback Per Test
**Rejected** - More complex setup, PostgreSQL transaction semantics differ from other DBs.

## Key Principles

1. **Isolation**: Each test run uses fresh database volume
2. **Cleanup**: Always clean up, even on failure
3. **Real Stack**: Test against real PostgreSQL, not mocks
4. **Fail First**: Write test that fails, then fix code to make it pass
5. **Documentation**: Clear comments explain why each step is needed
