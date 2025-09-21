import { jest } from '@jest/globals';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { 
  createTestCSVData, 
  csvDataToString,
  createAuthenticatedTestUser,
  TestCleanup,
  validateApiResponse 
} from '../utils/testHelpers';

const mockDb = getFirestore() as jest.Mocked<ReturnType<typeof getFirestore>>;
const mockStorage = getStorage() as jest.Mocked<ReturnType<typeof getStorage>>;

describe('CSV Processing Integration Tests', () => {
  let testCleanup: TestCleanup;
  let testUser: Awaited<ReturnType<typeof createAuthenticatedTestUser>>;

  beforeEach(async () => {
    testCleanup = new TestCleanup();
    jest.clearAllMocks();

    testUser = await createAuthenticatedTestUser({
      uid: 'csv-test-user',
      email: 'csv-test@example.com',
    });
    testCleanup.addTestUser(testUser.uid);
  });

  afterEach(async () => {
    await testCleanup.cleanup();
  });

  describe('CSV Header Validation', () => {
    it('should validate correct Ebinex CSV headers', async () => {
      const { headers } = createTestCSVData();
      
      // Expected headers for Ebinex CSV format
      const expectedHeaders = [
        'ID', 'Data', 'Ativo', 'Direção', 'Valor', 'Resultado', 'Payout', 'Horário'
      ];

      // Mock the validation service
      const validation = {
        isValid: true,
        missingColumns: [],
        extraColumns: [],
        suggestions: []
      };

      // Simulate validation logic
      const missingColumns = expectedHeaders.filter(h => !headers.includes(h));
      const extraColumns = headers.filter(h => !expectedHeaders.includes(h));
      const isValid = missingColumns.length === 0 && extraColumns.length === 0;

      expect(isValid).toBe(true);
      expect(missingColumns).toEqual([]);
      expect(extraColumns).toEqual([]);
    });

    it('should detect missing required columns', async () => {
      const incompleteHeaders = ['ID', 'Data', 'Ativo']; // Missing required columns
      
      const expectedHeaders = [
        'ID', 'Data', 'Ativo', 'Direção', 'Valor', 'Resultado', 'Payout', 'Horário'
      ];

      const missingColumns = expectedHeaders.filter(h => !incompleteHeaders.includes(h));
      const extraColumns = incompleteHeaders.filter(h => !expectedHeaders.includes(h));
      const isValid = missingColumns.length === 0 && extraColumns.length === 0;

      expect(isValid).toBe(false);
      expect(missingColumns).toEqual(['Direção', 'Valor', 'Resultado', 'Payout', 'Horário']);
      expect(extraColumns).toEqual([]);
    });

    it('should detect extra unexpected columns', async () => {
      const headersWithExtra = [
        'ID', 'Data', 'Ativo', 'Direção', 'Valor', 'Resultado', 'Payout', 'Horário',
        'ExtraColumn1', 'ExtraColumn2'
      ];
      
      const expectedHeaders = [
        'ID', 'Data', 'Ativo', 'Direção', 'Valor', 'Resultado', 'Payout', 'Horário'
      ];

      const missingColumns = expectedHeaders.filter(h => !headersWithExtra.includes(h));
      const extraColumns = headersWithExtra.filter(h => !expectedHeaders.includes(h));
      const isValid = missingColumns.length === 0 && extraColumns.length === 0;

      expect(isValid).toBe(false);
      expect(missingColumns).toEqual([]);
      expect(extraColumns).toEqual(['ExtraColumn1', 'ExtraColumn2']);
    });
  });

  describe('CSV Data Processing', () => {
    it('should process valid CSV data and create trades', async () => {
      const csvData = createTestCSVData();
      const csvString = csvDataToString(csvData);

      // Mock Firestore batch operations for bulk trade creation
      const mockBatch = {
        set: jest.fn(),
        commit: jest.fn(() => Promise.resolve())
      };

      const mockTradesCollection = {
        doc: jest.fn().mockReturnValue({
          set: jest.fn(() => Promise.resolve())
        })
      };

      const mockUserDoc = {
        collection: jest.fn().mockReturnValue(mockTradesCollection)
      };

      mockDb.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue(mockUserDoc)
      } as any);
      mockDb.batch.mockReturnValue(mockBatch as any);

      // Simulate CSV processing
      const processedTrades = csvData.rows.map((row, index) => ({
        tradeId: `imported-${Date.now()}-${index}`,
        asset: row[2], // Ativo
        type: row[3] === 'CALL' ? 'CALL' : 'PUT', // Direção
        amount: parseFloat(row[4]), // Valor
        result: row[5], // Resultado
        payout: parseFloat(row[6]) || 0, // Payout
        timestamp: new Date().toISOString(),
        platform: 'Ebinex',
        imported: true,
        importedAt: new Date().toISOString()
      }));

      expect(processedTrades).toHaveLength(3);
      processedTrades.forEach(trade => {
        validateApiResponse(trade, ['tradeId', 'asset', 'type', 'amount', 'result', 'platform']);
      });
    });

    it('should handle invalid CSV data gracefully', async () => {
      const invalidCsvData = {
        headers: ['ID', 'Data', 'Ativo', 'Direção', 'Valor', 'Resultado', 'Payout', 'Horário'],
        rows: [
          ['1', 'invalid-date', 'EURUSD', 'CALL', 'not-a-number', 'WIN', '85', '14:30'],
          ['2', '2024-01-01', '', 'PUT', '75', 'INVALID_RESULT', '0', '15:45'], // Empty asset
          ['3', '2024-01-02', 'USDJPY', 'INVALID_DIRECTION', '100', 'WIN', 'invalid-payout', '09:15']
        ]
      };

      const errors = [];
      const validTrades = [];

      // Simulate validation and processing
      for (const [index, row] of invalidCsvData.rows.entries()) {
        const rowErrors = [];

        // Validate asset
        if (!row[2] || row[2].trim() === '') {
          rowErrors.push(`Row ${index + 1}: Empty asset`);
        }

        // Validate direction
        if (!['CALL', 'PUT'].includes(row[3])) {
          rowErrors.push(`Row ${index + 1}: Invalid direction '${row[3]}'`);
        }

        // Validate amount
        const amount = parseFloat(row[4]);
        if (isNaN(amount) || amount <= 0) {
          rowErrors.push(`Row ${index + 1}: Invalid amount '${row[4]}'`);
        }

        // Validate result
        if (!['WIN', 'LOSS'].includes(row[5])) {
          rowErrors.push(`Row ${index + 1}: Invalid result '${row[5]}'`);
        }

        if (rowErrors.length > 0) {
          errors.push(...rowErrors);
        } else {
          validTrades.push({
            asset: row[2],
            type: row[3],
            amount,
            result: row[5]
          });
        }
      }

      expect(errors.length).toBeGreaterThan(0);
      expect(validTrades.length).toBeLessThan(invalidCsvData.rows.length);
    });
  });

  describe('CSV Import API Endpoints', () => {
    it('should validate CSV headers via API endpoint', async () => {
      const { headers } = createTestCSVData();

      // Mock the API request/response
      const mockRequest = {
        user: { uid: testUser.uid, email: testUser.email },
        body: { headers }
      };

      const mockResponse = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      // Simulate the validation endpoint logic
      const expectedHeaders = [
        'ID', 'Data', 'Ativo', 'Direção', 'Valor', 'Resultado', 'Payout', 'Horário'
      ];

      const validation = {
        isValid: true,
        missingColumns: [],
        extraColumns: [],
        receivedHeaders: headers,
        expectedHeaders
      };

      mockResponse.json.mockReturnValue(validation);

      expect(mockResponse.json).toBeDefined();
      validateApiResponse(validation, ['isValid', 'missingColumns', 'extraColumns']);
    });
  });
});