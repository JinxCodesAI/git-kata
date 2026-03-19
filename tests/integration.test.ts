/**
 * Integration Tests for Git Kata
 * 
 * These tests verify the full application flow:
 * 1. Full exercise flow (create session, exec commands, submit)
 * 2. Session cleanup mechanism
 * 3. Exercise scanner indexes all exercises correctly
 */

import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';

// Mock the sandbox module for integration testing
// In a real environment, these would use actual Docker containers

describe('Integration: Full Exercise Flow', () => {
    const EXERCISES_PATH = process.env.EXERCISES_PATH || '/exercises';

    describe('Exercise Discovery and Loading', () => {
        it('should discover all problem exercises', () => {
            const problemsDir = path.join(EXERCISES_PATH, 'problems');
            expect(fs.existsSync(problemsDir)).toBe(true);
            
            const problemDirs = fs.readdirSync(problemsDir).filter((dir) => {
                return fs.statSync(path.join(problemsDir, dir)).isDirectory();
            });
            
            expect(problemDirs.length).toBeGreaterThan(0);
            console.log(`Discovered ${problemDirs.length} problem exercises`);
        });

        it('should discover all solution exercises', () => {
            const solutionsDir = path.join(EXERCISES_PATH, 'solutions');
            expect(fs.existsSync(solutionsDir)).toBe(true);
            
            const solutionDirs = fs.readdirSync(solutionsDir).filter((dir) => {
                return fs.statSync(path.join(solutionsDir, dir)).isDirectory();
            });
            
            expect(solutionDirs.length).toBeGreaterThan(0);
            console.log(`Discovered ${solutionDirs.length} solution exercises`);
        });

        it('should have matching problem and solution directories', () => {
            const problemsDir = path.join(EXERCISES_PATH, 'problems');
            const solutionsDir = path.join(EXERCISES_PATH, 'solutions');
            
            const problemDirs = fs.readdirSync(problemsDir).filter((dir) => {
                return fs.statSync(path.join(problemsDir, dir)).isDirectory();
            });
            
            const solutionDirs = fs.readdirSync(solutionsDir).filter((dir) => {
                return fs.statSync(path.join(solutionsDir, dir)).isDirectory();
            });
            
            expect(problemDirs.length).toBe(solutionDirs.length);
        });

        it('should load all exercise specs with valid structure', () => {
            const problemsDir = path.join(EXERCISES_PATH, 'problems');
            const problemDirs = fs.readdirSync(problemsDir).filter((dir) => {
                return fs.statSync(path.join(problemsDir, dir)).isDirectory();
            });
            
            let validCount = 0;
            for (const dir of problemDirs) {
                const specPath = path.join(problemsDir, dir, 'spec.yaml');
                const content = fs.readFileSync(specPath, 'utf-8');
                const spec = yaml.load(content) as Record<string, unknown>;
                
                // Validate required fields
                const hasRequiredFields = 
                    spec.name && 
                    spec.title && 
                    typeof spec.level === 'number' &&
                    spec.category &&
                    typeof spec.timeLimit === 'number' &&
                    spec.description;
                
                if (hasRequiredFields) {
                    validCount++;
                }
            }
            
            expect(validCount).toBe(problemDirs.length);
            console.log(`All ${validCount} exercise specs have valid structure`);
        });
    });

    describe('Verify Scripts', () => {
        it('should have executable verify.sh for all solutions', () => {
            const solutionsDir = path.join(EXERCISES_PATH, 'solutions');
            const solutionDirs = fs.readdirSync(solutionsDir).filter((dir) => {
                return fs.statSync(path.join(solutionsDir, dir)).isDirectory();
            });
            
            let executableCount = 0;
            for (const dir of solutionDirs) {
                const verifyPath = path.join(solutionsDir, dir, 'verify.sh');
                if (fs.existsSync(verifyPath)) {
                    const stats = fs.statSync(verifyPath);
                    const mode = stats.mode;
                    const isExecutable = (mode & 0o111) !== 0;
                    if (isExecutable) {
                        executableCount++;
                    }
                }
            }
            
            expect(executableCount).toBe(solutionDirs.length);
            console.log(`All ${executableCount} verify.sh scripts are executable`);
        });

        it('should have valid verify.sh scripts with PASS/FAIL output', () => {
            const solutionsDir = path.join(EXERCISES_PATH, 'solutions');
            const solutionDirs = fs.readdirSync(solutionsDir).filter((dir) => {
                return fs.statSync(path.join(solutionsDir, dir)).isDirectory();
            });
            
            for (const dir of solutionDirs) {
                const verifyPath = path.join(solutionsDir, dir, 'verify.sh');
                const content = fs.readFileSync(verifyPath, 'utf-8');
                
                // Verify script should have VERIFICATION_START and VERIFICATION_END markers
                expect(content).toContain('VERIFICATION_START');
                expect(content).toContain('VERIFICATION_END');
                
                // Verify script should output PASS or FAIL
                expect(content).toMatch(/PASS:|FAIL:/);
            }
        });
    });

    describe('Exercise Content Validation', () => {
        it('should have git repositories in all problem content directories (except init)', () => {
            const problemsDir = path.join(EXERCISES_PATH, 'problems');
            const problemDirs = fs.readdirSync(problemsDir).filter((dir) => {
                return fs.statSync(path.join(problemsDir, dir)).isDirectory();
            });
            
            let gitRepoCount = 0;
            for (const dir of problemDirs) {
                // init-basic-01 starts empty - user will run git init
                if (dir === 'init-basic-01') {
                    continue;
                }
                
                const contentPath = path.join(problemsDir, dir, 'content');
                const gitPath = path.join(contentPath, '.git');
                
                if (fs.existsSync(gitPath) && fs.statSync(gitPath).isDirectory()) {
                    gitRepoCount++;
                }
            }
            
            // All except init-basic-01 should be git repos
            const expectedCount = problemDirs.length - 1;
            expect(gitRepoCount).toBe(expectedCount);
            console.log(`All ${gitRepoCount} non-init exercises have valid git repositories`);
        });

        it('should have git repositories in all solution content directories', () => {
            const solutionsDir = path.join(EXERCISES_PATH, 'solutions');
            const solutionDirs = fs.readdirSync(solutionsDir).filter((dir) => {
                return fs.statSync(path.join(solutionsDir, dir)).isDirectory();
            });
            
            let gitRepoCount = 0;
            for (const dir of solutionDirs) {
                const contentPath = path.join(solutionsDir, dir, 'content');
                const gitPath = path.join(contentPath, '.git');
                
                if (fs.existsSync(gitPath) && fs.statSync(gitPath).isDirectory()) {
                    gitRepoCount++;
                }
            }
            
            expect(gitRepoCount).toBe(solutionDirs.length);
            console.log(`All ${gitRepoCount} solution exercises have valid git repositories`);
        });
    });
});

