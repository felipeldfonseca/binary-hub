/**
 * @jest-environment node
 *
 * «Imagens e nota»: choosing (type, size, names), the metadata taken out of the bytes, the
 * browser's re-encoding rules (D33) with a stand-in canvas, and «Salvar imagens e nota» on the
 * recorded answers (reserve → upload → save → trash).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  IMAGE_ACCEPT,
  MAX_IMAGE_BYTES,
  PrepareImageError,
  drawSize,
  formatImageSize,
  imageMimeOf,
  prepareImage,
  saveImagesAndNote,
  stripImageMetadata,
  stripJpegMetadata,
  stripPngMetadata,
  stripWebpMetadata,
  uniqueImageName,
  type ImageCodec,
} from '@/lib/hub/registrarImagens';
import { RegistrarDataError } from '@/lib/hub/registrarDb';
import { telasJson } from '@/testing/registrarTelas';

const bytes = (...xs: (number | string)[]) =>
  Uint8Array.from(xs.flatMap((x) => (typeof x === 'string' ? Array.from(x, (c) => c.charCodeAt(0)) : [x])));
const text = (b: Uint8Array) => String.fromCharCode(...Array.from(b));
const be16 = (n: number) => [n >> 8, n & 0xff];
const be32 = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];

/** A JPEG's segments: SOI, APP0 (JFIF), APP1 (EXIF: orientation 6 and a GPS pointer), APP13, DQT, SOS + data, EOI */
function jpeg(orientation = 6): Uint8Array {
  const tiff = [
    ...Array.from('MM', (c) => c.charCodeAt(0)), 0x00, 0x2a, ...be32(8),
    ...be16(2),
    ...be16(0x0112), ...be16(3), ...be32(1), ...be16(orientation), 0, 0,
    ...be16(0x8825), ...be16(4), ...be32(1), ...be32(38),
    ...be32(0),
    ...Array.from('GPS-22.9S-43.2W', (c) => c.charCodeAt(0)),
  ];
  const app1 = [...Array.from('Exif\0\0', (c) => c.charCodeAt(0)), ...tiff];
  const app13 = Array.from('Photoshop 3.0\0IPTC', (c) => c.charCodeAt(0));
  const app0 = Array.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', (c) => c.charCodeAt(0));
  return bytes(
    0xff, 0xd8,
    0xff, 0xe0, ...be16(app0.length + 2), ...app0,
    0xff, 0xe1, ...be16(app1.length + 2), ...app1,
    0xff, 0xed, ...be16(app13.length + 2), ...app13,
    0xff, 0xdb, ...be16(4), 0x00, 0x01,
    0xff, 0xda, ...be16(4), 0x01, 0x02, 0x11, 0x22, 0xff, 0x00, 0x33,
    0xff, 0xd9,
  );
}

function pngChunk(type: string, data: number[]): number[] {
  return [...be32(data.length), ...Array.from(type, (c) => c.charCodeAt(0)), ...data, 0xaa, 0xbb, 0xcc, 0xdd];
}
function png(): Uint8Array {
  return bytes(
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...pngChunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]),
    ...pngChunk('tEXt', Array.from('Comment\0Autor-GPS', (c) => c.charCodeAt(0))),
    ...pngChunk('eXIf', Array.from('MM\0*GPS', (c) => c.charCodeAt(0))),
    ...pngChunk('IDAT', [1, 2, 3]),
    ...pngChunk('IEND', []),
  );
}

