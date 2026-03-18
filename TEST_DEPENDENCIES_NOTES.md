# Test Dependencies Note

## Required devDependencies for Testing

When package.json is created in Phase 2, add the following test dependencies:

```json
{
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.2",
    "@testing-library/react": "^14.2.1",
    "@types/jest": "^29.5.12",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.2",
    "typescript": "^5"
  }
}
```

## Installation

After package.json is created with these dependencies, run:

```bash
npm install
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- tests/example.test.ts
```

## Test File Naming Convention

- Unit tests: `*.test.ts` or `*.test.tsx`
- Integration tests: `*.integration.test.ts`
- Test directories: `__tests__/` folder

## Adding Tests

Place test files in:
- `tests/` - General test utilities and setup
- `app/**/*.test.ts` - Component and page tests
- `lib/**/*.test.ts` - Library function tests
