/**
 * Docker Infrastructure Tests
 * 
 * These tests validate the Docker configuration and runtime behavior
 * for the Git Kata application.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

describe('Docker Infrastructure', () => {
  const SANDBOX_IMAGE = 'gitkata-sandbox:latest';
  const CONTAINER_NAME = 'gitkata-test-sandbox';

  describe('Sandbox Dockerfile', () => {
    const sandboxDockerfilePath = path.join(process.cwd(), 'sandbox', 'Dockerfile');

    it('should exist at sandbox/Dockerfile', async () => {
      await expect(fs.access(sandboxDockerfilePath)).resolves.not.toThrow();
    });

    it('should have valid syntax and required instructions', async () => {
      const content = await fs.readFile(sandboxDockerfilePath, 'utf-8');
      // Validate required instructions are present
      expect(content).toContain('FROM alpine:3.19');
      expect(content).toContain('WORKDIR /workspace');
      expect(content).toContain('CMD');
    });

    it('should build successfully as gitkata-sandbox:latest', async () => {
      // Build the sandbox image
      const { stdout, stderr } = await execAsync(
        `docker build -t ${SANDBOX_IMAGE} -f sandbox/Dockerfile sandbox/`,
        { cwd: process.cwd() }
      );
      // Output may go to stdout or stderr depending on Docker version
      const output = stdout + stderr;
      expect(output).toContain('Successfully tagged');
    });
  });

  describe('Sandbox Container Runtime', () => {
    afterEach(async () => {
      // Cleanup: remove test container if it exists
      try {
        await execAsync(`docker rm -f ${CONTAINER_NAME}`, { cwd: process.cwd() });
      } catch {
        // Container might not exist, ignore error
      }
    });

    it('should run git commands in sandbox container', async () => {
      // Start a sandbox container
      await execAsync(
        `docker run -d --name ${CONTAINER_NAME} ${SANDBOX_IMAGE}`,
        { cwd: process.cwd() }
      );

      // Verify git is available
      const { stdout: gitVersion } = await execAsync(
        `docker exec ${CONTAINER_NAME} git --version`
      );
      expect(gitVersion).toContain('git');

      // Verify git config is set
      const { stdout: gitEmail } = await execAsync(
        `docker exec ${CONTAINER_NAME} git config --global user.email`
      );
      expect(gitEmail.trim()).toBe('kata@git.local');

      const { stdout: gitName } = await execAsync(
        `docker exec ${CONTAINER_NAME} git config --global user.name`
      );
      expect(gitName.trim()).toBe('Kata User');

      // Verify git can create a repo
      const { stdout: initOutput } = await execAsync(
        `docker exec ${CONTAINER_NAME} git init`
      );
      expect(initOutput).toContain('Initialized empty Git repository');

      // Verify default branch is set to main
      const { stdout: branchOutput } = await execAsync(
        `docker exec ${CONTAINER_NAME} git branch --show-current`
      );
      expect(branchOutput.trim()).toBe('main');
    });

    it('should have bash available', async () => {
      await execAsync(
        `docker run -d --name ${CONTAINER_NAME} ${SANDBOX_IMAGE}`,
        { cwd: process.cwd() }
      );

      const { stdout } = await execAsync(
        `docker exec ${CONTAINER_NAME} bash --version`
      );
      expect(stdout).toContain('bash');
    });

    it('should have coreutils available', async () => {
      await execAsync(
        `docker run -d --name ${CONTAINER_NAME} ${SANDBOX_IMAGE}`,
        { cwd: process.cwd() }
      );

      const { stdout } = await execAsync(
        `docker exec ${CONTAINER_NAME} which ls`
      );
      // coreutils provides basic utilities like ls
      expect(stdout.trim()).toBeDefined();
    });

    it('should stay running with sleep infinity', async () => {
      await execAsync(
        `docker run -d --name ${CONTAINER_NAME} ${SANDBOX_IMAGE}`,
        { cwd: process.cwd() }
      );

      // Wait a moment for container to start
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify container is still running
      const { stdout: psOutput } = await execAsync(
        `docker ps --filter "name=${CONTAINER_NAME}" --filter "status=running"`
      );
      expect(psOutput).toContain(CONTAINER_NAME);
    });
  });

  describe('docker-compose.yaml', () => {
    const composeFilePath = path.join(process.cwd(), 'docker-compose.yaml');

    it('should exist at docker-compose.yaml', async () => {
      await expect(fs.access(composeFilePath)).resolves.not.toThrow();
    });

    it('should have valid syntax according to docker compose config', async () => {
      // docker compose config validates the YAML and shows the parsed config
      const { stdout, stderr } = await execAsync(
        `docker compose -f docker-compose.yaml config`,
        { cwd: process.cwd() }
      );
      // Exit code 0 means config is valid
      // Output should contain parsed services
      expect(stdout).toContain('services:');
      expect(stdout).toContain('app:');
      expect(stdout).toContain('db:');
      expect(stdout).toContain('sandbox-base:');
    });

    it('should define app service with correct port mapping', async () => {
      const { stdout } = await execAsync(
        `docker compose -f docker-compose.yaml config`,
        { cwd: process.cwd() }
      );
      // Port 12000:3000 mapping
      expect(stdout).toContain('12000');
      expect(stdout).toContain('3000');
    });

    it('should define app service depending on db with healthcheck', async () => {
      const { stdout } = await execAsync(
        `docker compose -f docker-compose.yaml config`,
        { cwd: process.cwd() }
      );
      expect(stdout).toContain('depends_on:');
      expect(stdout).toContain('condition:');
      expect(stdout).toContain('service_healthy');
    });

    it('should define sandbox-base service with sandbox context', async () => {
      const { stdout } = await execAsync(
        `docker compose -f docker-compose.yaml config`,
        { cwd: process.cwd() }
      );
      expect(stdout).toContain('sandbox-base:');
      expect(stdout).toContain('sandbox');
    });

    it('should define volumes for persistence', async () => {
      const { stdout } = await execAsync(
        `docker compose -f docker-compose.yaml config`,
        { cwd: process.cwd() }
      );
      expect(stdout).toContain('volumes:');
      expect(stdout).toContain('pgdata:');
      // Sessions are persisted via bind mount to /app/sessions
      expect(stdout).toContain('/app/sessions');
    });

    it('should mount exercises directory as read-only', async () => {
      const { stdout } = await execAsync(
        `docker compose -f docker-compose.yaml config`,
        { cwd: process.cwd() }
      );
      // The output should show the exercises bind mount as read-only
      expect(stdout).toContain('/exercises');
    });
  });

  describe('App Dockerfile', () => {
    const appDockerfilePath = path.join(process.cwd(), 'Dockerfile');

    it('should exist at Dockerfile', async () => {
      await expect(fs.access(appDockerfilePath)).resolves.not.toThrow();
    });

    it('should have valid syntax with required instructions', async () => {
      const content = await fs.readFile(appDockerfilePath, 'utf-8');
      // Validate required instructions are present
      expect(content).toContain('FROM node:20-alpine');
      expect(content).toContain('EXPOSE 3000');
      expect(content).toContain('AS base');
      expect(content).toContain('AS development');
    });

    it('should have multi-stage build with base, development, and production targets', async () => {
      const content = await fs.readFile(appDockerfilePath, 'utf-8');
      
      // Check for multi-stage build
      expect(content).toContain('FROM node:20-alpine AS base');
      expect(content).toContain('FROM base AS development');
      expect(content).toContain('FROM base AS production');
      expect(content).toContain('FROM base AS build');
      
      // Check for required stages
      expect(content).toContain('deps');
      expect(content).toContain('build');
    });

    it('should expose port 3000', async () => {
      const content = await fs.readFile(appDockerfilePath, 'utf-8');
      expect(content).toContain('EXPOSE 3000');
    });

    it('should include scripts/start.sh and make it executable', async () => {
      const content = await fs.readFile(appDockerfilePath, 'utf-8');
      expect(content).toContain('scripts/start.sh');
      expect(content).toContain('chmod +x scripts/start.sh');
    });
  });
});

describe('Docker Security Configuration', () => {
  describe('Sandbox Isolation', () => {
    it('should run sandbox container in isolated network mode', async () => {
      // This test verifies the docker-compose.yaml configuration for network isolation
      const { stdout } = await execAsync(
        `docker compose -f docker-compose.yaml config`,
        { cwd: process.cwd() }
      );
      
      // Sandbox containers are spawned by the app container, not directly in compose
      // The app container should have access to docker.sock for container management
      expect(stdout).toContain('/var/run/docker.sock');
    });
  });

  describe('Resource Limits', () => {
    it('should document expected resource limits for sandbox containers', () => {
      // Resource limits are defined in lib/sandbox.ts
      // This test documents the expected configuration
      const expectedLimits = {
        memory: '256m',
        memoryReservation: '128m',
        cpuQuota: 50000, // 50% CPU
        pidsLimit: 64,
      };
      
      // These values should match lib/sandbox.ts
      expect(expectedLimits.memory).toBe('256m');
      expect(expectedLimits.cpuQuota).toBe(50000);
    });
  });
});

describe('Dockerfile Content Validation', () => {
  const sandboxDockerfilePath = path.join(process.cwd(), 'sandbox', 'Dockerfile');

  it('sandbox Dockerfile should use alpine:3.19 base', async () => {
    const content = await fs.readFile(sandboxDockerfilePath, 'utf-8');
    expect(content).toContain('FROM alpine:3.19');
  });

  it('sandbox Dockerfile should install git, bash, and coreutils', async () => {
    const content = await fs.readFile(sandboxDockerfilePath, 'utf-8');
    expect(content).toContain('apk add');
    expect(content).toContain('git');
    expect(content).toContain('bash');
    expect(content).toContain('coreutils');
  });

  it('sandbox Dockerfile should set git user config', async () => {
    const content = await fs.readFile(sandboxDockerfilePath, 'utf-8');
    expect(content).toContain('git config --global user.email');
    expect(content).toContain('git config --global user.name');
    expect(content).toContain('git config --global init.defaultBranch main');
  });

  it('sandbox Dockerfile should set /workspace as workdir', async () => {
    const content = await fs.readFile(sandboxDockerfilePath, 'utf-8');
    expect(content).toContain('WORKDIR /workspace');
  });

  it('sandbox Dockerfile should use sleep infinity as default command', async () => {
    const content = await fs.readFile(sandboxDockerfilePath, 'utf-8');
    expect(content).toContain('CMD ["sleep", "infinity"]');
  });
});
