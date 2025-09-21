import { Router, Request, Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { checkTradeRules, validateCSVHeaders } from '../services/openai';

// Extend Express Request to include user property
interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    [key: string]: any;
  };
}

const router = Router();
// Firebase admin is initialized in the main index.ts
const getDb = () => getFirestore();

/**
 * GET /trades - List user trades (legacy endpoint)
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const uid = req.user.uid;
    const db = getDb();
    const { start, end, limit = 100 } = req.query;

    let query = db.collection('trades').doc(uid).collection('trades')
      .orderBy('timestamp', 'desc');

    if (start) {
      query = query.where('timestamp', '>=', start);
    }
    if (end) {
      query = query.where('timestamp', '<=', end);
    }

    query = query.limit(Math.min(Number(limit), 1000));

    const snapshot = await query.get();
    const trades = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.json(trades);
  } catch (error) {
    logger.error('Get trades error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /trades - Create trade (legacy endpoint)
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const uid = req.user.uid;
    const db = getDb();
    const tradeData = req.body;

    // Validate required fields
    const requiredFields = ['asset', 'type', 'amount'];
    const missingFields = requiredFields.filter(field => !tradeData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        missing: missingFields 
      });
    }

    // Generate trade ID
    const tradeId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const trade = {
      tradeId,
      asset: tradeData.asset,
      type: tradeData.type,
      amount: tradeData.amount,
      entry_price: tradeData.entry_price,
      exit_price: tradeData.exit_price,
      result: tradeData.result || 'OPEN',
      platform: tradeData.platform || 'Manual',
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.collection('trades').doc(uid).collection('trades').doc(tradeId).set(trade);

    return res.status(201).json({ id: tradeId, ...trade });
  } catch (error) {
    logger.error('Create trade error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /trades/check-rules - Check trade against rules
 */
router.post('/check-rules', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const uid = req.user.uid;
    const db = getDb();
    const { trade } = req.body;
    
    if (!trade) {
      return res.status(400).json({ error: 'Trade data is required' });
    }
    
    // Get user's active rules
    const rulesSnapshot = await db.collection('rules').doc(uid).collection('rules')
      .where('active', '==', true)
      .get();
    
    if (rulesSnapshot.empty) {
      return res.json({ violations: [] });
    }
    
    const rules = rulesSnapshot.docs.map(doc => doc.data());
    const ruleDescriptions = rules.map(r => r.description || r.name || 'Regra não especificada');
    
    // Check rules using AI
    const ruleCheck = await checkTradeRules({
      trade,
      rules: ruleDescriptions
    });
    
    return res.json(ruleCheck);
  } catch (error) {
    logger.error('Check trade rules error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /trades/validate-csv - Validate CSV headers
 */
router.post('/validate-csv', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { headers } = req.body;
    
    if (!headers || !Array.isArray(headers)) {
      return res.status(400).json({ error: 'Headers array is required' });
    }
    
    // Expected headers for Ebinex CSV
    const expectedHeaders = [
      'ID',
      'Data',
      'Ativo',
      'Direção',
      'Valor',
      'Resultado',
      'Payout',
      'Horário'
    ];
    
    // Validate using AI
    const validation = await validateCSVHeaders({
      receivedHeaders: headers,
      expectedHeaders
    });
    
    return res.json(validation);
  } catch (error) {
    logger.error('Validate CSV headers error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;