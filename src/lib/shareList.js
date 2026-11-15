/**
 * "Trimite lista": a profile's avoid list in a link, so a family member can
 * import it with one tap. The list travels in the URL FRAGMENT (#import=…),
 * which browsers never send to a server; compressed (deflate-raw) and
 * base64url-encoded. Opening the link shows a preview; nothing is imported
 * without confirmation.
 */
import { sanitizeAvoidState } from './avoidList.js';
import { AVOID_PRESETS } from '../data/avoidPresets.js';

export const HASH_KEY = 'import=';
export const MAX_LINK_CHARS = 6000; // well under what messaging apps and browsers handle

const toB64url = (bytes) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (str) => {
  const b = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

async function pipe(bytes, Stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(new Stream('deflate-raw')));
  return new Uint8Array(await out.arrayBuffer());
}

/** Only what is needed: presets switched on, own terms, allergens to highlight. */
export function listPayload(name, avoid) {
  const s = sanitizeAvoidState(avoid);
  return {
    v: 1,
    n: String(name || '').slice(0, 24),
    p: Object.keys(s.presets).filter((k) => s.presets[k]),
    c: s.custom.map((c) => ({ t: c.terms, y: c.types })),
    a: s.allergens,
  };
}

/** Back to {name, avoid} (cleaned like any stored list). */
export function fromPayload(data) {
  if (!data || data.v !== 1) throw new Error('invalid');
  const on = new Set(Array.isArray(data.p) ? data.p : []);
  const avoid = sanitizeAvoidState({
    presets: Object.fromEntries(AVOID_PRESETS.map((p) => [p.id, on.has(p.id)])), // not in the link = off
    custom: (Array.isArray(data.c) ? data.c : []).map((c, i) => ({ id: `s${i}`, terms: c.t, types: c.y })),
    allergens: data.a,
  });
  return { name: String(data.n || '').slice(0, 24), avoid };
}

/** "#import=…" fragment for a list (compressed when the browser can). */
export async function encodeList(name, avoid, { CompressionStreamImpl = globalThis.CompressionStream } = {}) {
  const json = new TextEncoder().encode(JSON.stringify(listPayload(name, avoid)));
  if (CompressionStreamImpl) return `${HASH_KEY}z${toB64url(await pipe(json, CompressionStreamImpl))}`;
  return `${HASH_KEY}j${toB64url(json)}`;
}

/**
 * Reads a fragment made by encodeList(); null when the hash is not an import.
 * @throws Error('invalid') for a damaged link
 */
export async function decodeList(hash, { DecompressionStreamImpl = globalThis.DecompressionStream } = {}) {
  const h = String(hash || '').replace(/^#/, '');
  if (!h.startsWith(HASH_KEY)) return null;
  const body = h.slice(HASH_KEY.length);
  try {
    let bytes = fromB64url(body.slice(1));
    if (body[0] === 'z') bytes = await pipe(bytes, DecompressionStreamImpl);
    else if (body[0] !== 'j') throw new Error('kind');
    return fromPayload(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    throw new Error('invalid');
  }
}
