# Binary Hub – Social Trading Platform MVP Scope

*Versão 3.0 – Social-First Approach*

## Objetivo

Entregar, em até **3-4 meses**, a primeira plataforma social dedicada a traders de opções binárias que permita:

### Core Social Features
1. **Criar perfil público** com métricas de performance e biografia
2. **Conectar-se com outros traders** através de sistema de follow/followers  
3. **Compartilhar trades e insights** em feed social da comunidade
4. **Descobrir novos traders** através de busca e recomendações

### Core Trading Features  
5. **Registrar trades** manualmente ou via CSV import (Ebinex)
6. **Visualizar KPIs** em dashboard com controles de privacidade
7. **Navegar calendário** de performance com heat-map
8. **Definir regras pessoais** e acompanhar aderência

### Business Features
9. **Sistema de billing** com tiers Free/Pro/Collaborative
10. **Controles de privacidade** granulares para dados e perfil

> **Meta de sucesso:** 1.000 usuários ativos, 200 assinantes Pro ($2.400 MRR), 70% completion rate de profiles

---

## 1. Funcionalidades (Must / Should / Could)

### SOCIAL CORE FEATURES

| ID | Epic / Feature | Descrição | Prioridade | Sprint |
|----|----------------|-----------|------------|---------|
| **S-01** | Public Trader Profiles | Profile setup com bio, avatar, performance metrics, achievements | **Must** | S-01 |
| **S-02** | Follow/Follower System | One-way follow, notifications, follower management | **Must** | S-01 |
| **S-03** | Social Feed | Timeline com posts, trade shares, achievements | **Must** | S-02 |
| **S-04** | Trade Sharing | Share trades específicos com contexto e insights | **Must** | S-02 |
| **S-05** | Discovery & Search | Buscar traders, filtrar por performance, recomendações | **Should** | S-03 |
| **S-06** | Achievement System | Badges, milestones, community recognition | **Should** | S-03 |
| **S-07** | Notifications | Real-time notifications para follows, likes, comments | **Should** | S-03 |

### TRADING CORE FEATURES

| ID | Epic / Feature | Descrição | Prioridade | Sprint |
|----|----------------|-----------|------------|---------|
| **T-01** | Authentication & Onboarding | Email, Google, Apple SSO + social profile setup | **Must** | S-01 |
| **T-02** | Enhanced Trade Logging | Form com opções de sharing social | **Must** | S-01 |
| **T-03** | CSV Import (Ebinex) | Upload, parse, deduplicate com prompts de sharing | **Must** | S-02 |
| **T-04** | Dashboard KPIs | Performance metrics com privacy controls | **Must** | S-02 |
| **T-05** | Trading Calendar | Heat-map com social sharing integration | **Must** | S-02 |
| **T-06** | Personal Rules | CRUD com opções de community sharing | **Should** | S-03 |

### BUSINESS & PLATFORM FEATURES

| ID | Epic / Feature | Descrição | Prioridade | Sprint |
|----|----------------|-----------|------------|---------|
| **B-01** | Billing & Subscriptions | Stripe integration, Free/Pro/Collaborative tiers | **Must** | S-04 |
| **B-02** | Privacy Controls | Granular visibility settings para profile e métricas | **Must** | S-04 |
| **B-03** | Content Moderation | Basic moderation tools, reporting system | **Should** | S-04 |
| **B-04** | Admin Dashboard | User management, content moderation, analytics | **Could** | Future |

---

## 2. User Stories & Acceptance Criteria

### Epic S-01 – Public Trader Profiles

**US-S01-01:** *Como trader*, quero criar um perfil público para showcasing my trading performance para a comunidade.

* **AC-1:** Profile setup wizard durante onboarding com steps: basic info, bio, performance settings
* **AC-2:** Avatar upload com resize automático para 200x200px
* **AC-3:** Bio campo com 280 caracteres max, markdown support básico
* **AC-4:** Performance metrics calculadas automaticamente de trades existentes
* **AC-5:** Achievement badges atribuídos automaticamente (primeiro trade, 100 trades, etc.)

