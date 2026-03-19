// app/api/leaderboard/route.ts

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
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
    console.log(`[DB] Leaderboard query: totalUsers=${usersWithScores.length} limit=${limit} offset=${offset}`);

    const leaderboard = usersWithScores
      .map((user) => {
        const completedScores = user.scores.filter((s) => s.completions > 0);
        const totalScore = user.scores.reduce((sum, s) => sum + s.bestScore, 0);
        const exercises = completedScores.length;
        const avgTime =
          exercises > 0
            ? completedScores.reduce((sum, s) => sum + (s.bestTime || 0), 0) / exercises
            : 0;

        return {
          userId: user.id,
          name: user.name,
          score: totalScore,
          exercises,
          avgTime: Math.round(avgTime),
        };
      })
      .filter((u) => u.exercises > 0)
      .sort((a, b) => b.score - a.score);

    const totalCount = leaderboard.length;
    const paginatedLeaderboard = leaderboard.slice(offset, offset + limit);
    const rankedLeaderboard = paginatedLeaderboard.map((entry, index) => ({
      rank: offset + index + 1,
      ...entry,
    }));

    return NextResponse.json({
      leaderboard: rankedLeaderboard,
      total: totalCount,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
