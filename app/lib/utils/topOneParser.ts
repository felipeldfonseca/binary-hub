import type { TradeInsert } from '@/types/database';

/** Strip currency symbols, commas, spaces. Preserves the leading minus sign. */
function parsePnl(raw: string): number {
  const cleaned = raw.replace(/[$,\s]/g, '').replace(/^\+/, '');
  return parseFloat(cleaned) || 0;
}

/** Parse Top One date format: "DD/MM/YYYY HH:MM:SS" → ISO string */
function parseTopOneDate(raw: string): string {
  const match = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString();
    throw new Error(`Cannot parse date: "${raw}"`);
  }
  const [, dd, mm, yyyy, hh, min, ss] = match;
  return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}Z`).toISOString();
}

/** Split a CSV line respecting double-quoted fields */
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

export interface ParsedImport {
  trades: Omit<TradeInsert, 'user_id'>[];
  topOneIds: string[];
  parseErrors: Array<{ row: number; error: string }>;
}

/**
 * Parse a Top One Futures CSV export into Supabase TradeInsert objects.
 *
 * Expected headers:
 * "Ticket #","Symbol","Side","SL","TP","Open Time","Open Price",
 * "Close Time","Close Price","Duration","PnL","Lots","Commissions","Gain"
 */
export function parseTopOneCsv(csvText: string): ParsedImport {
  const lines = csvText.trim().split('\n');
  const trades: Omit<TradeInsert, 'user_id'>[] = [];
  const topOneIds: string[] = [];
  const parseErrors: Array<{ row: number; error: string }> = [];

  if (lines.length < 2) {
    return { trades, topOneIds, parseErrors: [{ row: 0, error: 'CSV file is empty or has no data rows' }] };
  }

  const rawHeaders = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.replace(/"/g, '').trim());

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    rawHeaders.forEach((header, idx) => {
      row[header] = values[idx]?.replace(/"/g, '').trim() ?? '';
    });

    const ticket = row['Ticket #'];
    if (!ticket) {
      parseErrors.push({ row: i + 1, error: 'Missing Ticket # field' });
      continue;
    }

    const openTimeRaw = row['Open Time'];
    const closeTimeRaw = row['Close Time'];

    if (!openTimeRaw) {
      parseErrors.push({ row: i + 1, error: `Row ${i + 1}: Missing Open Time` });
      continue;
    }

    let entryTime: string;
    let exitTime: string | null = null;

    try {
      entryTime = parseTopOneDate(openTimeRaw);
    } catch {
      parseErrors.push({ row: i + 1, error: `Row ${i + 1}: Invalid Open Time "${openTimeRaw}"` });
      continue;
    }

    if (closeTimeRaw) {
      try {
        exitTime = parseTopOneDate(closeTimeRaw);
      } catch {
        // exit_time is optional — don't fail the row
      }
    }

    const side = (row['Side'] ?? '').toUpperCase();
    const direction: TradeInsert['direction'] = side === 'BUY' ? 'long' : 'short';

    const pnl = parsePnl(row['PnL'] ?? '0');
    const result: TradeInsert['result'] =
      pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'breakeven';

    const entryPrice = parseFloat(row['Open Price'] ?? '0') || null;
    const exitPrice  = parseFloat(row['Close Price'] ?? '0') || null;
    const quantity   = parseFloat(row['Lots'] ?? '1') || 1;

    topOneIds.push(ticket);
    trades.push({
      symbol:      row['Symbol']?.trim() || 'UNKNOWN',
      asset_type:  'futures',
      direction,
      entry_price: entryPrice,
      exit_price:  exitPrice,
      quantity,
      stake_amount: null,
      result,
      pnl,
      entry_time:  entryTime,
      exit_time:   exitTime,
      timeframe:   null,
      notes:       `topone:${ticket}`,
    });
  }

  return { trades, topOneIds, parseErrors };
}
