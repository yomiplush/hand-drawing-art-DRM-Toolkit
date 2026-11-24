import {
  GIS_SCRIPT_URL,
  GOOGLE_DRIVE_API_BASE,
  GOOGLE_DRIVE_FILE_SCOPE,
  checkGoogleDriveEnvironmentSupport,
} from './config';

export interface GisTokenResponse {
  access_token?: string;
  expires_in?: number | string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
  error_uri?: string;
}

export interface GisTokenClient {
  requestAccessToken(overrideConfig?: {
    prompt?: '' | 'none' | 'consent' | 'select_account';
    hint?: string;
    scope?: string;
  }): void;
}

export interface GisOAuth2Global {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: GisTokenResponse) => void;
    error_callback?: (error: { type: string; message?: string }) => void;
    include_granted_scopes?: boolean;
  }): GisTokenClient;
  hasGrantedAllScopes(tokenResponse: GisTokenResponse, firstScope: string, ...rest: string[]): boolean;
  revoke(accessToken: string, done?: () => void): void;
}

export interface GoogleAccountProfile {
  /** Stable identifier derived from Drive about.get permissionId/email (never stored with tokens). */
  accountKey: string;
  permissionId?: string;
  emailAddress?: string;
  displayName?: string;
}

export interface GoogleAuthSessionState {
  connected: boolean;
  tokenExpiresAtMs: number | null;
  grantedScopes: string[];
  hasDriveFileScope: boolean;
  account: GoogleAccountProfile | null;
  gisScriptLoaded: boolean;
  lastError: string | null;
}

export interface GoogleAuthHooks {
  loadGisScript?: () => Promise<GisOAuth2Global>;
  fetchAbout?: (accessToken: string) => Promise<GoogleAccountProfile>;
}

const TOKEN_EXPIRY_SAFETY_MARGIN_MS = 30_000;

/**
 * Memory-only OAuth 2.0 Token Manager for Google Identity Services.
 * Access tokens are NEVER written to localStorage, sessionStorage, IndexedDB, URLs, or logs.
 */
export class InMemoryGoogleAuthManager {
  private accessToken: string | null = null;
  private tokenExpiresAtMs: number | null = null;
  private grantedScopes: string[] = [];
  private account: GoogleAccountProfile | null = null;
  private gisScriptLoaded = false;
  private lastError: string | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly hooks: GoogleAuthHooks;

