import type { CreatorProfileLink, LicenseId, PolicySignal } from '../manifest/types';

export type SnsPlatformId =
  | 'x'
  | 'bluesky'
  | 'mastodon'
  | 'misskey'
  | 'nostr'
  | 'pixiv'
  | 'skeb'
  | 'booth'
  | 'vgen'
  | 'furaffinity'
  | 'deviantart'
  | 'tumblr'
  | 'instagram'
  | 'youtube'
  | 'github'
  | 'custom';

export interface SnsPlatformPreset {
  id: SnsPlatformId;
  label: string;
  urlPrefix?: string;
  placeholder: string;
}

export const SNS_PLATFORM_PRESETS: ReadonlyArray<SnsPlatformPreset> = [
  { id: 'x', label: 'X (Twitter)', urlPrefix: 'https://x.com/', placeholder: 'https://x.com/handle' },
  {
    id: 'bluesky',
    label: 'Bluesky',
    urlPrefix: 'https://bsky.app/profile/',
    placeholder: 'https://bsky.app/profile/name.bsky.social',
  },
  { id: 'pixiv', label: 'pixiv', urlPrefix: 'https://www.pixiv.net/users/', placeholder: 'https://www.pixiv.net/users/12345' },
  { id: 'skeb', label: 'Skeb', urlPrefix: 'https://skeb.jp/@', placeholder: 'https://skeb.jp/@handle' },
  { id: 'booth', label: 'BOOTH', urlPrefix: 'https://', placeholder: 'https://shop.booth.pm/' },
  { id: 'vgen', label: 'VGen', urlPrefix: 'https://vgen.co/', placeholder: 'https://vgen.co/artist' },
  { id: 'mastodon', label: 'Mastodon', placeholder: 'https://mastodon.social/@handle' },
  { id: 'misskey', label: 'Misskey', placeholder: 'https://misskey.io/@handle' },
  { id: 'nostr', label: 'Nostr', urlPrefix: 'https://njump.me/', placeholder: 'https://njump.me/npub1...' },
  { id: 'furaffinity', label: 'FurAffinity', urlPrefix: 'https://www.furaffinity.net/user/', placeholder: 'https://www.furaffinity.net/user/name' },
  { id: 'deviantart', label: 'DeviantArt', urlPrefix: 'https://www.deviantart.com/', placeholder: 'https://www.deviantart.com/name' },
  { id: 'tumblr', label: 'Tumblr', placeholder: 'https://name.tumblr.com/' },
  { id: 'instagram', label: 'Instagram', urlPrefix: 'https://www.instagram.com/', placeholder: 'https://www.instagram.com/handle' },
  { id: 'youtube', label: 'YouTube', urlPrefix: 'https://www.youtube.com/@', placeholder: 'https://www.youtube.com/@channel' },
  { id: 'github', label: 'GitHub', urlPrefix: 'https://github.com/', placeholder: 'https://github.com/username' },
  { id: 'custom', label: 'Custom URL', placeholder: 'https://example.com/profile' },
];

export interface AuthorSnsLink extends CreatorProfileLink {
  platform?: SnsPlatformId;
}

export interface AuthorProfileInput {
  id?: string;
  profileName: string;
  displayName: string;
  website?: string;
  snsLinks?: AuthorSnsLink[];
  portfolioLinks?: CreatorProfileLink[];
  publicNote?: string;
  defaultLicenseId?: LicenseId;
  defaultPolicyPresetId?: string;
  defaultAiTraining?: PolicySignal;
  isDefault?: boolean;
}

export interface AuthorProfile {
  id: string;
  schemaVersion: 2;
  profileName: string;
  displayName: string;
  website?: string;
  snsLinks: AuthorSnsLink[];
  portfolioLinks: CreatorProfileLink[];
  publicNote?: string;
  defaultLicenseId?: LicenseId;
  defaultPolicyPresetId?: string;
  defaultAiTraining?: PolicySignal;
  isDefault: boolean;
  version: number;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Immutable snapshot copied into a newly signed artwork certificate so later
 * profile edits or deletions never retroactively alter signed proofs.
 */
export interface AuthorProfilePublicSnapshot {
  profileId?: string;
  displayName: string;
  website?: string;
  snsLinks: AuthorSnsLink[];
  portfolioLinks: CreatorProfileLink[];
  publicNote?: string;
  capturedAt: string;
}
