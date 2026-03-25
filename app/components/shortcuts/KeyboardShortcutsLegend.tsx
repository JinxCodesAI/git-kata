// app/components/shortcuts/KeyboardShortcutsLegend.tsx

'use client';

import React, { useMemo } from 'react';
import { useKeyboardShortcuts, ShortcutAction } from '@/app/context/KeyboardShortcutsContext';

interface GroupedShortcuts {
    view: string;
    shortcuts: ShortcutAction[];
}

const GLOBAL_SHORTCUTS: ShortcutAction[] = [
    { key: 'Escape', label: 'Close / Cancel', view: 'GLOBAL', modifiers: [], action: () => {} },
    { key: 'h', label: 'Go Home', view: 'GLOBAL', modifiers: [], action: () => {} },
    { key: 'p', label: 'Profile', view: 'GLOBAL', modifiers: [], action: () => {} },
    { key: 'l', label: 'Leaderboard', view: 'GLOBAL', modifiers: [], action: () => {} },
];

/**
 * Fixed bottom-right overlay showing keyboard shortcuts status
 * Always visible to show toggle state
 */
export default function KeyboardShortcutsLegend() {
    const { isEnabled, modKey, registeredActions } = useKeyboardShortcuts();

    // Group shortcuts by view (only when enabled)
    const groupedShortcuts = useMemo(() => {
        if (!isEnabled) return [];

        const groups: Map<string, ShortcutAction[]> = new Map();

        // Add global shortcuts
        groups.set('GLOBAL', GLOBAL_SHORTCUTS);

        // Group registered actions by view
        registeredActions.forEach((action) => {
            const view = action.view;
            if (!groups.has(view)) {
                groups.set(view, []);
            }
            groups.get(view)!.push(action);
        });

        // Convert to array format
        const result: GroupedShortcuts[] = [];
        groups.forEach((shortcuts, view) => {
            if (shortcuts.length > 0) {
                result.push({ view, shortcuts });
            }
        });

        return result;
    }, [isEnabled, registeredActions]);

    const formatKey = (shortcut: ShortcutAction): string => {
        return shortcut.key.toUpperCase();
    };

    return (
        <>
            {isEnabled && (
                <div className="shortcuts-legend">
                    <div className="shortcuts-legend-header">
                        <span>KEYBOARD SHORTCUTS</span>
                        <span className="shortcuts-legend-hint">Press {modKey} to toggle off</span>
                    </div>
                    <div className="shortcuts-legend-content">
                        {groupedShortcuts.map(group => (
                            <div key={group.view} className="shortcuts-group">
                                <div className="shortcuts-group-title">{group.view}</div>
                                {group.shortcuts.map((shortcut, idx) => (
                                    <div key={idx} className="shortcuts-item">
                                        <span className="shortcuts-label">{shortcut.label}</span>
                                        <span className="shortcuts-key">[{formatKey(shortcut)}]</span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <div className={`shortcuts-indicator ${isEnabled ? 'active' : ''}`}>
                [{modKey}] {isEnabled ? 'SHORTCUTS ON' : 'SHORTCUTS OFF'}
            </div>
        </>
    );
}