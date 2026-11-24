import { encode as cborEncode, rfc8949EncodeOptions } from 'cborg';

export function cborEncodeShim(value: unknown): Uint8Array {
  return cborEncode(value, rfc8949EncodeOptions);
}
