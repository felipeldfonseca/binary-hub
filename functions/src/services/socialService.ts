import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  increment, 
  writeBatch, 
  query, 
  where, 
  orderBy, 
  limit as firestoreLimit,
  serverTimestamp,
  runTransaction
} from 'firebase-admin/firestore'

const db = getFirestore()

export const socialService = {
  async followUser(followerId: string, followedId: string) {
    if (followerId === followedId) {
      throw new Error('Cannot follow yourself')
    }

    return await runTransaction(db, async (transaction) => {
      // Check if already following
      const followingRef = doc(db, 'users', followerId, 'following', followedId)
      const followingDoc = await transaction.get(followingRef)
      
      if (followingDoc.exists()) {
        throw new Error('Already following this user')
      }

      // Check if followed user exists and get privacy settings
      const followedUserRef = doc(db, 'users', followedId)
      const followedUserDoc = await transaction.get(followedUserRef)
      
      if (!followedUserDoc.exists()) {
        throw new Error('User not found')
      }

      const followedUserData = followedUserDoc.data()
      const requiresApproval = followedUserData?.privacy?.requiresFollowApproval || false

      // Create follow relationship
      const followData = {
        followedAt: serverTimestamp(),
        notificationsEnabled: true,
        isApproved: !requiresApproval
      }

      transaction.set(followingRef, followData)

      // Create follower record
      const followerRef = doc(db, 'users', followedId, 'followers', followerId)
      transaction.set(followerRef, {
        followedAt: serverTimestamp(),
        isApproved: !requiresApproval
      })

      // Update follower/following counts only if approved
      if (!requiresApproval) {
        transaction.update(doc(db, 'users', followerId), {
          'socialStats.followingCount': increment(1)
        })
        
        transaction.update(doc(db, 'users', followedId), {
          'socialStats.followersCount': increment(1)
        })
      }

      return { requiresApproval }
    })
  },

  async unfollowUser(followerId: string, followedId: string) {
    return await runTransaction(db, async (transaction) => {
      // Check if following exists
      const followingRef = doc(db, 'users', followerId, 'following', followedId)
      const followingDoc = await transaction.get(followingRef)
      
      if (!followingDoc.exists()) {
        throw new Error('Not following this user')
      }

      const followData = followingDoc.data()
      const wasApproved = followData?.isApproved || false

      // Remove follow relationship
      transaction.delete(followingRef)
      
      // Remove follower record
      const followerRef = doc(db, 'users', followedId, 'followers', followerId)
      transaction.delete(followerRef)

      // Update counts only if was approved
      if (wasApproved) {
        transaction.update(doc(db, 'users', followerId), {
          'socialStats.followingCount': increment(-1)
        })
        
        transaction.update(doc(db, 'users', followedId), {
          'socialStats.followersCount': increment(-1)
        })
      }

      return { success: true }
    })
  },

  async approveFollowRequest(userId: string, followerId: string) {
    return await runTransaction(db, async (transaction) => {
      // Check if follow request exists
      const followerRef = doc(db, 'users', userId, 'followers', followerId)
      const followerDoc = await transaction.get(followerRef)
      
      if (!followerDoc.exists()) {
        throw new Error('Follow request not found')
      }

      const followerData = followerDoc.data()
      if (followerData?.isApproved) {
        throw new Error('Follow request already approved')
      }

      // Update both records to approved
      transaction.update(followerRef, { isApproved: true })
      
      const followingRef = doc(db, 'users', followerId, 'following', userId)
      transaction.update(followingRef, { isApproved: true })

      // Update follower/following counts
      transaction.update(doc(db, 'users', followerId), {
        'socialStats.followingCount': increment(1)
      })
      
      transaction.update(doc(db, 'users', userId), {
        'socialStats.followersCount': increment(1)
      })

      return { success: true }
    })
  },

  async rejectFollowRequest(userId: string, followerId: string) {
    return await runTransaction(db, async (transaction) => {
      // Remove both records
      const followerRef = doc(db, 'users', userId, 'followers', followerId)
      const followingRef = doc(db, 'users', followerId, 'following', userId)
      
      transaction.delete(followerRef)
      transaction.delete(followingRef)

      return { success: true }
    })
  },

  async getFollowers(userId: string, limit = 20, startAfter?: string) {
    let followersQuery = query(
      collection(db, 'users', userId, 'followers'),
      where('isApproved', '==', true),
      orderBy('followedAt', 'desc'),
      firestoreLimit(limit)
    )

    if (startAfter) {
      const startAfterDoc = await getDoc(doc(db, 'users', userId, 'followers', startAfter))
      followersQuery = query(followersQuery, orderBy('followedAt', 'desc'))
    }

    const snapshot = await getDocs(followersQuery)
    const followers = []

    for (const followerDoc of snapshot.docs) {
      const followerId = followerDoc.id
      const userDoc = await getDoc(doc(db, 'users', followerId))
      
      if (userDoc.exists()) {
        const userData = userDoc.data()
        followers.push({
          id: followerId,
          displayName: userData?.displayName,
          username: userData?.username,
          photoURL: userData?.photoURL,
          followedAt: followerDoc.data().followedAt
        })
      }
    }

    return {
      followers,
      hasMore: snapshot.docs.length === limit,
      lastDoc: snapshot.docs[snapshot.docs.length - 1]?.id
    }
  },

  async getFollowing(userId: string, limit = 20, startAfter?: string) {
    let followingQuery = query(
      collection(db, 'users', userId, 'following'),
      where('isApproved', '==', true),
      orderBy('followedAt', 'desc'),
      firestoreLimit(limit)
    )

    if (startAfter) {
      const startAfterDoc = await getDoc(doc(db, 'users', userId, 'following', startAfter))
      followingQuery = query(followingQuery, orderBy('followedAt', 'desc'))
    }

    const snapshot = await getDocs(followingQuery)
    const following = []

    for (const followingDoc of snapshot.docs) {
      const followedId = followingDoc.id
      const userDoc = await getDoc(doc(db, 'users', followedId))
      
      if (userDoc.exists()) {
        const userData = userDoc.data()
        following.push({
          id: followedId,
          displayName: userData?.displayName,
          username: userData?.username,
          photoURL: userData?.photoURL,
          followedAt: followingDoc.data().followedAt
        })
      }
    }

    return {
      following,
      hasMore: snapshot.docs.length === limit,
      lastDoc: snapshot.docs[snapshot.docs.length - 1]?.id
    }
  },

  async getPendingFollowRequests(userId: string) {
    const snapshot = await getDocs(
      query(
        collection(db, 'users', userId, 'followers'),
        where('isApproved', '==', false),
        orderBy('followedAt', 'desc')
      )
    )

    const requests = []
    for (const requestDoc of snapshot.docs) {
      const followerId = requestDoc.id
      const userDoc = await getDoc(doc(db, 'users', followerId))
      
      if (userDoc.exists()) {
        const userData = userDoc.data()
        requests.push({
          id: followerId,
          displayName: userData?.displayName,
          username: userData?.username,
          photoURL: userData?.photoURL,
          requestedAt: requestDoc.data().followedAt
        })
      }
    }

    return requests
  },

  async getFollowStatus(viewerId: string, targetUserId: string) {
    if (viewerId === targetUserId) {
      return { relationship: 'self' }
    }

    const [followingDoc, followerDoc] = await Promise.all([
      getDoc(doc(db, 'users', viewerId, 'following', targetUserId)),
      getDoc(doc(db, 'users', targetUserId, 'followers', viewerId))
    ])

    const isFollowing = followingDoc.exists()
    const isFollower = followerDoc.exists()
    
    let relationship = 'none'
    let isPending = false

    if (isFollowing) {
      const followingData = followingDoc.data()
      if (followingData?.isApproved) {
        relationship = isFollower ? 'mutual' : 'following'
      } else {
        relationship = 'pending'
        isPending = true
      }
    } else if (isFollower) {
      relationship = 'follower'
    }

    return {
      relationship,
      isFollowing: isFollowing && followingDoc.data()?.isApproved,
      isFollower: isFollower && followerDoc.data()?.isApproved,
      isPending
    }
  },

  async searchUsers(searchQuery: string, limit = 20, excludeUserId?: string) {
    // Search by username and displayName
    const usernameQuery = await getDocs(
      query(
        collection(db, 'users'),
        where('username', '>=', searchQuery.toLowerCase()),
        where('username', '<=', searchQuery.toLowerCase() + '\uf8ff'),
        firestoreLimit(limit)
      )
    )

    const users = []
    const seenUserIds = new Set()

    for (const userDoc of usernameQuery.docs) {
      const userData = userDoc.data()
      if (excludeUserId && userDoc.id === excludeUserId) continue
      
      seenUserIds.add(userDoc.id)
      users.push({
        id: userDoc.id,
        displayName: userData.displayName,
        username: userData.username,
        photoURL: userData.photoURL,
        bio: userData.bio,
        socialStats: userData.socialStats || {
          followersCount: 0,
          followingCount: 0,
          postsCount: 0
        }
      })
    }

    return users
  },

  async createPost(userId: string, postData: {
    content: string
    visibility: 'public' | 'followers' | 'private'
    tags?: string[]
    sharedTrade?: {
      tradeId: string
      asset: string
      result: 'win' | 'loss' | 'tie'
      profit: number
      amount: number
    }
  }) {
    const postRef = doc(collection(db, 'posts'))
    
    const post = {
      id: postRef.id,
      userId,
      content: postData.content,
      visibility: postData.visibility,
      tags: postData.tags || [],
      sharedTrade: postData.sharedTrade || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      likes: 0,
      comments: 0,
      shares: 0
    }

    await setDoc(postRef, post)

    // Update user's post count
    await updateDoc(doc(db, 'users', userId), {
      'socialStats.postsCount': increment(1)
    })

    return { id: postRef.id, ...post }
  },

  async getPosts(viewerId: string, options: {
    feedType?: 'home' | 'following' | 'user'
    userId?: string
    limit?: number
    startAfter?: string
  } = {}) {
    const { feedType = 'home', userId, limit = 20, startAfter } = options

    let postsQuery
    
    if (feedType === 'user' && userId) {
      // Get posts from specific user
      postsQuery = query(
        collection(db, 'posts'),
        where('userId', '==', userId),
        where('visibility', 'in', ['public', 'followers']),
        orderBy('createdAt', 'desc'),
        firestoreLimit(limit)
      )
    } else if (feedType === 'following') {
      // Get posts from followed users
      const followingSnapshot = await getDocs(
        collection(db, 'users', viewerId, 'following')
      )
      const followingIds = followingSnapshot.docs.map(doc => doc.id)
      
      if (followingIds.length === 0) {
        return { posts: [], hasMore: false }
      }

      postsQuery = query(
        collection(db, 'posts'),
        where('userId', 'in', followingIds.slice(0, 10)), // Firestore limit
        orderBy('createdAt', 'desc'),
        firestoreLimit(limit)
      )
    } else {
      // Home feed - public posts
      postsQuery = query(
        collection(db, 'posts'),
        where('visibility', '==', 'public'),
        orderBy('createdAt', 'desc'),
        firestoreLimit(limit)
      )
    }

    const snapshot = await getDocs(postsQuery)
    const posts = []

    for (const postDoc of snapshot.docs) {
      const postData = postDoc.data()
      const userDoc = await getDoc(doc(db, 'users', postData.userId))
      const userData = userDoc.data()

      // Check if viewer has liked this post
      const likeDoc = await getDoc(
        doc(db, 'posts', postDoc.id, 'likes', viewerId)
      )

      posts.push({
        ...postData,
        id: postDoc.id,
        userDisplayName: userData?.displayName,
        userUsername: userData?.username,
        userPhotoURL: userData?.photoURL,
        isLiked: likeDoc.exists()
      })
    }

    return {
      posts,
      hasMore: snapshot.docs.length === limit,
      lastDoc: snapshot.docs[snapshot.docs.length - 1]?.id
    }
  },

  async likePost(userId: string, postId: string) {
    return await runTransaction(db, async (transaction) => {
      const likeRef = doc(db, 'posts', postId, 'likes', userId)
      const likeDoc = await transaction.get(likeRef)
      const postRef = doc(db, 'posts', postId)

      if (likeDoc.exists()) {
        // Unlike
        transaction.delete(likeRef)
        transaction.update(postRef, {
          likes: increment(-1)
        })
        return { liked: false }
      } else {
        // Like
        transaction.set(likeRef, {
          userId,
          likedAt: serverTimestamp()
        })
        transaction.update(postRef, {
          likes: increment(1)
        })
        return { liked: true }
      }
    })
  },

  async addComment(userId: string, postId: string, content: string) {
    const commentRef = doc(collection(db, 'posts', postId, 'comments'))
    
    const comment = {
      id: commentRef.id,
      userId,
      content,
      createdAt: serverTimestamp(),
      likes: 0
    }

    await setDoc(commentRef, comment)

    // Update post comment count
    await updateDoc(doc(db, 'posts', postId), {
      comments: increment(1)
    })

    return comment
  },

  async deletePost(userId: string, postId: string) {
    const postRef = doc(db, 'posts', postId)
    const postDoc = await getDoc(postRef)
    
    if (!postDoc.exists()) {
      throw new Error('Post not found')
    }

    const postData = postDoc.data()
    if (postData.userId !== userId) {
      throw new Error('Unauthorized to delete this post')
    }

    // Delete post and subcollections
    const batch = writeBatch(db)
    
    // Delete likes
    const likesSnapshot = await getDocs(collection(db, 'posts', postId, 'likes'))
    likesSnapshot.docs.forEach(doc => batch.delete(doc.ref))
    
    // Delete comments
    const commentsSnapshot = await getDocs(collection(db, 'posts', postId, 'comments'))
    commentsSnapshot.docs.forEach(doc => batch.delete(doc.ref))
    
    // Delete post
    batch.delete(postRef)
    
    // Update user's post count
    batch.update(doc(db, 'users', userId), {
      'socialStats.postsCount': increment(-1)
    })

    await batch.commit()
    return { success: true }
  }
}

export default socialService