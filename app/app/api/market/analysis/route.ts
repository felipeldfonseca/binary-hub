import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { MarketAnalysisResponse } from '@/types/market-analysis';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a professional ES/MES futures market analyst. Your job is to provide comprehensive pre-session market analysis that helps traders decide whether to trade today and what to expect.

You have access to web search to gather current market data. Use it to research:
1. Current ES futures price and overnight session data
2. Today's economic calendar events
3. VIX level and trend
4. Breaking news affecting equity markets
5. Prior day price levels

Return your analysis as a VALID JSON object matching this exact schema. Do not include any markdown formatting, code blocks, or explanations outside the JSON:

{
  "conviction_score": <number 0-100>,
  "conviction_label": "<one of: 'Poor / Sit Out', 'Mixed / Low Clarity', 'Favorable / Moderate Edge', 'Strong / High Conviction'>",
  "conviction_explanation": "<2-3 sentences explaining today's setup>",
  "what_to_watch": ["<bullet 1>", "<bullet 2>", "<bullet 3>"],
  "ai_overview": "<1-2 sentence thesis for the day>",
  "current_price": {
    "price": "<formatted price like 5,042.50>",
    "daily_change": "<like +0.35% or -0.52%>",
    "direction": "<up, down, or flat>"
  },
  "last_updated": "<time like 7:42 AM EST>",
  "dimensions": {
    "macro_context": {
      "title": "Macro Context",
      "subtitle": "Economic Calendar & Regime",
      "indicator_label": "<short label like 'HIGH IMPACT EVENT' or 'CLEAN CALENDAR'>",
      "indicator_type": "<positive, warning, neutral, info, or negative>",
      "narrative": "<2-3 sentences about macro conditions>",
      "bottom_line": "<1 sentence takeaway>",
      "events": [
        {"time": "<time>", "event": "<name>", "impact": "<high/medium/low>", "forecast": "<value or null>", "actual": "<value or null>"}
      ]
    },
    "overnight_context": {
      "title": "Overnight Session",
      "subtitle": "Globex & Pre-Market",
      "indicator_label": "<like 'GAP UP' or 'GAP DOWN' or 'FLAT'>",
      "indicator_type": "<positive, warning, neutral, info, or negative>",
      "narrative": "<2-3 sentences about overnight action>",
      "bottom_line": "<1 sentence takeaway>",
      "data": {
        "prior_close": "<price>",
        "current": "<price>",
        "gap": "<like +12 pts (+0.24%)>",
        "on_high": "<overnight high>",
        "on_low": "<overnight low>",
        "range": "<like 19.25 pts>"
      }
    },
    "key_levels": {
      "title": "Key Levels",
      "subtitle": "Support & Resistance Map",
      "indicator_label": "<like '5 LEVELS MAPPED'>",
      "indicator_type": "info",
      "narrative": "<2-3 sentences about key levels>",
      "bottom_line": "<1 sentence with nearest support/resistance>",
      "levels": [
        {"label": "<name>", "price": "<formatted price>", "type": "<resistance/support/neutral>"}
      ]
    },
    "volatility_regime": {
      "title": "Volatility & Regime",
      "subtitle": "VIX & Market Character",
      "indicator_label": "<like 'DECLINING' or 'ELEVATED' or 'LOW'>",
      "indicator_type": "<positive, warning, neutral, info, or negative>",
      "narrative": "<2-3 sentences about volatility>",
      "bottom_line": "<1 sentence takeaway>",
      "data": {
        "vix": "<current VIX value>",
        "trend": "<Rising, Declining, or Stable>",
        "regime": "<description like 'Moderate — transitioning to trend'>"
      }
    },
    "news_sentiment": {
      "title": "News & Sentiment",
      "subtitle": "Headlines & Market Mood",
      "indicator_label": "<like 'RISK-ON' or 'RISK-OFF' or 'MIXED'>",
      "indicator_type": "<positive, warning, neutral, info, or negative>",
      "narrative": "<2-3 sentences about market sentiment>",
      "bottom_line": "<1 sentence takeaway>",
      "headlines": [
        {"title": "<headline>", "source": "<source>", "time": "<time>"}
      ]
    }
  }
}

Conviction score guidelines:
- 0-25: Poor conditions, conflicting signals, high event risk, consider sitting out
- 26-50: Mixed conditions, low clarity, reduce size or be highly selective
- 51-75: Favorable conditions, moderate edge, normal trading with patience
- 76-100: Strong conditions, clear directional bias, can be more aggressive

Write all narratives in concise, professional, trader-oriented language. Focus on actionable insights.`;

export async function POST(request: NextRequest) {
  try {
    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const asset = body.asset || 'ES';

    // Get current date/time for context
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    const userPrompt = `Generate a comprehensive pre-session analysis for ${asset}/M${asset} (S&P 500 E-mini) futures for today, ${dateStr}.

Current time: ${timeStr}

Use web search to find:
1. Current ${asset} futures price and today's price action
2. Overnight high/low and prior day close
3. Today's US economic calendar events (Initial Claims, Fed speakers, etc.)
4. Current VIX level
5. Any breaking news affecting US equity futures

Return ONLY the JSON object, no other text.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 10,
        },
      ],
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      system: SYSTEM_PROMPT,
    });

    // Extract the text content from the response
    let analysisText = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        analysisText += block.text;
      }
    }

    // Try to parse the JSON response
    let analysis: MarketAnalysisResponse;
    try {
      // Clean up the response - remove any markdown code blocks if present
      let cleanedText = analysisText.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.slice(7);
      }
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.slice(3);
      }
      if (cleanedText.endsWith('```')) {
        cleanedText = cleanedText.slice(0, -3);
      }
      cleanedText = cleanedText.trim();

      analysis = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse analysis response:', parseError);
      console.error('Raw response:', analysisText);
      return NextResponse.json(
        {
          error: 'Failed to parse analysis response',
          raw: analysisText.slice(0, 500),
        },
        { status: 500 }
      );
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Error generating market analysis:', error);

    // Check for specific Anthropic errors
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        {
          error: 'API error',
          message: error.message,
          status: error.status,
        },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to generate analysis',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support GET for simple testing
export async function GET() {
  return NextResponse.json({
    message: 'Use POST to generate market analysis',
    example: {
      method: 'POST',
      body: { asset: 'ES' },
    },
  });
}
