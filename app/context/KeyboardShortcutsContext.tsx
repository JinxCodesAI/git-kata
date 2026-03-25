// app/context/KeyboardShortcutsContext.tsx

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';

export interface ShortcutAction {
    key: string;
    label: string;
    modifiers?: ('cmd' | 'alt' | 'shift')[];
    action: () => void;
    view: string;
}

interface KeyboardShortcutsContextType {
    isEnabled: boolean;
    toggle: () => void;
    platform: 'mac' | 'windows';
    modKey: string; // '⌘' or 'Alt'
    registeredActions: Map<string, ShortcutAction>;
    registerAction: (id: string, action: ShortcutAction) => void;
    unregisterAction: (id: string) => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | null>(null);

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
    const [isEnabled, setIsEnabled] = useState(true);
    const [actionsVersion, setActionsVersion] = useState(0);
    const registeredActionsRef = useRef<Map<string, ShortcutAction>>(new Map());

    // Detect platform
    const platform = useMemo((): 'mac' | 'windows' => {
        if (typeof window === 'undefined') return 'windows';
        const ua = navigator.userAgent.toLowerCase();
        return ua.includes('mac') || ua.includes('iphone') || ua.includes('ipad') ? 'mac' : 'windows';
    }, []);

    const modKey = platform === 'mac' ? '⌘' : 'Alt';

    // Toggle shortcuts on/off AND blur input when enabling
    const toggle = useCallback(() => {
        console.log('[Shortcuts] Toggle pressed, isEnabled:', !isEnabled);
        const newState = !isEnabled;
        setIsEnabled(newState);

        // When enabling shortcuts, blur any active input
        if (newState) {
            if (document.activeElement) {
                (document.activeElement as HTMLElement).blur();
            }
        }
    }, [isEnabled]);

    // Listen for Cmd/Alt key to toggle and execute shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check if user is typing in an input field
            const target = e.target as HTMLElement;
            const isInput = target.tagName === 'INPUT' ||
                           target.tagName === 'TEXTAREA' ||
                           target.isContentEditable;

            // Cmd on Mac (metaKey) or Alt on Windows/Linux
            const modPressed = platform === 'mac' ? e.metaKey : e.altKey;

            // Toggle shortcuts with Alt/Cmd (when pressed alone, not with other keys)
            if (modPressed && !e.shiftKey && !e.ctrlKey) {
                if (e.key === 'Meta' || e.key === 'Alt') {
                    e.preventDefault();
                    console.log('[Shortcuts] Toggle key detected');
                    toggle();
                    return;
                }
            }

            // Execute shortcuts ONLY when enabled and not in an input
            if (isEnabled && !isInput) {
                const key = e.key;
                console.log('[Shortcuts] Checking shortcut:', key, 'isEnabled:', isEnabled, 'registered count:', registeredActionsRef.current.size);

                // Find matching action - case insensitive key comparison
                // When shortcuts mode is ON, we match single keys (modifiers should be empty)
                for (const [id, action] of registeredActionsRef.current.entries()) {
                    const keysMatch = action.key.toLowerCase() === key.toLowerCase();

                    console.log('[Shortcuts] Comparing:', id, 'key match:', keysMatch);

                    if (keysMatch) {
                        console.log('[Shortcuts] MATCH FOUND:', id, action.label);
                        e.preventDefault();
                        e.stopPropagation();
                        // Disable shortcuts after action (in case of navigation)
                        setIsEnabled(false);
                        action.action();
                        return;
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggle, platform, isEnabled, actionsVersion]);

    // Register an action
    const registerAction = useCallback((id: string, action: ShortcutAction) => {
        console.log('[Shortcuts] Registering action:', id, action.label, action.key, 'view:', action.view);
        // Create new Map to ensure proper referential equality and re-renders
        const newMap = new Map(registeredActionsRef.current);
        newMap.set(id, action);
        registeredActionsRef.current = newMap;
        setActionsVersion(v => v + 1);
    }, []);

    // Unregister an action
    const unregisterAction = useCallback((id: string) => {
        console.log('[Shortcuts] Unregistering action:', id);
        // Create new Map to ensure proper referential equality and re-renders
        const newMap = new Map(registeredActionsRef.current);
        newMap.delete(id);
        registeredActionsRef.current = newMap;
        setActionsVersion(v => v + 1);
    }, []);

    const value = useMemo(() => ({
        isEnabled,
        toggle,
        platform,
        modKey,
        registeredActions: registeredActionsRef.current,
        registerAction,
        unregisterAction,
    }), [isEnabled, toggle, platform, modKey, registerAction, unregisterAction, actionsVersion]);

    return (
        <KeyboardShortcutsContext.Provider value={value}>
            {children}
        </KeyboardShortcutsContext.Provider>
    );
}

export function useKeyboardShortcuts() {
    const context = useContext(KeyboardShortcutsContext);
    if (!context) {
        throw new Error('useKeyboardShortcuts must be used within KeyboardShortcutsProvider');
    }
    return context;
}

// Hook for components to register their shortcut actions
export function useRegisterShortcutAction(id: string, action: ShortcutAction) {
    const { registerAction, unregisterAction } = useKeyboardShortcuts();
    const actionRef = useRef(action);
    actionRef.current = action;

    useEffect(() => {
        const wrappedAction: ShortcutAction = {
            ...actionRef.current,
            action: () => actionRef.current.action(),
        };
        console.log('[Shortcuts] useEffect registering:', id);
        registerAction(id, wrappedAction);
        return () => {
            console.log('[Shortcuts] useEffect cleanup unregistering:', id);
            unregisterAction(id);
        };
    }, [id, registerAction, unregisterAction]);
}