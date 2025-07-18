import { jest } from '@jest/globals';

// Mock OpenAI before importing the service
const mockCreate = jest.fn() as jest.MockedFunction<any>;

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  };
});

// Mock Firebase Functions logger
jest.mock('firebase-functions', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
  },
}));

// Now import the service after mocking
import { 
  generateInsight, 
  generateTradeCoach, 
  checkTradeRules, 
  validateCSVHeaders 
} from '../../services/openai';

describe('OpenAI Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateInsight', () => {
    it('should generate insight successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              insight: 'Sua taxa de vitória de 65% está acima da média. Continue mantendo a disciplina.',
              kpi: { winRate: 65, lossStreak: 2 },
              acao: 'Mantenha o foco na gestão de risco.'
            })
          }
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await generateInsight({
        uid: 'test-uid',
        firstName: 'João',
        kpi: {
          winRate: 65,
          avgStake: 50,
          lossStreak: 2
        },
        ruleBrokenMost: 'Nenhuma regra quebrada'
      });

      expect(result).toEqual({
        insight: 'Sua taxa de vitória de 65% está acima da média. Continue mantendo a disciplina.',
        kpi: { winRate: 65, lossStreak: 2 },
        acao: 'Mantenha o foco na gestão de risco.'
      });

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 400,
        top_p: 1.0,
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' })
        ])
      });
    });

    it('should return fallback response on error', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      const result = await generateInsight({
        uid: 'test-uid',
        firstName: 'João',
        kpi: {
          winRate: 45,
          avgStake: 50,
          lossStreak: 5
        }
      });

      expect(result).toEqual({
        insight: 'Sua taxa de vitória atual é 45%. Considere revisar sua estratégia após sequências de perdas.',
        kpi: { winRate: 45, lossStreak: 5 },
        acao: 'Mantenha o foco na gestão de risco e siga suas regras de trading.'
      });
    });

    it('should handle empty response from OpenAI', async () => {
      const mockResponse = {
        choices: [{ message: { content: null } }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await generateInsight({
        uid: 'test-uid',
        kpi: {
          winRate: 60,
          avgStake: 50,
          lossStreak: 1
        }
      });

      expect(result.insight).toContain('Sua taxa de vitória atual é 60%');
      expect(result.kpi.winRate).toBe(60);
      expect(result.acao).toBe('Mantenha o foco na gestão de risco e siga suas regras de trading.');
    });
  });

  describe('generateTradeCoach', () => {
    it('should generate coaching response successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Olá João! Perdas fazem parte do processo. Mantenha a disciplina e foque no longo prazo. "A disciplina é a ponte entre objetivos e realizações." - Jim Rohn'
          }
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await generateTradeCoach({
        firstName: 'João',
        situation: 'Perdeu 3 trades seguidos e precisa de motivação'
      });

      expect(result.message).toContain('Olá João!');
      expect(result.quote).toContain('Jim Rohn');
      
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        max_tokens: 250,
        top_p: 1.0,
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' })
        ])
      });
    });

    it('should return fallback response on error', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      const result = await generateTradeCoach({
        firstName: 'Maria',
        situation: 'Perdeu muito dinheiro'
      });

      expect(result.message).toContain('Olá Maria!');
      expect(result.quote).toContain('Jim Rohn');
    });
  });

  describe('checkTradeRules', () => {
    it('should check trade rules successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              violations: [
                { rule: 'Operar só 19h-20h', violated: true, reason: 'Trade executado às 15h' },
                { rule: 'Máximo 3 trades por dia', violated: false }
              ]
            })
          }
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await checkTradeRules({
        trade: { asset: 'EURUSD', time: '15:00', direction: 'CALL' },
        rules: ['Operar só 19h-20h', 'Máximo 3 trades por dia']
      });

      expect(result.violations).toHaveLength(2);
      expect(result.violations[0].violated).toBe(true);
      expect(result.violations[0].reason).toBe('Trade executado às 15h');
      expect(result.violations[1].violated).toBe(false);
    });

    it('should return fallback response on error', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      const rules = ['Regra 1', 'Regra 2'];
      const result = await checkTradeRules({
        trade: { asset: 'EURUSD' },
        rules
      });

      expect(result.violations).toHaveLength(2);
      expect(result.violations[0].rule).toBe('Regra 1');
      expect(result.violations[0].violated).toBe(false);
      expect(result.violations[0].reason).toBe('Erro na análise automática');
    });
  });

  describe('validateCSVHeaders', () => {
    it('should validate CSV headers successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              missingColumns: ['Payout'],
              extraColumns: ['Extra'],
              isValid: false
            })
          }
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await validateCSVHeaders({
        receivedHeaders: ['ID', 'Data', 'Ativo', 'Extra'],
        expectedHeaders: ['ID', 'Data', 'Ativo', 'Payout']
      });

      expect(result.missingColumns).toEqual(['Payout']);
      expect(result.extraColumns).toEqual(['Extra']);
      expect(result.isValid).toBe(false);
    });

    it('should return fallback validation on error', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      const result = await validateCSVHeaders({
        receivedHeaders: ['ID', 'Data'],
        expectedHeaders: ['ID', 'Data', 'Ativo']
      });

      expect(result.missingColumns).toEqual(['Ativo']);
      expect(result.extraColumns).toEqual([]);
      expect(result.isValid).toBe(false);
    });

    it('should validate correctly when headers match', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              missingColumns: [],
              extraColumns: [],
              isValid: true
            })
          }
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await validateCSVHeaders({
        receivedHeaders: ['ID', 'Data', 'Ativo'],
        expectedHeaders: ['ID', 'Data', 'Ativo']
      });

      expect(result.missingColumns).toEqual([]);
      expect(result.extraColumns).toEqual([]);
      expect(result.isValid).toBe(true);
    });
  });
}); 