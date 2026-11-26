import { GOOGLE_DRIVE_API_BASE, GOOGLE_DRIVE_UPLOAD_BASE } from './config';

export const DRIVE_FOLDER_NAME = 'Certified Handmade';
export const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
export const DRIVE_APPDATA_SPACE = 'appDataFolder' as const;
export const CHM_APP_PROPERTY_VALUE = 'certified-handmade';

export type DriveFileRole =
  | 'root'
  | 'keyring'
  | 'manifest'
  | 'proofs-chunk'
  | 'profiles'
  | 'policies'
  | 'settings'
  | 'identities'
  | 'devices'
  | 'recovery'
  | 'snapshot';

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  appProperties?: Record<string, string>;
  modifiedTime?: string;
  size?: string;
  trashed?: boolean;
}

export class DriveApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly retryable: boolean;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'DriveApiError';
    this.status = status;
    this.code = code;
    this.retryable = status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
  }
}

export interface DriveClientOptions {
  fetchImpl?: typeof fetch;
  sleepMs?: (ms: number) => Promise<void>;
  maxRetries?: number;
  baseBackoffMs?: number;
}

export class GoogleDriveClient {
  private readonly fetchImpl: typeof fetch;
  private readonly sleepMs: (ms: number) => Promise<void>;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;

