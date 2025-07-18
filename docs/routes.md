# 📍 App Routes – Binary Hub

Este documento define todas as rotas do app Binary Hub, agrupadas por seções funcionais.

---

## 🌐 Páginas Públicas

| Caminho             | Componente / Página          | Descrição                                        |
|---------------------|------------------------------|--------------------------------------------------|
| `/`                 | `LandingPage`                | Página inicial com chamada para ação             |
| `/plans`            | `PlansPage`                  | Apresentação dos planos pagos                    |
| `/faqs`             | `FAQsPage`                   | Perguntas frequentes                             |
| `/about`            | `AboutPage`                  | Informações institucionais                       |
| `/docs`             | `DocsPage`                   | Documentação da plataforma                       |
| `/auth/login`       | `LoginPage`                  | Tela de login do usuário                         |
| `/auth/register`    | `RegisterPage`               | Tela de registro do usuário                      |

---

## 🔐 Páginas Privadas (usuário autenticado)

| Caminho             | Componente / Página          | Descrição                                        |
|---------------------|------------------------------|--------------------------------------------------|
| `/home`             | `MainDashboardPage`          | Dashboard principal com métricas e eventos       |
| `/trades`           | `TradesPage`                 | Lista e CRUD de trades registrados               |
| `/trades/new`       | `NewTradePage`               | Adição manual de novo trade                      |
| `/trades/:id`       | `TradeDetailPage`            | Detalhes completos de um trade específico        |
| `/analytics`        | `AnalyticsPage`              | Análise avançada de performance                  |
| `/events`           | `EconomicEventsPage`         | Calendário e feed de eventos econômicos          |
| `/ai`               | `AIInsightsPage`             | Página com assistente LLM e sugestões automáticas|
| `/profile`          | `ProfileSettingsPage`        | Configurações de conta do usuário                |

---

## ⚙️ Rotas de Sistema / Técnicas

| Caminho             | Componente / Página          | Descrição                                        |
|---------------------|------------------------------|--------------------------------------------------|
| `/api/*`            | `API Routes (Next.js)`       | Endpoints internos do app                        |
| `/404`              | `Custom404Page`              | Página personalizada de erro 404                 |
| `/500`              | `Custom500Page`              | Página personalizada de erro 500                 |

---

## 🧱 Estrutura Sugerida de Diretórios

/app
/components
/pages
/auth
login.tsx
register.tsx
/trades
index.tsx
new.tsx
[id].tsx
/analytics
/events
/ai
/profile
/docs
/plans
/faqs
/about
/home.tsx
/index.tsx


---

## 📌 Notas Técnicas

- O usuário não autenticado deve ser redirecionado para `/auth/login` ao tentar acessar rotas privadas.
- Todas as rotas privadas devem ser protegidas via HOC ou middleware (ex: `withAuth`).
- Ideal usar `NextAuth.js` para controle de sessão e persistência.
- `404` e `500` devem ser implementadas como páginas personalizadas (`pages/404.tsx` e `pages/500.tsx`).

---

```mermaid
graph TD
  subgraph 🌐 Público
    A0[Landing Page ( / )]
    A1[Plans ( /plans )]
    A2[FAQs ( /faqs )]
    A3[About ( /about )]
    A4[Docs ( /docs )]
    A5[Login ( /auth/login )]
    A6[Register ( /auth/register )]
  end

  subgraph 🔐 Autenticado
    B0[Home Dashboard ( /home )]
    B1[Trades ( /trades )]
    B2[New Trade ( /trades/new )]
    B3[Trade Detail ( /trades/:id )]
    B4[Analytics ( /analytics )]
    B5[Events ( /events )]
    B6[AI Reports ( /ai )]
    B7[Profile ( /profile )]
  end

  subgraph ⚙️ Técnicas
    C0[404 Error Page ( /404 )]
    C1[500 Error Page ( /500 )]
    C2[API Endpoints ( /api/* )]
  end

  %% Relações
  A5 --> B0
  A6 --> B0
  B0 --> B1 --> B2
  B1 --> B3
  B0 --> B4
  B0 --> B5
  B0 --> B6
  B0 --> B7
```

