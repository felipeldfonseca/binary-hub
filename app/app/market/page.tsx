'use client';

import { useState, useCallback, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import {
  ConvictionScoreRing,
  MacroCard,
  OvernightCard,
  LevelsCard,
  VolatilityCard,
  NewsCard,
} from '@/components/market';
import AnalysisSkeleton from '@/components/market/AnalysisSkeleton';
import { MOCK_ANALYSIS } from '@/lib/mockMarketAnalysis';
import type { MarketAnalysisResponse } from '@/types/market-analysis';
import { getConvictionColor } from '@/types/market-analysis';

export default function MarketPage() {
  const [analysis, setAnalysis] = useState<MarketAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useMock, setUseMock] = useState(true);

  const fetchAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (useMock) {
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setAnalysis(MOCK_ANALYSIS);
      } else {
        const response = await fetch('/api/market/analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ asset: 'ES' }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch analysis');
        }

        const data = await response.json();
        setAnalysis(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analysis');
    } finally {
      setLoading(false);
    }
  }, [useMock]);

  const handleRefresh = () => {
    fetchAnalysis();
  };

  // Auto-load on mount with mock data
  useEffect(() => {
    fetchAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const d = analysis;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-[960px] mx-auto px-6 pt-32 pb-8">
        {/* Page Header */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-[11px] text-white/50 uppercase tracking-wider">
              Pre-Session Analysis
            </div>
            <h1 className="text-3xl font-bold text-white mt-1 font-heading">
              ES / MES Futures
            </h1>
            <div className="text-xs text-white/50 mt-1">
              S&P 500 E-mini {d?.last_updated ? `• Updated ${d.last_updated}` : ''}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Price display */}
            {d?.current_price && (
              <div className="text-right">
                <div className="text-2xl font-bold text-white font-mono">
                  {d.current_price.price}
                </div>
                <div
                  className="text-sm mt-0.5"
                  style={{
                    color:
                      d.current_price.direction === 'up'
                        ? '#E1FFD9'
                        : d.current_price.direction === 'down'
                        ? '#FF4444'
                        : 'rgba(255, 255, 255, 0.5)',
                  }}
                >
                  {d.current_price.direction === 'up' ? '▲' : d.current_price.direction === 'down' ? '▼' : '—'}{' '}
                  {d.current_price.daily_change}
                </div>
              </div>
            )}

            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="w-10 h-10 rounded-xl border border-white/10 bg-white/5
                         flex items-center justify-center cursor-pointer
                         hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#E1FFD9"
                strokeWidth="2"
                strokeLinecap="round"
                className={loading ? 'animate-spin' : ''}
              >
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mock toggle for development */}
        <div className="flex items-center gap-2 mb-6">
          <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
            <input
              type="checkbox"
              checked={useMock}
              onChange={(e) => setUseMock(e.target.checked)}
              className="rounded border-white/20"
            />
            Use mock data (uncheck to call Claude API)
          </label>
        </div>

        {/* Error state */}
        {error && (
          <div className="p-4 mb-6 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
            <strong>Error:</strong> {error}
            <button
              onClick={() => setError(null)}
              className="ml-4 underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && <AnalysisSkeleton />}

        {/* Analysis content */}
        {!loading && d && (
          <>
            {/* Hero Section - Conviction Score */}
            <div
              className="mt-6 p-7 rounded-2xl border border-white/10 animate-fade-in"
              style={{
                background:
                  'linear-gradient(135deg, rgba(225, 255, 217, 0.08) 0%, rgba(255, 165, 0, 0.05) 100%)',
              }}
            >
              <div className="flex gap-6 items-start">
                <ConvictionScoreRing score={d.conviction_score} />
                <div className="flex-1">
                  {/* Conviction label */}
                  <div
                    className="inline-block px-3.5 py-1 rounded-full text-xs font-bold tracking-wide mb-3"
                    style={{
                      backgroundColor:
                        d.conviction_score >= 70
                          ? 'rgba(225, 255, 217, 0.15)'
                          : d.conviction_score >= 40
                          ? 'rgba(255, 165, 0, 0.15)'
                          : 'rgba(255, 68, 68, 0.15)',
                      color: getConvictionColor(d.conviction_score),
                    }}
                  >
                    {d.conviction_label}
                  </div>
                  {/* Explanation */}
                  <p className="text-sm text-white/70 leading-relaxed">
                    {d.conviction_explanation}
                  </p>
                </div>
              </div>

              {/* What to watch */}
              <div className="mt-5">
                <div className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-3">
                  What to Watch
                </div>
                <div className="flex flex-col gap-2">
                  {d.what_to_watch.map((item, i) => (
                    <div key={i} className="flex gap-2.5 items-start">
                      <span
                        className="flex items-center justify-center w-5 h-5 rounded-full
                                   bg-primary/10 text-primary text-[10px] font-bold flex-shrink-0 mt-0.5"
                      >
                        {i + 1}
                      </span>
                      <span className="text-[13px] text-white/70 leading-relaxed">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Overview Banner */}
            <div
              className="mt-4 px-6 py-5 rounded-xl animate-fade-in"
              style={{
                background:
                  'linear-gradient(135deg, rgba(225, 255, 217, 0.08) 0%, rgba(225, 255, 217, 0.03) 100%)',
                border: '1px solid rgba(225, 255, 217, 0.15)',
                animationDelay: '100ms',
                animationFillMode: 'backwards',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">✦</span>
                <span className="text-xs font-bold text-primary tracking-wider">
                  AI OVERVIEW
                </span>
              </div>
              <p className="text-sm text-white leading-relaxed">{d.ai_overview}</p>
            </div>

            {/* Dimension Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <MacroCard data={d.dimensions.macro_context} delay={200} />
              <OvernightCard data={d.dimensions.overnight_context} delay={300} />
              <LevelsCard data={d.dimensions.key_levels} delay={400} />
              <VolatilityCard data={d.dimensions.volatility_regime} delay={500} />
            </div>

            {/* Full-width News Card */}
            <div className="mt-4">
              <NewsCard data={d.dimensions.news_sentiment} delay={600} />
            </div>

            {/* Footer */}
            <div className="text-center py-8 text-[11px] text-white/40">
              Analysis generated via Anthropic API with web search • Phase 1 Architecture
              <br />
              Data may be delayed. Always verify key levels with your broker platform.
            </div>
          </>
        )}

        {/* Initial state - no data yet */}
        {!loading && !d && !error && (
          <div className="mt-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-xl font-bold text-white mb-2">
              Pre-Session Market Analysis
            </h2>
            <p className="text-white/60 mb-6 max-w-md mx-auto">
              Get a comprehensive AI-generated analysis of ES/MES futures before your
              trading session.
            </p>
            <button
              onClick={fetchAnalysis}
              className="px-6 py-3 rounded-full bg-primary text-background font-bold
                         hover:bg-primary-dark transition-colors"
            >
              Generate Analysis
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
