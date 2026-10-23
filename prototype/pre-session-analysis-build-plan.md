# ES/MES Pre-Session Analysis Page — Build Plan

## What We're Building

A dedicated page inside an existing journaling app that provides a comprehensive, AI-generated pre-session market analysis for ES/MES futures trading. The user opens this page before their trading session and sees a full market briefing — synthesized into a visual dashboard — that helps them decide whether to trade today and what to expect.

The reference UI is HybridTrader's "AI Macro Desk" page for XAUUSD. That page presents a single-asset intelligence view with a conviction score at the top, an AI narrative summary below it, and modular cards breaking down individual analysis dimensions. We are replicating this concept but for ES/MES futures, and the analysis must be as thorough as a professional pre-session briefing.

This is NOT a personalized strategy tool tied to specific trading rules. It is a general-purpose market analysis page that captures macro context, key levels, volatility regime, news, and sentiment — everything a futures trader needs to assess session conditions before making their own decisions.

---

## The Six Analysis Dimensions

When the page loads, it must produce analysis across these six dimensions. Each one becomes a visual card on the dashboard.

### 1. Macro Context

- **What it covers:** Economic calendar events for the day. Specifically: are there any high-impact releases scheduled (FOMC, NFP, Initial Claims, CPI, PPI, retail sales, etc.)? What time are they? Have they already been released, and if so, what was the result vs. expectation?
- **Why it matters:** High-impact events can make the session untradeable or dramatically shift directional bias. A trader needs to know if there's a landmine on the calendar.
- **What the card should show:** List of today's economic events with time, impact level (high/medium/low), and result if already released. A clear flag if there's a session-altering event.

### 2. Overnight / Pre-Market Context

- **What it covers:** Where did ES futures trade during the overnight Globex session relative to the prior day's close? Is there a gap (price opened significantly above or below prior close)? How wide is the overnight range? Is the pre-market session trending or consolidating?
- **Why it matters:** Gaps and overnight range establish the starting conditions for the regular session. A wide gap often means a gap-fill trade is in play. A tight overnight range can signal a breakout. The relationship between overnight action and prior close tells you where the market "wants" to be.
- **What the card should show:** Prior close price, current pre-market price, gap size (in points and percentage), overnight high/low/range width, and a plain-language characterization (e.g., "Small gap up, tight overnight range — expect opening range breakout potential").

### 3. Key Levels

- **What it covers:** Structural price levels that act as support and resistance during the session. These include: prior day high, prior day low, prior day close, overnight high, overnight low, and any major technical levels (round numbers, multi-day support/resistance zones, weekly high/low).
- **Why it matters:** These levels are where price is most likely to react. Traders use them as reference points for entries, stops, and targets. Without them, you're trading blind.
- **What the card should show:** A clean list of levels organized by relevance (closest to current price first), labeled clearly. Optionally, a visual representation showing where current price sits relative to these levels.

### 4. Volatility & Regime

- **What it covers:** Current VIX level and its recent trend (rising, falling, stable), whether the market is in a trending or range-bound regime, and any notable volatility events (e.g., VIX spike, compression before a breakout).
- **Why it matters:** Volatility determines position sizing and strategy selection. In high-VIX environments, stops need to be wider and breakouts are more likely to follow through. In low-VIX compression, false breakouts are common and mean-reversion has more edge.
- **What the card should show:** Current VIX value, VIX trend indicator (up/down/flat over the past 5 days), regime label (e.g., "Low volatility compression," "Elevated — trending"), and a brief note on what this means for today's session.

### 5. News & Sentiment

- **What it covers:** Breaking news headlines that could move equity futures — geopolitical developments, corporate earnings surprises, sector-specific events, policy announcements, tariff/trade developments. Also includes general market sentiment (risk-on vs. risk-off) based on cross-asset signals (bonds, dollar, commodities).
- **Why it matters:** News creates the narrative that drives intraday flows. A trader needs to know if there's a dominant story moving the tape, or if it's a "no-news" session where technicals dominate.
- **What the card should show:** Top 3-5 relevant headlines with source and time, a one-line sentiment summary (e.g., "Risk-on: equities bid on trade deal optimism"), and a flag if there's a dominant story vs. quiet tape.

