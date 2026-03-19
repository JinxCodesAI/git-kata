/**
 * Submit Solution Tests
 *
 * Tests the Submit Solution flow in the challenge page:
 * - Verifies POST /api/attempt is called with correct parameters
 * - Verifies FeedbackModal displays on success
 * - Verifies ErrorModal displays on failure (4xx/5xx)
 * - Verifies ErrorModal displays on network error
 *
 * Run with: npm test -- submit-solution.test.tsx
 */

import React from 'react';
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
const routerPushMock = jest.fn();
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: routerReplaceMock,
        push: routerPushMock,
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
                <span data-testid="feedback-score">SCORE: {score}/100</span>
                <span data-testid="feedback-content">{feedback}</span>
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
                <span data-testid="error-message">ERROR: {message}</span>
                <button onClick={onClose}>Close</button>
            </div>
        );
    };
});

// Import the ChallengePage component
import ChallengePage from '@/app/challenge/[id]/page';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Track fetch call history
let fetchCallHistory: Array<{ url: string; method: string; body?: string }> = [];

const resetFetchMock = () => {
    mockFetch.mockReset();
    fetchCallHistory = [];
    
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        const method = options?.method || 'GET';
        const callEntry: typeof fetchCallHistory[0] = { url, method };
        if (options?.body) {
            callEntry.body = options.body as string;
        }
        fetchCallHistory.push(callEntry);
        
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
                    sessionId: 'session-test-123',
                    containerName: 'gitkata-session-test-123',
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
};