**US-S01-02:** *Como visitante*, quero visualizar profiles públicos de outros traders para descobrir potenciais conexões.

* **AC-1:** Profile page `/profile/[username]` acessível sem login
* **AC-2:** Performance metrics mostradas conforme privacy settings do usuário
* **AC-3:** Recent trades e posts mostrados conforme visibility settings
* **AC-4:** Follow button para usuários logados
* **AC-5:** SEO otimizado com meta tags para sharing

### Epic S-02 – Follow/Follower System  

**US-S02-01:** *Como trader*, quero seguir outros traders para acompanhar their updates no meu feed.

* **AC-1:** Follow button em profiles com loading state
* **AC-2:** Follow action cria documento em `follows/{uid}/following/{targetUid}`
* **AC-3:** Real-time update de follower count no profile do target
* **AC-4:** Notification enviada para o trader seguido
* **AC-5:** Unfollow functionality com confirmação

**US-S02-02:** *Como trader*, quero gerenciar meus followers para controlar minha audience.

* **AC-1:** Followers list em `/profile/me/followers` 
* **AC-2:** Remove follower functionality
* **AC-3:** Block user option com UI confirmation
* **AC-4:** Privacy setting para require approval for new followers

### Epic S-03 – Social Feed

**US-S03-01:** *Como trader*, quero ver um feed personalizado com updates dos traders que sigo.

* **AC-1:** Feed page `/feed` com infinite scroll
* **AC-2:** Posts de followed users ordenados cronologicamente
* **AC-3:** Post types: trade shares, achievements, general insights
* **AC-4:** Like/comment functionality em cada post
* **AC-5:** Real-time updates via WebSocket connections

**US-S03-02:** *Como trader*, quero compartilhar insights e conquistas para engajar com a community.

