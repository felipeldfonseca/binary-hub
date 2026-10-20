/**
 * «Imagens e nota»: the images' way from the file the owner picks to the private bucket
 * (registrar.md §12, D17, D33; migration 20261020000002_trade_images.sql).
 *
 *   1. On choosing: imageMimeOf (PNG, JPEG or WebP, by type or extension; HEIC and the rest are
 *      refused with «Só imagens PNG, JPG ou WebP.»), the 10 MB rule on the chosen file
 *      (MAX_IMAGE_BYTES), uniqueImageName for pasted screenshots («image (2).png»),
 *      formatImageSize for «840 KB» / «1,2 MB».
 *   2. On «Salvar imagens e nota»: prepareImage re-encodes each new image in the browser (WebP, or
 *      JPEG where the browser cannot write WebP, longest side ≤ 4096 px), which drops the camera's
 *      metadata (location). A PNG or WebP whose re-encoding is larger keeps its own pixels; a JPEG
 *      is never uploaded as chosen. Whenever the file's own bytes go up, their metadata goes first
 *      (stripImageMetadata: JPEG APP1/APP13 apart from the orientation, PNG text and eXIf chunks,
 *      WebP EXIF and XMP chunks).
 *   3. saveImagesAndNote: image_slots reserves one path per new image (four in all, the database
 *      checks it three times), each prepared file is uploaded with the user's session (plain
 *      upload, never upsert), save_extras saves the final ordered list and the note with one
 *      saved_at, and the files the database queued for removal leave Storage (drainImageTrash).
 *      A failed upload does not stop the others: what was uploaded is saved, the failed ones come
 *      back in `failed` («Não foi possível enviar {nome}.») to be sent again by the next save.
 *
 * Pure except browserCodec (canvas) and saveImagesAndNote (the client it is given).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { IMAGE_MIMES, MAX_IMAGES, MAX_IMAGE_BYTES, extrasPayload, imageName, imageSlotsRequest, type ImageMime } from '@/lib/domain/registro';
import { RegistrarDataError, drainImageTrash, imageSlots, saveExtras, toRegistrarError, uploadImage, type TradeState } from './registrarDb';

export { MAX_IMAGES, MAX_IMAGE_BYTES };

/** The picker's `accept` (no `capture`: most attachments are screenshots; D17) */
export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';

/** The longest side a re-encoded image keeps, and the most pixels a phone's canvas takes */
export const MAX_IMAGE_SIDE = 4096;
export const MAX_IMAGE_PIXELS = 4096 * 4096;

/** Quality of the browser's re-encoding (WebP and JPEG) */
export const IMAGE_QUALITY = 0.9;

// ---------------------------------------------------------------------------------------------
// Choosing
// ---------------------------------------------------------------------------------------------

/**
 * The image type of a chosen file: its type when it is PNG, JPEG or WebP; a file with no type
 * passes by its extension (.png, .jpg, .jpeg, .webp; RO `tipoOk`). Anything else (HEIC from
 * «Arquivos», GIF) is null: «Só imagens PNG, JPG ou WebP.»
 */
export function imageMimeOf(file: { type?: string | null; name?: string | null }): ImageMime | null {
  const type = String(file.type ?? '').toLowerCase();
  if ((IMAGE_MIMES as readonly string[]).includes(type)) return type as ImageMime;
  if (type) return null;
  const m = /\.(png|jpe?g|webp)$/i.exec(String(file.name ?? ''));
  if (!m) return null;
  const ext = m[1].toLowerCase();
  return ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
}

const NBSP = '\u00a0';