function riffChunk(type: string, data: number[]): number[] {
  return [...Array.from(type, (c) => c.charCodeAt(0)), ...le32(data.length), ...data, ...(data.length % 2 ? [0] : [])];
}
function webp(): Uint8Array {
  const body = [
    ...riffChunk('VP8X', [0x0c, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    ...riffChunk('VP8 ', [9, 9, 9]),
    ...riffChunk('EXIF', Array.from('MM\0*GPS', (c) => c.charCodeAt(0))),
    ...riffChunk('XMP ', Array.from('<x:xmpmeta GPS/>', (c) => c.charCodeAt(0))),
  ];
  return bytes('RIFF', ...le32(body.length + 4), 'WEBP', ...body);
}

describe('choosing images', () => {
  it('takes PNG, JPEG and WebP by type, or by extension when the type is missing (HEIC, GIF refused)', () => {
    expect(IMAGE_ACCEPT).toBe('image/png,image/jpeg,image/webp');
    expect(imageMimeOf({ type: 'image/png', name: 'a.png' })).toBe('image/png');
    expect(imageMimeOf({ type: 'IMAGE/JPEG', name: 'a' })).toBe('image/jpeg');
    expect(imageMimeOf({ type: '', name: 'MES_10-07.JPG' })).toBe('image/jpeg');
    expect(imageMimeOf({ type: '', name: 'b.webp' })).toBe('image/webp');
    expect(imageMimeOf({ type: 'image/heic', name: 'IMG_0001.HEIC' })).toBeNull();
    expect(imageMimeOf({ type: 'image/gif', name: 'x.png' })).toBeNull();
    expect(imageMimeOf({ type: '', name: 'nota.txt' })).toBeNull();
  });

  it('sizes as the board writes them, names made unique for pasted screenshots', () => {
    expect(formatImageSize(860160)).toBe('840 KB');
    expect(formatImageSize(1258291)).toBe('1,2 MB');
    expect(formatImageSize(10)).toBe('1 KB');
    expect(MAX_IMAGE_BYTES).toBe(10 * 1024 * 1024);
    expect(uniqueImageName('image.png', ['image.png'])).toBe('image (2).png');
    expect(uniqueImageName('image.png', ['image.png', 'image (2).png'])).toBe('image (3).png');
    expect(uniqueImageName('MES.png', ['image.png'])).toBe('MES.png');
  });

  it('draws at most 4096 px on the longest side and 16,7 MP, never enlarged', () => {
    expect(drawSize(8000, 6000)).toEqual({ width: 4096, height: 3072 });
    expect(drawSize(4032, 3024)).toEqual({ width: 4032, height: 3024 });
    expect(drawSize(1170, 2532)).toEqual({ width: 1170, height: 2532 });
    expect(drawSize(0, 10)).toEqual({ width: 0, height: 0 });
  });
});

describe('metadata out of the bytes', () => {
  it('JPEG: APP1 and APP13 go, the orientation stays in a minimal APP1 after the JFIF APP0', () => {
    const out = stripJpegMetadata(jpeg(6))!;
    expect(text(out)).not.toMatch(/GPS|Photoshop|IPTC/);
    expect(Array.from(out.subarray(0, 2))).toEqual([0xff, 0xd8]);
    expect(Array.from(out.subarray(2, 4))).toEqual([0xff, 0xe0]);
    const app1 = text(out).indexOf('Exif');
    expect(app1).toBeGreaterThan(0);
    expect(out[app1 - 4]).toBe(0xff);
    expect(out[app1 - 3]).toBe(0xe1);
    // The orientation value
    expect(text(out)).toContain('\x01\x12\x00\x03\x00\x00\x00\x01\x00\x06');
    // Image data and the end marker untouched
    expect(Array.from(out.subarray(out.length - 2))).toEqual([0xff, 0xd9]);
    expect(text(out)).toContain('\x11\x22\xff\x00\x33');
  });

  it('JPEG: orientation 1 (or none) adds no segment; anything not a JPEG is null', () => {
    const out = stripJpegMetadata(jpeg(1))!;
    expect(text(out)).not.toContain('Exif');
    expect(stripJpegMetadata(bytes(0x89, 0x50, 0x4e, 0x47))).toBeNull();
    expect(stripJpegMetadata(bytes(0xff, 0xd8, 0xff, 0xe1, 0x00, 0x40))).toBeNull();
  });

  it('JPEG: comments, other APPn (an MPF index) and whatever follows the end marker (a gain map, a Motion Photo’s video) go; JFIF, ICC and Adobe stay', () => {
    const seg = (m: number, s: string) => [0xff, m, ...be16(s.length + 2), ...Array.from(s, (c) => c.charCodeAt(0))];
    const photo = bytes(
      0xff, 0xd8,
      ...seg(0xe0, 'JFIF\0\x01\x01\0\0\x01\0\x01\0\0'),
      ...seg(0xe2, 'ICC_PROFILE\0\x01\x01sRGB'),
      ...seg(0xe2, 'MPF\0MM\0*GPS-index'),
      ...seg(0xec, 'Ducky-GPS'),
      ...seg(0xee, 'Adobe\0d\0\0\0\0\x01'),
      ...seg(0xfe, 'Comment GPS-22.9S'),
      0xff, 0xdb, ...be16(4), 0x00, 0x01,
      // A progressive JPEG: two scans with a Huffman table between them, a restart marker inside
      0xff, 0xda, ...be16(4), 0x01, 0x02, 0x11, 0xff, 0x00, 0x22, 0xff, 0xd0, 0x23,
      0xff, 0xc4, ...be16(4), 0x10, 0x01,
      0xff, 0xda, ...be16(4), 0x01, 0x03, 0x44, 0x55,
      0xff, 0xff, 0xd9,
      // Appended after the end: a second JPEG with its own EXIF, then a video
      0xff, 0xd8, ...seg(0xe1, 'Exif\0\0GPS-gainmap'), 0xff, 0xd9,
      ...Array.from('ftypmp42 GPS-video', (c) => c.charCodeAt(0)),
    );
    const out = stripJpegMetadata(photo)!;
    expect(text(out)).not.toMatch(/GPS|MPF|Ducky|Comment|ftyp|gainmap/);
    expect(text(out)).toContain('JFIF');
    expect(text(out)).toContain('ICC_PROFILE');
    expect(text(out)).toContain('Adobe');
    expect(text(out)).toContain('\x11\xff\x00\x22\xff\xd0\x23');
    expect(text(out)).toContain('\xff\xc4');
    expect(text(out)).toContain('\x44\x55');
    expect(Array.from(out.subarray(out.length - 2))).toEqual([0xff, 0xd9]);
    expect(text(out).indexOf('\xff\xd9')).toBe(out.length - 2);
  });

  it('JPEG: a file cut before its end marker is not walked', () => {
    const cut = jpeg(6).subarray(0, jpeg(6).length - 2);
    expect(stripJpegMetadata(cut)).toBeNull();
  });

  it('PNG: text and eXIf chunks go, the image chunks stay', () => {
    const out = stripPngMetadata(png())!;
    expect(text(out)).not.toMatch(/GPS|Autor|tEXt|eXIf/);
    expect(text(out)).toContain('IHDR');
    expect(text(out)).toContain('IDAT');
    expect(text(out).endsWith('IEND\xaa\xbb\xcc\xdd')).toBe(true);
    expect(stripPngMetadata(bytes(1, 2, 3))).toBeNull();
  });

  it('WebP: EXIF and XMP chunks go, their VP8X flags are cleared and the RIFF size is right', () => {
    const out = stripWebpMetadata(webp())!;
    expect(text(out)).not.toMatch(/GPS|EXIF|XMP/);
    expect(text(out.subarray(0, 4))).toBe('RIFF');
    expect(out[4] | (out[5] << 8) | (out[6] << 16) | (out[7] << 24)).toBe(out.length - 8);
    expect(out[20]).toBe(0x00);
    expect(stripWebpMetadata(bytes('RIFF', 0, 0, 0, 0, 'WAVE'))).toBeNull();
  });

  it('WebP: anything appended after the RIFF goes too', () => {
    const out = stripWebpMetadata(bytes(...Array.from(webp()), ...Array.from('Exif\0\0GPS-trailer', (c) => c.charCodeAt(0))))!;
    expect(text(out)).not.toMatch(/GPS|trailer/);
    expect(out[4] | (out[5] << 8) | (out[6] << 16) | (out[7] << 24)).toBe(out.length - 8);
    expect(stripWebpMetadata(bytes('RIFF', ...le32(400), 'WEBP'))).toBeNull();
  });

  it('picks the walker by type', () => {
    expect(stripImageMetadata(png(), 'image/png')).toEqual(stripPngMetadata(png()));
    expect(stripImageMetadata(webp(), 'image/webp')).toEqual(stripWebpMetadata(webp()));
    expect(stripImageMetadata(jpeg(), 'image/jpeg')).toEqual(stripJpegMetadata(jpeg()));
  });
});

/** A canvas that writes what it is told: { 'image/webp': size or null, 'image/jpeg': … }; a type answered as another */
function codec(sizes: Partial<Record<'image/webp' | 'image/jpeg', number | null>>, as: Partial<Record<'image/webp' | 'image/jpeg', string>> = {}): ImageCodec & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async encode(_file, type) {
      calls.push(type);
      const n = sizes[type];
      return n === null || n === undefined ? null : new Blob([new Uint8Array(n)], { type: as[type] ?? type });
    },
    async bytes(blob) {
      return new Uint8Array(await blob.arrayBuffer());
    },
  };
}

