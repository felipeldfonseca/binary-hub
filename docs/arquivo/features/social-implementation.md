# Binary Hub – Social Features Implementation Guide

*Version 1.0 • Social Trading Platform • January 2025*

---

## Overview

This guide provides comprehensive implementation details for Binary Hub's social features, including profiles, follow system, social feed, content sharing, and community interactions. It serves as the definitive resource for developers implementing the social layer of the platform.

## Table of Contents

1. [Implementation Architecture](#1-implementation-architecture)
2. [User Profiles System](#2-user-profiles-system)
3. [Social Relationships](#3-social-relationships)
4. [Content & Feed System](#4-content--feed-system)
5. [Real-time Features](#5-real-time-features)
6. [Achievement & Gamification](#6-achievement--gamification)
7. [Privacy & Security](#7-privacy--security)
8. [Performance Optimization](#8-performance-optimization)
9. [Testing Strategy](#9-testing-strategy)
10. [Deployment Considerations](#10-deployment-considerations)

---

## 1. Implementation Architecture

### 1.1 Social Features Stack

```typescript
┌─────────────── FRONTEND LAYER ───────────────┐
│                                              │
│  React Components (Next.js 14)              │
│  ├─ ProfileComponents/                       │
│  │  ├─ PublicProfile.tsx                   │
│  │  ├─ ProfileEditor.tsx                   │
│  │  └─ ProfileDiscovery.tsx                │
│  ├─ SocialComponents/                       │
│  │  ├─ SocialFeed.tsx                      │
│  │  ├─ PostComposer.tsx                    │
│  │  ├─ FollowButton.tsx                    │
│  │  └─ NotificationCenter.tsx              │
│  └─ Real-time/                              │
│     ├─ WebSocketProvider.tsx               │
│     └─ LiveUpdateHandler.tsx               │
│                                              │
└──────────────────────────────────────────────┘
                       │
┌─────────────▼─ BACKEND LAYER ──────────────┐
│                                            │
│  Firebase Functions (Node.js 20)          │
│  ├─ routes/social.ts                      │
│  ├─ routes/profiles.ts                    │
│  ├─ routes/feed.ts                        │
│  ├─ services/                             │
│  │  ├─ socialService.ts                   │
│  │  ├─ feedGenerator.ts                   │
│  │  ├─ notificationService.ts             │
│  │  └─ achievementEngine.ts               │
│  └─ middleware/                            │
│     ├─ socialAuth.ts                      │
│     └─ privacyFilter.ts                   │
│                                            │
└────────────────────────────────────────────┘
                       │
┌────────────▼─ DATA LAYER ──────────────────┐
│                                            │
│  Firestore Collections                    │
│  ├─ profiles/{uid}                        │
│  ├─ follows/{uid}/following/{targetUid}   │
│  ├─ follows/{uid}/followers/{followerUid} │
│  ├─ posts/{uid}/{postId}                  │
│  ├─ feed/{uid}/{feedItemId}               │
│  ├─ notifications/{uid}/{notificationId}  │
│  └─ achievements/{uid}/{achievementId}    │
│                                            │
└────────────────────────────────────────────┘
```

### 1.2 Core Social Entities

```typescript
// Profile Entity
interface UserProfile {
  uid: string;
  basic: {
    displayName: string;
    username: string; // unique identifier
    avatar: string;
    bio: string;
    location?: string;
    tradingSince: Date;
    isVerified: boolean;
    subscription: SubscriptionTier;
  };
  stats: {
    followersCount: number;
    followingCount: number;
    postsCount: number;
    totalTrades: number;
    winRate?: number;
    monthlyPnL?: number;
    currentStreak?: number;
    joinedAt: Date;
  };
  privacy: PrivacySettings;
  achievements: Achievement[];
  lastActive: Date;
}

// Social Post Entity
interface SocialPost {
  id: string;
  authorId: string;
  type: 'trade' | 'insight' | 'achievement' | 'general';
  content: string;
  hashtags: string[];
  attachments: Attachment[];
  tradeRef?: string;
  visibility: 'public' | 'followers' | 'private';
  metrics: {
    likesCount: number;
    commentsCount: number;
    sharesCount: number;
    viewsCount: number;
  };
  interactions: {
    likedBy: string[];
    sharedBy: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

// Follow Relationship Entity
interface FollowRelationship {
  followerId: string;
  followingId: string;
  followedAt: Date;
  notificationsEnabled: boolean;
  status: 'active' | 'muted' | 'blocked';
  metadata: {
    source: 'manual' | 'suggestion' | 'search';
    mutualFollow: boolean;
  };
}
```

---

## 2. User Profiles System

### 2.1 Profile Creation & Setup

```typescript
// Profile Setup Wizard Component
export const ProfileSetupWizard: React.FC = () => {
  const [step, setStep] = useState(1);
  const [profileData, setProfileData] = useState<Partial<UserProfile>>({});

  const steps = [
    { id: 1, title: "Basic Info", component: BasicInfoStep },
    { id: 2, title: "Trading Info", component: TradingInfoStep },
    { id: 3, title: "Privacy Settings", component: PrivacyStep },
    { id: 4, title: "Profile Picture", component: AvatarStep }
  ];

  const handleStepComplete = async (stepData: any) => {
    setProfileData(prev => ({ ...prev, ...stepData }));
    
    if (step < steps.length) {
      setStep(step + 1);
    } else {
      await createProfile(profileData);
      router.push('/dashboard');
    }
  };

  return (
    <div className="profile-setup-wizard">
      <ProgressIndicator currentStep={step} totalSteps={steps.length} />
      <StepComponent 
        {...steps[step - 1]} 
        onComplete={handleStepComplete}
        initialData={profileData}
      />
    </div>
  );
};

// Profile Creation Service
export class ProfileService {
  async createProfile(uid: string, profileData: CreateProfileRequest): Promise<UserProfile> {
    // Validate username uniqueness
    await this.validateUsername(profileData.username);
    
    // Generate default privacy settings
    const defaultPrivacy = this.generateDefaultPrivacySettings();
    
    // Create profile document
    const profile: UserProfile = {
      uid,
      basic: {
        displayName: profileData.displayName,
        username: profileData.username.toLowerCase(),
        avatar: profileData.avatar || this.generateDefaultAvatar(),
        bio: profileData.bio || '',
        location: profileData.location,
        tradingSince: profileData.tradingSince || new Date(),
        isVerified: false,
        subscription: 'free'
      },
      stats: {
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        totalTrades: 0,
        joinedAt: new Date()
      },
      privacy: { ...defaultPrivacy, ...profileData.privacy },
      achievements: [],
      lastActive: new Date()
    };

    // Save to Firestore
    await db.collection('profiles').doc(uid).set(profile);
    
    // Trigger welcome achievement
    await this.awardAchievement(uid, 'WELCOME_TO_COMMUNITY');
    
    return profile;
  }

  private async validateUsername(username: string): Promise<void> {
    const normalizedUsername = username.toLowerCase();
    
    // Check reserved usernames
    const reservedUsernames = ['admin', 'api', 'www', 'support', 'help'];
    if (reservedUsernames.includes(normalizedUsername)) {
      throw new Error('Username is reserved');
    }
    
    // Check uniqueness
    const existingProfile = await db.collection('profiles')
      .where('basic.username', '==', normalizedUsername)
      .limit(1)
      .get();
    
    if (!existingProfile.empty) {
      throw new Error('Username already exists');
    }
  }
}
```

### 2.2 Public Profile Display

```typescript
// Public Profile Component
export const PublicProfile: React.FC<{ username: string }> = ({ username }) => {
  const { data: profile, loading } = useProfile(username);
  const { user } = useAuth();
  const isOwnProfile = user?.uid === profile?.uid;

  if (loading) return <ProfileSkeleton />;
  if (!profile) return <ProfileNotFound username={username} />;

  return (
    <div className="public-profile">
      <ProfileHeader 
        profile={profile}
        isOwnProfile={isOwnProfile}
        actions={<ProfileActions profile={profile} />}
      />
      
      <ProfileTabs>
        <TabPanel label="Overview">
          <ProfileStats profile={profile} />
          <RecentActivity userId={profile.uid} />
        </TabPanel>
        
        <TabPanel label="Trades" count={profile.stats.totalTrades}>
          <PublicTrades userId={profile.uid} privacy={profile.privacy} />
        </TabPanel>
        
        <TabPanel label="Posts" count={profile.stats.postsCount}>
          <UserPosts userId={profile.uid} />
        </TabPanel>
        
        <TabPanel label="Achievements" count={profile.achievements.length}>
          <AchievementGrid achievements={profile.achievements} />
        </TabPanel>
      </ProfileTabs>
    </div>
  );
};

// Profile Actions Component
export const ProfileActions: React.FC<{ profile: UserProfile }> = ({ profile }) => {
  const { user } = useAuth();
  const { followUser, unfollowUser, blockUser } = useSocialActions();
  const { data: relationship } = useFollowRelationship(user?.uid, profile.uid);

  if (user?.uid === profile.uid) {
    return (
      <div className="profile-actions">
        <Button variant="outline" onClick={() => router.push('/settings/profile')}>
          Edit Profile
        </Button>
      </div>
    );
  }

  return (
    <div className="profile-actions">
      <FollowButton
        targetUserId={profile.uid}
        currentRelationship={relationship}
        onFollow={followUser}
        onUnfollow={unfollowUser}
      />
      
      <DropdownMenu>
        <DropdownTrigger>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownTrigger>
        <DropdownContent>
          <DropdownItem onClick={() => shareProfile(profile)}>
            Share Profile
          </DropdownItem>
          <DropdownItem onClick={() => reportUser(profile.uid)}>
            Report User
          </DropdownItem>
          <DropdownItem 
            onClick={() => blockUser(profile.uid)}
            className="text-red-600"
          >
            Block User
          </DropdownItem>
        </DropdownContent>
      </DropdownMenu>
    </div>
  );
};
```

### 2.3 Profile Privacy & Visibility

```typescript
// Privacy Settings Management
export interface PrivacySettings {
  profileVisibility: 'public' | 'community' | 'private';
  metricsVisibility: {
    winRate: boolean;
    pnl: boolean;
    streaks: boolean;
    tradeCount: boolean;
    tradingHistory: boolean;
  };
  socialSettings: {
    allowFollowers: boolean;
    requireFollowApproval: boolean;
    allowDirectMessages: boolean;
    showOnlineStatus: boolean;
  };
  searchability: {
    appearInSearch: boolean;
    appearInSuggestions: boolean;
    allowTagging: boolean;
  };
}

// Privacy Filter Service
export class PrivacyService {
  static filterProfileForViewer(
    profile: UserProfile, 
    viewerUid?: string, 
    relationship?: FollowRelationship
  ): Partial<UserProfile> {
    const isOwner = viewerUid === profile.uid;
    const isFollower = relationship?.status === 'active';
    const isPublic = profile.privacy.profileVisibility === 'public';
    const isCommunity = profile.privacy.profileVisibility === 'community';
    
    // Owner sees everything
    if (isOwner) return profile;
    
    // Private profiles only visible to owner
    if (profile.privacy.profileVisibility === 'private') {
      return this.getMinimalProfile(profile);
    }
    
    // Community visibility requires login
    if (isCommunity && !viewerUid) {
      return this.getMinimalProfile(profile);
    }
    
    // Apply metric visibility filters
    const filteredProfile = { ...profile };
    
    Object.entries(profile.privacy.metricsVisibility).forEach(([metric, visible]) => {
      if (!visible && !isOwner) {
        if (metric === 'winRate') filteredProfile.stats.winRate = undefined;
        if (metric === 'pnl') filteredProfile.stats.monthlyPnL = undefined;
        if (metric === 'streaks') filteredProfile.stats.currentStreak = undefined;
        if (metric === 'tradeCount') filteredProfile.stats.totalTrades = 0;
      }
    });
    
    return filteredProfile;
  }
  
  private static getMinimalProfile(profile: UserProfile): Partial<UserProfile> {
    return {
      uid: profile.uid,
      basic: {
        displayName: profile.basic.displayName,
        username: profile.basic.username,
        avatar: profile.basic.avatar,
        bio: '',
        isVerified: profile.basic.isVerified,
        subscription: profile.basic.subscription
      },
      stats: {
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        totalTrades: 0,
        joinedAt: profile.stats.joinedAt
      }
    };
  }
}
```

---

## 3. Social Relationships

### 3.1 Follow/Follower System

```typescript
// Follow Button Component
export const FollowButton: React.FC<{
  targetUserId: string;
  currentRelationship?: FollowRelationship;
  onFollow: (userId: string) => Promise<void>;
  onUnfollow: (userId: string) => Promise<void>;
}> = ({ targetUserId, currentRelationship, onFollow, onUnfollow }) => {
  const [loading, setLoading] = useState(false);
  const isFollowing = currentRelationship?.status === 'active';
  
  const handleClick = async () => {
    setLoading(true);
    try {
      if (isFollowing) {
        await onUnfollow(targetUserId);
      } else {
        await onFollow(targetUserId);
      }
    } catch (error) {
      toast.error('Failed to update follow status');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      variant={isFollowing ? 'outline' : 'default'}
      className={cn(
        "min-w-[100px]",
        isFollowing && "hover:bg-red-50 hover:text-red-600 hover:border-red-300"
      )}
    >
      {loading ? (
        <LoadingSpinner className="w-4 h-4" />
      ) : isFollowing ? (
        <>
          <Check className="w-4 h-4 mr-2" />
          Following
        </>
      ) : (
        <>
          <Plus className="w-4 h-4 mr-2" />
          Follow
        </>
      )}
    </Button>
  );
};

// Social Actions Hook
export const useSocialActions = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const followUser = useMutation({
    mutationFn: async (targetUserId: string) => {
      const response = await api.post(`/social/follow/${targetUserId}`);
      return response.data;
    },
    onSuccess: (data, targetUserId) => {
      // Update local cache
      queryClient.setQueryData(['followRelationship', user?.uid, targetUserId], data);
      
      // Update follower counts
      queryClient.invalidateQueries(['profile', targetUserId]);
      queryClient.invalidateQueries(['profile', user?.uid]);
      
      toast.success('Now following user');
    },
    onError: (error) => {
      toast.error('Failed to follow user');
    }
  });
  
  const unfollowUser = useMutation({
    mutationFn: async (targetUserId: string) => {
      const response = await api.delete(`/social/follow/${targetUserId}`);
      return response.data;
    },
    onSuccess: (data, targetUserId) => {
      queryClient.setQueryData(['followRelationship', user?.uid, targetUserId], null);
      queryClient.invalidateQueries(['profile', targetUserId]);
      queryClient.invalidateQueries(['profile', user?.uid]);
      
      toast.success('Unfollowed user');
    },
    onError: (error) => {
      toast.error('Failed to unfollow user');
    }
  });
  
  return { followUser: followUser.mutateAsync, unfollowUser: unfollowUser.mutateAsync };
};

// Follow Service (Backend)
export class FollowService {
  async followUser(followerId: string, targetUserId: string): Promise<FollowResult> {
    // Validate follow request
    await this.validateFollowRequest(followerId, targetUserId);
    
    // Check if already following
    const existingFollow = await this.getFollowRelationship(followerId, targetUserId);
    if (existingFollow?.status === 'active') {
      throw new Error('Already following user');
    }
    
    // Create follow relationship
    const relationship: FollowRelationship = {
      followerId,
      followingId: targetUserId,
      followedAt: new Date(),
      notificationsEnabled: true,
      status: 'active',
      metadata: {
        source: 'manual',
        mutualFollow: await this.checkMutualFollow(followerId, targetUserId)
      }
    };
    
    // Save relationship documents
    await Promise.all([
      db.collection('follows').doc(followerId)
        .collection('following').doc(targetUserId).set(relationship),
      db.collection('follows').doc(targetUserId)
        .collection('followers').doc(followerId).set(relationship)
    ]);
    
    // Update follower counts
    await this.updateFollowerCounts(followerId, targetUserId, 'follow');
    
    // Send notification
    await this.notificationService.createNotification({
      userId: targetUserId,
      type: 'follow',
      actorId: followerId,
      message: 'started following you'
    });
    
    // Check for achievements
    await this.checkFollowAchievements(followerId, targetUserId);
    
    return {
      following: true,
      followedAt: relationship.followedAt,
      mutualFollow: relationship.metadata.mutualFollow
    };
  }
  
  private async validateFollowRequest(followerId: string, targetUserId: string): Promise<void> {
    // Can't follow yourself
    if (followerId === targetUserId) {
      throw new Error('Cannot follow yourself');
    }
    
    // Check if target user exists and allows followers
    const targetProfile = await this.profileService.getProfile(targetUserId);
    if (!targetProfile) {
      throw new Error('User not found');
    }
    
    if (!targetProfile.privacy.socialSettings.allowFollowers) {
      throw new Error('User does not allow followers');
    }
    
    // Check if blocked
    const isBlocked = await this.isUserBlocked(followerId, targetUserId);
    if (isBlocked) {
      throw new Error('Cannot follow blocked user');
    }
  }
  
  private async updateFollowerCounts(followerId: string, targetUserId: string, action: 'follow' | 'unfollow'): Promise<void> {
    const increment = action === 'follow' ? 1 : -1;
    
    await Promise.all([
      // Update follower's following count
      db.collection('profiles').doc(followerId).update({
        'stats.followingCount': admin.firestore.FieldValue.increment(increment)
      }),
      // Update target's followers count
      db.collection('profiles').doc(targetUserId).update({
        'stats.followersCount': admin.firestore.FieldValue.increment(increment)
      })
    ]);
  }
}
```

### 3.2 User Discovery & Recommendations

```typescript
// Profile Discovery Component
export const ProfileDiscovery: React.FC = () => {
  const { data: suggestions } = useProfileSuggestions();
  const { data: trending } = useTrendingProfiles();
  const [searchQuery, setSearchQuery] = useState('');
  const { data: searchResults } = useProfileSearch(searchQuery);
  
  return (
    <div className="profile-discovery">
      <SearchHeader>
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search traders..."
        />
        <SearchFilters />
      </SearchHeader>
      
      {searchQuery ? (
        <SearchResults results={searchResults} />
      ) : (
        <DiscoveryTabs>
          <TabPanel label="Suggested">
            <SuggestionCategories>
              <SuggestionGroup title="New Traders" profiles={suggestions?.newTraders} />
              <SuggestionGroup title="Top Performers" profiles={suggestions?.topPerformers} />
              <SuggestionGroup title="Similar Style" profiles={suggestions?.similarStyle} />
            </SuggestionCategories>
          </TabPanel>
          
          <TabPanel label="Trending">
            <TrendingProfiles profiles={trending} />
          </TabPanel>
          
          <TabPanel label="All Traders">
            <InfiniteProfileGrid endpoint="/profiles" />
          </TabPanel>
        </DiscoveryTabs>
      )}
    </div>
  );
};

// Profile Recommendation Service
export class RecommendationService {
  async generateProfileSuggestions(userId: string): Promise<ProfileSuggestions> {
    const userProfile = await this.profileService.getProfile(userId);
    const following = await this.getFollowingList(userId);
    
    // Get suggestions based on different algorithms
    const [newTraders, topPerformers, similarStyle, mutualConnections] = await Promise.all([
      this.getNewTraderSuggestions(userId, following),
      this.getTopPerformerSuggestions(userId, following),
      this.getSimilarStyleSuggestions(userProfile, following),
      this.getMutualConnectionSuggestions(userId, following)
    ]);
    
    return {
      newTraders: this.scoreAndSortSuggestions(newTraders, 'new_trader'),
      topPerformers: this.scoreAndSortSuggestions(topPerformers, 'top_performer'),
      similarStyle: this.scoreAndSortSuggestions(similarStyle, 'similar_style'),
      mutualConnections: this.scoreAndSortSuggestions(mutualConnections, 'mutual')
    };
  }
  
  private async getNewTraderSuggestions(userId: string, following: string[]): Promise<ProfileSuggestion[]> {
    // Users who joined recently and are active
    const query = db.collection('profiles')
      .where('stats.joinedAt', '>', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
      .where('stats.totalTrades', '>', 5)
      .orderBy('stats.joinedAt', 'desc')
      .limit(20);
    
    const snapshot = await query.get();
    return snapshot.docs
      .map(doc => doc.data() as UserProfile)
      .filter(profile => profile.uid !== userId && !following.includes(profile.uid))
      .map(profile => ({
        profile,
        score: this.calculateNewTraderScore(profile),
        reason: 'New active trader'
      }));
  }
  
  private async getTopPerformerSuggestions(userId: string, following: string[]): Promise<ProfileSuggestion[]> {
    // Users with high win rates and good track records
    const query = db.collection('profiles')
      .where('stats.winRate', '>=', 0.65)
      .where('stats.totalTrades', '>=', 100)
      .orderBy('stats.winRate', 'desc')
      .limit(20);
    
    const snapshot = await query.get();
    return snapshot.docs
      .map(doc => doc.data() as UserProfile)
      .filter(profile => 
        profile.uid !== userId && 
        !following.includes(profile.uid) &&
        profile.privacy.profileVisibility === 'public'
      )
      .map(profile => ({
        profile,
        score: this.calculatePerformanceScore(profile),
        reason: `${(profile.stats.winRate! * 100).toFixed(1)}% win rate`
      }));
  }
  
  private async getSimilarStyleSuggestions(userProfile: UserProfile, following: string[]): Promise<ProfileSuggestion[]> {
    // Use ML or simple heuristics to find similar trading styles
    // For now, use simple metrics like trading frequency and preferred assets
    
    const userTradingPattern = await this.analyzeTradingPattern(userProfile.uid);
    
    // Find users with similar patterns
    const candidates = await this.findUsersWithSimilarPatterns(userTradingPattern);
    
    return candidates
      .filter(candidate => 
        candidate.uid !== userProfile.uid && 
        !following.includes(candidate.uid)
      )
      .map(profile => ({
        profile,
        score: this.calculateSimilarityScore(userTradingPattern, profile),
        reason: 'Similar trading style'
      }));
  }
  
  private calculateNewTraderScore(profile: UserProfile): number {
    const daysSinceJoined = Math.floor((Date.now() - profile.stats.joinedAt.getTime()) / (24 * 60 * 60 * 1000));
    const activityScore = Math.min(profile.stats.totalTrades / 20, 1); // Normalize to 0-1
    const recentnessScore = Math.max(0, 1 - daysSinceJoined / 30); // Newer is better
    
    return (activityScore * 0.6 + recentnessScore * 0.4) * 100;
  }
  
  private calculatePerformanceScore(profile: UserProfile): number {
    const winRateScore = (profile.stats.winRate || 0) * 100;
    const volumeScore = Math.min(profile.stats.totalTrades / 500, 1) * 20; // Up to 20 points for volume
    const consistencyScore = this.calculateConsistencyScore(profile) * 30; // Up to 30 points for consistency
    
    return Math.min(winRateScore + volumeScore + consistencyScore, 100);
  }
}
```

---

## 4. Content & Feed System

### 4.1 Post Creation & Management

```typescript
// Post Composer Component
export const PostComposer: React.FC<{
  onPostCreated?: (post: SocialPost) => void;
  initialTradeRef?: string;
  placeholder?: string;
}> = ({ onPostCreated, initialTradeRef, placeholder = "Share your insights..." }) => {
  const [content, setContent] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [tradeRef, setTradeRef] = useState(initialTradeRef);
  const [postType, setPostType] = useState<PostType>('general');
  
  const { mutate: createPost, loading } = useCreatePost();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) return;
    
    // Upload attachments first
    const uploadedAttachments = await uploadAttachments(attachments);
    
    const postData: CreatePostRequest = {
      type: postType,
      content: content.trim(),
      hashtags: extractHashtags(content).concat(hashtags),
      attachments: uploadedAttachments,
      tradeRef,
      visibility
    };
    
    createPost(postData, {
      onSuccess: (post) => {
        setContent('');
        setHashtags([]);
        setAttachments([]);
        setTradeRef(undefined);
        onPostCreated?.(post);
        toast.success('Post shared successfully!');
      }
    });
  };
  
  return (
    <Card className="post-composer">
      <form onSubmit={handleSubmit}>
        <div className="composer-header">
          <Avatar user={user} size="sm" />
          <div className="composer-meta">
            <span className="user-name">{user.displayName}</span>
            <PostTypeSelector value={postType} onChange={setPostType} />
          </div>
        </div>
        
        <div className="composer-body">
          <TextArea
            value={content}
            onChange={setContent}
            placeholder={placeholder}
            maxLength={500}
            className="composer-textarea"
            autoFocus
          />
          
          {tradeRef && (
            <TradePreview tradeId={tradeRef} onRemove={() => setTradeRef(undefined)} />
          )}
          
          <AttachmentPreviews 
            files={attachments}
            onRemove={(index) => setAttachments(prev => prev.filter((_, i) => i !== index))}
          />
        </div>
        
        <div className="composer-footer">
          <div className="composer-actions">
            <FileUploadButton
              accept="image/*"
              multiple
              maxFiles={4}
              onFiles={setAttachments}
              disabled={attachments.length >= 4}
            >
              <ImageIcon className="w-4 h-4" />
            </FileUploadButton>
            
            <TradePickerButton
              onTradeSelected={setTradeRef}
              selectedTradeId={tradeRef}
            >
              <TrendingUpIcon className="w-4 h-4" />
            </TradePickerButton>
            
            <HashtagButton
              onHashtagsChange={setHashtags}
              currentHashtags={hashtags}
            >
              <HashIcon className="w-4 h-4" />
            </HashtagButton>
          </div>
          
          <div className="composer-submit">
            <PostVisibilitySelector value={visibility} onChange={setVisibility} />
            
            <Button type="submit" disabled={!content.trim() || loading}>
              {loading ? <LoadingSpinner /> : 'Share'}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
};

// Post Display Component
export const PostCard: React.FC<{ post: SocialPost; compact?: boolean }> = ({ post, compact = false }) => {
  const { user } = useAuth();
  const { data: author } = useProfile(post.authorId);
  const { data: tradeData } = useTrade(post.tradeRef);
  const [showComments, setShowComments] = useState(false);
  
  const { likePost, unlikePost, sharePost } = usePostActions();
  
  const isLiked = post.interactions.likedBy.includes(user?.uid || '');
  const isAuthor = user?.uid === post.authorId;
  
  if (!author) return <PostCardSkeleton />;
  
  return (
    <Card className={cn("post-card", compact && "post-card-compact")}>
      <PostHeader>
        <Avatar user={author} size="sm" onClick={() => router.push(`/profile/${author.username}`)} />
        <div className="post-meta">
          <span className="author-name">{author.displayName}</span>
          {author.isVerified && <VerifiedIcon className="w-4 h-4 text-blue-500" />}
          <span className="post-time">{formatRelativeTime(post.createdAt)}</span>
          <PostTypeBadge type={post.type} />
        </div>
        
        {isAuthor && (
          <PostMenuButton>
            <MenuItem onClick={() => editPost(post.id)}>Edit</MenuItem>
            <MenuItem onClick={() => deletePost(post.id)} destructive>Delete</MenuItem>
          </PostMenuButton>
        )}
      </PostHeader>
      
      <PostContent>
        <PostText content={post.content} hashtags={post.hashtags} />
        
        {post.attachments.length > 0 && (
          <AttachmentGrid attachments={post.attachments} />
        )}
        
        {post.tradeRef && tradeData && (
          <TradeEmbed trade={tradeData} compact={compact} />
        )}
      </PostContent>
      
      <PostActions>
        <ActionButton
          active={isLiked}
          count={post.metrics.likesCount}
          onClick={() => isLiked ? unlikePost(post.id) : likePost(post.id)}
          icon={<HeartIcon />}
          label="Like"
        />
        
        <ActionButton
          count={post.metrics.commentsCount}
          onClick={() => setShowComments(!showComments)}
          icon={<MessageCircleIcon />}
          label="Comment"
        />
        
        <ActionButton
          count={post.metrics.sharesCount}
          onClick={() => sharePost(post.id)}
          icon={<ShareIcon />}
          label="Share"
        />
        
        <ActionButton
          onClick={() => bookmarkPost(post.id)}
          icon={<BookmarkIcon />}
          label="Save"
        />
      </PostActions>
      
      {showComments && (
        <CommentsSection postId={post.id} />
      )}
    </Card>
  );
};
```

### 4.2 Social Feed Generation

```typescript
// Feed Generator Service
export class FeedGeneratorService {
  async generatePersonalizedFeed(userId: string, options: FeedOptions): Promise<FeedItem[]> {
    const userProfile = await this.profileService.getProfile(userId);
    const following = await this.getFollowingList(userId);
    
    // Get different types of content
    const [followingPosts, trendingPosts, discoveryPosts] = await Promise.all([
      this.getFollowingContent(following, options),
      this.getTrendingContent(userId, options),
      this.getDiscoveryContent(userId, userProfile, options)
    ]);
    
    // Combine and rank content
    const allContent = [
      ...followingPosts.map(post => ({ ...post, source: 'following', baseScore: 10 })),
      ...trendingPosts.map(post => ({ ...post, source: 'trending', baseScore: 7 })),
      ...discoveryPosts.map(post => ({ ...post, source: 'discovery', baseScore: 5 }))
    ];
    
    // Apply ranking algorithm
    const rankedContent = this.rankFeedContent(allContent, userProfile);
    
    // Apply diversity and freshness filters
    const diversifiedFeed = this.diversifyFeed(rankedContent);
    
    return diversifiedFeed.slice(0, options.limit || 50);
  }
  
  private async getFollowingContent(following: string[], options: FeedOptions): Promise<SocialPost[]> {
    if (following.length === 0) return [];
    
    // Get recent posts from followed users
    const query = db.collection('posts')
      .where('authorId', 'in', following.slice(0, 10)) // Firestore 'in' limit
      .where('visibility', 'in', ['public', 'followers'])
      .where('createdAt', '>', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // Last 7 days
      .orderBy('createdAt', 'desc')
      .limit(100);
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SocialPost));
  }
  
  private async getTrendingContent(userId: string, options: FeedOptions): Promise<SocialPost[]> {
    // Get posts with high engagement in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const query = db.collection('posts')
      .where('visibility', '==', 'public')
      .where('createdAt', '>', oneDayAgo)
      .where('metrics.likesCount', '>=', 5)
      .orderBy('metrics.likesCount', 'desc')
      .limit(20);
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SocialPost));
  }
  
  private rankFeedContent(content: FeedItem[], userProfile: UserProfile): FeedItem[] {
    return content
      .map(item => ({
        ...item,
        finalScore: this.calculateFeedScore(item, userProfile)
      }))
      .sort((a, b) => b.finalScore - a.finalScore);
  }
  
  private calculateFeedScore(item: FeedItem, userProfile: UserProfile): number {
    let score = item.baseScore;
    
    // Recency boost (newer content scores higher)
    const ageHours = (Date.now() - item.createdAt.getTime()) / (1000 * 60 * 60);
    const recencyMultiplier = Math.max(0.1, 1 - (ageHours / 24)); // Decay over 24 hours
    score *= recencyMultiplier;
    
    // Engagement boost
    const engagementScore = (item.metrics.likesCount * 1.0) + 
                           (item.metrics.commentsCount * 2.0) + 
                           (item.metrics.sharesCount * 3.0);
    score += Math.min(engagementScore * 0.1, 5); // Max 5 points from engagement
    
    // Content type preferences
    if (item.type === 'trade' && userProfile.stats.totalTrades > 50) {
      score *= 1.2; // Boost trade posts for active traders
    }
    
    if (item.type === 'achievement') {
      score *= 1.1; // Slight boost for achievements
    }
    
    // Author quality score
    const authorScore = this.calculateAuthorScore(item.authorId);
    score *= (1 + authorScore * 0.1); // Up to 10% boost for quality authors
    
    return score;
  }
  
  private diversifyFeed(rankedContent: FeedItem[]): FeedItem[] {
    const diversifiedFeed: FeedItem[] = [];
    const authorCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    
    for (const item of rankedContent) {
      const authorCount = authorCounts[item.authorId] || 0;
      const typeCount = typeCounts[item.type] || 0;
      
      // Limit consecutive posts from same author
      if (authorCount >= 2) {
        // Skip if author already has 2+ consecutive posts
        const lastTwo = diversifiedFeed.slice(-2);
        if (lastTwo.every(post => post.authorId === item.authorId)) {
          continue;
        }
      }
      
      // Limit post type clustering
      if (typeCount >= 3) {
        const lastThree = diversifiedFeed.slice(-3);
        if (lastThree.every(post => post.type === item.type)) {
          continue;
        }
      }
      
      diversifiedFeed.push(item);
      authorCounts[item.authorId] = authorCount + 1;
      typeCounts[item.type] = typeCount + 1;
    }
    
    return diversifiedFeed;
  }
}

// Feed Component
export const SocialFeed: React.FC<{ type?: FeedType }> = ({ type = 'personalized' }) => {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch
  } = useInfiniteQuery({
    queryKey: ['feed', type, user?.uid],
    queryFn: ({ pageParam = null }) => fetchFeed({ type, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  const posts = data?.pages.flatMap(page => page.items) || [];
  
  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };
  
  return (
    <div className="social-feed">
      <FeedHeader>
        <FeedTabs currentType={type} />
        <RefreshButton onClick={handleRefresh} loading={refreshing} />
      </FeedHeader>
      
      {type === 'personalized' && (
        <PostComposer onPostCreated={() => refetch()} />
      )}
      
      <FeedContent>
        {posts.length === 0 ? (
          <EmptyFeed type={type} />
        ) : (
          <VirtualizedList
            items={posts}
            renderItem={(post) => <PostCard key={post.id} post={post} />}
            onLoadMore={fetchNextPage}
            hasMore={hasNextPage}
            loading={isFetchingNextPage}
          />
        )}
      </FeedContent>
    </div>
  );
};
```

---

## 5. Real-time Features

### 5.1 WebSocket Integration

```typescript
// WebSocket Provider
export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  
  useEffect(() => {
    if (!user?.uid) return;
    
    const ws = new WebSocket(`${WS_BASE_URL}/v1/ws`);
    
    ws.onopen = () => {
      setConnectionStatus('connected');
      
      // Authenticate
      ws.send(JSON.stringify({
        type: 'auth',
        payload: { idToken: user.accessToken }
      }));
      
      // Subscribe to user channels
      ws.send(JSON.stringify({
        type: 'subscribe',
        payload: { 
          channels: ['feed', 'notifications', 'social_interactions'] 
        }
      }));
    };
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    };
    
    ws.onclose = () => {
      setConnectionStatus('disconnected');
      // Reconnect after delay
      setTimeout(() => {
        if (user?.uid) {
          setConnectionStatus('connecting');
          // Recursive reconnection logic here
        }
      }, 5000);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('disconnected');
    };
    
    setSocket(ws);
    
    return () => {
      ws.close();
      setSocket(null);
    };
  }, [user?.uid]);
  
  const handleWebSocketMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'feed_update':
        handleFeedUpdate(message.payload);
        break;
      case 'notification':
        handleNewNotification(message.payload);
        break;
      case 'social_interaction':
        handleSocialInteraction(message.payload);
        break;
      case 'ai_analysis_complete':
        handleAIAnalysisComplete(message.payload);
        break;
    }
  };
  
  return (
    <WebSocketContext.Provider value={{ socket, connectionStatus }}>
      {children}
      <ConnectionStatusIndicator status={connectionStatus} />
    </WebSocketContext.Provider>
  );
};

// Real-time Feed Updates
export const useLiveFeedUpdates = () => {
  const { socket } = useWebSocket();
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (!socket) return;
    
    const handleMessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'feed_update') {
        const { action, post } = message.payload;
        
        switch (action) {
          case 'new_post':
            // Add new post to the top of the feed
            queryClient.setQueryData(['feed', 'personalized'], (oldData: any) => {
              if (!oldData) return oldData;
              
              return {
                ...oldData,
                pages: oldData.pages.map((page: any, index: number) => 
                  index === 0 
                    ? { ...page, items: [post, ...page.items] }
                    : page
                )
              };
            });
            
            // Show live update indicator
            showLiveUpdateNotification(post);
            break;
            
          case 'post_updated':
            queryClient.setQueryData(['feed', 'personalized'], (oldData: any) => {
              if (!oldData) return oldData;
              
              return {
                ...oldData,
                pages: oldData.pages.map((page: any) => ({
                  ...page,
                  items: page.items.map((item: any) => 
                    item.id === post.id ? post : item
                  )
                }))
              };
            });
            break;
            
          case 'post_deleted':
            queryClient.setQueryData(['feed', 'personalized'], (oldData: any) => {
              if (!oldData) return oldData;
              
              return {
                ...oldData,
                pages: oldData.pages.map((page: any) => ({
                  ...page,
                  items: page.items.filter((item: any) => item.id !== post.id)
                }))
              };
            });
            break;
        }
      }
    };
    
    socket.addEventListener('message', handleMessage);
    
    return () => {
      socket.removeEventListener('message', handleMessage);
    };
  }, [socket, queryClient]);
};

// Live Update Notification
const showLiveUpdateNotification = (post: SocialPost) => {
  toast.custom((t) => (
    <div className="live-update-notification">
      <Avatar user={post.author} size="xs" />
      <span>{post.author.displayName} posted an update</span>
      <Button size="sm" onClick={() => scrollToPost(post.id)}>
        View
      </Button>
    </div>
  ), {
    duration: 5000,
    position: 'top-center'
  });
};
```

### 5.2 Live Interaction Updates

```typescript
// Real-time Like/Comment Updates
export const usePostInteractions = (postId: string) => {
  const { socket } = useWebSocket();
  const [interactions, setInteractions] = useState<PostInteractions | null>(null);
  
  useEffect(() => {
    if (!socket || !postId) return;
    
    // Subscribe to post-specific interactions
    socket.send(JSON.stringify({
      type: 'subscribe',
      payload: { channels: [`post_interactions:${postId}`] }
    }));
    
    const handleMessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'post_interaction' && message.payload.postId === postId) {
        const { action, userId, username } = message.payload;
        
        switch (action) {
          case 'liked':
            setInteractions(prev => prev ? {
              ...prev,
              likesCount: prev.likesCount + 1,
              likedBy: [...prev.likedBy, userId],
              recentLikers: [{ userId, username }, ...prev.recentLikers.slice(0, 4)]
            } : null);
            break;
            
          case 'unliked':
            setInteractions(prev => prev ? {
              ...prev,
              likesCount: Math.max(0, prev.likesCount - 1),
              likedBy: prev.likedBy.filter(id => id !== userId),
              recentLikers: prev.recentLikers.filter(liker => liker.userId !== userId)
            } : null);
            break;
            
          case 'commented':
            setInteractions(prev => prev ? {
              ...prev,
              commentsCount: prev.commentsCount + 1
            } : null);
            break;
        }
      }
    };
    
    socket.addEventListener('message', handleMessage);
    
    return () => {
      socket.removeEventListener('message', handleMessage);
      // Unsubscribe from post interactions
      socket.send(JSON.stringify({
        type: 'unsubscribe',
        payload: { channels: [`post_interactions:${postId}`] }
      }));
    };
  }, [socket, postId]);
  
  return interactions;
};

// Live Typing Indicators for Comments
export const useCommentTyping = (postId: string) => {
  const { socket } = useWebSocket();
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  
  const sendTypingIndicator = useCallback(
    throttle(() => {
      if (socket && user) {
        socket.send(JSON.stringify({
          type: 'typing_indicator',
          payload: {
            postId,
            userId: user.uid,
            username: user.displayName,
            isTyping: true
          }
        }));
      }
    }, 1000),
    [socket, user, postId]
  );
  
  const sendStoppedTyping = useCallback(() => {
    if (socket && user) {
      socket.send(JSON.stringify({
        type: 'typing_indicator',
        payload: {
          postId,
          userId: user.uid,
          isTyping: false
        }
      }));
    }
  }, [socket, user, postId]);
  
  useEffect(() => {
    if (!socket) return;
    
    const handleMessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'typing_indicator' && message.payload.postId === postId) {
        const { userId, username, isTyping } = message.payload;
        
        // Don't show own typing indicator
        if (userId === user?.uid) return;
        
        setTypingUsers(prev => {
          if (isTyping) {
            // Add user to typing list
            return prev.some(u => u.userId === userId)
              ? prev
              : [...prev, { userId, username }];
          } else {
            // Remove user from typing list
            return prev.filter(u => u.userId !== userId);
          }
        });
      }
    };
    
    socket.addEventListener('message', handleMessage);
    
    return () => {
      socket.removeEventListener('message', handleMessage);
    };
  }, [socket, postId, user?.uid]);
  
  return { typingUsers, sendTypingIndicator, sendStoppedTyping };
};
```

---

## 6. Achievement & Gamification

### 6.1 Achievement System

```typescript
// Achievement Definitions
export const ACHIEVEMENTS: Record<string, Achievement> = {
  // Profile & Social Achievements
  WELCOME_TO_COMMUNITY: {
    id: 'WELCOME_TO_COMMUNITY',
    title: 'Welcome to Binary Hub!',
    description: 'Complete your profile setup',
    icon: 'welcome',
    category: 'social',
    rarity: 'common',
    points: 10,
    requirements: { profileComplete: true }
  },
  
  FIRST_FOLLOWER: {
    id: 'FIRST_FOLLOWER',
    title: 'First Connection',
    description: 'Get your first follower',
    icon: 'first-follower',
    category: 'social',
    rarity: 'common',
    points: 25,
    requirements: { followersCount: 1 }
  },
  
  POPULAR_TRADER: {
    id: 'POPULAR_TRADER',
    title: 'Popular Trader',
    description: 'Reach 100 followers',
    icon: 'popular',
    category: 'social',
    rarity: 'rare',
    points: 100,
    requirements: { followersCount: 100 }
  },
  
  // Trading Achievements
  FIRST_TRADE: {
    id: 'FIRST_TRADE',
    title: 'First Trade',
    description: 'Log your first trade',
    icon: 'first-trade',
    category: 'trading',
    rarity: 'common',
    points: 15,
    requirements: { totalTrades: 1 }
  },
  
  CONSISTENT_TRADER: {
    id: 'CONSISTENT_TRADER',
    title: 'Consistent Trader',
    description: 'Trade for 30 consecutive days',
    icon: 'consistent',
    category: 'trading',
    rarity: 'epic',
    points: 200,
    requirements: { consecutiveTradingDays: 30 }
  },
  
  HIGH_WIN_RATE: {
    id: 'HIGH_WIN_RATE',
    title: 'Sharp Shooter',
    description: 'Achieve 80%+ win rate with 100+ trades',
    icon: 'sharp-shooter',
    category: 'performance',
    rarity: 'legendary',
    points: 500,
    requirements: { winRate: 0.8, totalTrades: 100 }
  },
  
  // Content & Engagement Achievements
  FIRST_POST: {
    id: 'FIRST_POST',
    title: 'Breaking the Ice',
    description: 'Create your first post',
    icon: 'first-post',
    category: 'content',
    rarity: 'common',
    points: 20,
    requirements: { postsCount: 1 }
  },
  
  VIRAL_POST: {
    id: 'VIRAL_POST',
    title: 'Viral Sensation',
    description: 'Get 100 likes on a single post',
    icon: 'viral',
    category: 'content',
    rarity: 'epic',
    points: 300,
    requirements: { maxPostLikes: 100 }
  },
  
  // Streak Achievements
  WIN_STREAK_5: {
    id: 'WIN_STREAK_5',
    title: 'Hot Streak',
    description: 'Win 5 trades in a row',
    icon: 'hot-streak',
    category: 'performance',
    rarity: 'uncommon',
    points: 50,
    requirements: { maxWinStreak: 5 }
  },
  
  WIN_STREAK_20: {
    id: 'WIN_STREAK_20',
    title: 'Unstoppable',
    description: 'Win 20 trades in a row',
    icon: 'unstoppable',
    category: 'performance',
    rarity: 'legendary',
    points: 1000,
    requirements: { maxWinStreak: 20 }
  }
};

// Achievement Engine
export class AchievementEngine {
  async checkAchievements(userId: string, trigger: AchievementTrigger): Promise<Achievement[]> {
    const userStats = await this.getUserStats(userId);
    const earnedAchievements = await this.getEarnedAchievements(userId);
    const earnedIds = new Set(earnedAchievements.map(a => a.id));
    
    const newAchievements: Achievement[] = [];
    
    // Check all achievements for eligibility
    for (const achievement of Object.values(ACHIEVEMENTS)) {
      // Skip if already earned
      if (earnedIds.has(achievement.id)) continue;
      
      // Check if requirements are met
      if (this.meetsRequirements(achievement, userStats)) {
        await this.awardAchievement(userId, achievement);
        newAchievements.push(achievement);
      }
    }
    
    return newAchievements;
  }
  
  private meetsRequirements(achievement: Achievement, stats: UserStats): boolean {
    const { requirements } = achievement;
    
    // Check each requirement
    for (const [key, value] of Object.entries(requirements)) {
      switch (key) {
        case 'profileComplete':
          if (value && !this.isProfileComplete(stats)) return false;
          break;
        case 'followersCount':
          if (stats.followersCount < value) return false;
          break;
        case 'totalTrades':
          if (stats.totalTrades < value) return false;
          break;
        case 'winRate':
          if ((stats.winRate || 0) < value) return false;
          break;
        case 'postsCount':
          if (stats.postsCount < value) return false;
          break;
        case 'maxWinStreak':
          if ((stats.maxWinStreak || 0) < value) return false;
          break;
        case 'consecutiveTradingDays':
          if ((stats.consecutiveTradingDays || 0) < value) return false;
          break;
        case 'maxPostLikes':
          if ((stats.maxPostLikes || 0) < value) return false;
          break;
        default:
          console.warn(`Unknown achievement requirement: ${key}`);
      }
    }
    
    return true;
  }
  
  private async awardAchievement(userId: string, achievement: Achievement): Promise<void> {
    const userAchievement: UserAchievement = {
      ...achievement,
      earnedAt: new Date(),
      notified: false
    };
    
    // Save achievement
    await db.collection('achievements').doc(userId)
      .collection('earned').doc(achievement.id).set(userAchievement);
    
    // Update user's total points
    await db.collection('profiles').doc(userId).update({
      'stats.achievementPoints': admin.firestore.FieldValue.increment(achievement.points)
    });
    
    // Create notification
    await this.notificationService.createNotification({
      userId,
      type: 'achievement',
      title: 'Achievement Unlocked!',
      message: `You earned "${achievement.title}"`,
      data: { achievementId: achievement.id },
      priority: 'high'
    });
    
    // Create social post if enabled
    if (this.shouldAutoShareAchievement(achievement)) {
      await this.createAchievementPost(userId, achievement);
    }
  }
  
  private async createAchievementPost(userId: string, achievement: Achievement): Promise<void> {
    const post: CreatePostRequest = {
      type: 'achievement',
      content: `🎉 Just unlocked the "${achievement.title}" achievement! ${achievement.description}`,
      hashtags: ['achievement', `achievement-${achievement.category}`],
      visibility: 'public',
      achievementRef: achievement.id
    };
    
    await this.postService.createPost(userId, post);
  }
}

// Achievement Display Components
export const AchievementBadge: React.FC<{ achievement: Achievement; size?: 'sm' | 'md' | 'lg' }> = ({ 
  achievement, 
  size = 'md' 
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12', 
    lg: 'w-16 h-16'
  };
  
  const rarityColors = {
    common: 'border-gray-300 bg-gray-50',
    uncommon: 'border-green-300 bg-green-50',
    rare: 'border-blue-300 bg-blue-50',
    epic: 'border-purple-300 bg-purple-50',
    legendary: 'border-yellow-300 bg-yellow-50'
  };
  
  return (
    <Tooltip content={
      <div className="achievement-tooltip">
        <h4 className="font-semibold">{achievement.title}</h4>
        <p className="text-sm text-gray-600">{achievement.description}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500 capitalize">{achievement.rarity}</span>
          <span className="text-xs font-medium">{achievement.points} pts</span>
        </div>
      </div>
    }>
      <div className={cn(
        "achievement-badge rounded-full border-2 flex items-center justify-center",
        sizeClasses[size],
        rarityColors[achievement.rarity]
      )}>
        <AchievementIcon icon={achievement.icon} className="w-1/2 h-1/2" />
      </div>
    </Tooltip>
  );
};

export const AchievementGrid: React.FC<{ achievements: UserAchievement[] }> = ({ achievements }) => {
  const groupedAchievements = groupBy(achievements, 'category');
  
  return (
    <div className="achievement-grid">
      {Object.entries(groupedAchievements).map(([category, categoryAchievements]) => (
        <div key={category} className="achievement-category">
          <h3 className="text-lg font-semibold mb-4 capitalize">{category}</h3>
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {categoryAchievements.map(achievement => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export const AchievementCard: React.FC<{ achievement: UserAchievement }> = ({ achievement }) => {
  return (
    <Card className="achievement-card text-center p-4 hover:shadow-md transition-shadow">
      <AchievementBadge achievement={achievement} size="lg" />
      <h4 className="font-medium mt-2 text-sm">{achievement.title}</h4>
      <p className="text-xs text-gray-600 mt-1">{achievement.description}</p>
      <div className="flex items-center justify-between mt-3 text-xs">
        <span className="text-gray-500">{formatDate(achievement.earnedAt)}</span>
        <span className="font-medium text-blue-600">{achievement.points} pts</span>
      </div>
    </Card>
  );
};
```

---

## 7. Privacy & Security

### 7.1 Privacy Controls Implementation

```typescript
// Privacy Settings Component
export const PrivacySettings: React.FC = () => {
  const { data: settings, mutate: updateSettings } = usePrivacySettings();
  const [localSettings, setLocalSettings] = useState(settings);
  
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);
  
  const handleSave = async () => {
    await updateSettings(localSettings);
    toast.success('Privacy settings updated');
  };
  
  if (!settings) return <SettingsSkeleton />;
  
  return (
    <Card className="privacy-settings">
      <CardHeader>
        <h2 className="text-xl font-semibold">Privacy & Visibility</h2>
        <p className="text-gray-600">Control who can see your information and activities</p>
      </CardHeader>
      
      <CardContent className="space-y-8">
        {/* Profile Visibility */}
        <SettingSection title="Profile Visibility" description="Who can view your profile">
          <RadioGroup
            value={localSettings.profileVisibility}
            onValueChange={(value) => setLocalSettings(prev => ({ 
              ...prev, 
              profileVisibility: value as ProfileVisibility 
            }))}
          >
            <RadioOption value="public">
              <Globe className="w-5 h-5" />
              <div>
                <h4>Public</h4>
                <p>Anyone can view your profile</p>
              </div>
            </RadioOption>
            
            <RadioOption value="community">
              <Users className="w-5 h-5" />
              <div>
                <h4>Community</h4>
                <p>Only registered users can view</p>
              </div>
            </RadioOption>
            
            <RadioOption value="private">
              <Lock className="w-5 h-5" />
              <div>
                <h4>Private</h4>
                <p>Only you can view your profile</p>
              </div>
            </RadioOption>
          </RadioGroup>
        </SettingSection>
        
        {/* Metrics Visibility */}
        <SettingSection title="Trading Metrics" description="Choose which metrics are visible to others">
          <div className="space-y-4">
            <ToggleOption
              label="Win Rate"
              description="Show your overall win rate percentage"
              checked={localSettings.metricsVisibility.winRate}
              onChange={(checked) => setLocalSettings(prev => ({
                ...prev,
                metricsVisibility: { ...prev.metricsVisibility, winRate: checked }
              }))}
            />
            
            <ToggleOption
              label="Profit & Loss"
              description="Show your P&L and monetary performance"
              checked={localSettings.metricsVisibility.pnl}
              onChange={(checked) => setLocalSettings(prev => ({
                ...prev,
                metricsVisibility: { ...prev.metricsVisibility, pnl: checked }
              }))}
            />
            
            <ToggleOption
              label="Trading Streaks"
              description="Show your current and best streaks"
              checked={localSettings.metricsVisibility.streaks}
              onChange={(checked) => setLocalSettings(prev => ({
                ...prev,
                metricsVisibility: { ...prev.metricsVisibility, streaks: checked }
              }))}
            />
            
            <ToggleOption
              label="Trade Count"
              description="Show total number of trades"
              checked={localSettings.metricsVisibility.tradeCount}
              onChange={(checked) => setLocalSettings(prev => ({
                ...prev,
                metricsVisibility: { ...prev.metricsVisibility, tradeCount: checked }
              }))}
            />
            
            <ToggleOption
              label="Trading History"
              description="Show your individual trades"
              checked={localSettings.metricsVisibility.tradingHistory}
              onChange={(checked) => setLocalSettings(prev => ({
                ...prev,
                metricsVisibility: { ...prev.metricsVisibility, tradingHistory: checked }
              }))}
            />
          </div>
        </SettingSection>
        
        {/* Social Settings */}
        <SettingSection title="Social Interactions" description="Manage how others can interact with you">
          <div className="space-y-4">
            <ToggleOption
              label="Allow Followers"
              description="Let other users follow you"
              checked={localSettings.socialSettings.allowFollowers}
              onChange={(checked) => setLocalSettings(prev => ({
                ...prev,
                socialSettings: { ...prev.socialSettings, allowFollowers: checked }
              }))}
            />
            
            <ToggleOption
              label="Require Follow Approval"
              description="Manual approval for new followers"
              checked={localSettings.socialSettings.requireFollowApproval}
              onChange={(checked) => setLocalSettings(prev => ({
                ...prev,
                socialSettings: { ...prev.socialSettings, requireFollowApproval: checked }
              }))}
              disabled={!localSettings.socialSettings.allowFollowers}
            />
            
            <ToggleOption
              label="Show Online Status"
              description="Let others see when you're active"
              checked={localSettings.socialSettings.showOnlineStatus}
              onChange={(checked) => setLocalSettings(prev => ({
                ...prev,
                socialSettings: { ...prev.socialSettings, showOnlineStatus: checked }
              }))}
            />
          </div>
        </SettingSection>
        
        {/* Discoverability */}
        <SettingSection title="Discoverability" description="Control how others can find you">
          <div className="space-y-4">
            <ToggleOption
              label="Appear in Search"
              description="Let others find you through search"
              checked={localSettings.searchability.appearInSearch}
              onChange={(checked) => setLocalSettings(prev => ({
                ...prev,
                searchability: { ...prev.searchability, appearInSearch: checked }
              }))}
            />
            
            <ToggleOption
              label="Appear in Suggestions"
              description="Be suggested to other users"
              checked={localSettings.searchability.appearInSuggestions}
              onChange={(checked) => setLocalSettings(prev => ({
                ...prev,
                searchability: { ...prev.searchability, appearInSuggestions: checked }
              }))}
            />
            
            <ToggleOption
              label="Allow Tagging"
              description="Let others tag you in posts"
              checked={localSettings.searchability.allowTagging}
              onChange={(checked) => setLocalSettings(prev => ({
                ...prev,
                searchability: { ...prev.searchability, allowTagging: checked }
              }))}
            />
          </div>
        </SettingSection>
      </CardContent>
      
      <CardFooter>
        <Button onClick={handleSave} className="ml-auto">
          Save Privacy Settings
        </Button>
      </CardFooter>
    </Card>
  );
};
```

### 7.2 Content Moderation

```typescript
// Content Moderation Service
export class ModerationService {
  async moderatePost(post: CreatePostRequest): Promise<ModerationResult> {
    const checks = await Promise.all([
      this.checkSpam(post),
      this.checkProfanity(post),
      this.checkFinancialAdvice(post),
      this.checkImageContent(post.attachments),
      this.checkRateLimits(post.authorId)
    ]);
    
    const violations = checks.filter(check => !check.passed);
    
    if (violations.length > 0) {
      return {
        approved: false,
        violations: violations.map(v => v.violation),
        action: this.determineAction(violations)
      };
    }
    
    return { approved: true, violations: [], action: 'approve' };
  }
  
  private async checkSpam(post: CreatePostRequest): Promise<ModerationCheck> {
    // Check for spam patterns
    const spamIndicators = [
      this.hasExcessiveLinks(post.content),
      this.hasRepeatedContent(post.content, post.authorId),
      this.hasExcessiveHashtags(post.hashtags),
      this.hasPromotionalContent(post.content)
    ];
    
    const spamScore = spamIndicators.filter(Boolean).length;
    
    return {
      passed: spamScore < 2,
      violation: spamScore >= 2 ? 'spam_content' : null,
      confidence: spamScore / 4
    };
  }
  
  private async checkFinancialAdvice(post: CreatePostRequest): Promise<ModerationCheck> {
    const advicePatterns = [
      /\b(buy|sell|invest|guaranteed|profit|returns)\b/gi,
      /\b(financial advice|investment advice|trading signals?)\b/gi,
      /\b(guaranteed profit|risk-free|sure thing)\b/gi
    ];
    
    const hasAdvicePattern = advicePatterns.some(pattern => pattern.test(post.content));
    
    if (hasAdvicePattern) {
      // Flag for human review rather than auto-reject
      return {
        passed: false,
        violation: 'potential_financial_advice',
        action: 'flag_for_review'
      };
    }
    
    return { passed: true };
  }
  
  private determineAction(violations: ModerationViolation[]): ModerationAction {
    const severityMap = {
      'spam_content': 'reject',
      'profanity': 'flag_for_review',
      'potential_financial_advice': 'flag_for_review',
      'inappropriate_image': 'reject',
      'rate_limit_exceeded': 'rate_limit'
    };
    
    // Take the most severe action
    const actions = violations.map(v => severityMap[v.type] || 'flag_for_review');
    
    if (actions.includes('reject')) return 'reject';
    if (actions.includes('rate_limit')) return 'rate_limit';
    return 'flag_for_review';
  }
}

// Report System
export const ReportModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  targetType: 'post' | 'comment' | 'user';
  targetId: string;
}> = ({ isOpen, onClose, targetType, targetId }) => {
  const [reason, setReason] = useState<ReportReason>('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const reportReasons: Record<ReportReason, string> = {
    spam: 'Spam or unwanted content',
    inappropriate: 'Inappropriate or offensive content',
    harassment: 'Harassment or bullying',
    fake: 'Fake information or scam',
    financial_advice: 'Unauthorized financial advice',
    other: 'Other (please describe)'
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    
    setSubmitting(true);
    
    try {
      await api.post('/moderation/report', {
        type: targetType,
        targetId,
        reason,
        description: description || undefined
      });
      
      toast.success('Report submitted successfully');
      onClose();
    } catch (error) {
      toast.error('Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader>
        <h2>Report {targetType}</h2>
        <p className="text-gray-600">Help us maintain a safe community</p>
      </ModalHeader>
      
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Why are you reporting this {targetType}?
              </label>
              <RadioGroup value={reason} onValueChange={setReason}>
                {Object.entries(reportReasons).map(([value, label]) => (
                  <RadioOption key={value} value={value}>
                    {label}
                  </RadioOption>
                ))}
              </RadioGroup>
            </div>
            
            {(reason === 'other' || reason === 'harassment') && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Additional details
                </label>
                <TextArea
                  value={description}
                  onChange={setDescription}
                  placeholder="Please provide more details..."
                  rows={3}
                />
              </div>
            )}
          </div>
        </ModalBody>
        
        <ModalFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={!reason || submitting}
            variant="destructive"
          >
            {submitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};
```

---

## 8. Performance Optimization

### 8.1 Frontend Optimization

```typescript
// Virtual Scrolling for Feed
export const VirtualizedFeed: React.FC<{ items: SocialPost[] }> = ({ items }) => {
  const { height, width } = useWindowSize();
  const ITEM_HEIGHT = 200; // Estimated height per post
  
  const renderItem = useCallback(({ index, style }: ListChildComponentProps) => {
    const post = items[index];
    return (
      <div style={style}>
        <PostCard post={post} compact />
      </div>
    );
  }, [items]);
  
  return (
    <VariableSizeList
      height={height - 200} // Account for header
      width={width}
      itemCount={items.length}
      itemSize={() => ITEM_HEIGHT}
      itemData={items}
      overscanCount={5}
    >
      {renderItem}
    </VariableSizeList>
  );
};

// Image Loading Optimization
export const OptimizedImage: React.FC<{
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}> = ({ src, alt, width, height, className }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [inView, setInView] = useState(false);
  
  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    
    if (imgRef.current) {
      observer.observe(imgRef.current);
    }
    
    return () => observer.disconnect();
  }, []);
  
  const optimizedSrc = useMemo(() => {
    if (!inView) return '';
    
    // Generate optimized image URL based on device capabilities
    const devicePixelRatio = window.devicePixelRatio || 1;
    const targetWidth = (width || 400) * devicePixelRatio;
    const targetHeight = (height || 300) * devicePixelRatio;
    
    return `${src}?w=${targetWidth}&h=${targetHeight}&q=80&format=webp`;
  }, [src, width, height, inView]);
  
  return (
    <div 
      ref={imgRef}
      className={cn("relative overflow-hidden", className)}
      style={{ width, height }}
    >
      {!inView ? (
        <div className="w-full h-full bg-gray-200 animate-pulse" />
      ) : (
        <>
          {loading && (
            <div className="absolute inset-0 bg-gray-200 animate-pulse" />
          )}
          
          <img
            src={optimizedSrc}
            alt={alt}
            className={cn(
              "w-full h-full object-cover transition-opacity duration-300",
              loading ? "opacity-0" : "opacity-100"
            )}
            onLoad={() => setLoading(false)}
            onError={() => {
              setError(true);
              setLoading(false);
            }}
          />
          
          {error && (
            <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </>
      )}
    </div>
  );
};

// React Query Optimization
export const useFeedOptimizations = () => {
  const queryClient = useQueryClient();
  
  // Prefetch next page when user is near the end
  const prefetchNextPage = useCallback((currentPage: number) => {
    queryClient.prefetchQuery({
      queryKey: ['feed', 'personalized', currentPage + 1],
      queryFn: () => fetchFeed({ page: currentPage + 1 }),
      staleTime: 5 * 60 * 1000
    });
  }, [queryClient]);
  
  // Optimistic updates for likes
  const optimisticLike = useCallback((postId: string) => {
    queryClient.setQueryData(['feed', 'personalized'], (oldData: any) => {
      if (!oldData) return oldData;
      
      return {
        ...oldData,
        pages: oldData.pages.map((page: any) => ({
          ...page,
          items: page.items.map((post: SocialPost) =>
            post.id === postId
              ? {
                  ...post,
                  metrics: {
                    ...post.metrics,
                    likesCount: post.metrics.likesCount + 1
                  },
                  interactions: {
                    ...post.interactions,
                    likedBy: [...post.interactions.likedBy, user.uid]
                  }
                }
              : post
          )
        }))
      };
    });
  }, [queryClient]);
  
  return { prefetchNextPage, optimisticLike };
};
```

### 8.2 Backend Optimization

```typescript
// Database Query Optimization
export class FeedOptimizationService {
  async getOptimizedFeed(userId: string, options: FeedOptions): Promise<FeedItem[]> {
    // Use compound indexes for efficient querying
    const following = await this.getCachedFollowing(userId);
    
    if (following.length === 0) {
      return this.getDiscoveryFeed(userId, options);
    }
    
    // Batch queries to minimize database calls
    const batchSize = 10; // Firestore 'in' operator limit
    const batches = chunk(following, batchSize);
    
    const postPromises = batches.map(batch =>
      db.collection('posts')
        .where('authorId', 'in', batch)
        .where('visibility', 'in', ['public', 'followers'])
        .where('createdAt', '>', this.getTimeThreshold())
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get()
    );
    
    const snapshots = await Promise.all(postPromises);
    const posts = snapshots
      .flatMap(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return posts.slice(0, options.limit || 50);
  }
  
  // Cache frequently accessed data
  private async getCachedFollowing(userId: string): Promise<string[]> {
    const cacheKey = `following:${userId}`;
    
    let following = await this.cache.get(cacheKey);
    
    if (!following) {
      const snapshot = await db.collection('follows')
        .doc(userId)
        .collection('following')
        .where('status', '==', 'active')
        .get();
      
      following = snapshot.docs.map(doc => doc.id);
      
      // Cache for 5 minutes
      await this.cache.set(cacheKey, following, 300);
    }
    
    return following;
  }
  
  // Denormalize data for read efficiency
  async createPostWithDenormalization(userId: string, postData: CreatePostRequest): Promise<SocialPost> {
    const user = await this.userService.getUser(userId);
    
    const post: SocialPost = {
      id: this.generateId(),
      authorId: userId,
      // Denormalize author data for faster feed rendering
      author: {
        displayName: user.displayName,
        username: user.username,
        avatar: user.avatar,
        isVerified: user.isVerified
      },
      ...postData,
      metrics: {
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        viewsCount: 0
      },
      interactions: {
        likedBy: [],
        sharedBy: []
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Save post and update denormalized feed documents
    await Promise.all([
      db.collection('posts').doc(post.id).set(post),
      this.updateFollowerFeeds(userId, post)
    ]);
    
    return post;
  }
  
  private async updateFollowerFeeds(authorId: string, post: SocialPost): Promise<void> {
    const followers = await this.getFollowers(authorId);
    
    // Batch write to follower feeds
    const batch = db.batch();
    
    followers.forEach(followerId => {
      const feedItemRef = db.collection('feed')
        .doc(followerId)
        .collection('items')
        .doc(post.id);
      
      batch.set(feedItemRef, {
        postId: post.id,
        authorId,
        type: 'post',
        timestamp: post.createdAt,
        score: this.calculateInitialScore(post)
      });
    });
    
    await batch.commit();
  }
}

// Caching Strategy
export class CacheService {
  private redis: Redis;
  
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }
  
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }
  
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }
  
  async invalidate(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }
  
  // Specific cache strategies for social features
  async cacheUserProfile(userId: string, profile: UserProfile, ttl: number = 600): Promise<void> {
    await this.set(`profile:${userId}`, profile, ttl);
  }
  
  async getCachedProfile(userId: string): Promise<UserProfile | null> {
    return this.get<UserProfile>(`profile:${userId}`);
  }
  
  async invalidateUserCache(userId: string): Promise<void> {
    await this.invalidate(`*:${userId}:*`);
    await this.invalidate(`profile:${userId}`);
    await this.invalidate(`following:${userId}`);
    await this.invalidate(`followers:${userId}`);
  }
}
```

---

## 9. Testing Strategy

### 9.1 Component Testing

```typescript
// Social Feature Tests
describe('PostCard Component', () => {
  const mockPost: SocialPost = {
    id: 'post-1',
    authorId: 'user-1',
    author: {
      displayName: 'John Trader',
      username: 'johntrader',
      avatar: '/avatars/john.jpg',
      isVerified: true
    },
    type: 'general',
    content: 'Just had a great trading day! 🚀 #trading #success',
    hashtags: ['trading', 'success'],
    attachments: [],
    visibility: 'public',
    metrics: {
      likesCount: 5,
      commentsCount: 2,
      sharesCount: 1,
      viewsCount: 50
    },
    interactions: {
      likedBy: ['user-2', 'user-3'],
      sharedBy: ['user-4']
    },
    createdAt: new Date('2025-01-15T10:00:00Z'),
    updatedAt: new Date('2025-01-15T10:00:00Z')
  };
  
  beforeEach(() => {
    // Mock authentication context
    (useAuth as jest.Mock).mockReturnValue({
      user: { uid: 'current-user', displayName: 'Current User' }
    });
    
    // Mock API hooks
    (useProfile as jest.Mock).mockReturnValue({
      data: mockPost.author,
      loading: false
    });
  });
  
  it('should render post content correctly', () => {
    render(<PostCard post={mockPost} />);
    
    expect(screen.getByText('John Trader')).toBeInTheDocument();
    expect(screen.getByText(/Just had a great trading day/)).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // likes count
    expect(screen.getByTestId('verified-icon')).toBeInTheDocument();
  });
  
  it('should handle like action correctly', async () => {
    const mockLikePost = jest.fn();
    (usePostActions as jest.Mock).mockReturnValue({
      likePost: mockLikePost,
      unlikePost: jest.fn(),
      sharePost: jest.fn()
    });
    
    render(<PostCard post={mockPost} />);
    
    const likeButton = screen.getByLabelText('Like');
    fireEvent.click(likeButton);
    
    expect(mockLikePost).toHaveBeenCalledWith('post-1');
  });
  
  it('should show edit options for own posts', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { uid: 'user-1', displayName: 'John Trader' }
    });
    
    render(<PostCard post={mockPost} />);
    
    expect(screen.getByTestId('post-menu')).toBeInTheDocument();
  });
  
  it('should not show edit options for other users posts', () => {
    render(<PostCard post={mockPost} />);
    
    expect(screen.queryByTestId('post-menu')).not.toBeInTheDocument();
  });
});

describe('FollowButton Component', () => {
  const mockProps = {
    targetUserId: 'user-2',
    onFollow: jest.fn(),
    onUnfollow: jest.fn()
  };
  
  it('should show follow button when not following', () => {
    render(<FollowButton {...mockProps} />);
    
    expect(screen.getByText('Follow')).toBeInTheDocument();
    expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
  });
  
  it('should show following button when already following', () => {
    const relationship: FollowRelationship = {
      followerId: 'current-user',
      followingId: 'user-2',
      followedAt: new Date(),
      notificationsEnabled: true,
      status: 'active',
      metadata: { source: 'manual', mutualFollow: false }
    };
    
    render(<FollowButton {...mockProps} currentRelationship={relationship} />);
    
    expect(screen.getByText('Following')).toBeInTheDocument();
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
  });
  
  it('should handle follow action correctly', async () => {
    render(<FollowButton {...mockProps} />);
    
    const followButton = screen.getByText('Follow');
    fireEvent.click(followButton);
    
    expect(mockProps.onFollow).toHaveBeenCalledWith('user-2');
  });
});
```

### 9.2 Integration Testing

```typescript
// Social API Integration Tests
describe('Social API Integration', () => {
  let testUsers: TestUser[];
  let testPosts: SocialPost[];
  
  beforeAll(async () => {
    // Setup test users
    testUsers = await createTestUsers([
      { username: 'alice', displayName: 'Alice Trader' },
      { username: 'bob', displayName: 'Bob Trader' },
      { username: 'charlie', displayName: 'Charlie Trader' }
    ]);
  });
  
  afterAll(async () => {
    await cleanupTestData();
  });
  
  describe('Follow System', () => {
    it('should create follow relationship correctly', async () => {
      const alice = testUsers[0];
      const bob = testUsers[1];
      
      // Alice follows Bob
      const response = await request(app)
        .post(`/api/social/follow/${bob.uid}`)
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.following).toBe(true);
      
      // Verify relationship in database
      const relationship = await db.collection('follows')
        .doc(alice.uid)
        .collection('following')
        .doc(bob.uid)
        .get();
      
      expect(relationship.exists).toBe(true);
      expect(relationship.data()?.status).toBe('active');
      
      // Verify follower counts updated
      const aliceProfile = await db.collection('profiles').doc(alice.uid).get();
      const bobProfile = await db.collection('profiles').doc(bob.uid).get();
      
      expect(aliceProfile.data()?.stats.followingCount).toBe(1);
      expect(bobProfile.data()?.stats.followersCount).toBe(1);
    });
    
    it('should prevent self-following', async () => {
      const alice = testUsers[0];
      
      await request(app)
        .post(`/api/social/follow/${alice.uid}`)
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(400);
    });
    
    it('should handle unfollow correctly', async () => {
      const alice = testUsers[0];
      const bob = testUsers[1];
      
      // First follow
      await request(app)
        .post(`/api/social/follow/${bob.uid}`)
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);
      
      // Then unfollow
      await request(app)
        .delete(`/api/social/follow/${bob.uid}`)
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);
      
      // Verify relationship removed
      const relationship = await db.collection('follows')
        .doc(alice.uid)
        .collection('following')
        .doc(bob.uid)
        .get();
      
      expect(relationship.exists).toBe(false);
    });
  });
  
  describe('Feed Generation', () => {
    beforeEach(async () => {
      // Create test posts
      testPosts = await createTestPosts([
        { authorId: testUsers[0].uid, content: 'Alice post 1' },
        { authorId: testUsers[1].uid, content: 'Bob post 1' },
        { authorId: testUsers[2].uid, content: 'Charlie post 1' }
      ]);
    });
    
    it('should generate personalized feed correctly', async () => {
      const alice = testUsers[0];
      const bob = testUsers[1];
      
      // Alice follows Bob
      await followUser(alice.uid, bob.uid);
      
      // Get Alice's feed
      const response = await request(app)
        .get('/api/feed')
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);
      
      const feed = response.body.data;
      
      // Should contain Bob's posts but not Charlie's
      expect(feed.some((item: any) => item.authorId === bob.uid)).toBe(true);
      expect(feed.some((item: any) => item.authorId === testUsers[2].uid)).toBe(false);
    });
    
    it('should respect post visibility settings', async () => {
      const alice = testUsers[0];
      const bob = testUsers[1];
      
      // Create private post by Bob
      const privatePost = await createTestPost({
        authorId: bob.uid,
        content: 'Private post',
        visibility: 'private'
      });
      
      // Alice follows Bob
      await followUser(alice.uid, bob.uid);
      
      // Get Alice's feed
      const response = await request(app)
        .get('/api/feed')
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);
      
      const feed = response.body.data;
      
      // Should not contain private post
      expect(feed.some((item: any) => item.id === privatePost.id)).toBe(false);
    });
  });
  
  describe('Real-time Features', () => {
    it('should send notifications for new followers', async () => {
      const alice = testUsers[0];
      const bob = testUsers[1];
      
      // Mock notification service
      const notificationSpy = jest.spyOn(notificationService, 'createNotification');
      
      // Alice follows Bob
      await request(app)
        .post(`/api/social/follow/${bob.uid}`)
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);
      
      // Verify notification was created
      expect(notificationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: bob.uid,
          type: 'follow',
          actorId: alice.uid
        })
      );
    });
  });
});
```

---

## 10. Deployment Considerations

### 10.1 Environment Configuration

```typescript
// Environment-specific social features
export const getSocialConfig = () => {
  const env = process.env.NODE_ENV;
  
  const baseConfig = {
    features: {
      realTimeUpdates: true,
      imageUploads: true,
      achievements: true,
      feedAlgorithm: 'chronological' as 'chronological' | 'algorithmic'
    },
    limits: {
      postsPerHour: 10,
      followsPerHour: 30,
      commentsPerHour: 20,
      maxFollowing: 5000,
      maxImageSize: 5 * 1024 * 1024, // 5MB
      maxPostLength: 500,
      maxBioLength: 280
    },
    caching: {
      profileTTL: 600, // 10 minutes
      feedTTL: 300,    // 5 minutes
      followingTTL: 300 // 5 minutes
    }
  };
  
  switch (env) {
    case 'development':
      return {
        ...baseConfig,
        features: {
          ...baseConfig.features,
          debugMode: true
        },
        limits: {
          ...baseConfig.limits,
          postsPerHour: 100, // More lenient for testing
          followsPerHour: 100
        }
      };
      
    case 'staging':
      return {
        ...baseConfig,
        features: {
          ...baseConfig.features,
          feedAlgorithm: 'algorithmic' // Test algorithmic feed
        }
      };
      
    case 'production':
      return {
        ...baseConfig,
        features: {
          ...baseConfig.features,
          feedAlgorithm: 'algorithmic'
        },
        monitoring: {
          enableMetrics: true,
          enableErrorTracking: true,
          sampleRate: 0.1
        }
      };
      
    default:
      return baseConfig;
  }
};
```

### 10.2 Monitoring & Analytics

```typescript
// Social Features Analytics
export class SocialAnalytics {
  async trackProfileView(viewerId: string | null, profileId: string): Promise<void> {
    // Track profile views for recommendations
    await this.analytics.track('profile_viewed', {
      viewer_id: viewerId,
      profile_id: profileId,
      timestamp: new Date(),
      is_authenticated: !!viewerId
    });
  }
  
  async trackSocialInteraction(action: SocialAction, userId: string, targetId: string): Promise<void> {
    await this.analytics.track('social_interaction', {
      action,
      user_id: userId,
      target_id: targetId,
      timestamp: new Date()
    });
    
    // Update real-time metrics
    await this.updateSocialMetrics(action, userId);
  }
  
  async trackFeedEngagement(userId: string, postId: string, action: 'view' | 'like' | 'comment' | 'share'): Promise<void> {
    await this.analytics.track('feed_engagement', {
      user_id: userId,
      post_id: postId,
      action,
      timestamp: new Date()
    });
  }
  
  async generateSocialMetricsReport(): Promise<SocialMetrics> {
    const [
      totalUsers,
      activeUsers,
      totalPosts,
      engagementRate,
      topPerformers
    ] = await Promise.all([
      this.getTotalUsers(),
      this.getActiveUsers(),
      this.getTotalPosts(),
      this.getEngagementRate(),
      this.getTopPerformers()
    ]);
    
    return {
      users: {
        total: totalUsers,
        active_7d: activeUsers.week,
        active_30d: activeUsers.month
      },
      content: {
        total_posts: totalPosts,
        posts_7d: await this.getRecentPosts(7),
        engagement_rate: engagementRate
      },
      community: {
        top_creators: topPerformers.creators,
        trending_hashtags: await this.getTrendingHashtags(),
        avg_followers_per_user: await this.getAverageFollowersPerUser()
      }
    };
  }
}

// Health Checks
export const socialHealthChecks = {
  async checkFeedGeneration(): Promise<HealthCheck> {
    try {
      const testUserId = 'health-check-user';
      const feed = await feedService.generatePersonalizedFeed(testUserId, { limit: 1 });
      
      return {
        service: 'feed_generation',
        status: 'healthy',
        latency: Date.now() - startTime,
        details: { posts_returned: feed.length }
      };
    } catch (error) {
      return {
        service: 'feed_generation',
        status: 'unhealthy',
        error: error.message
      };
    }
  },
  
  async checkWebSocketConnections(): Promise<HealthCheck> {
    try {
      const activeConnections = await webSocketService.getActiveConnectionCount();
      
      return {
        service: 'websocket',
        status: activeConnections < 10000 ? 'healthy' : 'degraded',
        details: { active_connections: activeConnections }
      };
    } catch (error) {
      return {
        service: 'websocket',
        status: 'unhealthy',
        error: error.message
      };
    }
  },
  
  async checkSocialDatabase(): Promise<HealthCheck> {
    try {
      const startTime = Date.now();
      
      // Test critical social queries
      const [profilesCount, postsCount, followsCount] = await Promise.all([
        db.collection('profiles').limit(1).get(),
        db.collection('posts').limit(1).get(),
        db.collection('follows').limit(1).get()
      ]);
      
      return {
        service: 'social_database',
        status: 'healthy',
        latency: Date.now() - startTime,
        details: {
          profiles_accessible: !profilesCount.empty,
          posts_accessible: !postsCount.empty,
          follows_accessible: !followsCount.empty
        }
      };
    } catch (error) {
      return {
        service: 'social_database',
        status: 'unhealthy',
        error: error.message
      };
    }
  }
};
```

---

## Implementation Timeline

### Phase 1: Foundation (Weeks 1-2)
- User profiles system with privacy controls
- Basic follow/follower functionality
- Profile discovery and search

### Phase 2: Content System (Weeks 3-4)
- Post creation and management
- Social feed generation
- Like/comment/share functionality

### Phase 3: Real-time Features (Weeks 5-6)
- WebSocket integration
- Live feed updates
- Real-time notifications

### Phase 4: Advanced Features (Weeks 7-8)
- Achievement system
- Content moderation
- Analytics and monitoring

### Phase 5: Optimization & Launch (Weeks 9-10)
- Performance optimization
- Testing and bug fixes
- Production deployment

---

*This implementation guide provides the complete technical foundation for Binary Hub's social features. All components follow modern React patterns, TypeScript best practices, and scalable architecture principles to ensure maintainable and performant social functionality.*

**Version:** 1.0  
**Date:** January 2025  
**Next Review:** February 2025