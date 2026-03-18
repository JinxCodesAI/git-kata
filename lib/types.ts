// Session types
export interface Session {
  id: string;
  userId: string;
  exerciseId: string;
  containerId: string;
  createdAt: Date;
  lastActivity: Date;
  commands: { command: string; output: string; timestamp: Date }[];
}

// Exercise setup types
export interface ExerciseSetup {
  branches: { name: string; commits: string[] }[];
  files: { path: string; content: string }[];
  currentBranch?: string;
}

// API response types
export interface ExerciseSpec {
  name: string;
  title: string;
  level: number;
  category: string;
  timeLimit: number;
  description: string;
  initialBranch: string | null;
}

// Sandbox types
export interface SandboxState {
  branch: string;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  recentCommits: { hash: string; message: string }[];
}

// Evaluation types
export interface EvaluationResult {
  passed: boolean;
  score: number;
  feedback: string;
}

// User types
export interface User {
  id: string;
  name: string;
  createdAt: Date;
  lastActive: Date;
}
