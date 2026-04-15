'use client';

import { useState } from 'react';
import { useWatchlist } from '@/hooks/useWatchlist';
import { useMarketData } from '@/hooks/useMarketData';
import { useTradingSessions } from '@/hooks/useTradingSessions';
import { format } from 'date-fns';
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  ClockIcon,
  ChartBarIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

type MarketBias = 'bullish' | 'bearish' | 'neutral' | 'mixed';

export default function PremarketPage() {
  const { watchlist, primaryInstruments, isLoading: watchlistLoading } = useWatchlist();
  const symbols = watchlist.map((item) => item.symbol);
  const { quotes, summary, isLoading: quotesLoading, isFetching, refreshQuotes } = useMarketData(symbols);
  const { todaySession, savePremarketNotes, createOrGetTodaySession } = useTradingSessions();

  const [premarketNotes, setPremarketNotes] = useState(todaySession?.premarket_notes ?? '');
  const [keyLevels, setKeyLevels] = useState(todaySession?.key_levels ?? '');
  const [marketBias, setMarketBias] = useState<MarketBias>(todaySession?.market_bias ?? 'neutral');
  const [isSaving, setIsSaving] = useState(false);

  const isLoading = watchlistLoading || quotesLoading;

  const handleSavePremarket = async () => {
    setIsSaving(true);
    try {
      await savePremarketNotes.mutateAsync({
        premarket_notes: premarketNotes,
        key_levels: keyLevels,
        market_bias: marketBias,
        planned_instruments: primaryInstruments.map((i) => i.symbol),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartSession = async () => {
    await createOrGetTodaySession.mutateAsync({
      premarket_notes: premarketNotes,
      key_levels: keyLevels,
      market_bias: marketBias,
      planned_instruments: primaryInstruments.map((i) => i.symbol),
    });
    // Navigate to trading/dashboard
    window.location.href = '/dashboard';
  };

  const getQuoteForSymbol = (symbol: string) => {
    return quotes.find((q) => q.symbol === symbol);
  };

  const formatPrice = (price: number | undefined, symbol: string) => {
    if (price === undefined) return '--';

    // Crypto typically has more decimal places
    const isCrypto = ['BTC', 'ETH', 'SOL'].includes(symbol);
    if (isCrypto && price < 10) {
      return price.toFixed(4);
    }
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatChange = (change: number | undefined) => {
    if (change === undefined) return '--';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Premarket Analysis</h1>
            <p className="text-gray-400 mt-1">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => refreshQuotes()}
              disabled={isFetching}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowPathIcon className={`h-5 w-5 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {todaySession && (
              <span className="flex items-center gap-2 text-green-400">
                <CheckCircleIcon className="h-5 w-5" />
                Session Active
              </span>
            )}
          </div>
        </div>

        {/* Market Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <ArrowTrendingUpIcon className="h-5 w-5 text-green-400" />
              <span>Gainers</span>
            </div>
            <p className="text-2xl font-bold text-green-400">{summary.positive}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <ArrowTrendingDownIcon className="h-5 w-5 text-red-400" />
              <span>Losers</span>
            </div>
            <p className="text-2xl font-bold text-red-400">{summary.negative}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <MinusIcon className="h-5 w-5 text-gray-400" />
              <span>Unchanged</span>
            </div>
            <p className="text-2xl font-bold">{summary.unchanged}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <ChartBarIcon className="h-5 w-5 text-blue-400" />
              <span>Avg Change</span>
            </div>
            <p className={`text-2xl font-bold ${summary.avgChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatChange(summary.avgChange)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Watchlist */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <ChartBarIcon className="h-6 w-6 text-blue-400" />
                  Your Watchlist
                </h2>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Primary Instruments */}
                  {primaryInstruments.length > 0 && (
                    <>
                      <div className="text-sm text-gray-400 mb-2">Primary Instruments</div>
                      {primaryInstruments.map((item) => {
                        const quote = getQuoteForSymbol(item.symbol);
                        const changePercent = quote?.changePercent ?? 0;
                        const isPositive = changePercent >= 0;

                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-gray-600 rounded-lg flex items-center justify-center font-bold">
                                {item.symbol.slice(0, 2)}
                              </div>
                              <div>
                                <div className="font-semibold">{item.symbol}</div>
                                <div className="text-sm text-gray-400">{item.display_name}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono text-lg">
                                ${formatPrice(quote?.lastPrice, item.symbol)}
                              </div>
                              <div
                                className={`flex items-center justify-end gap-1 text-sm ${
                                  isPositive ? 'text-green-400' : 'text-red-400'
                                }`}
                              >
                                {isPositive ? (
                                  <ArrowTrendingUpIcon className="h-4 w-4" />
                                ) : (
                                  <ArrowTrendingDownIcon className="h-4 w-4" />
                                )}
                                {formatChange(changePercent)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* Other Instruments */}
                  {watchlist.filter((i) => !i.is_primary).length > 0 && (
                    <>
                      <div className="text-sm text-gray-400 mt-6 mb-2">Other Instruments</div>
                      {watchlist
                        .filter((i) => !i.is_primary)
                        .map((item) => {
                          const quote = getQuoteForSymbol(item.symbol);
                          const changePercent = quote?.changePercent ?? 0;
                          const isPositive = changePercent >= 0;

                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-600/50 rounded-lg flex items-center justify-center text-sm font-bold">
                                  {item.symbol.slice(0, 2)}
                                </div>
                                <div>
                                  <div className="font-medium">{item.symbol}</div>
                                  <div className="text-xs text-gray-400">{item.display_name}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono">
                                  ${formatPrice(quote?.lastPrice, item.symbol)}
                                </div>
                                <div
                                  className={`text-xs ${
                                    isPositive ? 'text-green-400' : 'text-red-400'
                                  }`}
                                >
                                  {formatChange(changePercent)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </>
                  )}

                  {watchlist.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                      <p>No instruments in your watchlist</p>
                      <p className="text-sm mt-2">Add instruments to track their premarket data</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Premarket Notes */}
          <div className="space-y-6">
            {/* Market Bias */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ChartBarIcon className="h-5 w-5 text-purple-400" />
                Market Bias
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {(['bullish', 'bearish', 'neutral', 'mixed'] as const).map((bias) => (
                  <button
                    key={bias}
                    onClick={() => setMarketBias(bias)}
                    className={`p-3 rounded-lg text-sm font-medium transition-colors ${
                      marketBias === bias
                        ? bias === 'bullish'
                          ? 'bg-green-600 text-white'
                          : bias === 'bearish'
                          ? 'bg-red-600 text-white'
                          : bias === 'neutral'
                          ? 'bg-gray-600 text-white'
                          : 'bg-yellow-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    {bias.charAt(0).toUpperCase() + bias.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Key Levels */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <DocumentTextIcon className="h-5 w-5 text-orange-400" />
                Key Levels
              </h2>
              <textarea
                value={keyLevels}
                onChange={(e) => setKeyLevels(e.target.value)}
                placeholder="ES: 5100, 5080, 5120&#10;NQ: 17800, 17750, 17900&#10;BTC: 65000, 64000"
                className="w-full h-32 bg-gray-700 rounded-lg p-3 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Premarket Notes */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <DocumentTextIcon className="h-5 w-5 text-blue-400" />
                Premarket Notes
              </h2>
              <textarea
                value={premarketNotes}
                onChange={(e) => setPremarketNotes(e.target.value)}
                placeholder="What's your game plan for today?&#10;&#10;- Economic events?&#10;- News affecting your instruments?&#10;- Personal mental state?&#10;- Strategies to focus on?"
                className="w-full h-40 bg-gray-700 rounded-lg p-3 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSavePremarket}
                disabled={isSaving}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Notes'}
              </button>
              <button
                onClick={handleStartSession}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <ClockIcon className="h-5 w-5" />
                Start Session
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
