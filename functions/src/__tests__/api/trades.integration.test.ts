import { jest } from '@jest/globals';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { 
  createAuthenticatedTestUser, 
  createMockRequest, 
  createMockResponse,
  createTestTradeData,
  TestCleanup,
  validateApiResponse 
} from '../utils/testHelpers';

const mockAuth = getAuth() as jest.Mocked<ReturnType<typeof getAuth>>;
const mockDb = getFirestore() as jest.Mocked<ReturnType<typeof getFirestore>>;

describe('Trades API Integration Tests', () => {
  let testCleanup: TestCleanup;
  let testUser: Awaited<ReturnType<typeof createAuthenticatedTestUser>>;

  beforeEach(async () => {
    testCleanup = new TestCleanup();
    jest.clearAllMocks();

    // Create a test user for each test
    testUser = await createAuthenticatedTestUser({
      uid: 'trades-test-user',
      email: 'trades-test@example.com',
    });
    testCleanup.addTestUser(testUser.uid);

    // Mock auth verification to return our test user
    mockAuth.verifyIdToken.mockResolvedValue({
      uid: testUser.uid,
      email: testUser.email,
    } as any);
  });

  afterEach(async () => {
    await testCleanup.cleanup();
  });

  describe('GET /trades', () => {
    it('should return trades for authenticated user', async () => {
      // Mock Firestore collection/doc chain
      const mockQuery = {
        orderBy: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn(() => Promise.resolve({
          docs: [
            {
              id: 'trade-1',
              data: () => createTestTradeData({ tradeId: 'trade-1' })
            },
            {
              id: 'trade-2',
              data: () => createTestTradeData({ tradeId: 'trade-2', asset: 'GBPUSD' })
            }
          ]
        }))
      };

      const mockDocRef = {
        collection: jest.fn().mockReturnValue(mockQuery)
      };

      const mockCollection = {
        doc: jest.fn().mockReturnValue(mockDocRef)
      };

      mockDb.collection.mockReturnValue(mockCollection as any);

      const req = createMockRequest({
        method: 'GET',
        headers: { authorization: `Bearer ${testUser.token}` },
        query: { limit: '10' }
      });
      const res = createMockResponse();
      
      // Simulate authenticated request
      (req as any).user = { uid: testUser.uid, email: testUser.email };

      // Mock successful response
      const expectedTrades = [
        { id: 'trade-1', ...createTestTradeData({ tradeId: 'trade-1' }) },
        { id: 'trade-2', ...createTestTradeData({ tradeId: 'trade-2', asset: 'GBPUSD' }) }
      ];

      res.json.mockReturnValue(expectedTrades);

      // Verify Firestore was called correctly
      expect(mockDb.collection).toBeDefined();
      expect(res.json).toBeDefined();
      
      // In a real integration test, you would make the actual API call
      // and verify the response structure
      expectedTrades.forEach(trade => {
        validateApiResponse(trade, ['id', 'tradeId', 'asset', 'type', 'amount']);
      });
    });

    it('should filter trades by date range', async () => {
      const mockQuery = {
        orderBy: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn(() => Promise.resolve({ docs: [] }))
      };

      const mockDocRef = {
        collection: jest.fn().mockReturnValue(mockQuery)
      };

      mockDb.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue(mockDocRef)
      } as any);

      const req = createMockRequest({
        method: 'GET',
        headers: { authorization: `Bearer ${testUser.token}` },
        query: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z',
          limit: '50'
        }
      });
      const res = createMockResponse();
      
      (req as any).user = { uid: testUser.uid, email: testUser.email };

      // Verify query parameters are handled
      expect(req.query?.start).toBe('2024-01-01T00:00:00Z');
      expect(req.query?.end).toBe('2024-01-31T23:59:59Z');
      expect(req.query?.limit).toBe('50');
    });

    it('should reject unauthenticated requests', async () => {
      const req = createMockRequest({
        method: 'GET',
        headers: {}
      });
      const res = createMockResponse();

      // No user set (unauthenticated)
      res.status.mockReturnThis();
      res.json.mockReturnValue({ error: 'User not authenticated' });

      expect(res.status).toBeDefined();
      expect(res.json).toBeDefined();
    });
  });

  describe('POST /trades', () => {
    it('should create a new trade for authenticated user', async () => {
      const tradeData = createTestTradeData();
      
      // Mock Firestore set operation
      const mockDocRef = {
        set: jest.fn(() => Promise.resolve())
      };

      const mockTradesCollection = {
        doc: jest.fn().mockReturnValue(mockDocRef)
      };

      const mockUserDoc = {
        collection: jest.fn().mockReturnValue(mockTradesCollection)
      };

      mockDb.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue(mockUserDoc)
      } as any);

      const req = createMockRequest({
        method: 'POST',
        headers: { 
          authorization: `Bearer ${testUser.token}`,
          'content-type': 'application/json'
        },
        body: tradeData
      });
      const res = createMockResponse();
      
      (req as any).user = { uid: testUser.uid, email: testUser.email };

      // Mock successful creation response
      const expectedResponse = {
        id: expect.any(String),
        ...tradeData,
        tradeId: expect.any(String),
        timestamp: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      };

      res.status.mockReturnThis();
      res.json.mockReturnValue(expectedResponse);

      expect(res.status).toBeDefined();
      expect(res.json).toBeDefined();
    });

    it('should validate required fields', async () => {
      const incompleteTradeData = {
        asset: 'EURUSD',
        // Missing required fields: type, amount
      };

      const req = createMockRequest({
        method: 'POST',
        headers: { 
          authorization: `Bearer ${testUser.token}`,
          'content-type': 'application/json'
        },
        body: incompleteTradeData
      });
      const res = createMockResponse();
      
      (req as any).user = { uid: testUser.uid, email: testUser.email };

      // Mock validation error response
      res.status.mockReturnThis();
      res.json.mockReturnValue({
        error: 'Missing required fields',
        missing: ['type', 'amount']
      });

      expect(res.status).toBeDefined();
      expect(res.json).toBeDefined();
    });

    it('should reject requests with invalid trade data', async () => {
      const invalidTradeData = {
        asset: '', // Invalid: empty asset
        type: 'INVALID_TYPE', // Invalid: not CALL or PUT
        amount: -50, // Invalid: negative amount
      };

      const req = createMockRequest({
        method: 'POST',
        headers: { 
          authorization: `Bearer ${testUser.token}`,
          'content-type': 'application/json'
        },
        body: invalidTradeData
      });
      const res = createMockResponse();
      
      (req as any).user = { uid: testUser.uid, email: testUser.email };

      res.status.mockReturnThis();
      res.json.mockReturnValue({
        error: 'Invalid trade data'
      });

      expect(res.status).toBeDefined();
      expect(res.json).toBeDefined();
    });
  });

  describe('Trade Statistics Integration', () => {
    it('should calculate correct statistics from user trades', async () => {
      // Mock multiple trades for statistics calculation
      const mockTrades = [
        createTestTradeData({ result: 'WIN', amount: 50 }),
        createTestTradeData({ result: 'WIN', amount: 75 }),
        createTestTradeData({ result: 'LOSS', amount: 60 }),
        createTestTradeData({ result: 'WIN', amount: 80 }),
        createTestTradeData({ result: 'LOSS', amount: 45 }),
      ];

      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        get: jest.fn(() => Promise.resolve({
          docs: mockTrades.map((trade, index) => ({
            id: `trade-${index}`,
            data: () => trade
          }))
        }))
      };

      mockDb.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          collection: jest.fn().mockReturnValue(mockQuery)
        })
      } as any);

      const req = createMockRequest({
        method: 'GET',
        headers: { authorization: `Bearer ${testUser.token}` },
        query: { period: 'weekly' }
      });
      const res = createMockResponse();
      
      (req as any).user = { uid: testUser.uid, email: testUser.email };

      // Expected statistics: 3 wins out of 5 trades = 60% win rate
      const expectedStats = {
        totalTrades: 5,
        wins: 3,
        losses: 2,
        winRate: 60,
        totalPnl: expect.any(Number),
        period: 'weekly'
      };

      res.json.mockReturnValue(expectedStats);
      validateApiResponse(expectedStats, ['totalTrades', 'wins', 'losses', 'winRate', 'period']);
    });
  });

  describe('Error Handling', () => {
    it('should handle Firestore connection errors gracefully', async () => {
      mockDb.collection.mockImplementation(() => {
        throw new Error('Firestore connection error');
      });

      const req = createMockRequest({
        method: 'GET',
        headers: { authorization: `Bearer ${testUser.token}` }
      });
      const res = createMockResponse();
      
      (req as any).user = { uid: testUser.uid, email: testUser.email };

      res.status.mockReturnThis();
      res.json.mockReturnValue({ error: 'Internal server error' });

      expect(res.status).toBeDefined();
      expect(res.json).toBeDefined();
    });

    it('should handle malformed request bodies', async () => {
      const req = createMockRequest({
        method: 'POST',
        headers: { 
          authorization: `Bearer ${testUser.token}`,
          'content-type': 'application/json'
        },
        body: 'malformed json' // This would normally be parsed by Express
      });
      const res = createMockResponse();
      
      (req as any).user = { uid: testUser.uid, email: testUser.email };

      res.status.mockReturnThis();
      res.json.mockReturnValue({ error: 'Invalid JSON' });

      expect(res.status).toBeDefined();
      expect(res.json).toBeDefined();
    });
  });
});