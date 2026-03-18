'use client';

import Link from 'next/link';

export function Navbar() {
    return (
        <nav className="navbar">
            <Link href="/" className="navbar-logo">
                GIT-KATA
            </Link>
            <div className="navbar-links">
                <Link href="/" className="navbar-link">
                    Home
                </Link>
                <Link href="/profile" className="navbar-link">
                    Profile
                </Link>
                <Link href="/leaderboard" className="navbar-link">
                    Leaderboard
                </Link>
            </div>
        </nav>
    );
}
