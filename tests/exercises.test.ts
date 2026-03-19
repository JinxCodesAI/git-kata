/**
 * Exercise Content Tests
 * 
 * These tests verify that:
 * 1. All exercises have required files (spec.yaml, content/, verify.sh)
 * 2. The exercise scanner can parse all spec.yaml files
 * 3. The exercise loader can load all exercises
 * 4. verify.sh scripts are executable and output PASS/FAIL format
 */

import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';

// Helper function to get exercise directories
function getProblemDirs(): string[] {
    const EXERCISES_PATH = process.env.EXERCISES_PATH || '/exercises';
    const PROBLEMS_DIR = path.join(EXERCISES_PATH, 'problems');
    
    if (!fs.existsSync(PROBLEMS_DIR)) {
        return [];
    }
    return fs.readdirSync(PROBLEMS_DIR).filter((dir) => {
        const fullPath = path.join(PROBLEMS_DIR, dir);
        return fs.statSync(fullPath).isDirectory();
    });
}

function getSolutionDirs(): string[] {
    const EXERCISES_PATH = process.env.EXERCISES_PATH || '/exercises';
    const SOLUTIONS_DIR = path.join(EXERCISES_PATH, 'solutions');
    
    if (!fs.existsSync(SOLUTIONS_DIR)) {
        return [];
    }
    return fs.readdirSync(SOLUTIONS_DIR).filter((dir) => {
        const fullPath = path.join(SOLUTIONS_DIR, dir);
        return fs.statSync(fullPath).isDirectory();
    });
}

function getExercisesPath(): string {
    return process.env.EXERCISES_PATH || '/exercises';
}

