'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Exercise {
    title: string;
    level: number;
    description: string;
    timeLimit: number;
    initialBranch: string | null;
}

interface ExercisePanelProps {
    exercise: Exercise;
    currentBranch?: string;
    timer?: string;
}

export default function ExercisePanel({
    exercise,
    currentBranch,
    timer,
}: ExercisePanelProps) {
    const getLevelName = (level: number): string => {
        const levels: Record<number, string> = {
            1: 'Beginner',
            2: 'Intermediate',
            3: 'Advanced',
            4: 'Expert',
        };
        return levels[level] || 'Unknown';
    };

    const formatTimeLimit = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        return `${mins} min`;
    };

    return (
        <div className="exercise-panel">
            <h2 className="exercise-title">{exercise.title}</h2>
            
            <div className="exercise-meta">
                <span>Level: {exercise.level} ({getLevelName(exercise.level)})</span>
                <span> | </span>
                <span>Time: {formatTimeLimit(exercise.timeLimit)}</span>
                {timer && (
                    <>
                        <span> | </span>
                        <span className="timer">{timer}</span>
                    </>
                )}
            </div>

            {currentBranch && (
                <div className="exercise-meta">
                    <span>Current branch: </span>
                    <strong>{currentBranch}</strong>
                </div>
            )}

            <div className="exercise-description">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {exercise.description}
                </ReactMarkdown>
            </div>
        </div>
    );
}
