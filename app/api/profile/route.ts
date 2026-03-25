// app/api/profile/route.ts

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface ProgressByLevel {
  level: number;
  completed: number;
  total: number;
  percentage: number;
}

interface RecentAttempt {
  id: string;
  exerciseId: string;
  exerciseTitle: string;
  passed: boolean;
  score: number;
  createdAt: Date;
}

interface ProfileStats {
  totalExercises: number;
  totalScore: number;
  averageScore: number;
  bestStreak: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // userId is required - return 400 if missing
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Validate userId format (must be non-empty string, max 100 chars)
    if (!userId || userId.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(userId)) {
      return NextResponse.json({ error: 'Invalid userId format' }, { status: 400 });
    }

    // Find existing user (or create new one if not found)
    let user = await prisma.user.findUnique({
      where: { id: userId },
    });
    logger.debug('User lookup:', 'userId=', userId, 'found=', !!user);

    if (!user) {
      logger.debug('User not found, creating new user:', 'userId=', userId);
      user = await prisma.user.create({
        data: {
          id: userId,
          name: 'anonymous',
        },
      });
    }

    // Get all exercises count by level
    const exercisesByLevel = await prisma.exercise.groupBy({
      by: ['level'],
      _count: { id: true },
    });

    const totalExercisesByLevel = exercisesByLevel.reduce((acc, el) => {
      acc[el.level] = el._count.id;
      return acc;
    }, {} as Record<number, number>);

    // Get completed exercises (scores where completions > 0)
    const completedScores = await prisma.score.findMany({
      where: { userId: user.id },
      include: { exercise: true },
    });
    logger.debug('Scores lookup:', 'userId=', user.id, 'count=', completedScores.length);

    // Calculate progress by level
    const progressByLevelMap: Record<number, { completed: number; total: number }> = {};
    
    for (const level of Object.keys(totalExercisesByLevel)) {
      const levelNum = parseInt(level);
      progressByLevelMap[levelNum] = {
        completed: 0,
        total: totalExercisesByLevel[levelNum],
      };
    }

    for (const score of completedScores) {
      const level = score.exercise.level;
      if (progressByLevelMap[level]) {
        progressByLevelMap[level].completed += 1;
      }
    }

    const progressByLevel: ProgressByLevel[] = Object.entries(progressByLevelMap)
      .map(([level, data]) => ({
        level: parseInt(level),
        completed: data.completed,
        total: data.total,
        percentage: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      }))
      .sort((a, b) => a.level - b.level);

    // Calculate stats
    const totalExercises = completedScores.length;
    const totalScore = completedScores.reduce((sum, s) => sum + s.bestScore, 0);
    const averageScore = totalExercises > 0 ? Math.round(totalScore / totalExercises) : 0;

    // Calculate best streak (consecutive days with at least one passed attempt)
    const attempts = await prisma.attempt.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });

    let bestStreak = 0;
    let currentStreak = 0;
    let lastDate: Date | null = null;

    for (const attempt of attempts) {
      const attemptDate = new Date(attempt.createdAt);
      const attemptDay = new Date(attemptDate.getFullYear(), attemptDate.getMonth(), attemptDate.getDate());

      if (lastDate === null) {
        currentStreak = 1;
      } else {
        const lastDay = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
        const diffDays = Math.floor((attemptDay.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          // Same day, no change to streak
        } else if (diffDays === 1) {
          currentStreak += 1;
        } else {
          currentStreak = 1;
        }
      }

      if (attempt.passed) {
        bestStreak = Math.max(bestStreak, currentStreak);
      }
      lastDate = attempt.createdAt;
    }

    const stats: ProfileStats = {
      totalExercises,
      totalScore,
      averageScore,
      bestStreak,
    };

    // Get recent attempts
    const recentAttemptsRaw = await prisma.attempt.findMany({
      where: { userId: user.id },
      include: { exercise: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    logger.debug('Recent attempts lookup:', 'userId=', user.id, 'count=', recentAttemptsRaw.length);

    const recentAttempts: RecentAttempt[] = recentAttemptsRaw.map((a) => ({
      id: a.id,
      exerciseId: a.exerciseId,
      exerciseTitle: a.exercise.title,
      passed: a.passed,
      score: a.score,
      createdAt: a.createdAt,
    }));

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        createdAt: user.createdAt,
        lastActive: user.lastActive,
      },
      stats,
      progressByLevel,
      recentAttempts,
    });
  } catch (error) {
    logger.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { userId, name } = body;

    // Validate required fields
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    // Validate name format: 1-30 characters, alphanumeric with spaces
    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 30) {
      return NextResponse.json(
        { error: 'Name must be between 1 and 30 characters' },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9 ]+$/.test(trimmedName)) {
      return NextResponse.json(
        { error: 'Name can only contain letters, numbers, and spaces' },
        { status: 400 }
      );
    }

    // Validate userId format
    if (userId.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(userId)) {
      return NextResponse.json({ error: 'Invalid userId format' }, { status: 400 });
    }

    // Update user name
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name: trimmedName },
    });

    logger.debug('User name updated:', 'userId=', userId, 'newName=', trimmedName);

    return NextResponse.json({
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        createdAt: updatedUser.createdAt,
        lastActive: updatedUser.lastActive,
      },
    });
  } catch (error) {
    logger.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
