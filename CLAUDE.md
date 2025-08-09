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

Binary Hub is a SaaS trading journal for binary options traders with the following architecture:

**Frontend:** Next.js 14 with TypeScript, Tailwind CSS, deployed on Vercel
- Components use React Hook Form + Zod validation
- State management: React Query (server state) + Zustand (client state)
- Authentication via Firebase Auth context

**Backend:** Firebase Functions v2 (Node.js 20) with TypeScript
- Main API at `/functions/src/index.ts` exports `api` function
- Express.js server with authentication middleware and rate limiting
- OpenAI GPT-4o integration for trading insights and coaching

**Database:** Firestore NoSQL with user-scoped collections:
- `users/{uid}` - User profiles and subscription data
- `trades/{uid}/{tradeId}` - Individual trade records  
- `rules/{uid}/{ruleId}` - Personal trading rules
- `insights/{uid}/{insightId}` - AI-generated insights
- `uploads/{uid}/{uploadId}` - CSV upload metadata

**Storage:** Firebase Storage for CSV file uploads with processing triggers

### Project Structure
```
app/                    # Next.js 14 frontend application
├── components/         # React components (auth, dashboard, charts)
├── hooks/              # Custom React hooks
├── lib/                # Utilities, Firebase config, contexts
└── types/              # TypeScript type definitions

functions/              # Firebase Functions backend (Node.js 20)
├── src/
│   ├── routes/         # Express route handlers
│   ├── services/       # Business logic (OpenAI, CSV parser)
│   └── index.ts        # Main Functions export
└── lib/                # Compiled JavaScript output

docs/                   # Architecture and business documentation
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
```
/trades                 # GET/POST trade management
/dashboard/stats        # Performance KPIs 
/dashboard/performance  # Chart data
/insights/generate      # On-demand AI insights
/insights/coach         # Motivational coaching
/rules                  # GET/POST personal trading rules
/trades/check-rules     # AI rule violation checking
/trades/validate-csv    # CSV header validation
```

### Background Functions
- `processCSVUpload` - Triggered on Cloud Storage CSV uploads
- `generateWeeklyInsights` - Scheduled Monday 8am for all users
- `cleanupOldData` - Daily cleanup of old upload records

## Development Guidelines

### Frontend Development
- Follow existing component patterns in `/app/components/`
- Use TypeScript strictly - check types with `npm run type-check`
- Components use Tailwind CSS with custom Comfortaa font
- Form handling: React Hook Form + Zod validation
- API calls: Use React Query hooks in `/app/hooks/`

### Backend Development  
- Functions use Express.js with middleware in `/functions/src/index.ts`
- All routes require authentication middleware
- OpenAI integration in `/functions/src/services/openai.ts`
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
- Weekly insights generation using user trading data
- On-demand coaching and rule checking
- OpenAI API key managed via Firebase secrets
- Prompts and responses in Portuguese for Brazilian market

## Important Notes

- **Node.js Version:** Functions require Node.js 20 runtime
- **Bilingual Support:** UI supports English/Portuguese via Language Context
- **Emulator Development:** Always use emulators for local development
- **Security:** All data access scoped by Firebase Auth UID
- **Rate Limiting:** API endpoints have request limits for security
- **Mock Data:** Available in `/app/lib/mockData.ts` for development
- **Environment Variables:** Firebase config required for production builds
- **Branch:** Currently on `feature/api-infrastructure` branch