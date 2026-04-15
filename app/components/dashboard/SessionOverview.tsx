'use client';

import { useTradingSessions } from '@/hooks/useTradingSessions';
import { useTradesSupabase } from '@/hooks/useTradesSupabase';
import { format } from 'date-fns';
import {
  TrophyIcon,
  FireIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

export function SessionOverview() {
  const { todaySession, isLoading: sessionLoading } = useTradingSessions();
  const { trades, stats, isLoading: tradesLoading } = useTradesSupabase({
    sessionId: todaySession?.id,
  });

  const isLoading = sessionLoading || tradesLoading;

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-20 bg-gray-700 rounded"></div>
          <div className="h-20 bg-gray-700 rounded"></div>
          <div className="h-20 bg-gray-700 rounded"></div>
          <div className="h-20 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!todaySession) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 text-center">
        <ClockIcon className="h-12 w-12 mx-auto text-gray-500 mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Active Session</h3>
        <p className="text-gray-400 text-sm">
          Start your trading session from the premarket page
        </p>
        <a
          href="/premarket"
          className="inline-block mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
        >
          Go to Premarket
        </a>
      </div>
    );
  }

  const winRate = stats?.winRate ?? 0;
  const totalPnl = stats?.totalPnl ?? todaySession.total_pnl;
  const totalTrades = stats?.totalTrades ?? todaySession.total_trades;
  const wins = stats?.wins ?? todaySession.winning_trades;
  const losses = stats?.losses ?? todaySession.losing_trades;

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Today&apos;s Session</h2>
          <p className="text-sm text-gray-400">
            {format(new Date(todaySession.session_date), 'EEEE, MMMM d')}
          </p>
        </div>
        {todaySession.market_bias && (
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              todaySession.market_bias === 'bullish'
                ? 'bg-green-600/20 text-green-400'
                : todaySession.market_bias === 'bearish'
                ? 'bg-red-600/20 text-red-400'
                : todaySession.market_bias === 'mixed'
                ? 'bg-yellow-600/20 text-yellow-400'
                : 'bg-gray-600/20 text-gray-400'
            }`}
          >
            {todaySession.market_bias.charAt(0).toUpperCase() +
              todaySession.market_bias.slice(1)}
          </span>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Total P&L */}
        <div className="bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <CurrencyDollarIcon className="h-5 w-5" />
            <span className="text-sm">P&L</span>
          </div>
          <p
            className={`text-2xl font-bold font-mono ${
              totalPnl >= 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
          </p>
        </div>

        {/* Win Rate */}
        <div className="bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <TrophyIcon className="h-5 w-5" />
            <span className="text-sm">Win Rate</span>
          </div>
          <p
            className={`text-2xl font-bold ${
              winRate >= 60
                ? 'text-green-400'
                : winRate >= 50
                ? 'text-yellow-400'
                : 'text-red-400'
            }`}
          >
            {winRate.toFixed(1)}%
          </p>
        </div>

        {/* Total Trades */}
        <div className="bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <ChartBarIcon className="h-5 w-5" />
            <span className="text-sm">Trades</span>
          </div>
          <p className="text-2xl font-bold">{totalTrades}</p>
        </div>

        {/* Win/Loss */}
        <div className="bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <FireIcon className="h-5 w-5" />
            <span className="text-sm">W / L</span>
          </div>
          <p className="text-2xl font-bold">
            <span className="text-green-400">{wins}</span>
            <span className="text-gray-500"> / </span>
            <span className="text-red-400">{losses}</span>
          </p>
        </div>
      </div>

      {/* Recent Trades */}
      {trades.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Trades</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {trades.slice(0, 5).map((trade) => (
              <div
                key={trade.id}
                className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      trade.result === 'win' ? 'bg-green-600/20' : 'bg-red-600/20'
                    }`}
                  >
                    {trade.result === 'win' ? (
                      <ArrowTrendingUpIcon className="h-4 w-4 text-green-400" />
                    ) : (
                      <ArrowTrendingDownIcon className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{trade.symbol}</div>
                    <div className="text-xs text-gray-400">
                      {trade.direction.toUpperCase()} •{' '}
                      {format(new Date(trade.entry_time), 'HH:mm')}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`font-mono font-medium ${
                      (trade.pnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {(trade.pnl ?? 0) >= 0 ? '+' : ''}${(trade.pnl ?? 0).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Premarket Notes Preview */}
      {todaySession.premarket_notes && (
        <div className="mt-4 p-3 bg-gray-700/30 rounded-lg">
          <h4 className="text-xs text-gray-400 mb-1">Premarket Notes</h4>
          <p className="text-sm text-gray-300 line-clamp-2">
            {todaySession.premarket_notes}
          </p>
        </div>
      )}
    </div>
  );
}
