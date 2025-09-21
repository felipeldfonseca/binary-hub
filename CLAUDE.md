# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Development Commands

### Development Setup
```bash
npm run setup           # Initial setup: installs dependencies for frontend and functions
npm run dev             # Start Firebase emulators + Next.js frontend concurrently
npm run dev:emulator    # Start Firebase emulators only (auth, functions, firestore, storage)
npm run dev:frontend    # Start Next.js dev server only (from app directory)
```

### Build & Testing
```bash
npm run build           # Build Next.js frontend
npm run lint            # Lint both app and functions
npm run test            # Run Jest tests in functions directory
cd app && npm run type-check    # TypeScript type checking for frontend
cd functions && npm run test:watch    # Jest tests with watch mode
```

### Deployment
```bash
npm run deploy          # Full deployment: build + deploy all Firebase services
npm run deploy:functions     # Deploy Firebase Functions only
npm run deploy:hosting       # Build Next.js app + deploy Firebase Hosting
```

## Architecture Overview

Binary Hub is the first social trading platform for binary options traders with AI-powered insights, featuring:

**Frontend:** Next.js 14 with TypeScript, Tailwind CSS, deployed on Vercel
- Social components for profiles, feeds, discovery, and networking
- Trading components enhanced with social sharing capabilities
- AI insight components for daily/weekly analysis and recommendations
- Real-time updates via WebSocket connections
- Components use React Hook Form + Zod validation
- State management: React Query (server state) + Zustand (client state)
- Authentication via Firebase Auth context

**Backend:** Firebase Functions v2 (Node.js 20) with TypeScript
- Main API at `/functions/src/index.ts` exports `api` function
- Express.js server with authentication middleware and rate limiting
- Social interaction APIs for follow/follower systems, posts, and feeds
- AI analysis APIs for pattern recognition and insight generation
- OpenAI GPT-4o integration for daily/weekly trading analysis

**Database:** Firestore NoSQL with enhanced social and AI collections:
- `users/{uid}` - User profiles and subscription data
- `profiles/{uid}` - Public trader profiles with performance metrics
- `follows/{uid}/{targetUid}` - Follow/follower relationships
- `posts/{uid}/{postId}` - Social content and trade sharing
- `feed/{uid}/{feedItemId}` - Personalized social feeds
- `trades/{uid}/{tradeId}` - Individual trade records with social integration
- `ai_reports/{uid}/{reportId}` - AI-generated daily/weekly analysis
- `ai_insights/{uid}/{insightId}` - AI pattern recognition and recommendations
- `rules/{uid}/{ruleId}` - Personal trading rules
- `uploads/{uid}/{uploadId}` - CSV upload metadata

**Storage:** Firebase Storage for CSV file uploads with processing triggers

### Project Structure
```
app/                    # Next.js 14 frontend application
├── components/         # React components
│   ├── auth/          # Authentication components
│   ├── dashboard/     # Trading dashboard and analytics
│   ├── social/        # Social features (profiles, feeds, discovery)
│   ├── ai/            # AI insights and analysis components
│   ├── trades/        # Trade logging and management
│   └── shared/        # Shared UI components
├── hooks/              # Custom React hooks
├── lib/                # Utilities, Firebase config, contexts
└── types/              # TypeScript type definitions

functions/              # Firebase Functions backend (Node.js 20)
├── src/
│   ├── routes/         # Express route handlers
│   │   ├── social.ts  # Social interaction APIs
│   │   ├── ai.ts      # AI analysis APIs
│   │   ├── trades.ts  # Enhanced trading APIs
│   │   └── dashboard.ts # Dashboard APIs
│   ├── services/       # Business logic
│   │   ├── socialService.ts     # Social features logic
│   │   ├── aiAnalysisService.ts # AI pattern recognition
│   │   ├── openai.ts           # OpenAI integration
│   │   └── csvParser.ts        # CSV processing
│   └── index.ts        # Main Functions export
└── lib/                # Compiled JavaScript output

docs/                   # Architecture and business documentation
├── dev/               # Development guides (PRD, MVP scope, business plan)
├── features/          # Future feature specifications (collaborative, AI)
└── ui/                # UI/UX documentation
design/                 # UI/UX assets and brand guidelines
```

### Firebase Configuration
The project uses Firebase emulators for local development:
- **Auth:** localhost:9089  
- **Functions:** localhost:5004
- **Firestore:** localhost:8889
- **Hosting:** localhost:3002
- **Storage:** localhost:9189

Emulator ports are defined in `firebase.json` and differ from the existing CLAUDE.md ports.

### API Authentication
- **Development:** Mock token `mock-token-for-testing` for user `test-user-123`
- **Production:** Firebase Auth ID tokens with Bearer authentication
- All API endpoints require authentication via middleware

### Key API Endpoints (require auth)

#### Social APIs
```
/profiles/{username}    # GET public profile, PUT update own profile
/social/follow/{uid}    # POST follow user, DELETE unfollow
/social/followers/{uid} # GET followers list
/social/following/{uid} # GET following list
/posts                  # GET feed posts, POST create post
/posts/{postId}         # GET/PUT/DELETE specific post
/posts/{postId}/like    # POST like/unlike post
/discovery/trending     # GET trending content/users
```

