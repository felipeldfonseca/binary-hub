# Apêndice técnico do plano de construção

Este apêndice complementa o `plano.md`. Ele foi escrito sem alterar o repositório.

## A. Regras para toda tabela nova

- **Dono.** `user_id uuid not null references auth.users(id) on delete cascade`. Nunca referencia `profiles`, porque a linha de perfil pode não existir: ela é criada pelo app (`AuthContextSupabase.tsx`). Exceção: `trades.user_id` ainda referencia `profiles`, então as RPCs que inserem operações garantem antes o perfil (`insert into profiles ... on conflict do nothing`).
- **Pai e filho.**
  - Tabelas-pai têm `unique (id, user_id)`.
  - Tabelas-filho usam FK composta `(pai_id, user_id)`, para que nenhuma linha aponte para o pai de outro usuário.
- **Políticas.** `(select auth.uid()) = user_id` em `USING` e em `WITH CHECK`, uma política por comando. Tabelas só de acréscimo não têm política de UPDATE nem de DELETE.
- **Gravação pelo servidor.**
  - Fatos com horário ou checagem são gravados por funções `SECURITY DEFINER` que leem `auth.uid()` do JWT de quem chama. Elas têm `set search_path = public` e `revoke execute ... from public, anon`.
  - A service role só grava tabelas globais (`market_states`, `economic_events`, `ai_readings`) e roda nos crons. Nunca usa prefixo `NEXT_PUBLIC`.
- **Fuso.**
  - A conversão "hora do arquivo → instante" acontece num lugar só: no Postgres (`local AT TIME ZONE tz`).
  - O `tempo.ts` serve só para a prévia no navegador, e um teste de paridade compara os dois nos horários ambíguos e inexistentes.
- **Dia do pregão (`trading_day`).**
  - É a data da entrada no fuso da janela da versão de regra em vigor na entrada.
  - Janela que passa da meia-noite conta no dia em que abriu.
  - Sem versão de regra, vale o `day_tz` da conta.
  - É sempre calculado pela função `compute_trading_day(account_id, entry_time)`. Nunca usar `toISOString()` nem o fuso do navegador.
- **Expandir, preencher, trocar, contrair.**
  - Nada é apagado antes da Fase 9.
  - Antes de cada migração no projeto real: fazer `pg_dump`, rodar uma contagem dry-run e aplicar primeiro no projeto de teste.

## B. Esboço do delta de esquema

### Fase 1: M1 `trading_accounts`

```sql
create table public.trading_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'normal' check (kind in ('normal','revisar')),
  market text check (market in ('futures','binary','forex','stocks','crypto','b3','options')),
  label text not null check (char_length(label) between 1 and 60),
  platform text, firm text, external_ref text,
  phase text check (phase in ('avaliacao','financiada','pessoal','demo')),
  currency text not null default 'USD',
  size numeric(14,2), initial_balance numeric(14,2),
  file_tz text not null default 'UTC',            -- IANA, validado por trigger contra pg_timezone_names
  day_tz  text not null default 'America/Sao_Paulo',
  tz_applied_at timestamptz,                      -- marca da correção M4
  is_primary boolean not null default false,
  is_example boolean not null default false,
  legacy_market_type text,                        -- ponte com trades.market_type até a Fase 9
  rule_overrides jsonb not null default '{}'::jsonb,
  copy_group_id uuid,                             -- futuro; sempre null por ora
  archived_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (kind = 'revisar' or market is not null)
);
create unique index trading_accounts_label_uq on trading_accounts (user_id, lower(label));
create index trading_accounts_active on trading_accounts (user_id) where archived_at is null;
alter table trading_accounts enable row level security;
-- select / insert / update próprios; sem delete (arquivar)

-- backfill (contagem antes, num dry run)
-- 1) uma conta por elemento de profiles.market_accounts
--    chaves: marketType, displayName, initialBankroll, currency, isPrimary
insert into trading_accounts (user_id, market, label, legacy_market_type, currency, initial_balance, is_primary, day_tz)
select p.id, e->>'marketType', coalesce(nullif(e->>'displayName',''), e->>'marketType'),
       e->>'marketType', coalesce(e->>'currency','USD'), nullif(e->>'initialBankroll','')::numeric,
       coalesce((e->>'isPrimary')::boolean,false),
       case e->>'marketType' when 'futures' then 'America/New_York' else 'America/Sao_Paulo' end
from profiles p cross join lateral jsonb_array_elements(coalesce(p.market_accounts,'[]'::jsonb)) e;
-- 2) uma por market_type usado em trades/account_transactions que ainda não tenha conta
-- 3) uma conta kind='revisar' ("A revisar") por usuário com trades.market_type is null
-- colisão de nome: sufixo " (2)"
```

