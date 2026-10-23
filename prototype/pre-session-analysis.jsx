import { useState, useEffect } from "react";

const MOCK_DATA = {
  conviction_score: 68,
  conviction_label: "Favorable / Moderate Edge",
  conviction_explanation:
    "Session conditions are relatively clean. Overnight gap is small and manageable, VIX is declining from elevated levels supporting directional plays, and no high-impact events until after the core trading window. The macro backdrop is cautiously risk-on with trade deal optimism, though tariff uncertainty remains a tail risk. Conditions favor patient entries on confirmed opening range breakouts.",
  what_to_watch: [
    "Opening range breakout direction above 5,048 (ON high) or below 5,028 (ON low)",
    "Initial Claims at 8:30 AM — if significantly off consensus, bias may shift pre-session",
    "VIX declining but still at 18.5 — wider stops may be needed vs. low-vol environments",
  ],
  ai_overview:
    "ES futures are setting up for a directional session. Small gap up overnight with declining volatility and no major event risk during the core window. Bias leans bullish above the overnight high, but a gap fill toward prior close remains in play if early buying fails.",
  current_price: {
    price: "5,042.50",
    daily_change: "+0.35%",
    direction: "up",
  },
  last_updated: "7:42 AM EST",
  dimensions: {
    macro_context: {
      title: "Macro Context",
      subtitle: "Economic Calendar & Regime",
      indicator_label: "MODERATE IMPACT",
      indicator_type: "warning",
      narrative:
        "Initial Claims release at 8:30 AM EST is the primary event — consensus at 215K. No FOMC, no CPI. The macro regime remains rate-sensitive with markets pricing in 2 cuts by September. Post-claims, the session should be clean for technical trading.",
      bottom_line: "Calendar is manageable. Wait for 8:30 data, then engage.",
      events: [
        { time: "8:30 AM", event: "Initial Jobless Claims", impact: "high", forecast: "215K", actual: null },
        { time: "10:00 AM", event: "Existing Home Sales", impact: "medium", forecast: "4.14M", actual: null },
      ],
    },
    overnight_context: {
      title: "Overnight Session",
      subtitle: "Globex & Pre-Market",
      indicator_label: "SMALL GAP UP",
      indicator_type: "neutral",
      narrative:
        "ES gapped up 12 points from prior close at 5,030.50. The overnight range is 19.25 points (5,028.75 – 5,048.00), which is relatively tight. Price is currently mid-range, suggesting indecision. No strong directional conviction from overnight action alone.",
      bottom_line: "Tight range + small gap = watch for opening range expansion.",
      data: {
        prior_close: "5,030.50",
        current: "5,042.50",
        gap: "+12 pts (+0.24%)",
        on_high: "5,048.00",
        on_low: "5,028.75",
        range: "19.25 pts",
      },
    },
    key_levels: {
      title: "Key Levels",
      subtitle: "Support & Resistance Map",
      indicator_label: "5 LEVELS MAPPED",
      indicator_type: "info",
      narrative:
        "Price sits mid-range between overnight high (5,048) and overnight low (5,028.75). Prior day high at 5,055.25 is the next major resistance above. Prior day low at 5,015 provides a deeper support floor. A break above 5,048 targets 5,055; a break below 5,028 targets 5,015.",
      bottom_line: "Nearest resistance 5,048 | Nearest support 5,028.",
      levels: [
        { label: "Prior Day High", price: "5,055.25", type: "resistance" },
        { label: "Overnight High", price: "5,048.00", type: "resistance" },
        { label: "Prior Day Close", price: "5,030.50", type: "neutral" },
        { label: "Overnight Low", price: "5,028.75", type: "support" },
        { label: "Prior Day Low", price: "5,015.00", type: "support" },
      ],
    },
    volatility_regime: {
      title: "Volatility & Regime",
      subtitle: "VIX & Market Character",
      indicator_label: "DECLINING",
      indicator_type: "positive",
      narrative:
        "VIX at 18.5, down from 22 last week and 26 two weeks ago. The declining trend supports directional trading — breakouts are more likely to follow through in falling-VIX environments. Not yet in low-vol compression territory, so expect normal-sized ranges.",
      bottom_line: "Falling VIX = trend-friendly. Normal position sizing.",
      data: { vix: "18.5", trend: "Declining", regime: "Moderate — transitioning to trend" },
    },
    news_sentiment: {
      title: "News & Sentiment",
      subtitle: "Headlines & Market Mood",
      indicator_label: "RISK-ON",
      indicator_type: "positive",
      narrative:
        "Markets are cautiously optimistic on progress in US-China trade negotiations. Fed Governor Waller signaled comfort with current rate path, reducing hawkish tail risk. No dominant negative headline. Sector rotation favors cyclicals over defensives, consistent with risk-on positioning.",
      bottom_line: "Sentiment supports bullish bias. No headline landmines.",
      headlines: [
        { title: "US-China trade talks show 'constructive progress' — officials", source: "Reuters", time: "6:15 AM" },
        { title: "Fed's Waller: Current policy stance is appropriate", source: "Bloomberg", time: "6:45 AM" },
        { title: "Tech futures lead pre-market gains on strong TSMC guidance", source: "CNBC", time: "7:10 AM" },
      ],
    },
  },
};

