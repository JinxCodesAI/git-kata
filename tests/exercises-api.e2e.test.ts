/**
 * Exercises API E2E Test
 * 
 * PURPOSE:
 * This test demonstrates the bug where /api/exercises/[id] tries to select
 * the `description` field from the database, but the Exercise model does NOT
 * have a description field in the schema.
 * 
 * BUG LOCATION:
 * File: app/api/exercises/[id]/route.ts
 * Line: 27 - the select statement includes 'description: true'
 * 
 * EXPECTED BEHAVIOR (per functional spec section 6.2):
 * Description should be loaded from spec.yaml files, NOT from the database.
 * The Exercise model in prisma/schema.prisma does not have a description field.
 * 
 * ACTUAL BEHAVIOR:
 * When calling GET /api/exercises/{id}, Prisma throws an error because it
 * tries to select a field that doesn't exist in the schema.
 * 
 * NOTE:
 * This test is SKIPPED because it requires docker-compose.yaml to be mounted
 * or run on host. It cannot run inside the containerized test environment.
 * To run: execute on host machine with full docker access.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// SKIPPED: These tests require host machine access to docker
describe.skip('Exercise API E2E Tests', () => {
  const TEST_DB_NAME = 'gitkata_test';
  const COMPOSE_PROJECT = 'gitkata';

  // Get db connection details from environment
  const TEST_DB_USER = process.env.DB_USER || 'gitkata';
  const TEST_DB_PASSWORD = process.env.DB_PASSWORD || 'testpass';
  const TEST_DB_HOST = 'db'; // docker compose service name
  const TEST_DB_URL = `postgresql://${TEST_DB_USER}:${TEST_DB_PASSWORD}@${TEST_DB_HOST}:5432/${TEST_DB_NAME}`;
  const PROD_DB_URL = `postgresql://${TEST_DB_USER}:${TEST_DB_PASSWORD}@${TEST_DB_HOST}:5432/gitkata`;

  // Unique test exercise ID
  const TEST_EXERCISE_ID = 'e2e-test-exercise-001';

  beforeAll(async () => {
    const workdir = '/home/adam/projects/git-kata';

    // 1. Drop test database if it exists (cleanup from previous failed runs)
    console.log('Dropping test database if exists...');
    await execAsync(
      `docker compose exec -T db psql -U ${TEST_DB_USER} -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB_NAME};"`,
      { cwd: workdir }
    ).catch(() => {
      // Ignore errors - database might not exist
    });

    // 2. Create test database in existing postgres container
    console.log('Creating test database...');
    await execAsync(
      `docker compose exec -T db psql -U ${TEST_DB_USER} -d postgres -c "CREATE DATABASE ${TEST_DB_NAME};"`,
      { cwd: workdir }
    );

    // 3. Run prisma db push on test database using docker compose run
    console.log('Running prisma db push on test database...');
    const dbPushResult = await execAsync(
      `docker compose run --rm -e DATABASE_URL=${TEST_DB_URL} app npx prisma db push --skip-generate`,
      { cwd: workdir }
    );
    console.log('Prisma db push output:', dbPushResult.stdout);

    // 4. Seed test exercise into the database
    console.log('Seeding test exercise...');
    const seedResult = await execAsync(
      `docker compose exec -T db psql -U ${TEST_DB_USER} -d ${TEST_DB_NAME} -c "
        INSERT INTO \"Exercise\" (id, \"level\", \"category\", \"title\", \"path\", \"timeLimit\", \"order\")
        VALUES ('${TEST_EXERCISE_ID}', 1, 'init', 'Init Basic 01', 'init-basic-01', 300, 1)
        ON CONFLICT (id) DO NOTHING;
      "`,
      { cwd: workdir }
    );
    console.log('Seed output:', seedResult.stdout);

    // 5. Start app container with test database using docker compose run
    // Run in detached mode to keep it running for tests
    console.log('Starting app container with test database...');
    await execAsync(
      `docker compose run -d -e DATABASE_URL=${TEST_DB_URL} -p 13000:3000 app`,
      { cwd: workdir }
    );

    // Wait for app to be ready
    console.log('Waiting for app to be ready...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  });

  afterAll(async () => {
    const workdir = '/home/adam/projects/git-kata';
    
    // Cleanup: Stop and remove the test app container
    console.log('Cleaning up test environment...');
    await execAsync(
      `docker compose -f docker-compose.yaml run --rm app true`,
      { cwd: workdir }
    ).catch(() => {
      // Ignore errors - container might already be stopped
    });

    // Drop test database
    try {
      await execAsync(
        `docker compose exec -T db psql -U ${TEST_DB_USER} -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB_NAME};"`,
        { cwd: workdir }
      );
    } catch {
      // Ignore errors
    }
  });

  it('should return exercise with description from spec.yaml (NOT from database)', async () => {
    // This test verifies that GET /api/exercises/:id returns the description
    // from the spec.yaml file, NOT from a database field (since the Exercise
    // model doesn't have a description field)
    const response = await fetch(`http://localhost:13000/api/exercises/${TEST_EXERCISE_ID}`);
    
    // If the bug is fixed, we should get 200 with description from spec.yaml
    // If the bug is not fixed, we get 500 because Prisma can't select 'description'
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.description).toBeDefined();
    expect(typeof data.description).toBe('string');
  });
});