Depois do M1, o app passa a tratar `profiles.market_accounts` como somente leitura, e o onboarding grava em `trading_accounts`.

### Fase 1: M2 colunas novas e ponte com o código antigo

```sql
alter table trades
  add constraint trades_id_user_uq unique (id, user_id),
  add column account_id uuid,
  add column import_batch_id uuid,
  add column source text check (source in ('live','after','import')),
  add column source_platform text,
  add column external_id text,
  add column source_local_entry timestamp,   -- relógio do arquivo, sem fuso
  add column source_local_exit  timestamp,
  add column trading_day date,
  add column commission numeric(18,2),        -- null = desconhecida, não zero
  add column stop_price numeric(18,8),
  add column target_price numeric(18,8),
  add column note text check (char_length(note) <= 1000),   -- nota do usuário; notes continua sendo a chave antiga
  add column note_saved_at timestamptz;
alter table trades add constraint trades_account_fk
  foreign key (account_id, user_id) references trading_accounts (id, user_id);
alter table trades add constraint trades_account_ext_uq
  unique (account_id, source_platform, external_id);   -- restrição simples, não índice parcial
create index trades_user_acc_day on trades (user_id, account_id, trading_day);
create index trades_user_sym_entry on trades (user_id, symbol, entry_time);

-- account_transactions: account_id + FK composta, com a mesma ponte

-- backfill
update trades t set account_id = a.id from trading_accounts a
 where a.user_id = t.user_id and a.legacy_market_type = t.market_type and t.account_id is null;
update trades t set account_id = a.id from trading_accounts a
 where a.user_id = t.user_id and a.kind = 'revisar' and t.market_type is null and t.account_id is null;
update trades set source = 'import',
       source_platform = split_part(notes, ':', 1),
       external_id = substr(notes, position(':' in notes) + 1),
       source_local_entry = entry_time at time zone 'UTC',   -- recupera exatamente o relógio do arquivo
       source_local_exit  = exit_time  at time zone 'UTC'
 where notes ~ '^(ebinex|topone):';
update trades set source = 'after' where source is null;
update trades set trading_day = compute_trading_day(account_id, entry_time);
```

**Ponte com o código antigo.** Um trigger `BEFORE INSERT OR UPDATE OF account_id, market_type, notes, entry_time` em `trades` faz o seguinte:
- Linha antiga sem `account_id`: preenche pela conta com `legacy_market_type = market_type`, dando preferência à principal. Isso cobre `useTradesSupabase.ts:113/191/242` e `useAccountTransactions.ts:60`.
- Linha nova sem `market_type`: preenche a partir da conta, para que as páginas antigas continuem vendo as operações novas.
- `notes` com prefixo `ebinex:` ou `topone:`: preenche `source_platform`, `external_id` e `source='import'`.
- Recalcula `trading_day`.

`trades_user_id_notes_unique` e as chaves em `notes` ficam intocados até a Fase 9. A nota do usuário usa a coluna `note`.

**Efeito colateral a conhecer.** Uma reimportação pelo caminho antigo de uma operação que já entrou pelo caminho novo bate em `trades_account_ext_uq` e falha com 409, sem duplicar. Por isso os dois botões antigos passam para a rota nova no mesmo deploy.

