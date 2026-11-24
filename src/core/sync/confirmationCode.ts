import {
  PAIRING_NONCE_BYTES,
  assertExactBytes,
  assertStrictEd25519PublicKey,
  hexToBytes,
} from '@yomiplush/chm-exchange/core';
import type {
  SignedEnrollmentCertificate,
  SignedPairingRequest,
} from '@yomiplush/chm-exchange/core';
import { sha256Sync } from '../crypto/sha256';

const PAIRING_CONFIRM_DOMAIN_PREFIX = new TextEncoder().encode('CHM-PAIR-CONFIRM1\0');
// 32-character Crockford-style unambiguous alphabet (excludes 0, 1, I, O)
const PAIRING_CONFIRM_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Computes an 8-character human-verifiable confirmation code (e.g. "A7K9-M2P4")
 * deterministically from:
 *   SHA-256("CHM-PAIR-CONFIRM1\0" || requestHash || nonce || devicePublicKey)
 *
 * Matches CHM-Exchange's confirmationCode implementation so both devices display the
 * exact same out-of-band check code to thwart QR substitution attacks.
 */
export function computePairingConfirmationCode(params: {
  requestHash: Uint8Array;
  nonce: Uint8Array;
  devicePublicKey: Uint8Array;
}): string {
  const requestHash = assertExactBytes(params.requestHash, 32, 'requestHash');
  const nonce = assertExactBytes(params.nonce, PAIRING_NONCE_BYTES, 'nonce');
  const devicePublicKey = assertStrictEd25519PublicKey(params.devicePublicKey, 'devicePublicKey');

  const input = new Uint8Array(
    PAIRING_CONFIRM_DOMAIN_PREFIX.length +
      requestHash.length +
      nonce.length +
      devicePublicKey.length,
  );
  let offset = 0;
  input.set(PAIRING_CONFIRM_DOMAIN_PREFIX, offset);
  offset += PAIRING_CONFIRM_DOMAIN_PREFIX.length;
  input.set(requestHash, offset);
  offset += requestHash.length;
  input.set(nonce, offset);
  offset += nonce.length;
  input.set(devicePublicKey, offset);

  const digest = sha256Sync(input);
  let chars = '';
  for (let i = 0; i < 8; i++) {
    chars += PAIRING_CONFIRM_ALPHABET[digest[i] & 0x1f];
  }
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

export function computeConfirmationCodeForRequest(request: SignedPairingRequest): string {
  return computePairingConfirmationCode({
    requestHash: hexToBytes(request.requestHashHex),
    nonce: request.payload.nonce,
    devicePublicKey: request.payload.devicePublicKey,
  });
}

export function computeConfirmationCodeForCertificate(
  certificate: SignedEnrollmentCertificate,
): string {
  return computePairingConfirmationCode({
    requestHash: certificate.payload.requestHash,
    nonce: certificate.payload.nonce,
    devicePublicKey: certificate.payload.devicePublicKey,
  });
}
