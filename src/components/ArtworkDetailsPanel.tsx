import { useId, useState } from 'react';
import {
  ChevronDown,
  Cpu,
  FileCheck2,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  DEFAULT_STREAM_CHUNK_BYTES,
  MAX_EVIDENCE_FILE_BYTES,
  sha256Streamed,
} from '../core/crypto/sha256';
import {
  MAX_ENV_FIELD_UTF8_BYTES,
  MAX_ENV_NOTES_UTF8_BYTES,
  MAX_EVIDENCE_LABEL_UTF8_BYTES,
  MAX_EVIDENCE_MIME_UTF8_BYTES,
  MAX_EVIDENCE_RECORDS,
  sanitizeEvidenceBasename,
} from '../core/manifest/evidenceExtension';
import { utf8ByteLength } from '../core/manifest/cborCodec';
import type {
  CreationMethod,
  EvidenceCategory,
} from '../core/manifest/types';
import { useI18n } from '../i18n/context';
import { AdvancedSettings } from './ui/AdvancedSettings';
import { FriendlyErrorAlert } from './ui/FriendlyErrorAlert';

export interface LocalEvidenceDraftItem {
  id: string;
  sha256: Uint8Array;
  sha256Hex: string;
  byteLength: number;
  label: string;
  category: EvidenceCategory;
  mimeType?: string;
}

export interface ArtworkDetailsDraft {
  creationMethod: CreationMethod | '';
  envSoftware: string;
  envHardware: string;
  envInputDevice: string;
  envNotes: string;
  evidenceItems: LocalEvidenceDraftItem[];
}

interface ArtworkDetailsPanelProps {
  draft: ArtworkDetailsDraft;
  onChange: (updater: (prev: ArtworkDetailsDraft) => ArtworkDetailsDraft) => void;
}

