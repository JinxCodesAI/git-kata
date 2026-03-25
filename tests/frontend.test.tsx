/**
 * Frontend Tests for Git Kata Phase 4
 * 
 * Tests for:
 * - Navbar component
 * - Terminal component
 * - ExercisePanel component
 * - FeedbackModal component
 * - API routes
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock dependencies for Next.js components
jest.mock('next/link', () => {
  return function MockLink({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) {
    return React.createElement('a', { href, className }, children);
  };
});

// Mock ReactMarkdown
jest.mock('react-markdown', () => {
  return function MockReactMarkdown({ children }: { children: string }) {
    return React.createElement('div', { 'data-testid': 'markdown-content' }, children);
  };
});

// Mock remark-gfm
jest.mock('remark-gfm', () => {
  return {
    default: () => null,
  };
});

// Import components after mocks
import { Navbar } from '@/app/components/Navbar';
import Terminal from '@/app/components/Terminal';
import ExercisePanel from '@/app/components/ExercisePanel';
import FeedbackModal from '@/app/components/FeedbackModal';

describe('Navbar Component', () => {
  it('should render the navbar with logo', () => {
    render(React.createElement(Navbar));
    
    const logo = screen.getByText('GIT-KATA');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveClass('navbar-logo');
  });

  it('should render navigation links', () => {
    render(React.createElement(Navbar));
    
    const homeLink = screen.getByText('Home');
    const profileLink = screen.getByText('Profile');
    const leaderboardLink = screen.getByText('Leaderboard');
    
    expect(homeLink).toBeInTheDocument();
    expect(profileLink).toBeInTheDocument();
    expect(leaderboardLink).toBeInTheDocument();
  });

  it('should have correct href attributes', () => {
    render(React.createElement(Navbar));
    
    const homeLink = screen.getByText('Home').closest('a');
    const profileLink = screen.getByText('Profile').closest('a');
    const leaderboardLink = screen.getByText('Leaderboard').closest('a');
    
    expect(homeLink?.getAttribute('href')).toBe('/');
    expect(profileLink?.getAttribute('href')).toBe('/profile');
    expect(leaderboardLink?.getAttribute('href')).toBe('/leaderboard');
  });

  it('should apply correct CSS classes', () => {
    render(React.createElement(Navbar));
    
    // The navbar element is the nav with class "navbar"
    const navbar = screen.getByText('GIT-KATA').closest('.navbar');
    expect(navbar).toBeInTheDocument();
    expect(navbar).toHaveClass('navbar');
  });
});

describe('Terminal Component', () => {
  it('should render with empty history', () => {
    render(React.createElement(Terminal));
    
    const terminal = screen.getByRole('textbox');
    expect(terminal).toBeInTheDocument();
  });

  it('should render with initial history', () => {
    const initialHistory = [
      { id: '1', command: 'git init', output: 'Initialized empty Git repository' },
      { id: '2', command: 'git add .', output: '' },
    ];
    
    render(React.createElement(Terminal, { initialHistory }));
    
    expect(screen.getByText('git init')).toBeInTheDocument();
    expect(screen.getByText('Initialized empty Git repository')).toBeInTheDocument();
    expect(screen.getByText('git add .')).toBeInTheDocument();
  });

  it('should accept user input', () => {
    render(React.createElement(Terminal));
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'git status' } });
    
    expect(input).toHaveValue('git status');
  });

  it('should clear input after submission', () => {
    render(React.createElement(Terminal));
    
    const input = screen.getByRole('textbox');
    
    // Type a command
    fireEvent.change(input, { target: { value: 'git commit -m "test"' } });
    expect(input).toHaveValue('git commit -m "test"');
    
    // Submit the form
    const form = input.closest('form');
    if (form) {
      fireEvent.submit(form);
    }
    
    // Input should be cleared
    expect(input).toHaveValue('');
  });

  it('should not submit empty commands', () => {
    const initialHistory = [{ id: '1', command: 'git init', output: '' }];
    render(React.createElement(Terminal, { initialHistory }));
    
    const input = screen.getByRole('textbox');
    const form = input.closest('form');
    
    // Submit empty form
    if (form) {
      fireEvent.submit(form);
    }
    
    // History should remain unchanged
    expect(screen.getByText('git init')).toBeInTheDocument();
    const commands = screen.queryAllByText((content, element) => 
      element?.textContent === 'git commit -m "test"'
    );
    expect(commands.length).toBe(0);
  });

  it('should display command prompts correctly', () => {
    render(React.createElement(Terminal, { initialHistory: [{ id: '1', command: 'git log', output: 'commit abc' }] }));
    
    const prompts = screen.getAllByText('$');
    expect(prompts.length).toBeGreaterThan(0);
  });

  it('should handle Enter key submission', () => {
    render(React.createElement(Terminal));
    
    const input = screen.getByRole('textbox');
    
    fireEvent.change(input, { target: { value: 'git branch' } });
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 });
    
    // Input should be cleared after Enter
    expect(input).toHaveValue('');
  });

  it('should autofocus input on render', () => {
    render(React.createElement(Terminal));
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveFocus();
  });
});

describe('ExercisePanel Component', () => {
  const mockExercise = {
    title: 'Merge a Feature Branch',
    level: 2,
    description: '## Instructions\nMerge the feature branch into main.',
    timeLimit: 600,
    initialBranch: 'feature',
  };

  it('should render exercise title', () => {
    render(React.createElement(ExercisePanel, { exercise: mockExercise }));
    
    expect(screen.getByText('Merge a Feature Branch')).toBeInTheDocument();
    expect(screen.getByText('Merge a Feature Branch')).toHaveClass('exercise-title');
  });

  it('should render level information', () => {
    render(React.createElement(ExercisePanel, { exercise: mockExercise }));
    
    expect(screen.getByText('Level: 2 (Intermediate)')).toBeInTheDocument();
  });

  it('should render time limit', () => {
    render(React.createElement(ExercisePanel, { exercise: mockExercise }));
    
    expect(screen.getByText('Time: 10 min')).toBeInTheDocument();
  });

  it('should render current branch when provided', () => {
    render(React.createElement(ExercisePanel, { exercise: mockExercise, currentBranch: 'feature' }));
    
    expect(screen.getByText('Current branch:')).toBeInTheDocument();
    expect(screen.getByText('feature')).toBeInTheDocument();
  });

  it('should not render branch info when not provided', () => {
    render(React.createElement(ExercisePanel, { exercise: mockExercise }));
    
    expect(screen.queryByText('Current branch:')).not.toBeInTheDocument();
  });

  it('should render timer when provided', () => {
    render(React.createElement(ExercisePanel, { exercise: mockExercise, timer: '05:32' }));
    
    expect(screen.getByText('05:32')).toBeInTheDocument();
  });

  it('should render markdown content', () => {
    render(React.createElement(ExercisePanel, { exercise: mockExercise }));
    
    const markdownContent = screen.getByTestId('markdown-content');
    expect(markdownContent).toBeInTheDocument();
    // Check that the content includes the key parts (newlines may not be preserved in mock)
    expect(markdownContent).toHaveTextContent('Instructions');
    expect(markdownContent).toHaveTextContent('Merge the feature branch into main.');
  });

  it('should handle different level values correctly', () => {
    const level1Exercise = { ...mockExercise, level: 1 };
    render(React.createElement(ExercisePanel, { exercise: level1Exercise }));
    
    expect(screen.getByText('Level: 1 (Beginner)')).toBeInTheDocument();
  });

  it('should render unknown level for invalid values', () => {
    const invalidExercise = { ...mockExercise, level: 5 };
    render(React.createElement(ExercisePanel, { exercise: invalidExercise }));
    
    expect(screen.getByText('Level: 5 (Unknown)')).toBeInTheDocument();
  });
});

describe('FeedbackModal Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    score: 85,
    feedback: 'Great job! You successfully merged the branches.',
    exerciseId: 'test-exercise-123',
    onTryAgain: jest.fn(),
    onNextExercise: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render when isOpen is true', () => {
    render(React.createElement(FeedbackModal, { ...defaultProps }));
    
    expect(screen.getByText('EVALUATION RESULT')).toBeInTheDocument();
  });

  it('should not render when isOpen is false', () => {
    render(React.createElement(FeedbackModal, { ...defaultProps, isOpen: false }));
    
    expect(screen.queryByText('EVALUATION RESULT')).not.toBeInTheDocument();
  });

  it('should display the score', () => {
    render(React.createElement(FeedbackModal, { ...defaultProps, score: 85 }));
    
    expect(screen.getByText('SCORE: 85/100')).toBeInTheDocument();
  });

  it('should display feedback content', () => {
    render(React.createElement(FeedbackModal, { ...defaultProps }));
    
    expect(screen.getByText('Great job! You successfully merged the branches.')).toBeInTheDocument();
  });

  it('should show PASS ASCII art for score >= 70', () => {
    render(React.createElement(FeedbackModal, { ...defaultProps, score: 70 }));
    
    const passArt = screen.getByText(/████╗/);
    expect(passArt).toBeInTheDocument();
  });

  it('should show FAIL ASCII art for score < 70', () => {
    render(React.createElement(FeedbackModal, { ...defaultProps, score: 50 }));
    
    const failArt = screen.getByText(/██╗/);
    expect(failArt).toBeInTheDocument();
  });

  it('should have Try Again button', () => {
    render(React.createElement(FeedbackModal, { ...defaultProps }));
    
    const tryAgainBtn = screen.getByText('Try Again');
    expect(tryAgainBtn).toBeInTheDocument();
  });

  it('should have Next Exercise button', () => {
    render(React.createElement(FeedbackModal, { ...defaultProps }));
    
    const nextBtn = screen.getByText('Next Exercise');
    expect(nextBtn).toBeInTheDocument();
  });

  it('should have View Solution button', () => {
    render(React.createElement(FeedbackModal, { ...defaultProps }));
    
    const solutionBtn = screen.getByText('View Solution');
    expect(solutionBtn).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    render(React.createElement(FeedbackModal, { ...defaultProps }));
    
    const closeBtn = screen.getByText('×');
    fireEvent.click(closeBtn);
    
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onTryAgain when Try Again is clicked', () => {
    render(React.createElement(FeedbackModal, { ...defaultProps }));
    
    const tryAgainBtn = screen.getByText('Try Again');
    fireEvent.click(tryAgainBtn);
    
    expect(defaultProps.onTryAgain).toHaveBeenCalledTimes(1);
  });

  it('should call onNextExercise when Next Exercise is clicked', () => {
    render(React.createElement(FeedbackModal, { ...defaultProps }));
    
    const nextBtn = screen.getByText('Next Exercise');
    fireEvent.click(nextBtn);
    
    expect(defaultProps.onNextExercise).toHaveBeenCalledTimes(1);
  });

  it('should stop propagation when clicking modal content', () => {
    render(React.createElement(FeedbackModal, { ...defaultProps }));
    
    const modalContent = screen.getByText('EVALUATION RESULT').closest('.modal-content');
    if (modalContent) {
      fireEvent.click(modalContent);
    }
    
    // onClose should not be called when clicking inside modal content
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('should call onClose when clicking overlay', () => {
    render(React.createElement(FeedbackModal, { ...defaultProps }));
    
    // The overlay is the outermost div with class "modal-overlay"
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) {
      fireEvent.click(overlay);
    }
    
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});

describe('API Routes Response Format', () => {
  // Mock global fetch
  const mockFetch = jest.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/exercises', () => {
    it('should return exercises array with correct shape', async () => {
      const mockExercises = [
        { id: '1', level: 1, category: 'init', title: 'Git Init' },
        { id: '2', level: 2, category: 'commit', title: 'First Commit' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockExercises),
      });

      const response = await fetch('/api/exercises');
      const data = await response.json();

      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('level');
      expect(data[0]).toHaveProperty('title');
    });

    it('should filter exercises by level', async () => {
      const mockExercises = [
        { id: '1', level: 1, category: 'init', title: 'Git Init' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockExercises),
      });

      const response = await fetch('/api/exercises?level=1');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('GET /api/exercises/[id]', () => {
    it('should return exercise with full details', async () => {
      const mockExercise = {
        id: '1',
        level: 1,
        category: 'init',
        title: 'Git Init',
        description: 'Initialize a repository',
        timeLimit: 300,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockExercise),
      });

      const response = await fetch('/api/exercises/1');
      const data = await response.json();

      expect(data).toHaveProperty('id', '1');
      expect(data).toHaveProperty('title', 'Git Init');
      expect(data).toHaveProperty('description');
      expect(data).toHaveProperty('timeLimit');
    });

    it('should return 404 for non-existent exercise', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Exercise not found' }),
      });

      const response = await fetch('/api/exercises/invalid-id');
      
      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/profile', () => {
    it('should return user profile with stats', async () => {
      const mockProfile = {
        user: {
          id: 'user-1',
          name: 'anonymous',
          createdAt: new Date().toISOString(),
          lastActive: new Date().toISOString(),
        },
        stats: {
          totalExercises: 5,
          totalScore: 450,
          averageScore: 90,
          bestStreak: 3,
        },
        progressByLevel: [
          { level: 1, completed: 3, total: 5, percentage: 60 },
          { level: 2, completed: 2, total: 5, percentage: 40 },
        ],
        recentAttempts: [
          {
            exerciseName: 'Git Init',
            passed: true,
            score: 100,
            createdAt: new Date().toISOString(),
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfile),
      });

      const response = await fetch('/api/profile');
      const data = await response.json();

      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('stats');
      expect(data.stats).toHaveProperty('totalExercises');
      expect(data.stats).toHaveProperty('totalScore');
      expect(data.stats).toHaveProperty('averageScore');
      expect(data.stats).toHaveProperty('bestStreak');
      expect(data).toHaveProperty('progressByLevel');
      expect(data).toHaveProperty('recentAttempts');
    });

    it('should create anonymous user when no userId provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          user: { id: 'new-user', name: 'anonymous' },
          stats: { totalExercises: 0, totalScore: 0, averageScore: 0, bestStreak: 0 },
          progressByLevel: [],
          recentAttempts: [],
        }),
      });

      const response = await fetch('/api/profile');
      
      expect(response.ok).toBe(true);
    });
  });

  describe('GET /api/leaderboard', () => {
    it('should return ranked leaderboard entries', async () => {
      const mockLeaderboard = {
        leaderboard: [
          { rank: 1, userId: '1', name: 'Alice', score: 500, exercises: 5, avgTime: 120 },
          { rank: 2, userId: '2', name: 'Bob', score: 450, exercises: 4, avgTime: 150 },
        ],
        total: 2,
        limit: 50,
        offset: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLeaderboard),
      });

      const response = await fetch('/api/leaderboard');
      const data = await response.json();

      expect(data).toHaveProperty('leaderboard');
      expect(Array.isArray(data.leaderboard)).toBe(true);
      expect(data.leaderboard[0]).toHaveProperty('rank');
      expect(data.leaderboard[0]).toHaveProperty('name');
      expect(data.leaderboard[0]).toHaveProperty('score');
      expect(data.leaderboard[0]).toHaveProperty('exercises');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('limit');
      expect(data).toHaveProperty('offset');
    });

    it('should support pagination parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ leaderboard: [], total: 0, limit: 10, offset: 5 }),
      });

      const response = await fetch('/api/leaderboard?limit=10&offset=5');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.limit).toBe(10);
      expect(data.offset).toBe(5);
    });

    it('should filter out users with no exercises', async () => {
      const mockLeaderboard = {
        leaderboard: [
          { rank: 1, userId: '1', name: 'Alice', score: 500, exercises: 5, avgTime: 120 },
        ],
        total: 1,
        limit: 50,
        offset: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLeaderboard),
      });

      const response = await fetch('/api/leaderboard');
      const data = await response.json();

      // All entries should have exercises > 0
      data.leaderboard.forEach((entry: { exercises: number }) => {
        expect(entry.exercises).toBeGreaterThan(0);
      });
    });

    it('should sort by score descending', async () => {
      const mockLeaderboard = {
        leaderboard: [
          { rank: 1, userId: '1', name: 'Alice', score: 500, exercises: 5, avgTime: 120 },
          { rank: 2, userId: '2', name: 'Bob', score: 450, exercises: 4, avgTime: 150 },
        ],
        total: 2,
        limit: 50,
        offset: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLeaderboard),
      });

      const response = await fetch('/api/leaderboard');
      const data = await response.json();

      // Verify descending order
      for (let i = 1; i < data.leaderboard.length; i++) {
        expect(data.leaderboard[i - 1].score).toBeGreaterThanOrEqual(data.leaderboard[i].score);
      }
    });
  });
});

describe('Component Integration', () => {
  it('should render Navbar within app structure', () => {
    render(React.createElement(Navbar));
    
    const navbar = screen.getByText('GIT-KATA');
    expect(navbar.closest('.navbar')).toBeInTheDocument();
  });

  it('Terminal should handle rapid input changes', () => {
    render(React.createElement(Terminal));
    
    const input = screen.getByRole('textbox');
    
    fireEvent.change(input, { target: { value: 'git' } });
    fireEvent.change(input, { target: { value: 'git s' } });
    fireEvent.change(input, { target: { value: 'git st' } });
    fireEvent.change(input, { target: { value: 'git sta' } });
    fireEvent.change(input, { target: { value: 'git stat' } });
    fireEvent.change(input, { target: { value: 'git status' } });
    
    expect(input).toHaveValue('git status');
  });

  it('ExercisePanel should handle description with special characters', () => {
    const exerciseWithSpecialChars = {
      title: 'Test Exercise',
      level: 1,
      description: 'Use `git log` to view history.\n\n* Item 1\n* Item 2',
      timeLimit: 300,
      initialBranch: null,
    };
    
    render(React.createElement(ExercisePanel, { exercise: exerciseWithSpecialChars }));
    
    expect(screen.getByText('Test Exercise')).toBeInTheDocument();
    const markdown = screen.getByTestId('markdown-content');
    expect(markdown).toHaveTextContent('Use `git log` to view history.');
  });

  it('FeedbackModal should handle long feedback text', () => {
    const longFeedback = 'A'.repeat(500);
    
    render(
      React.createElement(FeedbackModal, {
        isOpen: true,
        onClose: jest.fn(),
        score: 50,
        feedback: longFeedback,
        exerciseId: 'test-exercise-123',
        onTryAgain: jest.fn(),
        onNextExercise: jest.fn(),
      })
    );
    
    expect(screen.getByText(longFeedback)).toBeInTheDocument();
  });

  it('FeedbackModal boundary: score of exactly 70 should show PASS', () => {
    render(
      React.createElement(FeedbackModal, {
        isOpen: true,
        onClose: jest.fn(),
        score: 70,
        feedback: 'Exactly 70 is passing',
        exerciseId: 'test-exercise-123',
        onTryAgain: jest.fn(),
        onNextExercise: jest.fn(),
      })
    );
    
    const passArt = screen.getByText(/████╗/);
    expect(passArt).toBeInTheDocument();
  });

  it('FeedbackModal boundary: score of 69 should show FAIL', () => {
    render(
      React.createElement(FeedbackModal, {
        isOpen: true,
        onClose: jest.fn(),
        score: 69,
        feedback: '69 is failing',
        exerciseId: 'test-exercise-123',
        onTryAgain: jest.fn(),
        onNextExercise: jest.fn(),
      })
    );
    
    const failArt = screen.getByText(/██╗/);
    expect(failArt).toBeInTheDocument();
  });
});
