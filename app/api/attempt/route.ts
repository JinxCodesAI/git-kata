// app/api/attempt/route.ts

import { NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-manager';
import { sandbox } from '@/lib/sandbox';
import { minimax } from '@/lib/minimax';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { sessionId, exerciseId, userId, duration } = await request.json();
    
    if (!sessionId || !exerciseId || !userId) {
      return NextResponse.json(
        { error: 'sessionId, exerciseId, and userId are required' },
        { status: 400 }
      );
    }
    
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    
    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
    });
    
    if (!exercise) {
      return NextResponse.json({ error: 'Exercise not found' }, { status: 404 });
    }
    
    // Get user commands
    const commands = session.commands.map((c) => c.command);
    
    // Run verify.sh to validate the solution
    const containerName = `gitkata-${sessionId}`;
    const sessionDir = `/sessions/${userId}/${sessionId}`;
    const solutionPath = await sandbox.getSolutionRepo(exercise.path);
    const verifyScriptPath = `${solutionPath}/../verify.sh`;
    
    let verificationOutput = '';
    try {
      // Run verify.sh with user workspace and solution paths
      const verifyResult = await sandbox.execInContainer(
        containerName,
        `bash /exercises/solutions/${exercise.path}/verify.sh /workspace /workspace`
      );
      verificationOutput = verifyResult.stdout + verifyResult.stderr;
    } catch (e) {
      verificationOutput = 'Error running verification script: ' + String(e);
    }
    
    // Evaluate with LLM using verification output
    const evaluation = await minimax.evaluateAttempt({
      exerciseTitle: exercise.title,
      exerciseDescription: exercise.description,
      userCommands: commands,
      verificationOutput,
    });
    
    // Save attempt
    await prisma.attempt.create({
      data: {
        userId,
        exerciseId,
        commands: JSON.stringify(commands),
        output: JSON.stringify(session.commands),
        passed: evaluation.passed,
        score: evaluation.score,
        feedback: evaluation.feedback,
        duration,
      },
    });
    
    // Update score if this is a new best
    if (evaluation.passed) {
      await prisma.score.upsert({
        where: {
          userId_exerciseId: {
            userId,
            exerciseId,
          },
        },
        create: {
          userId,
          exerciseId,
          bestScore: evaluation.score,
          completions: 1,
          bestTime: duration,
        },
        update: {
          bestScore: Math.max(
            (await prisma.score.findUnique({
              where: {
                userId_exerciseId: { userId, exerciseId },
              },
            }))?.bestScore || 0,
            evaluation.score
          ),
          completions: { increment: 1 },
          bestTime: duration,
        },
      });
    }
    
    return NextResponse.json({
      ...evaluation,
      verificationOutput,
    });
  } catch (error) {
    console.error('Error processing attempt:', error);
    return NextResponse.json(
      { error: 'Failed to process attempt' },
      { status: 500 }
    );
  }
}