describe('Exercise Content Structure', () => {
    describe('Problem Exercises', () => {
        it('should have the same number of problem and solution directories', () => {
            const problemDirs = getProblemDirs();
            const solutionDirs = getSolutionDirs();
            expect(problemDirs.length).toBe(solutionDirs.length);
        });

        it('problem directories should have content directories', () => {
            const problemDirs = getProblemDirs();
            const EXERCISES_PATH = getExercisesPath();
            for (const dir of problemDirs) {
                const contentPath = path.join(EXERCISES_PATH, 'problems', dir, 'content');
                expect(fs.existsSync(contentPath)).toBe(true);
                expect(fs.statSync(contentPath).isDirectory()).toBe(true);
            }
        });

        it('problem directories should have spec.yaml files', () => {
            const problemDirs = getProblemDirs();
            const EXERCISES_PATH = getExercisesPath();
            for (const dir of problemDirs) {
                const specPath = path.join(EXERCISES_PATH, 'problems', dir, 'spec.yaml');
                expect(fs.existsSync(specPath)).toBe(true);
            }
        });

        it('problem spec.yaml files should be valid YAML', () => {
            const problemDirs = getProblemDirs();
            const EXERCISES_PATH = getExercisesPath();
            for (const dir of problemDirs) {
                const specPath = path.join(EXERCISES_PATH, 'problems', dir, 'spec.yaml');
                const content = fs.readFileSync(specPath, 'utf-8');
                expect(() => yaml.load(content)).not.toThrow();
            }
        });

        it('problem spec.yaml files should have required fields', () => {
            const problemDirs = getProblemDirs();
            const EXERCISES_PATH = getExercisesPath();
            for (const dir of problemDirs) {
                const specPath = path.join(EXERCISES_PATH, 'problems', dir, 'spec.yaml');
                const content = fs.readFileSync(specPath, 'utf-8');
                const spec = yaml.load(content) as Record<string, unknown>;
                
                expect(spec).toHaveProperty('name');
                expect(spec).toHaveProperty('title');
                expect(spec).toHaveProperty('level');
                expect(spec).toHaveProperty('category');
                expect(spec).toHaveProperty('timeLimit');
                expect(spec).toHaveProperty('description');
                expect(spec).toHaveProperty('initialBranch');
            }
        });

        it('problem spec.yaml files should have valid level (1-4)', () => {
            const problemDirs = getProblemDirs();
            const EXERCISES_PATH = getExercisesPath();
            for (const dir of problemDirs) {
                const specPath = path.join(EXERCISES_PATH, 'problems', dir, 'spec.yaml');
                const content = fs.readFileSync(specPath, 'utf-8');
                const spec = yaml.load(content) as { level: number };
                expect([1, 2, 3, 4]).toContain(spec.level);
            }
        });

        it('problem spec.yaml name should match directory name', () => {
            const problemDirs = getProblemDirs();
            const EXERCISES_PATH = getExercisesPath();
            for (const dir of problemDirs) {
                const specPath = path.join(EXERCISES_PATH, 'problems', dir, 'spec.yaml');
                const content = fs.readFileSync(specPath, 'utf-8');
                const spec = yaml.load(content) as { name: string };
                expect(spec.name).toBe(dir);
            }
        });

        it('problem content directories should be git repositories (except init-basic-01)', () => {
            const problemDirs = getProblemDirs();
            const EXERCISES_PATH = getExercisesPath();
            for (const dir of problemDirs) {
                // init-basic-01 starts empty - user will run git init
                if (dir === 'init-basic-01') {
                    continue;
                }
                const contentPath = path.join(EXERCISES_PATH, 'problems', dir, 'content');
                const gitPath = path.join(contentPath, '.git');
                expect(fs.existsSync(gitPath)).toBe(true);
                expect(fs.statSync(gitPath).isDirectory()).toBe(true);
            }
        });
    });

    describe('Solution Exercises', () => {
        it('solution directories should have content directories', () => {
            const solutionDirs = getSolutionDirs();
            const EXERCISES_PATH = getExercisesPath();
            for (const dir of solutionDirs) {
                const contentPath = path.join(EXERCISES_PATH, 'solutions', dir, 'content');
                expect(fs.existsSync(contentPath)).toBe(true);
                expect(fs.statSync(contentPath).isDirectory()).toBe(true);
            }
        });

        it('solution directories should have verify.sh scripts', () => {
            const solutionDirs = getSolutionDirs();
            const EXERCISES_PATH = getExercisesPath();
            for (const dir of solutionDirs) {
                const verifyPath = path.join(EXERCISES_PATH, 'solutions', dir, 'verify.sh');
                expect(fs.existsSync(verifyPath)).toBe(true);
            }
        });

        it('solution verify.sh scripts should be executable', () => {
            const solutionDirs = getSolutionDirs();
            const EXERCISES_PATH = getExercisesPath();
            for (const dir of solutionDirs) {
                const verifyPath = path.join(EXERCISES_PATH, 'solutions', dir, 'verify.sh');
                const stats = fs.statSync(verifyPath);
                const mode = stats.mode;
                const isExecutable = (mode & 0o111) !== 0;
                expect(isExecutable).toBe(true);
            }
        });

        it('solution content directories should be git repositories', () => {
            const solutionDirs = getSolutionDirs();
            const EXERCISES_PATH = getExercisesPath();
            for (const dir of solutionDirs) {
                const contentPath = path.join(EXERCISES_PATH, 'solutions', dir, 'content');
                const gitPath = path.join(contentPath, '.git');
                expect(fs.existsSync(gitPath)).toBe(true);
                expect(fs.statSync(gitPath).isDirectory()).toBe(true);
            }
        });
    });

    describe('Exercise Level Distribution', () => {
        it('should have approximately 10 Level 1 exercises', () => {
            const problemDirs = getProblemDirs();
            const level1Exercises = problemDirs.filter((dir) => {
                const EXERCISES_PATH = getExercisesPath();
                const specPath = path.join(EXERCISES_PATH, 'problems', dir, 'spec.yaml');
                const content = fs.readFileSync(specPath, 'utf-8');
                const spec = yaml.load(content) as { level: number };
                return spec.level === 1;
            });
            expect(level1Exercises.length).toBeGreaterThanOrEqual(10);
        });

        it('should have approximately 10 Level 2 exercises', () => {
            const problemDirs = getProblemDirs();
            const level2Exercises = problemDirs.filter((dir) => {
                const EXERCISES_PATH = getExercisesPath();
                const specPath = path.join(EXERCISES_PATH, 'problems', dir, 'spec.yaml');
                const content = fs.readFileSync(specPath, 'utf-8');
                const spec = yaml.load(content) as { level: number };
                return spec.level === 2;
            });
            expect(level2Exercises.length).toBeGreaterThanOrEqual(10);
        });
    });
});

describe('Exercise Scanner', () => {
    it('should be able to read all spec.yaml files', () => {
        const problemDirs = getProblemDirs();
        
        for (const dir of problemDirs) {
            const EXERCISES_PATH = getExercisesPath();
            const specPath = path.join(EXERCISES_PATH, 'problems', dir, 'spec.yaml');
            const content = fs.readFileSync(specPath, 'utf-8');
            const spec = yaml.load(content);
            expect(spec).toBeDefined();
        }
    });

    it('should parse spec.yaml with correct types', () => {
        const problemDirs = getProblemDirs();
        
        for (const dir of problemDirs) {
            const EXERCISES_PATH = getExercisesPath();
            const specPath = path.join(EXERCISES_PATH, 'problems', dir, 'spec.yaml');
            const content = fs.readFileSync(specPath, 'utf-8');
            const spec = yaml.load(content) as {
                name: string;
                title: string;
                level: number;
                category: string;
                timeLimit: number;
                description: string;
                initialBranch: string | null;
            };
            
            expect(typeof spec.name).toBe('string');
            expect(typeof spec.title).toBe('string');
            expect(typeof spec.level).toBe('number');
            expect(typeof spec.category).toBe('string');
            expect(typeof spec.timeLimit).toBe('number');
            expect(typeof spec.description).toBe('string');
            expect(spec.initialBranch === null || typeof spec.initialBranch === 'string').toBe(true);
        }
    });
});

