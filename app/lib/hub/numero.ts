/**
 * Numbers as the trader types them in «Registrar operação» (pt-BR), read into the decimal text
 * the database takes ('7896.25'), and decimal text written back the pt-BR way («7.896,25»). Same
 * reader for every numeric field (prices, contracts, stop and target, stake, payout, a typed
 * result). Pure; no React.
 *
 * The approved board's `num` (RegistrarOperacao, revised for the new markets):
 *   «7.896,25» «7896,25» «7896.25» «1.234.567,8» → with a comma, dots group thousands and the comma
 *   is the decimal mark; without one, a dot followed by groups of exactly three digits groups
 *   thousands («7.896» = 7896), except after a lone zero («0.250» = 0,25); any other dot is the
 *   decimal mark. Spaces are ignored. Anything else is 'invalid' («Use só números, como 7.896,25.»).
 * With `ponto` (Forex, ações e opções: prices like 1.085 are common), a single dot is always the
 * decimal mark («1.085» = 1,085). With `sinal` (a typed result), a leading minus (− or -) or plus
 * is read.
 *
 * The value comes back without trailing zeros («2,00» → '2', «7.896,50» → '7896.5'); how many
 * digits are allowed, and the tick, are the domain's checks (lib/domain/registro).
 */

export type NumeroLido = { ok: true; value: string } | { ok: false; reason: 'empty' | 'invalid' };

const PLAIN = /^\d+(\.\d+)?$/;
const THOUSANDS = /^\d{1,3}(\.\d{3})+$/;

function normalize(x: string, negative: boolean): NumeroLido {
  if (!PLAIN.test(x)) return { ok: false, reason: 'invalid' };
  const [int, frac = ''] = x.split('.');
  const i = int.replace(/^0+(?=\d)/, '');
  const f = frac.replace(/0+$/, '');
  const body = f ? `${i}.${f}` : i;
  const zero = /^0(\.0*)?$/.test(body);
  return { ok: true, value: negative && !zero ? `-${body}` : body };
}

/** The board's num: comma or grouped thousands */
function num(x: string): string {
  if (x.includes(',')) return x.replace(/\./g, '').replace(',', '.');
  if (THOUSANDS.test(x) && !/^0\./.test(x)) return x.replace(/\./g, '');
  return x;
}

export function lerNumero(text: string, { ponto = false, sinal = false }: { ponto?: boolean; sinal?: boolean } = {}): NumeroLido {
  let x = String(text ?? '').replace(/\s/g, '');
  if (x === '') return { ok: false, reason: 'empty' };
  let negative = false;
  if (sinal && /^[-−+]/.test(x)) {
    negative = x[0] !== '+';
    x = x.slice(1);
    if (x === '') return { ok: false, reason: 'invalid' };
  }
  if (ponto && !x.includes(',') && (x.match(/\./g) ?? []).length <= 1) return normalize(x, negative);
  return normalize(num(x), negative);
}

const NBSP = ' ';
const MINUS = '−';

/**
 * Decimal text ('7896.25', '-7.5') the pt-BR way: «7.896,25», «−7,5». `minDecimals` pads the
 * decimals («7,50» with 2); `signed` writes «+» on positive values and «−» on negative ones (never
 * on zero); `suffix` is appended after a no-break space («7,50 pts»). Anything that is not decimal
 * text comes back unchanged.
 */
export function formatDecimal(decimal: string, { minDecimals = 0, signed = false, suffix }: { minDecimals?: number; signed?: boolean; suffix?: string } = {}): string {
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(String(decimal).trim());
  if (!m) return decimal;
  const int = m[2].replace(/^0+(?=\d)/, '');
  let frac = m[3] ?? '';
  if (frac.length < minDecimals) frac = frac.padEnd(minDecimals, '0');
  const zero = /^0+$/.test(int) && /^0*$/.test(frac);
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = zero ? '' : m[1] === '-' ? MINUS : signed ? '+' : '';
  return `${sign}${grouped}${frac ? `,${frac}` : ''}${suffix ? `${NBSP}${suffix}` : ''}`;
}
