/**
 * Zero-dependency RFC 1951 raw DEFLATE compressor (LZ77 + Fixed Huffman) and
 * bounded RFC 1951 INFLATE decompressor (stored, fixed, and dynamic Huffman)
 * with strict output-size limits to prevent decompression bombs.
 */

export const DEFAULT_MAX_INFLATE_BYTES = 8192;

const LEN_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
  163, 195, 227, 258,
];
const LEN_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049,
  3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

interface HuffmanTable {
  maxBits: number;
  counts: Int32Array;
  symbols: Int32Array;
}

function buildHuffmanTable(lengths: Int32Array | number[]): HuffmanTable {
  const maxBits = 15;
  const counts = new Int32Array(maxBits + 1);
  let actualMax = 0;
  for (let i = 0; i < lengths.length; i++) {
    const l = lengths[i];
    if (l < 0 || l > maxBits) {
      throw new Error('Invalid Huffman code length');
    }
    if (l > 0) {
      counts[l]++;
      if (l > actualMax) actualMax = l;
    }
  }
  const offsets = new Int32Array(maxBits + 1);
  let total = 0;
  for (let bits = 1; bits <= maxBits; bits++) {
    offsets[bits] = total;
    total += counts[bits];
  }
  const symbols = new Int32Array(total);
  for (let sym = 0; sym < lengths.length; sym++) {
    const l = lengths[sym];
    if (l > 0) {
      symbols[offsets[l]++] = sym;
    }
  }
  return { maxBits: actualMax, counts, symbols };
}

const FIXED_LIT_LENGTHS = (() => {
  const arr = new Int32Array(288);
  for (let i = 0; i <= 143; i++) arr[i] = 8;
  for (let i = 144; i <= 255; i++) arr[i] = 9;
  for (let i = 256; i <= 279; i++) arr[i] = 7;
  for (let i = 280; i <= 287; i++) arr[i] = 8;
  return arr;
})();
const FIXED_DIST_LENGTHS = new Int32Array(32).fill(5);
const FIXED_LIT_TABLE = buildHuffmanTable(FIXED_LIT_LENGTHS);
const FIXED_DIST_TABLE = buildHuffmanTable(FIXED_DIST_LENGTHS);

function decodeSymbol(
  reader: { readBits: (n: number) => number; bytes: Uint8Array; pos: number; bitBuf: number; bitCount: number },
  table: HuffmanTable,
): number {
  let code = 0;
  let first = 0;
  let index = 0;
  for (let len = 1; len <= table.maxBits; len++) {
    while (reader.bitCount < 1) {
      if (reader.pos >= reader.bytes.length) {
        throw new Error('Unexpected end of DEFLATE stream');
      }
      reader.bitBuf |= reader.bytes[reader.pos++] << reader.bitCount;
      reader.bitCount += 8;
    }
    code |= reader.bitBuf & 1;
    reader.bitBuf >>>= 1;
    reader.bitCount -= 1;

    const count = table.counts[len];
    if (code - count < first) {
      return table.symbols[index + (code - first)];
    }
    index += count;
    first += count;
    first <<= 1;
    code <<= 1;
  }
  throw new Error('Invalid Huffman symbol in DEFLATE stream');
}

/**
 * Bounded RFC 1951 raw DEFLATE decompressor.
 * Immediately aborts if output exceeds `maxOutputBytes` (anti-bomb defense).
 */
