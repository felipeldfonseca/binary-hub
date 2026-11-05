/**
 * The Diário (Phase 4): the calendar, the open day's numbers and the review, from the database's
 * reads (diario_calendario, diario_mes, diario_dia; save_day_review writes). Pure: depends only on
 * ../tempo, ../markets, ../gate (types) and ../registro/numeric; «today» is the account's trading
 * day as the database answers it, never the device's date.
 *
 *   tipos       the parsed answers (days, weeks, facts, review, «Antes de operar»)
 *   calendario  the month grid (Seg–Sex, Sáb and Dom when the account trades on weekends), the
 *               «Semana» column and card, the colour levels (quartiles, history apart)
 *   revisao     days due a review, the week's «Revisões», the saved versions, «o dia mudou»
 *   fatos       the day's tiles (net, gross in the ⓘ), «Antes de operar» against the first entry
 *
 * The pt-BR words live outside lib/domain (lib/hub/diario).
 */
export * from './tipos';
export {
  EVERY_DAY_MARKETS,
  addMonths,
  calendarMonths,
  dayMoney,
  hasTrades,
  heatLevels,
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