### Fase 1: M3 `import_batches` e RPCs de importação

```sql
create table import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  platform_detected text not null,
  file_name text, file_sha256 text, file_tz text not null,
  rows_total int not null default 0, rows_inserted int not null default 0,
  rows_duplicate int not null default 0, rows_other_account int not null default 0,
  rows_error int not null default 0,
  error_rows jsonb not null default '[]',   -- só número da linha e motivo, nunca valores
  moved jsonb not null default '[]',
  is_legacy boolean not null default false, -- um por conta, não pode ser desfeito
  status text not null default 'done' check (status in ('done','undone')),
  created_at timestamptz not null default now(), undone_at timestamptz,
  unique (id, user_id),
  foreign key (account_id, user_id) references trading_accounts (id, user_id)
);
create index on import_batches (account_id, file_sha256);
alter table trades add constraint trades_batch_fk
  foreign key (import_batch_id, user_id) references import_batches (id, user_id);
-- RLS: só select para o dono; escrita só pelas RPCs abaixo
```

As RPCs são todas `SECURITY DEFINER`, conferem que a conta é de `auth.uid()` e rodam numa transação só:

- **`import_preview(account, platform, sha256, rows jsonb)`** não grava nada. Devolve:
  - "arquivo já importado", pelo `(account_id, file_sha256)` de um lote `done`;
  - novas, duplicadas por conta e de outra conta;
  - as operações que mudariam de dia.
- **`import_commit(account, platform, file_name, sha256, rows jsonb)`**:
  - insere com `entry_time = local_entry AT TIME ZONE acc.file_tz`, usando `on conflict (account_id, source_platform, external_id) do nothing`;
  - grava o lote e as contagens.

  Arquivo com várias contas: o navegador separa as linhas e chama uma vez por conta, gerando um lote por conta.
- **`import_undo(batch, confirmar_cascata boolean)`**:
  - se alguma operação do lote tem marca ou imagem e `confirmar_cascata` é falso, recusa e devolve a contagem;
  - devolve os caminhos das imagens, para a rota apagá-las pela API do Storage (nunca por SQL);
  - lote legado recusa.
- **`import_fix_tz(account, new_tz, dry_run boolean)`**:
  - recalcula `entry_time` e `exit_time` a partir de `source_local_*` e recalcula `trading_day`;
  - no `dry_run`, só devolve as contagens: quantas mudam de dia e por quantas horas;
  - grava `file_tz` e `tz_applied_at`.

  Como parte sempre do relógio do arquivo, rodar duas vezes com o mesmo fuso não muda nada.

**M4.** Não é um arquivo de migração. São chamadas a `import_fix_tz` conta a conta: primeiro com `dry_run`, você vê a contagem, dá o OK, e então roda de verdade. Só depois de você confirmar o `file_tz` de cada conta (Ebinex: `America/Sao_Paulo`; Top One: a confirmar com o ensaio).

**Também na Fase 1:** `profiles.preferences jsonb not null default '{}'`, com tema, fuso de exibição, blocos do Início e notificações.

### Fase 2: M5 janelas e regras

```sql
create table operating_windows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  market text, account_id uuid,
  check ((market is null) <> (account_id is null)),
  session text check (session in ('asia','londres','ny')),
  tz text not null,
  start_min smallint not null check (start_min between 0 and 1439),
  end_min   smallint not null check (end_min between 0 and 1439),   -- end < start: passa da meia-noite
  weekdays smallint not null default 31 check (weekdays between 1 and 127), -- bit0 = seg
  foreign key (account_id, user_id) references trading_accounts (id, user_id) on delete cascade
);
create table market_rule_defaults (
  user_id uuid not null references auth.users(id) on delete cascade,
  market text not null, rules jsonb not null, updated_at timestamptz not null default now(),
  primary key (user_id, market)
);  -- regra de janela, bloqueio (min antes/depois, calendários), limite diário e o que fazer nele, escolha e texto por estado
create table account_rule_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  version_no int not null,
  effective_from timestamptz not null default now(),
  resolved jsonb not null,      -- janelas com fuso + regras efetivas, congeladas
  note text,
  unique (account_id, version_no), unique (id, user_id),
  foreign key (account_id, user_id) references trading_accounts (id, user_id)
);
```

