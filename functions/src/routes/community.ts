import { Router } from 'express'
import { AuthenticatedRequest } from '../types'
import { db } from '../lib/firebase'
import { logger } from 'firebase-functions'
import * as admin from 'firebase-admin'
import Joi from 'joi'

const router = Router()

// Validation schemas
const shareTradeSchema = Joi.object({
  tradeId: Joi.string().required(),
  title: Joi.string().min(1).max(200).required(),
  description: Joi.string().max(1000).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(10).default([]),
  privacy: Joi.string().valid('public', 'followers', 'private').default('public'),
  shareToFeed: Joi.boolean().default(true),
  notifyFollowers: Joi.boolean().default(false)
})

const createPostSchema = Joi.object({
  type: Joi.string().valid('text', 'trade-share', 'poll', 'ai-question', 'market-analysis').required(),
  content: Joi.string().min(1).max(500).required(),
  tradeId: Joi.string().optional(),
  poll: Joi.object({
    question: Joi.string().max(200).required(),
    options: Joi.array().items(
      Joi.object({
        id: Joi.string().required(),
        text: Joi.string().min(1).max(100).required()
      })
    ).min(2).max(4).required(),
    duration: Joi.number().integer().valid(1, 6, 12, 24, 168).default(24)
  }).optional(),
  aiQuestion: Joi.object({
    question: Joi.string().max(300).required(),
    context: Joi.string().max(500).optional()
  }).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(10).default([]),
  privacy: Joi.string().valid('public', 'followers', 'private').default('public'),
  shareToFeed: Joi.boolean().default(true),
  notifyFollowers: Joi.boolean().default(false)
})

const commentSchema = Joi.object({
  content: Joi.string().min(1).max(500).required(),
  parentId: Joi.string().optional()
})

const feedFiltersSchema = Joi.object({
  timeframe: Joi.string().valid('1h', '24h', '7d', '30d').default('24h'),
  asset: Joi.string().optional(),
  result: Joi.string().valid('win', 'loss').optional(),
  strategy: Joi.string().optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  sortBy: Joi.string().valid('recent', 'popular', 'trending', 'mostLiked').default('recent'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20)
})

// Helper functions
const calculateTrendingScore = (likes: number, comments: number, shares: number, views: number, hoursOld: number) => {
  const engagementScore = likes * 2 + comments * 3 + shares * 4 + views * 0.1
  const timeDecay = Math.exp(-hoursOld / 24) // Exponential decay over 24 hours
  return engagementScore * timeDecay
}

const getUserDisplayInfo = async (userId: string) => {
  const userDoc = await db.collection('users').doc(userId).get()
  if (!userDoc.exists) {
    return {
      displayName: 'Anonymous Trader',
      avatar: null,
      tier: 'Bronze' as const,
      isVerified: false
    }
  }
  
  const userData = userDoc.data()!
  return {
    displayName: userData.firstName ? `${userData.firstName} ${userData.lastName || ''}`.trim() : 'Anonymous Trader',
    avatar: userData.avatar || null,
    tier: userData.tier || 'Bronze',
    isVerified: userData.isVerified || false
  }
}

