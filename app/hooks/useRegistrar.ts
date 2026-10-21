'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useHubDb } from '@/hooks/useContas';
import { regrasKeys } from '@/hooks/useRegras';
import { useAgora } from '@/hooks/useAgora';
import type { AccountMarket } from '@/lib/domain/markets';
import type { LimitCheck } from '@/lib/domain/gate';
import type { AfterPayload, EntryPayload, ExitPayload, Marks, MovePayload, PartialPayload, UndoEventPayload } from '@/lib/domain/registro';
import { marksPayload } from '@/lib/domain/registro';
import type { AccountNow, RulesNow } from '@/lib/hub/regras';
import { fetchRulesNow } from '@/lib/hub/regrasDb';
import { inicioDoDia, padroesDoRegistrar, type RegistrarDefaults } from '@/lib/hub/registrar';
import {
  RegistrarDataError,
  addMarks,
  drainImageTrash,
  fetchDayTrades,
  fetchGateAt,
  fetchOpenTrades,
  fetchRecentTrades,
  fetchTradeEvents,
  fetchTradeState,
  moveStop,
  previewAfter,
  previewEntry,
  previewExit,
  registerAfter,
  registerEntry,
  registerExit,
  registerPartial,
  undoEntry,
  undoEvent,
  type AfterDryRun,
  type AfterRegistered,
  type DayTrade,
  type EntryDryRun,
  type EventUndone,
  type ExitDryRun,
  type ExitRegistered,
  type MoveRegistered,
  type PartialRegistered,
  type Registered,
  type RegisteredTrade,
  type TradeEvents,
  type TradeState,
  type TradeView,
} from '@/lib/hub/registrarDb';
import { saveImagesAndNote, type SaveImagesInput, type SaveImagesResult, type SaveProgress } from '@/lib/hub/registrarImagens';
import { newestClock, serverClockOf, type ServerClock } from '@/lib/hub/relogio';

/**
 * «Registrar operação» in React Query (PR 3-3's shared layer). Every key sits under ['hub', uid],
 * so Phase 1's useRefreshAfterWrite (an import commit or undo links and unlinks app trades)
 * refreshes these too.
 */
export const registrarKeys = {
  all: (uid: string | undefined) => ['hub', uid, 'registrar'] as const,
  /** «Operações abertas» of one account (or every account: 'todas') */
  abertas: (uid: string | undefined, accountId: string | null) => ['hub', uid, 'registrar', 'abertas', accountId ?? 'todas'] as const,
  /** «Operações do dia» of one account on one trading day */
  dia: (uid: string | undefined, accountId: string, day: string) => ['hub', uid, 'registrar', 'dia', accountId, day] as const,
  /** One trade as the sheet shows it (fetchTradeState, or the last write's answer) */
  operacao: (uid: string | undefined, tradeId: string) => ['hub', uid, 'registrar', 'operacao', tradeId] as const,
  /** The account's recent trades → the form's starting values */
  recentes: (uid: string | undefined, accountId: string) => ['hub', uid, 'registrar', 'recentes', accountId] as const,
  /**
   * A dry run: 'entrada' (register_entry), 'saida' (register_exit), 'fechada' (register_after); or
   * 'gate' (gate_at at a typed instant: the payload is the instant)
   */
  previa: (uid: string | undefined, kind: 'entrada' | 'saida' | 'fechada' | 'gate', target: string, payload: string) =>
    ['hub', uid, 'registrar', 'previa', kind, target, payload] as const,
  /** The server's clock offset from the last Registrar answer */
  relogio: (uid: string | undefined) => ['hub', uid, 'registrar', 'relogio'] as const,
  /** Phase 3c: the exits and stop moves of the listed trades (`ids`: sorted, joined by ',') */
  eventos: (uid: string | undefined, ids: string) => ['hub', uid, 'registrar', 'eventos', ids] as const,
};

/** The prefixes a write makes stale */
const prefix = {
  abertas: (uid: string | undefined) => ['hub', uid, 'registrar', 'abertas'] as const,
  dia: (uid: string | undefined) => ['hub', uid, 'registrar', 'dia'] as const,
  recentes: (uid: string | undefined) => ['hub', uid, 'registrar', 'recentes'] as const,
  previa: (uid: string | undefined) => ['hub', uid, 'registrar', 'previa'] as const,
  atividade: (uid: string | undefined) => ['hub', uid, 'atividade'] as const,
  eventos: (uid: string | undefined) => ['hub', uid, 'registrar', 'eventos'] as const,
};

