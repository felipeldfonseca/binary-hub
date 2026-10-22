/**
 * The import sheet's steps and the rules that link them. Step keys are the ImportarConta board's
 * own names (a, b, c, d, f, g, i1, i2, solte, erro, fim…), plus `conf`: the count of what a
 * file zone change moves, shown before the zone is confirmed (owner's decision, no board).
 */
import { PLATFORM_MARKET, type FileVariant, type ParsedFile, type ReaderPlatform, type ReadImportFileResult } from '@/lib/domain/import'
import { fileDays, tzConfirmed, type TradingAccount } from '@/lib/hub/contas'
import { formatDateRange } from '@/lib/hub/formato'
import { ARQUIVO, MARKET_LABEL, ops } from '@/components/hub/contas/copy'

export type Passo =
  | 'solte'
  | 'erro'
  | 'a'
  | 'b'
  | 'i1'
  | 'i2'
  | 'c'
  | 'conf'
  | 'd'
  | 'f'
  | 'g'
  | 'fim'
  | 'fimFuso'
  | 'fimConta'

/** Steps of a linear sequence, counted by "Passo k de n". */
const COUNTED: readonly Passo[] = ['a', 'b', 'i1', 'i2', 'c', 'conf', 'd']
/** Choice and end screens: what follows them is a new sequence with its own count. */
const BREAKS: readonly Passo[] = ['solte', 'erro', 'f', 'g', 'fim', 'fimFuso', 'fimConta']
export const END_STEPS: readonly Passo[] = ['fim', 'fimFuso', 'fimConta']

/** The parsed file, when the read worked and found rows. */
export function parsedOf(file: ReadImportFileResult | null): ParsedFile | null {
  return file && file.outcome.ok && file.outcome.rows.length > 0 ? file.outcome : null
}

/** Whether an import into this account must ask the file zone first (step c). */
export function needsZoneStep(parsed: ParsedFile, account: Pick<TradingAccount, 'tz_applied_at'> | null): boolean {
  return parsed.needsFileTz && (account === null || !tzConfirmed(account))
}

export interface PlanInput {
  passo: Passo
  history: readonly Passo[]
  mode: 'importar' | 'adicionar'
  parsed: ParsedFile | null
  /** Step a: an account id or 'nova' */
  choice: string | null
  choiceAccount: TradingAccount | null
  fixOnly: boolean
}

/** Steps still to come after the current one, as far as they can be told now. */
function ahead(p: PlanInput): Passo[] {
  const thenPreview = (account: TradingAccount | null): Passo[] =>
    p.parsed ? [...(needsZoneStep(p.parsed, account) ? (['c'] as Passo[]) : []), 'd'] : []
  switch (p.passo) {
    case 'i1':
      return ['i2', 'b']
    case 'i2':
      return ['b']
    case 'a':
      return p.choice === 'nova' ? ['b', ...thenPreview(null)] : thenPreview(p.choiceAccount)
    case 'b':
      return p.parsed ? thenPreview(null) : []
    case 'c':
      return p.fixOnly ? ['conf'] : ['d']
    case 'conf':
      return p.fixOnly ? [] : ['d']
    default:
      return []
  }
}

/** "Passo k de n": shown only on a counted step of a sequence of two or more. */
export function stepIndicator(p: PlanInput): { k: number; total: number } | null {
  if (!COUNTED.includes(p.passo)) return null
  const trail = [...p.history, p.passo]
  let start = 0
  trail.forEach((s, i) => {
    if (BREAKS.includes(s)) start = i + 1
  })
  const visited = trail.slice(start).filter((s) => COUNTED.includes(s))
  const total = visited.length + ahead(p).length
  return total >= 2 ? { k: visited.length, total } : null
}

/** «CSV da Ebinex · Opções binárias · 169 operações · 4 ago–13 out» */
export function fileSummary(parsed: ParsedFile, currentYear: number): string {
  const parts = [
    ARQUIVO.format[parsed.variant] ?? '',
    // «Top One Futures · Trade History» already names the market (board)
    parsed.platform === 'topone' ? '' : MARKET_LABEL[parsed.market],
    parsed.errors.length > 0 ? ARQUIVO.rows(parsed.records) : ops(parsed.rows.length),
  ]
  const days = fileDays(parsed.rows)
  if (days) parts.push(formatDateRange(days.first, days.last, currentYear))
  if (parsed.platform === 'topone') parts.push(ARQUIVO.noAccount)
  return parts.filter(Boolean).join(' · ')
}

/**
 * «CSV da Ebinex · Opções binárias · nenhuma linha de operação» (board): a file of a known
 * format with no trade to import. Null for any other file.
 */
export function emptyFileSummary(file: ReadImportFileResult | null): string | null {
  const outcome = file?.outcome
  if (!outcome) return null
  let platform: ReaderPlatform
  let variant: FileVariant
  if (outcome.ok) {
    if (outcome.rows.length > 0) return null
    platform = outcome.platform
    variant = outcome.variant
  } else if (outcome.error === 'empty_file' && outcome.platform) {
    // A header and nothing under it: the format is known, its variant is not
    platform = outcome.platform
    variant = platform === 'topone' ? 'topone' : 'ebinex_br'
  } else {
    return null
  }
  return [ARQUIVO.format[variant] ?? '', platform === 'topone' ? '' : MARKET_LABEL[PLATFORM_MARKET[platform]], ARQUIVO.noRows]
    .filter(Boolean)
    .join(' · ')
}