- Só se acrescentam versões: há política de SELECT, e nenhuma de INSERT, UPDATE ou DELETE.
- Gravar passa pela RPC `save_rules(account, payload)`. Ela calcula `version_no`, força `effective_from = now()` e congela `resolved`.
- O "desde" é o `effective_from` da versão 1. Não se copiam os horários 09:00–17:00 de `profiles`.
- Uma versão nova só vale para operações posteriores, então não é preciso recalcular nada.

### Fase 3: M6a ciclo da operação, marcas, imagens e contexto

```sql
alter table trades
  add column status text not null default 'closed' check (status in ('open','closed')),
  add column registered_at timestamptz,
  add column exit_registered_at timestamptz,
  add column rule_version_id uuid,
  add constraint trades_rulever_fk foreign key (rule_version_id, user_id)
      references account_rule_versions (id, user_id);

create table trade_marks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  trade_id uuid not null,
  kind text not null check (kind in ('setup','execucao','emocao','seguiu_texto')),
  value text not null,
  marked_at timestamptz not null default now(),   -- trigger BEFORE INSERT força now()
  foreign key (trade_id, user_id) references trades (id, user_id) on delete cascade
);  -- políticas: select + insert; sem update/delete
create view trade_marks_v with (security_invoker = true) as
  select m.*, (t.source = 'live' and m.marked_at < coalesce(t.exit_registered_at, 'infinity')) as limpa
  from trade_marks m join trades t on t.id = m.trade_id;

create table trade_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trade_id uuid not null,
  path text not null unique,
  mime text not null check (mime in ('image/png','image/jpeg','image/webp')),
  bytes int not null check (bytes between 1 and 10485760),
  status text not null default 'pendente' check (status in ('pendente','ok')),
  created_at timestamptz not null default now(),
  foreign key (trade_id, user_id) references trades (id, user_id) on delete cascade
);  -- trigger: no máximo 4 por operação (com lock na linha da operação); path = '{uid}/{trade_id}/{uuid}'
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trade-images','trade-images', false, 10485760, array['image/png','image/jpeg','image/webp']);
-- políticas em storage.objects (select, insert, delete):
--   bucket_id = 'trade-images' and (storage.foldername(name))[1] = (select auth.uid())::text

create table trade_entry_context (
  trade_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  origin text not null check (origin in ('live','reconstructed')),
  captured_at timestamptz not null default now(),
  market_as_of timestamptz,              -- horário do dado de mercado usado (null até a Fase 5)
  screen jsonb,                          -- por ativo: estado, direção, provisório, placares, reading_id
  gate text check (gate in ('liberado','aguardar','fora_janela','encerrado')),
  in_window boolean, in_block boolean, after_limit boolean,
  day_pnl_at_entry numeric(18,2),
  bias text, bias_marked_at timestamptz,
  state_choice text check (state_choice in ('opero','so_a_favor','nao_opero')),
  rule_ok boolean,
  checks_evaluated text[] not null default '{}',   -- 'janela','limite','bloqueio','estado': "não avaliado" ≠ "ok"
  foreign key (trade_id, user_id) references trades (id, user_id) on delete cascade
);  -- só select para o dono
```

**Integridade dos horários.**
- **Ao inserir:** um trigger força `registered_at = now()`.
- **Ao atualizar uma operação `live`:** outro trigger congela `entry_time`, `registered_at`, `exit_registered_at` (depois de preenchido), `rule_version_id`, `source` e `account_id`.
- **Privilégio de UPDATE:** `revoke update on trades from authenticated`, depois `grant update (colunas que a edição antiga usa)`. A lista exata sai do que `useTradesSupabase.ts:141` envia, e um teste cobre a edição antiga. Revogar só algumas colunas não basta, porque o Supabase concede UPDATE na tabela inteira.

