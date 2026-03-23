'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ExercisePanel from '@/app/components/ExercisePanel';
import FeedbackModal from '@/app/components/FeedbackModal';
import ErrorModal from '@/app/components/ErrorModal';

interface HistoryEntry {
    command: string;
    output: string;
}

interface Exercise {
    id: string;
    title: string;
    level: number;
    description: string;
    timeLimit: number;
    initialBranch: string | null;
}

interface SandboxSession {
    sessionId: string;
    containerName: string;
    exercise: Exercise;
}

interface EvaluationResult {
    passed: boolean;
    score: number;
    feedback: string;
    verificationOutput?: string;
}

// Map level names to level numbers
const LEVEL_NAME_TO_NUMBER: Record<string, number> = {
    'beginner': 1,
    'intermediate': 2,
    'advanced': 3,
    'expert': 4,
};

export default function ChallengePage() {
    const params = useParams();
    const router = useRouter();
    const exerciseId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [exercise, setExercise] = useState<Exercise | null>(null);
    const [session, setSession] = useState<SandboxSession | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [input, setInput] = useState('');
    const [timeRemaining, setTimeRemaining] = useState<number>(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    const [feedback, setFeedback] = useState<EvaluationResult | null>(null);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [currentBranch, setCurrentBranch] = useState<string | null>(null);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);
    const outputRef = useRef<HTMLDivElement>(null);

    // Fetch exercise and initialize session
    useEffect(() => {
        const abortController = new AbortController();

        const initSession = async () => {
            try {
                setLoading(true);
                setError(null);

                // Check if exerciseId is a level name (beginner/intermediate/advanced/expert)
                const levelNumber = LEVEL_NAME_TO_NUMBER[exerciseId];
                let actualExerciseId = exerciseId;

                if (levelNumber) {
                    // It's a level name - fetch a random exercise of that level
                    const exerciseRes = await fetch(`/api/exercises?level=${levelNumber}`, {
                        signal: abortController.signal,
                    });
                    if (abortController.signal.aborted) return;
                    if (!exerciseRes.ok) {
                        throw new Error('Failed to load exercises for this level');
                    }
                    const exercises = await exerciseRes.json();
                    if (abortController.signal.aborted) return;
                    if (exercises.length === 0) {
                        throw new Error('No exercises found for this level');
                    }
                    // Pick a random exercise
                    const randomIndex = Math.floor(Math.random() * exercises.length);
                    actualExerciseId = exercises[randomIndex].id;
                    // Redirect to the actual exercise
                    router.replace(`/challenge/${actualExerciseId}`);
                    return;
                }

                // Fetch exercise from API
                const exerciseRes = await fetch(`/api/exercises/${actualExerciseId}`, {
                    signal: abortController.signal,
                });
                if (abortController.signal.aborted) return;
                if (!exerciseRes.ok) {
                    throw new Error('Failed to load exercise');
                }
                const exerciseData = await exerciseRes.json();
                if (abortController.signal.aborted) return;
                setExercise(exerciseData);
                setTimeRemaining(exerciseData.timeLimit);

                // Get or create user ID
                let userId = localStorage.getItem('gitkata_user_id');
                if (!userId) {
                    userId = crypto.randomUUID();
                    localStorage.setItem('gitkata_user_id', userId);
                }

                // Create sandbox session
                const sandboxRes = await fetch('/api/sandbox/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ exerciseId: actualExerciseId, userId }),
                    signal: abortController.signal,
                });
                if (abortController.signal.aborted) return;

                if (!sandboxRes.ok) {
                    throw new Error('Failed to create sandbox session');
                }
                const sessionData = await sandboxRes.json();
                if (abortController.signal.aborted) return;
                setSession(sessionData);
                startTimeRef.current = Date.now();

                // Get initial branch
                const stateRes = await fetch(`/api/sandbox/state/${sessionData.sessionId}?userId=${userId}`, {
                    signal: abortController.signal,
                });
                if (abortController.signal.aborted) return;
                if (stateRes.ok) {
                    const stateData = await stateRes.json();
                    if (!abortController.signal.aborted) {
                        setCurrentBranch(stateData.branch);
                    }
                } else {
                    // State endpoint failed - show error modal
                    const errorData = await stateRes.json().catch(() => ({}));
                    setErrorMessage(errorData.error || `Failed to load state (${stateRes.status})`);
                    setShowErrorModal(true);
                }

            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') return;
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                if (!abortController.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        if (exerciseId) {
            initSession();
        }

        return () => {
            abortController.abort();
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [exerciseId]);

    // Timer countdown
    useEffect(() => {
        if (!loading && timeRemaining > 0) {
            timerRef.current = setInterval(() => {
                setTimeRemaining((prev) => {
                    if (prev <= 1) {
                        if (timerRef.current) clearInterval(timerRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [loading]);

    // Auto-scroll terminal output
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [history]);

    // Execute command
    const executeCommand = async (command: string) => {
        if (!session) return;

        const userId = localStorage.getItem('gitkata_user_id');
        try {
            const res = await fetch('/api/sandbox/exec', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: session.sessionId, command, userId }),
            });

            const data = await res.json();

            // Check if the request was successful
            if (!res.ok) {
                // Show error feedback in ErrorModal - do NOT add command to history
                setErrorMessage(data.error || `Command failed with status ${res.status}`);
                setShowErrorModal(true);
                return;
            }

            const output = data.output || '';

            // Only add to history if command was successful
            setHistory((prev) => [...prev, { command, output }]);

            // Update current branch if command was git checkout or git switch
            if (command.startsWith('git checkout') || command.startsWith('git switch')) {
                const branchMatch = output.match(/Switched to branch '([^']+)'/);
                if (branchMatch) {
                    setCurrentBranch(branchMatch[1]);
                }
                // Also try to refetch branch
                const userId = localStorage.getItem('gitkata_user_id');
                const stateRes = await fetch(`/api/sandbox/state/${session.sessionId}?userId=${userId}`);
                if (stateRes.ok) {
                    const stateData = await stateRes.json();
                    setCurrentBranch(stateData.branch);
                }
            }

        } catch (err) {
            // Show error in ErrorModal - do NOT add command to history
            setErrorMessage('Failed to execute command. Please check your connection.');
            setShowErrorModal(true);
        }
    };

    // Handle form submission
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const command = input.trim();
        setInput('');
        executeCommand(command);
    };

    // Handle keyboard in terminal
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && input.trim()) {
            const command = input.trim();
            setInput('');
            executeCommand(command);
        }
    };

    // Submit solution
    const handleSubmitSolution = async () => {
        console.log('[FRONTEND] handleSubmitSolution called');
        console.log('[FRONTEND] session:', session);
        console.log('[FRONTEND] exercise:', exercise);
        if (!session || !exercise) {
            console.log('[FRONTEND] Early return - session or exercise is null');
            return;
        }

        setIsSubmitting(true);
        try {
            const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
            const userId = localStorage.getItem('gitkata_user_id');
            console.log('[FRONTEND] Submitting with:', { sessionId: session.sessionId, exerciseId: exercise.id, userId, duration });

            const res = await fetch('/api/attempt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: session.sessionId,
                    exerciseId: exercise.id,
                    userId: userId,
                    duration,
                }),
            });
            console.log('[FRONTEND] Response status:', res.status);

            if (!res.ok) {
                const data = await res.json();
                console.log('[FRONTEND] Error response:', data);
                setErrorMessage(data.error || 'An error occurred');
                setShowErrorModal(true);
            } else {
                const data = await res.json();
                console.log('[FRONTEND] Success response:', data);
                setFeedback(data);
                setShowFeedback(true);
            }
        } catch (err) {
            console.error('[FRONTEND] Catch error:', err);
            setErrorMessage('Failed to submit solution. Please try again.');
            setShowErrorModal(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Reset exercise
    const handleResetExercise = async () => {
        if (!session || !exercise) return;

        try {
            const userId = localStorage.getItem('gitkata_user_id');
            // Destroy current session
            const deleteRes = await fetch(`/api/sandbox/${session.sessionId}?userId=${userId}`, { method: 'DELETE' });

            if (!deleteRes.ok) {
                const errorData = await deleteRes.json().catch(() => ({}));
                setErrorMessage(errorData.error || 'Failed to destroy sandbox');
                setShowErrorModal(true);
                return;
            }

            // Create new session
            const sandboxRes = await fetch('/api/sandbox/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ exerciseId: exercise.id, userId }),
            });

            if (!sandboxRes.ok) {
                throw new Error('Failed to reset exercise');
            }

            const sessionData = await sandboxRes.json();
            setSession(sessionData);
            setHistory([]);
            setTimeRemaining(exercise.timeLimit);
            startTimeRef.current = Date.now();

            // Get initial branch
            const stateRes = await fetch(`/api/sandbox/state/${sessionData.sessionId}?userId=${userId}`);
            if (stateRes.ok) {
                const stateData = await stateRes.json();
                setCurrentBranch(stateData.branch);
            } else {
                const errorData = await stateRes.json().catch(() => ({}));
                setErrorMessage(errorData.error || `Failed to load state (${stateRes.status})`);
                setShowErrorModal(true);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to reset exercise');
        }
    };

    // Skip exercise
    const handleSkipExercise = () => {
        router.push('/');
    };

    // Close feedback modal
    const handleCloseFeedback = () => {
        setShowFeedback(false);
        if (feedback?.passed) {
            router.push('/');
        }
    };

    // Format time remaining
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="app-container">
                <div className="terminal-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                        <p>Loading exercise...</p>
                        <p className="text-dim">Initializing sandbox environment</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="app-container">
                <nav className="navbar">
                    <Link href="/" className="navbar-logo">GIT-KATA</Link>
                </nav>
                <div className="terminal-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ color: 'var(--error)' }}>Error: {error}</p>
                        <button className="btn" onClick={() => router.push('/')}>
                            Return Home
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!exercise || !session) {
        return null;
    }

    const elapsed = exercise.timeLimit - timeRemaining;
    const elapsedMins = Math.floor(elapsed / 60);
    const elapsedSecs = elapsed % 60;

    return (
        <div className="app-container">
            <nav className="navbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Link href="/" className="navbar-logo">GIT-KATA</Link>
                    <span style={{ color: 'var(--text-dim)' }}>&gt;</span>
                    <span style={{ color: 'var(--text-dim)' }}>challenge</span>
                    <span style={{ color: 'var(--text-dim)' }}>&gt;</span>
                    <span>{exercise.title}</span>
                </div>
                <Link href="/" className="navbar-link">
                    Exit
                </Link>
            </nav>

            <main className="main-content">
                <ExercisePanel
                    exercise={exercise}
                    currentBranch={currentBranch || undefined}
                    timer={`${formatTime(elapsed)} / ${formatTime(exercise.timeLimit)}`}
                />

                <div className="terminal-container" style={{ flex: 1, marginTop: 0 }}>
                    <div className="terminal-output" ref={outputRef}>
                        {history.length === 0 ? (
                            <div style={{ color: 'var(--text-dim)' }}>
                                <p>Terminal ready. Start typing git commands...</p>
                                <p className="text-dim">Hint: All commands must start with &quot;git&quot;</p>
                            </div>
                        ) : (
                            history.map((entry, index) => (
                                <div key={index}>
                                    <p className="terminal-line command">
                                        <span className="terminal-prompt">$</span> {entry.command}
                                    </p>
                                    {entry.output && (
                                        <p className="terminal-line output">{entry.output}</p>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                    <form className="terminal-input-container" onSubmit={handleSubmit}>
                        <span className="terminal-prompt">$</span>
                        <input
                            type="text"
                            className="terminal-input"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="git command..."
                            autoFocus
                            spellCheck={false}
                            autoComplete="off"
                        />
                    </form>
                </div>

                <div className="action-buttons" style={{
                    display: 'flex',
                    gap: '1rem',
                    padding: '1rem',
                    borderTop: '1px solid var(--border-dim)',
                    background: 'var(--bg-secondary)',
                }}>
                    <button
                        className="btn btn-primary"
                        onClick={handleSubmitSolution}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Solution'}
                    </button>
                    <button className="btn" onClick={handleResetExercise}>
                        Reset Exercise
                    </button>
                    <button className="btn" onClick={handleSkipExercise}>
                        Skip
                    </button>
                </div>
            </main>

            {feedback && (
                <FeedbackModal
                    isOpen={showFeedback}
                    onClose={handleCloseFeedback}
                    score={feedback.score}
                    feedback={feedback.feedback}
                    exerciseId={exercise.id}
                    onTryAgain={() => {
                        setShowFeedback(false);
                        handleResetExercise();
                    }}
                    onNextExercise={async () => {
                        setShowFeedback(false);
                        try {
                            const res = await fetch(`/api/exercises?level=${exercise.level}`);
                            if (!res.ok) throw new Error('Failed to fetch exercises');
                            const exercises = await res.json();
                            
                            const otherExercises = exercises.filter((e: Exercise) => e.id !== exercise.id);
                            if (otherExercises.length === 0) {
                                router.push('/');
                                return;
                            }
                            const randomIndex = Math.floor(Math.random() * otherExercises.length);
                            router.push(`/challenge/${otherExercises[randomIndex].id}`);
                        } catch (err) {
                            console.error('Error fetching next exercise:', err);
                            router.push('/');
                        }
                    }}
                />
            )}

            <ErrorModal
                isOpen={showErrorModal}
                onClose={() => setShowErrorModal(false)}
                message={errorMessage}
            />
        </div>
    );
}
