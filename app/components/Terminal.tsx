'use client';

import { useState, useRef, useEffect, KeyboardEvent, FormEvent } from 'react';

interface HistoryEntry {
    command: string;
    output: string;
}

interface TerminalProps {
    initialHistory?: HistoryEntry[];
}

export default function Terminal({ initialHistory = [] }: TerminalProps) {
    const [history, setHistory] = useState<HistoryEntry[]>(initialHistory);
    const [input, setInput] = useState('');
    const outputRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [history]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const command = input.trim();
        const newEntry: HistoryEntry = {
            command,
            output: '',
        };

        setHistory((prev) => [...prev, newEntry]);
        setInput('');
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSubmit(e);
        }
    };

    const focusInput = () => {
        inputRef.current?.focus();
    };

    return (
        <div className="terminal-container" onClick={focusInput}>
            <div className="terminal-output" ref={outputRef} onClick={focusInput}>
                {history.map((entry, index) => (
                    <div key={index}>
                        <p className="terminal-line command">
                            <span className="terminal-prompt">$</span> {entry.command}
                        </p>
                        {entry.output && (
                            <p className="terminal-line output">{entry.output}</p>
                        )}
                    </div>
                ))}
            </div>
            <form className="terminal-input-container" onSubmit={handleSubmit}>
                <span className="terminal-prompt">$</span>
                <input
                    ref={inputRef}
                    type="text"
                    className="terminal-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    spellCheck={false}
                    autoComplete="off"
                />
            </form>
        </div>
    );
}
