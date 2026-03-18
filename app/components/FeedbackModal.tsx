'use client';

import React from 'react';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    score: number;
    feedback: string;
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

export default function FeedbackModal({
    isOpen,
    onClose,
    score,
    feedback,
    onTryAgain,
    onNextExercise,
}: FeedbackModalProps) {
    if (!isOpen) return null;

    const isPass = score >= 70;
    const asciiArt = isPass ? PASS_ASCII : FAIL_ASCII;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <span>EVALUATION RESULT</span>
                    <button className="modal-close" onClick={onClose}>
                        ×
                    </button>
                </div>

                <pre className="ascii-art">{asciiArt}</pre>

                <div className="score-display">SCORE: {score}/100</div>

                <div className="feedback-section">
                    <div className="feedback-label">FEEDBACK</div>
                    <div className="feedback-content">{feedback}</div>
                </div>

                <div className="modal-actions">
                    <button className="btn" onClick={onTryAgain}>
                        Try Again
                    </button>
                    <button className="btn" onClick={onNextExercise}>
                        Next Exercise
                    </button>
                    <button className="btn" onClick={onClose}>
                        View Solution
                    </button>
                </div>
            </div>
        </div>
    );
}