/** What each write changes, besides the trade's own entry (set from the answer) */
export type RegistrarWrite = 'entrada' | 'saida' | 'fechada' | 'desfazer' | 'marcas' | 'extras' | 'parcial' | 'stop' | 'evento';

/**
 * The caches each write makes stale (contract §2.3). rules_now: the day's net and «Encerrado por
 * hoje» (an open trade never counts, but its answer's per-account `today` is refreshed with the
 * rest); atividade: «{n} op. desde então» and Suas contas' counts; the old pages' trade lists
 * ['trades'] and ['trade-stats'] (/trades and the dashboard read the same rows). rules_config is
 * never made stale by a trade: rules_config() reads no trade.
 */
export const REGISTRAR_INVALIDATIONS: Readonly<
  Record<RegistrarWrite, readonly ('abertas' | 'dia' | 'eventos' | 'recentes' | 'previa' | 'regrasAgora' | 'atividade' | 'paginasAntigas')[]>
> = {
  entrada: ['abertas', 'dia', 'recentes', 'previa', 'regrasAgora', 'atividade', 'paginasAntigas'],
  saida: ['abertas', 'dia', 'eventos', 'previa', 'regrasAgora', 'paginasAntigas'],
  fechada: ['dia', 'eventos', 'recentes', 'previa', 'regrasAgora', 'atividade', 'paginasAntigas'],
  desfazer: ['abertas', 'dia', 'eventos', 'recentes', 'previa', 'regrasAgora', 'atividade', 'paginasAntigas'],
  marcas: [],
  extras: ['dia'],
  // Phase 3c: a partial counts on the day's limit at its minute; a move changes no money; an undone
  // partial leaves it (the bridge's second line and the chooser's «… em aberto» read 'eventos')
  parcial: ['abertas', 'dia', 'eventos', 'previa', 'regrasAgora'],
  stop: ['dia', 'eventos', 'previa'],
  evento: ['abertas', 'dia', 'eventos', 'previa', 'regrasAgora'],
};

/**
 * Marks those caches stale and reads the ones on screen again, except the dry runs: they are only
 * marked stale (read again when their form asks for them), so the dry run still on screen is never
 * asked once more about the trade the write just changed (an exit's own dry run would then answer
 * `repeated`, which reads as «Esta operação já foi fechada em outro lugar.»).
 */
export function invalidateAfterRegistrar(queryClient: QueryClient, uid: string | undefined, write: RegistrarWrite): Promise<unknown> {
  const filters = REGISTRAR_INVALIDATIONS[write].flatMap((k): { queryKey: unknown[]; refetchType?: 'none' }[] => {
    switch (k) {
      case 'abertas':
        return [{ queryKey: [...prefix.abertas(uid)] }];
      case 'dia':
        return [{ queryKey: [...prefix.dia(uid)] }];
      case 'eventos':
        return [{ queryKey: [...prefix.eventos(uid)] }];
      case 'recentes':
        return [{ queryKey: [...prefix.recentes(uid)] }];
      case 'previa':
        return [{ queryKey: [...prefix.previa(uid)], refetchType: 'none' }];
      case 'regrasAgora':
        return [{ queryKey: [...regrasKeys.agora(uid)] }];
      case 'atividade':
        return [{ queryKey: [...prefix.atividade(uid)] }];
      case 'paginasAntigas':
        return [{ queryKey: ['trades'] }, { queryKey: ['trade-stats'] }];
    }
  });
  return Promise.all(filters.map((f) => queryClient.invalidateQueries(f)));
}

// ---------------------------------------------------------------------------------------------
// The server's clock
// ---------------------------------------------------------------------------------------------

/** Keeps the offset of an answer's server_now (the newest answer wins) */
export function recordServerNow(queryClient: QueryClient, uid: string | undefined, serverNow: Date, receivedAt: number = Date.now()): void {
  const next = serverClockOf(serverNow, receivedAt);
  queryClient.setQueryData<ServerClock>(registrarKeys.relogio(uid), (prev) => newestClock(prev, next) ?? next);
}

/**
 * The server's clock offset, from the newest answer that carried server_now: the cached rules_now
 * (the card's and the sheet's) or any Registrar answer. Null before any answer (the device clock).
 */
