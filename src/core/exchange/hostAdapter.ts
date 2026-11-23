import {
  base64UrlEncode,
  decodeAndValidateEd25519PublicKey,
  stripToPublicHostIdentity,
} from '@yomiplush/chm-exchange/core';
import type {
  AddTrustedKeyRequest,
  ChmExchangeHostAdapter,
  HostDeviceIdentity,
  HostSigningIdentity,
  HostTrustedKey,
  PairedDeviceRegistryEntry,
  TrustStatusResult,
} from '@yomiplush/chm-exchange/core';
import {
  getLocalDeviceIdentity,
  loadDevicePairingState,
  toPublicHostDeviceIdentity,
} from '../storage/devicePairingStore';
import {
  addTrustedKey as storeAddTrustedKey,
  findTrustedKeyByPublicKey,
  getAuthorKey,
  listAuthorKeys,
  listTrustedKeys as storeListTrustedKeys,
  removeTrustedKey as storeRemoveTrustedKey,
} from '../storage/keyStore';
import type { AuthorKeyRecord, TrustedKeyRecord } from '../storage/keyStore';

/**
 * Explicitly projects ONLY public fields from an IndexedDB AuthorKeyRecord.
 * Private key material (webCryptoPrivateKey, encryptedBackup) is never exposed.
 */
function toPublicHostIdentity(record: AuthorKeyRecord): HostSigningIdentity {
  return stripToPublicHostIdentity({
    id: record.id,
    displayName: record.label,
    publicKeyBase64Url: record.publicKeyBase64Url,
    fingerprintHex: record.fingerprintHex,
    fingerprintShort: record.fingerprintShort,
    createdAt: record.createdAt,
  });
}

function toHostTrustedKey(record: TrustedKeyRecord): HostTrustedKey {
  return {
    publicKeyBase64Url: record.publicKeyBase64Url,
    fingerprintHex: record.fingerprintHex,
    fingerprintShort: record.fingerprintShort,
    displayName: record.label,
    note: record.note,
    addedAt: record.addedAt,
  };
}

export function createCertifiedHandmadeExchangeAdapter(): ChmExchangeHostAdapter {
  return {
    async listPublicIdentities(): Promise<HostSigningIdentity[]> {
      const records = await listAuthorKeys();
      return records.map(toPublicHostIdentity);
    },

    async getPublicIdentity(id: string): Promise<HostSigningIdentity | null> {
      const record = await getAuthorKey(id);
      return record ? toPublicHostIdentity(record) : null;
    },

    async listTrustedKeys(): Promise<HostTrustedKey[]> {
      const records = await storeListTrustedKeys();
      return records
        .filter((r) => r.verificationState !== 'unconfirmed')
        .map(toHostTrustedKey);
    },

    async getTrustStatus(publicKeyBase64Url: string): Promise<TrustStatusResult> {
      const publicKey32 = decodeAndValidateEd25519PublicKey(publicKeyBase64Url);
      const match = await findTrustedKeyByPublicKey(publicKey32);
      if (!match || match.verificationState === 'unconfirmed') {
        return { trusted: false };
      }
      return { trusted: true, record: toHostTrustedKey(match) };
    },

    async addTrustedKey(request: AddTrustedKeyRequest): Promise<HostTrustedKey> {
      const saved = await storeAddTrustedKey({
        publicKeyInput: request.publicKeyBase64Url,
        label: request.displayName,
        note: request.note,
        verificationState: 'confirmed',
      });
      if (
        request.fingerprintHex &&
        saved.fingerprintHex !== request.fingerprintHex.trim().toLowerCase()
      ) {
        await storeRemoveTrustedKey(saved.publicKeyBase64Url);
        throw new Error('Declared fingerprint mismatch during trusted key registration');
      }
      return toHostTrustedKey(saved);
    },

    async removeTrustedKey(publicKeyBase64Url: string): Promise<void> {
      const publicKey32 = decodeAndValidateEd25519PublicKey(publicKeyBase64Url);
      await storeRemoveTrustedKey(base64UrlEncode(publicKey32));
    },

    async getLocalDeviceIdentity(): Promise<HostDeviceIdentity | null> {
      const { device } = await getLocalDeviceIdentity();
      return device ? toPublicHostDeviceIdentity(device) : null;
    },

    async listPairedDevices(ownerFingerprintHex?: string): Promise<PairedDeviceRegistryEntry[]> {
      const { pairedDevices } = await loadDevicePairingState();
      const filtered = ownerFingerprintHex
        ? pairedDevices.filter((d) => d.ownerFingerprintHex === ownerFingerprintHex)
        : pairedDevices;
      return filtered.map((d) => ({
        ownerFingerprintHex: d.ownerFingerprintHex,
        ownerFingerprintShort: d.ownerFingerprintShort,
        ownerPublicKeyBase64Url: d.ownerPublicKeyBase64Url,
        ownerDisplayName: d.ownerDisplayName,
        deviceIdHex: d.deviceIdHex,
        devicePublicKeyBase64Url: d.devicePublicKeyBase64Url,
        deviceFingerprintHex: d.deviceFingerprintHex,
        deviceFingerprintShort: d.deviceFingerprintShort,
        deviceName: d.deviceName,
        permissions: [...d.permissions],
        issuedAt: d.issuedAt,
        enrollmentToken: d.enrollmentToken,
        revocationNoticeToken: d.revocationNoticeToken,
        revokedAt: d.revokedAt,
        revocationReason: d.revocationReason,
        revocationSequence: d.revocationSequence,
        localVerificationStatus: d.localVerificationStatus,
      }));
    },
  };
}
