import Link from 'next/link';

interface LeaderboardEntry {
  rank: number;
  userName: string;
  score: number;
  exercisesCompleted: number;
  totalExercises: number;
  avgTime: number;
  isCurrentUser?: boolean;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  currentUserEntry?: LeaderboardEntry;
  totalParticipants: number;
}

async function getLeaderboard(): Promise<LeaderboardData> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/leaderboard`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch leaderboard');
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return {
      entries: [],
      totalParticipants: 0,
    };
  }
}

function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export default async function LeaderboardPage() {
  const data = await getLeaderboard();

  return (
    <div className="app-container">
      <nav className="navbar">
        <Link href="/" className="navbar-logo">GIT-KATA</Link>
        <div className="navbar-links">
          <Link href="/profile" className="navbar-link">PROFILE</Link>
          <Link href="/leaderboard" className="navbar-link">LEADERBOARD</Link>
        </div>
      </nav>

      <main className="main-content">
        <div className="terminal-container">
          <div className="terminal-header">
            git-kata &gt; leaderboard
          </div>
          <div className="terminal-output">
            <div style={{ marginBottom: '1.5rem' }}>
              <h1 style={{ color: 'var(--text-primary)', margin: 0 }}>LEADERBOARD</h1>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                {data.totalParticipants > 0
                  ? `${data.totalParticipants} participants`
                  : 'No participants yet'}
              </div>
            </div>

            {data.entries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>
                <p>{'No leaderboard data available yet.'}</p>
                <p>{'Complete exercises to appear on the leaderboard!'}</p>
                <Link href="/" className="navbar-link" style={{ marginTop: '1rem', display: 'inline-block' }}>
                  {'> '}START CHALLENGING
                </Link>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
                  <button className="btn">SHOW ALL</button>
                  <button className="btn">MY POSITION</button>
                </div>

                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th>RANK</th>
                      <th>USER</th>
                      <th>SCORE</th>
                      <th>EXERCISES</th>
                      <th>AVG. TIME</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.entries.map((entry) => (
                      <tr
                        key={entry.rank}
                        className={entry.isCurrentUser ? 'current-user' : undefined}
                      >
                        <td style={{ color: entry.rank <= 3 ? 'var(--text-primary)' : 'var(--text-dim)' }}>
                          {entry.rank <= 3 ? '#' : ''}{entry.rank}
                        </td>
                        <td>
                          {entry.isCurrentUser ? (
                            <span style={{ color: 'var(--text-primary)' }}>
                              {entry.userName} <span style={{ fontSize: '0.75rem' }}>(you)</span>
                            </span>
                          ) : (
                            entry.userName
                          )}
                        </td>
                        <td style={{ color: 'var(--text-primary)' }}>
                          {entry.score.toLocaleString()}
                        </td>
                        <td>
                          <span style={{ color: 'var(--text-dim)' }}>
                            {entry.exercisesCompleted}/{entry.totalExercises}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-dim)' }}>
                          {formatTime(entry.avgTime)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {data.currentUserEntry && !data.entries.some(e => e.isCurrentUser) && (
                  <div style={{ marginTop: '1rem', padding: '0.5rem', border: '1px solid var(--border-dim)', background: 'rgba(0, 255, 65, 0.05)' }}>
                    <span style={{ color: 'var(--text-dim)' }}>Your position: </span>
                    <span style={{ color: 'var(--text-primary)' }}>
                      #{data.currentUserEntry.rank} - {data.currentUserEntry.userName} - {data.currentUserEntry.score.toLocaleString()} pts
                    </span>
                  </div>
                )}
              </>
            )}

            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <Link href="/" className="navbar-link">
                {'> '}BACK TO HOME
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