export function useServerClock(): ServerClock | null {
  const { db, userId } = useHubDb();
  const queryClient = useQueryClient();
  // Written by recordServerNow; never fetched (its "fetch" keeps what is there)
  const own = useQuery<ServerClock | null>({
    queryKey: registrarKeys.relogio(userId),
    queryFn: () => queryClient.getQueryData<ServerClock>(registrarKeys.relogio(userId)) ?? null,
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  // Observes the cached rules_now without asking for it (useRulesNow does that)
  const now = useQuery<RulesNow>({ queryKey: regrasKeys.agora(userId), queryFn: () => fetchRulesNow(db), enabled: false });
  const rulesClock = now.data && now.dataUpdatedAt ? serverClockOf(now.data.serverNow, now.dataUpdatedAt) : null;
  return newestClock(rulesClock, own.data ?? null);
}

/**
 * The server's now on the device, redrawn every `everyMs` aligned to the server's clock (60 000:
 * the minute turns with the server's): the hour fields' prefill, «Vence às …» → «Venceu às …»,
 * «Desfazer entrada» «Até 10:22». Before any answer, the device clock.
 */
export function useServerNow(everyMs = 1000): Date {
  const clock = useServerClock();
  return useAgora(everyMs, clock?.offsetMs ?? 0);
}

// ---------------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------------

/** «Operações abertas» of an account (null: every account), oldest entry first */
export function useOpenTrades(accountId: string | null, { enabled = true }: { enabled?: boolean } = {}) {
  const { db, userId } = useHubDb();
  return useQuery<RegisteredTrade[], RegistrarDataError>({
    queryKey: registrarKeys.abertas(userId, accountId),
    queryFn: () => fetchOpenTrades(db, accountId ?? undefined),
    enabled: !!userId && enabled,
    // Another device may have closed one
    refetchOnWindowFocus: 'always',
  });
}

/**
 * One trade as the sheet shows it. A write's answer replaces it at once (setTradeView); read again
 * on focus, so an exit registered on another device is seen («Esta operação já foi fechada em outro
 * lugar.»). Null data: the trade is gone (undone, or deleted on the old page).
 */
export function useTradeView(tradeId: string | null, { enabled = true }: { enabled?: boolean } = {}) {
  const { db, userId } = useHubDb();
  return useQuery<TradeView | null, RegistrarDataError>({
    queryKey: registrarKeys.operacao(userId, tradeId ?? ''),
    queryFn: () => fetchTradeState(db, tradeId as string),
    enabled: !!userId && !!tradeId && enabled,
    refetchOnWindowFocus: 'always',
  });
}

/** Puts a write's answer in the trade's cache entry (the sheet redraws from it) */
export function setTradeView(queryClient: QueryClient, uid: string | undefined, state: TradeState): void {
  const { serverNow: _now, ...view } = state;
  queryClient.setQueryData<TradeView | null>(registrarKeys.operacao(uid, state.trade.id), view);
}

/**
 * «Operações do dia» (the /diario bridge): `day` is the account's trading day today (diaDeHoje);
 * also the open trades of earlier days and those that closed today. Read again on focus.
 */
export function useDayTrades(
  account: { id: string; market: AccountMarket } | null,
  day: string | null,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { db, userId } = useHubDb();
  return useQuery<DayTrade[], RegistrarDataError>({
    queryKey: registrarKeys.dia(userId, account?.id ?? '', day ?? ''),
    queryFn: () => fetchDayTrades(db, (account as { id: string }).id, day as string, inicioDoDia(day as string, (account as { market: AccountMarket }).market)),
    enabled: !!userId && !!account && !!day && enabled,
    refetchOnWindowFocus: 'always',
  });
}

/**
 * Phase 3c: the exits and stop moves of the listed trades (the chooser's «2 ct em aberto», the
 * bridge's «1 parcial, +US$ 40,00 · stop no breakeven»), one read for the list; nothing asked for
 * without ids. Read again on focus, as the lists it completes.
 */
export function useTradeEvents(tradeIds: readonly string[] | null, { enabled = true }: { enabled?: boolean } = {}) {
  const { db, userId } = useHubDb();
  const ids = tradeIds ? Array.from(new Set(tradeIds)).sort() : [];
  const key = ids.join(',');
  return useQuery<Record<string, TradeEvents>, RegistrarDataError>({
    queryKey: registrarKeys.eventos(userId, key),
    queryFn: () => fetchTradeEvents(db, key.split(',')),
    enabled: !!userId && ids.length > 0 && enabled,
    refetchOnWindowFocus: 'always',
  });
}

/** The form's starting values of an account (D5, D6), from its last 200 trades */
export function useRegistrarDefaults(account: { id: string; market: AccountMarket } | null, { enabled = true }: { enabled?: boolean } = {}) {
  const { db, userId } = useHubDb();
  return useQuery<RegistrarDefaults, RegistrarDataError>({
    queryKey: registrarKeys.recentes(userId, account?.id ?? ''),
    queryFn: async () => padroesDoRegistrar((account as { market: AccountMarket }).market, await fetchRecentTrades(db, (account as { id: string }).id)),
    enabled: !!userId && !!account && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------------------------
// Dry runs (previews)
// ---------------------------------------------------------------------------------------------

/** How long a typed change waits before its dry run (registrar.md §5.1: 300 ms) */
export const PREVIEW_DEBOUNCE_MS = 300;

/** `value` after it stopped changing for `ms` (the first value at once) */
export function useDebounced<T>(value: T, ms = PREVIEW_DEBOUNCE_MS): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}

/** A payload as a stable key: keys sorted, client_key left out (a dry run does not need one) */
export function previewKey(payload: object): string {
  const sort = (x: unknown): unknown =>
    Array.isArray(x)
      ? x.map(sort)
      : x && typeof x === 'object'
        ? Object.fromEntries(
            Object.keys(x as Record<string, unknown>)
              .filter((k) => k !== 'client_key' && (x as Record<string, unknown>)[k] !== undefined)
              .sort()
              .map((k) => [k, sort((x as Record<string, unknown>)[k])]),
          )
        : x;
  return JSON.stringify(sort(payload));
}

/** A refusal is the answer (the form shows its field's error); only a lost request is asked again, once */
const retryNetwork = (count: number, error: RegistrarDataError) => error.code === 'network' && count < 1;

interface PreviewOptions {
  enabled?: boolean;
  debounceMs?: number;
}

/** The position of `target` (the account or the trade) in registrarKeys.previa */
const PREVIA_TARGET = 5;

/**
 * A dry run keyed by its text (previewKey): the text, not the payload object, is what waits for
 * the quiet, so a form that builds its payload on every render (the server clock ticks each
 * second) does not restart the wait and redraw every 300 ms. A null text (an incomplete form, the
 * hour back on the current minute) asks nothing and shows nothing at once: the last answer is kept
 * while the next one is asked only for the same account or trade, never for an incomplete form.
 *
 * The key is the text on screen at once; only the asking waits for the quiet. So `data` that is
 * not a placeholder always answers the text on screen: while a new text waits its 300 ms, the last
 * answer is a placeholder (another «Dia»'s gate is never this one's), and an error is the text's own.
 */
function usePreview<T>(
  kind: 'entrada' | 'saida' | 'fechada' | 'gate',
  target: string | null,
  text: string | null,
  ask: (db: ReturnType<typeof useHubDb>['db'], target: string, text: string) => Promise<T>,
  options: PreviewOptions,
) {
  const { db, userId } = useHubDb();
  const debounced = useDebounced(text, options.debounceMs);
  return useQuery<T, RegistrarDataError>({
    queryKey: registrarKeys.previa(userId, kind, target ?? '', text ?? ''),
    queryFn: () => ask(db, target as string, text as string),
    enabled: !!userId && !!target && text !== null && text === debounced && (options.enabled ?? true),
    placeholderData: text ? (previous, previousQuery) => (previousQuery?.queryKey[PREVIA_TARGET] === target ? previous : undefined) : undefined,
    retry: retryNetwork,
    staleTime: 15 * 1000,
  });
}

/**
 * «Posso operar hoje? Na entrada:» and the «Limite do dia» line at a typed hour or another «Dia»
 * (gate_at; C24): null `at` (the hour field on the current minute) asks nothing and has no data,
 * the card's rules_now answers it. Debounced like the dry runs.
 */
export function useGateAt(accountId: string | null, at: Date | null, options: PreviewOptions = {}) {
  return usePreview<AccountNow>('gate', accountId, at ? at.toISOString() : null, (db, id, iso) => fetchGateAt(db, id, new Date(iso)), options);
}

/**
 * register_entry's dry run for the form as it is (debounced): the gate and plan at the typed
 * hour, the instrument, the stop and target levels, the risk preview, «limit_room» («Se o stop for
 * atingido, o dia passa do limite…»), the binary expiry, `similar`. Null payload: nothing to ask
 * (incomplete form) and no data. The last answer of the same account stays while the next one is
 * asked.
 */
export function useEntryPreview(accountId: string | null, payload: EntryPayload | null, options: PreviewOptions = {}) {
  return usePreview<EntryDryRun>('entrada', accountId, payload ? previewKey(payload) : null, (db, id, text) => previewEntry(db, id, JSON.parse(text) as EntryPayload), options);
}

/** register_after's dry run («Já fechada»): the entry's preview and the exit's result */
export function useAfterPreview(accountId: string | null, payload: AfterPayload | null, options: PreviewOptions = {}) {
  return usePreview<AfterDryRun>('fechada', accountId, payload ? previewKey(payload) : null, (db, id, text) => previewAfter(db, id, JSON.parse(text) as AfterPayload), options);
}

/**
 * register_exit's dry run: the result the exit would get, or `repeated` (closed elsewhere). A
 * `repeated` answer after this sheet's own «Registrar saída» is not «fechada em outro lugar»: the
 * writes never ask a dry run again (REGISTRAR_INVALIDATIONS: previews are only marked stale).
 */
export function useExitPreview(tradeId: string | null, payload: ExitPayload | null, options: PreviewOptions = {}) {
  return usePreview<ExitDryRun>('saida', tradeId, payload ? previewKey(payload) : null, (db, id, text) => previewExit(db, id, JSON.parse(text) as ExitPayload), options);
}

// ---------------------------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------------------------

/**
 * Registering needs the server's clock: nothing is queued (D14). Offline, a write fails at once
 * with 'offline' («Sem conexão. Nada foi registrado: o horário vem do servidor. Tente de novo quando
 * a conexão voltar.») and the form keeps what was typed.
 */
export function assertOnline(): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new RegistrarDataError('offline');
}

/** The account's limit check in the cached rules_now (the state before an exit, for avisoDoLimite) */
export function limitBeforeOf(queryClient: QueryClient, uid: string | undefined, accountId: string): { tradingDay: string; limit: LimitCheck } | null {
  const now = queryClient.getQueryData<RulesNow>(regrasKeys.agora(uid));
  const account = now?.accounts.find((a) => a.accountId === accountId);
  return account ? { tradingDay: account.gate.tradingDay, limit: account.gate.limit } : null;
}

/** Every write: fails fast offline, never retried by React Query (a retry is the owner's tap, with the same client_key) */
const WRITE = { networkMode: 'always', retry: false } as const;

export interface EntryVariables {
  accountId: string;
  /** With its client_key (newClientKey, one per form, kept across retries) */
  payload: EntryPayload;
}

/** «Registrar entrada»: the trade, its context, plan and marks; a retried tap answers `repeated` */
export function useRegisterEntry() {
  const { db, userId } = useHubDb();
  const queryClient = useQueryClient();
  return useMutation<Registered, RegistrarDataError, EntryVariables>({
    ...WRITE,
    mutationFn: ({ accountId, payload }) => {
      assertOnline();
      return registerEntry(db, accountId, payload);
    },
    onSuccess: (answer) => {
      recordServerNow(queryClient, userId, answer.state.serverNow);
      setTradeView(queryClient, userId, answer.state);
      return invalidateAfterRegistrar(queryClient, userId, 'entrada');
    },
  });
}

export interface ExitVariables {
  tradeId: string;
  accountId: string;
  payload: ExitPayload;
}

/** register_exit's answer, and the account's limit before it (for the banner: avisoDoLimite) */
export type ExitDone = ExitRegistered & { limitBefore: { tradingDay: string; limit: LimitCheck } | null };

/** «Registrar saída» / «Registrar resultado» */
export function useRegisterExit() {
  const { db, userId } = useHubDb();
  const queryClient = useQueryClient();
  return useMutation<ExitDone, RegistrarDataError, ExitVariables>({
    ...WRITE,
    mutationFn: async ({ tradeId, accountId, payload }) => {
      assertOnline();
      const limitBefore = limitBeforeOf(queryClient, userId, accountId);
      return { ...(await registerExit(db, tradeId, payload)), limitBefore };
    },
    onSuccess: (answer) => {
      recordServerNow(queryClient, userId, answer.state.serverNow);
      setTradeView(queryClient, userId, answer.state);
      return invalidateAfterRegistrar(queryClient, userId, 'saida');
    },
  });
}

export interface AfterVariables {
  accountId: string;
  payload: AfterPayload;
}

export type AfterDone = AfterRegistered & { limitBefore: { tradingDay: string; limit: LimitCheck } | null };

/** «Registrar operação» in «Já fechada»: entry and exit in one call */
export function useRegisterAfter() {
  const { db, userId } = useHubDb();
  const queryClient = useQueryClient();
  return useMutation<AfterDone, RegistrarDataError, AfterVariables>({
    ...WRITE,
    mutationFn: async ({ accountId, payload }) => {
      assertOnline();
      const limitBefore = limitBeforeOf(queryClient, userId, accountId);
      return { ...(await registerAfter(db, accountId, payload)), limitBefore };
    },
    onSuccess: (answer) => {
      recordServerNow(queryClient, userId, answer.state.serverNow);
      setTradeView(queryClient, userId, answer.state);
      return invalidateAfterRegistrar(queryClient, userId, 'fechada');
    },
  });
}

export interface PartialVariables {
  tradeId: string;
  accountId: string;
  /** With its client_key (one per partial, kept across retries, new after a success) */
  payload: PartialPayload;
}

/** register_partial's answer, and the account's limit before it (for the banner: avisoDoLimite) */
export type PartialDone = PartialRegistered & { limitBefore: { tradingDay: string; limit: LimitCheck } | null };

/** «Registrar parcial» (Phase 3c): a part of what is open leaves at a price and an hour */
export function useRegisterPartial() {
  const { db, userId } = useHubDb();
  const queryClient = useQueryClient();
  return useMutation<PartialDone, RegistrarDataError, PartialVariables>({
    ...WRITE,
    mutationFn: async ({ tradeId, accountId, payload }) => {
      assertOnline();
      const limitBefore = limitBeforeOf(queryClient, userId, accountId);
      return { ...(await registerPartial(db, tradeId, payload)), limitBefore };
    },
    onSuccess: (answer) => {
      recordServerNow(queryClient, userId, answer.state.serverNow);
      setTradeView(queryClient, userId, answer.state);
      return invalidateAfterRegistrar(queryClient, userId, 'parcial');
    },
  });
}

export interface MoveVariables {
  tradeId: string;
  /** With its client_key (one per move, kept across retries, new after a success) */
  payload: MovePayload;
}

/** «Registrar stop» (Phase 3c): the stop moves on the server's clock */
export function useMoveStop() {
  const { db, userId } = useHubDb();
  const queryClient = useQueryClient();
  return useMutation<MoveRegistered, RegistrarDataError, MoveVariables>({
    ...WRITE,
    mutationFn: ({ tradeId, payload }) => {
      assertOnline();
      return moveStop(db, tradeId, payload);
    },
    onSuccess: (answer) => {
      recordServerNow(queryClient, userId, answer.state.serverNow);
      setTradeView(queryClient, userId, answer.state);
      return invalidateAfterRegistrar(queryClient, userId, 'stop');
    },
  });
}

export interface UndoEventVariables {
  tradeId: string;
  accountId: string;
  payload: UndoEventPayload;
}

/**
 * undo_event's answer with the account's limit before it (the cached rules_now) and after it
 * (rules_now read again at once): «Com a parcial desfeita, o limite do dia volta a …»
 */
export type EventUndoneDone = EventUndone & {
  limitBefore: { tradingDay: string; limit: LimitCheck } | null;
  limitAfter: { tradingDay: string; limit: LimitCheck } | null;
};

/** The timeline's «Sim, desfazer» (Phase 3c): the newest partial or stop move, within 15 minutes */
export function useUndoEvent() {
  const { db, userId } = useHubDb();
  const queryClient = useQueryClient();
  return useMutation<EventUndoneDone, RegistrarDataError, UndoEventVariables>({
    ...WRITE,
    mutationFn: async ({ tradeId, accountId, payload }) => {
      assertOnline();
      const limitBefore = limitBeforeOf(queryClient, userId, accountId);
      const answer = await undoEvent(db, tradeId, payload);
      let limitAfter: EventUndoneDone['limitAfter'] = null;
      try {
        const now = await queryClient.fetchQuery<RulesNow>({ queryKey: regrasKeys.agora(userId), queryFn: () => fetchRulesNow(db), staleTime: 0 });
        const account = now.accounts.find((a) => a.accountId === accountId);
        limitAfter = account ? { tradingDay: account.gate.tradingDay, limit: account.gate.limit } : null;
      } catch {
        // Without the fresh limit, the line about it is left out
      }
      return { ...answer, limitBefore, limitAfter };
    },
    onSuccess: (answer) => {
      recordServerNow(queryClient, userId, answer.state.serverNow);
      setTradeView(queryClient, userId, answer.state);
      return invalidateAfterRegistrar(queryClient, userId, 'evento');
    },
  });
}

export interface MarksVariables {
  tradeId: string;
  /** One tap: { setup: 'A' }; null = «desmarcar» */
  marks: Marks;
}

/** One tap = one mark on the server's clock; the answer's state replaces the trade's */
export function useAddMarks() {
  const { db, userId } = useHubDb();
  const queryClient = useQueryClient();
  return useMutation<TradeState, RegistrarDataError, MarksVariables>({
    ...WRITE,
    mutationFn: ({ tradeId, marks }) => {
      assertOnline();
      return addMarks(db, tradeId, marksPayload(marks));
    },
    onSuccess: (state) => {
      recordServerNow(queryClient, userId, state.serverNow);
      setTradeView(queryClient, userId, state);
      return invalidateAfterRegistrar(queryClient, userId, 'marcas');
    },
  });
}

/** «Desfazer entrada»: the trade goes; its images (if any) leave Storage */
export function useUndoEntry() {
  const { db, userId } = useHubDb();
  const queryClient = useQueryClient();
  return useMutation<{ serverNow: Date; tradeId: string; trash: string[] }, RegistrarDataError, { tradeId: string }>({
    ...WRITE,
    mutationFn: async ({ tradeId }) => {
      assertOnline();
      const answer = await undoEntry(db, tradeId);
      if (answer.trash.length > 0) {
        try {
          await drainImageTrash(db, answer.trash);
        } catch {
          // The queue is emptied by the next sweep
        }
      }
      return answer;
    },
    onSuccess: (answer) => {
      recordServerNow(queryClient, userId, answer.serverNow);
      queryClient.setQueryData<TradeView | null>(registrarKeys.operacao(userId, answer.tradeId), null);
      return invalidateAfterRegistrar(queryClient, userId, 'desfazer');
    },
  });
}

export interface ExtrasVariables {
  tradeId: string;
  input: SaveImagesInput;
  /** «Enviando 1 de 2…» */
  onProgress?: (p: SaveProgress) => void;
}

/** «Salvar imagens e nota»: lib/hub/registrarImagens.saveImagesAndNote with the user's session */
export function useSaveImagesAndNote() {
  const { db, userId } = useHubDb();
  const queryClient = useQueryClient();
  return useMutation<SaveImagesResult, RegistrarDataError, ExtrasVariables>({
    ...WRITE,
    mutationFn: ({ tradeId, input, onProgress }) => {
      assertOnline();
      return saveImagesAndNote(db, tradeId, input, { onProgress });
    },
    onSuccess: (result) => {
      recordServerNow(queryClient, userId, result.state.serverNow);
      setTradeView(queryClient, userId, result.state);
      return invalidateAfterRegistrar(queryClient, userId, 'extras');
    },
  });
}

/**
 * Empties the image trash once per signed-in session when a Registrar screen mounts (the files of
 * removed images, expired reservations and deleted trades: SQL never deletes a Storage object).
 * Best effort: a failure waits for the next time.
 */
const swept = new WeakMap<QueryClient, Set<string>>();

export function useImageTrashSweep(enabled = true): void {
  const { db, userId } = useHubDb();
  const queryClient = useQueryClient();
  const started = useRef(false);
  useEffect(() => {
    if (!enabled || !userId || started.current) return;
    let done = swept.get(queryClient);
    if (!done) swept.set(queryClient, (done = new Set()));
    if (done.has(userId)) return;
    done.add(userId);
    started.current = true;
    void drainImageTrash(db).catch(() => {
      done?.delete(userId);
    });
  }, [enabled, userId, db, queryClient]);
}
