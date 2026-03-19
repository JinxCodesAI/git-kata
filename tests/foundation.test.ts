import * as fs from 'fs';
import * as path from 'path';

// Mock @prisma/client to prevent PrismaClient instantiation in jsdom environment
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {},
    exercise: {},
    attempt: {},
    score: {},
    config: {},
  })),
}));

// Mock prisma module
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {},
    exercise: {},
    attempt: {},
    score: {},
    config: {},
  },
}));

describe('Foundation Tests', () => {
  const rootDir = path.join(__dirname, '..');

  describe('lib/prisma.ts', () => {
    it('should export a default prisma client', async () => {
      // Use require to test the module
      const prismaModule = await import('@/lib/prisma');
      expect(prismaModule.default).toBeDefined();
      expect(typeof prismaModule.default).toBe('object');
    });

    it('should have prisma client with correct configuration', async () => {
      const prismaModule = await import('@/lib/prisma');
      const prisma = prismaModule.default;
      
      // Verify PrismaClient has expected methods
      expect(typeof prisma.user).toBe('object');
      expect(typeof prisma.exercise).toBe('object');
      expect(typeof prisma.attempt).toBe('object');
      expect(typeof prisma.score).toBe('object');
      expect(typeof prisma.config).toBe('object');
    });
  });

  describe('lib/types.ts', () => {
    it('should export Session interface', async () => {
      const typesModule = await import('@/lib/types');
      
      const session: typesModule.Session = {
        id: 'test-id',
        userId: 'user-id',
        exerciseId: 'exercise-id',
        containerId: 'container-id',
        createdAt: new Date(),
        lastActivity: new Date(),
        commands: [],
      };
      
      expect(session.id).toBe('test-id');
    });

    it('should export ExerciseSetup interface', async () => {
      const typesModule = await import('@/lib/types');
      
      const setup: typesModule.ExerciseSetup = {
        branches: [{ name: 'main', commits: ['commit1'] }],
        files: [{ path: 'README.md', content: '# Test' }],
        currentBranch: 'main',
      };
      
      expect(setup.branches).toHaveLength(1);
    });

    it('should export ExerciseSpec interface', async () => {
      const typesModule = await import('@/lib/types');
      
      const spec: typesModule.ExerciseSpec = {
        name: 'test-exercise',
        title: 'Test Exercise',
        level: 1,
        category: 'init',
        timeLimit: 600,
        description: 'Test description',
        initialBranch: 'main',
      };
      
      expect(spec.level).toBe(1);
    });

    it('should export SandboxState interface', async () => {
      const typesModule = await import('@/lib/types');
      
      const state: typesModule.SandboxState = {
        branch: 'main',
        staged: [],
        unstaged: [],
        untracked: [],
        recentCommits: [],
      };
      
      expect(state.branch).toBe('main');
    });

    it('should export EvaluationResult interface', async () => {
      const typesModule = await import('@/lib/types');
      
      const result: typesModule.EvaluationResult = {
        passed: true,
        score: 85,
        feedback: 'Good job!',
      };
      
      expect(result.passed).toBe(true);
      expect(result.score).toBe(85);
    });

    it('should export User interface', async () => {
      const typesModule = await import('@/lib/types');
      
      const user: typesModule.User = {
        id: 'user-id',
        name: 'testuser',
        createdAt: new Date(),
        lastActive: new Date(),
      };
      
      expect(user.name).toBe('testuser');
    });
  });

  describe('app/globals.css', () => {
    it('should exist at app/globals.css', () => {
      const cssPath = path.join(rootDir, 'app', 'globals.css');
      expect(fs.existsSync(cssPath)).toBe(true);
    });

    it('should contain Matrix theme CSS variables', () => {
      const cssPath = path.join(rootDir, 'app', 'globals.css');
      const cssContent = fs.readFileSync(cssPath, 'utf-8');
      
      // Check for Matrix theme colors
      expect(cssContent).toContain('--bg-primary: #0a0a0a');
      expect(cssContent).toContain('--bg-secondary: #0d1117');
      expect(cssContent).toContain('--bg-tertiary: #161b22');
      expect(cssContent).toContain('--text-primary: #00ff41');
      expect(cssContent).toContain('--text-dim: #008f11');
      expect(cssContent).toContain('--text-bright: #ffffff');
      expect(cssContent).toContain('--accent: #00ff41');
      expect(cssContent).toContain('--error: #ff0040');
      expect(cssContent).toContain('--success: #00ff41');
      expect(cssContent).toContain('--border: #008f11');
      expect(cssContent).toContain('--border-dim: #003d00');
    });

    it('should contain root selector with theme variables', () => {
      const cssPath = path.join(rootDir, 'app', 'globals.css');
      const cssContent = fs.readFileSync(cssPath, 'utf-8');
      
      expect(cssContent).toContain(':root {');
    });

    it('should contain app-container class', () => {
      const cssPath = path.join(rootDir, 'app', 'globals.css');
      const cssContent = fs.readFileSync(cssPath, 'utf-8');
      
      expect(cssContent).toContain('.app-container');
    });

    it('should contain terminal-related classes', () => {
      const cssPath = path.join(rootDir, 'app', 'globals.css');
      const cssContent = fs.readFileSync(cssPath, 'utf-8');
      
      expect(cssContent).toContain('.terminal-container');
      expect(cssContent).toContain('.terminal-header');
      expect(cssContent).toContain('.terminal-output');
      expect(cssContent).toContain('.terminal-input');
    });
  });

  describe('app/layout.tsx', () => {
    it('should exist at app/layout.tsx', () => {
      const layoutPath = path.join(rootDir, 'app', 'layout.tsx');
      expect(fs.existsSync(layoutPath)).toBe(true);
    });

    it('should have correct structure with html and body', () => {
      const layoutPath = path.join(rootDir, 'app', 'layout.tsx');
      const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
      
      expect(layoutContent).toContain('export default function RootLayout');
      expect(layoutContent).toContain("children: React.ReactNode");
      expect(layoutContent).toContain('<html lang="en">');
      expect(layoutContent).toContain('<body');
      expect(layoutContent).toContain('</body>');
      expect(layoutContent).toContain('</html>');
    });

    it('should import globals.css', () => {
      const layoutPath = path.join(rootDir, 'app', 'layout.tsx');
      const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
      
      expect(layoutContent).toContain("import './globals.css'");
    });

    it('should have metadata export', () => {
      const layoutPath = path.join(rootDir, 'app', 'layout.tsx');
      const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
      
      expect(layoutContent).toContain('export const metadata');
      expect(layoutContent).toContain("title: 'Git Kata'");
      expect(layoutContent).toContain('description');
    });
  });

  describe('prisma/schema.prisma', () => {
    it('should exist at prisma/schema.prisma', () => {
      const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');
      expect(fs.existsSync(schemaPath)).toBe(true);
    });

    it('should have User model', () => {
      const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');
      const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
      
      expect(schemaContent).toContain('model User {');
      expect(schemaContent).toContain('id         String');
      expect(schemaContent).toContain('name       String');
      expect(schemaContent).toContain('createdAt  DateTime');
      expect(schemaContent).toContain('lastActive DateTime');
    });

    it('should have Exercise model', () => {
      const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');
      const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
      
      expect(schemaContent).toContain('model Exercise {');
      expect(schemaContent).toContain('id String @id @default(uuid())');
      expect(schemaContent).toContain('level Int');
      expect(schemaContent).toContain('category String');
      expect(schemaContent).toContain('title String');
      expect(schemaContent).toContain('path String @db.Text');
      expect(schemaContent).toContain('timeLimit Int @default(600)');
    });

    it('should have Attempt model', () => {
      const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');
      const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
      
      expect(schemaContent).toContain('model Attempt {');
      expect(schemaContent).toContain('id         String   @id @default(uuid())');
      expect(schemaContent).toContain('userId     String');
      expect(schemaContent).toContain('exerciseId String');
      expect(schemaContent).toContain('commands   String   @db.Text');
      expect(schemaContent).toContain('output     String   @db.Text');
      expect(schemaContent).toContain('passed     Boolean');
      expect(schemaContent).toContain('score      Int');
      expect(schemaContent).toContain('feedback   String   @db.Text');
      expect(schemaContent).toContain('duration   Int');
    });

    it('should have Score model', () => {
      const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');
      const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
      
      expect(schemaContent).toContain('model Score {');
      expect(schemaContent).toContain('id          String   @id @default(uuid())');
      expect(schemaContent).toContain('userId      String');
      expect(schemaContent).toContain('exerciseId  String');
      expect(schemaContent).toContain('bestScore   Int      @default(0)');
      expect(schemaContent).toContain('completions Int      @default(0)');
      expect(schemaContent).toContain('bestTime    Int?');
      expect(schemaContent).toContain('@@unique([userId, exerciseId])');
    });

    it('should have Config model', () => {
      const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');
      const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
      
      expect(schemaContent).toContain('model Config {');
      expect(schemaContent).toContain('key   String @id');
      expect(schemaContent).toContain('value String');
    });

    it('should have datasource and generator configured for postgresql', () => {
      const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');
      const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
      
      expect(schemaContent).toContain('datasource db {');
      expect(schemaContent).toContain('provider = "postgresql"');
      expect(schemaContent).toContain('url      = env("DATABASE_URL")');
      expect(schemaContent).toContain('generator client {');
      expect(schemaContent).toContain('provider = "prisma-client-js"');
    });

    it('should have proper relations between models', () => {
      const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');
      const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
      
      // User relations
      expect(schemaContent).toContain('attempts   Attempt[]');
      expect(schemaContent).toContain('scores     Score[]');
      
      // Exercise relations
      expect(schemaContent).toContain('attempts Attempt[]');
      expect(schemaContent).toContain('scores Score[]');
      
      // Attempt relations
      expect(schemaContent).toContain('user       User     @relation');
      expect(schemaContent).toContain('exercise   Exercise @relation');
      
      // Score relations
      expect(schemaContent).toContain('user        User     @relation');
      expect(schemaContent).toContain('exercise    Exercise @relation');
    });
  });
});
