/**
 * The Diário (Phase 4): the calendar, the open day's numbers and the review, from the database's
 * reads (diario_calendario, diario_mes, diario_dia; save_day_review writes). Pure: depends only on
 * ../tempo, ../markets, ../gate (types) and ../registro/numeric; «today» is the account's trading
 * day as the database answers it, never the device's date.
 *
 *   tipos       the parsed answers (days, weeks, facts, review, «Antes de operar»)
 *   payload     «Salvar revisão» and «Antes de operar»: the payloads and the twin of their SQL checks
 *   calendario  the month grid (Seg–Sex, Sáb and Dom when the account trades on weekends), the
 *               «Semana» column and card, the colour levels (quartiles, history apart)
 *   revisao     days due a review, the week's «Revisões», the saved versions, «o dia mudou»,
 *               «Do pregão anterior» (carry_in's rule)
 *   fatos       the day's tiles (net, gross in the ⓘ), «Antes de operar» against the first entry
 *
 * The pt-BR words live outside lib/domain (lib/hub/diario).
 */
export * from './tipos';
export {
  EVERY_DAY_MARKETS,
  addMonths,
  calendarMonths,
  dayKindOf,
  dayMoney,
  hasTrades,
  heatLevels,
  isHistoryEntry,
  isWeekClosed,
  monthBounds,
  monthColumns,
  monthGrid,
  monthOf,
  monthRange,
  quartiles,
  weekCard,
  weekColumns,
  weekOf,
  type GridCell,
  type GridWeek,
  type HeatLevel,
  type MonthGrid,
  type MonthGridInput,
  type WeekBar,
  type WeekCard,
} from './calendario';
export {
  RECENT_REVIEW_DAYS,
  carryInOf,
  dayChanged,
  isPendingReview,
  pendingReviews,
  previousVersions,
  reviewTimes,
  showsNoReview,
  weekReviews,
  type FactsCore,
} from './revisao';
export {
  FOLLOWED,
  NOTE_PAYLOAD_MAX_BYTES,
  NOTE_TEXT_MAX,
  REVIEW_FIELDS_MAX,
  REVIEW_PAYLOAD_MAX_BYTES,
  checkNotePayload,
  checkReviewPayload,
  cleanText,
  codePoints,
  diarioText,
  jsonbText,
  jsonbTextBytes,
  notePayload,
  noteValue,
  reviewFormTooLong,
  reviewPayload,
  reviewValues,
  type DiarioPayloadCode,
  type DiarioPayloadField,
  type NotePayloadV1,
  type PayloadProblem,
  type ReviewForm,
  type ReviewPayloadV1,
  type ReviewValues,
} from './payload';
export {
  COMMISSION_FROM_FILE,
  dayTiles,
  firstEntryAt,
  historyTiles,
  limitPercent,
  noteTimes,
  tilesFromCalendar,
  toneOf,
  type DayTiles,
  type LimitTile,
  type NoteTime,
  type Tone,
} from './fatos';
