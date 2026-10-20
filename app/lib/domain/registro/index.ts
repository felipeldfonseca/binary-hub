/**
 * «Registrar operação» (Phase 3): the same rules as the database's Registrar functions
 * (supabase/migrations/20261020000001..4, descriptors as of 20261022000001), for the form's checks and previews. Pure: depends only
 * on ../tempo, ../markets and the standard library; time is an input (the server's clock).
 *
 *   caps       TRADE_CAPS / INSTRUMENT_SPEC (= trade_caps_all() / instrument_specs()),
 *              tradeMatchKey, tradeInstrument, a binary platform's durations and expiry rule
 *   catalogo   the instruments «Buscar ativo» offers per market (the approved 2b catalogs, codes
 *              only); the B3 stock rows of INSTRUMENT_SPEC are built from it
 *   payload    the JSON v1 payloads, checkPayload / checkMarks / parseEntry, the codes
 *   stops      stop and target: unit ↔ price level
 *   pnl        the result per market and its basis, R, the entry preview (and its risk)
 *   limite     the risk against what is left of the daily loss limit («o stop passa do limite
 *              diário»: a warning, never a block)
 *   horario    the entry, exit and «Já fechada» instants, the binary expiry, «Desfazer entrada»
 *   marcas     resultKnownAt, isClean («limpa»), marksNow, entryPlanOf (the plan of a stored context)
 *   match      the import's one-to-one link of file rows to app trades, what a link writes,
 *              similar imports
 *   validar    a whole register_* check in the database's order
 *   montar     the payloads from the form's values
 *   numeric    Postgres numeric arithmetic (scales, rounding, division)
 *
 * The pt-BR words and the number reader live outside lib/domain (lib/hub).
 */
export {
  INSTRUMENT_SPEC,
  TRADE_CAPS,
  durationsOf,
  expiryRuleOf,
  instrumentJson,
  instrumentRowJson,
  instrumentSpecsJson,
  platformKey,
  tradeCapsJson,
  tradeInstrument,
  tradeMatchKey,
  type Direction,
  type ExpiryRule,
  type InstrumentRow,
  type InstrumentSpec,
  type OptionCaps,
  type OptionContract,
  type OptionMode,
  type PnlMode,
  type StopUnit,
  type TradeCaps,
} from './caps';
export {
  ACOES_B3,
  ACOES_EUA,
  ALIASES_B3,
  B3_FUTUROS,
  CATALOGO,
  CATALOGO_REVISTO,
  CRIPTO_CATALOGO,
  FOREX_CATALOGO,
  FUTUROS_CATALOGO,
  INDICES_OPCOES,
} from './catalogo';
export {
  CLOCKS,
  IMAGE_MIMES,
  MARK_KINDS,
  MARK_VALUES,
  MAX_IMAGES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_NAME,
  MAX_MARKS,
  MAX_NOTE,
  MAX_PAYLOAD_BYTES,
  OUTCOMES,
  REGISTRO_CODES,
  checkMarks,
  checkPayload,
  jsonbTextBytes,
  parseEntry,
  tradeTryDate,
  type AfterPayload,
  type Checked,
  type Clock,
  type EntryPayload,
  type ExitPayload,
  type ExtrasPayload,
  type FieldError,
  type ImageMime,
  type ImageSlotsRequest,
  type MarkKind,
  type MarkValue,
  type Marks,
  type MarksPayload,
  type Outcome,
  type ParsedEntry,
  type PayloadMode,
  type RegistroCode,
} from './payload';
export { stopDistance, stopLevel, stopLevels, type Side } from './stops';
export {
  PNL_BASES,
  binaryResult,
  entryPreview,
  parseExit,
  pnlFor,
  pnlFromPrices,
  rMultiple,
  resultOf,
  typedPnl,
  type EntryPreview,
  type ExitResult,
  type PnlBasis,
  type PnlInput,
  type TradeResult,
} from './pnl';
export {
  dayLimitOf,
  limitRoom,
  riskBeyondLimit,
  type DayLimit,
  type GateLimitCents,
  type LimitRoom,
  type LimitWarning,
} from './limite';
export {
  ENTRY_TYPED_BACK_MS,
  UNDO_ENTRY_MS,
  afterInstants,
  binaryExpiry,
  entryInstant,
  exitInstant,
  isExpired,
  optionExpiredAt,
  undoRefusal,
  undoUntil,
  type AfterInput,
  type UndoTrade,
} from './horario';
export {
  cleanUntil,
  entryPlanOf,
  isClean,
  marksNow,
  resultKnownAt,
  type EntryBreak,
  type EntryCheck,
  type EntryOrigin,
  type MarkEvent,
  type MarkNow,
  type MarkTiming,
} from './marcas';
export {
  LINK_CLOSED_COLUMNS,
  LINK_MONEY_COLUMNS,
  MATCH_AFTER_MS,
  MATCH_BEFORE_MS,
  MATCH_BEFORE_RECONSTRUCTED_MS,
  assignImportLinks,
  canLink,
  linkPatch,
  similarImports,
  type ImportedTrade,
  type LinkDiffColumn,
  type LinkMoneyColumn,
  type LinkPatch,
  type LinkRow,
  type LinkSet,
  type LinkTrade,
  type LinkValues,
  type MatchRow,
  type MatchTrade,
} from './match';
export { validateAfter, validateEntry, validateExit, type AfterOptions, type EntryOptions, type OpenTrade } from './validar';
export {
  afterPayload,
  entryPayload,
  exitPayload,
  extrasPayload,
  imageName,
  imageSlotsRequest,
  marksPayload,
  type AfterFields,
  type EntryFields,
  type ExitFields,
} from './montar';
export { decimalFromJson, numericText, parseNumeric, plainText, tradeNum, type Numeric } from './numeric';
