/**
 * @jest-environment node
 *
 * The forms' side of «Salvar revisão» and «Antes de operar» (Phase 4): what the payload builders
 * send and which field the form marks as too long. The server's own checks and what it stores are
 * pinned against the SQL in cases4.json (cases4.test.ts); these are the form's helpers around them.
 */
import { checkNotePayload, checkReviewPayload, jsonbTextBytes, notePayload, reviewFormTooLong, reviewPayload } from '@/lib/domain/diario';

const KEY = '0b3f1c2a-1111-4c2d-8e3f-000000000001';

describe('the form\'s too-long field', () => {
  const form = { worked: '', differently: '', followed: null, carryForward: '' };

  it('names the first field over its limit, in form order, after trimming', () => {
    expect(reviewFormTooLong(form)).toBeNull();
    expect(reviewFormTooLong({ ...form, worked: 'a'.repeat(1001) })).toBe('worked');
    expect(reviewFormTooLong({ ...form, worked: 'a'.repeat(1001), differently: 'b'.repeat(1001) })).toBe('worked');
    expect(reviewFormTooLong({ ...form, differently: 'b'.repeat(1001), carryForward: 'c'.repeat(201) })).toBe('differently');
    expect(reviewFormTooLong({ ...form, carryForward: 'c'.repeat(201) })).toBe('carry_forward');
    // At the limit, and white space around it, is fine; emoji count once each
    expect(reviewFormTooLong({ ...form, worked: ` ${'a'.repeat(1000)}\n`, carryForward: '😀'.repeat(200) })).toBeNull();
  });

  it('agrees with the server\'s check on what it marks', () => {
    const over = { ...form, differently: 'b'.repeat(1001) };
    expect(checkReviewPayload(reviewPayload(over, KEY))).toEqual({ code: 'bad_text', field: reviewFormTooLong(over) });
  });
});

describe('the payloads', () => {
  it('«Salvar revisão»: texts as the server stores them, the key only when there is one', () => {
    expect(reviewPayload({ worked: '  Esperei.\n', differently: '   ', followed: 'em_parte', carryForward: '﻿Uma por vez.' }, KEY)).toEqual({
      v: 1,
      client_key: KEY,
      worked: 'Esperei.',
      differently: null,
      followed: 'em_parte',
      carry_forward: 'Uma por vez.',
    });
    expect('client_key' in reviewPayload({ worked: 'x', differently: '', followed: null, carryForward: '' }, null)).toBe(false);
  });

  it('«Antes de operar»: trimmed, blank clears it', () => {
    expect(notePayload('  Só a favor da VWAP.\n', KEY)).toEqual({ v: 1, client_key: KEY, text: 'Só a favor da VWAP.' });
    expect(notePayload(' \t ', KEY)).toEqual({ v: 1, client_key: KEY, text: null });
    expect(notePayload('x', null)).toEqual({ v: 1, text: 'x' });
    expect(checkNotePayload(notePayload('  x  ', KEY))).toBeNull();
  });

  it('the size as jsonb prints it: keys by length, «, » and «: », control characters escaped', () => {
    expect(jsonbTextBytes({ worked: 'a', v: 1 })).toBe('{"v": 1, "worked": "a"}'.length);
    // U+001F prints as \u001f (6 bytes), a tab as \t (2), «é» is 2 bytes of UTF-8
    expect(jsonbTextBytes('\u001f')).toBe(8);
    expect(jsonbTextBytes('\t')).toBe(4);
    expect(jsonbTextBytes('é')).toBe(4);
  });
});
