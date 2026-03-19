// app/api/attempt/route.ts

import { NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-manager';
import { sandbox } from '@/lib/sandbox';
import { minimax } from '@/lib/minimax';
import prisma from '@/lib/prisma';
import { loadExerciseSpec } from '@/lib/exercise-loader';

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
    console.log(`[DB] Exercise lookup: ${exerciseId} found=${!!exercise}`);
    
    if (!exercise) {
      return NextResponse.json({ error: 'Exercise not found' }, { status: 404 });
    }
    
    // Load description from spec.yaml
    let exerciseDescription = '';
    try {
      const spec = await loadExerciseSpec(exercise.path);
      exerciseDescription = spec.description;
    } catch (error) {
      console.error(`[ATTEMPT] Error loading spec for exercise ${exercise.path}:`, error);
    }
    
    // Get user commands
    const commands = session.commands.map((c) => c.command);
    
    // Run verify.sh to validate the solution
    const containerName = `gitkata-${sessionId}`;
    const sessionDir = `/app/sessions/${userId}/${sessionId}`;
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
      exerciseDescription: exerciseDescription,
      userCommands: commands,
      verificationOutput,
    });
    
    // Save attempt
    const attempt = await prisma.attempt.create({
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
    console.log(`[DB] Attempt created: user=${userId} exercise=${exerciseId} passed=${evaluation.passed} score=${evaluation.score} attemptId=${attempt.id}`);
    
    // Update score if this is a new best
    if (evaluation.passed) {
      const existingScore = await prisma.score.findUnique({
        where: {
          userId_exerciseId: { userId, exerciseId },
        },
      });
      console.log(`[DB] Score lookup: user=${userId} exercise=${exerciseId} existingScore=${existingScore?.bestScore || 'none'}`);
      
      const score = await prisma.score.upsert({
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
            existingScore?.bestScore || 0,
            evaluation.score
          ),
          completions: { increment: 1 },
          bestTime: duration,
        },
      });
      console.log(`[DB] Score upserted: user=${userId} exercise=${exerciseId} bestScore=${score.bestScore} completions=${score.completions}`);
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
