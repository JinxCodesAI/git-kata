import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { ExerciseSpec } from './types';

const EXERCISES_PATH = process.env.EXERCISES_PATH || '/exercises';

/**
 * Load a single exercise specification from its spec.yaml file.
 * 
 * @param exercisePath - The exercise directory name (e.g., "merge-basic-01")
 * @returns The parsed ExerciseSpec object
 * @throws Error if spec.yaml is not found or cannot be parsed
 */
export async function loadExerciseSpec(exercisePath: string): Promise<ExerciseSpec> {
    // exercisePath can be either just the directory name (e.g., "init-basic-01") or
    // the full path stored in DB (e.g., "problems/init-basic-01")
    // We need to construct the correct path to spec.yaml
    let specPath: string;
    if (exercisePath.includes('problems/') || exercisePath.includes('solutions/')) {
        // exercisePath already includes the category prefix
        specPath = path.join(EXERCISES_PATH, exercisePath, 'spec.yaml');
    } else {
        // exercisePath is just the directory name, prepend 'problems'
        specPath = path.join(EXERCISES_PATH, 'problems', exercisePath, 'spec.yaml');
    }
    
    const specContent = await fs.readFile(specPath, 'utf-8');
    const spec = yaml.load(specContent) as ExerciseSpec;
    
    return spec;
}

/**
 * Get all exercise directory names from the problems folder.
 * 
 * @returns Array of exercise directory names
 */
export async function getExercisePaths(): Promise<string[]> {
    const problemsDir = path.join(EXERCISES_PATH, 'problems');
    
    const entries = await fs.readdir(problemsDir, { withFileTypes: true });
    const exerciseDirs = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    
    return exerciseDirs;
}

/**
 * Load all exercises from the exercises/problems directory.
 * 
 * @returns Array of ExerciseSpec objects for all valid exercises
 */
export async function loadAllExercises(): Promise<ExerciseSpec[]> {
    const exercisePaths = await getExercisePaths();
    const exercises: ExerciseSpec[] = [];
    
    for (const exercisePath of exercisePaths) {
        try {
            const spec = await loadExerciseSpec(exercisePath);
            exercises.push(spec);
        } catch (error) {
            console.error(`Error loading exercise ${exercisePath}:`, error);
            // Skip exercises that fail to load
        }
    }
    
    return exercises;
}
