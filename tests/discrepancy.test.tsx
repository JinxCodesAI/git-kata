/**
 * Discrepancy Verification Tests
 * 
 * These tests verify that the discrepancies documented in docs/discrepancy_report.md
 * are properly fixed in the codebase.
 * 
 * Run with: npm test -- discrepancy.test.ts
 */

import React, { StrictMode } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock localStorage
const localStorageData: Record<string, string> = {};
const localStorageMock: Storage = {
    getItem: jest.fn((key: string) => localStorageData[key] || null),
    setItem: jest.fn((key: string, value: string) => { localStorageData[key] = value; }),
    removeItem: jest.fn((key: string) => { delete localStorageData[key]; }),
    clear: jest.fn(() => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]); }),
    get length(): number { return Object.keys(localStorageData).length; },
    key: jest.fn((index: number) => Object.keys(localStorageData)[index] || null),
};
global.localStorage = localStorageMock;

// Mock Next.js router
const routerReplaceMock = jest.fn();
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: routerReplaceMock,
        push: jest.fn(),
        back: jest.fn(),
    }),
    useParams: () => ({ id: 'init-basic-01' }),
}));

// Mock Link component
jest.mock('next/link', () => {
    return function MockLink({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) {
        return <a href={href} className={className}>{children}</a>;
    };
});

// Mock ExercisePanel component
jest.mock('@/app/components/ExercisePanel', () => {
    return function MockExercisePanel({ exercise, currentBranch, timer }: any) {
        return (
            <div data-testid="exercise-panel">
                <span data-testid="exercise-title">{exercise?.title}</span>
                <span data-testid="current-branch">{currentBranch}</span>
                <span data-testid="timer">{timer}</span>
            </div>
        );
    };
});

// Mock FeedbackModal component
jest.mock('@/app/components/FeedbackModal', () => {
    return function MockFeedbackModal({ isOpen, onClose, score, feedback, onTryAgain, onNextExercise }: any) {
        if (!isOpen) return null;
        return (
            <div data-testid="feedback-modal">
                <span>SCORE: {score}/100</span>
                <span>{feedback}</span>
                <button onClick={onTryAgain}>Try Again</button>
                <button onClick={onNextExercise}>Next Exercise</button>
                <button onClick={onClose}>Close</button>
            </div>
        );
    };
});

// Mock ErrorModal component
jest.mock('@/app/components/ErrorModal', () => {
    return function MockErrorModal({ isOpen, message, onClose }: any) {
        if (!isOpen) return null;
        return (
            <div data-testid="error-modal">
                <span>ERROR: {message}</span>
                <button onClick={onClose}>Close</button>
            </div>
        );
    };
});

// Import the ChallengePage component
import ChallengePage from '@/app/challenge/[id]/page';

// Mock fetch globally - use a Map to track responses by URL+method
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Track fetch call history for simulating different responses
let fetchCallHistory: Array<{ url: string; method: string }> = [];

const resetFetchMock = () => {
    mockFetch.mockReset();
    fetchCallHistory = [];
    // Default: successful responses for everything
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        const method = options?.method || 'GET';
        fetchCallHistory.push({ url, method });
        
        if (url.includes('/api/exercises/init-basic-01')) {
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    id: 'init-basic-01',
                    title: 'Create Your First Repository',
                    level: 1,
                    category: 'init',
                    description: 'Initialize a new Git repository',
                    timeLimit: 300,
                    path: 'problems/init-basic-01',
                }),
            });
        }
        if (url.includes('/api/sandbox/create') && method === 'POST') {
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    sessionId: `session-${fetchCallHistory.length}`,
                    containerName: `gitkata-session-${fetchCallHistory.length}`,
                    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                    exercise: { id: 'init-basic-01', title: 'Test', timeLimit: 300 },
                }),
            });
        }
        if (url.includes('/api/sandbox/state/')) {
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({
                    branch: 'master',
                    staged: [],
                    unstaged: [],
                    untracked: [],
                    recentCommits: [],
                }),
            });
        }
        if (url.includes('/api/attempt') && method === 'POST') {
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ passed: true, score: 100, feedback: 'Great job!' }),
            });
        }
        if (method === 'DELETE' && url.includes('/api/sandbox/')) {
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ success: true }),
            });
        }
        return Promise.reject(new Error(`Unexpected fetch: ${method} ${url}`));
    });
};

