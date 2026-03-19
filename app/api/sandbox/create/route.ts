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
    
    // Ensure user exists in database - create if not
    await prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, name: 'anonymous' },
      update: {},
    });
    
    // Check if user already has a session for this exercise
    const existingSession = sessionManager.getSessionByUserId(userId, exerciseId);
    if (existingSession) {
      // User already has a session for this exercise - return existing session
      console.log(`[SANDBOX] Reusing existing session ${existingSession.id} for user ${userId} exercise ${exerciseId}`);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      return NextResponse.json({
        sessionId: existingSession.id,
        containerName: `gitkata-${existingSession.id}`,
        expiresAt,
        exercise: {
          id: exercise.id,
          title: exercise.title,
          timeLimit: exercise.timeLimit,
        },
      });
    }
    
    // Check if user has a session for a different exercise - destroy it first
    const oldSession = sessionManager.getSessionByUserId(userId);
    if (oldSession) {
      console.log(`[SANDBOX] Destroying old session ${oldSession.id} for user ${userId} (switching exercises)`);
      await sessionManager.destroySession(oldSession.id);
    }
    
    await sandbox.ensureSessionsDir();
    
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const containerName = `gitkata-${sessionId}`;
    
    // Create the container
    const containerId = await sandbox.createContainer(sessionId, userId);
    
    // Copy exercise content to session directory
    const sessionDir = `/app/sessions/${userId}/${sessionId}`;
    await sandbox.copyExerciseToSession(exercise.path, sessionDir);
    
    const session = sessionManager.createSession(userId, exerciseId, containerId, sessionId);
    
    console.log(`[SANDBOX] Created new session ${sessionId} for user ${userId} exercise ${exerciseId}`);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    
    return NextResponse.json({
      sessionId: session.id,
      containerName,
      expiresAt,
      exercise: {
        id: exercise.id,
        title: exercise.title,
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