  constructor(options: DriveClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init));
    this.sleepMs =
      options.sleepMs ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.maxRetries = options.maxRetries ?? 3;
    this.baseBackoffMs = options.baseBackoffMs ?? 400;
  }

  private async requestWithRetry(
    url: string,
    init: RequestInit,
    accessToken: string,
  ): Promise<Response> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await this.fetchImpl(url, {
          ...init,
          headers: {
            ...(init.headers ?? {}),
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (res.ok) {
          return res;
        }
        let errMessage = `Google Drive API error (HTTP ${res.status})`;
        let errCode: string | undefined;
        try {
          const body = (await res.json()) as {
            error?: { message?: string; errors?: Array<{ reason?: string }> };
          };
          errMessage = body.error?.message || errMessage;
          errCode = body.error?.errors?.[0]?.reason;
        } catch {
          // ignore non-json error body
        }
        const err = new DriveApiError(errMessage, res.status, errCode);
        if (!err.retryable || attempt >= this.maxRetries) {
          throw err;
        }
        lastErr = err;
      } catch (err) {
        if (err instanceof DriveApiError && !err.retryable) {
          throw err;
        }
        lastErr = err;
        if (attempt >= this.maxRetries) {
          throw err;
        }
      }
      const jitter = Math.floor(Math.random() * 120);
      await this.sleepMs(this.baseBackoffMs * Math.pow(2, attempt) + jitter);
    }
    throw lastErr instanceof Error ? lastErr : new Error('Google Drive request failed');
  }

  async listAppFiles(params: {
    accessToken: string;
    query: string;
    spaces?: 'appDataFolder' | 'drive';
    fields?: string;
    pageSize?: number;
  }): Promise<DriveFileMetadata[]> {
    const fields =
      params.fields ??
      'files(id,name,mimeType,parents,appProperties,modifiedTime,size,trashed)';
    const url = new URL(`${GOOGLE_DRIVE_API_BASE}/files`);
    url.searchParams.set('q', params.query);
    url.searchParams.set('spaces', params.spaces ?? DRIVE_APPDATA_SPACE);
    url.searchParams.set('fields', fields);
    url.searchParams.set('pageSize', String(params.pageSize ?? 100));
    const res = await this.requestWithRetry(url.toString(), { method: 'GET' }, params.accessToken);
    const data = (await res.json()) as { files?: DriveFileMetadata[] };
    return (data.files ?? []).filter((f) => !f.trashed);
  }

  async getFileMetadata(params: {
    accessToken: string;
    fileId: string;
  }): Promise<DriveFileMetadata | null> {
    try {
      const url = `${GOOGLE_DRIVE_API_BASE}/files/${encodeURIComponent(params.fileId)}?fields=${encodeURIComponent('id,name,mimeType,parents,appProperties,modifiedTime,size,trashed')}`;
      const res = await this.requestWithRetry(url, { method: 'GET' }, params.accessToken);
      const data = (await res.json()) as DriveFileMetadata;
      return data.trashed ? null : data;
    } catch (err) {
      if (err instanceof DriveApiError && err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Ensures a hidden Certified Handmade Vault root folder inside Google Drive's
   * isolated `appDataFolder` space (never clutters user's visible My Drive).
   */
  async ensureVaultRootFolder(params: {
    accessToken: string;
    knownFolderId?: string;
  }): Promise<{ folder: DriveFileMetadata; recovered: boolean; created: boolean }> {
    if (params.knownFolderId) {
      const existing = await this.getFileMetadata({
        accessToken: params.accessToken,
        fileId: params.knownFolderId,
      });
      if (
        existing &&
        existing.mimeType === DRIVE_FOLDER_MIME &&
        existing.appProperties?.chmApp === CHM_APP_PROPERTY_VALUE &&
        existing.appProperties?.chmRole === 'root'
      ) {
        return { folder: existing, recovered: false, created: false };
      }
    }

    // Recover folder inside hidden appDataFolder via appProperties
    const foundByProps = await this.listAppFiles({
      accessToken: params.accessToken,
      spaces: DRIVE_APPDATA_SPACE,
      query: `mimeType='${DRIVE_FOLDER_MIME}' and trashed=false and appProperties has { key='chmApp' and value='${CHM_APP_PROPERTY_VALUE}' } and appProperties has { key='chmRole' and value='root' }`,
      pageSize: 10,
    });
    if (foundByProps.length > 0) {
      return {
        folder: foundByProps[0],
        recovered: Boolean(params.knownFolderId),
        created: false,
      };
    }

    const res = await this.requestWithRetry(
      `${GOOGLE_DRIVE_API_BASE}/files?fields=${encodeURIComponent('id,name,mimeType,parents,appProperties,modifiedTime')}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: DRIVE_FOLDER_NAME,
          mimeType: DRIVE_FOLDER_MIME,
          parents: [DRIVE_APPDATA_SPACE],
          appProperties: {
            chmApp: CHM_APP_PROPERTY_VALUE,
            chmRole: 'root',
            chmSpace: DRIVE_APPDATA_SPACE,
            chmSchema: '2',
          },
        }),
      },
      params.accessToken,
    );
    const created = (await res.json()) as DriveFileMetadata;
    return {
      folder: created,
      recovered: Boolean(params.knownFolderId),
      created: true,
    };
  }

  async findVaultFilesInFolder(params: {
    accessToken: string;
    folderId: string;
    vaultId?: string;
  }): Promise<DriveFileMetadata[]> {
    let q = `'${params.folderId.replace(/'/g, "\\'")}' in parents and trashed=false and appProperties has { key='chmApp' and value='${CHM_APP_PROPERTY_VALUE}' }`;
    if (params.vaultId) {
      q += ` and appProperties has { key='chmVaultId' and value='${params.vaultId.replace(/'/g, "\\'")}' }`;
    }
    return this.listAppFiles({
      accessToken: params.accessToken,
      spaces: DRIVE_APPDATA_SPACE,
      query: q,
      pageSize: 200,
    });
  }

  async findKeyringFiles(params: {
    accessToken: string;
    folderId: string;
  }): Promise<DriveFileMetadata[]> {
    const files = await this.findVaultFilesInFolder({
      accessToken: params.accessToken,
      folderId: params.folderId,
    });
    return files.filter((f) => f.appProperties?.chmRole === 'keyring');
  }

  async downloadJsonFile<T = unknown>(params: {
    accessToken: string;
    fileId: string;
  }): Promise<T> {
    const url = `${GOOGLE_DRIVE_API_BASE}/files/${encodeURIComponent(params.fileId)}?alt=media`;
    const res = await this.requestWithRetry(url, { method: 'GET' }, params.accessToken);
    return (await res.json()) as T;
  }

  async downloadBinaryFile(params: {
    accessToken: string;
    fileId: string;
  }): Promise<Blob> {
    const url = `${GOOGLE_DRIVE_API_BASE}/files/${encodeURIComponent(params.fileId)}?alt=media`;
    const res = await this.requestWithRetry(url, { method: 'GET' }, params.accessToken);
    return await res.blob();
  }

  async upsertBinaryFile(params: {
    accessToken: string;
    folderId: string;
    existingFileId?: string;
    opaqueFileName: string;
    mimeType?: string;
    appProperties: Record<string, string>;
    binaryPayload: Blob;
  }): Promise<DriveFileMetadata> {
    const mimeType = params.mimeType ?? 'application/octet-stream';
    const metadata: Record<string, unknown> = {
      name: params.opaqueFileName,
      mimeType,
      appProperties: {
        ...params.appProperties,
        chmApp: CHM_APP_PROPERTY_VALUE,
      },
    };
    if (!params.existingFileId) {
      metadata.parents = [params.folderId || DRIVE_APPDATA_SPACE];
    }

    const boundaryBytes = new Uint8Array(8);
    globalThis.crypto.getRandomValues(boundaryBytes);
    const boundary = `chm_${Array.from(boundaryBytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
    const preamble =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`;
    const epilogue = `\r\n--${boundary}--`;
    const multipartBody = new Blob([preamble, params.binaryPayload, epilogue]);

    const targetUrl = params.existingFileId
      ? `${GOOGLE_DRIVE_UPLOAD_BASE}/files/${encodeURIComponent(params.existingFileId)}?uploadType=multipart&fields=${encodeURIComponent('id,name,mimeType,parents,appProperties,modifiedTime,size')}`
      : `${GOOGLE_DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=${encodeURIComponent('id,name,mimeType,parents,appProperties,modifiedTime,size')}`;

    const res = await this.requestWithRetry(
      targetUrl,
      {
        method: params.existingFileId ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      },
      params.accessToken,
    );
    return (await res.json()) as DriveFileMetadata;
  }

  async upsertJsonFile(params: {
    accessToken: string;
    folderId: string;
    existingFileId?: string;
    opaqueFileName: string;
    appProperties: Record<string, string>;
    jsonPayload: unknown;
  }): Promise<DriveFileMetadata> {
    const metadata: Record<string, unknown> = {
      name: params.opaqueFileName,
      mimeType: 'application/json',
      appProperties: {
        ...params.appProperties,
        chmApp: CHM_APP_PROPERTY_VALUE,
      },
    };
    if (!params.existingFileId) {
      metadata.parents = [params.folderId || DRIVE_APPDATA_SPACE];
    }

    const boundaryBytes = new Uint8Array(8);
    globalThis.crypto.getRandomValues(boundaryBytes);
    const boundary = `chm_${Array.from(boundaryBytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
    const bodyText =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(params.jsonPayload)}\r\n` +
      `--${boundary}--`;

    const targetUrl = params.existingFileId
      ? `${GOOGLE_DRIVE_UPLOAD_BASE}/files/${encodeURIComponent(params.existingFileId)}?uploadType=multipart&fields=${encodeURIComponent('id,name,mimeType,parents,appProperties,modifiedTime,size')}`
      : `${GOOGLE_DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=${encodeURIComponent('id,name,mimeType,parents,appProperties,modifiedTime,size')}`;

    const res = await this.requestWithRetry(
      targetUrl,
      {
        method: params.existingFileId ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: bodyText,
      },
      params.accessToken,
    );
    return (await res.json()) as DriveFileMetadata;
  }

  async deleteFile(params: {
    accessToken: string;
    fileId: string;
  }): Promise<void> {
    try {
      await this.requestWithRetry(
        `${GOOGLE_DRIVE_API_BASE}/files/${encodeURIComponent(params.fileId)}`,
        { method: 'DELETE' },
        params.accessToken,
      );
    } catch (err) {
      if (err instanceof DriveApiError && err.status === 404) {
        return;
      }
      throw err;
    }
  }
}
