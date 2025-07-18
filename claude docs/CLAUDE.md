# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Development Setup
- `npm run setup` - Initial setup script that installs dependencies for both frontend and functions
- `npm run dev` - Start both emulators and frontend concurrently
- `npm run dev:emulator` - Start Firebase emulators (auth, functions, firestore, storage)
- `npm run dev:frontend` - Start Next.js frontend development server (from app directory)

### Build and Test
- `npm run build` - Build the frontend (Next.js app)
- `npm run test` - Run Jest tests in functions directory
- `npm run lint` - Run ESLint on both app and functions directories

### Deployment
- `npm run deploy` - Full deployment (build + deploy everything)
- `npm run deploy:functions` - Deploy only Firebase Functions
- `npm run deploy:hosting` - Build and deploy only hosting

### Functions Development
- `cd functions && npm run build` - Build TypeScript functions
- `cd functions && npm run build:watch` - Build with watch mode
- `cd functions && npm run test` - Run Jest tests
- `cd functions && npm run test:watch` - Run tests in watch mode

## Architecture Overview

Binary Hub is a SaaS trading journal for binary options traders built with:

**Frontend:** Next.js 14 with TypeScript, Tailwind CSS, deployed on Vercel
**Backend:** Firebase Functions (Node.js 20) with TypeScript
**Database:** Firestore NoSQL with collections for users, trades, rules, and insights
**Auth:** Firebase Auth with Google and email authentication
**Storage:** Firebase Storage for CSV uploads
**AI:** OpenAI GPT-4o for generating trading insights

### Key Directory Structure
```
app/                    # Next.js frontend
functions/             # Firebase Functions backend
  src/                 # TypeScript source
  lib/                 # Compiled JavaScript
docs/                  # Architecture and business documentation
design/                # UI/UX assets and style guides
```

### Data Model
**Collections:**
- `users/{uid}` - User profiles and subscription data
- `trades/{uid}/trades/{tradeId}` - Individual trade records
- `rules/{uid}/rules/{ruleId}` - Personal trading rules
- `insights/{uid}/insights/{insightId}` - AI-generated insights

## Development Notes

### Firebase Functions
- Uses Firebase Functions v2 with regions set to `us-central1`
- Main API endpoint: `functions/src/index.ts` exports `api` function
- Background functions for CSV processing and scheduled insights generation
- OpenAI integration for trade analysis and coaching
- Rate limiting and authentication middleware configured

### Authentication
- Development mock token: `mock-token-for-testing` for user `test-user-123`
- Real tokens use Firebase Auth ID tokens with Bearer authentication

### API Endpoints
Key endpoints (all require authentication):
- `/trades` - GET/POST for trade management
- `/dashboard/stats` - Performance KPIs
- `/insights/generate` - On-demand AI insights
- `/rules` - GET/POST for personal trading rules

### Testing
- Jest configured for TypeScript in functions
- Test files in `functions/src/__tests__/`
- Coverage reports generated in `functions/coverage/`

### Emulator Ports
- Auth: 9088
- Functions: 5002
- Firestore: 8888
- Hosting: 3001
- Storage: 9188
- UI: 4444

## Important Notes

- Functions use Node.js 20 runtime
- OpenAI API key managed through Firebase secrets
- CSV processing happens via Cloud Storage triggers
- Weekly insights generated via scheduled functions
- All user data is scoped by Firebase Auth UID
- Frontend and functions have separate package.json files