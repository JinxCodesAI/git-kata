#!/usr/bin/env tsx

/**
 * Scan exercises directory and index exercises in database
 * 
 * This script walks the exercises/problems directory, reads each
 * exercise's spec.yaml, and indexes them in the database.
 */

import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';
import prisma from '../lib/prisma';

interface ExerciseSpec {
    name: string;
    title: string;
    level: number;
    category: string;
    timeLimit?: number;
    description?: string;
    initialBranch?: string;
}

async function scanExercises(): Promise<void> {
    const exercisesPath = process.env.EXERCISES_PATH || '/exercises';
    const problemsDir = path.join(exercisesPath, 'problems');

    console.log(`Scanning exercises from: ${problemsDir}`);

    if (!fs.existsSync(problemsDir)) {
        console.warn(`Exercises directory not found: ${problemsDir}`);
        console.warn('Skipping exercise scan.');
        return;
    }

    const exerciseDirs = fs.readdirSync(problemsDir).filter((dir) => {
        const fullPath = path.join(problemsDir, dir);
        return fs.statSync(fullPath).isDirectory();
    });

    console.log(`Found ${exerciseDirs.length} exercise directories`);

    for (const exerciseDir of exerciseDirs) {
        const specPath = path.join(problemsDir, exerciseDir, 'spec.yaml');

        if (!fs.existsSync(specPath)) {
            console.warn(`No spec.yaml found for exercise: ${exerciseDir}`);
            continue;
        }

        try {
            const specContent = fs.readFileSync(specPath, 'utf-8');
            const spec = yaml.load(specContent) as ExerciseSpec;

            // Upsert exercise in database
            await prisma.exercise.upsert({
                where: { id: spec.name },
                update: {
                    title: spec.title,
                    level: spec.level,
                    category: spec.category,
                    timeLimit: spec.timeLimit ?? 600,
                    path: `problems/${exerciseDir}`,
                },
                create: {
                    id: spec.name,
                    title: spec.title,
                    level: spec.level,
                    category: spec.category,
                    timeLimit: spec.timeLimit ?? 600,
                    path: `problems/${exerciseDir}`,
                    order: 0,
                },
            });

            console.log(`Indexed exercise: ${spec.name}`);
        } catch (error) {
            console.error(`Error processing exercise ${exerciseDir}:`, error);
        }
    }

    console.log('Exercise scan complete!');
}

scanExercises().catch((error) => {
    console.error('Failed to scan exercises:', error);
    process.exit(1);
});