import { Router, Request, Response } from 'express';
import { logger } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';

// Extend Express Request to include user property
interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    [key: string]: any;
  };
}

const router = Router();
const db = getFirestore();

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

/**
 * PUT /auth/profile - Update user profile with social fields
 */
router.put('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { username, bio, location, website, tradingSince, privacy, socialPreferences } = req.body;
    const uid = req.user.uid;

    // Validate username if provided
    if (username) {
      if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
      }
      
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
      }

      // Check if username already exists (excluding current user)
      const usernamesRef = db.collection('usernames');
      const existingUsernameQuery = await usernamesRef.where('username', '==', username).get();
      
      if (!existingUsernameQuery.empty) {
        const existingDoc = existingUsernameQuery.docs[0];
        if (existingDoc.data().uid !== uid) {
          return res.status(409).json({ error: 'Username already taken' });
        }
      }
    }

    // Update user profile
    const userRef = db.collection('users').doc(uid);
    const updateData: any = {
      updatedAt: new Date()
    };

    if (username !== undefined) updateData.username = username;
    if (bio !== undefined) updateData.bio = bio;
    if (location !== undefined) updateData.location = location;
    if (website !== undefined) updateData.website = website;
    if (tradingSince !== undefined) updateData.tradingSince = tradingSince;
    if (privacy !== undefined) updateData.privacy = privacy;
    if (socialPreferences !== undefined) updateData.socialPreferences = socialPreferences;

    await userRef.update(updateData);

    // Handle username mapping if username was updated
    if (username) {
      const userDoc = await userRef.get();
      const oldUsername = userDoc.data()?.username;

      // Update username collection
      if (oldUsername && oldUsername !== username) {
        await db.collection('usernames').doc(oldUsername).delete();
      }
      
      await db.collection('usernames').doc(username).set({
        uid,
        username,
        createdAt: new Date()
      });
    }

    return res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    logger.error('Update profile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /auth/profile/:username - Get public profile by username
 */
router.get('/profile/:username', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username } = req.params;
    
    // Get username mapping
    const usernameDoc = await db.collection('usernames').doc(username).get();
    if (!usernameDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const uid = usernameDoc.data()?.uid;
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userData = userDoc.data();
    
    // Return public profile (hide sensitive data)
    const publicProfile = {
      id: userData?.uid,
      displayName: userData?.displayName,
      username: userData?.username,
      bio: userData?.bio,
      photoURL: userData?.photoURL || '',
      location: userData?.location,
      website: userData?.website,
      tradingSince: userData?.tradingSince,
      socialStats: userData?.socialStats || {
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        likesReceived: 0
      },
      recentAchievements: userData?.recentAchievements || []
    };

    return res.json(publicProfile);
  } catch (error) {
    logger.error('Get public profile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/username/check - Check if username is available
 */
router.post('/username/check', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Validate username format
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
    }

    // Check if username exists
    const usernameDoc = await db.collection('usernames').doc(username).get();
    const available = !usernameDoc.exists;

    return res.json({ 
      available,
      username,
      message: available ? 'Username is available' : 'Username is taken'
    });
  } catch (error) {
    logger.error('Username check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;