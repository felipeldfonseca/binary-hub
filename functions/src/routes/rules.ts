import { Router, Request, Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

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
 * GET /rules - Get user rules
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const uid = req.user.uid;
    const db = getDb();
    const snapshot = await db.collection('rules').doc(uid).collection('rules').get();
    
    const rules = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.json(rules);
  } catch (error) {
    logger.error('Get rules error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /rules - Create new rule
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const uid = req.user.uid;
    const db = getDb();
    const ruleData = req.body;

    // Validate required fields
    const requiredFields = ['title', 'description', 'category'];
    const missingFields = requiredFields.filter(field => !ruleData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        missing: missingFields 
      });
    }

    const ruleId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const rule = {
      ruleId,
      title: ruleData.title,
      description: ruleData.description,
      category: ruleData.category,
      is_active: ruleData.is_active || true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.collection('rules').doc(uid).collection('rules').doc(ruleId).set(rule);

    return res.status(201).json({ id: ruleId, ...rule });
  } catch (error) {
    logger.error('Create rule error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;