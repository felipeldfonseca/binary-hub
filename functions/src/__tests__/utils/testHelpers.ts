import { Request } from 'express';
import { createTestUserWithToken, cleanupTestUsers, TEST_USERS, TestUser } from '../../utils/testAuth';

export interface TestRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
  params?: Record<string, string>;
  user?: TestUser;
}

export interface AuthenticatedTestUser {
  uid: string;
  token: string;
  email: string;
}

/**
 * Creates a mock Express request for testing
 */
export const createMockRequest = (options: TestRequestOptions = {}): Partial<Request> => {
  const {
    method = 'GET',
    headers = {},
    body,
    query = {},
    params = {},
  } = options;

  return {
    method,
    headers,
    body,
    query,
    params,
    get: jest.fn((headerName: string) => {
      const value = headers[headerName.toLowerCase()];
      return headerName === 'set-cookie' ? (value ? [value] : undefined) : value;
    }) as any,
  };
};

/**
 * Creates a mock Express response for testing
 */
export const createMockResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
  };
  return res;
};

/**
 * Creates an authenticated test user for API testing
 */
export const createAuthenticatedTestUser = async (
  userData?: Partial<TestUser>
): Promise<AuthenticatedTestUser> => {
  const user = { ...TEST_USERS.BASIC_USER, ...userData };
  const { uid, token } = await createTestUserWithToken(user);
  
  return {
    uid,
    token,
    email: user.email,
  };
};

/**
 * Creates multiple authenticated test users
 */
export const createMultipleTestUsers = async (
  count: number,
  baseUser?: Partial<TestUser>
): Promise<AuthenticatedTestUser[]> => {
  const users = await Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const user = {
        ...TEST_USERS.BASIC_USER,
        uid: `test-user-${index}`,
        email: `test${index}@example.com`,
        ...baseUser,
      };
      return createAuthenticatedTestUser(user);
    })
  );
  
  return users;
};

/**
 * Creates a request with proper authentication headers
 */
export const createAuthenticatedRequest = (
  token: string,
  options: TestRequestOptions = {}
): Partial<Request> => {
  const headers = {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    ...options.headers,
  };

  return createMockRequest({
    ...options,
    headers,
  });
};

/**
 * Creates test trade data
 */
export const createTestTradeData = (overrides: any = {}) => ({
  asset: 'EURUSD',
  type: 'CALL',
  amount: 50,
  entry_price: 1.2345,
  exit_price: 1.2350,
  result: 'WIN',
  platform: 'Test Platform',
  timestamp: new Date().toISOString(),
  ...overrides,
});

/**
 * Creates test rule data
 */
export const createTestRuleData = (overrides: any = {}) => ({
  title: 'Test Rule',
  description: 'This is a test trading rule',
  category: 'risk_management',
  is_active: true,
  ...overrides,
});

/**
 * Creates test CSV data for import testing
 */
export const createTestCSVData = () => {
  const headers = ['ID', 'Data', 'Ativo', 'Direção', 'Valor', 'Resultado', 'Payout', 'Horário'];
  const rows = [
    ['1', '2024-01-01', 'EURUSD', 'CALL', '50', 'WIN', '85', '14:30'],
    ['2', '2024-01-01', 'GBPUSD', 'PUT', '75', 'LOSS', '0', '15:45'],
    ['3', '2024-01-02', 'USDJPY', 'CALL', '100', 'WIN', '85', '09:15'],
  ];
  
  return { headers, rows };
};

/**
 * Converts CSV data to string format
 */
export const csvDataToString = (data: { headers: string[]; rows: string[][] }) => {
  const csvLines = [data.headers, ...data.rows];
  return csvLines.map(row => row.join(',')).join('\n');
};

/**
 * Test cleanup helper
 */
export class TestCleanup {
  private testUsers: string[] = [];
  private createdDocuments: Array<{ collection: string; id: string; userId?: string }> = [];

  public addTestUser(uid: string) {
    this.testUsers.push(uid);
  }

  public addDocument(collection: string, id: string, userId?: string) {
    this.createdDocuments.push({ collection, id, userId });
  }

  public async cleanup() {
    // Clean up test users
    if (this.testUsers.length > 0) {
      await cleanupTestUsers(this.testUsers);
      this.testUsers = [];
    }

    // Note: In a real implementation, you would also clean up Firestore documents
    // but since we're using mocks in tests, this is mainly for documentation
    this.createdDocuments = [];
  }
}

/**
 * Utility to wait for async operations in tests
 */
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Validates API response structure
 */
export const validateApiResponse = (response: any, expectedFields: string[]) => {
  expectedFields.forEach(field => {
    expect(response).toHaveProperty(field);
  });
};

/**
 * Creates test insight data
 */
export const createTestInsightData = (overrides: any = {}) => ({
  type: 'weekly_summary',
  title: 'Test Insight',
  content: 'This is a test insight generated for testing purposes.',
  action: 'Continue monitoring your performance.',
  timestamp: new Date().toISOString(),
  metadata: {
    totalTrades: 10,
    winRate: 0.6,
    avgStake: 50,
    lossStreak: 2,
    aiGenerated: true,
  },
  ...overrides,
});

/**
 * Mock Firebase Firestore operations for testing
 */
export const createMockFirestore = () => {
  const mockCollection = jest.fn();
  const mockDoc = jest.fn();
  const mockGet = jest.fn();
  const mockSet = jest.fn();
  const mockAdd = jest.fn();
  const mockUpdate = jest.fn();
  const mockDelete = jest.fn();
  const mockWhere = jest.fn();
  const mockOrderBy = jest.fn();
  const mockLimit = jest.fn();

  const mockQuery = {
    get: mockGet,
    where: mockWhere.mockReturnThis(),
    orderBy: mockOrderBy.mockReturnThis(),
    limit: mockLimit.mockReturnThis(),
  };

  const mockDocRef = {
    get: mockGet,
    set: mockSet,
    update: mockUpdate,
    delete: mockDelete,
    collection: mockCollection.mockReturnValue(mockQuery),
  };

  mockCollection.mockReturnValue(mockQuery);
  mockDoc.mockReturnValue(mockDocRef);

  return {
    collection: mockCollection,
    doc: mockDoc,
    mockQuery,
    mockDocRef,
    mocks: {
      get: mockGet,
      set: mockSet,
      add: mockAdd,
      update: mockUpdate,
      delete: mockDelete,
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
    },
  };
};

export default {
  createMockRequest,
  createMockResponse,
  createAuthenticatedTestUser,
  createMultipleTestUsers,
  createAuthenticatedRequest,
  createTestTradeData,
  createTestRuleData,
  createTestCSVData,
  csvDataToString,
  TestCleanup,
  waitFor,
  validateApiResponse,
  createTestInsightData,
  createMockFirestore,
};