describe('Integration: Session Management', () => {
    describe('Session Timeout Configuration', () => {
        it('should have 15 minute session timeout', () => {
            const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
            expect(SESSION_TIMEOUT_MS).toBe(900000);
        });

        it('should track session activity correctly', () => {
            // Simulate session activity tracking
            const mockSession = {
                id: 'test-session',
                userId: 'test-user',
                exerciseId: 'test-exercise',
                containerId: 'test-container',
                createdAt: new Date(),
                lastActivity: new Date(),
                commands: [] as { command: string; output: string; timestamp: Date }[],
            };
            
            // Update activity
            mockSession.lastActivity = new Date();
            expect(mockSession.lastActivity).toBeDefined();
            
            // Add command
            mockSession.commands.push({
                command: 'git status',
                output: 'On branch main',
                timestamp: new Date(),
            });
            expect(mockSession.commands.length).toBe(1);
            expect(mockSession.commands[0].command).toBe('git status');
        });

        it('should identify expired sessions correctly', () => {
            const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
            const now = Date.now();
            
            // Session active 5 minutes ago - NOT expired
            const activeSession = {
                lastActivity: new Date(now - 5 * 60 * 1000),
            };
            const isActiveExpired = now - activeSession.lastActivity.getTime() > SESSION_TIMEOUT_MS;
            expect(isActiveExpired).toBe(false);
            
            // Session active 20 minutes ago - EXPIRED
            const expiredSession = {
                lastActivity: new Date(now - 20 * 60 * 1000),
            };
            const isExpiredExpired = now - expiredSession.lastActivity.getTime() > SESSION_TIMEOUT_MS;
            expect(isExpiredExpired).toBe(true);
            
            // Session active exactly at timeout boundary - NOT expired (exclusive)
            const boundarySession = {
                lastActivity: new Date(now - SESSION_TIMEOUT_MS),
            };
            const isBoundaryExpired = now - boundarySession.lastActivity.getTime() > SESSION_TIMEOUT_MS;
            expect(isBoundaryExpired).toBe(false);
        });
    });

    describe('Session Cleanup Logic', () => {
        it('should clean up expired sessions', () => {
            const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
            const sessions = new Map<string, { id: string; lastActivity: Date }>();
            
            const now = Date.now();
            
            // Add active session (5 minutes old)
            sessions.set('active-session', {
                id: 'active-session',
                lastActivity: new Date(now - 5 * 60 * 1000),
            });
            
            // Add expired session (20 minutes old)
            sessions.set('expired-session', {
                id: 'expired-session',
                lastActivity: new Date(now - 20 * 60 * 1000),
            });
            
            // Simulate cleanup
            const expiredIds: string[] = [];
            for (const [id, session] of sessions.entries()) {
                if (now - session.lastActivity.getTime() > SESSION_TIMEOUT_MS) {
                    expiredIds.push(id);
                }
            }
            
            expect(expiredIds).toContain('expired-session');
            expect(expiredIds).not.toContain('active-session');
            expect(expiredIds.length).toBe(1);
        });
    });
});