/* ── tiny helper components ── */

function ScoreRing({ score, size = 120 }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const pct = score / 100;
  const color =
    score >= 70 ? "var(--accent)" : score >= 40 ? "var(--amber)" : "var(--red)";

  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="var(--card-border)" strokeWidth="6"
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 1.2s ease" }}
      />
      <text
        x={size / 2} y={size / 2 - 6}
        textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize="28" fontWeight="700"
        fontFamily="'DM Sans', sans-serif"
      >
        {score}
      </text>
      <text
        x={size / 2} y={size / 2 + 16}
        textAnchor="middle" fill="var(--muted)" fontSize="10"
        fontFamily="'DM Sans', sans-serif"
      >
        / 100
      </text>
    </svg>
  );
}

function Badge({ label, type }) {
  const colors = {
    positive: { bg: "rgba(163,194,142,0.15)", fg: "var(--accent)" },
    warning: { bg: "rgba(234,179,78,0.15)", fg: "var(--amber)" },
    neutral: { bg: "rgba(255,255,255,0.08)", fg: "var(--muted)" },
    info: { bg: "rgba(130,170,200,0.15)", fg: "#82AAC8" },
  };
  const c = colors[type] || colors.neutral;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: "20px",
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.08em",
        background: c.bg,
        color: c.fg,
      }}
    >
      {label}
    </span>
  );
}

function Gauge({ value, label }) {
  const angle = -90 + (value / 100) * 180;
  const color =
    value >= 70 ? "var(--accent)" : value >= 40 ? "var(--amber)" : "var(--red)";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width="80" height="48" viewBox="0 0 80 48">
        <path
          d="M8 44 A 32 32 0 0 1 72 44"
          fill="none" stroke="var(--card-border)" strokeWidth="6" strokeLinecap="round"
        />
        <path
          d="M8 44 A 32 32 0 0 1 72 44"
          fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray="100.5"
          strokeDashoffset={100.5 * (1 - value / 100)}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
        <line
          x1="40" y1="44" x2="40" y2="16"
          stroke={color} strokeWidth="2" strokeLinecap="round"
          transform={`rotate(${angle} 40 44)`}
          style={{ transition: "transform 1s ease" }}
        />
        <circle cx="40" cy="44" r="3" fill={color} />
      </svg>
      <span style={{ fontSize: "10px", color: "var(--muted)", marginTop: 4 }}>{label}</span>
    </div>
  );
}

/* ── card components ── */

function MacroCard({ d }) {
  return (
    <div>
      <p style={styles.narrative}>{d.narrative}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "14px 0" }}>
        {d.events.map((e, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--card-border)",
            }}
          >
            <span
              style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                background: e.impact === "high" ? "var(--amber)" : "var(--muted)",
              }}
            />
            <span style={{ fontSize: 12, color: "var(--text)", flex: 1 }}>{e.event}</span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{e.time}</span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              Est: {e.forecast}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OvernightCard({ d }) {
  const pairs = [
    ["Prior Close", d.data.prior_close],
    ["Current", d.data.current],
    ["Gap", d.data.gap],
    ["ON High", d.data.on_high],
    ["ON Low", d.data.on_low],
    ["ON Range", d.data.range],
  ];
  return (
    <div>
      <p style={styles.narrative}>{d.narrative}</p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          margin: "14px 0",
        }}
      >
        {pairs.map(([lbl, val], i) => (
          <div
            key={i}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--card-border)",
            }}
          >
            <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {lbl}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginTop: 2 }}>
              {val}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LevelsCard({ d }) {
  return (
    <div>
      <p style={styles.narrative}>{d.narrative}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, margin: "14px 0" }}>
        {d.levels.map((l, i) => {
          const c =
            l.type === "resistance"
              ? "var(--red)"
              : l.type === "support"
              ? "var(--accent)"
              : "var(--muted)";
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "7px 12px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.03)",
                borderLeft: `3px solid ${c}`,
              }}
            >
              <span style={{ fontSize: 12, color: "var(--text)" }}>{l.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: c, fontFamily: "'DM Mono', monospace" }}>
                {l.price}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VolatilityCard({ d }) {
  const vixVal = parseFloat(d.data.vix);
  const vixPct = Math.min(vixVal / 40, 1) * 100;
  return (
    <div>
      <p style={styles.narrative}>{d.narrative}</p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          margin: "14px 0",
          padding: "12px 16px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid var(--card-border)",
        }}
      >
        <Gauge value={vixPct} label="VIX" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>{d.data.vix}</div>
          <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 2 }}>▼ {d.data.trend}</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{d.data.regime}</div>
        </div>
      </div>
    </div>
  );
}