  constructor(hooks: GoogleAuthHooks = {}) {
    this.hooks = hooks;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch {
        // Ignore subscriber error
      }
    }
  }

  getState(): GoogleAuthSessionState {
    const valid = this.hasValidAccessToken();
    return {
      connected: valid && this.account !== null,
      tokenExpiresAtMs: valid ? this.tokenExpiresAtMs : null,
      grantedScopes: valid ? [...this.grantedScopes] : [],
      hasDriveFileScope: valid && this.grantedScopes.includes(GOOGLE_DRIVE_FILE_SCOPE),
      account: this.account,
      gisScriptLoaded: this.gisScriptLoaded,
      lastError: this.lastError,
    };
  }

  hasValidAccessToken(nowMs = Date.now()): boolean {
    if (!this.accessToken || this.tokenExpiresAtMs === null) {
      return false;
    }
    return nowMs + TOKEN_EXPIRY_SAFETY_MARGIN_MS < this.tokenExpiresAtMs;
  }

  getAccessTokenOrThrow(nowMs = Date.now()): string {
    if (!this.accessToken || this.tokenExpiresAtMs === null) {
      throw new Error('Google Drive is not connected. Click Connect Google Account first.');
    }
    if (!this.hasValidAccessToken(nowMs)) {
      this.clearTokenMemoryOnly();
      throw new Error('Google OAuth access token has expired. Please reconnect your Google account.');
    }
    return this.accessToken;
  }

  private clearTokenMemoryOnly(): void {
    this.accessToken = null;
    this.tokenExpiresAtMs = null;
    this.grantedScopes = [];
  }

  invalidateExpiredToken(): void {
    this.clearTokenMemoryOnly();
    this.lastError = 'Google authorization expired or was revoked. Reconnect to continue syncing.';
    this.emit();
  }

  async ensureGisLoaded(): Promise<GisOAuth2Global> {
    if (this.hooks.loadGisScript) {
      const gis = await this.hooks.loadGisScript();
      this.gisScriptLoaded = true;
      this.emit();
      return gis;
    }

    const existing = (
      globalThis as unknown as { google?: { accounts?: { oauth2?: GisOAuth2Global } } }
    ).google?.accounts?.oauth2;
    if (existing) {
      this.gisScriptLoaded = true;
      return existing;
    }

    if (typeof document === 'undefined') {
      throw new Error('Google Identity Services requires a browser document');
    }

    await new Promise<void>((resolve, reject) => {
      const prior = document.querySelector<HTMLScriptElement>(
        `script[src="${GIS_SCRIPT_URL}"]`,
      );
      if (prior) {
        if (prior.dataset.chmLoaded === '1') {
          resolve();
          return;
        }
        prior.addEventListener('load', () => resolve(), { once: true });
        prior.addEventListener(
          'error',
          () => reject(new Error('Failed to load Google Identity Services script')),
          { once: true },
        );
        return;
      }

      const script = document.createElement('script');
      script.src = GIS_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        script.dataset.chmLoaded = '1';
        resolve();
      };
      script.onerror = () => {
        reject(new Error('Failed to load Google Identity Services (offline or blocked)'));
      };
      document.head.appendChild(script);
    });

    const loaded = (
      globalThis as unknown as { google?: { accounts?: { oauth2?: GisOAuth2Global } } }
    ).google?.accounts?.oauth2;
    if (!loaded) {
      throw new Error('Google Identity Services OAuth2 API unavailable after script load');
    }
    this.gisScriptLoaded = true;
    this.emit();
    return loaded;
  }

  private async fetchDriveAccountProfile(accessToken: string): Promise<GoogleAccountProfile> {
    if (this.hooks.fetchAbout) {
      return this.hooks.fetchAbout(accessToken);
    }
    const res = await fetch(
      `${GOOGLE_DRIVE_API_BASE}/about?fields=${encodeURIComponent('user(displayName,emailAddress,permissionId)')}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    if (!res.ok) {
      throw new Error(`Failed to verify connected Google account (HTTP ${res.status})`);
    }
    const data = (await res.json()) as {
      user?: { displayName?: string; emailAddress?: string; permissionId?: string };
    };
    const permissionId = data.user?.permissionId?.trim();
    const emailAddress = data.user?.emailAddress?.trim();
    const displayName = data.user?.displayName?.trim();
    const rawKey = permissionId || emailAddress;
    if (!rawKey) {
      throw new Error('Google Drive about.get returned no account identifier');
    }
    return {
      accountKey: rawKey,
      permissionId,
      emailAddress,
      displayName,
    };
  }

  /**
   * Initiates OAuth 2.0 Token Model authorization strictly from an explicit user action.
   * Rejects insufficient scope grants and isolates session state on account switches.
   */
  async connectInteractive(options?: {
    prompt?: 'consent' | 'select_account' | '';
    clientId?: string;
    origin?: string;
  }): Promise<GoogleAuthSessionState & { switchedAccount: boolean }> {
    const env = checkGoogleDriveEnvironmentSupport({
      clientId: options?.clientId,
      origin: options?.origin,
    });
    if (!env.supported) {
      this.lastError = env.message;
      this.emit();
      throw new Error(env.message);
    }

    const gis = await this.ensureGisLoaded();

    const tokenResp = await new Promise<GisTokenResponse>((resolve, reject) => {
      const client = gis.initTokenClient({
        client_id: env.clientId,
        scope: GOOGLE_DRIVE_FILE_SCOPE,
        include_granted_scopes: false,
        callback: (resp) => {
          if (resp.error) {
            const detail = resp.error_description || resp.error;
            if (resp.error === 'access_denied') {
              reject(new Error('Google Drive permission request was denied.'));
            } else {
              reject(new Error(`Google OAuth error: ${detail}`));
            }
            return;
          }
          resolve(resp);
        },
        error_callback: (err) => {
          if (err.type === 'popup_closed') {
            reject(new Error('Google sign-in popup was closed before authorization completed.'));
          } else if (err.type === 'popup_failed_to_open') {
            reject(new Error('Popup window was blocked by the browser. Allow popups for this site and try again.'));
          } else {
            reject(new Error(err.message || `Google Identity popup error (${err.type})`));
          }
        },
      });
      client.requestAccessToken({
        prompt: options?.prompt ?? 'select_account',
      });
    });

    if (!tokenResp.access_token) {
      throw new Error('Google OAuth response did not include an access token');
    }
    const hasScope =
      typeof gis.hasGrantedAllScopes === 'function'
        ? gis.hasGrantedAllScopes(tokenResp, GOOGLE_DRIVE_FILE_SCOPE)
        : (tokenResp.scope ?? '').split(/\s+/).includes(GOOGLE_DRIVE_FILE_SCOPE);
    if (!hasScope) {
      throw new Error(
        'Google Drive file permission (drive.file) was not granted. Please approve the requested permission to sync.',
      );
    }

    const expiresInSec = Number(tokenResp.expires_in ?? 3600);
    const prevAccountKey = this.account?.accountKey;
    const profile = await this.fetchDriveAccountProfile(tokenResp.access_token);
    const switchedAccount = Boolean(prevAccountKey && prevAccountKey !== profile.accountKey);

    this.accessToken = tokenResp.access_token;
    this.tokenExpiresAtMs = Date.now() + Math.max(60, expiresInSec) * 1000;
    this.grantedScopes = (tokenResp.scope ?? GOOGLE_DRIVE_FILE_SCOPE)
      .split(/\s+/)
      .filter(Boolean);
    this.account = profile;
    this.lastError = null;
    this.emit();

    return {
      ...this.getState(),
      switchedAccount,
    };
  }

  /**
   * Disconnects the local Google session (and optionally revokes OAuth authorization).
   * Never deletes any local Certified Handmade data (keys, proofs, profiles, presets).
   */
  async disconnect(options?: { revokeAuthorization?: boolean }): Promise<void> {
    const token = this.accessToken;
    const revoke = options?.revokeAuthorization === true;
    this.clearTokenMemoryOnly();
    this.account = null;
    this.lastError = null;
    this.emit();

    if (revoke && token) {
      const gis = (
        globalThis as unknown as { google?: { accounts?: { oauth2?: GisOAuth2Global } } }
      ).google?.accounts?.oauth2;
      if (gis && typeof gis.revoke === 'function') {
        await new Promise<void>((resolve) => {
          gis.revoke(token, () => resolve());
        });
      }
    }
  }

  /** For unit tests validating granular scopes & token expiry behavior without leaking to storage. */
  _setTestSession(params: {
    accessToken: string;
    expiresInSeconds: number;
    account: GoogleAccountProfile;
    scopes?: string[];
  }): void {
    this.accessToken = params.accessToken;
    this.tokenExpiresAtMs = Date.now() + params.expiresInSeconds * 1000;
    this.account = params.account;
    this.grantedScopes = params.scopes ?? [GOOGLE_DRIVE_FILE_SCOPE];
    this.lastError = null;
    this.emit();
  }

  /** Ensures callers never accidentally serialize token state */
  toJSON(): GoogleAuthSessionState {
    return this.getState();
  }
}

export const googleAuthManager = new InMemoryGoogleAuthManager();