### 6. AI Synthesis — The Conviction Score & Narrative

- **What it covers:** This is the integration layer. It takes all five dimensions above and produces:
  - **A conviction score (0–100):** Represents how clear and tradeable today's session looks. High score = conditions are aligned, there's directional edge. Low score = conflicting signals, messy conditions, consider sitting out or reducing size.
  - **A conviction label:** Plain-English category tied to the score range (e.g., 0–25 = "Poor / Sit Out", 26–50 = "Mixed / Low Clarity", 51–75 = "Favorable / Moderate Edge", 76–100 = "Strong / High Conviction").
  - **A narrative summary (2-3 sentences):** The AI's synthesized thesis for today. Written as a briefing, not a data dump. Example: "Session conditions are clean. Overnight gap up into a low-VIX environment with no high-impact events. Expect directional continuation above 5020 if opening range breaks to the upside."
  - **A what-to-watch section:** 2-3 bullet points on the most important things to monitor as the session unfolds.
- **Why it matters:** This is the entire point of the page. Everything else is an input to this synthesis. The trader reads this first and decides whether to even look at the details below.
- **What the card should show:** This is not a card — it lives at the top of the page as the hero section. Score displayed as a large circular badge (color-coded: red/yellow/green), label next to it, narrative paragraph below, and what-to-watch bullets underneath.

---

## Page Layout

Top to bottom, the page should be organized as follows:

1. **Header:** Asset identifier ("ES/MES — S&P 500 E-mini Futures"), current date, and a refresh button to re-trigger the analysis.

2. **Hero Section — Conviction Score + Narrative:** Large conviction score badge (circular, color-coded), conviction label, explanation paragraph, and what-to-watch bullets. This takes up the full width at the top. Visually prominent — this is the first thing the user reads.

3. **AI Overview Banner:** A visually distinct (e.g., gradient background) one-to-two sentence thesis statement that captures the day's setup in plain language. Sits between the hero section and the detail cards.

4. **Analysis Cards Grid (2 columns):** The five dimension cards arranged in a grid. Each card has:
   - Category label (e.g., "Macro Context")
   - Key data points or visual indicator
   - Short narrative paragraph
   - Bottom-line one-liner
   - Timestamp showing when this data was last fetched

5. **Compact Price Context:** A small section showing the current ES price, daily change, and a simple recent trend indicator. This is secondary — not the focus of the page.

---

## Phase 1 — Option A: Full AI Call with Web Search

### Architecture

The simplest viable version. When the user navigates to the pre-session analysis page:

1. The app fires a single API call to the Anthropic API (Claude) with **web search enabled**.
2. The prompt instructs Claude to research and analyze today's ES/MES pre-session conditions across all six dimensions.
3. Claude performs multiple web searches within that single call to gather economic calendar data, overnight futures data, VIX levels, news headlines, and key levels.
4. Claude returns a **structured JSON response** containing all six dimensions with their data, narratives, and the overall conviction score.
5. The app parses the JSON and renders it into the dashboard layout described above.

### API Call Structure

- **Model:** claude-sonnet-4-20250514 (best balance of speed and quality for this use case)
- **Tools:** web_search enabled
- **System prompt:** A detailed prompt that instructs the model to:
  - Act as a professional futures market analyst
  - Research today's ES/MES conditions using web search
  - Analyze all six dimensions defined above
  - Return a strictly structured JSON object (schema defined in the prompt)
  - Assign a conviction score with justification
  - Write all narratives in concise, professional, trader-oriented language
- **Max tokens:** 4096 (the response will be substantial given six dimensions of analysis)
- **Response format:** JSON only, no markdown, no preamble. The system prompt must enforce this strictly.

### JSON Response Schema

The API call should return JSON in this structure:

