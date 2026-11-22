import { describe, expect, it } from 'vitest';
import {
  base64UrlDecode,
  base64UrlEncode,
  bytesToHex,
  computePublicKeyFingerprint,
  decryptKeyBackup,
  derivePublicKeyFromSeed,
  encryptKeyBackup,
  generateEd25519KeyMaterial,
  hexToBytes,
  sha256,
  signWithSeed,
  verifyEd25519Signature,
} from '../../src/core/crypto';

describe('SHA-256 and binary encodings', () => {
  it('computes NIST SHA-256 vectors accurately', async () => {
    const emptyDigest = await sha256(new Uint8Array(0));
    expect(bytesToHex(emptyDigest)).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );

    const abcDigest = await sha256(new TextEncoder().encode('abc'));
    expect(bytesToHex(abcDigest)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('round-trips base64url and rejects non-canonical or invalid inputs', () => {
    const raw = new Uint8Array([0, 1, 2, 253, 254, 255]);
    const enc = base64UrlEncode(raw);
    expect(enc).not.toMatch(/[+/=]/);
    expect(base64UrlDecode(enc)).toEqual(raw);

    expect(() => base64UrlDecode('')).toThrow();
    expect(() => base64UrlDecode('abc+')).toThrow();
    expect(() => base64UrlDecode('a')).toThrow();
    // Non-canonical trailing bits ('AB' for 1 byte has non-zero unused low bits vs 'AA')
    expect(() => base64UrlDecode('AB')).toThrow();
  });

  it('round-trips hex encoding', () => {
    const sample = hexToBytes('00ff10a5');
    expect(sample).toEqual(new Uint8Array([0x00, 0xff, 0x10, 0xa5]));
    expect(bytesToHex(sample)).toBe('00ff10a5');
    expect(() => hexToBytes('abc')).toThrow();
    expect(() => hexToBytes('zzzz')).toThrow();
  });
});

describe('Ed25519 signing, verification, and encrypted backup', () => {
  it('signs and verifies messages and rejects tampered messages or keys', async () => {
    const mat = await generateEd25519KeyMaterial();
    const message = new TextEncoder().encode('Certified Handmade test message');
    const sig = signWithSeed(mat.seed32, message);
    expect(sig).toHaveLength(64);

    expect(await verifyEd25519Signature(mat.publicKey, message, sig)).toBe(true);

    // Tampered message
    const tampered = new Uint8Array(message);
    tampered[0] ^= 0xff;
    expect(await verifyEd25519Signature(mat.publicKey, tampered, sig)).toBe(false);

    // Tampered signature
    const badSig = new Uint8Array(sig);
    badSig[63] ^= 0x01;
    expect(await verifyEd25519Signature(mat.publicKey, message, badSig)).toBe(false);

    // Different public key
    const other = await generateEd25519KeyMaterial();
    expect(await verifyEd25519Signature(other.publicKey, message, sig)).toBe(false);

    const fp1 = await computePublicKeyFingerprint(mat.publicKey);
    const fp2 = await computePublicKeyFingerprint(mat.publicKey);
    expect(fp1.fullHex).toBe(fp2.fullHex);
    expect(fp1.shortDisplay).toMatch(/^CHM-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);

    mat.wipeSeed();
    other.wipeSeed();
  });

  it('encrypts and decrypts private key backups with AES-256-GCM and rejects wrong passphrases', async () => {
    const seed32 = hexToBytes('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60');
    const pk32 = derivePublicKeyFromSeed(seed32);

    const backup = await encryptKeyBackup({
      seed32,
      publicKey32: pk32,
      passphrase: 'correct-horse-battery-staple',
      label: 'Studio Test Key',
      iterations: 100_000, // Faster for unit tests while still >= MIN_PBKDF2_ITERATIONS
    });

    expect(backup.format).toBe('certified-handmade-key-backup');
    expect(backup.cipher).toBe('AES-256-GCM');

    const restored = await decryptKeyBackup(backup, 'correct-horse-battery-staple');
    expect(restored.seed32).toEqual(seed32);
    expect(restored.publicKey32).toEqual(pk32);
    expect(restored.label).toBe('Studio Test Key');

    // Wrong passphrase
    await expect(decryptKeyBackup(backup, 'wrong-passphrase')).rejects.toThrow();

    // Tampered publicKey AAD
    const tamperedPub = { ...backup, publicKey: base64UrlEncode(new Uint8Array(32).fill(7)) };
    await expect(decryptKeyBackup(tamperedPub, 'correct-horse-battery-staple')).rejects.toThrow();
  });
});