export function ArtworkDetailsPanel({ draft, onChange }: ArtworkDetailsPanelProps) {
  const { t } = useI18n();
  const evidenceFileInputId = useId();
  const [openGroup, setOpenGroup] = useState<'creation' | 'evidence'>('creation');
  const [hashingStatus, setHashingStatus] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  const creationCount =
    (draft.creationMethod ? 1 : 0) +
    (draft.envSoftware.trim() ? 1 : 0) +
    (draft.envHardware.trim() ? 1 : 0) +
    (draft.envInputDevice.trim() ? 1 : 0) +
    (draft.envNotes.trim() ? 1 : 0);
  const evidenceCount = draft.evidenceItems.length;
  const totalCount = creationCount + evidenceCount;

  const handleEvidenceFilesPicked = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setEvidenceError(null);

    const remaining = MAX_EVIDENCE_RECORDS - draft.evidenceItems.length;
    if (remaining <= 0) {
      setEvidenceError(`Maximum ${MAX_EVIDENCE_RECORDS} evidence files supported.`);
      return;
    }

    const picked = Array.from(files).slice(0, remaining);
    const added: LocalEvidenceDraftItem[] = [];

    try {
      for (let i = 0; i < picked.length; i++) {
        const file = picked[i];
        if (file.size > MAX_EVIDENCE_FILE_BYTES) {
          throw new Error(
            `${file.name} exceeds max ${Math.round(MAX_EVIDENCE_FILE_BYTES / (1024 * 1024))} MiB`,
          );
        }
        setHashingStatus(`${t.artworkDetails.evidenceHashingBusy} (${i + 1}/${picked.length})`);
        const hashed = await sha256Streamed(file, {
          chunkSize: DEFAULT_STREAM_CHUNK_BYTES,
          onProgress: (done, total) => {
            const pct = total > 0 ? Math.round((done / total) * 100) : 100;
            setHashingStatus(
              `${t.artworkDetails.evidenceHashingBusy} ${file.name} (${pct}%)`,
            );
          },
        });
        const cleanLabel = sanitizeEvidenceBasename(file.name);
        const rawMime = file.type?.trim();
        const mimeType =
          rawMime && utf8ByteLength(rawMime) <= MAX_EVIDENCE_MIME_UTF8_BYTES
            ? rawMime
            : undefined;
        added.push({
          id: `${hashed.hex}-${Date.now()}-${i}`,
          sha256: hashed.digest,
          sha256Hex: hashed.hex,
          byteLength: hashed.byteLength,
          label: cleanLabel,
          category: guessCategory(cleanLabel, mimeType),
          mimeType,
        });
      }

      onChange((prev) => ({
        ...prev,
        evidenceItems: [...prev.evidenceItems, ...added],
      }));
    } catch (err) {
      setEvidenceError(err instanceof Error ? err.message : 'Failed to hash evidence file');
    } finally {
      setHashingStatus(null);
    }
  };

  const groupBtnClass = (active: boolean) =>
    `w-full flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-start text-xs sm:text-sm font-medium transition-colors min-h-[44px] cursor-pointer ${
      active
        ? 'ga-status-info ga-border-strong'
        : 'ga-surface-subtle ga-text-secondary hover:ga-text'
    }`;

  return (
    <AdvancedSettings
      label={t.artworkDetails.disclosureTitle}
      summary={totalCount > 0 ? `${totalCount}` : t.artworkDetails.disclosureHint}
      testId="create-artwork-details"
    >
      <p className="text-xs ga-text-muted leading-relaxed">{t.artworkDetails.disclosureHint}</p>

      <div className="space-y-2.5">
        {/* Creation Method & Environment */}
        <div className="space-y-2">
          <button
            type="button"
            aria-expanded={openGroup === 'creation'}
            data-testid="details-group-creation"
            onClick={() => setOpenGroup('creation')}
            className={groupBtnClass(openGroup === 'creation')}
          >
            <span className="inline-flex items-center gap-2">
              <Cpu className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
              <span>{t.artworkDetails.groupCreation}</span>
              {creationCount > 0 && (
                <span className="ga-status-info rounded-full border px-2 py-0.5 text-[10px] font-mono">
                  {creationCount}
                </span>
              )}
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${openGroup === 'creation' ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>

          {openGroup === 'creation' && (
            <div className="ga-surface-subtle rounded-xl p-3.5 space-y-3">
              <div>
                <label
                  htmlFor="creationMethod"
                  className="block text-xs font-medium ga-text-secondary mb-1"
                >
                  {t.artworkDetails.creationMethodLabel}
                </label>
                <select
                  id="creationMethod"
                  value={draft.creationMethod}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      creationMethod: e.target.value as CreationMethod | '',
                    }))
                  }
                  data-testid="details-creation-method"
                  className="ga-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
                >
                  <option value="">{t.artworkDetails.methodNotDeclared}</option>
                  <option value="hand-drawn-no-ai">{t.artworkDetails.methodHandDrawnNoAi}</option>
                  <option value="hand-drawn-ai-assisted">
                    {t.artworkDetails.methodHandDrawnAiAssisted}
                  </option>
                  <option value="ai-generated">{t.artworkDetails.methodAiGenerated}</option>
                  <optgroup label={t.artworkDetails.methodOtherGroupLabel}>
                    <option value="other">{t.artworkDetails.methodOther}</option>
                    <option value="prefer-not-to-disclose">
                      {t.artworkDetails.methodPreferNotToDisclose}
                    </option>
                  </optgroup>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="flex justify-between text-xs ga-text-secondary mb-1">
                    <label htmlFor="envSoftware">{t.artworkDetails.softwareLabel}</label>
                    <span className="font-mono ga-text-muted">
                      {utf8ByteLength(draft.envSoftware)} / {MAX_ENV_FIELD_UTF8_BYTES}
                    </span>
                  </div>
                  <input
                    id="envSoftware"
                    type="text"
                    value={draft.envSoftware}
                    onChange={(e) =>
                      onChange((prev) => ({ ...prev, envSoftware: e.target.value }))
                    }
                    placeholder={t.artworkDetails.softwarePlaceholder}
                    data-testid="details-creation-software"
                    className="ga-input w-full rounded-xl px-3 py-2 text-sm min-h-[44px]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs ga-text-secondary mb-1">
                    <label htmlFor="envHardware">{t.artworkDetails.hardwareLabel}</label>
                    <span className="font-mono ga-text-muted">
                      {utf8ByteLength(draft.envHardware)} / {MAX_ENV_FIELD_UTF8_BYTES}
                    </span>
                  </div>
                  <input
                    id="envHardware"
                    type="text"
                    value={draft.envHardware}
                    onChange={(e) =>
                      onChange((prev) => ({ ...prev, envHardware: e.target.value }))
                    }
                    placeholder={t.artworkDetails.hardwarePlaceholder}
                    data-testid="details-creation-hardware"
                    className="ga-input w-full rounded-xl px-3 py-2 text-sm min-h-[44px]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs ga-text-secondary mb-1">
                    <label htmlFor="envInputDevice">{t.artworkDetails.inputDeviceLabel}</label>
                    <span className="font-mono ga-text-muted">
                      {utf8ByteLength(draft.envInputDevice)} / {MAX_ENV_FIELD_UTF8_BYTES}
                    </span>
                  </div>
                  <input
                    id="envInputDevice"
                    type="text"
                    value={draft.envInputDevice}
                    onChange={(e) =>
                      onChange((prev) => ({ ...prev, envInputDevice: e.target.value }))
                    }
                    placeholder={t.artworkDetails.inputDevicePlaceholder}
                    data-testid="details-creation-input"
                    className="ga-input w-full rounded-xl px-3 py-2 text-sm min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs ga-text-secondary mb-1">
                  <label htmlFor="envNotes">{t.artworkDetails.creationNotesLabel}</label>
                  <span className="font-mono ga-text-muted">
                    {utf8ByteLength(draft.envNotes)} / {MAX_ENV_NOTES_UTF8_BYTES}
                  </span>
                </div>
                <textarea
                  id="envNotes"
                  rows={2}
                  value={draft.envNotes}
                  onChange={(e) =>
                    onChange((prev) => ({ ...prev, envNotes: e.target.value }))
                  }
                  placeholder={t.artworkDetails.creationNotesPlaceholder}
                  data-testid="details-creation-notes"
                  className="ga-input w-full rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <p className="text-[11px] ga-text-muted leading-relaxed">
                {t.artworkDetails.declarationHonestyNote}
              </p>
            </div>
          )}
        </div>

        {/* Local SHA-256 Evidence Files */}
        <div className="space-y-2">
          <button
            type="button"
            aria-expanded={openGroup === 'evidence'}
            data-testid="details-group-evidence"
            onClick={() => setOpenGroup('evidence')}
            className={groupBtnClass(openGroup === 'evidence')}
          >
            <span className="inline-flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-[var(--ga-accent)] shrink-0" aria-hidden="true" />
              <span>{t.artworkDetails.groupEvidence}</span>
              {evidenceCount > 0 && (
                <span className="ga-status-info rounded-full border px-2 py-0.5 text-[10px] font-mono">
                  {evidenceCount}
                </span>
              )}
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${openGroup === 'evidence' ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>

          {openGroup === 'evidence' && (
            <div className="ga-surface-subtle rounded-xl p-3.5 space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  id={evidenceFileInputId}
                  type="file"
                  multiple
                  data-testid="details-evidence-file-input"
                  onChange={(e) => {
                    void handleEvidenceFilesPicked(e.target.files);
                    e.target.value = '';
                  }}
                  className="sr-only"
                />
                <label
                  htmlFor={evidenceFileInputId}
                  className="ga-btn-secondary inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium min-h-[44px] cursor-pointer"
                >
                  <Upload className="h-4 w-4 shrink-0 text-[var(--ga-accent)]" aria-hidden="true" />
                  <span>{t.artworkDetails.evidencePickBtn}</span>
                </label>
              </div>

              {hashingStatus && (
                <p
                  role="status"
                  data-testid="details-evidence-progress"
                  className="text-xs font-mono text-[var(--ga-accent)]"
                >
                  {hashingStatus}
                </p>
              )}

              {evidenceError && (
                <FriendlyErrorAlert
                  error={evidenceError}
                  onDismiss={() => setEvidenceError(null)}
                />
              )}

              {draft.evidenceItems.length > 0 && (
                <ul data-testid="details-evidence-list" className="space-y-2">
                  {draft.evidenceItems.map((item, idx) => (
                    <li
                      key={item.id}
                      className="ga-card-solid rounded-xl p-3 space-y-2 text-xs"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_165px_auto] gap-2 items-center">
                        <input
                          type="text"
                          value={item.label}
                          maxLength={MAX_EVIDENCE_LABEL_UTF8_BYTES}
                          aria-label={t.artworkDetails.evidenceLabelInput}
                          onChange={(e) =>
                            onChange((prev) => ({
                              ...prev,
                              evidenceItems: prev.evidenceItems.map((row, i) =>
                                i === idx ? { ...row, label: e.target.value } : row,
                              ),
                            }))
                          }
                          className="ga-input w-full rounded-lg px-2.5 py-1.5 text-xs min-h-[40px]"
                        />

                        <select
                          value={item.category}
                          aria-label={t.artworkDetails.evidenceCategoryLabel}
                          onChange={(e) =>
                            onChange((prev) => ({
                              ...prev,
                              evidenceItems: prev.evidenceItems.map((row, i) =>
                                i === idx
                                  ? { ...row, category: e.target.value as EvidenceCategory }
                                  : row,
                              ),
                            }))
                          }
                          className="ga-input w-full rounded-lg px-2.5 py-1.5 text-xs min-h-[40px]"
                        >
                          <option value="sketch">{t.artworkDetails.catSketch}</option>
                          <option value="wip">{t.artworkDetails.catWip}</option>
                          <option value="intermediate">{t.artworkDetails.catIntermediate}</option>
                          <option value="timelapse">{t.artworkDetails.catTimelapse}</option>
                          <option value="project-file">{t.artworkDetails.catProjectFile}</option>
                          <option value="other">{t.artworkDetails.catOther}</option>
                        </select>

                        <button
                          type="button"
                          onClick={() =>
                            onChange((prev) => ({
                              ...prev,
                              evidenceItems: prev.evidenceItems.filter((_, i) => i !== idx),
                            }))
                          }
                          aria-label={t.artworkDetails.removeBtn}
                          className="ga-btn-secondary inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 min-h-[40px] cursor-pointer hover:text-[var(--ga-error-text)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="font-mono text-[11px] ga-text-muted break-all">
                        SHA-256: {item.sha256Hex} · {item.byteLength.toLocaleString()} bytes
                        {item.mimeType ? ` · ${item.mimeType}` : ''}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <p className="text-[11px] ga-text-muted leading-relaxed">
                {t.artworkDetails.evidencePrivacyNote}
              </p>
            </div>
          )}
        </div>
      </div>
    </AdvancedSettings>
  );
}

function guessCategory(label: string, mime?: string): EvidenceCategory {
  const lower = label.toLowerCase();
  if (mime?.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi)$/i.test(lower)) {
    return 'timelapse';
  }
  if (/\.(psd|psb|clip|kra|procreate|ora|xcf|sai|sai2|csp|afdesign|afphoto)$/i.test(lower)) {
    return 'project-file';
  }
  if (lower.includes('sketch') || lower.includes('rough') || lower.includes('draft')) {
    return 'sketch';
  }
  if (lower.includes('wip')) {
    return 'wip';
  }
  return 'other';
}

export function createEmptyArtworkDetailsDraft(): ArtworkDetailsDraft {
  return {
    creationMethod: '',
    envSoftware: '',
    envHardware: '',
    envInputDevice: '',
    envNotes: '',
    evidenceItems: [],
  };
}
