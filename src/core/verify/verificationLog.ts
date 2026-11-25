export interface VerificationLogEntry {
  id: string;
  checkedAt: string;
  sourceLabel: string;
  protocolVersion: number | null;
  signatureStatus: string;
  integrityStatus: string;
  identityStatus: string;
  artworkTitle?: string;
  authorName?: string;
  authorFingerprintShort?: string | null;
  artworkIdHex?: string;
  qrStrategy?: string;
}

const VERIFICATION_LOG_KEY = 'chm_verification_logs_v1';
const MAX_VERIFICATION_LOGS = 50;

export function loadVerificationLogs(): VerificationLogEntry[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(VERIFICATION_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is VerificationLogEntry =>
        Boolean(item) && typeof item === 'object' && typeof item.id === 'string' && typeof item.checkedAt === 'string',
    );
  } catch {
    return [];
  }
}

export function appendVerificationLog(entry: Omit<VerificationLogEntry, 'id' | 'checkedAt'>): VerificationLogEntry[] {
  const nextEntry: VerificationLogEntry = {
    ...entry,
    id: `vlog-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    checkedAt: new Date().toISOString(),
  };
  const existing = loadVerificationLogs();
  const updated = [nextEntry, ...existing].slice(0, MAX_VERIFICATION_LOGS);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(VERIFICATION_LOG_KEY, JSON.stringify(updated));
    }
  } catch {
    // Ignore storage quota / private mode issues
  }
  return updated;
}

export function clearVerificationLogs(): VerificationLogEntry[] {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(VERIFICATION_LOG_KEY);
    }
  } catch {
    // Ignore
  }
  return [];
}