describe('preparing a file (D33)', () => {
  const pngFile = () => new Blob([png() as BlobPart], { type: 'image/png' });
  const jpegFile = () => new Blob([jpeg() as BlobPart], { type: 'image/jpeg' });

  it('re-encodes to WebP when it is not larger', async () => {
    const out = await prepareImage(pngFile(), 'image/png', codec({ 'image/webp': 40 }));
    expect([out.how, out.mime, out.bytes]).toEqual(['webp', 'image/webp', 40]);
  });

  it('falls back to JPEG when the browser cannot write WebP (it hands back PNG)', async () => {
    const c = codec({ 'image/webp': 30, 'image/jpeg': 35 }, { 'image/webp': 'image/png' });
    const out = await prepareImage(pngFile(), 'image/png', c);
    expect([out.how, out.mime]).toEqual(['jpeg', 'image/jpeg']);
    expect(c.calls).toEqual(['image/webp', 'image/jpeg']);
  });

  it('keeps a PNG’s own pixels when the re-encoding is larger, without its metadata', async () => {
    const out = await prepareImage(pngFile(), 'image/png', codec({ 'image/webp': 5000 }));
    expect([out.how, out.mime]).toEqual(['original', 'image/png']);
    expect(text(new Uint8Array(await out.blob.arrayBuffer()))).not.toMatch(/GPS|Autor/);
  });

  it('never sends a JPEG as chosen: larger re-encoding or none → the bytes without EXIF', async () => {
    for (const c of [codec({ 'image/webp': 5000 }), codec({})]) {
      const out = await prepareImage(jpegFile(), 'image/jpeg', c);
      expect([out.how, out.mime]).toEqual(['original', 'image/jpeg']);
      expect(text(new Uint8Array(await out.blob.arrayBuffer()))).not.toMatch(/GPS|IPTC/);
    }
  });

  it('refuses what neither the canvas nor the byte walk can read, and anything above 10 MB', async () => {
    await expect(prepareImage(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }), 'image/jpeg', codec({}))).rejects.toEqual(new PrepareImageError('unreadable'));
    const big = new Blob([new Uint8Array(MAX_IMAGE_BYTES + 10)], { type: 'image/png' });
    await expect(prepareImage(big, 'image/png', codec({ 'image/webp': MAX_IMAGE_BYTES + 1 }))).rejects.toMatchObject({ reason: 'too_large' });
  });
});

