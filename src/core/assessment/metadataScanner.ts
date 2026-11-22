import type { ContainerFormat } from '../manifest/types';

export interface MetadataScanResult {
  containerFormat: ContainerFormat;
  isCertifiedHandmadeOutput: boolean;
  hasC2paContainer: boolean;
  aiMetadataSignals: string[];
  creativeToolHints: string[];
  inspectedTextCount: number;
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const MAX_CHUNKS = 256;
const MAX_DECOMPRESS_INPUT = 512 * 1024;
const MAX_TEXT_INSPECT = 128 * 1024;

function matchesBytesAt(bytes: Uint8Array, offset: number, sig: number[]): boolean {
  if (bytes.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (bytes[offset + i] !== sig[i]) return false;
  }
  return true;
}

export function detectContainerFormat(bytes?: Uint8Array | null): ContainerFormat {
  if (!bytes || bytes.length < 12) return 'unknown';
  if (matchesBytesAt(bytes, 0, PNG_MAGIC)) return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp';
  }
  return 'other';
}

function decodeLatin1(bytes: Uint8Array): string {
  let out = '';
  const limit = Math.min(bytes.length, MAX_TEXT_INSPECT);
  for (let i = 0; i < limit; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

function decodeUtf8Safe(bytes: Uint8Array): string {
  const sliced = bytes.length > MAX_TEXT_INSPECT ? bytes.subarray(0, MAX_TEXT_INSPECT) : bytes;
  let utf8: string;
  try {
    utf8 = new TextDecoder('utf-8', { fatal: false }).decode(sliced);
  } catch {
    utf8 = decodeLatin1(sliced);
  }
  // Also scan UTF-16LE / UTF-16BE blocks (common in EXIF UserComment: "UNICODE\0...")
  if (sliced.length >= 16 && utf8.includes('UNICODE')) {
    let byteStart = 0;
    for (let i = 0; i + 8 <= sliced.length; i++) {
      if (
        sliced[i] === 0x55 &&
        sliced[i + 1] === 0x4e &&
        sliced[i + 2] === 0x49 &&
        sliced[i + 3] === 0x43 &&
        sliced[i + 4] === 0x4f &&
        sliced[i + 5] === 0x44 &&
        sliced[i + 6] === 0x45 &&
        sliced[i + 7] === 0x00
      ) {
        byteStart = i + 8;
        break;
      }
    }
    const u16Slice = sliced.subarray(byteStart);
    try {
      const u16le = new TextDecoder('utf-16le', { fatal: false }).decode(u16Slice);
      const u16be = new TextDecoder('utf-16be', { fatal: false }).decode(u16Slice);
      return `${utf8}\n${u16le}\n${u16be}`;
    } catch {
      // Ignore UTF-16 decoding failure
    }
  }
  return utf8;
}

async function tryInflateDeflate(compressed: Uint8Array): Promise<Uint8Array | null> {
  if (
    compressed.length === 0 ||
    compressed.length > MAX_DECOMPRESS_INPUT ||
    typeof DecompressionStream === 'undefined'
  ) {
    return null;
  }
  try {
    const stream = new DecompressionStream('deflate');
    const writer = stream.writable.getWriter();
    await writer.write(new Uint8Array(compressed));
    await writer.close();
    const reader = stream.readable.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.length;
        if (total > MAX_TEXT_INSPECT * 2) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
    const merged = new Uint8Array(total);
    let pos = 0;
    for (const c of chunks) {
      merged.set(c, pos);
      pos += c.length;
    }
    return merged;
  } catch {
    return null;
  }
}

const CREATIVE_TOOL_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'CLIP STUDIO PAINT', pattern: /clip\s*studio\s*paint|celsys/i },
  { label: 'Krita', pattern: /\bkrita\b/i },
  { label: 'Procreate', pattern: /\bprocreate\b/i },
  { label: 'Adobe Photoshop', pattern: /adobe\s*photoshop|\bphotoshop\b/i },
  { label: 'ibisPaint', pattern: /ibis\s*paint/i },
  { label: 'PaintTool SAI', pattern: /paint\s*tool\s*sai|systemax/i },
  { label: 'MediBang Paint', pattern: /medibang/i },
  { label: 'FireAlpaca', pattern: /firealpaca/i },
  { label: 'GIMP', pattern: /\bgimp\b/i },
  { label: 'Inkscape', pattern: /\binkscape\b/i },
  { label: 'Aseprite', pattern: /\baseprite\b/i },
  { label: 'Blender', pattern: /\bblender\b/i },
];