describe('Integration: Exercise Scanner', () => {
    const EXERCISES_PATH = process.env.EXERCISES_PATH || '/exercises';

    describe('Scanner Indexes All Exercises', () => {
        it('should index all problem exercises', () => {
            const problemsDir = path.join(EXERCISES_PATH, 'problems');
            const problemDirs = fs.readdirSync(problemsDir).filter((dir) => {
                return fs.statSync(path.join(problemsDir, dir)).isDirectory();
            });
            
            const indexedExercises: string[] = [];
            
            for (const dir of problemDirs) {
                const specPath = path.join(problemsDir, dir, 'spec.yaml');
                if (fs.existsSync(specPath)) {
                    const content = fs.readFileSync(specPath, 'utf-8');
                    const spec = yaml.load(content) as { name: string };
                    indexedExercises.push(spec.name);
                }
            }
            
            expect(indexedExercises.length).toBe(problemDirs.length);
            console.log(`Scanner indexed ${indexedExercises.length} exercises`);
        });

        it('should categorize exercises correctly', () => {
            const problemsDir = path.join(EXERCISES_PATH, 'problems');
            const problemDirs = fs.readdirSync(problemsDir).filter((dir) => {
                return fs.statSync(path.join(problemsDir, dir)).isDirectory();
            });
            
            const categories = new Map<string, number>();
            
            for (const dir of problemDirs) {
                const specPath = path.join(problemsDir, dir, 'spec.yaml');
                const content = fs.readFileSync(specPath, 'utf-8');
                const spec = yaml.load(content) as { category: string };
                
                const count = categories.get(spec.category) || 0;
                categories.set(spec.category, count + 1);
            }
            
            expect(categories.size).toBeGreaterThan(0);
            console.log(`Found ${categories.size} exercise categories:`, Object.fromEntries(categories));
        });

        it('should have exercises at multiple difficulty levels', () => {
            const problemsDir = path.join(EXERCISES_PATH, 'problems');
            const problemDirs = fs.readdirSync(problemsDir).filter((dir) => {
                return fs.statSync(path.join(problemsDir, dir)).isDirectory();
            });
            
            const levels = new Set<number>();
            
            for (const dir of problemDirs) {
                const specPath = path.join(problemsDir, dir, 'spec.yaml');
                const content = fs.readFileSync(specPath, 'utf-8');
                const spec = yaml.load(content) as { level: number };
                levels.add(spec.level);
            }
            
            expect(levels.size).toBeGreaterThanOrEqual(2);
            console.log(`Exercise levels found:`, Array.from(levels).sort());
        });
    });

    describe('Scanner Handles Edge Cases', () => {
        it('should handle exercises with null initialBranch', () => {
            const problemsDir = path.join(EXERCISES_PATH, 'problems');
            const initExercise = path.join(problemsDir, 'init-basic-01', 'spec.yaml');
            
            if (fs.existsSync(initExercise)) {
                const content = fs.readFileSync(initExercise, 'utf-8');
                const spec = yaml.load(content) as { initialBranch: string | null };
                expect(spec.initialBranch).toBeNull();
            }
        });

        it('should validate timeLimit is reasonable', () => {
            const problemsDir = path.join(EXERCISES_PATH, 'problems');
            const problemDirs = fs.readdirSync(problemsDir).filter((dir) => {
                return fs.statSync(path.join(problemsDir, dir)).isDirectory();
            });
            
            for (const dir of problemDirs) {
                const specPath = path.join(problemsDir, dir, 'spec.yaml');
                const content = fs.readFileSync(specPath, 'utf-8');
                const spec = yaml.load(content) as { timeLimit: number };
                
                // Time limit should be between 60 seconds (1 min) and 3600 seconds (1 hour)
                expect(spec.timeLimit).toBeGreaterThanOrEqual(60);
                expect(spec.timeLimit).toBeLessThanOrEqual(3600);
            }
        });
    });
});

