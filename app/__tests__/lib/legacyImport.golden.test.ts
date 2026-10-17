/**
 * @jest-environment node
 */
/**
 * Freezes the legacy CSV readers (lib/utils/{csvBrokerDetect,ebinexParser,topOneParser}.ts).
 * They stay byte-identical while the new reader in lib/domain/import replaces them, so their
 * output on the synthetic fixtures is pinned with an exact string compare: any change fails,
 * and `jest --ci` can never rewrite the golden files the way it can rewrite snapshots.
 *
 * Regenerating needs UPDATE_LEGACY_GOLDEN=1 and a reason in the PR.
 */
import fs from 'node:fs';
import path from 'node:path';
import { detectBrokerFormat } from '@/lib/utils/csvBrokerDetect';
import { parseEbinexCsv } from '@/lib/utils/ebinexParser';
import { parseTopOneCsv } from '@/lib/utils/topOneParser';
import { importTrades } from '@/lib/utils/importTrades';

const DIR = path.join(__dirname, '../domain/import/fixtures');

// ebinex_iso_sem_offset is left out: legacy reads a zone-less ISO time with the machine's
// zone, so its output depends on where the test runs.
const CASES = [
  'ebinex_atual_ok',
  'ebinex_atual_erros',
  'ebinex_iso',
  'topone_ok',
  'topone_erros',
  'det_ebinex_sem_acento',
  'det_ebinex_reordenado',
  'det_ebinex_sem_vela',
  'det_topone_sem_aspas',
  'det_desconhecido',
  'det_vazio',
  'det_latin1',
];

function legacyParse(text: string) {
  const format = detectBrokerFormat(text);
  const parsed = format === 'topone' ? parseTopOneCsv(text) : format === 'ebinex' ? parseEbinexCsv(text) : null;
  return { format, parsed };
}

function golden(name: string): string {
  return fs.readFileSync(path.join(DIR, 'legacy-golden', `${name}.json`), 'utf8');
}

describe('legacy CSV readers are frozen', () => {
  it.each(CASES)('legacy output for %s is unchanged', (name) => {
    // Read as UTF-8 with the BOM kept, the way file.text() hands it to the legacy code
    const text = fs.readFileSync(path.join(DIR, `${name}.csv`), 'utf8');
    const actual = JSON.stringify(legacyParse(text), null, 2) + '\n';
    if (process.env.UPDATE_LEGACY_GOLDEN === '1') {
      fs.writeFileSync(path.join(DIR, 'legacy-golden', `${name}.json`), actual);
    }
    expect(actual).toBe(golden(name));
  });

  it('pins the request body importTrades sends for ebinex_atual_ok', async () => {
    const text = fs.readFileSync(path.join(DIR, 'ebinex_atual_ok.csv'), 'utf8');
    const { parsed } = legacyParse(text);
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => [] });
    const previousFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      await importTrades({ trades: parsed!.trades, userId: 'user-1', marketType: 'binary', accessToken: 'jwt' });
    } finally {
      global.fetch = previousFetch;
    }
    const expected = JSON.parse(golden('ebinex_atual_ok')).parsed.trades.map((t: Record<string, unknown>) => ({
      ...t,
      user_id: 'user-1',
      market_type: 'binary',
    }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify(expected));
  });
});
