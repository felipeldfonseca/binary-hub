import { NextRequest, NextResponse } from 'next/server';

// Yahoo Finance API via their unofficial API
// Note: For production, consider using a paid API like Alpha Vantage, Polygon, or Twelve Data

const YAHOO_API_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

interface YahooResponse {
  chart: {
    result: Array<{
      meta: {
        regularMarketPrice: number;
        previousClose: number;
        regularMarketDayHigh: number;
        regularMarketDayLow: number;
        regularMarketVolume: number;
        regularMarketOpen: number;
        currency: string;
        exchangeName: string;
        instrumentType: string;
        tradingPeriods?: {
          pre?: Array<Array<{ timezone: string; start: number; end: number; gmtoffset: number }>>;
          regular?: Array<Array<{ timezone: string; start: number; end: number; gmtoffset: number }>>;
          post?: Array<Array<{ timezone: string; start: number; end: number; gmtoffset: number }>>;
        };
      };
      timestamp?: number[];
      indicators?: {
        quote: Array<{
          open: number[];
          high: number[];
          low: number[];
          close: number[];
          volume: number[];
        }>;
      };
    }>;
    error: null | { code: string; description: string };
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json(
      { error: 'Symbol parameter is required' },
      { status: 400 }
    );
  }

  try {
    // Fetch from Yahoo Finance
    const response = await fetch(
      `${YAHOO_API_URL}/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        next: { revalidate: 30 }, // Cache for 30 seconds
      }
    );

    if (!response.ok) {
      throw new Error(`Yahoo API returned ${response.status}`);
    }

    const data: YahooResponse = await response.json();

    if (data.chart.error) {
      throw new Error(data.chart.error.description);
    }

    const result = data.chart.result?.[0];
    if (!result) {
      throw new Error('No data returned for symbol');
    }

    const meta = result.meta;
    const previousClose = meta.previousClose || 0;
    const currentPrice = meta.regularMarketPrice || 0;
    const change = currentPrice - previousClose;
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

    // Determine market status based on current time and trading periods
    const marketStatus = getMarketStatus(meta);

    return NextResponse.json({
      symbol: symbol.replace('=F', '').replace('-USD', ''),
      price: currentPrice,
      regularMarketPrice: currentPrice,
      regularMarketOpen: meta.regularMarketOpen,
      regularMarketDayHigh: meta.regularMarketDayHigh,
      regularMarketDayLow: meta.regularMarketDayLow,
      regularMarketVolume: meta.regularMarketVolume,
      regularMarketPreviousClose: previousClose,
      regularMarketChange: change,
      regularMarketChangePercent: changePercent,
      currency: meta.currency,
      exchange: meta.exchangeName,
      instrumentType: meta.instrumentType,
      marketState: marketStatus,
    });
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error);

    // Return fallback data for demo purposes
    // In production, you'd want to handle this differently
    return NextResponse.json(
      {
        error: 'Failed to fetch quote',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

function getMarketStatus(meta: YahooResponse['chart']['result'][0]['meta']): string {
  const now = Date.now() / 1000;
  const tradingPeriods = meta.tradingPeriods;

  if (!tradingPeriods) {
    // For crypto, markets are always open
    if (meta.instrumentType === 'CRYPTOCURRENCY') {
      return 'REGULAR';
    }
    return 'CLOSED';
  }

  // Check pre-market
  const pre = tradingPeriods.pre?.[0]?.[0];
  if (pre && now >= pre.start && now < pre.end) {
    return 'PRE';
  }

  // Check regular hours
  const regular = tradingPeriods.regular?.[0]?.[0];
  if (regular && now >= regular.start && now < regular.end) {
    return 'REGULAR';
  }

  // Check post-market
  const post = tradingPeriods.post?.[0]?.[0];
  if (post && now >= post.start && now < post.end) {
    return 'POST';
  }

  return 'CLOSED';
}
