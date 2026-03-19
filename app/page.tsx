import Link from 'next/link';
const ASCII_ART = `
███████╗ ██╗████████╗
██╔════╝ ██║╚══██╔══╝
██║  ███╗██║   ██║
██║   ██║██║   ██║
╚██████╔╝██║   ██║
 ╚═════╝ ╚═╝   ╚═╝
                              ██╗  ██╗ █████╗ ████████╗ █████╗
                              ██║ ██╔╝██╔══██╗╚══██╔══╝██╔══██╗
                              █████╔╝ ███████║   ██║   ███████║
                              ██╔═██╗ ██╔══██║   ██║   ██╔══██║
                              ██║  ██╗██║  ██║   ██║   ██║  ██║
                              ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝
`;
const LEVELS = [
  { id: 1, slug: 'beginner', name: 'BEGINNER', description: 'Start your Git journey here' },
  { id: 2, slug: 'intermediate', name: 'INTERMEDIATE', description: 'Level up your skills' },
  { id: 3, slug: 'advanced', name: 'ADVANCED', description: 'Master complex workflows' },
  { id: 4, slug: 'expert', name: 'EXPERT', description: 'Git ninja certification' },
];

export default function LandingPage() {
  return (
    <div className="app-container">
      <nav className="navbar">
        <span className="navbar-logo">GIT-KATA v0.1.0</span>
        <div className="navbar-links">
          <Link href="/profile" className="navbar-link">PROFILE</Link>
          <Link href="/leaderboard" className="navbar-link">LEADERBOARD</Link>
        </div>
      </nav>

      <main className="main-content">
        <div className="terminal-container">
          <div className="terminal-output">
            <pre className="ascii-art">{ASCII_ART}</pre>
            
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>
                Master Git through hands-on exercises
              </span>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <span style={{ color: 'var(--text-primary)' }}>
                {'> '}START CHALLENGE
              </span>
            </div>

            <div className="level-buttons" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
              {LEVELS.map((level) => (
                <Link
                  key={level.id}
                  href={`/challenge/${level.slug}`}
                  className="level-btn"
                  data-level={level.id}
                >
                  <div style={{ fontWeight: 'bold' }}>[{level.id}] {level.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                    {level.description}
                  </div>
                </Link>
              ))}
            </div>

            <div style={{ textAlign: 'center', marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '2rem' }}>
              <Link href="/profile" className="navbar-link">
                {'> '}PROFILE
              </Link>
              <Link href="/leaderboard" className="navbar-link">
                {'> '}LEADERBOARD
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
