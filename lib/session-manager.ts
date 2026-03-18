// lib/session-manager.ts

import { destroyContainer } from './sandbox';

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
