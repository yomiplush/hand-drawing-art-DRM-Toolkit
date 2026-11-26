/**
 * RFC 9285 Base45 encoding/decoding for ultra-compact QR Alphanumeric mode.
 * Alphabet: 0-9, A-Z, space, $, %, *, +, -, ., /, : (all 45 chars in QR Alphanumeric mode).
 */

const BASE45_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

const BASE45_DECODE_MAP = new Int8Array(128).fill(-1);
for (let i = 0; i < BASE45_CHARSET.length; i++) {
  BASE45_DECODE_MAP[BASE45_CHARSET.charCodeAt(i)] = i;
}

export function base45Encode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 2) {
    if (i + 1 < bytes.length) {
      const x = (bytes[i] << 8) + bytes[i + 1];
      const e = Math.floor(x / 2025);
      const rem = x % 2025;
      const d = Math.floor(rem / 45);
      const c = rem % 45;
      out += BASE45_CHARSET[c] + BASE45_CHARSET[d] + BASE45_CHARSET[e];
    } else {
      const x = bytes[i];
      const d = Math.floor(x / 45);
      const c = x % 45;
      out += BASE45_CHARSET[c] + BASE45_CHARSET[d];
    }
  }
  return out;
}

export function base45Decode(input: string): Uint8Array {
  // Mobile browsers may percent-encode spaces in URL fragments as %20
  const normalized = input.replace(/%20/gi, ' ').toUpperCase();
  const len = normalized.length;
  if (len % 3 === 1) {
    throw new Error('Invalid Base45 string length');
  }

  const out: number[] = [];
  for (let i = 0; i < len; i += 3) {
    const cCode = normalized.charCodeAt(i);
    const dCode = normalized.charCodeAt(i + 1);
    const c = cCode < 128 ? BASE45_DECODE_MAP[cCode] : -1;
    const d = dCode < 128 ? BASE45_DECODE_MAP[dCode] : -1;
    if (c < 0 || d < 0) {
      throw new Error('Invalid Base45 character');
    }

    if (i + 2 < len) {
      const eCode = normalized.charCodeAt(i + 2);
      const e = eCode < 128 ? BASE45_DECODE_MAP[eCode] : -1;
      if (e < 0) {
        throw new Error('Invalid Base45 character');
      }
      const x = c + d * 45 + e * 2025;
      if (x > 65535) {
        throw new Error('Base45 value overflow');
      }
      out.push(x >> 8, x & 0xff);
    } else {
      const x = c + d * 45;
      if (x > 255) {
        throw new Error('Base45 value overflow');
      }
      out.push(x);
    }
  }

  return new Uint8Array(out);
}