// POST /community/create-post - Create a community post
router.post('/create-post', async (req: AuthenticatedRequest, res) => {
  try {
    const { error, value } = createPostSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      })
    }

    const { type, content, tradeId, poll, aiQuestion, tags, privacy, shareToFeed, notifyFollowers } = value
    const userId = req.user!.uid
    const userInfo = await getUserDisplayInfo(userId)

    // Base post data
    let postData: any = {
      userId,
      type,
      content,
      tags,
      
      // Community features
      likes: 0,
      comments: [],
      shares: 0,
      views: 0,
      
      // Privacy & moderation
      isPublic: privacy === 'public',
      isVerified: true,
      moderationStatus: 'approved',
      
      // User info
      userDisplayName: userInfo.displayName,
      userAvatar: userInfo.avatar,
      userTier: userInfo.tier,
      
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Handle specific post types
    if (type === 'trade-share' && tradeId) {
      const tradeDoc = await db.collection('trades').doc(userId).collection('trades').doc(tradeId).get()
      if (!tradeDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'Trade not found'
        })
      }
      
      const tradeData = tradeDoc.data()!
      postData = {
        ...postData,
        tradeId,
        // Trade snapshot
        asset: tradeData.asset,
        direction: tradeData.direction,
        amount: tradeData.amount,
        result: tradeData.result,
        profit: tradeData.profit || 0,
        entryTime: tradeData.entryTime,
        exitTime: tradeData.exitTime,
        entryPrice: tradeData.entryPrice,
        exitPrice: tradeData.exitPrice
      }
    } else if (type === 'poll' && poll) {
      postData = {
        ...postData,
        poll: {
          ...poll,
          votes: {},
          totalVotes: 0,
          expiresAt: new Date(Date.now() + poll.duration * 60 * 60 * 1000)
        }
      }
    } else if (type === 'ai-question' && aiQuestion) {
      postData = {
        ...postData,
        aiQuestion,
        aiResponse: null, // Will be populated by AI service
        aiProcessing: true
      }
    }

    const postRef = await db.collection('communityPosts').add(postData)
    
    // If it's an AI question, trigger AI processing (in a real app)
    if (type === 'ai-question') {
      // This would trigger an async AI processing job
      console.log('AI question queued for processing:', postRef.id)
    }
    
    logger.info('Community post created', { userId, postId: postRef.id, type })

    res.json({
      success: true,
      data: {
        id: postRef.id,
        ...postData
      },
      message: 'Post created successfully'
    })

  } catch (error) {
    logger.error('Error creating post', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// POST /community/share-trade - Share a trade to the community
router.post('/share-trade', async (req: AuthenticatedRequest, res) => {
  try {
    const { error, value } = shareTradeSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      })
    }

    const { tradeId, title, description, tags, privacy, shareToFeed, notifyFollowers } = value
    const userId = req.user!.uid

    // Verify the trade exists and belongs to the user
    const tradeDoc = await db.collection('trades').doc(userId).collection('trades').doc(tradeId).get()
    if (!tradeDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Trade not found'
      })
    }

    const tradeData = tradeDoc.data()!
    const userInfo = await getUserDisplayInfo(userId)

    // Create shared trade document
    const sharedTradeData = {
      userId,
      tradeId,
      title,
      description: description || '',
      tags,
      
      // Trade snapshot
      asset: tradeData.asset,
      direction: tradeData.direction,
      amount: tradeData.amount,
      result: tradeData.result,
      profit: tradeData.profit || 0,
      entryTime: tradeData.entryTime,
      exitTime: tradeData.exitTime,
      entryPrice: tradeData.entryPrice,
      exitPrice: tradeData.exitPrice,
      
      // Community features
      likes: 0,
      comments: [],
      shares: 0,
      views: 0,
      
      // Privacy & moderation
      isPublic: privacy === 'public',
      isVerified: true, // Auto-verify since it's from our system
      moderationStatus: 'approved',
      
      // User info
      userDisplayName: userInfo.displayName,
      userAvatar: userInfo.avatar,
      userTier: userInfo.tier,
      
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const sharedTradeRef = await db.collection('communityTrades').add(sharedTradeData)
    
    logger.info('Trade shared to community', { userId, tradeId, sharedTradeId: sharedTradeRef.id })

    res.json({
      success: true,
      data: {
        id: sharedTradeRef.id,
        ...sharedTradeData
      },
      message: 'Trade shared successfully'
    })

  } catch (error) {
    logger.error('Error sharing trade', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// GET /community/feed - Get community trade feed
router.get('/feed', async (req: AuthenticatedRequest, res) => {
  try {
    const { error, value } = feedFiltersSchema.validate(req.query)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      })
    }

    const { timeframe, asset, result, strategy, tags, sortBy, page, limit } = value
    const userId = req.user!.uid

    // Build query
    let query = db.collection('communityTrades')
      .where('isPublic', '==', true)
      .where('moderationStatus', '==', 'approved')

    // Apply filters
    if (asset) {
      query = query.where('asset', '==', asset)
    }
    if (result) {
      query = query.where('result', '==', result)
    }

    // Time filter
    const now = new Date()
    const timeMap = {
      '1h': new Date(now.getTime() - 60 * 60 * 1000),
      '24h': new Date(now.getTime() - 24 * 60 * 60 * 1000),
      '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }
    query = query.where('createdAt', '>=', timeMap[timeframe])

    // Apply sorting
    switch (sortBy) {
      case 'recent':
        query = query.orderBy('createdAt', 'desc')
        break
      case 'popular':
        query = query.orderBy('views', 'desc')
        break
      case 'mostLiked':
        query = query.orderBy('likes', 'desc')
        break
      default:
        query = query.orderBy('createdAt', 'desc')
    }

    // Pagination
    const offset = (page - 1) * limit
    const snapshot = await query.offset(offset).limit(limit + 1).get()

    const posts = snapshot.docs.slice(0, limit).map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    // For trending, we need to calculate scores client-side since Firestore doesn't support complex calculations
    if (sortBy === 'trending') {
      posts.sort((a, b) => {
        const aHoursOld = (now.getTime() - a.createdAt.toDate().getTime()) / (1000 * 60 * 60)
        const bHoursOld = (now.getTime() - b.createdAt.toDate().getTime()) / (1000 * 60 * 60)
        
        const aScore = calculateTrendingScore(a.likes, a.comments.length, a.shares, a.views, aHoursOld)
        const bScore = calculateTrendingScore(b.likes, b.comments.length, b.shares, b.views, bHoursOld)
        
        return bScore - aScore
      })
    }

    // Get total count (simplified - in production you'd cache this)
    const totalSnapshot = await db.collection('communityTrades')
      .where('isPublic', '==', true)
      .where('moderationStatus', '==', 'approved')
      .get()

    res.json({
      success: true,
      data: {
        posts,
        pagination: {
          page,
          limit,
          total: totalSnapshot.size,
          hasMore: snapshot.docs.length > limit
        },
        filters: value
      }
    })

  } catch (error) {
    logger.error('Error fetching community feed', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// POST /community/trades/:id/like - Like/unlike a shared trade
router.post('/trades/:id/like', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    const userId = req.user!.uid

    const tradeRef = db.collection('communityTrades').doc(id)
    const tradeDoc = await tradeRef.get()

    if (!tradeDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Shared trade not found'
      })
    }

    // Check if user already liked this trade
    const likesRef = tradeRef.collection('likes')
    const existingLike = await likesRef.doc(userId).get()

    if (existingLike.exists) {
      // Unlike
      await likesRef.doc(userId).delete()
      await tradeRef.update({
        likes: admin.firestore.FieldValue.increment(-1),
        updatedAt: new Date()
      })
      
      res.json({
        success: true,
        data: { liked: false },
        message: 'Trade unliked'
      })
    } else {
      // Like
      await likesRef.doc(userId).set({
        userId,
        createdAt: new Date()
      })
      await tradeRef.update({
        likes: admin.firestore.FieldValue.increment(1),
        updatedAt: new Date()
      })
      
      res.json({
        success: true,
        data: { liked: true },
        message: 'Trade liked'
      })
    }

  } catch (error) {
    logger.error('Error liking trade', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// POST /community/trades/:id/comment - Add a comment to a shared trade
router.post('/trades/:id/comment', async (req: AuthenticatedRequest, res) => {
  try {
    const { error, value } = commentSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      })
    }

    const { id } = req.params
    const { content, parentId } = value
    const userId = req.user!.uid

    const tradeRef = db.collection('communityTrades').doc(id)
    const tradeDoc = await tradeRef.get()

    if (!tradeDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Shared trade not found'
      })
    }

    const userInfo = await getUserDisplayInfo(userId)

    const commentData = {
      userId,
      userDisplayName: userInfo.displayName,
      userAvatar: userInfo.avatar,
      content,
      parentId: parentId || null,
      likes: 0,
      replies: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const commentRef = await tradeRef.collection('comments').add(commentData)

    // Update comment count on main trade
    await tradeRef.update({
      comments: admin.firestore.FieldValue.increment(1),
      updatedAt: new Date()
    })

    res.json({
      success: true,
      data: {
        id: commentRef.id,
        ...commentData
      },
      message: 'Comment added successfully'
    })

  } catch (error) {
    logger.error('Error adding comment', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// GET /community/trades/:id - Get a specific shared trade with comments
router.get('/trades/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    const userId = req.user!.uid

    const tradeDoc = await db.collection('communityTrades').doc(id).get()

    if (!tradeDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Shared trade not found'
      })
    }

    const tradeData = { id: tradeDoc.id, ...tradeDoc.data() }

    // Get comments
    const commentsSnapshot = await tradeDoc.ref.collection('comments')
      .orderBy('createdAt', 'asc')
      .get()

    const comments = commentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    // Check if user liked this trade
    const userLike = await tradeDoc.ref.collection('likes').doc(userId).get()
    const isLiked = userLike.exists

    // Increment view count (don't count owner views)
    if (tradeData.userId !== userId) {
      await tradeDoc.ref.update({
        views: admin.firestore.FieldValue.increment(1)
      })
    }

    res.json({
      success: true,
      data: {
        ...tradeData,
        comments,
        isLiked
      }
    })

  } catch (error) {
    logger.error('Error fetching shared trade', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

// GET /community/stats - Get community statistics
router.get('/stats', async (req: AuthenticatedRequest, res) => {
  try {
    const timeframe = req.query.timeframe as string || '24h'
    
    // Get time filter
    const now = new Date()
    const timeMap = {
      '24h': new Date(now.getTime() - 24 * 60 * 60 * 1000),
      '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }
    const startTime = timeMap[timeframe as keyof typeof timeMap] || timeMap['24h']

    // Get basic stats (simplified - in production use aggregations)
    const [usersSnapshot, tradesSnapshot] = await Promise.all([
      db.collection('users').get(),
      db.collection('communityTrades')
        .where('createdAt', '>=', startTime)
        .get()
    ])

    const totalMembers = usersSnapshot.size
    const totalTrades = tradesSnapshot.size
    
    // Calculate basic metrics
    let totalProfit = 0
    let winCount = 0
    
    tradesSnapshot.docs.forEach(doc => {
      const data = doc.data()
      totalProfit += data.profit || 0
      if (data.result === 'win') winCount++
    })

    const avgWinRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0

    res.json({
      success: true,
      data: {
        totalMembers,
        activeToday: Math.floor(totalMembers * 0.1), // Simplified
        totalTrades,
        totalProfit,
        avgWinRate: Math.round(avgWinRate),
        topPerformers: [], // Would implement with proper aggregations
        trendingStrategies: [], // Would implement with proper aggregations
        activeChallenges: [] // Would implement with proper aggregations
      }
    })

  } catch (error) {
    logger.error('Error fetching community stats', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
})

export default router