#### AI Analysis APIs  
```
/ai/analyze-daily       # POST trigger daily AI analysis
/ai/reports/{reportId}  # GET AI analysis report
/ai/insights/{id}/share # POST share AI insight socially
/ai/patterns/me         # GET personal pattern analysis
```

#### Enhanced Trading APIs
```
/trades                 # GET/POST trade management with social integration
/trades/bulk            # POST bulk import with sharing prompts
/dashboard/stats        # Performance KPIs with privacy controls
/dashboard/performance  # Chart data
/rules                  # GET/POST personal trading rules with sharing options
/trades/validate-csv    # CSV header validation
```

#### Platform APIs
```
/billing/subscription   # GET/PUT subscription management
/privacy/settings       # GET/PUT privacy controls
/notifications          # GET user notifications
/admin/moderation       # Content moderation tools
```

### Background Functions
- `processCSVUpload` - Triggered on Cloud Storage CSV uploads
- `generateDailyAIAnalysis` - Daily AI analysis for Pro users using Gemini 2.5 Flash Light (8am local time)
- `generateWeeklyInsights` - Weekly AI reports for all users using Gemini 2.5 Flash Light (Monday 8am)
- `analyzeIndividualTrade` - On-demand individual trade analysis using GPT-4o (triggered by user request)
- `updateSocialMetrics` - Real-time updates for follower counts, post metrics
- `moderateContent` - AI-powered content moderation for posts and comments
- `calculateAchievements` - Achievement badge attribution based on milestones
- `cleanupOldData` - Daily cleanup of old upload records and expired data

## Development Guidelines

### Frontend Development
- Follow existing component patterns in `/app/components/`
- **Social Components**: Build reusable profile, feed, and discovery components
- **AI Components**: Create engaging UI for AI insights and recommendations  
- **Real-time Features**: Implement WebSocket connections for live updates
- Use TypeScript strictly - check types with `npm run type-check`
- Components use Tailwind CSS with custom Comfortaa font
- Form handling: React Hook Form + Zod validation
- API calls: Use React Query hooks in `/app/hooks/`
- State management: Zustand for complex social state, React Query for server state

### Backend Development  
- Functions use Express.js with middleware in `/functions/src/index.ts`
- All routes require authentication middleware
- **Social APIs**: Implement follow/follower systems, feed generation, content management
- **AI Integration**: Multi-model approach for cost-effective analysis
  - Gemini 2.5 Flash Light for daily/weekly reports (cost-effective, fast)
  - GPT-4o for individual trade analysis (higher quality, detailed insights)
- **Real-time Updates**: Use Firestore real-time listeners for social features
- **Performance**: Implement caching for social feeds and AI reports
- Data validation using Joi schemas
- Error logging via Firebase Logger

### Testing
- Frontend: No test framework currently configured
- Backend: Jest configured with TypeScript in `/functions/jest.config.js`
- Test files in `/functions/src/__tests__/`
- **Always run `npm run test` after backend changes**

### Type Checking & Linting
- **Always run `npm run lint` after code changes**  
- **Always run `cd app && npm run type-check` for frontend TypeScript errors**
- ESLint configured for both frontend and backend
- Follow existing code style and naming conventions

### CSV Processing
- Ebinex CSV format with specific headers (see validation in functions)
- Uploads stored temporarily in Firebase Storage
- Processing triggered by Cloud Functions with deduplication
- Supports Portuguese column headers for Brazilian users

### AI Features
- **Multi-Model Strategy**: Cost-effective AI analysis approach
  - Gemini 2.5 Flash Light: Daily/weekly automated reports (fast & economical)
  - GPT-4o: Individual trade analysis (high-quality, detailed insights)
- **Free Tier**: Weekly AI reports + 5 individual trade analyses per week
- **Pro Tier**: Daily AI reports + unlimited individual trade analyses
- **Social Integration**: AI insights can be shared with privacy controls
- AI feedback system with like/dislike buttons for continuous improvement
- API keys managed via Firebase secrets
- Prompts and responses in Portuguese for Brazilian market

## Important Notes

- **Product Vision:** Social trading platform with AI-powered insights, not just a personal journal
- **Node.js Version:** Functions require Node.js 20 runtime
- **Bilingual Support:** UI supports English/Portuguese via Language Context
- **Social-First Development:** All features should consider social integration and sharing
- **AI Cost Management:** Use Gemini 2.5 Flash Light for bulk analysis, GPT-4o for premium individual insights
- **Real-time Features:** Social interactions require WebSocket or Firestore real-time listeners
- **Privacy by Design:** Granular privacy controls for all social and performance data
- **Emulator Development:** Always use emulators for local development
- **Security:** All data access scoped by Firebase Auth UID
- **Rate Limiting:** API endpoints have request limits for security
- **Mock Data:** Available in `/app/lib/mockData.ts` for development
- **Environment Variables:** Firebase config required for production builds
- **Branch:** Currently on `feature/api-infrastructure` branch

**Roadmap Phases:**
- **Phase 1** (3-4 months): Social Trading Platform MVP with AI analysis
- **Phase 2** (3-4 months): Live Trading Collaboration (voice, shared charts)
- **Phase 3** (4-5 months): AI-Powered Collaborative Analysis (real-time AI on shared charts)