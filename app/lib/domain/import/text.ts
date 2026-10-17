/**
 * Bytes → text, and header names → a comparable form.
 */

/**
 * windows-1252 bytes 0x80–0x9F (WHATWG Encoding table). Every other byte is the code point
 * with the same number. Decoded here instead of with TextDecoder('windows-1252') because some
 * runtimes (Node 22–24) read that label as ISO-8859-1 and turn '€' or '“' into control characters.
 */
const CP1252_HIGH = [
  0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0x8d, 0x17d, 0x8f,
  0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x9d, 0x17e, 0x178,
];

const CHUNK = 8192;

function decodeWindows1252(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let start = 0; start < bytes.length; start += CHUNK) {
    const end = Math.min(start + CHUNK, bytes.length);
    const units = new Array<number>(end - start);
    for (let i = start; i < end; i++) {
      const b = bytes[i];
      units[i - start] = b >= 0x80 && b <= 0x9f ? CP1252_HIGH[b - 0x80] : b;
    }
    parts.push(String.fromCharCode.apply(null, units));
  }
  return parts.join('');
}

/**
 * Decodes a CSV file. UTF-8 first (strictly, so a stray windows-1252 byte is noticed), then
 * windows-1252, which is what Excel on Windows writes. A UTF-8 BOM is dropped by the decoder.
 */
export function decodeCsvBytes(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(view);
  } catch {
    return decodeWindows1252(view);
  }
}

/**
 * Lower case, accents dropped (NFD), quotes and BOMs removed, runs of spaces collapsed.
 * 'Previsão' and 'Previsao' compare equal, and so do '"Ticket #"' and 'ticket  #'.
 */
export function normalizeHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[﻿"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