export function inflateRawBounded(
  compressed: Uint8Array,
  maxOutputBytes = DEFAULT_MAX_INFLATE_BYTES,
): Uint8Array {
  if (!(compressed instanceof Uint8Array) || compressed.length === 0) {
    throw new Error('Empty compressed DEFLATE payload');
  }
  if (maxOutputBytes < 1 || !Number.isSafeInteger(maxOutputBytes)) {
    throw new Error('Invalid maxOutputBytes');
  }

  const reader = {
    bytes: compressed,
    pos: 0,
    bitBuf: 0,
    bitCount: 0,
    readBits(n: number): number {
      while (this.bitCount < n) {
        if (this.pos >= this.bytes.length) {
          throw new Error('Unexpected end of DEFLATE stream');
        }
        this.bitBuf |= this.bytes[this.pos++] << this.bitCount;
        this.bitCount += 8;
      }
      const val = this.bitBuf & ((1 << n) - 1);
      this.bitBuf >>>= n;
      this.bitCount -= n;
      return val;
    },
    alignToByte(): void {
      const drop = this.bitCount & 7;
      this.bitBuf >>>= drop;
      this.bitCount -= drop;
    },
  };

  let out = new Uint8Array(Math.min(1024, maxOutputBytes));
  let outLen = 0;

  const ensureCapacity = (extra: number) => {
    if (outLen + extra > maxOutputBytes) {
      throw new Error(`Decompressed DEFLATE payload exceeds maximum (${maxOutputBytes} bytes)`);
    }
    if (outLen + extra > out.length) {
      const nextCap = Math.min(maxOutputBytes, Math.max(out.length * 2, outLen + extra));
      const grown = new Uint8Array(nextCap);
      grown.set(out.subarray(0, outLen));
      out = grown;
    }
  };

  let isFinal: number;
  do {
    isFinal = reader.readBits(1);
    const btype = reader.readBits(2);
    if (btype === 0) {
      reader.alignToByte();
      // Stored blocks may have leftover buffered whole bytes in bitBuf
      const bufferedBytes = reader.bitCount / 8;
      reader.pos -= bufferedBytes;
      reader.bitBuf = 0;
      reader.bitCount = 0;
      if (reader.pos + 4 > compressed.length) {
        throw new Error('Truncated stored DEFLATE block header');
      }
      const len = compressed[reader.pos] | (compressed[reader.pos + 1] << 8);
      const nlen = compressed[reader.pos + 2] | (compressed[reader.pos + 3] << 8);
      reader.pos += 4;
      if ((len ^ 0xffff) !== nlen) {
        throw new Error('Corrupt stored DEFLATE block length check');
      }
      if (reader.pos + len > compressed.length) {
        throw new Error('Truncated stored DEFLATE block data');
      }
      ensureCapacity(len);
      out.set(compressed.subarray(reader.pos, reader.pos + len), outLen);
      outLen += len;
      reader.pos += len;
    } else if (btype === 1 || btype === 2) {
      let litTable: HuffmanTable;
      let distTable: HuffmanTable;
      if (btype === 1) {
        litTable = FIXED_LIT_TABLE;
        distTable = FIXED_DIST_TABLE;
      } else {
        const hlit = reader.readBits(5) + 257;
        const hdist = reader.readBits(5) + 1;
        const hclen = reader.readBits(4) + 4;
        if (hlit > 286 || hdist > 30) {
          throw new Error('Invalid dynamic Huffman table dimensions');
        }
        const clLengths = new Int32Array(19);
        for (let i = 0; i < hclen; i++) {
          clLengths[CL_ORDER[i]] = reader.readBits(3);
        }
        const clTable = buildHuffmanTable(clLengths);
        const totalCodes = hlit + hdist;
        const codeLengths = new Int32Array(totalCodes);
        let idx = 0;
        while (idx < totalCodes) {
          const sym = decodeSymbol(reader, clTable);
          if (sym < 16) {
            codeLengths[idx++] = sym;
          } else if (sym === 16) {
            if (idx === 0) throw new Error('Invalid repeat code in dynamic Huffman');
            const rep = 3 + reader.readBits(2);
            const prev = codeLengths[idx - 1];
            if (idx + rep > totalCodes) throw new Error('Dynamic Huffman code length overflow');
            for (let k = 0; k < rep; k++) codeLengths[idx++] = prev;
          } else if (sym === 17) {
            const rep = 3 + reader.readBits(3);
            if (idx + rep > totalCodes) throw new Error('Dynamic Huffman code length overflow');
            idx += rep;
          } else if (sym === 18) {
            const rep = 11 + reader.readBits(7);
            if (idx + rep > totalCodes) throw new Error('Dynamic Huffman code length overflow');
            idx += rep;
          }
        }
        litTable = buildHuffmanTable(codeLengths.subarray(0, hlit));
        distTable = buildHuffmanTable(codeLengths.subarray(hlit, totalCodes));
      }

      while (true) {
        const sym = decodeSymbol(reader, litTable);
        if (sym < 256) {
          ensureCapacity(1);
          out[outLen++] = sym;
        } else if (sym === 256) {
          break;
        } else {
          const lenIdx = sym - 257;
          if (lenIdx < 0 || lenIdx >= LEN_BASE.length) {
            throw new Error('Invalid DEFLATE match length symbol');
          }
          const matchLen = LEN_BASE[lenIdx] + (LEN_EXTRA[lenIdx] > 0 ? reader.readBits(LEN_EXTRA[lenIdx]) : 0);
          const distSym = decodeSymbol(reader, distTable);
          if (distSym < 0 || distSym >= DIST_BASE.length) {
            throw new Error('Invalid DEFLATE match distance symbol');
          }
          const dist =
            DIST_BASE[distSym] + (DIST_EXTRA[distSym] > 0 ? reader.readBits(DIST_EXTRA[distSym]) : 0);
          if (dist > outLen || dist < 1) {
            throw new Error('DEFLATE back-reference before start of output');
          }
          ensureCapacity(matchLen);
          for (let k = 0; k < matchLen; k++) {
            out[outLen] = out[outLen - dist];
            outLen++;
          }
        }
      }
    } else {
      throw new Error('Reserved DEFLATE block type (3)');
    }
  } while (!isFinal);

  return out.subarray(0, outLen);
}