```json
{
  "conviction_score": 62,
  "conviction_label": "Favorable / Moderate Edge",
  "conviction_explanation": "Session conditions are moderately clean...",
  "what_to_watch": [
    "Watch for opening range breakout above 5,045...",
    "Initial Claims at 8:30 AM could shift bias...",
    "VIX at 18.5 — elevated but declining, supports directional plays..."
  ],
  "ai_overview": "One-to-two sentence thesis statement for the day...",
  "current_price": {
    "price": 5042.50,
    "daily_change": "+0.35%",
    "trend": "up"
  },
  "dimensions": {
    "macro_context": {
      "title": "Macro Context",
      "subtitle": "Economic Calendar & Macro Regime",
      "indicator_label": "HIGH IMPACT EVENT",
      "indicator_type": "warning",
      "narrative": "Initial Claims release at 8:30 AM EST...",
      "bottom_line": "Wait for 8:30 AM data before committing to direction.",
      "events": [
        {
          "time": "8:30 AM EST",
          "event": "Initial Jobless Claims",
          "impact": "high",
          "forecast": "215K",
          "actual": null
        }
      ]
    },
    "overnight_context": {
      "title": "Overnight / Pre-Market",
      "subtitle": "Globex Session Analysis",
      "indicator_label": "GAP UP",
      "indicator_type": "neutral",
      "narrative": "ES gapped up 12 points from prior close...",
      "bottom_line": "Small gap up. Watch for gap fill or continuation.",
      "data": {
        "prior_close": 5030.50,
        "current_price": 5042.50,
        "gap_size_points": 12,
        "gap_size_percent": 0.24,
        "overnight_high": 5048.00,
        "overnight_low": 5028.75,
        "overnight_range": 19.25
      }
    },
    "key_levels": {
      "title": "Key Levels",
      "subtitle": "Structural Support & Resistance",
      "indicator_label": "LEVELS MAPPED",
      "indicator_type": "info",
      "narrative": "Price is trading mid-range between overnight high...",
      "bottom_line": "Nearest resistance at 5048, support at 5028.",
      "levels": [
        { "label": "Overnight High", "price": 5048.00, "type": "resistance" },
        { "label": "Prior Day High", "price": 5055.25, "type": "resistance" },
        { "label": "Prior Day Close", "price": 5030.50, "type": "neutral" },
        { "label": "Overnight Low", "price": 5028.75, "type": "support" },
        { "label": "Prior Day Low", "price": 5015.00, "type": "support" }
      ]
    },
    "volatility_regime": {
      "title": "Volatility & Regime",
      "subtitle": "VIX & Market Character",
      "indicator_label": "MODERATE",
      "indicator_type": "neutral",
      "narrative": "VIX at 18.5, down from 22 last week...",
      "bottom_line": "Declining VIX supports directional trades. Normal sizing.",
      "data": {
        "vix_current": 18.5,
        "vix_trend": "declining",
        "regime": "transitioning_to_trend"
      }
    },
    "news_sentiment": {
      "title": "News & Sentiment",
      "subtitle": "Market-Moving Headlines",
      "indicator_label": "RISK-ON",
      "indicator_type": "positive",
      "narrative": "Markets are reacting positively to...",
      "bottom_line": "Risk-on sentiment. No dominant headline risk.",
      "headlines": [
        {
          "title": "Fed Governor Signals Rate Cut Path...",
          "source": "Bloomberg",
          "time": "6:45 AM EST"
        }
      ]
    }
  }
}
```

### Phase 1 Limitations (Known & Accepted)

- **Latency:** The call may take 15-25 seconds due to multiple web searches. A loading state is required.
- **Data reliability:** Price levels, VIX values, and gap calculations sourced from web search may be slightly inaccurate or delayed. This is acceptable for v1 — the synthesis and narrative have value even with approximate numbers.
- **Cost:** Each page load triggers a full API call with web search. At heavy usage (5+ loads per day), token costs could add up. Monitor usage.
- **No real-time updates:** The page shows a snapshot at the time of the API call. It does not stream live data. The user must manually refresh.

---

## Phase 2 — Option B: Hybrid Architecture (Structured APIs + AI Synthesis)

### Why Transition

After validating Phase 1, the limitations will become clear: the numbers aren't always accurate, latency is high, and the AI is spending most of its tokens searching for data that could come from structured sources. Phase 2 fixes this by separating data fetching from synthesis.

### Architecture

