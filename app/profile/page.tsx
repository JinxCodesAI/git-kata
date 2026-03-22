'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Home } from 'lucide-react';
import ErrorModal from '@/app/components/ErrorModal';

interface User {
  id: string;
  name: string;
  createdAt: string;
  lastActive: string;
}

interface Stats {
  totalExercises: number;
  completedExercises: number;
  totalScore: number;
  maxPossibleScore: number;
  averageScore: number;
  bestStreak: number;
}

interface ProgressByLevel {
  level: number;
  levelName: string;
  completed: number;
  total: number;
  percentage: number;
}

interface RecentAttempt {
  id: string;
  exerciseId: string;
  exerciseTitle: string;
  passed: boolean;
  score: number;
  createdAt: string;
}

interface ProfileData {
  user: User;
  stats: Stats;
  progressByLevel: ProgressByLevel[];
  recentAttempts: RecentAttempt[];
}

const LEVEL_NAMES: Record<number, string> = {
  1: 'BEGINNER',
  2: 'INTERMEDIATE',
  3: 'ADVANCED',
  4: 'EXPERT',
};

export default function ProfilePage() {
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const userId = localStorage.getItem('gitkata_user_id');
        
        if (!userId) {
          throw new Error('User ID not found. Please refresh the page.');
        }
        
        const response = await fetch(`/api/profile?userId=${encodeURIComponent(userId)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }
        const data = await response.json();
        setProfileData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="app-container">
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
        <main className="main-content">
          <div className="terminal-container">
            <div className="terminal-output" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <span style={{ color: 'var(--text-dim)' }}>Loading profile...</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="app-container">
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
        <main className="main-content">
          <div className="terminal-container">
            <div className="terminal-output" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <span style={{ color: 'var(--text-dim)' }}>Loading profile...</span>
            </div>
          </div>
        </main>
        <ErrorModal
          isOpen={true}
          onClose={() => setError(null)}
          message={error || 'Failed to load profile'}
        />
      </div>
    );
  }

  const { user, stats, progressByLevel, recentAttempts } = profileData;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="app-container">
      <nav className="navbar">
        <Link href="/" className="navbar-logo">
          GIT-KATA
        </Link>
        <div className="navbar-links">
          <Link href="/" className="navbar-link">
            <Home size={16} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
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

      <main className="main-content">
        <div className="terminal-container">
          <div className="terminal-header">
            git-kata &gt; profile
          </div>
          <div className="terminal-output">
            {/* User Info Section */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
                USER INFO
              </div>
              <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: '1rem' }}>
                <div style={{ marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--text-dim)' }}>USER:</span>{' '}
                  <span style={{ color: 'var(--text-bright)' }}>{user.name}</span>
                </div>
                <div style={{ marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Joined:</span>{' '}
                  <span>{formatDate(user.createdAt)}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Last active:</span>{' '}
                  <span>{formatDate(user.lastActive)}</span>
                </div>
              </div>
            </div>

            {/* Statistics Section */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
                STATISTICS
              </div>
              <div style={{
                border: '1px solid var(--border-dim)',
                padding: '1rem',
                background: 'var(--bg-tertiary)',
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem 2rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Total Exercises:</span>{' '}
                    <span style={{ color: 'var(--text-bright)' }}>
                      {stats.completedExercises}/{stats.totalExercises}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Total Score:</span>{' '}
                    <span style={{ color: 'var(--text-bright)' }}>
                      {stats.totalScore}/{stats.maxPossibleScore}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Average Score:</span>{' '}
                    <span style={{ color: 'var(--text-bright)' }}>{stats.averageScore.toFixed(1)}%</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Best Streak:</span>{' '}
                    <span style={{ color: 'var(--text-bright)' }}>{stats.bestStreak}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress by Level Section */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
                PROGRESS BY LEVEL
              </div>
              <div style={{
                border: '1px solid var(--border-dim)',
                padding: '1rem',
                background: 'var(--bg-tertiary)',
              }}>
                {progressByLevel.map((level) => (
                  <div key={level.level} style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span>
                        <span style={{ color: 'var(--text-dim)' }}>[{level.level}]</span>{' '}
                        <span>{level.levelName}</span>
                      </span>
                      <span style={{ color: 'var(--text-dim)' }}>
                        {level.completed}/{level.total} ({level.percentage}%)
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${level.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Attempts Section */}
            <div>
              <div style={{ color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
                RECENT ATTEMPTS
              </div>
              <div style={{
                border: '1px solid var(--border-dim)',
                padding: '1rem',
                background: 'var(--bg-tertiary)',
              }}>
                {recentAttempts.length === 0 ? (
                  <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '1rem' }}>
                    No attempts yet. Start practicing!
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-dim)' }}>
                        <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-dim)', fontWeight: 'normal' }}>
                          Exercise
                        </th>
                        <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-dim)', fontWeight: 'normal' }}>
                          Result
                        </th>
                        <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-dim)', fontWeight: 'normal' }}>
                          Score
                        </th>
                        <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-dim)', fontWeight: 'normal' }}>
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentAttempts.map((attempt) => (
                        <tr
                          key={attempt.id}
                          style={{ borderBottom: '1px solid var(--border-dim)' }}
                        >
                          <td style={{ padding: '0.5rem' }}>
                            <Link
                              href={`/challenge/${attempt.exerciseId}`}
                              style={{ color: 'var(--text-primary)', textDecoration: 'none' }}
                            >
                              {attempt.exerciseTitle}
                            </Link>
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <span
                              style={{
                                color: attempt.passed ? 'var(--success)' : 'var(--error)',
                                fontWeight: 'bold',
                              }}
                            >
                              [{attempt.passed ? 'PASS' : 'FAIL'}]
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem', color: 'var(--text-bright)' }}>
                            {attempt.score}%
                          </td>
                          <td style={{ padding: '0.5rem', color: 'var(--text-dim)' }}>
                            {formatDateTime(attempt.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