**RPCs da operação.**
- **`register_entry(account, symbol, direction, qty, price, stop, target, setup)`**:
  - grava a operação com `source='live'`, `status='open'`, `entry_time = registered_at = now()` e a versão de regra vigente;
  - roda as checagens no SQL: janela, limite pela soma do `trading_day` da conta, e, a partir da Fase 5, bloqueio e estado, com o último `market_states` de até 10 min;
  - grava `trade_entry_context` e a marca de setup.

  O `gate.ts` no navegador só mostra a prévia, e a mesma tabela-verdade testa os dois lados.
- **`register_exit(trade, price, pnl, result)`**: grava `exit_time = exit_registered_at = now()` e `status='closed'`.
- **"Depois":** `register_after(...)` grava `source='after'` e `origin='reconstructed'`. As marcas feitas aí nunca contam como limpas.
- **Imagens:**
  1. A rota `POST /api/trades/[id]/anexos` confere que há menos de 4 imagens, cria a linha como `pendente` e devolve a URL assinada de upload.
  2. O navegador converte a imagem para WebP e envia direto ao Storage, porque passa do limite de 4,5 MB da Vercel.
  3. Uma segunda chamada marca a imagem como `ok`.

  O cron de sábado apaga as pendentes com mais de 1 h, pela API do Storage.

### Fase 4: M6b Diário

- **`day_reviews`:**
  - campos: `account_id` (pode ser null), `trading_day`, `worked`, `differently`, `carry_forward`, `followed` (`sim`, `em_parte` ou `nao`), `auto_summary` (jsonb congelado ao salvar), `saved_at` e `edited_at`;
  - unicidade: `unique nulls not distinct (user_id, account_id, trading_day)`, o que é possível porque o projeto está em PG15;
  - recebe uma cópia de `trading_sessions.session_notes`, `lessons_learned` e `followed_plan`.
- **`weekly_focus`:** `account_id`, `week_of`, `claim_key`, `text` e `chosen_at`, com a mesma unicidade.
- **`diario_mes(account, month)`:** devolve um único `jsonb` com as somas por `trading_day` e os dados do dia. Por ser um valor só, não é cortado pelo `max_rows = 1000`.

### Fase 5: M7a estado do mercado (só com o OK do Yahoo)

- **`market_states`:**
  - chave `(symbol, at)`;
  - campos: `state`, `direction`, `provisional`, `fund_tally jsonb`, `tec_tally jsonb`, `data_as_of`, `origin` (`live` ou `reconstructed`) e `engine_version`;
  - leitura para todo usuário logado; escrita só pela service role.
- **`economic_events`:** fonte e licença nomeadas antes de começar a fase.
- **`bias_marks`** (só de acréscimo): `symbol`, `trading_day`, `bias` e `marked_at = now()`.
- **Rota `GET /api/mercado/estado?symbol=`:**
  - exige `requireUser` e `HUB_USERS`;
  - busca as barras de 5 min no servidor e calcula com `domain/estado`;
  - grava só `market_states`.

  O usuário só dispara o cálculo e não fornece valores. A tela Registrar chama essa rota ao abrir. Se você preferir estado agendado, `pg_cron` + `pg_net` (grátis) chamam a mesma rota com `CRON_SECRET`.
- **Lacunas do dia:** são reconstruídas a partir das barras e marcadas como `reconstructed`. Nunca entram na pergunta pré-registrada nem nos Padrões.
- **Tela:** sempre mostra `data_as_of`.

### Fases 6 e 7: M8 Análises e Padrões

