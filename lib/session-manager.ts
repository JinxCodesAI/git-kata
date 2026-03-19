// lib/session-manager.ts

import { sandbox } from './sandbox';

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
  const sessionId = generateSessionId();
  const session: Session = {
    id: sessionId,
    userId,
    exerciseId,
    containerId,
    createdAt: new Date(),
    lastActivity: new Date(),
    commands: [],
  };
  sessions.set(session.id, session);
  console.log(`[SESSION] Created session ${sessionId} for user ${userId} exercise ${exerciseId} container ${containerId}`);
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
    await sandbox.destroyContainer(session.containerId);
    sessions.delete(sessionId);
    console.log(`[SESSION] Destroyed session ${sessionId} container ${session.containerId}`);
  }
}

async function destroySessionByUserId(userId: string): Promise<void> {
  const session = getSessionByUserId(userId);
  if (session) {
    await destroySession(session.id);
  }
}

async function cleanupSessions(): Promise<void> {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.lastActivity.getTime() > SESSION_TIMEOUT_MS) {
      console.log(`[SESSION] Timeout cleanup removing session ${id} for user ${session.userId}`);
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
};
