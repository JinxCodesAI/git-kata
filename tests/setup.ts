/**
 * Jest Test Setup File
 * 
 * This file is run before each test file and sets up the testing environment.
 */

import '@testing-library/jest-dom';

/**
 * Global test utilities and mocks can be added here
 */

// Mock window.matchMedia if used in components (only in browser environment)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

// Mock console.error for expected warnings
// Uncomment if you want to suppress specific warnings in tests
// const originalConsoleError = console.error;
// beforeAll(() => {
//   console.error = (...args: Parameters<typeof console.error>) => {
//     if (
//       typeof args[0] === 'string' &&
//       args[0].includes('Warning: ')
    // ) {
//       return;
//     }
//     originalConsoleError(...args);
//   };
// });
// afterAll(() => {
//   console.error = originalConsoleError;
// });
