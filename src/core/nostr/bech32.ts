const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32_GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const BECH32_CONST = 1;

function polymod(values: number[]): number {
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((top >>> i) & 1) {
        chk ^= BECH32_GEN[i];
      }
    }
  }
  return chk >>> 0;
}

function hrpExpand(hrp: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hrp.length; i++) {
    out.push(hrp.charCodeAt(i) >>> 5);
  }
  out.push(0);
  for (let i = 0; i < hrp.length; i++) {
    out.push(hrp.charCodeAt(i) & 31);
  }
  return out;
}

function verifyChecksum(hrp: string, data: number[]): boolean {
  return polymod([...hrpExpand(hrp), ...data]) === BECH32_CONST;
}

function createChecksum(hrp: string, data: number[]): number[] {
  const values = [...hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0];
  const mod = polymod(values) ^ BECH32_CONST;
  const ret: number[] = [];
  for (let i = 0; i < 6; i++) {
    ret.push((mod >>> (5 * (5 - i))) & 31);
  }
  return ret;
}

export function convertBits(
  data: ArrayLike<number>,
  fromBits: number,
  toBits: number,
  pad: boolean,
): number[] {
  let acc = 0;
  let bits = 0;
  const ret: number[] = [];
  const maxv = (1 << toBits) - 1;
  for (let i = 0; i < data.length; i++) {
    const value = data[i];
    if (value < 0 || value >> fromBits !== 0) {
      throw new Error('Invalid Bech32 bit-group value');
    }
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >>> bits) & maxv);
    }
  }
  if (pad) {
    if (bits > 0) {
      ret.push((acc << (toBits - bits)) & maxv);
    }
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv) !== 0) {
    throw new Error('Invalid Bech32 padding bits');
  }
  return ret;
}

export function encodeBech32(hrp: string, bytes: Uint8Array): string {
  if (!hrp || hrp.length > 83) {
    throw new Error('Invalid Bech32 human-readable part');
  }
  const lowerHrp = hrp.toLowerCase();
  for (let i = 0; i < lowerHrp.length; i++) {
    const c = lowerHrp.charCodeAt(i);
    if (c < 33 || c > 126) {
      throw new Error('Invalid Bech32 HRP character');
    }
  }
  const words = convertBits(bytes, 8, 5, true);
  const checksum = createChecksum(lowerHrp, words);
  let out = `${lowerHrp}1`;
  for (const w of words) {
    out += BECH32_CHARSET[w];
  }
  for (const c of checksum) {
    out += BECH32_CHARSET[c];
  }
  return out;
}

export function decodeBech32(
  input: string,
  expectedHrp?: string,
  maxLength = 512,
): { hrp: string; bytes: Uint8Array } {
  const trimmed = input.trim();
  if (trimmed.length < 8 || trimmed.length > maxLength) {
    throw new Error('Invalid Bech32 string length');
  }
  let hasLower = false;
  let hasUpper = false;
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if (code < 33 || code > 126) {
      throw new Error('Invalid character in Bech32 string');
    }
    if (code >= 97 && code <= 122) hasLower = true;
    if (code >= 65 && code <= 90) hasUpper = true;
  }
  if (hasLower && hasUpper) {
    throw new Error('Mixed-case Bech32 string is invalid');
  }
  const normalized = trimmed.toLowerCase();
  const sepIndex = normalized.lastIndexOf('1');
  if (sepIndex < 1 || sepIndex + 7 > normalized.length) {
    throw new Error('Invalid Bech32 separator position');
  }
  const hrp = normalized.slice(0, sepIndex);
  if (expectedHrp && hrp !== expectedHrp) {
    throw new Error(`Expected Bech32 prefix "${expectedHrp}", got "${hrp}"`);
  }
  const dataPart = normalized.slice(sepIndex + 1);
  const words: number[] = [];
  for (let i = 0; i < dataPart.length; i++) {
    const idx = BECH32_CHARSET.indexOf(dataPart[i]);
    if (idx === -1) {
      throw new Error('Invalid character in Bech32 data section');
    }
    words.push(idx);
  }
  if (!verifyChecksum(hrp, words)) {
    throw new Error('Invalid Bech32 checksum');
  }
  const payloadWords = words.slice(0, -6);
  const rawBytes = convertBits(payloadWords, 5, 8, false);
  return { hrp, bytes: new Uint8Array(rawBytes) };
}
