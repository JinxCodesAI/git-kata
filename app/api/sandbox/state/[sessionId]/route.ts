// app/api/sandbox/state/[sessionId]/route.ts

import { NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-manager';
import { sandbox } from '@/lib/sandbox';
import { validateSessionId } from '@/lib/validators';

export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    const userId = new URL(request.url).searchParams.get('userId');
    
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

    const containerName = `gitkata-${sessionId}`;
    const state = await sandbox.getRepoState(containerName);

    return NextResponse.json(state);
  } catch (error) {
    console.error('Error getting sandbox state:', error);
    return NextResponse.json(
      { error: 'Failed to get sandbox state' },
      { status: 500 }
    );
  }
}