/** «840 KB» / «1,2 MB» (RO `tam`: at least 1 KB; one decimal from 1 MiB on) */
export function formatImageSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(Math.round((bytes / 1048576) * 10) / 10).toFixed(1).replace('.', ',')}${NBSP}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}${NBSP}KB`;
}

/**
 * A name not already in the list: pasted screenshots all arrive as «image.png» and become
 * «image (2).png», «image (3).png» (RO `incluir`).
 */
export function uniqueImageName(name: string, taken: readonly string[]): string {
  let out = name;
  for (let j = 2; taken.includes(out); j++) out = name.replace(/(\.\w+)?$/, ` (${j})$1`);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Metadata out of the bytes
// ---------------------------------------------------------------------------------------------

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]);
const u32le = (b: Uint8Array, i: number) => ((b[i + 3] << 24) >>> 0) + ((b[i + 2] << 16) | (b[i + 1] << 8) | b[i]);
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...Array.from(b.subarray(i, i + n)));

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** The EXIF orientation (1–8) inside an APP1 segment's data («Exif\0\0» + TIFF), or null */
function exifOrientation(seg: Uint8Array): number | null {
  if (seg.length < 14 || ascii(seg, 0, 6) !== 'Exif\0\0') return null;
  const t = 6;
  const order = ascii(seg, t, 2);
  if (order !== 'II' && order !== 'MM') return null;
  const le = order === 'II';
  const r16 = (i: number) => (le ? seg[i] | (seg[i + 1] << 8) : u16be(seg, i));
  const r32 = (i: number) => (le ? u32le(seg, i) : u32be(seg, i));
  if (t + 8 > seg.length) return null;
  const ifd = t + r32(t + 4);
  if (ifd + 2 > seg.length) return null;
  const n = r16(ifd);
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > seg.length) return null;
    if (r16(e) === 0x0112) {
      const v = r16(e + 8);
      return v >= 1 && v <= 8 ? v : null;
    }
  }
  return null;
}

/** An APP1 segment holding only the orientation (big-endian TIFF, one IFD entry) */
function orientationSegment(o: number): Uint8Array {
  const data = [
    ...Array.from('Exif\0\0', (c) => c.charCodeAt(0)),
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // TIFF header, IFD0 at 8
    0x00, 0x01, // one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, o, 0x00, 0x00, // Orientation, SHORT, 1, value
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ];
  const len = data.length + 2;
  return Uint8Array.from([0xff, 0xe1, len >> 8, len & 0xff, ...data]);
}

/**
 * A JPEG without its APP1 (EXIF, GPS, XMP) and APP13 (IPTC) segments; the orientation, when the
 * EXIF had one, is kept in a minimal APP1 so the photo does not turn. Null when the bytes are not
 * a JPEG this can walk.
 */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let orientation: number | null = null;
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    let marker = bytes[i + 1];
    // Fill bytes
    while (marker === 0xff && i + 2 < bytes.length) {
      i += 1;
      marker = bytes[i + 1];
    }
    if (marker === 0xd9) {
      parts.push(bytes.subarray(i));
      break;
    }
    // Start of scan: the rest is image data (and the end marker)
    if (marker === 0xda) {
      parts.push(bytes.subarray(i));
      break;
    }
    // Markers without a length
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(bytes.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 4 > bytes.length) return null;
    const len = u16be(bytes, i + 2);
    if (len < 2 || i + 2 + len > bytes.length) return null;
    const seg = bytes.subarray(i, i + 2 + len);
    if (marker === 0xe1) {
      orientation = orientation ?? exifOrientation(bytes.subarray(i + 4, i + 2 + len));
    } else if (marker !== 0xed) {
      parts.push(seg);
    }
    i += 2 + len;
  }
  // After SOI and, when present, the JFIF APP0 that must follow it
  if (orientation !== null && orientation !== 1) {
    const at = parts.length > 1 && parts[1][0] === 0xff && parts[1][1] === 0xe0 ? 2 : 1;
    parts.splice(at, 0, orientationSegment(orientation));
  }
  return concat(parts);
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_DROP = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);

/** A PNG without its eXIf and text chunks (XMP, comments, the capture time); null when not a PNG */
export function stripPngMetadata(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 8 || PNG_SIGNATURE.some((b, k) => bytes[k] !== b)) return null;
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let i = 8;
  while (i < bytes.length) {
    if (i + 12 > bytes.length) return null;
    const len = u32be(bytes, i);
    const type = ascii(bytes, i + 4, 4);
    const end = i + 12 + len;
    if (end > bytes.length) return null;
    if (!PNG_DROP.has(type)) parts.push(bytes.subarray(i, end));
    i = end;
    if (type === 'IEND') break;
  }
  return concat(parts);
}

/** A WebP without its EXIF and XMP chunks (and their flags in VP8X); null when not a WebP */
export function stripWebpMetadata(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 12 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return null;
  const parts: Uint8Array[] = [];
  let i = 12;
  while (i < bytes.length) {
    if (i + 8 > bytes.length) return null;
    const type = ascii(bytes, i, 4);
    const size = u32le(bytes, i + 4);
    const end = i + 8 + size + (size % 2);
    if (i + 8 + size > bytes.length) return null;
    const chunk = bytes.slice(i, Math.min(end, bytes.length));
    if (type === 'VP8X' && chunk.length > 8) chunk[8] &= ~(0x08 | 0x04);
    if (type !== 'EXIF' && type !== 'XMP ') parts.push(chunk);
    i = end;
  }
  const body = concat(parts);
  const size = body.length + 4;
  const head = Uint8Array.from([0x52, 0x49, 0x46, 0x46, size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, (size >>> 24) & 0xff, 0x57, 0x45, 0x42, 0x50]);
  return concat([head, body]);
}

/** The file's bytes without their metadata, by type; null when they cannot be walked */
export function stripImageMetadata(bytes: Uint8Array, mime: ImageMime): Uint8Array | null {
  return mime === 'image/jpeg' ? stripJpegMetadata(bytes) : mime === 'image/png' ? stripPngMetadata(bytes) : stripWebpMetadata(bytes);
}

// ---------------------------------------------------------------------------------------------
// Preparing a file for upload
// ---------------------------------------------------------------------------------------------

/** What the browser's canvas can do with an image (injectable for tests) */
export interface ImageCodec {
  /**
   * Draws the image at most MAX_IMAGE_SIDE on its longest side (and MAX_IMAGE_PIXELS) and writes it
   * as `type`; the blob may come back of another type (a browser without a WebP writer gives PNG),
   * or null when the image could not be decoded or written
   */
  encode(file: Blob, type: 'image/webp' | 'image/jpeg', quality: number): Promise<Blob | null>;
  bytes(blob: Blob): Promise<Uint8Array>;
}

export interface PreparedImage {
  blob: Blob;
  mime: ImageMime;
  bytes: number;
  /** webp/jpeg: re-encoded; original: the file's own pixels without their metadata */
  how: 'webp' | 'jpeg' | 'original';
}

export class PrepareImageError extends Error {
  /** unreadable: neither the browser nor the byte walk could read it; too_large: above 10 MB */
  readonly reason: 'unreadable' | 'too_large';
  constructor(reason: 'unreadable' | 'too_large') {
    super(reason);
    this.name = 'PrepareImageError';
    this.reason = reason;
  }
}

/**
 * The file to upload for a chosen image (D33): the browser's WebP (else JPEG) when it is not
 * larger than the file, or always for a JPEG; otherwise, or when the browser cannot re-encode, the
 * file's own bytes without their metadata (also for a JPEG whose re-encoding came out larger: it
 * is never sent with its EXIF). Never above MAX_IMAGE_BYTES.
 */
export async function prepareImage(file: Blob, mime: ImageMime, codec: ImageCodec = browserCodec()): Promise<PreparedImage> {
  let encoded: { blob: Blob; mime: 'image/webp' | 'image/jpeg' } | null = null;
  for (const type of ['image/webp', 'image/jpeg'] as const) {
    let blob: Blob | null = null;
    try {
      blob = await codec.encode(file, type, IMAGE_QUALITY);
    } catch {
      blob = null;
    }
    if (blob && blob.type === type && blob.size > 0) {
      encoded = { blob, mime: type };
      break;
    }
  }
  // Re-encoded and not larger: done. Larger (any type) or not re-encoded: the file's own bytes,
  // without their metadata (a JPEG is then never sent with its EXIF)
  if (encoded && encoded.blob.size <= file.size) return done(encoded.blob, encoded.mime, encoded.mime === 'image/webp' ? 'webp' : 'jpeg');
  let raw: Uint8Array;
  try {
    raw = await codec.bytes(file);
  } catch {
    throw new PrepareImageError('unreadable');
  }
  const stripped = stripImageMetadata(raw, mime);
  if (!stripped) {
    if (encoded) return done(encoded.blob, encoded.mime, encoded.mime === 'image/webp' ? 'webp' : 'jpeg');
    throw new PrepareImageError('unreadable');
  }
  return done(new Blob([stripped as BlobPart], { type: mime }), mime, 'original');
}

function done(blob: Blob, mime: ImageMime, how: PreparedImage['how']): PreparedImage {
  if (blob.size > MAX_IMAGE_BYTES) throw new PrepareImageError('too_large');
  return { blob, mime, bytes: blob.size, how };
}

/** The size an image is drawn at: longest side ≤ MAX_IMAGE_SIDE and ≤ MAX_IMAGE_PIXELS, never enlarged */
export function drawSize(width: number, height: number): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const k = Math.min(1, MAX_IMAGE_SIDE / Math.max(width, height), Math.sqrt(MAX_IMAGE_PIXELS / (width * height)));
  return { width: Math.max(1, Math.floor(width * k)), height: Math.max(1, Math.floor(height * k)) };
}

/** The browser's canvas (createImageBitmap applies the EXIF orientation to the pixels) */
export function browserCodec(): ImageCodec {
  return {
    async encode(file, type, quality) {
      if (typeof createImageBitmap !== 'function') return null;
      let bitmap: ImageBitmap;
      try {
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch {
        return null;
      }
      try {
        const size = drawSize(bitmap.width, bitmap.height);
        if (!size.width) return null;
        if (typeof OffscreenCanvas === 'function') {
          const canvas = new OffscreenCanvas(size.width, size.height);
          const ctx = canvas.getContext('2d');
          if (!ctx) return null;
          ctx.drawImage(bitmap, 0, 0, size.width, size.height);
          return await canvas.convertToBlob({ type, quality });
        }
        if (typeof document === 'undefined') return null;
        const canvas = document.createElement('canvas');
        canvas.width = size.width;
        canvas.height = size.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(bitmap, 0, 0, size.width, size.height);
        return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
      } finally {
        bitmap.close();
      }
    },
    async bytes(blob) {
      return new Uint8Array(await blob.arrayBuffer());
    },
  };
}

// ---------------------------------------------------------------------------------------------
// «Salvar imagens e nota»
// ---------------------------------------------------------------------------------------------

/** One image of the editor's list, in the order the owner sees it */
export type ImageItem =
  | { kind: 'saved'; id: string }
  | {
      kind: 'new';
      /** The editor's own key for it (kept across retries) */
      key: string;
      file: Blob;
      /** The name shown («MES_10-07_entrada.png»), kept as the image's name (≤ 120, imageName) */
      name: string;
      /** imageMimeOf the chosen file */
      mime: ImageMime;
    };

export interface SaveImagesInput {
  /** The final list, at most four (saved ones kept, new ones to send), in order */
  items: readonly ImageItem[];
  /** The note: undefined = unchanged; null or '' (or only spaces) removes it */
  note?: string | null;
}

/** «Enviando 1 de 2…» */
export interface SaveProgress {
  sending: number;
  total: number;
}

export interface FailedImage {
  key: string;
  name: string;
  /** unreadable / too_large: the file; upload: Storage refused or the network failed */
  reason: 'unreadable' | 'too_large' | 'upload';
}

export interface SaveImagesResult {
  state: TradeState;
  /** The save's one time («2 imagens e nota salvas às 10:21.») */
  savedAt: Date;
  noteSavedAt: Date | null;
  /** New images that were not saved («Não foi possível enviar {nome}.»): send them again with the next save */
  failed: FailedImage[];
  /** The id each new image got (by its key) */
  savedIds: Record<string, string>;
}

export interface SaveImagesOptions {
  onProgress?: (p: SaveProgress) => void;
  codec?: ImageCodec;
}

/**
 * «Salvar imagens e nota»: prepares the new images, reserves their paths (image_slots), uploads
 * them one by one, saves the list and the note (save_extras) and empties the trash. A refusal of
 * the reservation or of the save (too_many_images, storage_quota, not_hub_member, network…) throws
 * a RegistrarDataError and saves nothing; a failed upload only leaves that image out.
 */
export async function saveImagesAndNote(
  db: SupabaseClient,
  tradeId: string,
  input: SaveImagesInput,
  options: SaveImagesOptions = {},
): Promise<SaveImagesResult> {
  if (input.items.length > MAX_IMAGES) throw new RegistrarDataError('too_many_images', 'images');
  const codec = options.codec ?? browserCodec();
  const failed: FailedImage[] = [];
  const prepared = new Map<string, { item: Extract<ImageItem, { kind: 'new' }>; image: PreparedImage }>();
  for (const item of input.items) {
    if (item.kind !== 'new') continue;
    try {
      prepared.set(item.key, { item, image: await prepareImage(item.file, item.mime, codec) });
    } catch (e) {
      failed.push({ key: item.key, name: item.name, reason: e instanceof PrepareImageError ? e.reason : 'unreadable' });
    }
  }
  const keep = input.items.filter((i): i is Extract<ImageItem, { kind: 'saved' }> => i.kind === 'saved').map((i) => i.id);
  const toSend = Array.from(prepared.values());
  const savedIds: Record<string, string> = {};
  if (toSend.length > 0) {
    const slots = await imageSlots(
      db,
      tradeId,
      imageSlotsRequest(keep, toSend.map(({ item, image }) => ({ mime: image.mime, bytes: image.bytes, name: imageName(item.name) }))),
    );
    if (slots.slots.length !== toSend.length) throw new RegistrarDataError('bad_answer');
    for (let k = 0; k < toSend.length; k++) {
      const { item, image } = toSend[k];
      const slot = slots.slots[k];
      options.onProgress?.({ sending: k + 1, total: toSend.length });
      try {
        await uploadImage(db, slot, image.blob);
        savedIds[item.key] = slot.id;
      } catch {
        failed.push({ key: item.key, name: item.name, reason: 'upload' });
      }
    }
  }
  const images = input.items
    .map((i) => (i.kind === 'saved' ? i.id : savedIds[i.key]))
    .filter((id): id is string => typeof id === 'string');
  const saved = await saveExtras(db, tradeId, extrasPayload({ images, note: input.note }));
  // The removed and replaced files leave Storage; a failure waits for the next sweep
  if (saved.trash.length > 0) {
    try {
      await drainImageTrash(db, saved.trash);
    } catch (e) {
      void toRegistrarError(e);
    }
  }
  // In the editor's order
  const order = new Map(input.items.map((i, k) => [i.kind === 'new' ? i.key : `saved:${i.id}`, k]));
  failed.sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));
  return { state: saved.state, savedAt: saved.savedAt, noteSavedAt: saved.noteSavedAt, failed, savedIds };
}
