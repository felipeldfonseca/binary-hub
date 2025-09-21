import { Router, Request, Response } from 'express'
import { logger } from 'firebase-functions'
import socialService from '../services/socialService'

// Extend Express Request to include user property
interface AuthenticatedRequest extends Request {
  user?: {
    uid: string
    email?: string
    [key: string]: any
  }
}

const router = Router()

/**
 * POST /social/follow - Follow a user
 */
router.post('/follow', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { userId } = req.body
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' })
    }

    const result = await socialService.followUser(req.user.uid, userId)
    
    return res.json({
      success: true,
      requiresApproval: result.requiresApproval,
      message: result.requiresApproval 
        ? 'Follow request sent'
        : 'Successfully followed user'
    })
  } catch (error: any) {
    logger.error('Follow user error:', error)
    return res.status(400).json({ error: error.message })
  }
})

/**
 * POST /social/unfollow - Unfollow a user
 */
router.post('/unfollow', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { userId } = req.body
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' })
    }

    await socialService.unfollowUser(req.user.uid, userId)
    
    return res.json({
      success: true,
      message: 'Successfully unfollowed user'
    })
  } catch (error: any) {
    logger.error('Unfollow user error:', error)
    return res.status(400).json({ error: error.message })
  }
})

/**
 * POST /social/follow-requests/approve - Approve a follow request
 */
router.post('/follow-requests/approve', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { followerId } = req.body
    if (!followerId) {
      return res.status(400).json({ error: 'Follower ID is required' })
    }

    await socialService.approveFollowRequest(req.user.uid, followerId)
    
    return res.json({
      success: true,
      message: 'Follow request approved'
    })
  } catch (error: any) {
    logger.error('Approve follow request error:', error)
    return res.status(400).json({ error: error.message })
  }
})

/**
 * POST /social/follow-requests/reject - Reject a follow request
 */
router.post('/follow-requests/reject', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { followerId } = req.body
    if (!followerId) {
      return res.status(400).json({ error: 'Follower ID is required' })
    }

    await socialService.rejectFollowRequest(req.user.uid, followerId)
    
    return res.json({
      success: true,
      message: 'Follow request rejected'
    })
  } catch (error: any) {
    logger.error('Reject follow request error:', error)
    return res.status(400).json({ error: error.message })
  }
})

/**
 * GET /social/followers/:userId - Get user's followers
 */
router.get('/followers/:userId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params
    const { limit = '20', startAfter } = req.query

    const result = await socialService.getFollowers(
      userId, 
      parseInt(limit as string),
      startAfter as string
    )
    
    return res.json(result)
  } catch (error: any) {
    logger.error('Get followers error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /social/following/:userId - Get users that this user follows
 */
router.get('/following/:userId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params
    const { limit = '20', startAfter } = req.query

    const result = await socialService.getFollowing(
      userId, 
      parseInt(limit as string),
      startAfter as string
    )
    
    return res.json(result)
  } catch (error: any) {
    logger.error('Get following error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /social/follow-requests - Get pending follow requests for current user
 */
router.get('/follow-requests', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const requests = await socialService.getPendingFollowRequests(req.user.uid)
    
    return res.json({ requests })
  } catch (error: any) {
    logger.error('Get follow requests error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /social/follow-status/:userId - Get follow relationship status with a user
 */
router.get('/follow-status/:userId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { userId } = req.params
    const status = await socialService.getFollowStatus(req.user.uid, userId)
    
    return res.json(status)
  } catch (error: any) {
    logger.error('Get follow status error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /social/search/users - Search for users
 */
router.get('/search/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { q, limit = '20' } = req.query
    
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' })
    }

    const users = await socialService.searchUsers(
      q.trim(),
      parseInt(limit as string),
      req.user?.uid
    )
    
    return res.json({ users })
  } catch (error: any) {
    logger.error('Search users error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /social/posts - Create a new post
 */
router.post('/posts', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { content, visibility, tags, sharedTrade } = req.body
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Post content is required' })
    }

    if (content.length > 500) {
      return res.status(400).json({ error: 'Post content must be less than 500 characters' })
    }

    const post = await socialService.createPost(req.user.uid, {
      content: content.trim(),
      visibility: visibility || 'public',
      tags: tags || [],
      sharedTrade
    })
    
    return res.json({
      success: true,
      data: post
    })
  } catch (error: any) {
    logger.error('Create post error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /social/posts - Get posts feed
 */
router.get('/posts', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { feedType = 'home', userId, limit = '20', startAfter } = req.query

    const result = await socialService.getPosts(req.user.uid, {
      feedType: feedType as 'home' | 'following' | 'user',
      userId: userId as string,
      limit: parseInt(limit as string),
      startAfter: startAfter as string
    })
    
    return res.json(result)
  } catch (error: any) {
    logger.error('Get posts error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /social/posts/:postId/like - Like/unlike a post
 */
router.post('/posts/:postId/like', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { postId } = req.params
    const result = await socialService.likePost(req.user.uid, postId)
    
    return res.json({
      success: true,
      data: result
    })
  } catch (error: any) {
    logger.error('Like post error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /social/posts/:postId/comments - Add comment to post
 */
router.post('/posts/:postId/comments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { postId } = req.params
    const { content } = req.body
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required' })
    }

    if (content.length > 300) {
      return res.status(400).json({ error: 'Comment must be less than 300 characters' })
    }

    const comment = await socialService.addComment(req.user.uid, postId, content.trim())
    
    return res.json({
      success: true,
      data: comment
    })
  } catch (error: any) {
    logger.error('Add comment error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * DELETE /social/posts/:postId - Delete a post
 */
router.delete('/posts/:postId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    const { postId } = req.params
    await socialService.deletePost(req.user.uid, postId)
    
    return res.json({
      success: true,
      message: 'Post deleted successfully'
    })
  } catch (error: any) {
    logger.error('Delete post error:', error)
    return res.status(400).json({ error: error.message })
  }
})

export default router