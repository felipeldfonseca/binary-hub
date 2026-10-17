# Binary Hub

Diário de operações e central de mercado para quem opera opções binárias (Ebinex) e futuros (Top One). O app está sendo reconstruído tela a tela a partir de um protótipo aprovado, em fases.

## Stack

| Camada | Tecnologia |
|---|---|
| App | Next.js 14 (app router), TypeScript, Tailwind |
| Dados e login | Supabase (Postgres com RLS, Auth) |
| Publicação | Vercel, pelo GitHub Actions a cada push na `main` |
| Análise de mercado | API da Anthropic |
| Testes | Jest e Testing Library |

## Rodar localmente

Requer Node 22.

```bash
npm run setup
cp -n app/.env.example app/.env.local   # só cria se não existir; preencha os valores
npm run dev                          # http://localhost:3000
```

Para ver as telas novas (`/diario`), coloque o e-mail da sua conta em `HUB_USERS` no `app/.env.local`.

Outros comandos, todos a partir da raiz:

```bash
npm test             # testes
npm run type-check   # tipos
npm run lint         # lint
npm run build        # build de produção
```

## Estrutura

```
app/                 # o aplicativo (Next.js)
├── app/(hub)/       # telas novas, com a moldura das pranchas
├── app/api/         # rotas de API (todas exigem login)
├── components/hub/  # moldura: cabeçalho, tema, acesso
├── lib/             # autenticação, Supabase, fusos, leitores de CSV
├── styles/hub.css   # tokens de cor das telas novas
└── __tests__/       # testes
supabase/            # configuração e migrações SQL
design/              # logos e fontes
docs/arquivo/        # documentos de antes da reconstrução, só para consulta
```

## Fases

| Fase | Conteúdo |
|---|---|
| 0 | Base segura e moldura (concluída) |
| 1 | Contas e importação |
| 2 | Regras e janelas |
| 3 | Registrar operação |
| 4 | Diário |
| 5 | Estado do mercado |
| 6 | Análises |
| 7 | Padrões |
| 8 | Mercado, página do ativo, Início e IA |
| 9 | Troca e limpeza |

## Repositório público

Nunca envie para o Git exportações reais das corretoras nem arquivos `.env`. A pasta `docs/csv/` é ignorada pelo Git justamente para guardar os arquivos reais.
