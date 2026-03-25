'use client';

import React from 'react';
import ShortcutBadge from './shortcuts/ShortcutBadge';
import { useRegisterShortcutAction } from '@/app/context/KeyboardShortcutsContext';

interface ErrorModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message: string;
}

export default function ErrorModal({
    isOpen,
    onClose,
    title = 'ERROR',
    message,
}: ErrorModalProps) {
    useRegisterShortcutAction('error.close', {
        key: 'Esc',
        label: 'Close',
        view: 'ERROR',
        modifiers: [],
        action: onClose,
    });

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose} data-testid="error-modal">
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <span style={{ color: 'var(--error)' }}>{title}</span>
                    <button className="modal-close" onClick={onClose}>
                        ×
                    </button>
                </div>

                <div className="feedback-section" style={{ borderColor: 'var(--error)' }}>
                    <div className="feedback-content" style={{ color: 'var(--error)' }}>
                        {message}
                    </div>
                </div>

                <div className="modal-actions">
                    <button className="btn" onClick={onClose}>
                        Close<ShortcutBadge shortcut="esc" />
                    </button>
                </div>
            </div>
        </div>
    );
}