- **`analises(account, de, ate)`:** devolve um único `jsonb` com os campos mínimos por operação e as somas por pregão. O `metrics.ts` calcula os KPIs a partir dele.
- **`pattern_snapshots`:**
  - campos: `account_scope` (pode ser null), `as_of` (date, com `check (extract(isodow from as_of) = 6)`), `claim_key`, `level` e `shown_level` (0–4), `stats jsonb`, `engine_version` e `inputs_cutoff`;
  - unicidade: `unique nulls not distinct` em `(user_id, account_scope, as_of, claim_key, engine_version)`;
  - só de acréscimo.
- **`analysis_questions`:** `key`, `definition jsonb`, `registered_at` e `frozen_at`.
- **Cron `GET /api/cron/padroes`** (sábado, `CRON_SECRET`, service role):
  - roda uma conta por chamada;
  - entram só as operações com `registered_at <= as_of`;
  - a confirmação usa só as operações com `registered_at` posterior ao congelamento anterior. Assim, uma importação tardia com `entry_time` antigo, uma edição ou um desfazer não contam como "dados posteriores";
  - arquivos importados são avaliados uma vez por lote;
  - sábados retroativos rodam só no projeto de teste.

### Fase 8: M7b leituras da IA

- **`ai_readings`:**
  - campos: `symbol`, `slot_at`, `kind` (`scheduled` ou `post_data`), `written_at`, `model`, `prompt_version`, `input_hash`, `content jsonb`, os tokens, `cost_usd`, `rejected_reason`;
  - unicidade `unique (symbol, slot_at, kind)`.
- **`reading_schedules`:** trigger que limita a 3 por usuário.
- **`ai_spend`:** livro de gastos por dia, com teto diário e mensal e corte automático.
- **`ai_analyses`:** ganha `account_id`, `trading_day` e `post_check`.
- **`watchlist_items`:** ganha `contract` (`cheio` ou `micro`) e `market`.

### Fase 9: M9 contração

1. `account_id set not null`, depois de "A revisar" ter sido resolvido.
2. `notes` vira null onde houver `external_id`.
3. `drop constraint trades_user_id_notes_unique`.
4. A ponte deixa de preencher pelo `market_type`.
5. Uma versão depois: `drop column trades.market_type`, `account_transactions.market_type` e `profiles.market_accounts`.

## C. Primeiro PR, arquivo a arquivo: "Base segura" (Fase 0)

O PR tem como base `feature/rebuild-lean` e não muda nada visível.

| Arquivo | Mudança |
|---|---|
| `.github/workflows/ci.yml` (novo) | Roda em `pull_request` e em push para `feature/rebuild-lean`, com Node 22. Em `app/`: `npm ci`, `npx jest --ci`, `npx tsc --noEmit`. |
| `.github/workflows/deploy_frontend.yml` | Node 22. No build, as variáveis do Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) substituem as do Firebase; você cadastra os segredos. O gatilho continua sendo só `main`. |
| `.github/workflows/deploy_backend.yml` | Apagado (com o seu OK). |
| `app/vercel.json` | Sai o rewrite `/api/(.*)` → `cloudfunctions.net`; o arquivo é apagado ou fica `{}`. |
| `.nvmrc`, `package.json` (raiz, `engines`) | `22`. |
| `.gitignore` | Entra `docs/csv/`. O `August_25.csv`, já rastreado, depende da sua decisão. |
| `app/app/api/test/route.ts`, `app/app/api/v1/trades/route.ts`, `app/app/api/v1/analytics/dashboard/route.ts`, `app/app/api/v1/import/upload/route.ts` | Apagados. A UI não chama nenhum deles, e o último grava linhas de operações no log. |
| `app/__tests__/api/routesRequireAuth.test.ts` | Saem as 6 entradas correspondentes de `EXPECTED_HANDLERS` (GET/POST `/api/test`, GET `/api/v1/analytics/dashboard`, POST `/api/v1/import/upload`, GET/POST `/api/v1/trades`). |
| `app/lib/domain/tempo.ts` (novo) | Usa só `Intl`, sem dependência nova: `localToUtc(local, tz)`, `utcToLocal(utc, tz)`, `tradingDay(utc, janela \| tz)`, `inWindow(utc, {tz, startMin, endMin, weekdays})` e a máscara de dias. |
| `app/lib/domain/index.ts` (novo) | Reexporta. |
| `app/__tests__/domain/tempo.test.ts` (novo, `@jest-environment node`) | Nova York: 8/3/2026, quando 02:30 não existe, e 1/11/2026, quando 01:30 é ambíguo. Brasília sem horário de verão. Janela 20:00–02:00 contando no dia em que abriu. Máscara de dias da semana. Dia do pregão às 23:30 de Brasília. |

