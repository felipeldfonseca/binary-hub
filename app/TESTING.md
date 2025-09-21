# Testing Framework Documentation

This document provides comprehensive information about the testing framework set up for the Binary Hub Next.js project.

## Overview

The testing framework consists of:
- **Jest** - JavaScript testing framework
- **React Testing Library** - React component testing utilities
- **TypeScript support** - Full TypeScript integration for tests
- **Next.js integration** - Optimized for Next.js applications

## Installation & Setup

### Dependencies Installed
```json
{
  "devDependencies": {
    "jest": "^30.0.5",
    "jest-environment-jsdom": "^30.0.5",
    "@testing-library/react": "^16.3.0",
    "@testing-library/jest-dom": "^6.6.4",
    "@testing-library/user-event": "^14.6.1",
    "@types/jest": "^30.0.0",
    "ts-jest": "^29.4.1"
  }
}
```

### Configuration Files

#### Jest Configuration (`jest.config.js`)
```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  collectCoverageFrom: [
    'components/**/*.{js,jsx,ts,tsx}',
    'hooks/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    'app/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // ... additional configuration
}

module.exports = createJestConfig(customJestConfig)
```

#### Jest Setup (`jest.setup.js`)
Contains global mocks and setup for:
- Next.js router mocking
- Firebase mocking
- Framer Motion mocking
- React Hot Toast mocking
- Global fetch mocking

## Available Test Scripts

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests in CI mode (non-interactive)
npm run test:ci
```

## Test Structure

### Directory Structure
```
__tests__/
├── components/
│   ├── auth/
│   │   └── AuthForm.test.tsx
│   └── dashboard/
│       ├── HeroSection.test.tsx
│       └── PerformanceSection.test.tsx
├── hooks/
│   ├── useTrades.test.ts
│   └── useTradeStats.test.ts
└── simple.test.ts
```

## Sample Tests

### Component Testing (AuthForm)
```typescript
describe('AuthForm', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    mode: 'signin' as const,
    onModeChange: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset mocks
  })

  it('renders signin form by default', () => {
    render(<AuthForm {...defaultProps} />)
    
    expect(screen.getByText('Welcome Back')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
  })

  it('validates required fields on signin', async () => {
    const user = userEvent.setup()
    render(<AuthForm {...defaultProps} />)
    
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument()
    })
  })
})
```

### Hook Testing (useTrades)
```typescript
describe('useTrades', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockClear()
  })

  it('fetches trades successfully', async () => {
    const mockResponse = { trades: [], pagination: {} }
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    })

    const { result } = renderHook(() => useTrades())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.trades).toEqual(mockResponse.trades)
  })
})
```

### Dashboard Component Testing
```typescript
describe('HeroSection', () => {
  it('renders with user display name', () => {
    render(<HeroSection />)
    
    expect(screen.getByText('Hey, John!')).toBeInTheDocument()
    expect(screen.getByText('Have you traded today?')).toBeInTheDocument()
  })

  it('navigates to trades page when button is clicked', async () => {
    const user = userEvent.setup()
    render(<HeroSection />)
    
    await user.click(screen.getByRole('button', { name: 'Add new trades' }))
    
    expect(mockPush).toHaveBeenCalledWith('/trades')
  })
})
```

## Testing Patterns & Best Practices

### 1. Mocking External Dependencies
```typescript
// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    // ... other router methods
  }),
}))

// Mock custom hooks
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth,
}))
```

### 2. Component Testing
- Use `screen.getByText()`, `screen.getByRole()` for finding elements
- Use `screen.getByPlaceholderText()` for form inputs
- Use `userEvent` for simulating user interactions
- Use `waitFor()` for async operations

### 3. Hook Testing
- Use `renderHook()` from React Testing Library
- Mock external dependencies (fetch, Firebase, etc.)
- Test loading states, error states, and success states
- Verify function calls and state updates

### 4. Form Testing
```typescript
it('submits valid signin form', async () => {
  const user = userEvent.setup()
  render(<AuthForm {...defaultProps} />)
  
  await user.type(screen.getByPlaceholderText('Enter your email'), 'test@example.com')
  await user.type(screen.getByPlaceholderText('Enter your password'), 'password123')
  await user.click(screen.getByRole('button', { name: /sign in/i }))
  
  await waitFor(() => {
    expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123')
  })
})
```

## Coverage Reports

Coverage reports are generated in the `coverage/` directory when running:
```bash
npm run test:coverage
```

The coverage includes:
- Line coverage
- Function coverage
- Branch coverage
- Statement coverage

## Continuous Integration

For CI environments, use:
```bash
npm run test:ci
```

This runs tests with:
- No watch mode
- Coverage reporting
- Non-interactive mode

## Debugging Tests

### VS Code Configuration
Add this to your `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Jest Tests",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen",
  "disableOptimisticBPs": true,
  "windows": {
    "program": "${workspaceFolder}/node_modules/jest/bin/jest"
  }
}
```

### Common Debugging Commands
```bash
# Run specific test file
npm test -- AuthForm.test.tsx

# Run tests with verbose output
npm test -- --verbose

# Run tests matching pattern
npm test -- --testNamePattern="signin"
```

## Key Features Tested

### Components
- **AuthForm**: Form validation, user interactions, mode switching, error handling
- **HeroSection**: User name display, navigation, responsive behavior
- **PerformanceSection**: Data display, period filtering, loading/error states

### Hooks
- **useTrades**: CRUD operations, API error handling, loading states
- **useTradeStats**: Analytics fetching, export functionality, period changes

## Mock Strategies

### Firebase Mocking
```typescript
jest.mock('./lib/firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: jest.fn().mockResolvedValue('mock-token'),
      uid: 'mock-user-id',
    },
  },
}))
```

### API Mocking
```typescript
global.fetch = jest.fn()

beforeEach(() => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue(mockData),
  })
})
```

## Troubleshooting

### Common Issues

1. **Module path resolution**: Ensure `moduleNameMapper` in Jest config matches TypeScript paths
2. **Next.js specific features**: Use Next.js Jest configuration
3. **DOM availability**: Use `jest-environment-jsdom` for component tests
4. **Async operations**: Always use `waitFor()` for async state changes

### Performance Tips

- Use `renderHook()` for testing hooks without components
- Mock expensive operations (API calls, complex computations)
- Use `screen.debug()` to inspect DOM during test development
- Run specific tests during development to speed up feedback loop

## Future Enhancements

Potential improvements to consider:
- Visual regression testing with Chromatic
- E2E testing with Playwright or Cypress
- Performance testing with React Testing Library
- Accessibility testing with jest-axe
- Snapshot testing for critical UI components

---

This testing framework provides a solid foundation for maintaining code quality and reliability in the Binary Hub application.