function NewsCard({ d }) {
  return (
    <div>
      <p style={styles.narrative}>{d.narrative}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "14px 0" }}>
        {d.headlines.map((h, i) => (
          <div
            key={i}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--card-border)",
            }}
          >
            <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.4 }}>{h.title}</div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
              {h.source} • {h.time}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── dimension card wrapper ── */

function DimensionCard({ d, children, delay = 0 }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      style={{
        ...styles.card,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{d.title}</h3>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{d.subtitle}</div>
        </div>
        <Badge label={d.indicator_label} type={d.indicator_type} />
      </div>

      {children}

      <div
        style={{
          marginTop: 12,
          padding: "10px 14px",
          borderRadius: 10,
          background: "rgba(163,194,142,0.06)",
          borderLeft: "3px solid var(--accent)",
          fontSize: 12,
          color: "var(--text-secondary)",
          lineHeight: 1.5,
        }}
      >
        {d.bottom_line}
      </div>
    </div>
  );
}

/* ── main page ── */

export default function PreSessionAnalysis() {
  const d = MOCK_DATA;
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setTimeout(() => setLoaded(true), 100);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 2000);
  };

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700&family=DM+Mono:wght@400;500&display=swap');
        :root {
          --bg: #2C2F2A;
          --card-bg: rgba(255,255,255,0.04);
          --card-border: rgba(255,255,255,0.08);
          --card-hover: rgba(255,255,255,0.07);
          --text: #E8E6E1;
          --text-secondary: #BDB9AE;
          --muted: #8A8677;
          --accent: #A3C28E;
          --accent-dim: rgba(163,194,142,0.12);
          --amber: #EAB34E;
          --red: #D4644E;
          --nav-bg: rgba(56,59,52,0.85);
          --hero-gradient: linear-gradient(135deg, rgba(163,194,142,0.1) 0%, rgba(234,179,78,0.08) 100%);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--bg); }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>

      {/* ── NAV BAR (matches binary hub) ── */}
      <nav style={styles.nav}>
        <div style={styles.logo}>
          binary <span style={styles.logoAccent}>hub</span>
        </div>
        <div style={styles.navPills}>
          {["Home", "Trades", "Social", "Analytics", "AI", "Accomplishments", "Plans"].map((item) => (
            <button
              key={item}
              style={{
                ...styles.pill,
                ...(item === "AI" ? styles.pillActive : {}),
              }}
            >
              {item}
            </button>
          ))}
        </div>
        <div style={styles.avatar}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
      </nav>

      {/* ── PAGE HEADER ── */}
      <div style={styles.container}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.4s ease",
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Pre-Session Analysis
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
              ES / MES Futures
            </h1>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
              S&P 500 E-mini • Updated {d.last_updated}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", fontFamily: "'DM Mono', monospace" }}>
                {d.current_price.price}
              </div>
              <div style={{ fontSize: 13, color: "var(--accent)", marginTop: 2 }}>
                {d.current_price.direction === "up" ? "▲" : "▼"} {d.current_price.daily_change}
              </div>
            </div>
            <button onClick={handleRefresh} style={styles.refreshBtn}>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"
                style={{
                  animation: refreshing ? "spin 1s linear infinite" : "none",
                }}
              >
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── CONVICTION SCORE HERO ── */}
        <div
          style={{
            ...styles.heroCard,
            opacity: loaded ? 1 : 0,
            transform: loaded ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.6s ease 0.1s, transform 0.6s ease 0.1s",
          }}
        >
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
            <ScoreRing score={d.conviction_score} />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "inline-block",
                  padding: "4px 14px",
                  borderRadius: 20,
                  background:
                    d.conviction_score >= 70
                      ? "rgba(163,194,142,0.15)"
                      : d.conviction_score >= 40
                      ? "rgba(234,179,78,0.15)"
                      : "rgba(212,100,78,0.15)",
                  color:
                    d.conviction_score >= 70
                      ? "var(--accent)"
                      : d.conviction_score >= 40
                      ? "var(--amber)"
                      : "var(--red)",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  marginBottom: 10,
                }}
              >
                {d.conviction_label}
              </div>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0 }}>
                {d.conviction_explanation}
              </p>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--muted)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              What to Watch
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {d.what_to_watch.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "var(--accent-dim)",
                      color: "var(--accent)",
                      fontSize: 10,
                      fontWeight: 700,
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── AI OVERVIEW BANNER ── */}
        <div
          style={{
            ...styles.overviewBanner,
            opacity: loaded ? 1 : 0,
            transform: loaded ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.6s ease 0.25s, transform 0.6s ease 0.25s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>✦</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.06em" }}>
              AI OVERVIEW
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text)", lineHeight: 1.7 }}>
            {d.ai_overview}
          </p>
        </div>

        {/* ── DIMENSION CARDS GRID ── */}
        <div style={styles.grid}>
          <DimensionCard d={d.dimensions.macro_context} delay={350}>
            <MacroCard d={d.dimensions.macro_context} />
          </DimensionCard>

          <DimensionCard d={d.dimensions.overnight_context} delay={450}>
            <OvernightCard d={d.dimensions.overnight_context} />
          </DimensionCard>

          <DimensionCard d={d.dimensions.key_levels} delay={550}>
            <LevelsCard d={d.dimensions.key_levels} />
          </DimensionCard>

          <DimensionCard d={d.dimensions.volatility_regime} delay={650}>
            <VolatilityCard d={d.dimensions.volatility_regime} />
          </DimensionCard>

          <div style={{ gridColumn: "1 / -1" }}>
            <DimensionCard d={d.dimensions.news_sentiment} delay={750}>
              <NewsCard d={d.dimensions.news_sentiment} />
            </DimensionCard>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div
          style={{
            textAlign: "center",
            padding: "32px 0 48px",
            fontSize: 11,
            color: "var(--muted)",
          }}
        >
          Analysis generated via Anthropic API with web search • Phase 1 Architecture
          <br />
          Data may be delayed. Always verify key levels with your broker platform.
        </div>
      </div>
    </div>
  );
}

