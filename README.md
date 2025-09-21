# Binary Hub

> *Connect. Collaborate. Conquer.*  – The social trading platform for binary options traders

![Build](https://img.shields.io/github/actions/workflow/status/binaryhub/binaryhub/ci.yml?branch=main)
![License](https://img.shields.io/github/license/binaryhub/binaryhub)

Binary Hub é a **primeira plataforma social** dedicada a traders de opções binárias, combinando networking entre traders, ferramentas de colaboração em tempo real e journaling inteligente. Transformamos o trading solitário em uma experiência colaborativa onde traders conectam, compartilham estratégias e evoluem juntos.

> **Visão MVP:** Lançar plataforma social completa com profiles de trader, networking e ferramentas de análise colaborativa.
> Para o escopo detalhado consulte [`docs/dev/mvp_scope.md`](docs/dev/mvp_scope.md).

---

## ✨ Funcionalidades Principais (MVP)

### Core Social Features
| Feature                              | Estado |
| ------------------------------------ | ------ |
| Profiles públicos de traders        | 🔄     |
| Sistema de follow/followers          | 🔄     |
| Feed social de trading               | 🔄     |
| Compartilhamento de trades           | 🔄     |
| Sistema de achievements/badges       | 🔄     |

### Core Trading Features  
| Feature                              | Estado |
| ------------------------------------ | ------ |
| Autenticação (Email, Google)         | ✅      |
| Log manual / CSV upload de trades    | ✅      |
| Dashboard com Win Rate, P&L, streak | ✅      |
| Calendário de performance (heat-map) | ✅      |
| Regras pessoais & aderência          | 🟡 (β) |
| Billing & subscription system        | 🔄     |

### Future Premium Features
| Feature                              | Estado |
| ------------------------------------ | ------ |
| Live Trading Collaboration          | 📋     |
| Real-time chart sharing              | 📋     |
| Voice communication                  | 📋     |
| AI-powered chart analysis            | 📋     |
| Collaborative AI insights            | 📋     |

**Legend**: ✅ Complete | 🟡 Partial | 🔄 In Development | 📋 Planned

---

## 🏗️ Stack Técnica

| Camada       | Tech                               | Notas               |
| ------------ | ---------------------------------- | ------------------- |
| Front-end    | **Next.js 14**, Tailwind CSS       | Deploy Vercel       |
| Back-end     | **Firebase** (Auth, Firestore, CF) | NoSQL, serverless   |
| Real-time    | **WebSocket**, Firebase listeners  | Social features     |
| AI Platform  | **OpenAI GPT-4o**                  | Chart analysis     |
| CI / CD      | GitHub Actions                     | Lint, test, preview |
| Testes       | Jest, Playwright                   | Cobertura ≥ 80 %    |

---

## 📂 Estrutura do Repositório

```
.
├─ app/               # Next.js front-end
│  ├─ components/     # React components (dashboard, social, trades)
│  ├─ hooks/          # Custom React hooks
│  ├─ lib/            # Utilities, Firebase config, contexts
│  └─ types/          # TypeScript type definitions
├─ functions/         # Firebase Functions backend (Node.js 20)
│  ├─ src/
│  │  ├─ routes/      # Express route handlers
│  │  ├─ services/    # Business logic (social, AI, CSV parser)
│  │  └─ index.ts     # Main Functions export
├─ docs/              # Architecture and business documentation
│  ├─ dev/            # Development guides (PRD, MVP scope, etc.)
│  ├─ features/       # Future feature specifications
│  └─ ui/             # UI/UX documentation
├─ design/            # UI/UX assets and brand guidelines
└─ tests/             # Testing strategy and suites
```

---

## 🚀 Product Roadmap

### Phase 1: Social Trading Platform MVP (3-4 months)
- ✅ Core trading journal functionality
- 🔄 Social profiles and networking
- 🔄 Community features and feed
- 🔄 Billing and subscription system

### Phase 2: Live Collaboration Tools (3-4 months)
- 📋 Real-time presence system
- 📋 Voice communication integration
- 📋 Shared chart functionality
- 📋 Collaborative session recording

### Phase 3: AI-Powered Analysis (4-5 months)
- 📋 Real-time AI chart analysis
- 📋 Visual AI annotations on shared charts
- 📋 Collaborative AI insights
- 📋 Advanced strategy templates

---

## 🎯 Vision Statement

**Binary Hub está transformando o trading de opções binárias de uma atividade solitária em uma experiência social e colaborativa.**

Nossa plataforma conecta traders através de profiles públicos, permite colaboração em tempo real com ferramentas de comunicação integradas, e oferece análise de gráficos assistida por IA para potencializar o aprendizado conjunto.

**Nota importante**: Binary Hub é uma plataforma de análise e networking - traders discutem estratégias e analisam gráficos juntos, mas executam suas operações nas exchanges de sua preferência.

---

## 🤝 Contributing

Ver [`docs/project/CONTRIBUTING.md`](docs/project/CONTRIBUTING.md) para guidelines de desenvolvimento.

## 📄 License

MIT License - ver [`LICENSE`](LICENSE) para detalhes.

---

*"Connecting traders worldwide through technology, collaboration, and shared success."*