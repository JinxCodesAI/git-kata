// app/components/shortcuts/ShortcutBadge.tsx

'use client';

import React from 'react';
import { useKeyboardShortcuts } from '@/app/context/KeyboardShortcutsContext';

interface ShortcutBadgeProps {
    shortcut: string;
    className?: string;
}

/**
 * Renders a keyboard shortcut badge like [⌘S] or [S]
 * Only visible when keyboard shortcuts are enabled
 * Displays keys in uppercase for visual clarity
 */
export default function ShortcutBadge({ shortcut, className = '' }: ShortcutBadgeProps) {
    const { isEnabled, modKey } = useKeyboardShortcuts();

    if (!isEnabled) return null;

    // Handle special keys
    const displayKey = shortcut.toUpperCase();

    return (
        <span className={`shortcut-badge ${className}`} style={{ textTransform: 'uppercase' }}>
            [{displayKey}]
        </span>
    );
}