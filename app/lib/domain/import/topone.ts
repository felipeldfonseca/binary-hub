/**
 * Top One futures export.
 *
 * Columns: Ticket #, Symbol, Side, SL, TP, Open Time, Open Price, Close Time, Close Price,
 * Duration, PnL, Lots, Commissions, Gain. Times are the UTC wall clock (DD/MM). `PnL` is the
 * gross price P&L and decides the result; `Commissions` is kept apart, rounded to cents.
 * `Gain` (% of the account) is not stored, and `Duration` is only a sanity check.
 */
import { parseBrDateTime, secondsBetween } from './clock';
import { RowCollector, isValidExternalId, isValidSymbol, issue } from './collect';
import type { CsvRecord } from './csv';
import {
  MONEY_DIGITS,
  PRICE_DIGITS,
  fromUnits,
  integerDigits,
  parseNum,
  signOf,
  toDecimal,
  toUnits,
} from './decimal';
import type {
  Decimal,
  ImportRow,
  LocalStamp,
  Notice,
  PlatformParse,
  RowIssue,
  RowWarningCode,
  TopOneColumn,
  TopOneIndex,
} from './types';

const ZERO = BigInt(0);
const DURATION = /^(?:(\d+)\s*h\s*)?(?:(\d+)\s*m\s*)?(?:(\d+)\s*s)?$/i;

/** 'Xh Ym Zs', 'Ym Zs', 'Zs' → seconds; null when unreadable or empty. */
function parseDuration(text: string): number | null {
  const m = DURATION.exec(text);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/** A price level: '' or 0 → null (not set); otherwise as written, up to 8 decimals; unusable → 'bad'. */
function level(text: string): Decimal | null | 'bad' {
  if (!text) return null;
  const n = parseNum(text);
  if (!n || n.sign || n.scale > PRICE_DIGITS.scale) return 'bad';
  if (n.units === ZERO) return null;
  const d = toDecimal(n, n.scale);
  return integerDigits(d) > PRICE_DIGITS.int ? 'bad' : d;
}

export function parseTopOneRecords(records: CsvRecord[], index: TopOneIndex, width: number): PlatformParse {
  const out = new RowCollector();
  let grossCents = ZERO;
  let commissionCents = ZERO;
  let anyCommission = false;
  let anyStop = false;

  for (const rec of records) {
    const line = rec.line;
    if (rec.cells.length !== width) {
      out.error(line, 'column_count');
      continue;
    }
    const cell = (c: TopOneColumn) => rec.cells[index[c]].trim();
    const warnings: RowIssue<RowWarningCode>[] = [];
    const warn = (code: RowWarningCode, column?: TopOneColumn) => warnings.push(issue(line, code, column));

    const ticket = cell('Ticket #');
    if (!ticket) {
      out.error(line, 'missing_id');
      continue;
    }
    if (!isValidExternalId(ticket)) {
      out.error(line, 'bad_id');
      continue;
    }

    const symbol = cell('Symbol');
    if (!isValidSymbol(symbol)) {
      out.error(line, 'missing_symbol');
      continue;
    }

    const side = cell('Side').toUpperCase();
    const direction = side === 'BUY' ? 'long' : side === 'SELL' ? 'short' : null;
    if (!direction) {
      out.error(line, 'bad_direction');
      continue;
    }

    const openText = cell('Open Time');
    if (!openText) {
      out.error(line, 'missing_date');
      continue;
    }
    const open = parseBrDateTime(openText);
    if (!open) {
      out.error(line, 'bad_date', 'Open Time');
      continue;
    }

    const pnlN = parseNum(cell('PnL'));
    const pnl = pnlN ? toDecimal(pnlN, MONEY_DIGITS.scale) : null;
    if (!pnlN || !pnl || integerDigits(pnl) > MONEY_DIGITS.int) {
      out.error(line, 'bad_number', 'PnL');
      continue;
    }

    const lots = parseNum(cell('Lots'));
    const quantity = lots && !lots.sign && lots.scale <= PRICE_DIGITS.scale ? toDecimal(lots, lots.scale) : null;
    if (!lots || !quantity || lots.units === ZERO || integerDigits(quantity) > PRICE_DIGITS.int) {
      out.error(line, 'bad_quantity');
      continue;
    }

    let commission: Decimal | null = null;
    const commissionText = cell('Commissions');
    if (commissionText) {
      const c = parseNum(commissionText);
      commission = c && signOf(c) >= 0 ? toDecimal({ ...c, neg: false }, MONEY_DIGITS.scale) : null;
      if (!c || !commission || integerDigits(commission) > MONEY_DIGITS.int) {
        out.error(line, 'bad_number', 'Commissions');
        continue;
      }
    }

    const sl = level(cell('SL'));
    if (sl === 'bad') {
      out.error(line, 'bad_number', 'SL');
      continue;
    }
    const tp = level(cell('TP'));
    if (tp === 'bad') {
      out.error(line, 'bad_number', 'TP');
      continue;
    }
    const openPrice = level(cell('Open Price'));
    if (openPrice === 'bad') {
      out.error(line, 'bad_number', 'Open Price');
      continue;
    }
    const closePrice = level(cell('Close Price'));
    if (closePrice === 'bad') {
      out.error(line, 'bad_number', 'Close Price');
      continue;
    }
    if (openPrice === null) warn('missing_price', 'Open Price');

    let exit: LocalStamp | null = null;
    const closeText = cell('Close Time');
    if (!closeText) warn('missing_exit');
    else {
      const close = parseBrDateTime(closeText);
      if (!close) warn('bad_exit_time');
      else {
        const span = secondsBetween(open.local, close.local);
        if (span < 0) warn('exit_before_entry');
        else {
          exit = close.local;
          // Duration is truncated to the second, so it may be 1 s short of Close − Open
          const duration = parseDuration(cell('Duration'));
          if (duration !== null && Math.abs(duration - span) > 1) warn('duration_mismatch');
        }
      }
    }

    const slash = ticket.indexOf('/');
    if (slash >= 0 && ticket.slice(0, slash) !== symbol) warn('ticket_symbol_mismatch');

    const pnlUnits = toUnits(pnlN, MONEY_DIGITS.scale);
    const row: ImportRow = {
      line,
      external_id: ticket,
      symbol,
      asset_type: 'futures',
      direction,
      local_entry: open.local,
      local_exit: exit,
      utc_offset: null,
      entry_price: openPrice,
      exit_price: closePrice,
      quantity,
      stake_amount: null,
      payout_percent: null,
      duration_seconds: null,
      timeframe: null,
      // Gross PnL decides, as the broker (and the legacy rows) do
      result: pnlUnits > ZERO ? 'win' : pnlUnits < ZERO ? 'loss' : 'breakeven',
      pnl,
      commission,
      stop_price: sl,
      target_price: tp,
    };
    if (!out.accept(row, warnings)) continue;

    grossCents += pnlUnits;
    if (commission !== null) {
      anyCommission = true;
      commissionCents += toUnits(parseNum(commission)!, MONEY_DIGITS.scale);
    }
    if (sl !== null || tp !== null) anyStop = true;
  }

  const notices: Notice[] = [];
  if (anyCommission) {
    notices.push({
      code: 'commission_in_file',
      gross: toDecimal(fromUnits(grossCents, 2), 2),
      commission: toDecimal(fromUnits(commissionCents, 2), 2),
    });
  }
  if (out.rows.length > 0 && !anyStop) notices.push({ code: 'sl_tp_empty' });
  return { rows: out.rows, errors: out.errors, warnings: out.warnings, notices };
}
