// app/api/sandbox/exec/route.ts

import { NextResponse } from 'next/server';
import { sandbox } from '@/lib/sandbox';
import { sessionManager } from '@/lib/session-manager';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateSessionId } from '@/lib/validators';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const { sessionId, command, userId } = await request.json();

    if (!sessionId || !command) {
      return NextResponse.json(
        { error: 'sessionId and command are required' },
        { status: 400 }
      );
    }

    if (!validateSessionId(sessionId)) {
      return NextResponse.json(
        { error: 'Invalid sessionId format' },
        { status: 400 }
      );
    }

    // Check rate limit
    const { allowed, retryAfterMs } = checkRateLimit(`exec:${userId}`, RATE_LIMITS.sandboxExec.maxRequests, RATE_LIMITS.sandboxExec.windowMs);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      );
    }

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    sessionManager.updateActivity(sessionId);

    // Validate command - must start with 'git'
    const trimmedCommand = command.trim();
    if (!trimmedCommand.startsWith('git ')) {
      return NextResponse.json({
        output: 'Error: Only git commands are allowed. Commands must start with "git"',
        exitCode: 1,
      });
    }

    // Basic command injection prevention
    const dangerousPatterns = [
      /&&/,
      /\|\|/,
      /;/,
      /\$/,
      /`/,
      /\$\(/,
      /\$\(/,
    ];

    if (dangerousPatterns.some((p) => p.test(trimmedCommand))) {
      return NextResponse.json({
        output: 'Error: Invalid characters in command',
        exitCode: 1,
      });
    }

    // Use session.containerName from the pool
    const result = await sandbox.execInContainer(session.containerName, trimmedCommand);

    sessionManager.addCommand(sessionId, trimmedCommand, result.stdout + result.stderr);

    return NextResponse.json({
      output: result.stdout || result.stderr,
      exitCode: result.exitCode,
    });
  } catch (error) {
    logger.error('Error executing command:', error);
    return NextResponse.json(
      { error: 'Failed to execute command' },
      { status: 500 }
    );
  }
}
