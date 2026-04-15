# Binary Hub - Lean Rebuild

This document describes the lean rebuild of Binary Hub, designed for minimal cost while maintaining full functionality for personal daily use.

## Architecture Overview

### Old Architecture (Firebase/GCP)
- Firebase Hosting
- Firebase Cloud Functions (Express.js backend)
- Firestore NoSQL database
- Firebase Storage
- Firebase Auth
- 10+ scheduled functions (costly)
- Enterprise-grade monitoring (unnecessary for 0 users)

### New Architecture (Vercel + Supabase)
- Vercel (Next.js frontend + API routes) - **FREE**
- Supabase (Postgres + Auth + Storage) - **FREE tier**
- On-demand AI analysis only (no scheduled jobs)
- No fixed monthly costs

## Monthly Cost Comparison

| Service | Old (Firebase) | New (Supabase + Vercel) |
|---------|---------------|-------------------------|
| Hosting | ~$5-10 | $0 (free tier) |
| Functions | ~$10-30 | $0 (API routes) |
| Database | ~$10-20 | $0 (free: 500MB) |
| Auth | ~$0-5 | $0 (free) |
| Storage | ~$1-5 | $0 (free: 1GB) |
| Scheduled Jobs | ~$5-15 | $0 (eliminated) |
| **Total** | **~$30-80/mo** | **$0** |

## Setup Instructions

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Note your project URL and anon key

### 2. Run Database Migration
```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push
```

Or manually run the SQL in `supabase/migrations/20240415000000_initial_schema.sql` in the Supabase SQL editor.

### 3. Configure Environment Variables
Create `app/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional: For AI features
OPENAI_API_KEY=sk-...
```

### 4. Install Dependencies
```bash
cd app
npm install
```

### 5. Run Development Server
```bash
npm run dev
```

## Project Structure (Lean)

```
app/
├── app/
│   ├── api/
│   │   └── market/          # Market data API routes
│   ├── premarket/           # Premarket analysis page
│   ├── dashboard/           # Trading dashboard
│   └── ...
├── components/
│   ├── trades/
│   │   └── QuickTradeEntry.tsx
│   └── dashboard/
│       └── SessionOverview.tsx
├── hooks/
│   ├── useTradingSessions.ts
│   ├── useTradesSupabase.ts
│   ├── useWatchlist.ts
│   └── useMarketData.ts
├── lib/
│   ├── supabase.ts          # Supabase client
│   └── contexts/
│       └── AuthContextSupabase.tsx
└── types/
    └── database.ts          # TypeScript types

supabase/
├── config.toml              # Local dev config
└── migrations/
    └── 20240415000000_initial_schema.sql
```

## Database Schema

### Core Tables
- `profiles` - User profiles and preferences
- `watchlist_items` - User's instrument watchlist
- `trading_sessions` - Daily trading sessions
- `trades` - Individual trade records
- `trading_rules` - Personal trading rules
- `market_snapshots` - Cached market data
- `ai_analyses` - AI analysis results

### Key Features
- Row Level Security (RLS) - All data is user-scoped
- Automatic timestamps with triggers
- Session stats auto-update when trades change
- Default watchlist seeded on signup

## Daily Workflow

1. **Premarket** (`/premarket`)
   - View watchlist with live prices
   - Set market bias (bullish/bearish/neutral)
   - Note key levels
   - Write premarket analysis
   - Start trading session

2. **Trading** (`/dashboard`)
   - Quick trade entry (binary or futures)
   - Real-time session stats
   - Recent trades list

3. **Post-Session**
   - Session review notes
   - AI-generated session summary (on-demand)
   - Lessons learned

## API Routes

### Market Data
- `GET /api/market/quote?symbol=ES` - Get live quote from Yahoo Finance

### Future Routes (to be added)
- `POST /api/ai/analyze-session` - AI session analysis
- `POST /api/ai/analyze-trade` - AI trade analysis

## Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Connect repo to Vercel
3. Add environment variables
4. Deploy

### Manual
```bash
cd app
npm run build
# Deploy `out/` directory to any static host
```

## Migration from Firebase

The Firebase infrastructure is preserved in the `main` branch. The lean rebuild:
- Does NOT require Firebase
- Does NOT use Cloud Functions
- Does NOT have scheduled jobs
- Uses Postgres instead of Firestore (better for analytics)

To return to Firebase infrastructure, simply checkout `main` branch.

## Future Enhancements

When you have paying users, consider:
1. **Vercel Pro** ($20/mo) - More API routes, bandwidth
2. **Supabase Pro** ($25/mo) - More storage, daily backups
3. **Add scheduled jobs** via Vercel Cron (2 free/day on hobby)
4. **Redis caching** via Upstash (free tier available)

## Development Commands

```bash
# Start dev server
npm run dev

# Type check
npm run type-check

# Build
npm run build

# Lint
npm run lint
```