1. **Structured data layer:** The app fetches real-time data from financial APIs before making any AI call. This includes:
   - **Price data (ES, VIX):** From a market data API (e.g., Twelve Data, Alpha Vantage, Tradier, or Interactive Brokers API if the user has an account).
   - **Economic calendar:** From an economic calendar API (e.g., Trading Economics, Forex Factory scrape, or Finnhub).
   - **News headlines:** From a news API (e.g., Finnhub news, Benzinga, or NewsAPI).

2. **AI synthesis layer:** Once all structured data is collected, the app makes a single Anthropic API call — but this time with NO web search. Instead, all the pre-fetched data is passed directly in the prompt as context. The AI's only job is:
   - Interpret and synthesize the data
   - Write the narratives for each dimension
   - Calculate the conviction score
   - Produce the overall thesis

3. **Rendering:** Same UI as Phase 1, but numbers come from structured sources (always accurate and fast) and narratives come from the AI (always insightful).

### Benefits Over Phase 1

- **Speed:** Data fetching happens in parallel (all APIs called simultaneously), then a single short AI call for synthesis. Total load time drops from 15-25 seconds to 3-8 seconds.
- **Accuracy:** Price, VIX, calendar events, and levels come from authoritative data sources, not web search approximations.
- **Cost:** The AI call is much smaller (no web search tool usage, shorter prompt since data is pre-structured), reducing token cost by ~60-70%.
- **Reliability:** If one data source fails, the page can still render partial data. With Phase 1, if web search fails, you get nothing.

### Data Source Recommendations

| Data Type | Recommended Source | Backup Source | Update Frequency |
|---|---|---|---|
| ES price & levels | Twelve Data or Tradier | Yahoo Finance (free) | Real-time / 15min delayed |
| VIX | Same as above | CBOE direct | Real-time / 15min delayed |
| Economic calendar | Trading Economics API | Finnhub | Daily (pre-market) |
| News headlines | Finnhub or Benzinga | NewsAPI | Every 15 minutes |
| Overnight data | Twelve Data (Globex) | Interactive Brokers | Pre-market snapshot |

### Phase 2 Prompt Design

The synthesis prompt becomes much cleaner in Phase 2 because it receives structured data:

```
You are a professional ES/MES futures analyst. You are given today's
pre-session data below. Your job is to analyze this data and produce
a structured JSON response with your synthesis.

## Today's Data

### Economic Calendar
{calendar_data_json}

### Price & Overnight Context
{price_data_json}

### VIX & Volatility
{vix_data_json}

### News Headlines
{news_data_json}

## Instructions
- Analyze the data across all dimensions
- Assign a conviction score (0-100)
- Write concise trader-oriented narratives
- Return ONLY valid JSON matching the schema below
...
```

---

## Migration Path: Phase 1 → Phase 2

1. **Build and ship Phase 1.** Use it daily for 2-4 weeks.
2. **Track pain points:** Note which data is frequently inaccurate, which dimensions are most/least useful, and whether you actually use all six cards or skip some.
3. **Select data APIs:** Based on what matters most, pick 2-3 paid/free APIs that cover the critical data. Price + VIX is the highest priority; economic calendar is second.
4. **Refactor the data layer:** Build API integrations that fetch and cache structured data. Store the most recent fetch so the page loads instantly with cached data while a fresh fetch runs in the background.
5. **Shrink the AI prompt:** Remove web search, inject structured data, and focus the AI on synthesis only.
6. **Ship Phase 2.** The UI stays identical — only the backend data pipeline changes.

---

## Summary

- **What:** A pre-session analysis page for ES/MES futures that shows a conviction score, AI-generated market thesis, and supporting detail cards across six dimensions (macro, overnight, levels, volatility, news, synthesis).
- **Reference UI:** HybridTrader's XAUUSD AI Macro Desk — dark theme, conviction badge at top, narrative banner, 2-column card grid.
- **Phase 1:** Single Anthropic API call with web search. AI does all research and synthesis. Ship fast, validate the concept.
- **Phase 2:** Structured financial APIs for data + Anthropic API for synthesis only. Faster, more accurate, cheaper.
- **The page answers one question:** "What do I need to know about today's session before I decide whether to trade?"