describe('Exercise Loader', () => {
    it('should be able to load all exercise specs', async () => {
        const { loadAllExercises } = await import('@/lib/exercise-loader');
        
        const exercises = await loadAllExercises();
        expect(exercises.length).toBeGreaterThan(0);
    });

    it('should return exercise specs with all required fields', async () => {
        const { loadAllExercises } = await import('@/lib/exercise-loader');
        
        const exercises = await loadAllExercises();
        
        for (const exercise of exercises) {
            expect(exercise).toHaveProperty('name');
            expect(exercise).toHaveProperty('title');
            expect(exercise).toHaveProperty('level');
            expect(exercise).toHaveProperty('category');
            expect(exercise).toHaveProperty('timeLimit');
            expect(exercise).toHaveProperty('description');
            expect(exercise).toHaveProperty('initialBranch');
        }
    });
});

describe('Verify Scripts', () => {
    it('verify.sh scripts should be valid bash scripts', () => {
        const solutionDirs = getSolutionDirs();
        const EXERCISES_PATH = getExercisesPath();
        for (const dir of solutionDirs) {
            const verifyPath = path.join(EXERCISES_PATH, 'solutions', dir, 'verify.sh');
            const content = fs.readFileSync(verifyPath, 'utf-8');
            
            // Check shebang
            expect(content.startsWith('#!/bin/bash')).toBe(true);
            
            // Check it references USER_DIR and SOLUTION_DIR
            expect(content).toContain('USER_DIR');
            expect(content).toContain('SOLUTION_DIR');
        }
    });

    it('verify.sh scripts should output PASS or FAIL format', () => {
        const solutionDirs = getSolutionDirs();
        const EXERCISES_PATH = getExercisesPath();
        for (const dir of solutionDirs) {
            const verifyPath = path.join(EXERCISES_PATH, 'solutions', dir, 'verify.sh');
            const content = fs.readFileSync(verifyPath, 'utf-8');
            
            // Check for PASS:/FAIL: output pattern
            expect(content).toContain('PASS:');
            expect(content).toContain('FAIL:');
        }
    });

    it('verify.sh scripts should have VERIFICATION_START and VERIFICATION_END', () => {
        const solutionDirs = getSolutionDirs();
        const EXERCISES_PATH = getExercisesPath();
        for (const dir of solutionDirs) {
            const verifyPath = path.join(EXERCISES_PATH, 'solutions', dir, 'verify.sh');
            const content = fs.readFileSync(verifyPath, 'utf-8');
            
            expect(content).toContain('VERIFICATION_START');
            expect(content).toContain('VERIFICATION_END');
        }
    });
});

describe('Exercise Categories', () => {
    it('should have init category exercises', () => {
        const problemDirs = getProblemDirs();
        const categories = problemDirs.map((dir) => {
            const EXERCISES_PATH = getExercisesPath();
            const specPath = path.join(EXERCISES_PATH, 'problems', dir, 'spec.yaml');
            const content = fs.readFileSync(specPath, 'utf-8');
            const spec = yaml.load(content) as { category: string };
            return spec.category;
        });
        expect(categories).toContain('init');
    });

    it('should have commit category exercises', () => {
        const problemDirs = getProblemDirs();
        const categories = problemDirs.map((dir) => {
            const EXERCISES_PATH = getExercisesPath();
            const specPath = path.join(EXERCISES_PATH, 'problems', dir, 'spec.yaml');
            const content = fs.readFileSync(specPath, 'utf-8');
            const spec = yaml.load(content) as { category: string };
            return spec.category;
        });
        expect(categories).toContain('commit');
    });

    it('should have branch category exercises', () => {
        const problemDirs = getProblemDirs();
        const categories = problemDirs.map((dir) => {
            const EXERCISES_PATH = getExercisesPath();
            const specPath = path.join(EXERCISES_PATH, 'problems', dir, 'spec.yaml');
            const content = fs.readFileSync(specPath, 'utf-8');
            const spec = yaml.load(content) as { category: string };
            return spec.category;
        });
        expect(categories).toContain('branch');
    });

    it('should have merge category exercises', () => {
        const problemDirs = getProblemDirs();
        const categories = problemDirs.map((dir) => {
            const EXERCISES_PATH = getExercisesPath();
            const specPath = path.join(EXERCISES_PATH, 'problems', dir, 'spec.yaml');
            const content = fs.readFileSync(specPath, 'utf-8');
            const spec = yaml.load(content) as { category: string };
            return spec.category;
        });
        expect(categories).toContain('merge');
    });

    it('should have stash category exercises', () => {
        const problemDirs = getProblemDirs();
        const categories = problemDirs.map((dir) => {
            const EXERCISES_PATH = getExercisesPath();
            const specPath = path.join(EXERCISES_PATH, 'problems', dir, 'spec.yaml');
            const content = fs.readFileSync(specPath, 'utf-8');
            const spec = yaml.load(content) as { category: string };
            return spec.category;
        });
        expect(categories).toContain('stash');
    });
});