/** A Supabase stand-in: image_slots / save_extras / image_trash_done answer the given JSON; Storage records uploads */
function fakeDb(answers: Record<string, unknown>, uploadFails: string[] = []) {
  const rpc: { name: string; args: Record<string, unknown> }[] = [];
  const uploads: { path: string; type: string; size: number; options: unknown }[] = [];
  const removed: string[][] = [];
  const db = {
    rpc: (name: string, args: Record<string, unknown>) => {
      rpc.push({ name, args });
      const a = answers[name];
      const call = {
        abortSignal: () => call,
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve(a instanceof Error ? { data: null, error: { message: a.message, hint: 'new' } } : { data: a, error: null }).then(resolve),
      };
      return call;
    },
    storage: {
      from: () => ({
        upload: async (path: string, file: Blob, options: { contentType: string }) => {
          uploads.push({ path, type: options.contentType, size: file.size, options });
          return uploadFails.includes(path) ? { data: null, error: { message: 'new row violates row-level security policy', statusCode: '403' } } : { data: { path }, error: null };
        },
        remove: async (paths: string[]) => {
          removed.push(paths);
          return { data: [], error: null };
        },
      }),
    },
  } as unknown as SupabaseClient;
  return { db, rpc, uploads, removed };
}

describe('«Salvar imagens e nota»', () => {
  const slots = () => telasJson('slots-mes') as { slots: { id: string; path: string }[] };
  const extras = (trash: string[] = []) => ({ ...(telasJson('extras-mes') as Record<string, unknown>), trash });
  const file = (n: number) => new Blob([new Uint8Array(n)], { type: 'image/png' });
  const items = () => [
    { kind: 'new' as const, key: 'a', file: file(900), name: 'MES_10-12_entrada.png', mime: 'image/png' as const },
    { kind: 'new' as const, key: 'b', file: file(1300), name: 'MES_10-38_saida.png', mime: 'image/png' as const },
  ];

  it('reserves, uploads one by one with progress, saves the list in order and the note', async () => {
    const f = fakeDb({ image_slots: telasJson('slots-mes'), save_extras: extras() });
    const progress: string[] = [];
    const out = await saveImagesAndNote(f.db, 'trade-1', { items: items(), note: 'Saí no stop.' }, {
      codec: codec({ 'image/webp': 400 }),
      onProgress: (p) => progress.push(`${p.sending}/${p.total}`),
    });
    expect(f.rpc.map((r) => r.name)).toEqual(['image_slots', 'save_extras']);
    expect(f.rpc[0].args).toEqual({
      p_trade: 'trade-1',
      p_req: { v: 1, keep: [], new: [{ mime: 'image/webp', bytes: 400, name: 'MES_10-12_entrada.png' }, { mime: 'image/webp', bytes: 400, name: 'MES_10-38_saida.png' }] },
    });
    expect(f.uploads.map((u) => [u.path, u.type, (u.options as { upsert?: boolean }).upsert])).toEqual(slots().slots.map((s) => [s.path, 'image/webp', false]));
    expect(f.rpc[1].args).toEqual({ p_trade: 'trade-1', p_extras: { v: 1, note: 'Saí no stop.', images: slots().slots.map((s) => s.id) } });
    expect(progress).toEqual(['1/2', '2/2']);
    expect(out.failed).toEqual([]);
    expect(out.savedIds).toEqual({ a: slots().slots[0].id, b: slots().slots[1].id });
    expect(out.state.images).toHaveLength(2);
  });

  it('a failed upload leaves only that image out; a saved image keeps its place', async () => {
    const s = slots().slots;
    const answer = { ...(telasJson('slots-mes') as Record<string, unknown>), slots: [(telasJson('slots-mes') as { slots: unknown[] }).slots[1]] };
    const f = fakeDb({ image_slots: answer, save_extras: extras() }, [s[1].path]);
    const out = await saveImagesAndNote(f.db, 'trade-1', { items: [{ kind: 'saved', id: s[0].id }, items()[1]] }, { codec: codec({ 'image/webp': 400 }) });
    expect(f.rpc[0].args).toMatchObject({ p_req: { keep: [s[0].id], new: [{ name: 'MES_10-38_saida.png' }] } });
    expect(f.rpc[1].args).toEqual({ p_trade: 'trade-1', p_extras: { v: 1, images: [s[0].id] } });
    expect(out.failed).toEqual([{ key: 'b', name: 'MES_10-38_saida.png', reason: 'upload' }]);
  });

  it('an unreadable file is never reserved; the note alone is saved', async () => {
    const f = fakeDb({ save_extras: extras() });
    const bad = { kind: 'new' as const, key: 'x', file: new Blob([new Uint8Array([1, 2])], { type: 'image/jpeg' }), name: 'foto.jpg', mime: 'image/jpeg' as const };
    const out = await saveImagesAndNote(f.db, 'trade-1', { items: [bad], note: 'Só a nota.' }, { codec: codec({}) });
    expect(f.rpc.map((r) => r.name)).toEqual(['save_extras']);
    expect(f.rpc[0].args).toEqual({ p_trade: 'trade-1', p_extras: { v: 1, note: 'Só a nota.', images: [] } });
    expect(out.failed).toEqual([{ key: 'x', name: 'foto.jpg', reason: 'unreadable' }]);
  });

  it('a refused reservation saves nothing and says why (code and field)', async () => {
    const f = fakeDb({ image_slots: new Error('too_many_images') });
    await expect(saveImagesAndNote(f.db, 'trade-1', { items: items() }, { codec: codec({ 'image/webp': 10 }) })).rejects.toMatchObject({ code: 'too_many_images', field: 'new' });
    expect(f.rpc.map((r) => r.name)).toEqual(['image_slots']);
    expect(f.uploads).toEqual([]);
  });

  it('more than four never leaves the browser', async () => {
    const f = fakeDb({});
    const five = Array.from({ length: 5 }, (_, k) => ({ kind: 'saved' as const, id: `id-${k}` }));
    await expect(saveImagesAndNote(f.db, 'trade-1', { items: five })).rejects.toEqual(new RegistrarDataError('too_many_images', 'images'));
    expect(f.rpc).toEqual([]);
  });

  it('empties the trash the save answers (Storage, then image_trash_done); a failure there is not the save’s', async () => {
    const f = fakeDb({ image_slots: telasJson('slots-mes'), save_extras: extras(['u/t/old.webp']), image_trash_done: { cleared: 1, remaining: 0 } });
    await saveImagesAndNote(f.db, 'trade-1', { items: items() }, { codec: codec({ 'image/webp': 400 }) });
    expect(f.removed).toEqual([['u/t/old.webp']]);
    expect(f.rpc.map((r) => r.name)).toEqual(['image_slots', 'save_extras', 'image_trash_done']);
    const g = fakeDb({ image_slots: telasJson('slots-mes'), save_extras: extras(['u/t/old.webp']), image_trash_done: new Error('network') });
    await expect(saveImagesAndNote(g.db, 'trade-1', { items: items() }, { codec: codec({ 'image/webp': 400 }) })).resolves.toMatchObject({ failed: [] });
  });
});