/* ── styles ── */

const styles = {
  page: {
    minHeight: "100vh",
    background: "var(--bg)",
    fontFamily: "'DM Sans', sans-serif",
    color: "var(--text)",
  },

  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 32px",
    position: "sticky",
    top: 0,
    zIndex: 100,
    background: "rgba(44,47,42,0.85)",
    backdropFilter: "blur(16px)",
    borderBottom: "1px solid var(--card-border)",
  },
  logo: {
    fontSize: 16,
    fontWeight: 300,
    color: "var(--text)",
    letterSpacing: "0.02em",
  },
  logoAccent: {
    background: "var(--accent)",
    color: "#2C2F2A",
    padding: "2px 8px",
    borderRadius: 6,
    fontWeight: 700,
    fontSize: 14,
  },
  navPills: {
    display: "flex",
    gap: 2,
    background: "var(--nav-bg)",
    borderRadius: 28,
    padding: 4,
  },
  pill: {
    padding: "8px 16px",
    borderRadius: 24,
    border: "none",
    background: "transparent",
    color: "var(--text-secondary)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    transition: "all 0.2s",
  },
  pillActive: {
    background: "var(--accent)",
    color: "#2C2F2A",
    fontWeight: 700,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "var(--card-bg)",
    border: "1px solid var(--card-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  container: {
    maxWidth: 960,
    margin: "0 auto",
    padding: "32px 24px",
  },

  heroCard: {
    marginTop: 24,
    padding: 28,
    borderRadius: 20,
    background: "var(--hero-gradient)",
    border: "1px solid var(--card-border)",
  },

  overviewBanner: {
    marginTop: 16,
    padding: "20px 24px",
    borderRadius: 16,
    background: "linear-gradient(135deg, rgba(163,194,142,0.08) 0%, rgba(163,194,142,0.03) 100%)",
    border: "1px solid rgba(163,194,142,0.15)",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginTop: 16,
  },

  card: {
    padding: 22,
    borderRadius: 16,
    background: "var(--card-bg)",
    border: "1px solid var(--card-border)",
    transition: "background 0.2s",
  },

  narrative: {
    fontSize: 13,
    color: "var(--text-secondary)",
    lineHeight: 1.65,
    margin: "12px 0 0",
  },

  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: "1px solid var(--card-border)",
    background: "var(--card-bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "background 0.2s",
  },
};
