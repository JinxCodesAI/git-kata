// lib/session-manager.ts

import { sandbox } from './sandbox';
import { containerPool } from './container-pool';
import { logger } from './logger';

interface Session {
  id: string;
  userId: string;
  exerciseId: string;
  containerName: string;
  createdAt: Date;
  lastActivity: Date;
  commands: { command: string; output: string; timestamp: Date }[];
}

const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const sessions = new Map<string, Session>();
const cleanupInterval = setInterval(cleanupSessions, 60 * 1000);

function createSession(userId: string, exerciseId: string, containerName: string, sessionId: string): Session {
  const session: Session = {
    id: sessionId,
    userId,
    exerciseId,
    containerName,
    createdAt: new Date(),
    lastActivity: new Date(),
    commands: [],
  };
  sessions.set(session.id, session);
  logger.info('Created session:', sessionId, 'for user:', userId, 'exercise:', exerciseId);
  return session;
}

function getSession(sessionId: string): Session | undefined {
  return sessions.get(sessionId);
}

function getSessionByUserId(userId: string, exerciseId?: string): Session | undefined {
  for (const session of sessions.values()) {
    if (session.userId === userId) {
      if (exerciseId === undefined || session.exerciseId === exerciseId) {
        return session;
      }
    }
  }
  return undefined;
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
    await containerPool.release(sessionId);
    sessions.delete(sessionId);
    logger.info('Destroyed session:', sessionId);
  }
}

async function destroySessionByUserId(userId: string): Promise<void> {
  const session = getSessionByUserId(userId);
  if (session) {
    await destroySession(session.id);
  }
}

async function clearAllSessions(): Promise<void> {
  sessions.clear();
}

async function cleanupSessions(): Promise<void> {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.lastActivity.getTime() > SESSION_TIMEOUT_MS) {
      logger.info('Timeout cleanup removing session:', id, 'for user:', session.userId);
      await destroySession(id);
    }
  }
}

export const sessionManager = {
  createSession,
  getSession,
  getSessionByUserId,
  updateActivity,
  addCommand,
  destroySession,
  destroySessionByUserId,
  cleanupSessions,
  clearAllSessions,
};
