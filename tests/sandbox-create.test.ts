/**
 * Tests for sandbox create API - session reuse behavior
 *
 * Tests the following scenarios:
 * 1. Same user + same exercise + no existing session -> creates new session
 * 2. Same user + same exercise + existing session -> returns existing session
 * 3. Same user + different exercise + existing session -> destroys old, creates new
 */

// Mock the sandbox module before anything else
jest.mock('@/lib/sandbox', () => ({
  sandbox: {
    ensureSessionsDir: jest.fn().mockResolvedValue(undefined),
    createContainer: jest.fn().mockResolvedValue('mock-container-id'),
    copyExerciseToSession: jest.fn().mockResolvedValue(undefined),
    destroyContainer: jest.fn().mockResolvedValue(undefined),
    cleanupSessionDir: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  default: {
    exercise: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'exercise-1',
        title: 'Test Exercise 1',
        path: 'test/path1',
        timeLimit: 600,
      }),
    },
  },
}));

import { sessionManager } from '@/lib/session-manager';
import { sandbox } from '@/lib/sandbox';

describe('Session Manager - getSessionByUserId', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await sessionManager.clearAllSessions();
  });

  it('should return undefined when no sessions exist for user', () => {
    const result = sessionManager.getSessionByUserId('nonexistent-user');
    expect(result).toBeUndefined();
  });

  it('should return the session when user has an existing session for that exercise', () => {
    // Create a session first (userId, exerciseId, containerId - sessionId is generated internally)
    sessionManager.createSession('user-1', 'exercise-1', 'container-1', 'session-test-1');

    const result = sessionManager.getSessionByUserId('user-1', 'exercise-1');

    expect(result).toBeDefined();
    expect(result?.userId).toBe('user-1');
    expect(result?.exerciseId).toBe('exercise-1');
  });

  it('should return undefined when user has session but for different exercise', () => {
    // Create a session for user-1 with exercise-1
    sessionManager.createSession('user-1', 'exercise-1', 'container-1', 'session-test-1');

    // Check for user-1 with different exercise
    const result = sessionManager.getSessionByUserId('user-1', 'exercise-999');

    expect(result).toBeUndefined();
  });
});

describe('Session Manager - destroySessionByUserId', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await sessionManager.clearAllSessions();
  });

  it('should destroy session when user has one', async () => {
    // Create a session
    sessionManager.createSession('user-1', 'exercise-1', 'container-1', 'session-test-1');

    // Destroy by userId
    await sessionManager.destroySessionByUserId('user-1');

    // Verify container was destroyed
    expect(sandbox.destroyContainer).toHaveBeenCalledWith('container-1');

    // Verify session is gone
    expect(sessionManager.getSessionByUserId('user-1')).toBeUndefined();
  });

  it('should not error when user has no session', async () => {
    await expect(sessionManager.destroySessionByUserId('nonexistent-user')).resolves.toBeUndefined();
    expect(sandbox.destroyContainer).not.toHaveBeenCalled();
  });
});

describe('Sandbox Create API - Session Reuse Scenarios', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await sessionManager.clearAllSessions();
  });

  describe('Scenario 1: Same user + same exercise + no existing session', () => {
    it('should create a new session when user has no existing sessions', () => {
      // Verify getSessionByUserId returns undefined for non-existent user+exercise
      const existing = sessionManager.getSessionByUserId('new-user', 'exercise-1');
      expect(existing).toBeUndefined();
    });
  });

  describe('Scenario 2: Same user + same exercise + existing session', () => {
    it('should return existing session instead of creating new one', () => {
      // Create existing session
      sessionManager.createSession('user-1', 'exercise-1', 'container-1', 'session-test-1');

      // getSessionByUserId should find it
      const existing = sessionManager.getSessionByUserId('user-1', 'exercise-1');
      expect(existing).toBeDefined();
      expect(existing?.userId).toBe('user-1');
      expect(existing?.exerciseId).toBe('exercise-1');
    });
  });

  describe('Scenario 3: Same user + different exercise + existing session', () => {
    it('should return undefined when checking for different exercise', () => {
      // Create existing session for exercise-1
      sessionManager.createSession('user-1', 'exercise-1', 'container-1', 'session-test-1');

      // Checking for different exercise should return undefined
      const existing = sessionManager.getSessionByUserId('user-1', 'exercise-2');
      expect(existing).toBeUndefined();
    });

    it('should be able to destroy existing session before creating new one', async () => {
      // Create existing session
      sessionManager.createSession('user-1', 'exercise-1', 'container-1', 'session-test-1');

      // Destroy should work
      await sessionManager.destroySessionByUserId('user-1');

      // Verify destroyed
      expect(sandbox.destroyContainer).toHaveBeenCalledWith('container-1');
      expect(sessionManager.getSessionByUserId('user-1', 'exercise-1')).toBeUndefined();
    });
  });
});