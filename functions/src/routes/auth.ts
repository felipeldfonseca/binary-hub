import { Router, Request, Response } from 'express';
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

/**
 * POST /auth/exchange-token - Exchange Firebase ID token
 */
router.post('/exchange-token', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    return res.json({
      token: req.headers.authorization?.split(' ')[1],
      uid: req.user.uid,
      email: req.user.email,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString() // 1 hour
    });
  } catch (error) {
    logger.error('Token exchange error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /auth/profile - Get user profile
 */
router.get('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    return res.json({
      uid: req.user.uid,
      email: req.user.email
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;