Verificação local antes do PR: `cd app && npx jest --ci`. O `npm run type-check` grava `tsconfig.tsbuildinfo`, porque o `tsconfig` tem `incremental: true`; no CI, use `tsc --noEmit`.

### Segundo PR, "Moldura" (Fase 0)

| Arquivo | Mudança |
|---|---|
| `app/styles/hub.css` (novo) | Tokens das pranchas (`--bg`, `--surface`, `--inset`, `--track`, `--border`, `--mint*`, `--red*` com `#FFCCCC`, `--amber*`, `--blue`, `--ai*`, `--neutral*`, `--mono`) sob `.hub[data-tema="claro"]` (`--bg #505050`) e `.hub[data-tema="escuro"]` (`--bg #17191A`). Escopo só `.hub`. |
| `app/tailwind.config.js` | Só acrescenta as cores `hub-*` → `var(--…)`. Nenhuma chave existente muda. |
| `app/app/(hub)/layout.tsx` (novo) | `ProtectedRoute`, `HubGate`, `AppShell`, e um script inline mínimo que aplica o `data-tema` salvo antes de pintar. |
| `app/app/(hub)/diario/page.tsx` (novo) | Página vazia: "O Diário chega na Fase 4". |
| `app/components/hub/AppShell.tsx`, `HubHeader.tsx`, `ThemeSwitch.tsx`, `HubGate.tsx` (novos) | Cabeçalho estático e menu Início · Diário · Análises · Mercado · Social · AI · Conquistas. Os três últimos ficam "em breve", sem link. Menu de celular abaixo de 640 px. |
| `app/lib/hub/tema.ts` (novo) | Lê e grava o tema em `localStorage` com try/catch. A partir da Fase 1, usa `profiles.preferences`. |
| `app/lib/apiAuth.ts` | `requireHubUser(user)` no mesmo padrão de `denyPaidAi`, lendo `HUB_USERS`. |
| `app/app/api/hub/acesso/route.ts` (novo) | `GET`: `requireUser` e depois `requireHubUser`. Entra em `EXPECTED_HANDLERS`. |
| `app/.env.example` | Entra o nome `HUB_USERS`, sem valor. |
| Testes (novos) | `__tests__/components/hub/ThemeSwitch.test.tsx`, `AppShell.test.tsx` (itens do menu, "em breve", `data-tema`) e casos novos em `__tests__/lib/apiAuth.test.ts`. |

As páginas antigas, o `globals.css`, o idioma padrão do app e o teste fixado em inglês ficam como estão.

## D. Lista de testes

**Unitários (Jest)**

- **`domain/tempo`**
  - Horário de verão.
  - Janelas que passam da meia-noite.
  - Dia do pregão.
  - Paridade com o Postgres: os resultados esperados vêm de consultas `AT TIME ZONE` no projeto de teste e ficam gravados no teste.
- **`domain/import`**
  - Ebinex e Top One com fixtures inventadas, sob os cabeçalhos reais.
  - SL, TP e comissão.
  - Saída e payout da Ebinex.
  - REFUNDED.
  - Linhas com erro, reportadas só pelo número.
  - Snapshot da saída de hoje dos leitores antigos, gravado antes da refatoração, para que o caminho antigo receba linhas idênticas.
- **`domain/gate` e `domain/plano`**
  - Tabela-verdade: janela × bloqueio × limite × escolha por estado × direção.
  - "Não avaliado" é diferente de "ok".
