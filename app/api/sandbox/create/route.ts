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