function classifyTextEntry(
  key: string,
  value: string,
  state: {
    isCertifiedHandmadeOutput: boolean;
    hasC2paContainer: boolean;
    aiSignals: Set<string>;
    toolHints: Set<string>;
  },
): void {
  const keyLower = key.trim().toLowerCase();
  const combined = `${key}\n${value}`;

  if (keyLower === 'certifiedhandmade' || /certified\s*handmade/i.test(value)) {
    state.isCertifiedHandmadeOutput = true;
  }

  // Known AI generation chunk keys & payloads across all major generators
  if (
    (keyLower === 'parameters' || /steps:\s*\d+/i.test(value)) &&
    /steps:\s*\d+|sampler:|cfg scale:|negative prompt:|schedule type:/i.test(value)
  ) {
    state.aiSignals.add('Stable Diffusion / Flux (A1111/Forge/SwarmUI parameters)');
  } else if (
    (keyLower === 'prompt' || keyLower === 'workflow') &&
    /"class_type"|"inputs"|"nodes"/i.test(value)
  ) {
    state.aiSignals.add('ComfyUI workflow/prompt metadata');
  } else if (keyLower === 'software' && /^novelai$/i.test(value.trim())) {
    state.aiSignals.add('NovelAI software metadata');
  } else if (keyLower === 'source' && /novelai|stable\s*diffusion|flux/i.test(value)) {
    state.aiSignals.add('AI generator source metadata');
  }

  if (/stable\s*diffusion|automatic1111|sd-metadata|invokeai|fooocus|swarmui|civitai|\bsdx?l\b|\bflux[.\-_ ]?(1|dev|schnell|pro)/i.test(combined)) {
    state.aiSignals.add('Stable Diffusion / Flux metadata marker');
  }
  if (/comfyui/i.test(combined)) {
    state.aiSignals.add('ComfyUI metadata marker');
  }
  if (/novelai/i.test(combined)) {
    state.aiSignals.add('NovelAI metadata marker');
  }
  if (/midjourney|\bniji\b/i.test(combined)) {
    state.aiSignals.add('Midjourney / Niji metadata marker');
  }
  if (/dall-?e|openai|chatgpt|gpt-4o|gpt-image|truepic/i.test(combined)) {
    state.aiSignals.add('OpenAI / ChatGPT / DALL-E metadata marker');
  }
  if (/made\s*with\s*google\s*ai|google\s*generative\s*ai|\bimagen\b|\bgemini\b|synthid/i.test(combined)) {
    state.aiSignals.add('Google Gemini / Imagen metadata marker');
  }
  if (/adobe\s*firefly|\bfirefly\b/i.test(combined)) {
    state.aiSignals.add('Adobe Firefly metadata marker');
  }
  if (/\bgrok\b|\bxai\b.*aurora|ideogram|recraft|leonardo\.ai|bing\s*image\s*creator|microsoft\s*designer|pixai|seaart/i.test(combined)) {
    state.aiSignals.add('Generative AI platform metadata marker');
  }
  if (
    /trainedalgorithmicmedia|compositewithtrainedalgorithmicmedia|c2pa\.ai_generative_training|c2pa\.actions/i.test(
      combined,
    )
  ) {
    state.hasC2paContainer = true;
    state.aiSignals.add('C2PA / IPTC trainedAlgorithmicMedia assertion');
  }

  for (const tool of CREATIVE_TOOL_PATTERNS) {
    if (tool.pattern.test(combined)) {
      state.toolHints.add(tool.label);
    }
  }
}

