// app/api/sandbox/exec/route.ts

import { NextResponse } from 'next/server';
import { sandbox } from '@/lib/sandbox';
import { sessionManager } from '@/lib/session-manager';

export async function POST(request: Request) {
  try {
    const { sessionId, command } = await request.json();
    
    if (!sessionId || !command) {
      return NextResponse.json(
        { error: 'sessionId and command are required' },
        { status: 400 }
      );
    }
    
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
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
    
    const containerName = `gitkata-${sessionId}`;
    const result = await sandbox.execInContainer(containerName, trimmedCommand);
    
    sessionManager.addCommand(sessionId, trimmedCommand, result.stdout + result.stderr);
    
    return NextResponse.json({
      output: result.stdout || result.stderr,
      exitCode: result.exitCode,
    });
  } catch (error) {
    console.error('Error executing command:', error);
    return NextResponse.json(
      { error: 'Failed to execute command' },
      { status: 500 }
    );
  }
}
