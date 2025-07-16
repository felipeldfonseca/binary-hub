# Main Page Documentation – Binary Hub

## ✅ Overview

A página principal (Main Page) do aplicativo Binary Hub é o painel central do usuário logado, onde ele acompanha seus resultados, métricas-chave e eventos do mercado em tempo real. Ela é a primeira página que o usuário acessa após o login.

---

## 🧭 Navegação

A barra de navegação superior permanece visível durante todo o uso e contém os seguintes links:

* Home (main page)
* Trades
* Analytics
* Events
* AI
* Plans
* Ícone de perfil do usuário

**Sugestão técnica:**

* Utilizar `Next.js` com roteamento por páginas.
* Componente `Navbar` com `React Router` ou `next/link`.
* Estilização com `TailwindCSS` ou `styled-components`.

---

## 🧠 Hero Section (Mensagem principal)

### Texto principal:

```txt
Track your results.  
Improve faster.  
Trade better.
```

### Descrição secundária:

> Check all essential metrics and track your performance like a seasonal trader. Full analytics, economic events and daily results all in one place.

### Botão CTA:

* `Check our premium plans`
* Redireciona para `/plans`
* Elemento: `<button>` com `onClick={() => router.push('/plans')}`

**Sugestão técnica:**

* Usar componente `HeroSection` com `flex` ou `grid` para alinhamento.
* Texto com `font-serif`, `text-4xl` ou maior.
* Animação opcional com `framer-motion`.

---

## 📊 Performance Section

Sessão com KPIs principais de performance. Inclui um filtro de período com as opções:

* Day (default)
* Week
* Month
* 3 Months
* 6 Months
* Year

### Estado dinâmico

* Cada KPI deve atualizar conforme o período selecionado.
* O sufixo "on the day" deve ser alterado dinamicamente para "on the week", "on the month", etc.

**Blocos de KPI:**

* **Net P\&L** → Exibido em valor monetário, com destaque verde
* **Win Rate** → Percentual com sufixo dinâmico
* **Result** → Percentual acumulado
* **Average Daily P\&L** → Valor médio diário
* **Daily Streak** → Ex: 3 winning days

**Gráfico:**

* **Cumulative Net P\&L**

  * Eixo X: `Date`
  * Eixo Y: `Amount`
  * Exibir gráfico de linha com `Recharts` ou `Chart.js`

**Sugestão técnica:**

* Criar estado global com `Context API` ou `Zustand` para o período atual
* Utilizar `useEffect` para refetch dos dados ao mudar o período
* KPIs em `<Card>` com `flex-col items-center`
* Dados mockados via JSON no início (ex: `mockData/day.json`)

---

## 🗓 Calendar Section

Calendário com três visualizações:

* Week (default)
* Month
* Year

**Sugestão técnica:**

* Usar biblioteca como `FullCalendar`, `react-calendar` ou `Day.js`
* Calendário adaptado para exibir sessões operadas, anotadas e eventos relevantes
* Armazenar os eventos em banco de dados (`MongoDB` ou `PostgreSQL`)

**Filtro de tempo:**

* Implementar com `Tabs` ou `SegmentedControl` (ex: Radix UI, ShadCN)

---

## 🔔 Daily Events

Sessão para listar eventos econômicos de alto impacto.

**Requisitos:**

* Exibir apenas eventos de alta relevância (ex: FOMC, CPI, NFP)
* Atualização por chamada de API externa com critério de impacto
* Pode ser atualizada sob demanda, não em tempo real

**Sugestão técnica:**

* API: `https://calendarific.com/`, `TradingEconomics`, `Newsdata.io` ou `custom scraper`
* Filtro de impacto baseado em `importance: high`
* Componente `EventCard` renderiza cada item
* Estilização: destaque por impacto, cor ou ícone

---

## 🔚 Footer

Contém links institucionais e redes sociais:

* About us
* Docs
* Plans
* FAQs
* Redes sociais: Facebook, LinkedIn, X, Instagram, YouTube

**Sugestão técnica:**

* Grid ou Flexbox
* Ícones com `react-icons` ou `lucide-react`
* Responsividade com `media queries`

---

## 🧱 Stack Técnico Recomendado

* **Frontend:** Next.js + React
* **UI/UX:** TailwindCSS + ShadCN (ou alternativa design system)
* **Charts:** Recharts ou Chart.js
* **Estado global:** Zustand ou Context API
* **Backend:** Node.js + Express (ou Next.js API Routes)
* **Banco de Dados:** MongoDB (com Mongoose) ou PostgreSQL
* **API externa:** integração com economic news
* **Autenticação:** NextAuth.js
* **Hospedagem:** Vercel ou Railway

---

## 📌 Observações técnicas adicionais

* Todos os blocos devem ser responsivos (mobile/tablet/desktop)
* Priorizar performance usando SSR/ISR
* KPIs atualizados com `useEffect` e `axios/fetch` com debounce
* Disponibilizar modo escuro como futura melhoria

---

Próximo documento sugerido: `ui/main_page_wireframe.md` – versão em wireframe markdown do layout visual.
