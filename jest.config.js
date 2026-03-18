/**
 * Jest Configuration for Git Kata
 * 
 * This configuration assumes the following devDependencies are added to package.json:
 * - jest
 * - @testing-library/react
 * - @testing-library/jest-dom
 * - ts-jest
 * - @types/jest
 * 
 * To install these dependencies, run:
 * npm install --save-dev jest @testing-library/react @testing-library/jest-dom ts-jest @types/jest
 */

/** @type {import('jest').Config} */
const config = {
  // Test environment
  testEnvironment: 'jsdom',
  
  // TypeScript support via ts-jest
  preset: 'ts-jest',
  
  // Test match patterns
  testMatch: [
    '**/__tests__/**/*.ts?(x)',
    '**/?(*.)+(spec|test).ts?(x)',
  ],
  
  // Exclude patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/minimax_chat/',
  ],
  
  // Transform ignore patterns - include ESM modules that need transformation
  transformIgnorePatterns: [
    '/node_modules/(?!(remark-gfm|react-markdown|rehype-raw|unist-.*|mdast-.*|micromark.*)/)',
  ],
  
  // Module name mappings for @/ aliases (Next.js style)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  
  // Transform configuration
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
    }],
  },
  
  // Collect coverage from specific paths
  collectCoverageFrom: [
    'app/**/*.ts',
    'app/**/*.tsx',
    'lib/**/*.ts',
    '!app/**/*.d.ts',
    '!**/node_modules/**',
  ],
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Verbose output
  verbose: true,
};

module.exports = config;
