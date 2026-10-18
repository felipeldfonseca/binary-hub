import type { MarketAnalysisResponse } from '@/types/market-analysis';

export const MOCK_ANALYSIS: MarketAnalysisResponse = {
  conviction_score: 68,
  conviction_label: 'Favorable / Moderate Edge',
  conviction_explanation:
    'Session conditions are relatively clean. Overnight gap is small and manageable, VIX is declining from elevated levels supporting directional plays, and no high-impact events until after the core trading window. The macro backdrop is cautiously risk-on with trade deal optimism, though tariff uncertainty remains a tail risk. Conditions favor patient entries on confirmed opening range breakouts.',
  what_to_watch: [
    'Opening range breakout direction above 5,048 (ON high) or below 5,028 (ON low)',
    'Initial Claims at 8:30 AM — if significantly off consensus, bias may shift pre-session',
    'VIX declining but still at 18.5 — wider stops may be needed vs. low-vol environments',
  ],
  ai_overview:
    'ES futures are setting up for a directional session. Small gap up overnight with declining volatility and no major event risk during the core window. Bias leans bullish above the overnight high, but a gap fill toward prior close remains in play if early buying fails.',
  current_price: {
    price: '5,042.50',
    daily_change: '+0.35%',
    direction: 'up',
  },
  last_updated: '7:42 AM EST',
  dimensions: {
    macro_context: {
      title: 'Macro Context',
      subtitle: 'Economic Calendar & Regime',
      indicator_label: 'MODERATE IMPACT',
      indicator_type: 'warning',
      narrative:
        'Initial Claims release at 8:30 AM EST is the primary event — consensus at 215K. No FOMC, no CPI. The macro regime remains rate-sensitive with markets pricing in 2 cuts by September. Post-claims, the session should be clean for technical trading.',
      bottom_line: 'Calendar is manageable. Wait for 8:30 data, then engage.',
      events: [
        {
          time: '8:30 AM',
          event: 'Initial Jobless Claims',
          impact: 'high',
          forecast: '215K',
          actual: null,
        },
        {
          time: '10:00 AM',
          event: 'Existing Home Sales',
          impact: 'medium',
          forecast: '4.14M',
          actual: null,
        },
      ],
    },
    overnight_context: {
      title: 'Overnight Session',
      subtitle: 'Globex & Pre-Market',
      indicator_label: 'SMALL GAP UP',
      indicator_type: 'neutral',
      narrative:
        'ES gapped up 12 points from prior close at 5,030.50. The overnight range is 19.25 points (5,028.75 – 5,048.00), which is relatively tight. Price is currently mid-range, suggesting indecision. No strong directional conviction from overnight action alone.',
      bottom_line: 'Tight range + small gap = watch for opening range expansion.',
      data: {
        prior_close: '5,030.50',
        current: '5,042.50',
        gap: '+12 pts (+0.24%)',
        on_high: '5,048.00',
        on_low: '5,028.75',
        range: '19.25 pts',
      },
    },
    key_levels: {
      title: 'Key Levels',
      subtitle: 'Support & Resistance Map',
      indicator_label: '5 LEVELS MAPPED',
      indicator_type: 'info',
      narrative:
        'Price sits mid-range between overnight high (5,048) and overnight low (5,028.75). Prior day high at 5,055.25 is the next major resistance above. Prior day low at 5,015 provides a deeper support floor. A break above 5,048 targets 5,055; a break below 5,028 targets 5,015.',
      bottom_line: 'Nearest resistance 5,048 | Nearest support 5,028.',
      levels: [
        { label: 'Prior Day High', price: '5,055.25', type: 'resistance' },
        { label: 'Overnight High', price: '5,048.00', type: 'resistance' },
        { label: 'Prior Day Close', price: '5,030.50', type: 'neutral' },
        { label: 'Overnight Low', price: '5,028.75', type: 'support' },
        { label: 'Prior Day Low', price: '5,015.00', type: 'support' },
      ],
    },
    volatility_regime: {
      title: 'Volatility & Regime',
      subtitle: 'VIX & Market Character',
      indicator_label: 'DECLINING',
      indicator_type: 'positive',
      narrative:
        'VIX at 18.5, down from 22 last week and 26 two weeks ago. The declining trend supports directional trading — breakouts are more likely to follow through in falling-VIX environments. Not yet in low-vol compression territory, so expect normal-sized ranges.',
      bottom_line: 'Falling VIX = trend-friendly. Normal position sizing.',
      data: {
        vix: '18.5',
        trend: 'Declining',
        regime: 'Moderate — transitioning to trend',
      },
    },
    news_sentiment: {
      title: 'News & Sentiment',
      subtitle: 'Headlines & Market Mood',
      indicator_label: 'RISK-ON',
      indicator_type: 'positive',
      narrative:
        'Markets are cautiously optimistic on progress in US-China trade negotiations. Fed Governor Waller signaled comfort with current rate path, reducing hawkish tail risk. No dominant negative headline. Sector rotation favors cyclicals over defensives, consistent with risk-on positioning.',
      bottom_line: 'Sentiment supports bullish bias. No headline landmines.',
      headlines: [
        {
          title: "US-China trade talks show 'constructive progress' — officials",
          source: 'Reuters',
          time: '6:15 AM',
        },
        {
          title: "Fed's Waller: Current policy stance is appropriate",
          source: 'Bloomberg',
          time: '6:45 AM',
        },
        {
          title: 'Tech futures lead pre-market gains on strong TSMC guidance',
          source: 'CNBC',
          time: '7:10 AM',
        },
      ],
    },
  },
};
