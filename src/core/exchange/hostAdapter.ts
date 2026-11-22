import {
  base64UrlEncode,
  decodeAndValidateEd25519PublicKey,
  stripToPublicHostIdentity,
} from '@yomiplush/chm-exchange/core';
import type {
  AddTrustedKeyRequest,
  ChmExchangeHostAdapter,
  HostSigningIdentity,
  HostTrustedKey,
  TrustStatusResult,
} from '@yomiplush/chm-exchange/core';
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
      return records.map(toHostTrustedKey);
    },

    async getTrustStatus(publicKeyBase64Url: string): Promise<TrustStatusResult> {
      const publicKey32 = decodeAndValidateEd25519PublicKey(publicKeyBase64Url);
      const match = await findTrustedKeyByPublicKey(publicKey32);
      return match ? { trusted: true, record: toHostTrustedKey(match) } : { trusted: false };
    },

    async addTrustedKey(request: AddTrustedKeyRequest): Promise<HostTrustedKey> {
      const saved = await storeAddTrustedKey({
        publicKeyInput: request.publicKeyBase64Url,
        label: request.displayName,
        note: request.note,
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
  };
}