- **`domain/metricas`**
  - Resultados esperados gerados por `analises_enxuto/gerar26.py`.
  - Fator de lucro bruto, payoff, acerto só sobre as decididas, expectativa e R:R.
  - Esmaecimento com 30 decididas e 15 pregões.
  - Faixas de US$ 50.
- **`domain/evidencia`**
  - O mesmo PRNG semeado portado para o Python e para o TS.
  - `padroes_out.json` regenerado com ele, exigindo níveis idênticos.
  - Benchmark com 1.500 e 10.000 operações inventadas.
- **`domain/estado`** (Fase 5)
  - Placares e estados: Alinhadas, Só a técnica, Só os fundamentos, Em conflito, Sem direção e Provisório.
- **`domain/aiCheck`** (Fase 8)
  - Os números batem com os da página.
  - Palavras proibidas.
  - A IA nunca define nível nem voto.
  - Uma nova tentativa e, depois, "indisponível".
- **Rotas**
  - Toda rota nova entra em `routesRequireAuth.test.ts`.
  - Rotas de cron ficam fixadas com a checagem de `CRON_SECRET`.

**Banco**, no projeto de teste e não em Docker local. Há 5,9 GB livres hoje, e o Mac já ficou sem espaço. Rodar com pgTAP (`supabase test db --db-url`) depende do seu OK.

- **Políticas entre dois usuários:** A não lê nem marca nada de B, e as FKs compostas recusam um pai alheio.
- **Horários forçados:** `marked_at`, `registered_at` e `exit_registered_at` recebem `now()` e ficam congelados.
- **Tabelas só de acréscimo:** `trade_marks`, `account_rule_versions` e `bias_marks` recusam UPDATE e DELETE.
- **Imagens:** a 5ª imagem é recusada; o bucket recusa 11 MB e GIF; a pasta de outro usuário é recusada.
- **Migração:**
  - o backfill M1/M2 sobre dados antigos semeados deixa os totais por `market_type` iguais;
  - a ponte preenche `account_id` nas gravações das telas antigas.
- **Importação:**
  - commit, reimportação (zero inseridas) e "arquivo já importado";
  - arquivo com várias contas;
  - undo com e sem cascata;
  - `import_fix_tz` rodando duas vezes sem efeito.
- **Pregão e permissões:** o `max_rows` não corta `diario_mes` e `analises`, e o UPDATE de colunas do servidor é recusado.

**Ponta a ponta.** Usa Playwright, só com o seu OK, porque é uma dependência nova. Roda em localhost com um usuário de teste semeado:
1. entrar;
2. criar a conta e as regras;
3. importar um arquivo inventado;
4. registrar com imagem;
5. ver o Diário e as Análises nos dois temas e em 375 px.

**Ensaio da Fase 0.** Roda fora do repositório, com um script no scratchpad executado com `python3 -I`. Lê os 4 arquivos de `docs/csv` e imprime só totais por arquivo:
- linhas e duplicatas;
- bruto e líquido;
- operações que mudam de dia em cada fuso candidato;
- distribuição por hora, para inferir o fuso da Top One;
- perdas com Resultado positivo.

## E. Escolhas de ordem e por quê

- **Contas e regras antes de registrar.** As regras (Fase 2) vêm antes do Registrar (Fase 3), para que a primeira operação ao vivo já tenha versão de regra e "desde".
- **O estado do mercado (Fase 5) vem depois do Diário (Fase 4).** O diário não depende do Yahoo nem de agendador. O custo são cerca de 2 semanas de operações sem "o que a tela dizia". O retrabalho no Diário (linha do tempo) está orçado em cerca de 2 dias dentro da Fase 5, e a tela diz o que falta.
- **IA por último.** Depende de três decisões suas (agendador, modelo, orçamento) e da licença de dados. O ensaio de custo e de recusas vem antes de ligar o despachante.
- **Acesso por lista no servidor (`HUB_USERS`), e não por flag pública.** O cadastro está aberto, e o Yahoo e a IA não podem chegar a terceiros.
