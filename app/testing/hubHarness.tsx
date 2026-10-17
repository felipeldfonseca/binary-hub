/**
 * Test helpers for the hub's account screens. Lives outside __tests__ so Jest does not run it
 * as a suite. Every value here is invented; the CSV fixtures are the synthetic ones of
 * __tests__/domain/import/fixtures.
 */
import fs from 'fs'
import path from 'path'
import { StrictMode } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { parseImportText, type ReadImportFileResult } from '@/lib/domain/import'
import type { TradingAccount } from '@/lib/hub/contas'
import type { ImportBatch, ImportPreviewResult } from '@/lib/hub/contasDb'
import ImportSheetProvider from '@/components/hub/importar/ImportSheetProvider'

let seq = 0

export function makeAccount(overrides: Partial<TradingAccount> = {}): TradingAccount {
  seq += 1
  return {
    id: `acc-${seq}`,
    market: 'futures',
    label: `Conta ${seq}`,
    platform: null,
    firm: null,
    external_ref: null,
    phase: null,
    size: null,
    file_tz: 'UTC',
    tz_applied_at: null,
    is_primary: false,
    is_example: false,
    archived_at: null,
    sort_order: 0,
    created_at: '2026-10-01T12:00:00Z',
    ...overrides,
  }
}

export function makePreview(overrides: Partial<ImportPreviewResult> = {}): ImportPreviewResult {
  return {
    new: 0,
    duplicate: 0,
    completable: 0,
    other_account: 0,
    day_changes: 0,
    first_day: '2026-03-06',
    last_day: '2026-03-13',
    errors: [],
    already_imported: false,
    tz_status: 'ok',
    account_tz: 'UTC',
    tz_confirmed: true,
    rows_total: 0,
    ...overrides,
  }
}

export function makeBatch(overrides: Partial<ImportBatch> = {}): ImportBatch {
  seq += 1
  return {
    id: `batch-${seq}`,
    platform: 'topone',
    file_name: 'Trade-History.csv',
    rows_total: 7,
    rows_inserted: 7,
    rows_duplicate: 0,
    rows_completed: 0,
    rows_other_account: 0,
    rows_error: 0,
    is_legacy: false,
    status: 'done',
    created_at: '2026-10-15T17:32:00Z',
    undone_at: null,
    ...overrides,
  }
}

const FIXTURES = path.join(__dirname, '../__tests__/domain/import/fixtures')

/** What readImportFile gives for one of the synthetic fixtures. */
export function fixtureFile(name: string): ReadImportFileResult {
  const text = fs.readFileSync(path.join(FIXTURES, `${name}.csv`), 'utf8')
  return { fileName: `${name}.csv`, size: text.length, sha256: 'ab'.repeat(32), outcome: parseImportText(text) }
}

export function csvFile(name = 'arquivo.csv') {
  return new File(['ID,Data\n'], name, { type: 'text/csv' })
}

/**
 * Renders inside a fresh query cache and the import sheet's provider. `strict` adds React's
 * strict mode, which mounts, unmounts and mounts again as `next dev` does.
 */
export function renderHub(ui: React.ReactElement, { strict = false }: { strict?: boolean } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const tree = (
    <QueryClientProvider client={queryClient}>
      <ImportSheetProvider>{ui}</ImportSheetProvider>
    </QueryClientProvider>
  )
  const view = render(strict ? <StrictMode>{tree}</StrictMode> : tree)
  return { ...view, queryClient }
}
