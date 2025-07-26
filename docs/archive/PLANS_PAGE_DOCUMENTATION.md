Below is a **ready-to-paste Markdown spec** for the **expanded Plans page** (3 tiers).
It mirrors the persuasion style of TradingView’s pricing table, but adapted to Binary-options traders and your feature-set.

> **Pricing copy placeholders** are in USD/month — adjust when you finalize.
> Use the same dark theme (`#505050`) and green accent (`#00E28A`).
> Icons = Lucide or Heroicons (`Check`, `Minus`, `Star`).

---

```markdown
# Choose the Plan That Fits Your Trading Journey
## Start for Free. Unlock pro analytics whenever you’re ready.

> **Most Popular → Pro**  
> Upgrade any time • No hidden fees • 14-day money-back guarantee on annual plans

|  | **Free** <br/>*Forever free* | **Premium** <br/>*Most popular* | **Enterprise** <br/>*Custom* |
|---|:--|:--|:--|
| **Price / mo** | **$0** | **$19** | **Contact Sales** |
| **Trade imports** | 100 / month | **Unlimited** | Unlimited + auto sync |
| **Manual journal** | ✔︎ | ✔︎ | ✔︎ |
| **CSV import (Ebinex)** | ✔︎ | ✔︎ | ✔︎ |
| **Basic KPIs** <br/><small>(Win Rate, Net P&L, Result)</small> | ✔︎ | ✔︎ | ✔︎ |
| **Performance Heatmap** | ✔︎ | ✔︎ | ✔︎ |
| **Advanced analytics** <br/><small>(Equity curve, R:R, Drawdown)</small> | — | ✔︎ | ✔︎ |
| **Strategy KPIs** <br/><small>(per model / time of day)</small> | — | ✔︎ | ✔︎ |
| **AI Insights** | Weekly | **Daily** | Real-time |
| **Edge Report PDF** | — | ✔︎ | ✔︎ (white-label) |
| **Economic calendar** | High-impact events | All events + filters | All + team alerts |
| **Custom dashboards** | — | 2 | Unlimited |
| **Team management** | — | — | ✔︎ (10+ seats) |
| **API integrations** | — | — | All brokers + custom |
| **Data export** | CSV | CSV · Excel · JSON | API & Webhooks |
| **Priority support** | Community | Within 24 h | Dedicated CSM |
| **Branding** | Binary Hub | Binary Hub | Custom logo & colors |
| **Free trial** | — | **14 days** | Pilot project |

<div align="center">

**[Get Started](#signup)**
    **[Start Free Trial](#pro-trial)**
    **[Contact Sales](mailto:sales@binaryhub.app)**

</div>
```

---

## 🗂️ Section-by-Section Breakdown (copy & logic)

### 1. Headline + Sub-headline

*“Choose the Plan That Fits Your Trading Journey”*
*“Start with Free. Unlock pro analytics whenever you’re ready.”*

### 2. Trust badges under headline

`PCI-DSS secure • Cancel anytime • No hidden fees`

### 3. Feature categories (use subtle separators)

| Category           | Rows                                |
| ------------------ | ----------------------------------- |
| **Core Logging**   | Imports, manual journal, API        |
| **Analytics**      | Basic KPIs, Advanced, Strategy KPIs |
| **AI & Reports**   | AI Insights, PDF report             |
| **Productivity**   | Custom dashboards, calendar, export |
| **Team & Support** | Team seats, support SLA, branding   |

> *Tip:* Use light borders <small>(`border-white/10`)</small> to group categories like TradingView.

### 4. Visual cues

* **Pro column** (`middle`) has green outline (`ring-2 ring-green-400`) and badge “Most Popular”.
* Free column background: `bg-[#3A3A3A]`
  Pro column: `bg-[#656C66]/60`
  Enterprise: darker `bg-[#2D2F30]`
* Price font: Montaga, `text-5xl`, green.
* CTA buttons: `rounded-full`, large padding; “Start Free Trial” in Pro.

### 5. Persuasive micro-copy

* Under “Unlimited trades”: *“Perfect for active day-traders & high-frequency binários.”*
* Under “Advanced analytics”: *“Slice your data by session, asset, or strike time.”*
* Under Enterprise contact: *“Need 10+ seats or custom broker integration? Let’s talk.”*

---

## 🔧 Implementation Notes

1. Table is **mobile-scrollable**; breakpoints switch to stacked cards at `md:`.
2. For accessibility, replace icons with `aria-label="Included"` for screen-readers.
3. **Billing toggle** (Monthly / Annual -10 %) can be added later with `useState("monthly")`.
4. Use marketing UTMs on CTA links (`/auth/register?utm=plans_free`, etc.).

---

With this expanded comparison table you highlight clear, tangible value jumps—mirroring TradingView’s persuasive style—and make the Pro upgrade feel like the obvious next step for any active trader.
