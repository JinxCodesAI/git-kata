// app/api/exercises/route.ts

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const levelParam = searchParams.get('level');
    const category = searchParams.get('category');

    const where: Record<string, unknown> = {};
    
    if (levelParam) {
      const level = parseInt(levelParam, 10);
      if (isNaN(level)) {
        return NextResponse.json(
          { error: 'Invalid level parameter' },
          { status: 400 }
        );
      }
      where.level = level;
    }
    
    if (category) {
      where.category = category;
    }

    const exercises = await prisma.exercise.findMany({
      where,
      orderBy: { order: 'asc' },
      select: {
        id: true,
        level: true,
        category: true,
        title: true,
      },
    });

    return NextResponse.json(exercises);
  } catch (error) {
    console.error('Error fetching exercises:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
