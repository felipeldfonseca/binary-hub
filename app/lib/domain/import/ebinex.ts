/**
 * Ebinex binary options export (both the current DD/MM format and the old ISO one).
 *
 * Columns: ID, Data, Ativo, Tempo, Previsão, Vela, P. ABRT, P. FECH, Valor, Estornado,
 * Executado, Status, Resultado.
 * - `Data`: when the order was placed. Current export: Brasília wall clock, no zone. Old export:
 *   ISO time with its offset.
 * - `Vela` (HH:MM, Brasília): when the candle the option runs on opens, the one after the order.
 *   `Tempo`: that candle's length (M1 = 60 s).
 * - `P. ABRT` / `P. FECH`: that candle's opening (strike) and settlement prices. `P. FECH` is
 *   empty on a cancelled refund.
 * - `Valor` = `Estornado` (returned without running) + `Executado` (what ran, the stake).
 * - `Resultado`: the change in balance (win = profit, lose = −stake, refunded = stake returned).
 *   Its sign comes from `Status`; a written sign is only checked.
 */
import { addSeconds, candleSeconds, floorMinute, parseBrDateTime, parseIsoDateTime, toLocalDateTime } from './clock';
import type { FileStamp } from './clock';
import { RowCollector, isValidExternalId, isValidSymbol, issue } from './collect';
import type { CsvRecord } from './csv';
import {
  MONEY_DIGITS,
  PAYOUT_DIGITS,
  PRICE_DIGITS,
  compareNum,
  fromUnits,
  integerDigits,
  parseNum,
  percent,
  toDecimal,
  toUnits,
  type Num,
} from './decimal';
import type {
  Decimal,
  EbinexColumn,
  EbinexIndex,
  ImportRow,
  LocalStamp,
  Notice,
  PlatformParse,
  RowIssue,
  RowWarningCode,
  UtcOffset,
} from './types';

const VELA = /^(\d{1,2}):(\d{2})$/;
const TIMEFRAME = /^[A-Za-z0-9]{1,8}$/;
const ZERO = BigInt(0);

/**
 * When an Ebinex option ends, on the clock of `entry.local`: the trade runs on the candle that
 * opens at `vela` and lasts `candle` seconds, so it ends at that opening + `candle`.
 *
 * `vela` is on the Brasília clock while ISO rows are on UTC; the two differ by whole hours, so
 * the candle is found by minute of the hour: the first `vela` minute after the entry's minute.
 * It must start within one candle of the entry, and on rows with no offset (same clock as
 * `vela`) the hour must match too. Otherwise null: the row does not fit "the next candle".
 */
export function ebinexExit(entry: FileStamp, vela: string, candle: number): LocalStamp | null {
  const v = VELA.exec(vela.trim());
  if (!v) return null;
  const vh = Number(v[1]);
  const vm = Number(v[2]);
  if (vh > 23 || vm > 59) return null;
  const { hour: eh, minute: em } = toLocalDateTime(entry.local);
  const delta = (vm - em + 60) % 60 || 60;
  if (delta * 60 > candle) return null;
  if (entry.offset === null && (eh * 60 + em + delta) % 1440 !== vh * 60 + vm) return null;
  return addSeconds(floorMinute(entry.local), delta * 60 + candle);
}

/** A non-negative amount with no sign, rounded to cents and within numeric(18,2). */
function amount(text: string, allowSign: boolean): Num | null {
  const n = parseNum(text);
  if (!n || (!allowSign && n.sign)) return null;
  if (integerDigits(toDecimal(n, MONEY_DIGITS.scale)) > MONEY_DIGITS.int) return null;
  return n;
}

/** A price as written (up to 8 decimals, no sign); '' → null; anything unusable → 'bad'. */
function price(text: string): Decimal | null | 'bad' {
  if (!text) return null;
  const n = parseNum(text);
  if (!n || n.sign || n.scale > PRICE_DIGITS.scale) return 'bad';
  const d = toDecimal(n, n.scale);
  return integerDigits(d) > PRICE_DIGITS.int ? 'bad' : d;
}

const cents = (n: Num) => toUnits({ ...n, neg: false }, 2);
const money = (units: bigint) => toDecimal(fromUnits(units, 2), 2);

