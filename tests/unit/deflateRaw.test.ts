import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { deflateRawFixed, inflateRawBounded } from '../../src/core/manifest/deflateRaw';

function expectBytesEqual(actual: Uint8Array, expected: Uint8Array, label: string): void {
  if (actual.length !== expected.length) {
    throw new Error(`${label}: length ${actual.length} !== ${expected.length}`);
  }
  for (let i = 0; i < expected.length; i++) {
    if (actual[i] !== expected[i]) {
      throw new Error(
        `${label}: mismatch at byte ${i}: actual=${actual[i]} expected=${expected[i]}`,
      );
    }
  }
  expect(Array.from(actual)).toEqual(Array.from(expected));
}

describe('RFC 1951 deflateRawFixed & inflateRawBounded', () => {
  it('round-trips empty, repetitive, CBOR-like, and incompressible buffers cleanly', () => {
    const encoder = new TextEncoder();
    const cases = [
      new Uint8Array(0),
      new Uint8Array([42]),
      new Uint8Array(256).fill(0x41),
      encoder.encode(
        'https://certified-handmade.com/verify#proof=hello-https://x.com/yomiplush-https://x.com/yomiplush-https://bsky.app/profile/yomiplush.bsky.social',
      ),
      new Uint8Array(Array.from({ length: 600 }, (_, i) => (i * 73 + 19) & 0xff)),
    ];

    cases.forEach((input, idx) => {
      const compressed = deflateRawFixed(input);
      // Verify Node's zlib.inflateRawSync accepts our compressed output!
      const viaNode = new Uint8Array(zlib.inflateRawSync(compressed));
      expectBytesEqual(viaNode, input, `case-${idx}-viaNode`);

      // Verify our bounded inflator decodes our compressed output!
      const viaLocal = inflateRawBounded(compressed, 8192);
      expectBytesEqual(viaLocal, input, `case-${idx}-viaLocal`);
    });
  });

  it('decodes Node zlib stored blocks and dynamic Huffman blocks cleanly', () => {
    const encoder = new TextEncoder();
    const repetitive = encoder.encode(
      Array.from(
        { length: 40 },
        (_, i) => `item-${i % 5}:https://x.com/artist_handle,software=Krita 5.2,device=Wacom Cintiq;`,
      ).join('\n'),
    );

    // Dynamic Huffman from zlib default compression
    const dynamicDeflated = new Uint8Array(zlib.deflateRawSync(repetitive, { level: 9 }));
    expectBytesEqual(inflateRawBounded(dynamicDeflated, 8192), repetitive, 'dynamic');

    // Stored block (level 0) from zlib
    const storedDeflated = new Uint8Array(zlib.deflateRawSync(repetitive, { level: 0 }));
    expectBytesEqual(inflateRawBounded(storedDeflated, 8192), repetitive, 'stored');
  });

  it('aborts immediately on decompression bombs exceeding maxOutputBytes', () => {
    const big = new Uint8Array(20_000).fill(0x5a);
    const bomb = new Uint8Array(zlib.deflateRawSync(big, { level: 9 }));
    expect(bomb.length).toBeLessThan(120);
    expect(() => inflateRawBounded(bomb, 8192)).toThrow(/exceeds maximum/);
  });

  it('rejects malformed or truncated DEFLATE streams', () => {
    expect(() => inflateRawBounded(new Uint8Array(0))).toThrow();
    expect(() => inflateRawBounded(new Uint8Array([0xff]))).toThrow();
    const valid = deflateRawFixed(new TextEncoder().encode('hello world'));
    expect(() => inflateRawBounded(valid.subarray(0, valid.length - 1))).toThrow();
  });
});
