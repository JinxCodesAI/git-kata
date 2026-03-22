'use client';

import React, { useState } from 'react';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    score: number;
    feedback: string;
    exerciseId: string;
    onTryAgain: () => void;
    onNextExercise: () => void;
}

const PASS_ASCII = `
██████╗  █████╗ ███╗   ██╗
██╔══██╗██╔══██╗████╗  ██║
██║  ██║███████║██╔██╗ ██║
██║  ██║██╔══██║██║╚██╗██║
██████╔╝██║  ██║██║ ╚████║
╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝
`;

const FAIL_ASCII = `
██╗   ██╗ ██████╗ ██╗   ██╗
╚██╗ ██╔╝██╔═══██╗██║   ██║
 ╚████╔╝ ██║   ██║██║   ██║
  ╚██╔╝  ██║   ██║██║   ██║
   ██║   ╚██████╔╝╚██████╔╝
   ╚═╝    ╚═════╝  ╚═════╝
`;

const SOLUTION_ASCII = `
███████╗███████╗ █████╗ ██████╗ 
██╔════╝██╔════╝██╔══██╗██╔══██╗
█████╗  ███████╗███████║██║  ██║
██╔══╝  ╚════██║██╔══██║██║  ██║
███████╗███████║██║  ██║██████╔╝
╚══════╝╚══════╝╚═╝  ╚═╝╚═════╝ 
`;

export default function FeedbackModal({
    isOpen,
    onClose,
    score,
    feedback,
    exerciseId,
    onTryAgain,
    onNextExercise,
}: FeedbackModalProps) {
    const [viewSolution, setViewSolution] = useState(false);
    const [loadingSolution, setLoadingSolution] = useState(false);
    const [solutionHint, setSolutionHint] = useState<string>('');

    if (!isOpen) return null;

    const isPass = score >= 70;
    const asciiArt = viewSolution ? SOLUTION_ASCII : (isPass ? PASS_ASCII : FAIL_ASCII);

    const handleViewSolution = async () => {
        if (solutionHint) {
            // Already loaded, just show it
            setViewSolution(true);
            return;
        }

        setLoadingSolution(true);
        try {
            const res = await fetch(`/api/exercises/${exerciseId}/solution`);
            if (res.ok) {
                const data = await res.json();
                setSolutionHint(data.hint || 'No hint available for this exercise.');
                setViewSolution(true);
            } else {
                setSolutionHint('Failed to load solution hint.');
                setViewSolution(true);
            }
        } catch (error) {
            setSolutionHint('Failed to load solution hint.');
            setViewSolution(true);
        } finally {
            setLoadingSolution(false);
        }
    };

    const handleTryAgain = () => {
        setViewSolution(false);
        setSolutionHint('');
        onTryAgain();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <span>{viewSolution ? 'SOLUTION HINT' : 'EVALUATION RESULT'}</span>
                    <button className="modal-close" onClick={onClose}>
                        ×
                    </button>
                </div>

                <pre className="ascii-art">{asciiArt}</pre>

                {!viewSolution && (
                    <>
                        <div className="score-display">SCORE: {score}/100</div>

                        <div className="feedback-section">
                            <div className="feedback-label">FEEDBACK</div>
                            <div className="feedback-content">{feedback}</div>
                        </div>
                    </>
                )}

                {viewSolution && (
                    <div className="feedback-section">
                        <div className="feedback-label">HINT</div>
                        <div className="feedback-content">
                            {loadingSolution ? 'Loading...' : solutionHint}
                        </div>
                    </div>
                )}

                <div className="modal-actions">
                    {!viewSolution ? (
                        <>
                            <button className="btn" onClick={handleTryAgain}>
                                Try Again
                            </button>
                            <button className="btn" onClick={onNextExercise}>
                                Next Exercise
                            </button>
                            <button className="btn" onClick={handleViewSolution}>
                                View Solution
                            </button>
                        </>
                    ) : (
                        <>
                            <button className="btn" onClick={handleTryAgain}>
                                Try Again
                            </button>
                            <button className="btn" onClick={onNextExercise}>
                                Next Exercise
                            </button>
                            <button className="btn" onClick={() => {
                                setViewSolution(false);
                                setSolutionHint('');
                            }}>
                                Back to Feedback
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}