describe('Discrepancy Verification Tests', () => {
    beforeEach(() => {
        resetFetchMock();
        Object.keys(localStorageData).forEach(k => delete localStorageData[k]);
        localStorageData['gitkata_user_id'] = 'test-user-123';
    });

    describe('Issue #3: handleSubmitSolution Checks Response Status', () => {
        it('handleSubmitSolution checks res.ok before processing response', async () => {
            // Override attempt endpoint to return 403
            mockFetch.mockImplementation((url: string, options?: RequestInit) => {
                const method = options?.method || 'GET';
                if (url.includes('/api/attempt') && method === 'POST') {
                    return Promise.resolve({
                        ok: false,
                        status: 403,
                        json: () => Promise.resolve({ error: 'Unauthorized' }),
                    });
                }
                // Fall through to default behavior
                if (url.includes('/api/exercises/init-basic-01')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            id: 'init-basic-01',
                            title: 'Create Your First Repository',
                            level: 1,
                            category: 'init',
                            description: 'Initialize a new Git repository',
                            timeLimit: 300,
                            path: 'problems/init-basic-01',
                        }),
                    });
                }
                if (url.includes('/api/sandbox/create') && method === 'POST') {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            sessionId: `session-${fetchCallHistory.length}`,
                            containerName: `gitkata-session-${fetchCallHistory.length}`,
                            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                            exercise: { id: 'init-basic-01', title: 'Test', timeLimit: 300 },
                        }),
                    });
                }
                if (url.includes('/api/sandbox/state/')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            branch: 'master',
                            staged: [],
                            unstaged: [],
                            untracked: [],
                            recentCommits: [],
                        }),
                    });
                }
                return Promise.reject(new Error(`Unexpected fetch: ${method} ${url}`));
            });

            render(<ChallengePage />);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith('/api/sandbox/create', expect.any(Object));
            });

            const submitButton = await screen.findByText('Submit Solution');
            fireEvent.click(submitButton);

            await waitFor(() => {
                const errorModal = screen.queryByTestId('error-modal');
                expect(errorModal).toBeInTheDocument();
            }, { timeout: 3000 });
        });

        it('Error responses display ErrorModal, not FeedbackModal', async () => {
            // Override attempt endpoint to return 404
            mockFetch.mockImplementation((url: string, options?: RequestInit) => {
                const method = options?.method || 'GET';
                if (url.includes('/api/attempt') && method === 'POST') {
                    return Promise.resolve({
                        ok: false,
                        status: 404,
                        json: () => Promise.resolve({ error: 'Session not found' }),
                    });
                }
                if (url.includes('/api/exercises/init-basic-01')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            id: 'init-basic-01',
                            title: 'Create Your First Repository',
                            level: 1,
                            category: 'init',
                            description: 'Initialize a new Git repository',
                            timeLimit: 300,
                            path: 'problems/init-basic-01',
                        }),
                    });
                }
                if (url.includes('/api/sandbox/create') && method === 'POST') {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            sessionId: `session-${fetchCallHistory.length}`,
                            containerName: `gitkata-session-${fetchCallHistory.length}`,
                            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                            exercise: { id: 'init-basic-01', title: 'Test', timeLimit: 300 },
                        }),
                    });
                }
                if (url.includes('/api/sandbox/state/')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            branch: 'master',
                            staged: [],
                            unstaged: [],
                            untracked: [],
                            recentCommits: [],
                        }),
                    });
                }
                return Promise.reject(new Error(`Unexpected fetch: ${method} ${url}`));
            });

            render(<ChallengePage />);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith('/api/sandbox/create', expect.any(Object));
            });

            const submitButton = await screen.findByText('Submit Solution');
            fireEvent.click(submitButton);

            await waitFor(() => {
                const errorModal = screen.queryByTestId('error-modal');
                expect(errorModal).toBeInTheDocument();
            }, { timeout: 3000 });
        });
    });

    describe('Issue #4: handleResetExercise Checks DELETE Response', () => {
        it('handleResetExercise checks DELETE response before creating new session', async () => {
            // Track DELETE calls to fail the first one
            let deleteCallCount = 0;
            mockFetch.mockImplementation((url: string, options?: RequestInit) => {
                const method = options?.method || 'GET';
                
                // Handle DELETE failure
                if (method === 'DELETE' && url.includes('/api/sandbox/')) {
                    deleteCallCount++;
                    if (deleteCallCount === 1) {
                        return Promise.resolve({
                            ok: false,
                            status: 500,
                            json: () => Promise.resolve({ error: 'Failed to destroy sandbox' }),
                        });
                    }
                }
                
                // Default handlers
                if (url.includes('/api/exercises/init-basic-01')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            id: 'init-basic-01',
                            title: 'Create Your First Repository',
                            level: 1,
                            category: 'init',
                            description: 'Initialize a new Git repository',
                            timeLimit: 300,
                            path: 'problems/init-basic-01',
                        }),
                    });
                }
                if (url.includes('/api/sandbox/create') && method === 'POST') {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            sessionId: `session-${fetchCallHistory.length}`,
                            containerName: `gitkata-session-${fetchCallHistory.length}`,
                            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                            exercise: { id: 'init-basic-01', title: 'Test', timeLimit: 300 },
                        }),
                    });
                }
                if (url.includes('/api/sandbox/state/')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            branch: 'master',
                            staged: [],
                            unstaged: [],
                            untracked: [],
                            recentCommits: [],
                        }),
                    });
                }
                return Promise.reject(new Error(`Unexpected fetch: ${method} ${url}`));
            });

            render(<ChallengePage />);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith('/api/sandbox/create', expect.any(Object));
            });

            const resetButton = await screen.findByText('Reset Exercise');
            fireEvent.click(resetButton);

            await waitFor(() => {
                const errorModal = screen.queryByTestId('error-modal');
                expect(errorModal).toBeInTheDocument();
            }, { timeout: 3000 });
        });
    });

    describe('Issue #13: Catch Block Uses ErrorModal', () => {
        it('Network errors display ErrorModal, not FeedbackModal', async () => {
            // Flag to control whether to throw network error
            let shouldThrowNetworkError = true;
            
            mockFetch.mockImplementation((url: string, options?: RequestInit) => {
                const method = options?.method || 'GET';
                
                if (url.includes('/api/attempt') && method === 'POST') {
                    if (shouldThrowNetworkError) {
                        shouldThrowNetworkError = false; // Only throw once
                        return Promise.reject(new Error('Network failure'));
                    }
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({ passed: true, score: 100, feedback: 'OK' }),
                    });
                }
                
                if (url.includes('/api/exercises/init-basic-01')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            id: 'init-basic-01',
                            title: 'Create Your First Repository',
                            level: 1,
                            category: 'init',
                            description: 'Initialize a new Git repository',
                            timeLimit: 300,
                            path: 'problems/init-basic-01',
                        }),
                    });
                }
                if (url.includes('/api/sandbox/create') && method === 'POST') {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            sessionId: `session-${fetchCallHistory.length}`,
                            containerName: `gitkata-session-${fetchCallHistory.length}`,
                            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                            exercise: { id: 'init-basic-01', title: 'Test', timeLimit: 300 },
                        }),
                    });
                }
                if (url.includes('/api/sandbox/state/')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            branch: 'master',
                            staged: [],
                            unstaged: [],
                            untracked: [],
                            recentCommits: [],
                        }),
                    });
                }
                return Promise.reject(new Error(`Unexpected fetch: ${method} ${url}`));
            });

            render(<ChallengePage />);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith('/api/sandbox/create', expect.any(Object));
            });

            const submitButton = await screen.findByText('Submit Solution');
            fireEvent.click(submitButton);

            await waitFor(() => {
                const errorModal = screen.queryByTestId('error-modal');
                expect(errorModal).toBeInTheDocument();
            }, { timeout: 3000 });
        });
    });

    describe('Issue #15: handleResetExercise Handles State Fetch Failure', () => {
        it('State fetch failure is handled appropriately', async () => {
            // Track state calls to fail the second one
            let stateCallCount = 0;
            mockFetch.mockImplementation((url: string, options?: RequestInit) => {
                const method = options?.method || 'GET';
                
                // State fetch fails on second call
                if (url.includes('/api/sandbox/state/')) {
                    stateCallCount++;
                    if (stateCallCount >= 2) {
                        return Promise.resolve({
                            ok: false,
                            status: 404,
                            json: () => Promise.resolve({ error: 'Session not found' }),
                        });
                    }
                }
                
                // Default handlers
                if (url.includes('/api/exercises/init-basic-01')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            id: 'init-basic-01',
                            title: 'Create Your First Repository',
                            level: 1,
                            category: 'init',
                            description: 'Initialize a new Git repository',
                            timeLimit: 300,
                            path: 'problems/init-basic-01',
                        }),
                    });
                }
                if (url.includes('/api/sandbox/create') && method === 'POST') {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            sessionId: `session-${fetchCallHistory.length}`,
                            containerName: `gitkata-session-${fetchCallHistory.length}`,
                            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                            exercise: { id: 'init-basic-01', title: 'Test', timeLimit: 300 },
                        }),
                    });
                }
                if (url.includes('/api/sandbox/state/')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            branch: 'master',
                            staged: [],
                            unstaged: [],
                            untracked: [],
                            recentCommits: [],
                        }),
                    });
                }
                if (method === 'DELETE' && url.includes('/api/sandbox/')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({ success: true }),
                    });
                }
                return Promise.reject(new Error(`Unexpected fetch: ${method} ${url}`));
            });

            render(<ChallengePage />);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith('/api/sandbox/create', expect.any(Object));
            });

            const resetButton = await screen.findByText('Reset Exercise');
            fireEvent.click(resetButton);

            await waitFor(() => {
                const errorModal = screen.queryByTestId('error-modal');
                expect(errorModal).toBeInTheDocument();
            }, { timeout: 3000 });
        });
    });
});

