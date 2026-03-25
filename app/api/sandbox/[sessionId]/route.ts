// app/api/sandbox/[sessionId]/route.ts

import { NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-manager';
import { sandbox } from '@/lib/sandbox';
import { validateSessionId } from '@/lib/validators';
import { logger } from '@/lib/logger';
import '@/lib/startup'; // Ensure pool is initialized

export async function DELETE(
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
      return NextResponse.json({ success: true, message: 'Session already removed' });
    }

    if (session.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Cleanup session directory (container is released back to pool by destroySession)
    await sandbox.cleanupSessionDir(sessionId, session.containerName);
    await sandbox.cleanupVerifyScript(sessionId);
    await sessionManager.destroySession(sessionId);

    logger.info('Session deleted via API:', sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error destroying session:', error);
    return NextResponse.json(
      { error: 'Failed to destroy session' },
      { status: 500 }
    );
  }
}
