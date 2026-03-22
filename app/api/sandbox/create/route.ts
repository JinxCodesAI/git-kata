// app/api/sandbox/create/route.ts

import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { sandbox } from '@/lib/sandbox';
import { sessionManager } from '@/lib/session-manager';
import { containerPool } from '@/lib/container-pool';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import prisma from '@/lib/prisma';
import { validateUserId } from '@/lib/validators';
import { logger } from '@/lib/logger';

const MAX_ACTIVE_SESSIONS = parseInt(process.env.MAX_ACTIVE_SESSIONS || '20');

export async function POST(request: Request) {
  try {
    const { exerciseId, userId } = await request.json();

    if (!exerciseId || !userId) {
      return NextResponse.json(
        { error: 'exerciseId and userId are required' },
        { status: 400 }
      );
    }

    if (!validateUserId(userId)) {
      return NextResponse.json(
        { error: 'Invalid userId format' },
        { status: 400 }
      );
    }

    // Check rate limit
    const { allowed, retryAfterMs } = checkRateLimit(`create:${userId}`, RATE_LIMITS.sandboxCreate.maxRequests, RATE_LIMITS.sandboxCreate.windowMs);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      );
    }

    // Check capacity
    if (containerPool.getActiveCount() >= MAX_ACTIVE_SESSIONS) {
      return NextResponse.json(
        { error: 'Server at capacity, please try again shortly' },
        { status: 503 }
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
      logger.info('Reusing existing session:', existingSession.id, 'for user:', userId, 'exercise:', exerciseId);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      return NextResponse.json({
        sessionId: existingSession.id,
        containerName: existingSession.containerName,
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
      logger.info('Destroying old session:', oldSession.id, 'for user:', userId, '(switching exercises)');
      await sessionManager.destroySession(oldSession.id);
    }

    await sandbox.ensureSessionsDir();

    const sessionId = `session-${randomUUID()}`;

    // Acquire a container from the pool
    const poolContainer = await containerPool.acquire(sessionId);

    // Copy exercise content to container's pool directory
    await sandbox.copyExerciseToSession(exercise.path, poolContainer.name, sessionId);

    const session = sessionManager.createSession(userId, exerciseId, poolContainer.name, sessionId);

    logger.info('Created new session:', sessionId, 'for user:', userId, 'exercise:', exerciseId);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    return NextResponse.json({
      sessionId: session.id,
      containerName: poolContainer.name,
      expiresAt,
      exercise: {
        id: exercise.id,
        title: exercise.title,
        timeLimit: exercise.timeLimit,
      },
    });
  } catch (error) {
    logger.error('Error creating sandbox:', error);
    return NextResponse.json(
      { error: 'Failed to create sandbox' },
      { status: 500 }
    );
  }
}
