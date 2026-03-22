// app/api/leaderboard/route.ts

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  try {
    // Rate limit by IP address
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const { allowed, retryAfterMs } = checkRateLimit(`leaderboard:${ip}`, RATE_LIMITS.leaderboard.maxRequests, RATE_LIMITS.leaderboard.windowMs);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const usersWithScores = await prisma.user.findMany({
      include: {
        scores: {
          select: {
            bestScore: true,
            completions: true,
            bestTime: true,
          },
        },
      },
    });
    logger.debug('Leaderboard query:', 'totalUsers=', usersWithScores.length, 'limit=', limit, 'offset=', offset);

    // Get total exercise count for the totalExercises field
    const totalExercises = await prisma.exercise.count();

    const leaderboard = usersWithScores
      .map((user) => {
        const completedScores = user.scores.filter((s) => s.completions > 0);
        const totalScore = user.scores.reduce((sum, s) => sum + s.bestScore, 0);
        const exercisesCompleted = completedScores.length;
        const avgTime =
          exercisesCompleted > 0
            ? completedScores.reduce((sum, s) => sum + (s.bestTime || 0), 0) / exercisesCompleted
            : 0;

        return {
          userName: user.name,
          score: totalScore,
          exercisesCompleted,
          avgTime: Math.round(avgTime),
        };
      })
      .filter((u) => u.exercisesCompleted > 0)
      .sort((a, b) => b.score - a.score);

    const totalParticipants = leaderboard.length;
    const paginatedLeaderboard = leaderboard.slice(offset, offset + limit);
    const rankedLeaderboard = paginatedLeaderboard.map((entry, index) => ({
      rank: offset + index + 1,
      ...entry,
      totalExercises,
    }));

    return NextResponse.json({
      entries: rankedLeaderboard,
      totalParticipants,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
