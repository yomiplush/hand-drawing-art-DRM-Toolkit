import {
  ProjectParseError,
  isStandaloneRasterImage,
  type BaseProjectParser,
  type ProjectFileInput,
  type ProjectInspectionResult,
  type ProjectMergeResult,
  type StreamingHashProgress,
} from './base';
import { BinaryFallbackProjectParser } from './binaryFallbackParser';
import { ClipProjectParser } from './clipParser';
import { PsdProjectParser } from './psdParser';
import { ZipProjectParser } from './zipProjectParser';

export * from './base';
export { PsdProjectParser } from './psdParser';
export { ClipProjectParser } from './clipParser';
export { ZipProjectParser } from './zipProjectParser';
export { BinaryFallbackProjectParser } from './binaryFallbackParser';

export const NATIVE_PROJECT_ACCEPT =
  '.psd,.psb,.clip,.procreate,.kra,.ora,.sai,.sai2,.mdp,.afdesign,.afphoto,.xcf';

export interface NativeProjectPickerConfig {
  accept: string | undefined;
  multiple: boolean;
}

/**
 * Returns browser-optimized `<input type="file">` attributes for native project files.
 *
 * Intentionally omits `accept` (`undefined`) on ALL platforms (Windows, macOS, Linux,
 * iOS, iPadOS, Android) so OS file pickers never suffer from unregistered UTI/MIME
 * filtering bugs or blank dialogs. Non-project files (PNG/JPEG/WebP, etc.) are
 * strictly rejected immediately after selection by `resolveProjectParser()`.
 */
export function getNativeProjectPickerConfig(
  nav: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'> | undefined =
    typeof navigator !== 'undefined' ? navigator : undefined,
): NativeProjectPickerConfig {
  if (!nav) return { accept: undefined, multiple: true };
  const ua = nav.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1);
  return { accept: undefined, multiple: !isIOS };
}

export function getNativeProjectAcceptAttr(
  nav: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'> | undefined =
    typeof navigator !== 'undefined' ? navigator : undefined,
): string | undefined {
  return getNativeProjectPickerConfig(nav).accept;
}

const STANDALONE_RASTER_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif'];

const DEFAULT_PARSERS: readonly BaseProjectParser[] = [
  new PsdProjectParser(),
  new ClipProjectParser(),
  new ZipProjectParser(),
  new BinaryFallbackProjectParser(),
];

export async function resolveProjectParser(file: ProjectFileInput): Promise<BaseProjectParser> {
  const lower = (file.name || '').toLowerCase().trim();

  if (STANDALONE_RASTER_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    throw new ProjectParseError(
      'STANDALONE_RASTER_REJECTED',
      'Standalone raster images (PNG/JPEG/WebP/GIF/BMP) are no longer accepted. Please submit your native multi-layer project file (.psd, .clip, .procreate, .kra, etc.).',
      '1枚絵画像（PNG/JPEG/WebP等）は提出できません。レイヤー構造を含むネイティブ作業ファイル（.psd, .clip, .procreate, .kra等）をドロップしてください。',
    );
  }

  const headerSlice = file.slice(0, Math.min(file.size, 64));
  const headerBytes = new Uint8Array(await headerSlice.arrayBuffer());

  if (isStandaloneRasterImage(headerBytes)) {
    throw new ProjectParseError(
      'SPOOFED_RASTER_REJECTED',
      'Rejected: File header matches a flat raster image renamed to a project extension.',
      '拒絶されました: 1枚絵画像の拡張子を偽装したファイルは使用できません。',
    );
  }

  const parser = DEFAULT_PARSERS.find((p) => p.canParse(file.name, headerBytes));
  if (!parser) {
    throw new ProjectParseError(
      'UNSUPPORTED_PROJECT_FORMAT',
      `Unsupported project format "${file.name}". Supported native formats: ${NATIVE_PROJECT_ACCEPT}`,
      `未対応のファイル形式です（${file.name}）。対応形式: ${NATIVE_PROJECT_ACCEPT}`,
    );
  }

  return parser;
}

export async function inspectNativeProjectFile(
  file: ProjectFileInput,
  options?: { onHashProgress?: (progress: StreamingHashProgress) => void },
): Promise<{ parser: BaseProjectParser; inspection: ProjectInspectionResult }> {
  const parser = await resolveProjectParser(file);
  const inspection = await parser.inspect(file, options);
  return { parser, inspection };
}

export async function mergeNativeProjectFile(
  file: ProjectFileInput,
  inspection?: ProjectInspectionResult,
  options?: { onHashProgress?: (progress: StreamingHashProgress) => void },
): Promise<ProjectMergeResult> {
  const parser = await resolveProjectParser(file);
  const resolvedInspection = inspection ?? (await parser.inspect(file, options));
  return parser.mergeToPng(file, resolvedInspection);
}
