import type { TradeInsert } from '@/types/database';

/** Strip currency symbols, +/- signs, commas and parse as float */
function parseMoney(raw: string | undefined): number {
  if (!raw) return 0;
  // Handle +$9.00, -$20.00, $ 80,782.53 etc.
  const cleaned = raw.replace(/[$,\s]/g, '').replace(/^\+/, '');
  return parseFloat(cleaned) || 0;
}

/**
 * Parse Ebinex date format: "DD/MM/YYYY HH:MM:SS" → ISO string.
 * JavaScript's Date constructor reads MM/DD/YYYY, so we must reorder.
 */
function parseEbinexDate(raw: string): string {
  // Expected: "10/05/2026 01:53:52"
  const match = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) {
    // Fallback: try native parsing (works for ISO strings in the old format)
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString();
    throw new Error(`Cannot parse date: "${raw}"`);
  }
  const [, dd, mm, yyyy, hh, min, ss] = match;
  return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}Z`).toISOString();
}

export interface ParsedImport {
  trades: Omit<TradeInsert, 'user_id'>[];
  /** Ebinex original IDs, used for deduplication */
  ebinexIds: string[];
  parseErrors: Array<{ row: number; error: string }>;
}

/**
 * Parse an Ebinex CSV export into Supabase TradeInsert objects.
 *
 * Expected headers (Portuguese):
 * ID, Data, Ativo, Tempo, Previsão, Vela, P. ABRT, P. FECH,
 * Valor, Estornado, Executado, Status, Resultado
 */
export function parseEbinexCsv(csvText: string): ParsedImport {
  const lines = csvText.trim().split('\n');
  const trades: Omit<TradeInsert, 'user_id'>[] = [];
  const ebinexIds: string[] = [];
  const parseErrors: Array<{ row: number; error: string }> = [];

  if (lines.length < 2) {
    return { trades, ebinexIds, parseErrors: [{ row: 0, error: 'CSV file is empty or has no data rows' }] };
  }

  // Parse headers — strip BOM if present
  const rawHeaders = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim());

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted fields (some Ebinex exports quote values with commas)
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    rawHeaders.forEach((header, idx) => {
      row[header] = values[idx]?.trim() ?? '';
    });

    const ebinexId = row['ID'];
    if (!ebinexId) {
      parseErrors.push({ row: i + 1, error: 'Missing ID field' });
      continue;
    }

    const entryTimeRaw = row['Data'];
    if (!entryTimeRaw) {
      parseErrors.push({ row: i + 1, error: `Row ${i + 1}: Missing Data (date) field` });
      continue;
    }

    let entryTime: string;
    try {
      entryTime = parseEbinexDate(entryTimeRaw);
    } catch {
      parseErrors.push({ row: i + 1, error: `Row ${i + 1}: Invalid date "${entryTimeRaw}"` });
      continue;
    }

    const prevision = (row['Previsão'] ?? row['Previsao'] ?? '').toLowerCase();
    const direction: TradeInsert['direction'] = prevision === 'bull' ? 'call' : 'put';

    const statusRaw = (row['Status'] ?? '').toLowerCase();
    const result: TradeInsert['result'] =
      statusRaw === 'win' ? 'win' : statusRaw === 'lose' ? 'loss' : 'breakeven';

    // Resultado: "+$9.00", "-$20.00", "$10.00"
    // parseMoney already preserves the sign (strips $ and leading + only).
    // Refunded trades return the stake with zero net change — pnl = 0.
    const resultadoRaw = row['Resultado'] ?? '0';
    const pnl = statusRaw === 'refunded' ? 0 : parseMoney(resultadoRaw);
    const stakeAmount = parseMoney(row['Valor']);
    const entryPrice = parseMoney(row['P. ABRT']);
    const exitPrice = parseMoney(row['P. FECH']);

    ebinexIds.push(ebinexId);
    trades.push({
      symbol: row['Ativo']?.trim() || 'UNKNOWN',
      asset_type: 'binary_option',
      direction,
      entry_price: entryPrice || null,
      exit_price: exitPrice || null,
      stake_amount: stakeAmount || null,
      quantity: 1,
      result,
      pnl,
      entry_time: entryTime,
      timeframe: row['Tempo']?.trim() || null,
      // Store the Ebinex ID in notes for deduplication
      notes: `ebinex:${ebinexId}`,
    });
  }

  return { trades, ebinexIds, parseErrors };
}

/** Split a CSV line respecting quoted fields */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