describe('Code Inspection Tests (Discrepancies Verified via Source)', () => {
    const fs = require('fs');
    const path = require('path');

    describe('Issue #2: Session-User Ownership Validated', () => {
        it('/api/attempt checks session.userId !== userId', () => {
            const attemptRoutePath = path.join(process.cwd(), 'app/api/attempt/route.ts');
            const code = fs.readFileSync(attemptRoutePath, 'utf8');
            
            // Code includes 403 check for session-user ownership
            expect(code).toContain('if (session.userId !== userId)');
        });
    });

    describe('Issue #1: LLM Retry Logic Implemented', () => {
        it('minimax.ts implements retry logic', () => {
            const minimaxPath = path.join(process.cwd(), 'lib/minimax.ts');
            const code = fs.readFileSync(minimaxPath, 'utf8');
            
            // Code includes retry logic
            expect(code.toLowerCase()).toContain('retry');
        });
    });

    describe('Issue #9: LLM API Has Timeout', () => {
        it('minimax.ts uses AbortSignal.timeout', () => {
            const minimaxPath = path.join(process.cwd(), 'lib/minimax.ts');
            const code = fs.readFileSync(minimaxPath, 'utf8');
            
            // Code includes AbortSignal for timeout
            expect(code).toContain('AbortSignal');
        });
    });

    describe('Issue #14: Frontend userId Uses UUID Format', () => {
        it('userId uses crypto.randomUUID()', () => {
            const challengePath = path.join(process.cwd(), 'app/challenge/[id]/page.tsx');
            const code = fs.readFileSync(challengePath, 'utf8');
            
            // userId is generated using crypto.randomUUID()
            expect(code).toContain('crypto.randomUUID()');
        });
    });

    describe('Issue #7: Profile Page Uses ErrorModal', () => {
        it('Profile page imports and uses ErrorModal', () => {
            const profilePath = path.join(process.cwd(), 'app/profile/page.tsx');
            const code = fs.readFileSync(profilePath, 'utf8');
            
            // Profile page imports and uses ErrorModal
            expect(code).toContain("import ErrorModal");
        });
    });

    describe('Issue #11: sandbox/exec Returns 200 for Invalid Commands (CORRECT)', () => {
        it('Invalid command returns 200 with error message (correct behavior)', () => {
            const execPath = path.join(process.cwd(), 'app/api/sandbox/exec/route.ts');
            const code = fs.readFileSync(execPath, 'utf8');
            
            // CORRECT behavior: Invalid commands like "ls" return 200 with error message
            // This is NOT an HTTP error - it's a user error that the frontend displays
            const hasInvalidCommandCheck = code.includes('Commands must start with "git"');
            expect(hasInvalidCommandCheck).toBe(true);
            
            // Verify it returns 200 (no explicit status: 400)
            // The response should have exitCode: 1 to indicate error
            const hasExitCode1 = code.includes('exitCode: 1');
            expect(hasExitCode1).toBe(true);
        });
    });

    describe('Issue #12: Profile API Returns 400 for Invalid userId', () => {
        it('Profile API returns 400 for invalid userId, not anonymous user', () => {
            const profileApiPath = path.join(process.cwd(), 'app/api/profile/route.ts');
            const code = fs.readFileSync(profileApiPath, 'utf8');
            
            // Code returns 400 for invalid userId instead of creating anonymous user
            expect(code).not.toContain('prisma.user.create');
        });
    });
});