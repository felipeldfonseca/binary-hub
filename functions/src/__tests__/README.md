# Binary Hub Functions - Testing Documentation

## Overview

This document describes the comprehensive testing approach implemented for the Binary Hub Functions backend. The testing strategy focuses on realistic, maintainable tests that use Firebase emulators properly and provide thorough coverage of authentication, API endpoints, and error scenarios.

## Testing Architecture

### 1. Test Environment Setup

#### Jest Configuration
- **Location**: `jest.config.js`
- **Setup File**: `src/__tests__/setup.ts`
- **Environment**: Node.js with TypeScript support
- **Coverage**: 70% threshold for branches, functions, lines, and statements

#### Firebase Emulator Integration
- **Firestore Emulator**: localhost:8889
- **Firebase Auth Emulator**: localhost:9089
- **Firebase Storage Emulator**: localhost:9189
- **Functions Emulator**: localhost:5004 (for integration testing)

### 2. Test Structure

```
functions/src/__tests__/
├── api/                          # API Integration Tests
│   ├── auth.integration.test.ts    # Authentication endpoints
│   ├── trades.integration.test.ts   # Trades API endpoints
│   └── errorScenarios.integration.test.ts # Error handling
├── services/                     # Service Tests
│   ├── openai.test.ts              # OpenAI service unit tests
│   └── csvProcessing.integration.test.ts # CSV processing
├── utils/                        # Test Utilities
│   └── testHelpers.ts              # Common test helper functions
└── setup.ts                      # Global test configuration
```

### 3. Authentication Testing

#### Removed Hardcoded Authentication
- **Before**: Used `mock-token-for-testing` hardcoded in `index.ts:82-85`
- **After**: Proper Firebase Auth emulator integration with realistic token generation

#### Firebase Auth Test Utils
- **Location**: `src/utils/testAuth.ts`
- **Features**:
  - Programmatic test user creation
  - Custom token generation for realistic testing
  - User cleanup utilities
  - Pre-defined test user templates (basic, admin, premium)

#### Test User Management
```typescript
const testUser = await createAuthenticatedTestUser({
  uid: 'test-user-123',
  email: 'test@example.com',
  customClaims: { plan: 'premium' }
});

// Use testUser.token for authenticated requests
// testCleanup.addTestUser(testUser.uid) for cleanup
```

### 4. API Integration Testing

#### Comprehensive Coverage
- **Authentication Middleware**: Token validation, error scenarios
- **Trades API**: CRUD operations, filtering, statistics
- **CSV Processing**: Header validation, data processing, error handling
- **Error Scenarios**: Network failures, permission errors, validation failures

#### Test Patterns
```typescript
// Example: API endpoint test
it('should return trades for authenticated user', async () => {
  const testUser = await createAuthenticatedTestUser({
    uid: 'trades-test-user',
    email: 'test@example.com',
  });
  
  // Mock Firestore responses
  mockDb.collection.mockReturnValue(/* mock data */);
  
  const req = createMockRequest({
    method: 'GET',
    headers: { authorization: `Bearer ${testUser.token}` }
  });
  
  // Test the actual endpoint logic
  // Verify responses and database interactions
});
```

### 5. Error Scenario Testing

#### Categories Covered
- **Authentication Errors**: Expired tokens, invalid formats, missing headers
- **Database Errors**: Connection timeouts, permission denied, quota exceeded
- **Validation Errors**: Missing fields, invalid data types, malformed JSON
- **External Service Errors**: OpenAI API failures, Storage upload failures
- **Concurrent Request Errors**: Write conflicts, transaction failures

#### Fallback Testing
All external service integrations include fallback behavior testing to ensure graceful degradation.

### 6. CSV Processing Testing

#### Validation Testing
- Header validation against expected Ebinex format
- Missing column detection
- Extra column handling
- Data type validation

#### Processing Testing
- Valid CSV data processing
- Invalid data error handling
- Large file processing (chunked operations)
- Upload workflow integration

### 7. Test Utilities

#### Mock Helpers
```typescript
// Request/Response mocking
const req = createMockRequest({ method: 'POST', body: data });
const res = createMockResponse();

// Test data generation
const tradeData = createTestTradeData({ result: 'WIN', amount: 50 });
const csvData = createTestCSVData();

// Validation helpers
validateApiResponse(response, ['field1', 'field2', 'field3']);
```

#### Cleanup Management
```typescript
const testCleanup = new TestCleanup();
testCleanup.addTestUser(userId);
testCleanup.addDocument('collection', 'docId', 'userId');
await testCleanup.cleanup(); // Cleans up all resources
```

### 8. Running Tests

#### Commands
```bash
# Run all tests
npm test

# Run with watch mode
npm run test:watch

# Run integration tests only
npm run test:integration

# Run unit tests only
npm run test:unit

# Run with coverage
npm run test:coverage

# Run tests for CI
npm run test:ci
```

#### Firebase Emulator Setup
```bash
# Start emulators for testing
npm run serve:test

# Start functions with build
npm run serve
```

### 9. Mock Strategy

#### Firebase Admin SDK
- **Auth**: Mock user creation, token generation, verification
- **Firestore**: Mock collections, documents, queries, transactions
- **Storage**: Mock file operations, uploads, downloads

#### External Services
- **OpenAI**: Mock API responses with fallback testing
- **Express**: Mock request/response objects with proper typing

### 10. Test Coverage Goals

#### Current Coverage
- **Overall**: 54 tests passing
- **Authentication**: Complete token lifecycle testing
- **API Endpoints**: All major endpoints covered
- **Error Scenarios**: Comprehensive error handling
- **CSV Processing**: Full import workflow

#### Coverage Targets
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

## Best Practices

### 1. Realistic Testing
- Use actual Firebase Admin SDK calls (mocked)
- Test with realistic data structures
- Include edge cases and error scenarios

### 2. Test Isolation
- Each test creates its own test user
- Proper cleanup after each test
- No shared state between tests

### 3. Maintainable Code
- Reusable test utilities
- Clear test descriptions
- Consistent test patterns

### 4. Performance
- Fast test execution
- Efficient mocking strategy
- Proper resource cleanup

## Continuous Integration

### GitHub Actions Integration
The test suite is designed to run in CI environments with:
- Automatic Firebase emulator setup
- Environment variable configuration
- Coverage reporting
- Test result artifacts

### Pre-deployment Testing
All tests must pass before deployment:
```bash
npm run test:ci && npm run build
```

## Troubleshooting

### Common Issues
1. **Timeout Handles**: Expected for timeout utility testing
2. **Mock Type Errors**: Use proper TypeScript casting (`as any` when needed)
3. **Emulator Connection**: Ensure emulators are running for integration tests

### Debug Mode
```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test file
npm test -- auth.integration.test.ts

# Run with debug info
DEBUG=1 npm test
```

This testing approach ensures reliable, maintainable, and comprehensive coverage of the Binary Hub Functions backend while maintaining realistic test conditions and proper Firebase emulator integration.