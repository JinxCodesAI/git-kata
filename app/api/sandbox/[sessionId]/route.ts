// app/api/sandbox/[sessionId]/route.ts

import { NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-manager';
import { sandbox } from '@/lib/sandbox';

export async function DELETE(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    const session = sessionManager.getSession(sessionId);
    
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    
    await sandbox.destroyContainer(`gitkata-${sessionId}`);
    await sandbox.cleanupSessionDir(sessionId, session.userId);
    sessionManager.destroySession(sessionId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error destroying session:', error);
    return NextResponse.json(
      { error: 'Failed to destroy session' },
      { status: 500 }
    );
  }
}
