import { useId, useState } from 'react';
import {
  Check,
  ChevronDown,
  Cpu,
  FileCheck2,
  Info,
  Plus,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import {
  DEFAULT_STREAM_CHUNK_BYTES,
  MAX_EVIDENCE_FILE_BYTES,
  sha256Streamed,
} from '../core/crypto/sha256';
import {
  MAX_CREATOR_DISPLAY_NAME_UTF8_BYTES,
  MAX_ENV_FIELD_UTF8_BYTES,
  MAX_ENV_NOTES_UTF8_BYTES,
  MAX_EVIDENCE_LABEL_UTF8_BYTES,
  MAX_EVIDENCE_MIME_UTF8_BYTES,
  MAX_EVIDENCE_RECORDS,
  MAX_EXT_ARTIST_UTF8_BYTES,
  MAX_EXT_DESCRIPTION_UTF8_BYTES,
  MAX_EXT_TITLE_UTF8_BYTES,
  MAX_PROFILE_LINKS,
  MAX_PROFILE_LINK_LABEL_UTF8_BYTES,
  MAX_PROFILE_URL_UTF8_BYTES,
  sanitizeEvidenceBasename,
  sanitizeProfileUrl,
} from '../core/manifest/evidenceExtension';
import { utf8ByteLength } from '../core/manifest/cborCodec';
import type {
  CreationMethod,
  CreatorProfileLink,
  EvidenceCategory,
} from '../core/manifest/types';
import { useI18n } from '../i18n/context';
import { AdvancedSettings } from './ui/AdvancedSettings';

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
  extTitle: string;
  extArtistName: string;
  extDescription: string;
  creatorDisplayName: string;
  creatorWebsite: string;
  creatorLinks: CreatorProfileLink[];
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
  onSaveProfileDefaults: () => Promise<void>;
  onClearProfileDefaults: () => Promise<void>;
  profileSavedIndicator: boolean;
}

