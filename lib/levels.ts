// Shared level constants for Git Kata

export const LEVELS = [
  { id: 1, slug: 'beginner', name: 'BEGINNER', description: 'Start your Git journey here' },
  { id: 2, slug: 'intermediate', name: 'INTERMEDIATE', description: 'Level up your skills' },
  { id: 3, slug: 'advanced', name: 'ADVANCED', description: 'Master complex workflows' },
  { id: 4, slug: 'expert', name: 'EXPERT', description: 'Git ninja certification' },
] as const;

export const LEVEL_NAME_TO_NUMBER: Record<string, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

export function getLevelName(level: number): string {
  const names: Record<number, string> = {
    1: 'Beginner',
    2: 'Intermediate',
    3: 'Advanced',
    4: 'Expert',
  };
  return names[level] || 'Unknown';
}