* **AC-1:** Post composer com 500 caracteres max
* **AC-2:** Attach specific trade para contextualizar post
* **AC-3:** Hashtag support para categorização (#strategy #analysis)
* **AC-4:** Privacy levels: public, followers-only, private
* **AC-5:** Post analytics: views, likes, comments, shares

### Epic T-02 – Enhanced Trade Logging

**US-T02-01:** *Como trader*, quero registrar trades com opção de compartilhar achievements socially.

* **AC-1:** Enhanced form com seção "Share with Community"
* **AC-2:** Checkbox para auto-share milestones (first win, streak achievements)
* **AC-3:** Quick share button após successful trade save
* **AC-4:** Trade context field para explicar strategy/reasoning
* **AC-5:** Privacy setting para default sharing behavior

### Epic B-01 – Billing & Subscriptions

**US-B01-01:** *Como usuário free*, quero upgrade para Pro para unlock advanced features.

* **AC-1:** Pricing page `/pricing` com tier comparison
* **AC-2:** Stripe checkout integration com payment methods locais
* **AC-3:** Subscription management em `/settings/billing`
* **AC-4:** Feature gating baseado em subscription tier
* **AC-5:** Billing notifications e email confirmations

**Subscription Tiers:**
```
FREE (Community)
├─ Profile público básico  
├─ Follow/followers unlimited
├─ Social feed completo
├─ Trading journal (50 trades/mês)
└─ Basic analytics

PRO ($12/mês)
├─ Tudo do Free
├─ Trading journal unlimited  
├─ Advanced analytics & charts
├─ Export capabilities (PDF/CSV)
├─ Priority support
└─ Profile customization

COLLABORATIVE ($24/mês) [Future]
├─ Tudo do Pro
├─ Live trading collaboration
├─ Voice communication
├─ Shared charts & annotations
└─ Partnership analytics
```

---

## 3. Technical Architecture

### Database Schema (Social Extensions)

```typescript
// User Profiles
profiles/{uid}: {
  basic: {
    displayName: string;
    username: string; // unique
    avatar: string;
    bio: string;
    location?: string;
    tradingSince: timestamp;
    isVerified: boolean;
    subscription: 'free' | 'pro' | 'collaborative';
  };
  stats: {
    followersCount: number;
    followingCount: number;
    postsCount: number;
    totalTrades: number;
    winRate?: number;
    monthlyPnL?: number;
    currentStreak?: number;
  };
  privacy: {
    profileVisibility: 'public' | 'community' | 'private';
    metricsVisibility: {
      winRate: boolean;
      pnl: boolean;
      streaks: boolean;
      tradeCount: boolean;
    };
    allowFollowers: boolean;
    requireFollowApproval: boolean;
  };
  achievements: {
    badges: string[];
    milestones: Achievement[];
    lastCalculated: timestamp;
  };
}

// Social Relationships
follows/{uid}/following/{targetUid}: {
  followedAt: timestamp;
  notificationsEnabled: boolean;
  status: 'active' | 'muted';
}

follows/{uid}/followers/{followerUid}: {
  followedAt: timestamp;
  status: 'active' | 'pending' | 'blocked';
}

// Social Content
posts/{uid}/{postId}: {
  type: 'trade' | 'insight' | 'achievement' | 'general';
  content: string;
  hashtags?: string[];
  attachments?: string[];
  tradeRef?: string; // reference to specific trade
  visibility: 'public' | 'followers' | 'private';
  metrics: {
    likesCount: number;
    commentsCount: number; 
    sharesCount: number;
    viewsCount: number;
  };
  createdAt: timestamp;
  updatedAt: timestamp;
}

// Feed Generation
feed/{uid}/{feedItemId}: {
  authorId: string;
  postId: string;
  type: 'post' | 'achievement' | 'follow' | 'milestone';
  timestamp: timestamp;
  score: number; // for algorithmic ranking
}

// Enhanced Trades (Social Integration)
trades/{uid}/{tradeId}: {
  // existing trade fields...
  social: {
    isShared: boolean;
    postRef?: string;
    sharedAt?: timestamp;
    visibility: 'private' | 'followers' | 'public';
  };
}
```

### API Endpoints (Social Extensions)

```typescript
// Profile Management
GET    /api/profiles/{username}           # Get public profile
PUT    /api/profiles/me                   # Update own profile  
GET    /api/profiles/me/privacy           # Get privacy settings
PUT    /api/profiles/me/privacy           # Update privacy settings
GET    /api/profiles/search               # Search profiles
GET    /api/profiles/suggestions          # Get recommended profiles

// Social Interactions
POST   /api/social/follow/{uid}           # Follow user
DELETE /api/social/follow/{uid}           # Unfollow user
GET    /api/social/followers/{uid}        # Get followers list
GET    /api/social/following/{uid}        # Get following list
POST   /api/social/block/{uid}            # Block user
DELETE /api/social/block/{uid}            # Unblock user

// Content Management  
GET    /api/posts                         # Get feed posts
POST   /api/posts                         # Create new post
GET    /api/posts/{postId}                # Get specific post
PUT    /api/posts/{postId}                # Update own post
DELETE /api/posts/{postId}                # Delete own post
POST   /api/posts/{postId}/like           # Like/unlike post
GET    /api/posts/{postId}/comments       # Get post comments
POST   /api/posts/{postId}/comments       # Add comment

// Discovery & Analytics
GET    /api/discovery/trending            # Trending content/users
GET    /api/discovery/recommended         # Personalized recommendations
GET    /api/analytics/profile             # Own profile analytics
```

---

## 4. Success Metrics & KPIs

### User Acquisition (Month 1-3)
- **Target:** 1.000 registered users
- **Growth Rate:** 25% MoM after initial launch
- **Channel Performance:** 60% organic, 25% referral, 15% paid

### User Engagement (Month 1-6)
- **Profile Completion:** 70%+ users complete full profile setup
- **Social Engagement:** 2.5+ follows per active user
- **Content Creation:** 30%+ users create at least 1 post per month
- **Session Time:** 15+ minutes average session duration
- **Retention:** 80%+ monthly retention rate

### Monetization (Month 3-6)
- **Conversion Rate:** 20%+ free users upgrade to Pro
- **ARPU:** $15+ average revenue per user  
- **Churn Rate:** <5% monthly churn for paid users
- **LTV/CAC Ratio:** >3:1 ratio

### Community Health (Ongoing)
- **Content Quality:** <5% reported posts
- **Engagement Rate:** 25%+ posts receive likes/comments
- **Network Density:** 40%+ users follow 3+ other users
- **Community Growth:** 40%+ new users come via referrals

---

## 5. Go-to-Market Strategy

### Phase 1: Beta Community (Week 1-4)
- **Target:** 50 engaged traders como founding members
- **Selection:** Existing trading course students, active community members
- **Goal:** Validate core social features, gather feedback
- **Success:** 80%+ profile completion, 5+ posts per user

### Phase 2: Controlled Expansion (Week 5-8)  
- **Target:** 200 users através de invite-only expansion
- **Strategy:** Existing users can invite 3 friends each
- **Goal:** Test scalability, refine social algorithms  
- **Success:** 3+ follows per user, 70%+ weekly retention

### Phase 3: Public Launch (Week 9-12)
- **Target:** 1.000 users através de marketing campaign
- **Channels:** YouTube partnerships, influencer collaborations
- **Goal:** Achieve product-market fit indicators
- **Success:** Organic growth, positive user feedback

### Phase 4: Growth & Iteration (Month 4+)
- **Target:** 2.500+ users, sustainable growth rate
- **Focus:** Feature improvements based on user data
- **Goal:** Prepare for Phase 2 (Live Collaboration) development

---

## 6. Development Timeline

### Sprint 1 (Week 1-3): Social Foundation
- [ ] Enhanced authentication with profile setup
- [ ] Public profile pages with performance metrics
- [ ] Basic follow/follower system
- [ ] Profile discovery and search

### Sprint 2 (Week 4-6): Social Features
- [ ] Social feed with post creation
- [ ] Trade sharing functionality  
- [ ] Like/comment system
- [ ] Real-time notifications

### Sprint 3 (Week 7-9): Community Features
- [ ] Achievement system and badges
- [ ] Advanced discovery algorithms
- [ ] Content moderation tools
- [ ] Privacy controls enhancement

### Sprint 4 (Week 10-12): Business Features  
- [ ] Billing integration with Stripe
- [ ] Subscription tier management
- [ ] Analytics and reporting
- [ ] Launch preparation and testing

### Sprint 5 (Week 13-16): Polish & Launch
- [ ] Performance optimization
- [ ] Bug fixes and edge cases
- [ ] Community management tools
- [ ] Public launch campaign

---

## 7. Risk Mitigation

### Technical Risks
- **Real-time Performance:** Implement efficient WebSocket connections with fallbacks
- **Database Scaling:** Plan for Firestore limits, implement proper indexing
- **Image Storage:** Optimize avatar/image uploads with CDN integration

### Product Risks  
- **Cold Start Problem:** Address with beta community strategy
- **Content Moderation:** Implement hybrid AI + human moderation
- **Privacy Concerns:** Transparent privacy controls and user education

### Business Risks
- **Competition:** Focus on community moat and network effects
- **Monetization:** Validate pricing through beta testing
- **Regulatory:** Monitor financial content regulations

---

## 8. Definition of Done

### Feature Completion Criteria
- [ ] All acceptance criteria met and tested
- [ ] Unit tests with ≥80% coverage  
- [ ] Performance meets targets (<2s load, <500ms API)
- [ ] Mobile responsive design verified
- [ ] Privacy controls functional and tested
- [ ] Social features work in real-time
- [ ] Billing integration fully functional

### Launch Readiness Criteria
- [ ] Beta testing completed with 50+ users
- [ ] Performance optimization completed
- [ ] Security audit passed
- [ ] Content moderation system active  
- [ ] Customer support processes defined
- [ ] Analytics and monitoring in place

---

*"Building the future of social trading, one connection at a time."*