export async function scanImageContainerMetadata(
  bytes?: Uint8Array | null,
): Promise<MetadataScanResult> {
  const containerFormat = detectContainerFormat(bytes);
  const state = {
    isCertifiedHandmadeOutput: false,
    hasC2paContainer: false,
    aiSignals: new Set<string>(),
    toolHints: new Set<string>(),
  };
  let inspectedTextCount = 0;

  if (!bytes || containerFormat === 'unknown' || containerFormat === 'other') {
    return {
      containerFormat,
      isCertifiedHandmadeOutput: false,
      hasC2paContainer: false,
      aiMetadataSignals: [],
      creativeToolHints: [],
      inspectedTextCount: 0,
    };
  }

  if (containerFormat === 'png') {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 8;
    let chunkCount = 0;
    while (offset + 12 <= bytes.length && chunkCount < MAX_CHUNKS) {
      const length = view.getUint32(offset, false);
      const type = String.fromCharCode(
        bytes[offset + 4],
        bytes[offset + 5],
        bytes[offset + 6],
        bytes[offset + 7],
      );
      const dataStart = offset + 8;
      const dataEnd = dataStart + length;
      if (dataEnd + 4 > bytes.length || length > bytes.length) break;

      const chunkData = bytes.subarray(dataStart, dataEnd);
      if (type === 'caBX' || type === 'jumb' || type === 'c2pa') {
        state.hasC2paContainer = true;
        const rawText = decodeUtf8Safe(chunkData);
        classifyTextEntry(type, rawText, state);
        inspectedTextCount++;
      } else if (type === 'eXIf') {
        const rawText = decodeUtf8Safe(chunkData);
        classifyTextEntry('EXIF', rawText, state);
        inspectedTextCount++;
      } else if (type === 'tEXt') {
        const nul = chunkData.indexOf(0);
        if (nul > 0) {
          const key = decodeLatin1(chunkData.subarray(0, nul));
          const val = decodeLatin1(chunkData.subarray(nul + 1));
          classifyTextEntry(key, val, state);
          inspectedTextCount++;
        }
      } else if (type === 'zTXt') {
        const nul = chunkData.indexOf(0);
        if (nul > 0 && nul + 2 <= chunkData.length) {
          const key = decodeLatin1(chunkData.subarray(0, nul));
          const method = chunkData[nul + 1];
          if (method === 0) {
            const inflated = await tryInflateDeflate(chunkData.subarray(nul + 2));
            if (inflated) {
              classifyTextEntry(key, decodeUtf8Safe(inflated), state);
              inspectedTextCount++;
            }
          }
        }
      } else if (type === 'iTXt') {
        const nul1 = chunkData.indexOf(0);
        if (nul1 > 0 && nul1 + 3 < chunkData.length) {
          const key = decodeLatin1(chunkData.subarray(0, nul1));
          const compFlag = chunkData[nul1 + 1];
          const compMethod = chunkData[nul1 + 2];
          let pos = nul1 + 3;
          const nulLang = chunkData.indexOf(0, pos);
          if (nulLang !== -1) {
            pos = nulLang + 1;
            const nulTrans = chunkData.indexOf(0, pos);
            if (nulTrans !== -1) {
              pos = nulTrans + 1;
              const textBytes = chunkData.subarray(pos);
              if (compFlag === 1 && compMethod === 0) {
                const inflated = await tryInflateDeflate(textBytes);
                if (inflated) {
                  classifyTextEntry(key, decodeUtf8Safe(inflated), state);
                  inspectedTextCount++;
                }
              } else if (compFlag === 0) {
                classifyTextEntry(key, decodeUtf8Safe(textBytes), state);
                inspectedTextCount++;
              }
            }
          }
        }
      }

      if (type === 'IEND') break;
      offset = dataEnd + 4;
      chunkCount++;
    }
  } else if (containerFormat === 'jpeg') {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 2;
    let markerCount = 0;
    while (offset + 4 <= bytes.length && markerCount < 128) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      if (marker === 0xda || marker === 0xd9) break; // SOS / EOI
      if (marker >= 0xd0 && marker <= 0xd8) {
        offset += 2;
        continue;
      }
      const segLen = view.getUint16(offset + 2, false);
      if (segLen < 2 || offset + 2 + segLen > bytes.length) break;
      if ((marker >= 0xe0 && marker <= 0xef) || marker === 0xfe) {
        const segBytes = bytes.subarray(offset + 4, offset + 2 + segLen);
        const text = decodeUtf8Safe(segBytes);
        // APP11 (0xeb) is standard JPEG JUMBF/C2PA box
        if (marker === 0xeb && /jumb|c2pa/i.test(text)) {
          state.hasC2paContainer = true;
        }
        classifyTextEntry(`APP${(marker - 0xe0).toString(16)}`, text, state);
        inspectedTextCount++;
      }
      offset += 2 + segLen;
      markerCount++;
    }
  } else if (containerFormat === 'webp') {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 12;
    let chunkCount = 0;
    while (offset + 8 <= bytes.length && chunkCount < 64) {
      const fourcc = String.fromCharCode(
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
      );
      const size = view.getUint32(offset + 4, true);
      const dataStart = offset + 8;
      const dataEnd = dataStart + size;
      if (dataEnd > bytes.length) break;
      if (fourcc === 'EXIF' || fourcc === 'XMP ' || fourcc === 'C2PA' || fourcc === 'JUMB') {
        if (fourcc === 'C2PA' || fourcc === 'JUMB') {
          state.hasC2paContainer = true;
        }
        const text = decodeUtf8Safe(bytes.subarray(dataStart, dataEnd));
        classifyTextEntry(fourcc.trim(), text, state);
        inspectedTextCount++;
      }
      offset = dataEnd + (size % 2);
      chunkCount++;
    }
  }

  return {
    containerFormat,
    isCertifiedHandmadeOutput: state.isCertifiedHandmadeOutput,
    hasC2paContainer: state.hasC2paContainer,
    aiMetadataSignals: Array.from(state.aiSignals),
    creativeToolHints: Array.from(state.toolHints),
    inspectedTextCount,
  };
}