export function ArtworkDetailsPanel({
  draft,
  onChange,
  onSaveProfileDefaults,
  onClearProfileDefaults,
  profileSavedIndicator,
}: ArtworkDetailsPanelProps) {
  const { t } = useI18n();
  const evidenceFileInputId = useId();
  const [openGroup, setOpenGroup] = useState<'artwork' | 'creator' | 'creation' | 'evidence'>(
    'artwork',
  );
  const [hashingStatus, setHashingStatus] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const artworkCount =
    (draft.extTitle.trim() ? 1 : 0) +
    (draft.extArtistName.trim() ? 1 : 0) +
    (draft.extDescription.trim() ? 1 : 0);
  const creatorCount =
    (draft.creatorDisplayName.trim() ? 1 : 0) +
    (draft.creatorWebsite.trim() ? 1 : 0) +
    draft.creatorLinks.filter((l) => l.url.trim()).length;
  const creationCount =
    (draft.creationMethod ? 1 : 0) +
    (draft.envSoftware.trim() ? 1 : 0) +
    (draft.envHardware.trim() ? 1 : 0) +
    (draft.envInputDevice.trim() ? 1 : 0) +
    (draft.envNotes.trim() ? 1 : 0);
  const evidenceCount = draft.evidenceItems.length;
  const totalCount = artworkCount + creatorCount + creationCount + evidenceCount;

  const websiteValidationError = (() => {
    const trimmed = draft.creatorWebsite.trim();
    if (!trimmed) return null;
    try {
      sanitizeProfileUrl(trimmed, t.artworkDetails.websiteLabel);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Invalid URL';
    }
  })();

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

  const handleSaveProfileClick = async () => {
    setProfileError(null);
    try {
      if (draft.creatorWebsite.trim()) {
        sanitizeProfileUrl(draft.creatorWebsite, t.artworkDetails.websiteLabel);
      }
      draft.creatorLinks.forEach((l, idx) => {
        if (l.url.trim()) sanitizeProfileUrl(l.url, `Link #${idx + 1}`);
      });
      await onSaveProfileDefaults();
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Invalid URL in profile');
    }
  };

  const groupBtnClass = (active: boolean) =>
    `w-full flex items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-start text-xs sm:text-sm font-medium transition-colors min-h-[44px] cursor-pointer ${
      active
        ? 'border-sky-300/45 bg-sky-500/15 text-white'
        : 'border-white/[0.09] bg-[#030b18]/60 text-slate-300 hover:border-white/[0.22]'
    }`;

  return (
    <AdvancedSettings
      label={t.artworkDetails.disclosureTitle}
      summary={totalCount > 0 ? `${totalCount}` : t.artworkDetails.disclosureHint}
      testId="create-artwork-details"
    >
      <p className="text-xs text-slate-400 leading-relaxed">{t.artworkDetails.disclosureHint}</p>

      <div className="space-y-2.5">
        {/* Group 1: Artwork */}
        <div className="space-y-2">
          <button
            type="button"
            aria-expanded={openGroup === 'artwork'}
            data-testid="details-group-artwork"
            onClick={() => setOpenGroup('artwork')}
            className={groupBtnClass(openGroup === 'artwork')}
          >
            <span className="inline-flex items-center gap-2">
              <Info className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
              <span>{t.artworkDetails.groupArtwork}</span>
              {artworkCount > 0 && (
                <span className="rounded-full bg-sky-400/20 px-2 py-0.5 text-[10px] font-mono text-sky-200">
                  {artworkCount}
                </span>
              )}
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${openGroup === 'artwork' ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>

          {openGroup === 'artwork' && (
            <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/50 p-3.5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <label htmlFor="extTitle">{t.artworkDetails.titleLabel}</label>
                    <span className="font-mono text-slate-400">
                      {utf8ByteLength(draft.extTitle)} / {MAX_EXT_TITLE_UTF8_BYTES}
                    </span>
                  </div>
                  <input
                    id="extTitle"
                    type="text"
                    value={draft.extTitle}
                    onChange={(e) =>
                      onChange((prev) => ({ ...prev, extTitle: e.target.value }))
                    }
                    placeholder={t.artworkDetails.titlePlaceholder}
                    data-testid="details-ext-title"
                    className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 min-h-[44px]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <label htmlFor="extArtistName">{t.artworkDetails.artistLabel}</label>
                    <span className="font-mono text-slate-400">
                      {utf8ByteLength(draft.extArtistName)} / {MAX_EXT_ARTIST_UTF8_BYTES}
                    </span>
                  </div>
                  <input
                    id="extArtistName"
                    type="text"
                    value={draft.extArtistName}
                    onChange={(e) =>
                      onChange((prev) => ({ ...prev, extArtistName: e.target.value }))
                    }
                    placeholder={t.artworkDetails.artistPlaceholder}
                    data-testid="details-ext-artist"
                    className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <label htmlFor="extDescription">{t.artworkDetails.descriptionLabel}</label>
                  <span className="font-mono text-slate-400">
                    {utf8ByteLength(draft.extDescription)} / {MAX_EXT_DESCRIPTION_UTF8_BYTES}
                  </span>
                </div>
                <textarea
                  id="extDescription"
                  rows={3}
                  value={draft.extDescription}
                  onChange={(e) =>
                    onChange((prev) => ({ ...prev, extDescription: e.target.value }))
                  }
                  placeholder={t.artworkDetails.descriptionPlaceholder}
                  data-testid="details-ext-description"
                  className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Group 2: Creator */}
        <div className="space-y-2">
          <button
            type="button"
            aria-expanded={openGroup === 'creator'}
            data-testid="details-group-creator"
            onClick={() => setOpenGroup('creator')}
            className={groupBtnClass(openGroup === 'creator')}
          >
            <span className="inline-flex items-center gap-2">
              <User className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
              <span>{t.artworkDetails.groupCreator}</span>
              {creatorCount > 0 && (
                <span className="rounded-full bg-sky-400/20 px-2 py-0.5 text-[10px] font-mono text-sky-200">
                  {creatorCount}
                </span>
              )}
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${openGroup === 'creator' ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>

          {openGroup === 'creator' && (
            <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/50 p-3.5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <label htmlFor="creatorDisplayName">
                      {t.artworkDetails.creatorDisplayNameLabel}
                    </label>
                    <span className="font-mono text-slate-400">
                      {utf8ByteLength(draft.creatorDisplayName)} /{' '}
                      {MAX_CREATOR_DISPLAY_NAME_UTF8_BYTES}
                    </span>
                  </div>
                  <input
                    id="creatorDisplayName"
                    type="text"
                    value={draft.creatorDisplayName}
                    onChange={(e) =>
                      onChange((prev) => ({ ...prev, creatorDisplayName: e.target.value }))
                    }
                    placeholder={t.artworkDetails.creatorDisplayNamePlaceholder}
                    data-testid="details-creator-name"
                    className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 min-h-[44px]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <label htmlFor="creatorWebsite">{t.artworkDetails.websiteLabel}</label>
                    <span className="font-mono text-slate-400">
                      {utf8ByteLength(draft.creatorWebsite)} / {MAX_PROFILE_URL_UTF8_BYTES}
                    </span>
                  </div>
                  <input
                    id="creatorWebsite"
                    type="url"
                    value={draft.creatorWebsite}
                    onChange={(e) =>
                      onChange((prev) => ({ ...prev, creatorWebsite: e.target.value }))
                    }
                    placeholder={t.artworkDetails.websitePlaceholder}
                    data-testid="details-creator-website"
                    className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 min-h-[44px]"
                  />
                  {websiteValidationError && (
                    <p role="alert" className="text-[11px] text-rose-300 mt-1">
                      {websiteValidationError}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-300">
                    {t.artworkDetails.linksLabel}
                  </span>
                  {draft.creatorLinks.length < MAX_PROFILE_LINKS && (
                    <button
                      type="button"
                      data-testid="details-add-link-btn"
                      onClick={() =>
                        onChange((prev) => ({
                          ...prev,
                          creatorLinks: [...prev.creatorLinks, { url: '', label: '' }],
                        }))
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-white/[0.16] bg-[#030b18]/75 px-3 py-1.5 text-xs font-medium text-sky-200 hover:border-sky-400/40 min-h-[36px] cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t.artworkDetails.addLinkBtn}</span>
                    </button>
                  )}
                </div>

                {draft.creatorLinks.map((link, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-2">
                    <input
                      type="url"
                      value={link.url}
                      onChange={(e) =>
                        onChange((prev) => ({
                          ...prev,
                          creatorLinks: prev.creatorLinks.map((item, i) =>
                            i === idx ? { ...item, url: e.target.value } : item,
                          ),
                        }))
                      }
                      placeholder={t.artworkDetails.linkUrlPlaceholder}
                      data-testid={`details-link-url-${idx}`}
                      className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2 text-xs sm:text-sm text-white placeholder:text-slate-500 min-h-[44px]"
                    />
                    <input
                      type="text"
                      value={link.label ?? ''}
                      maxLength={MAX_PROFILE_LINK_LABEL_UTF8_BYTES}
                      onChange={(e) =>
                        onChange((prev) => ({
                          ...prev,
                          creatorLinks: prev.creatorLinks.map((item, i) =>
                            i === idx ? { ...item, label: e.target.value } : item,
                          ),
                        }))
                      }
                      placeholder={t.artworkDetails.linkLabelPlaceholder}
                      data-testid={`details-link-label-${idx}`}
                      className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2 text-xs sm:text-sm text-white placeholder:text-slate-500 min-h-[44px]"
                    />
                    <button
                      type="button"
                      data-testid={`details-link-remove-${idx}`}
                      onClick={() =>
                        onChange((prev) => ({
                          ...prev,
                          creatorLinks: prev.creatorLinks.filter((_, i) => i !== idx),
                        }))
                      }
                      aria-label={t.artworkDetails.removeBtn}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/[0.12] bg-[#030b18]/75 px-3 py-2 text-xs text-slate-300 hover:border-rose-400/40 hover:text-rose-200 min-h-[44px] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  data-testid="details-save-profile-btn"
                  onClick={() => void handleSaveProfileClick()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300/35 bg-sky-500/15 px-3 py-2 text-xs font-medium text-sky-100 hover:bg-sky-500/25 min-h-[40px] cursor-pointer"
                >
                  {profileSavedIndicator && (
                    <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                  )}
                  <span>{t.artworkDetails.saveProfileBtn}</span>
                </button>
                <button
                  type="button"
                  data-testid="details-clear-profile-btn"
                  onClick={() => void onClearProfileDefaults()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] bg-[#030b18]/75 px-3 py-2 text-xs text-slate-300 hover:border-white/[0.3] min-h-[40px] cursor-pointer"
                >
                  <span>{t.artworkDetails.clearProfileBtn}</span>
                </button>
              </div>
              {profileSavedIndicator && (
                <p role="status" className="text-[11px] text-emerald-300">
                  {t.artworkDetails.profileSavedNote}
                </p>
              )}
              {profileError && (
                <p role="alert" className="text-[11px] text-rose-300">
                  {profileError}
                </p>
              )}
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {t.artworkDetails.profileDisclaimer}
              </p>
            </div>
          )}
        </div>

        {/* Group 3: Creation */}
        <div className="space-y-2">
          <button
            type="button"
            aria-expanded={openGroup === 'creation'}
            data-testid="details-group-creation"
            onClick={() => setOpenGroup('creation')}
            className={groupBtnClass(openGroup === 'creation')}
          >
            <span className="inline-flex items-center gap-2">
              <Cpu className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
              <span>{t.artworkDetails.groupCreation}</span>
              {creationCount > 0 && (
                <span className="rounded-full bg-sky-400/20 px-2 py-0.5 text-[10px] font-mono text-sky-200">
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
            <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/50 p-3.5 space-y-3">
              <div>
                <label
                  htmlFor="creationMethod"
                  className="block text-xs font-medium text-slate-300 mb-1"
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
                  className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2.5 text-sm text-white min-h-[44px]"
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
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <label htmlFor="envSoftware">{t.artworkDetails.softwareLabel}</label>
                    <span className="font-mono text-slate-400">
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
                    className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 min-h-[44px]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <label htmlFor="envHardware">{t.artworkDetails.hardwareLabel}</label>
                    <span className="font-mono text-slate-400">
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
                    className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 min-h-[44px]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <label htmlFor="envInputDevice">{t.artworkDetails.inputDeviceLabel}</label>
                    <span className="font-mono text-slate-400">
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
                    className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <label htmlFor="envNotes">{t.artworkDetails.creationNotesLabel}</label>
                  <span className="font-mono text-slate-400">
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
                  className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                />
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                {t.artworkDetails.declarationHonestyNote}
              </p>
            </div>
          )}
        </div>

        {/* Group 4: Evidence */}
        <div className="space-y-2">
          <button
            type="button"
            aria-expanded={openGroup === 'evidence'}
            data-testid="details-group-evidence"
            onClick={() => setOpenGroup('evidence')}
            className={groupBtnClass(openGroup === 'evidence')}
          >
            <span className="inline-flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-sky-300 shrink-0" aria-hidden="true" />
              <span>{t.artworkDetails.groupEvidence}</span>
              {evidenceCount > 0 && (
                <span className="rounded-full bg-sky-400/20 px-2 py-0.5 text-[10px] font-mono text-sky-200">
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
            <div className="rounded-lg border border-white/[0.08] bg-[#030b18]/50 p-3.5 space-y-3">
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
                  className="inline-flex items-center gap-2 rounded-lg border border-sky-300/35 bg-sky-500/15 px-3.5 py-2 text-xs sm:text-sm font-medium text-sky-100 hover:bg-sky-500/25 min-h-[44px] cursor-pointer"
                >
                  <Upload className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{t.artworkDetails.evidencePickBtn}</span>
                </label>
              </div>

              {hashingStatus && (
                <p
                  role="status"
                  data-testid="details-evidence-progress"
                  className="text-xs font-mono text-sky-300"
                >
                  {hashingStatus}
                </p>
              )}

              {evidenceError && (
                <p role="alert" className="text-xs text-rose-300">
                  {evidenceError}
                </p>
              )}

              {draft.evidenceItems.length > 0 && (
                <ul data-testid="details-evidence-list" className="space-y-2">
                  {draft.evidenceItems.map((item, idx) => (
                    <li
                      key={item.id}
                      className="rounded-lg border border-white/[0.09] bg-[#020813]/75 p-3 space-y-2 text-xs"
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
                          className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-2.5 py-1.5 text-xs text-white min-h-[40px]"
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
                          className="w-full rounded-lg border border-white/[0.14] bg-[#030b18]/80 px-2.5 py-1.5 text-xs text-white min-h-[40px]"
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
                          className="inline-flex items-center justify-center rounded-lg border border-white/[0.12] px-2.5 py-1.5 text-slate-300 hover:border-rose-400/40 hover:text-rose-200 min-h-[40px] cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="font-mono text-[11px] text-slate-400 break-all">
                        SHA-256: {item.sha256Hex} · {item.byteLength.toLocaleString()} bytes
                        {item.mimeType ? ` · ${item.mimeType}` : ''}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <p className="text-[11px] text-slate-400 leading-relaxed">
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
    extTitle: '',
    extArtistName: '',
    extDescription: '',
    creatorDisplayName: '',
    creatorWebsite: '',
    creatorLinks: [],
    creationMethod: '',
    envSoftware: '',
    envHardware: '',
    envInputDevice: '',
    envNotes: '',
    evidenceItems: [],
  };
}
