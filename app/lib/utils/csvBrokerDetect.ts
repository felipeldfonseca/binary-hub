/**
 * Detects which broker a CSV file belongs to by inspecting the header row.
 * Returns 'ebinex', 'topone', or null if unrecognized.
 */
export type BrokerFormat = 'ebinex' | 'topone';

export function detectBrokerFormat(csvText: string): BrokerFormat | null {
  const firstLine = csvText.replace(/^\uFEFF/, '').split('\n')[0] ?? '';
  const header = firstLine.toLowerCase();

  if (header.includes('ticket #') || header.includes('ticket#') || header.includes('open time') && header.includes('lots')) {
    return 'topone';
  }

  if (header.includes('previsão') || header.includes('previsao') || header.includes('ativo') || header.includes('resultado')) {
    return 'ebinex';
  }

  return null;
}