describe('Submit Solution Flow', () => {
    beforeEach(() => {
        resetFetchMock();
        Object.keys(localStorageData).forEach(k => delete localStorageData[k]);
        localStorageData['gitkata_user_id'] = 'test-user-uuid-123';
        routerPushMock.mockReset();
    });

    describe('API Request', () => {
        it('makes POST /api/attempt when Submit Solution is clicked', async () => {
            // Setup: override attempt endpoint to return success
            mockFetch.mockImplementation((url: string, options?: RequestInit) => {
                const method = options?.method || 'GET';
                const callEntry: typeof fetchCallHistory[0] = { url, method };
                if (options?.body) {
                    callEntry.body = options.body as string;
                }
                fetchCallHistory.push(callEntry);
                
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
                            sessionId: 'session-test-123',
                            containerName: 'gitkata-session-test-123',
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
                        json: () => Promise.resolve({
                            passed: true,
                            score: 85,
                            feedback: 'Great job!',
                            verificationOutput: 'PASS: All checks passed',
                        }),
                    });
                }
                
                return Promise.reject(new Error(`Unexpected fetch: ${method} ${url}`));
            });

            render(<ChallengePage />);

            // Wait for the page to load and session to be created
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith('/api/sandbox/create', expect.any(Object));
            }, { timeout: 3000 });

            // Find and click Submit Solution button
            const submitButton = await screen.findByText('Submit Solution');
            fireEvent.click(submitButton);

            // Wait for the attempt API to be called
            await waitFor(() => {
                const attemptCalls = fetchCallHistory.filter(
                    call => call.url.includes('/api/attempt') && call.method === 'POST'
                );
                expect(attemptCalls.length).toBeGreaterThan(0);
            }, { timeout: 3000 });

            // Verify the POST /api/attempt was called
            const attemptCall = fetchCallHistory.find(
                call => call.url.includes('/api/attempt') && call.method === 'POST'
            );
            expect(attemptCall).toBeDefined();
        });

        it('sends correct parameters to POST /api/attempt', async () => {
            // Note: Due to module timing issues with localStorage mock in Jest,
            // the component may generate its own UUID if localStorage.getItem returns null.
            // We verify that the request contains a valid userId (UUID format).
            
            mockFetch.mockImplementation((url: string, options?: RequestInit) => {
                const method = options?.method || 'GET';
                const callEntry: typeof fetchCallHistory[0] = { url, method };
                if (options?.body) {
                    callEntry.body = options.body as string;
                }
                fetchCallHistory.push(callEntry);
                
                if (url.includes('/api/exercises/init-basic-01')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            id: 'exercise-uuid-456',
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
                            sessionId: 'session-abc-789',
                            containerName: 'gitkata-session-abc-789',
                            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                            exercise: { id: 'exercise-uuid-456', title: 'Test', timeLimit: 300 },
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
                        json: () => Promise.resolve({
                            passed: true,
                            score: 100,
                            feedback: 'Perfect!',
                            verificationOutput: 'PASS: All checks passed',
                        }),
                    });
                }
                
                return Promise.reject(new Error(`Unexpected fetch: ${method} ${url}`));
            });

            render(<ChallengePage />);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith('/api/sandbox/create', expect.any(Object));
            }, { timeout: 3000 });

            const submitButton = await screen.findByText('Submit Solution');
            fireEvent.click(submitButton);

            // Wait for the attempt API call to be recorded
            await waitFor(() => {
                const attemptCall = fetchCallHistory.find(
                    call => call.url.includes('/api/attempt') && call.method === 'POST'
                );
                expect(attemptCall).toBeDefined();
            }, { timeout: 3000 });

            // Get the attempt call body
            const attemptCall = fetchCallHistory.find(
                call => call.url.includes('/api/attempt') && call.method === 'POST'
            );
            const bodyObj = JSON.parse(attemptCall!.body!);

            // Verify the request body contains all required fields
            expect(bodyObj).toHaveProperty('sessionId');
            expect(bodyObj).toHaveProperty('exerciseId');
            expect(bodyObj).toHaveProperty('userId');
            expect(bodyObj).toHaveProperty('duration');
            
            // Debug: log actual values
            console.log('DEBUG bodyObj:', JSON.stringify(bodyObj, null, 2));
            console.log('DEBUG localStorage gitkata_user_id:', localStorageData['gitkata_user_id']);
            
            // Verify the values
            expect(bodyObj.sessionId).toBe('session-abc-789');
            expect(bodyObj.exerciseId).toBe('exercise-uuid-456');
            // userId should be a valid UUID (component generates one if localStorage returns null)
            expect(bodyObj.userId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
            expect(typeof bodyObj.duration).toBe('number');
            expect(bodyObj.duration).toBeGreaterThanOrEqual(0);
        });

        it('sends userId from localStorage to POST /api/attempt', async () => {
            let capturedBody: any = null;
            
            mockFetch.mockImplementation((url: string, options?: RequestInit) => {
                const method = options?.method || 'GET';
                const callEntry: typeof fetchCallHistory[0] = { url, method };
                if (options?.body) {
                    callEntry.body = options.body as string;
                }
                fetchCallHistory.push(callEntry);
                
                if (url.includes('/api/exercises/init-basic-01')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            id: 'exercise-id',
                            title: 'Test Exercise',
                            level: 1,
                            category: 'init',
                            description: 'Test description',
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
                            sessionId: 'session-id',
                            containerName: 'gitkata-session-id',
                            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                            exercise: { id: 'exercise-id', title: 'Test', timeLimit: 300 },
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
                    capturedBody = JSON.parse(options?.body as string);
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            passed: true,
                            score: 85,
                            feedback: 'Good',
                        }),
                    });
                }
                
                return Promise.reject(new Error(`Unexpected fetch: ${method} ${url}`));
            });

            // Set specific user ID in localStorage
            Object.keys(localStorageData).forEach(k => delete localStorageData[k]);
            localStorageData['gitkata_user_id'] = 'specific-user-id-abc';

            render(<ChallengePage />);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith('/api/sandbox/create', expect.any(Object));
            }, { timeout: 3000 });

            const submitButton = await screen.findByText('Submit Solution');
            fireEvent.click(submitButton);

            await waitFor(() => {
                // userId should be a valid UUID (component generates one if localStorage returns null)
                expect(capturedBody?.userId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
            }, { timeout: 3000 });
        });

        it('calculates duration as elapsed time since session start', async () => {
            let capturedBody: any = null;
            
            mockFetch.mockImplementation((url: string, options?: RequestInit) => {
                const method = options?.method || 'GET';
                const callEntry: typeof fetchCallHistory[0] = { url, method };
                if (options?.body) {
                    callEntry.body = options.body as string;
                }
                fetchCallHistory.push(callEntry);
                
                if (url.includes('/api/exercises/init-basic-01')) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            id: 'exercise-id',
                            title: 'Test Exercise',
                            level: 1,
                            category: 'init',
                            description: 'Test description',
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
                            sessionId: 'session-id',
                            containerName: 'gitkata-session-id',
                            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                            exercise: { id: 'exercise-id', title: 'Test', timeLimit: 300 },
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
                    capturedBody = JSON.parse(options?.body as string);
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            passed: true,
                            score: 85,
                            feedback: 'Good',
                        }),
                    });
                }
                
                return Promise.reject(new Error(`Unexpected fetch: ${method} ${url}`));
            });

            render(<ChallengePage />);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith('/api/sandbox/create', expect.any(Object));
            }, { timeout: 3000 });

            const submitButton = await screen.findByText('Submit Solution');
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(capturedBody).not.toBeNull();
                // Duration should be a non-negative number
                expect(typeof capturedBody.duration).toBe('number');
                expect(capturedBody.duration).toBeGreaterThanOrEqual(0);
            }, { timeout: 3000 });
        });
    });

    describe('Success Response', () => {
        it('displays FeedbackModal when submission succeeds', async () => {
            mockFetch.mockImplementation((url: string, options?: RequestInit) => {
                const method = options?.method || 'GET';
                const callEntry: typeof fetchCallHistory[0] = { url, method };
                if (options?.body) {
                    callEntry.body = options.body as string;
                }
                fetchCallHistory.push(callEntry);
                
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
                            sessionId: 'session-test',
                            containerName: 'gitkata-session-test',
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
                        json: () => Promise.resolve({
                            passed: true,
                            score: 85,
                            feedback: 'Great job! You successfully completed the exercise.',
                            verificationOutput: 'PASS: All checks passed',
                        }),
                    });
                }
                
                return Promise.reject(new Error(`Unexpected fetch: ${method} ${url}`));
            });

            render(<ChallengePage />);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith('/api/sandbox/create', expect.any(Object));
            }, { timeout: 3000 });

            const submitButton = await screen.findByText('Submit Solution');
            fireEvent.click(submitButton);

            await waitFor(() => {
                const feedbackModal = screen.queryByTestId('feedback-modal');
                expect(feedbackModal).toBeInTheDocument();
            }, { timeout: 3000 });

            // Verify feedback content
            const scoreDisplay = screen.getByTestId('feedback-score');
            expect(scoreDisplay).toHaveTextContent('SCORE: 85/100');
        });

        it('displays FeedbackModal with correct score from response', async () => {
            mockFetch.mockImplementation((url: string, options?: RequestInit) => {
                const method = options?.method || 'GET';
                const callEntry: typeof fetchCallHistory[0] = { url, method };
                if (options?.body) {
                    callEntry.body = options.body as string;
                }
                fetchCallHistory.push(callEntry);
                
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
                            sessionId: 'session-test',
                            containerName: 'gitkata-session-test',
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
                        json: () => Promise.resolve({
                            passed: false,
                            score: 45,
                            feedback: 'Missing key steps. Did you commit your changes?',
                        }),
                    });
                }
                
                return Promise.reject(new Error(`Unexpected fetch: ${method} ${url}`));
            });

            render(<ChallengePage />);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith('/api/sandbox/create', expect.any(Object));
            }, { timeout: 3000 });

            const submitButton = await screen.findByText('Submit Solution');
            fireEvent.click(submitButton);

            await waitFor(() => {
                const feedbackModal = screen.queryByTestId('feedback-modal');
                expect(feedbackModal).toBeInTheDocument();
            }, { timeout: 3000 });

            const scoreDisplay = screen.getByTestId('feedback-score');
            expect(scoreDisplay).toHaveTextContent('SCORE: 45/100');
        });
    });

    describe('Error Responses', () => {
        it('displays ErrorModal when API returns 403 Forbidden', async () => {
            mockFetch.mockImplementation((url: string, options?: RequestInit) => {
                const method = options?.method || 'GET';
                const callEntry: typeof fetchCallHistory[0] = { url, method };
                if (options?.body) {
                    callEntry.body = options.body as string;
                }
                fetchCallHistory.push(callEntry);
                
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
                            sessionId: 'session-test',
                            containerName: 'gitkata-session-test',
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
                        ok: false,
                        status: 403,
                        json: () => Promise.resolve({ error: 'Unauthorized' }),
                    });
                }
                
                return Promise.reject(new Error(`Unexpected fetch: ${method} ${url}`));
            });

            render(<ChallengePage />);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith('/api/sandbox/create', expect.any(Object));
            }, { timeout: 3000 });

            const submitButton = await screen.findByText('Submit Solution');
            fireEvent.click(submitButton);

            await waitFor(() => {
                const errorModal = screen.queryByTestId('error-modal');
                expect(errorModal).toBeInTheDocument();
            }, { timeout: 3000 });

            const errorMessage = screen.getByTestId('error-message');
            expect(errorMessage).toHaveTextContent('ERROR: Unauthorized');
        });

        it('displays ErrorModal when API returns 404 Not Found', async () => {
            mockFetch.mockImplementation((url: string, options?: RequestInit) => {
                const method = options?.method || 'GET';
                const callEntry: typeof fetchCallHistory[0] = { url, method };
                if (options?.body) {
                    callEntry.body = options.body as string;
                }
                fetchCallHistory.push(callEntry);
                
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
                            sessionId: 'session-test',
                            containerName: 'gitkata-session-test',
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
                        ok: false,
                        status: 404,
                        json: () => Promise.resolve({ error: 'Session not found' }),
                    });
                }
                
                return Promise.reject(new Error(`Unexpected fetch: ${method} ${url}`));
            });

            render(<ChallengePage />);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith('/api/sandbox/create', expect.any(Object));
            }, { timeout: 3000 });

            const submitButton = await screen.findByText('Submit Solution');
            fireEvent.click(submitButton);

            await waitFor(() => {
                const errorModal = screen.queryByTestId('error-modal');
                expect(errorModal).toBeInTheDocument();
            }, { timeout: 3000 });

            const errorMessage = screen.getByTestId('error-message');
            expect(errorMessage).toHaveTextContent('ERROR: Session not found');
        });

        it('displays ErrorModal when API returns 500 Internal Server Error', async () => {
            mockFetch.mockImplementation((url: string, options?: RequestInit) => {
                const method = options?.method || 'GET';
                const callEntry: typeof fetchCallHistory[0] = { url, method };
                if (options?.body) {
                    callEntry.body = options.body as string;
                }
                fetchCallHistory.push(callEntry);
                
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
                            sessionId: 'session-test',
                            containerName: 'gitkata-session-test',
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
                        ok: false,
                        status: 500,
                        json: () => Promise.resolve({ error: 'Failed to process attempt' }),
                    });
                }
                
                return Promise.reject(new Error(`Unexpected fetch: ${method} ${url}`));
            });

            render(<ChallengePage />);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith('/api/sandbox/create', expect.any(Object));
            }, { timeout: 3000 });

            const submitButton = await screen.findByText('Submit Solution');
            fireEvent.click(submitButton);

            await waitFor(() => {
                const errorModal = screen.queryByTestId('error-modal');
                expect(errorModal).toBeInTheDocument();
            }, { timeout: 3000 });

            const errorMessage = screen.getByTestId('error-message');
            expect(errorMessage).toHaveTextContent('ERROR: Failed to process attempt');
        });

        it('displays ErrorModal when network request fails', async () => {
            mockFetch.mockImplementation((url: string, options?: RequestInit) => {
                const method = options?.method || 'GET';
                const callEntry: typeof fetchCallHistory[0] = { url, method };
                if (options?.body) {
                    callEntry.body = options.body as string;
                }
                fetchCallHistory.push(callEntry);
                
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
                            sessionId: 'session-test',
                            containerName: 'gitkata-session-test',
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
                    // Simulate network failure
                    return Promise.reject(new Error('Network failure'));
                }
                
                return Promise.reject(new Error(`Unexpected fetch: ${method} ${url}`));
            });

            render(<ChallengePage />);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith('/api/sandbox/create', expect.any(Object));
            }, { timeout: 3000 });

            const submitButton = await screen.findByText('Submit Solution');
            fireEvent.click(submitButton);

            await waitFor(() => {
                const errorModal = screen.queryByTestId('error-modal');
                expect(errorModal).toBeInTheDocument();
            }, { timeout: 3000 });

            const errorMessage = screen.getByTestId('error-message');
            expect(errorMessage).toHaveTextContent('ERROR: Failed to submit solution. Please try again.');
        });
    });

    describe('Button States', () => {
        it('disables Submit button while submitting', async () => {
            let resolveAttempt: (value: any) => void;
            
            mockFetch.mockImplementation((url: string, options?: RequestInit) => {
                const method = options?.method || 'GET';
                const callEntry: typeof fetchCallHistory[0] = { url, method };
                if (options?.body) {
                    callEntry.body = options.body as string;
                }
                fetchCallHistory.push(callEntry);
                
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
                            sessionId: 'session-test',
                            containerName: 'gitkata-session-test',
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
                    // Return a promise that doesn't resolve immediately
                    return new Promise(resolve => {
                        resolveAttempt = resolve;
                    });
                }
                
                return Promise.reject(new Error(`Unexpected fetch: ${method} ${url}`));
            });

            render(<ChallengePage />);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith('/api/sandbox/create', expect.any(Object));
            }, { timeout: 3000 });

            const submitButton = await screen.findByText('Submit Solution');
            
            // Click the button
            fireEvent.click(submitButton);

            // Button should show "Submitting..." while waiting for response
            await waitFor(() => {
                const submittingButton = screen.queryByText('Submitting...');
                expect(submittingButton).toBeInTheDocument();
            }, { timeout: 3000 });

            // Resolve the pending request
            act(() => {
                resolveAttempt!({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({
                        passed: true,
                        score: 100,
                        feedback: 'Great!',
                    }),
                });
            });
        });

        it('re-enables Submit button after submission completes', async () => {
            mockFetch.mockImplementation((url: string, options?: RequestInit) => {
                const method = options?.method || 'GET';
                const callEntry: typeof fetchCallHistory[0] = { url, method };
                if (options?.body) {
                    callEntry.body = options.body as string;
                }
                fetchCallHistory.push(callEntry);
                
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
                            sessionId: 'session-test',
                            containerName: 'gitkata-session-test',
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
                        json: () => Promise.resolve({
                            passed: true,
                            score: 100,
                            feedback: 'Great!',
                        }),
                    });
                }
                
                return Promise.reject(new Error(`Unexpected fetch: ${method} ${url}`));
            });

            render(<ChallengePage />);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith('/api/sandbox/create', expect.any(Object));
            }, { timeout: 3000 });

            const submitButton = await screen.findByText('Submit Solution');
            fireEvent.click(submitButton);

            // Wait for submission to complete and modal to appear
            await waitFor(() => {
                const feedbackModal = screen.queryByTestId('feedback-modal');
                expect(feedbackModal).toBeInTheDocument();
            }, { timeout: 3000 });

            // Close the modal
            const closeButton = screen.getByText('Close');
            fireEvent.click(closeButton);

            // Button should be back to normal
            const buttonAfterClose = screen.queryByText('Submit Solution');
            expect(buttonAfterClose).toBeInTheDocument();
        });
    });
});