export function parseEbinexRecords(records: CsvRecord[], index: EbinexIndex, width: number): PlatformParse {
  const out = new RowCollector();
  const offsets: UtcOffset[] = [];
  let offsetRows = 0;
  let unsignedLosses = 0;
  let refunds = 0;
  let refundsWithoutClose = 0;

  for (const rec of records) {
    const line = rec.line;
    if (rec.cells.length !== width) {
      out.error(line, 'column_count');
      continue;
    }
    const cell = (c: EbinexColumn) => rec.cells[index[c]].trim();
    const warnings: RowIssue<RowWarningCode>[] = [];
    const warn = (code: RowWarningCode, column?: EbinexColumn) => warnings.push(issue(line, code, column));

    const id = cell('ID');
    if (!id) {
      out.error(line, 'missing_id');
      continue;
    }
    if (!isValidExternalId(id)) {
      out.error(line, 'bad_id');
      continue;
    }

    const data = cell('Data');
    if (!data) {
      out.error(line, 'missing_date');
      continue;
    }
    const entry = parseBrDateTime(data) ?? parseIsoDateTime(data);
    if (!entry) {
      out.error(line, 'bad_date', 'Data');
      continue;
    }

    const symbol = cell('Ativo');
    if (!isValidSymbol(symbol)) {
      out.error(line, 'missing_symbol');
      continue;
    }

    const forecast = cell('Previsão').toLowerCase();
    const direction = forecast === 'bull' ? 'call' : forecast === 'bear' ? 'put' : null;
    if (!direction) {
      out.error(line, 'bad_direction');
      continue;
    }

    const status = cell('Status').toLowerCase();
    if (status !== 'win' && status !== 'lose' && status !== 'refunded') {
      out.error(line, 'unknown_status');
      continue;
    }

    const valorN = amount(cell('Valor'), false);
    if (!valorN) {
      out.error(line, 'bad_number', 'Valor');
      continue;
    }
    const estornadoN = amount(cell('Estornado'), false);
    if (!estornadoN) {
      out.error(line, 'bad_number', 'Estornado');
      continue;
    }
    const executadoN = amount(cell('Executado'), false);
    if (!executadoN) {
      out.error(line, 'bad_number', 'Executado');
      continue;
    }
    const resultado = amount(cell('Resultado'), true);
    if (!resultado) {
      out.error(line, 'bad_number', 'Resultado');
      continue;
    }

    const valor = cents(valorN);
    const estornado = cents(estornadoN);
    const executado = cents(executadoN);
    const resultAbs = cents(resultado);
    if (valor === ZERO) {
      out.error(line, 'zero_stake');
      continue;
    }
    if (estornado + executado !== valor) {
      out.error(line, 'inconsistent_amounts');
      continue;
    }

    // Status decides the sign of pnl; a sign written in Resultado is only checked against it
    let result: ImportRow['result'];
    let pnl: Decimal;
    let stake: bigint;
    let payout: Decimal | null = null;
    if (status === 'win') {
      if (resultado.sign === '-') {
        out.error(line, 'sign_mismatch', 'Resultado');
        continue;
      }
      if (executado === ZERO) {
        out.error(line, 'inconsistent_amounts');
        continue;
      }
      payout = percent(fromUnits(resultAbs, 2), fromUnits(executado, 2), PAYOUT_DIGITS.scale);
      if (integerDigits(payout) > PAYOUT_DIGITS.int) {
        out.error(line, 'bad_number', 'Resultado');
        continue;
      }
      result = 'win';
      pnl = money(resultAbs);
      stake = executado;
      if (estornado > ZERO) warn('partial_refund');
    } else if (status === 'lose') {
      if (resultado.sign === '+') {
        out.error(line, 'sign_mismatch', 'Resultado');
        continue;
      }
      if (executado === ZERO) {
        out.error(line, 'inconsistent_amounts');
        continue;
      }
      result = 'loss';
      pnl = money(-resultAbs);
      stake = executado;
      if (resultAbs !== executado) warn('loss_not_full_stake');
      if (estornado > ZERO) warn('partial_refund');
    } else {
      if (resultado.sign === '-') {
        out.error(line, 'sign_mismatch', 'Resultado');
        continue;
      }
      result = 'breakeven';
      pnl = '0.00';
      stake = valor;
      if (resultAbs !== estornado) warn('refund_amount_mismatch');
    }

    const open = price(cell('P. ABRT'));
    if (open === 'bad') {
      out.error(line, 'bad_number', 'P. ABRT');
      continue;
    }
    const close = price(cell('P. FECH'));
    if (close === 'bad') {
      out.error(line, 'bad_number', 'P. FECH');
      continue;
    }
    if (open === null) warn('missing_price', 'P. ABRT');
    // A refund without a settlement price was cancelled: it never ran on its candle
    const cancelled = status === 'refunded' && close === null;
    if (close === null && !cancelled) warn('missing_price', 'P. FECH');
    if (open !== null && close !== null && status !== 'refunded') {
      const move = compareNum(parseNum(close)!, parseNum(open)!);
      const favourable = direction === 'call' ? move > 0 : move < 0;
      if ((status === 'win') !== favourable) warn('price_status_mismatch');
    }

    const tempo = cell('Tempo');
    const candle = candleSeconds(tempo);
    let exit: LocalStamp | null = null;
    if (candle === null) warn('exit_unknown', 'Tempo');
    else if (!cancelled) {
      exit = ebinexExit(entry, cell('Vela'), candle);
      if (exit === null) warn('vela_mismatch', 'Vela');
    }

    const row: ImportRow = {
      line,
      external_id: id,
      symbol,
      asset_type: 'binary_option',
      direction,
      local_entry: entry.local,
      local_exit: exit,
      utc_offset: entry.offset,
      entry_price: open,
      exit_price: close,
      quantity: '1',
      stake_amount: money(stake),
      payout_percent: payout,
      duration_seconds: candle,
      timeframe: TIMEFRAME.test(tempo) ? tempo : null,
      result,
      pnl,
      // The broker's cut is inside the payout: no fee is a known fact, not an unknown
      commission: '0.00',
      stop_price: null,
      target_price: null,
    };
    if (!out.accept(row, warnings)) continue;

    if (entry.offset !== null) {
      offsetRows++;
      if (offsets.indexOf(entry.offset) < 0) offsets.push(entry.offset);
    }
    if (status === 'lose' && resultado.sign === null && resultAbs !== ZERO) unsignedLosses++;
    if (status === 'refunded') {
      refunds++;
      if (cancelled) refundsWithoutClose++;
    }
  }

  const notices: Notice[] = [];
  if (offsetRows > 0) notices.push({ code: 'file_has_offset', offsets, rows: offsetRows });
  if (unsignedLosses > 0) notices.push({ code: 'unsigned_losses_negated', rows: unsignedLosses });
  if (refunds > 0) notices.push({ code: 'refunds_as_breakeven', rows: refunds, withoutClose: refundsWithoutClose });
  return { rows: out.rows, errors: out.errors, warnings: out.warnings, notices };
}