// --- Pure-TS RFC 1951 Compressor (LZ77 + Fixed Huffman) ---

function reverseBits(val: number, width: number): number {
  let out = 0;
  for (let i = 0; i < width; i++) {
    out = (out << 1) | ((val >>> i) & 1);
  }
  return out;
}

const FIXED_LIT_CODES = (() => {
  const codes = new Uint16Array(288);
  const lens = FIXED_LIT_LENGTHS;
  for (let i = 0; i <= 143; i++) codes[i] = reverseBits(0x30 + i, 8);
  for (let i = 144; i <= 255; i++) codes[i] = reverseBits(0x190 + (i - 144), 9);
  for (let i = 256; i <= 279; i++) codes[i] = reverseBits(i - 256, 7);
  for (let i = 280; i <= 287; i++) codes[i] = reverseBits(0xc0 + (i - 280), 8);
  return { codes, lens };
})();

function findLengthCode(len: number): { code: number; extraBits: number; extraVal: number } {
  for (let i = LEN_BASE.length - 1; i >= 0; i--) {
    if (len >= LEN_BASE[i]) {
      return {
        code: 257 + i,
        extraBits: LEN_EXTRA[i],
        extraVal: len - LEN_BASE[i],
      };
    }
  }
  throw new Error(`Invalid LZ77 length ${len}`);
}

function findDistCode(dist: number): { code: number; extraBits: number; extraVal: number } {
  for (let i = DIST_BASE.length - 1; i >= 0; i--) {
    if (dist >= DIST_BASE[i]) {
      return {
        code: i,
        extraBits: DIST_EXTRA[i],
        extraVal: dist - DIST_BASE[i],
      };
    }
  }
  throw new Error(`Invalid LZ77 distance ${dist}`);
}

/**
 * Compresses bytes using RFC 1951 raw DEFLATE (LZ77 + Fixed Huffman).
 * Ideal for <8 KiB CBOR proof envelopes with near-zero header overhead.
 */
export function deflateRawFixed(input: Uint8Array): Uint8Array {
  const out: number[] = [];
  let bitBuf = 0;
  let bitCount = 0;

  const writeBits = (val: number, len: number) => {
    bitBuf |= val << bitCount;
    bitCount += len;
    while (bitCount >= 8) {
      out.push(bitBuf & 0xff);
      bitBuf >>>= 8;
      bitCount -= 8;
    }
  };

  // Single final block (BFINAL=1, BTYPE=01 fixed Huffman)
  writeBits(1, 1);
  writeBits(1, 2);

  const hashHead = new Int32Array(4096).fill(-1);
  const n = input.length;
  let i = 0;

  const insertHash = (pos: number) => {
    if (pos + 2 >= n) return;
    const h = ((input[pos] << 4) ^ (input[pos + 1] << 2) ^ input[pos + 2]) & 0xfff;
    hashHead[h] = pos;
  };

  while (i < n) {
    let bestLen = 0;
    let bestDist = 0;
    if (i + 2 < n) {
      const h = ((input[i] << 4) ^ (input[i + 1] << 2) ^ input[i + 2]) & 0xfff;
      const cand = hashHead[h];
      if (cand >= 0 && i - cand <= 32768 && i - cand >= 1) {
        let m = 0;
        const maxM = Math.min(258, n - i);
        while (m < maxM && input[cand + m] === input[i + m]) {
          m++;
        }
        if (m >= 3) {
          bestLen = m;
          bestDist = i - cand;
        }
      }
    }

    if (bestLen >= 3) {
      const lc = findLengthCode(bestLen);
      writeBits(FIXED_LIT_CODES.codes[lc.code], FIXED_LIT_CODES.lens[lc.code]);
      if (lc.extraBits > 0) writeBits(lc.extraVal, lc.extraBits);

      const dc = findDistCode(bestDist);
      writeBits(reverseBits(dc.code, 5), 5);
      if (dc.extraBits > 0) writeBits(dc.extraVal, dc.extraBits);

      for (let k = 0; k < bestLen; k++) {
        insertHash(i + k);
      }
      i += bestLen;
    } else {
      const b = input[i];
      writeBits(FIXED_LIT_CODES.codes[b], FIXED_LIT_CODES.lens[b]);
      insertHash(i);
      i++;
    }
  }

  // End-of-block symbol 256
  writeBits(FIXED_LIT_CODES.codes[256], FIXED_LIT_CODES.lens[256]);
  if (bitCount > 0) {
    out.push(bitBuf & 0xff);
  }
  return new Uint8Array(out);
}