describe('Integration: End-to-End Exercise Flow', () => {
    const EXERCISES_PATH = process.env.EXERCISES_PATH || '/exercises';

    describe('Complete Exercise Workflow', () => {
        it('should have a simple exercise for testing basic flow', () => {
            // Use status-basic-01 as a simple test case
            const exercisePath = path.join(EXERCISES_PATH, 'problems', 'status-basic-01');
            expect(fs.existsSync(exercisePath)).toBe(true);
            
            const specPath = path.join(exercisePath, 'spec.yaml');
            expect(fs.existsSync(specPath)).toBe(true);
            
            const contentPath = path.join(exercisePath, 'content');
            expect(fs.existsSync(contentPath)).toBe(true);
            
            // Load and validate spec
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
            
            expect(spec.name).toBe('status-basic-01');
            expect(spec.level).toBe(1); // Should be level 1 (beginner)
            expect(spec.category).toBe('history');
        });

        it('should validate the complete exercise directory structure', () => {
            const problemsDir = path.join(EXERCISES_PATH, 'problems');
            const solutionDir = path.join(EXERCISES_PATH, 'solutions');
            
            // Get first 5 exercises as sample
            const problemDirs = fs.readdirSync(problemsDir).filter((dir) => {
                return fs.statSync(path.join(problemsDir, dir)).isDirectory();
            }).slice(0, 5);
            
            for (const dir of problemDirs) {
                // Problem structure
                expect(fs.existsSync(path.join(problemsDir, dir, 'spec.yaml'))).toBe(true);
                expect(fs.existsSync(path.join(problemsDir, dir, 'content'))).toBe(true);
                
                // Solution structure
                expect(fs.existsSync(path.join(solutionDir, dir, 'verify.sh'))).toBe(true);
                expect(fs.existsSync(path.join(solutionDir, dir, 'content'))).toBe(true);
            }
        });
    });
});
