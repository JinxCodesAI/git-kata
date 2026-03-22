// app/api/attempt/route.ts

import { NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-manager';
import { sandbox } from '@/lib/sandbox';
import { minimax } from '@/lib/minimax';
import prisma from '@/lib/prisma';
import { loadExerciseSpec } from '@/lib/exercise-loader';
import { validateUserId, validateSessionId } from '@/lib/validators';

export async function POST(request: Request) {
  console.log('[ATTEMPT] ===== POST /api/attempt called =====');
  try {
    const { sessionId, exerciseId, userId, duration } = await request.json();
    console.log('[ATTEMPT] Request body:', { sessionId, exerciseId, userId, duration });
    
    if (!sessionId || !exerciseId || !userId) {
      return NextResponse.json(
        { error: 'sessionId, exerciseId, and userId are required' },
        { status: 400 }
      );
    }
    
    if (!validateUserId(userId)) {
      return NextResponse.json(
        { error: 'Invalid userId format' },
        { status: 400 }
      );
    }
    
    if (!validateSessionId(sessionId)) {
      return NextResponse.json(
        { error: 'Invalid sessionId format' },
        { status: 400 }
      );
    }
    
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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
    // verify.sh runs in web-app context (not sandbox) because session dir is mounted there
    const sessionDir = `/app/sessions/${userId}/${sessionId}`;
    
    let verificationOutput = '';
    try {
      // Run verify.sh from the isolated verify-scripts directory.
      // This directory is NOT accessible from the sandbox container,
      // preventing users from modifying verify.sh to escape.
      const verifyScriptPath = sandbox.getVerifyScriptPath(sessionId);
      const verifyCommand = `bash ${verifyScriptPath} ${sessionDir} ${sessionDir}`;
      console.log('[ATTEMPT] Running verify.sh in web-app context:', verifyCommand);
      const verifyResult = await sandbox.execInWebApp(verifyCommand, sessionDir);
      verificationOutput = verifyResult.stdout + verifyResult.stderr;
      console.log('[ATTEMPT] verify.sh stdout:', verifyResult.stdout);
      console.log('[ATTEMPT] verify.sh stderr:', verifyResult.stderr);
      console.log('[ATTEMPT] verify.sh exitCode:', verifyResult.exitCode);
    } catch (e) {
      verificationOutput = 'Error running verification script: ' + String(e);
      console.error('[ATTEMPT] verify.sh error:', e);
    }
    console.log('[ATTEMPT] Final verificationOutput:', verificationOutput);
    
    // Evaluate with LLM using verification output
    console.log('[ATTEMPT] Calling minimax.evaluateAttempt...');
    const evaluation = await minimax.evaluateAttempt({
      exerciseTitle: exercise.title,
      exerciseDescription: exerciseDescription,
      userCommands: commands,
      verificationOutput,
    });
    console.log('[ATTEMPT] LLM evaluation result:', evaluation);
    
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
