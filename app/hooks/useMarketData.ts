import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { MarketSnapshot } from '@/types/database';
import { format } from 'date-fns';

// Symbol mappings for different data sources
const YAHOO_SYMBOLS: Record<string, string> = {
  ES: 'ES=F', // S&P 500 E-mini futures
  NQ: 'NQ=F', // NASDAQ-100 E-mini futures
  BTC: 'BTC-USD',
  ETH: 'ETH-USD',
  SOL: 'SOL-USD',
  GC: 'GC=F', // Gold futures
  SI: 'SI=F', // Silver futures
  AAPL: 'AAPL',
  NVDA: 'NVDA',
  MSFT: 'MSFT',
  GOOGL: 'GOOGL',
  AMZN: 'AMZN',
  TSLA: 'TSLA',
  META: 'META',
};

interface QuoteData {
  symbol: string;
  lastPrice: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  previousClose: number;
  changeAmount: number;
  changePercent: number;
  volume: number;
  marketStatus: 'pre_market' | 'open' | 'after_hours' | 'closed';
}

// Fetch quote from Yahoo Finance (via a proxy API route)
async function fetchYahooQuote(symbol: string): Promise<QuoteData | null> {
  const yahooSymbol = YAHOO_SYMBOLS[symbol] || symbol;

  try {
    const response = await fetch(`/api/market/quote?symbol=${yahooSymbol}`);
    if (!response.ok) {
      console.error(`Failed to fetch quote for ${symbol}`);
      return null;
    }
    const data = await response.json();
    return {
      symbol,
      lastPrice: data.regularMarketPrice || data.price,
      openPrice: data.regularMarketOpen || data.open,
      highPrice: data.regularMarketDayHigh || data.high,
      lowPrice: data.regularMarketDayLow || data.low,
      previousClose: data.regularMarketPreviousClose || data.previousClose,
      changeAmount: data.regularMarketChange || 0,
      changePercent: data.regularMarketChangePercent || 0,
      volume: data.regularMarketVolume || data.volume || 0,
      marketStatus: getMarketStatus(data),
    };
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error);
    return null;
  }
}

function getMarketStatus(data: Record<string, unknown>): QuoteData['marketStatus'] {
  const state = data.marketState as string | undefined;
  if (state === 'PRE') return 'pre_market';
  if (state === 'REGULAR') return 'open';
  if (state === 'POST') return 'after_hours';
  return 'closed';
}

export function useMarketData(symbols: string[]) {
  const queryClient = useQueryClient();

  // Fetch real-time quotes
  const quotesQuery = useQuery({
    queryKey: ['market-quotes', symbols],
    queryFn: async () => {
      const quotes = await Promise.all(symbols.map(fetchYahooQuote));
      return quotes.filter((q): q is QuoteData => q !== null);
    },
    enabled: symbols.length > 0,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000, // Consider fresh for 15 seconds
  });

  // Get cached snapshots from database
  const snapshotsQuery = useQuery({
    queryKey: ['market-snapshots', symbols],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('market_snapshots')
        .select('*')
        .in('symbol', symbols)
        .eq('snapshot_date', today);

      if (error) throw error;
      return data as MarketSnapshot[];
    },
    enabled: symbols.length > 0,
  });

  // Save snapshot to database (for historical tracking)
  const saveSnapshot = async (quote: QuoteData) => {
    const today = format(new Date(), 'yyyy-MM-dd');

    const { error } = await supabase.from('market_snapshots').upsert(
      {
        symbol: quote.symbol,
        last_price: quote.lastPrice,
        open_price: quote.openPrice,
        high_price: quote.highPrice,
        low_price: quote.lowPrice,
        previous_close: quote.previousClose,
        change_amount: quote.changeAmount,
        change_percent: quote.changePercent,
        volume: quote.volume,
        market_status: quote.marketStatus,
        data_source: 'yahoo',
        snapshot_date: today,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'symbol,snapshot_date' }
    );

    if (error) {
      console.error('Error saving snapshot:', error);
    }
  };

  // Get quote for a specific symbol
  const getQuote = (symbol: string) => {
    return quotesQuery.data?.find((q) => q.symbol === symbol);
  };

  // Force refresh quotes
  const refreshQuotes = async () => {
    await queryClient.invalidateQueries({ queryKey: ['market-quotes'] });
  };

  // Calculate summary stats
  const summary = {
    positive: quotesQuery.data?.filter((q) => q.changePercent > 0).length ?? 0,
    negative: quotesQuery.data?.filter((q) => q.changePercent < 0).length ?? 0,
    unchanged: quotesQuery.data?.filter((q) => q.changePercent === 0).length ?? 0,
    avgChange:
      quotesQuery.data && quotesQuery.data.length > 0
        ? quotesQuery.data.reduce((sum, q) => sum + q.changePercent, 0) /
          quotesQuery.data.length
        : 0,
  };

  return {
    // Data
    quotes: quotesQuery.data ?? [],
    snapshots: snapshotsQuery.data ?? [],
    summary,
    isLoading: quotesQuery.isLoading,
    isFetching: quotesQuery.isFetching,
    error: quotesQuery.error,

    // Helpers
    getQuote,
    refreshQuotes,
    saveSnapshot,
  };
}

// Hook for a single symbol
export function useSymbolQuote(symbol: string) {
  const { quotes, isLoading, error, refreshQuotes } = useMarketData([symbol]);
  const quote = quotes[0];

  return {
    quote,
    isLoading,
    error,
    refresh: refreshQuotes,
  };
}
