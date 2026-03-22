// app/api/exercises/[id]/solution/route.ts

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { loadExerciseSpec } from '@/lib/exercise-loader';
import { logger } from '@/lib/logger';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Exercise ID is required' },
        { status: 400 }
      );
    }

    const exercise = await prisma.exercise.findUnique({
      where: { id },
      select: {
        id: true,
        path: true,
      },
    });
    logger.debug('Exercise solution lookup:', 'id=', id, 'found=', !!exercise);

    if (!exercise) {
      return NextResponse.json(
        { error: 'Exercise not found' },
        { status: 404 }
      );
    }

    // Load hint from spec.yaml
    let hint = '';
    try {
      const spec = await loadExerciseSpec(exercise.path);
      hint = spec.hint || '';
    } catch (error) {
      logger.error('Error loading spec for exercise:', exercise.path, error);
    }

    return NextResponse.json({
      id: exercise.id,
      hint,
    });
  } catch (error) {
    logger.error('Error fetching exercise solution:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}