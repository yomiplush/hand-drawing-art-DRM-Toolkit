export const DEFAULT_GOOGLE_CLIENT_ID =
  '948913138881-4k5avda66dnimie2lou6erofuo9d9gmm.apps.googleusercontent.com';

export const PRODUCTION_ORIGIN = 'https://certified-handmade.com';
export const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
export const GOOGLE_DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const GOOGLE_DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
export const GOOGLE_DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

export interface GoogleEnvironmentSupport {
  supported: boolean;
  reason: 'ok' | 'no-window' | 'missing-client-id' | 'standalone-loopback' | 'insecure-origin';
  clientId: string;
  origin: string;
  message: string;
}

export function getGoogleClientId(overrideClientId?: string): string {
  if (overrideClientId && overrideClientId.trim()) {
    return overrideClientId.trim();
  }
  const envClientId =
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof import.meta.env.VITE_GOOGLE_CLIENT_ID === 'string'
      ? import.meta.env.VITE_GOOGLE_CLIENT_ID.trim()
      : '';
  return envClientId || DEFAULT_GOOGLE_CLIENT_ID;
}

export function isStandaloneLoopbackOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return (
      parsed.protocol === 'http:' &&
      (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') &&
      parsed.port === '43777'
    );
  } catch {
    return false;
  }
}

export function checkGoogleDriveEnvironmentSupport(params?: {
  origin?: string;
  clientId?: string;
}): GoogleEnvironmentSupport {
  const clientId = getGoogleClientId(params?.clientId);
  const origin =
    params?.origin ??
    (typeof window !== 'undefined' && window.location ? window.location.origin : '');

  if (!origin) {
    return {
      supported: false,
      reason: 'no-window',
      clientId,
      origin: '',
      message: 'Browser window context is required for Google OAuth sign-in.',
    };
  }

  if (!clientId) {
    return {
      supported: false,
      reason: 'missing-client-id',
      clientId: '',
      origin,
      message: 'VITE_GOOGLE_CLIENT_ID is not configured for this build.',
    };
  }

  if (isStandaloneLoopbackOrigin(origin)) {
    return {
      supported: false,
      reason: 'standalone-loopback',
      clientId,
      origin,
      message:
        'Google OAuth is unavailable on Standalone local server (127.0.0.1:43777). Use Portable Encrypted Files (.chmvault.json) or open the hosted HTTPS web app at https://certified-handmade.com.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return {
      supported: false,
      reason: 'insecure-origin',
      clientId,
      origin,
      message: 'Current page origin is not a valid HTTP/HTTPS origin for Google Identity Services.',
    };
  }

  const isLocalDev =
    parsed.protocol === 'http:' &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');

  if (parsed.protocol !== 'https:' && !isLocalDev) {
    return {
      supported: false,
      reason: 'insecure-origin',
      clientId,
      origin,
      message: 'Google OAuth requires an HTTPS origin (e.g. https://certified-handmade.com).',
    };
  }

  return {
    supported: true,
    reason: 'ok',
    clientId,
    origin,
    message: 'Google Drive connection is supported in this environment.',
  };
}
