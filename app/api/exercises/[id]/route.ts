// app/api/exercises/[id]/route.ts

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { loadExerciseSpec } from '@/lib/exercise-loader';

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
        level: true,
        category: true,
        title: true,
        path: true,
        timeLimit: true,
      },
    });
    console.log(`[DB] Exercise lookup: id=${id} found=${!!exercise}`);

    if (!exercise) {
      return NextResponse.json(
        { error: 'Exercise not found' },
        { status: 404 }
      );
    }

    // Load description from spec.yaml
    let description = '';
    try {
      const spec = await loadExerciseSpec(exercise.path);
      description = spec.description;
    } catch (error) {
      console.error(`Error loading spec for exercise ${exercise.path}:`, error);
    }

    return NextResponse.json({
      ...exercise,
      description,
    });
  } catch (error) {
    console.error('Error fetching exercise:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
