````markdown
# 📊 Media Ops Framework – Binary Hub Marketing AI Stack  
*A self-running, data-driven system to attract and convert binary-options traders via Twitter, TikTok & Instagram.*

---

## 1. High-Level Flow

```mermaid
graph TD
  Ideation["🔍 Insight & Ideation Agent"]
  Script["📝 Copy / Script Agent"]
  ImageGen["🎨 Image / Video Gen Agent"]
  Scheduler["📅 Social Scheduler Agent"]
  Engage["💬 Community Agent"]
  Analyse["📈 Analytics Agent"]

  Ideation --> Script --> ImageGen --> Scheduler
  Scheduler --> Engage --> Analyse --> Ideation
````

---

## 2. AI Agents & Exact Tools

| Agent                         | Tool(s)                                                                                                   | Purpose                                                                                                      | Key Prompts / Setup                                                                                                                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Insight & Ideation**        | ChatGPT (4o) + Brand voice file + Twitter API                                                             | Mine trader pain-points, trending topics, competitor gaps.                                                   | Prompt: *“Act as a binary-options trader mentor. List top frustrations this week from /r/BinaryOptions, Twitter #BOTraders, and Myfxbook forums. Output bullet pain-points ranked by emotion level.”*                          |
| **Copy / Script**             | Claude Opus or GPT-4o + Notion AI                                                                         | Draft hooks, captions, CTAs & 30-sec TikTok scripts.                                                         | Template: *Hook (≤14 words) + Pain + Emotional twist + Data proof + CTA.*                                                                                                                                                      |
| **Image / Video Generation**  | Midjourney v6 or DALLE3 for statics • **Runway Gen-2** for short B-roll • **Canva API** for auto-branding | Produce story-driven carousels, TikTok cut-outs, quote cards with brand fonts (Etna / Montaga / Montserrat). | Prompt: *“3-panel carousel: dark fintech background, neon green highlights. Panel 1 text ‘Over-trading kills profits’. Panel 2 chart dropping, Panel 3 caption ‘Binary Hub fixes this’. Style: minimal, flat, brand palette.”* |
| **Social Scheduler**          | Buffer API + Zapier                                                                                       | Queue & auto-post to Twitter / TikTok / IG with best-time AI.                                                | Zapier flow: *New row in ‘Approved\_Content’ → Buffer create post with image/video + hashtags.*                                                                                                                                |
| **Community Engagement**      | **TweetHunter / Hypefury** (Twitter) + ManyChat (IG)                                                      | Auto-DM leads with free KPI template, reply to comments with curated answers.                                | Bot tone: empathetic, data-driven, sprinkle jargon (“win-rate”, “edge”, “risk per entry”).                                                                                                                                     |
| **Analytics & Feedback Loop** | Google Data Studio + Buffer analytics + TikTok Insights                                                   | Track CTR, follower growth, conversion to signup (UTM). Feeds back to Ideation Agent.                        | KPI targets: *CTR > 2 % (Twitter), View-through > 15 s (TikTok), Signup per 1 k views ≥ 10.*                                                                                                                                   |

---

## 3. Content Pillars & Tone

| Pillar                | Emotion Trigger        | Example Format                                      |
| --------------------- | ---------------------- | --------------------------------------------------- |
| **Pain Reversal**     | Frustração → Alívio    | Carousel: “3 Signs You’re Over-Trading”             |
| **Micro-Wins**        | Confiança → Inspiração | Tweet: Screenshot of KPI dashboard “+6 % Net P\&L”  |
| **AI Edge**           | Curiosidade → FOMO     | Short reel: Timelapse of AI report generating       |
| **Trader Psychology** | Vulnerabilidade        | Thread: Story of blowing an account & data comeback |
| **Social Proof**      | Validação Social       | Carousel of testimonials (4s each, autoplay)        |

Tone: **Conversational, slightly edgy, anti-hype**. Avoid promises of “get rich”. Emphasize *discipline, data, edge*.

---

## 4. Automated Creative Pipeline (Zapier)

1. **Airtable “Idea Backlog”**

   * Fields: Pain-Point, Format, Due Date, Status.
2. **Zap #1** → GPT Ideation fills backlog daily (status = “draft”).
3. **Zap #2** → When status → “copy”, invoke Claude to write caption + script.
4. **Zap #3** → Midjourney/Runway generate asset, auto-upload to Airtable.
5. **Zap #4** → On approval (status → “approved”), Buffer schedules.
6. **Zap #5** → Post-publish metrics pushed to Data Studio; if KPI < target, flag idea as “needs iterate”.

---

## 5. Hashtag & Hook Cheat-Sheet

### Twitter / IG

`#BinaryOptions #TradingJournal #WinRate #TradeLikeAPro #EdgeOverEmotion`

### TikTok Hook Templates

1. “I lost **\$500** in 15 minutes… here’s why 💀👇”
2. “3 mistakes killing your win-rate (+ quick fix)”
3. “Streak of 7 wins? Here’s my data-sheet proof 📊”

---

## 6. Lead Magnet & Funnel

| Stage     | Tática                                   | Ferramenta       |
| --------- | ---------------------------------------- | ---------------- |
| Awareness | Viral pain-carousel                      | IG Reels, TikTok |
| Interest  | Auto-DM “Free KPI Tracker Sheet”         | ManyChat         |
| Desire    | Email drip: “From 45 % to 65 % win-rate” | ConvertKit       |
| Action    | CTA to register (Free plan) with UTM     | Vercel + Segment |

---

## 7. Governance & Roles

| Role (Agent / Human)               | SLA           | Output                 |
| ---------------------------------- | ------------- | ---------------------- |
| **AI Content Lead** (Insight/Copy) | 3 ideas/day   | Airtable rows          |
| **Creative Bot** (Image/Video)     | <30 min/asset | PNG/MP4                |
| **Human Editor**                   | 1 h review    | Approve/Reject         |
| **Scheduler Bot**                  | –             | Publish at best-time   |
| **Community Manager** (bot+human)  | Reply <4 h    | Comment/DM             |
| **Growth Analyst**                 | Weekly        | KPI report & next bets |

---

## 8. Immediate Setup Checklist

* [ ] Upload brand fonts to Canva & Midjourney custom prompts.
* [ ] Create Airtable base + Zapier flows (#1-5).
* [ ] Connect Buffer accounts (Twitter, IG, TikTok).
* [ ] Seed 20 pain-point ideas via Insight Agent.
* [ ] Generate first carousel + reel, push to feature branch “marketing-assets”.
* [ ] Review brand voice with mentor for alignment.

---

> **Key Success Metric:** 1 % follower → signup conversion within 60 days.
> **North Star:** “Daily AI Reports generated” (proxy for value delivered).

---

```

Use this Markdown as the blueprint for setting up your fully automated, AI-enhanced media department focused on deeply resonating with binary-options traders and driving measurable growth.
```
