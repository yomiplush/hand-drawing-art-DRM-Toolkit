import type { QrMatrix } from '../qr/qrGenerator';
import type { ArtworkRegion } from '../manifest/types';
import { MAX_OUTPUT_DIMENSION } from '../manifest/types';
import type { CanonicalRaster } from './pngCodec';

export type QrPlacement = 'bottom-right' | 'bottom-left' | 'bottom-center' | 'top-right';
export type FrameTheme = 'dark-slate' | 'pure-white' | 'transparent-margin';

export interface QrBurnOptions {
  placement: QrPlacement;
  marginPx: number;
  modulePx?: number; // If omitted/0, automatically calculated
  quietZoneModules?: number;
  theme: FrameTheme;
  showLabel: boolean;
  labelLines?: string[];
}

export interface BurnLayout {
  outWidth: number;
  outHeight: number;
  artRegion: ArtworkRegion;
  qrBox: {
    x: number;
    y: number;
    size: number;
    modulePx: number;
    quietZoneModules: number;
  };
  footerBar: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  labelArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export function chooseDefaultModulePx(artWidth: number, artHeight: number, qrModules: number): number {
  const refDim = Math.max(artWidth, artHeight);
  // Target QR width ~14%-22% of larger image dimension, clamped cleanly
  const targetQrPx = Math.max(140, Math.min(420, Math.round(refDim * 0.18)));
  const totalModules = qrModules + 8; // including 4-module quiet zone each side
  const mod = Math.max(2, Math.min(8, Math.round(targetQrPx / totalModules)));
  return mod;
}

export function computeBurnLayout(
  artWidth: number,
  artHeight: number,
  qrModules: number,
  options: QrBurnOptions,
): BurnLayout {
  const margin = Math.max(8, Math.min(120, Math.round(options.marginPx)));
  const quietZoneModules = Math.max(4, options.quietZoneModules ?? 4);
  const modulePx =
    options.modulePx && options.modulePx >= 2
      ? Math.min(12, Math.round(options.modulePx))
      : chooseDefaultModulePx(artWidth, artHeight, qrModules);

  const qrSize = (qrModules + quietZoneModules * 2) * modulePx;
  const barInnerPad = Math.max(12, Math.round(margin * 0.6));
  const barHeight = qrSize + barInnerPad * 2;

  const minContentWidth = qrSize + barInnerPad * 2;
  const contentWidth = Math.max(artWidth, minContentWidth);
  const outWidth = contentWidth + margin * 2;
  const outHeight = artHeight + margin * 2 + barHeight;

  if (outWidth > MAX_OUTPUT_DIMENSION || outHeight > MAX_OUTPUT_DIMENSION) {
    throw new Error(
      `Signed output dimensions (${outWidth}x${outHeight}) exceed maximum (${MAX_OUTPUT_DIMENSION}px)`,
    );
  }

  const isTop = options.placement === 'top-right';
  const artX = margin + Math.floor((contentWidth - artWidth) / 2);
  const artY = isTop ? margin + barHeight : margin;

  const footerBar = {
    x: margin,
    y: isTop ? margin : margin + artHeight,
    width: contentWidth,
    height: barHeight,
  };

  let qrX: number;
  if (options.placement === 'bottom-left') {
    qrX = footerBar.x + barInnerPad;
  } else if (options.placement === 'bottom-center') {
    qrX = footerBar.x + Math.floor((footerBar.width - qrSize) / 2);
  } else {
    qrX = footerBar.x + footerBar.width - barInnerPad - qrSize;
  }
  const qrY = footerBar.y + barInnerPad;

  let labelArea: BurnLayout['labelArea'] = null;
  if (options.showLabel && options.placement !== 'bottom-center') {
    const minLabelWidth = 140;
    if (options.placement === 'bottom-left') {
      const lx = qrX + qrSize + 16;
      const lw = footerBar.x + footerBar.width - barInnerPad - lx;
      if (lw >= minLabelWidth) {
        labelArea = { x: lx, y: qrY, width: lw, height: qrSize };
      }
    } else {
      const lx = footerBar.x + barInnerPad;
      const lw = qrX - 16 - lx;
      if (lw >= minLabelWidth) {
        labelArea = { x: lx, y: qrY, width: lw, height: qrSize };
      }
    }
  }

  return {
    outWidth,
    outHeight,
    artRegion: [artX, artY, artWidth, artHeight],
    qrBox: {
      x: qrX,
      y: qrY,
      size: qrSize,
      modulePx,
      quietZoneModules,
    },
    footerBar,
    labelArea,
  };
}

function fillRectRgba(
  buf: Uint8Array,
  bufW: number,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number,
  a: number,
): void {
  const xEnd = x + w;
  const yEnd = y + h;
  for (let py = y; py < yEnd; py++) {
    let rowIdx = (py * bufW + x) * 4;
    for (let px = x; px < xEnd; px++) {
      buf[rowIdx] = r;
      buf[rowIdx + 1] = g;
      buf[rowIdx + 2] = b;
      buf[rowIdx + 3] = a;
      rowIdx += 4;
    }
  }
}

function renderLabelToRgba(
  width: number,
  height: number,
  lines: string[],
  theme: FrameTheme,
): Uint8ClampedArray | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, width, height);
  const isLight = theme === 'pure-white';
  const titleColor = isLight ? '#0f172a' : '#e2e8f0';
  const accentColor = isLight ? '#0369a1' : '#38bdf8';
  const mutedColor = isLight ? '#475569' : '#94a3b8';

  const baseFontSize = Math.max(12, Math.min(18, Math.floor(height / Math.max(5, lines.length + 2))));
  const lineHeight = Math.round(baseFontSize * 1.4);
  const totalTextHeight = lines.length * lineHeight;
  let y = Math.max(baseFontSize, Math.floor((height - totalTextHeight) / 2) + baseFontSize);

  ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0) {
      ctx.font = `700 ${baseFontSize}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = accentColor;
    } else if (i === 1) {
      ctx.font = `600 ${Math.max(11, baseFontSize - 1)}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = titleColor;
    } else {
      ctx.font = `500 ${Math.max(10, baseFontSize - 2)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.fillStyle = mutedColor;
    }
    ctx.fillText(line, 0, y, width);
    y += lineHeight;
  }

  return ctx.getImageData(0, 0, width, height).data;
}

function alphaCompositeOver(
  dst: Uint8Array,
  dstW: number,
  dstX: number,
  dstY: number,
  src: Uint8ClampedArray,
  srcW: number,
  srcH: number,
): void {
  for (let py = 0; py < srcH; py++) {
    for (let px = 0; px < srcW; px++) {
      const sIdx = (py * srcW + px) * 4;
      const sa = src[sIdx + 3];
      if (sa === 0) continue;
      const dIdx = ((dstY + py) * dstW + (dstX + px)) * 4;
      if (sa === 255) {
        dst[dIdx] = src[sIdx];
        dst[dIdx + 1] = src[sIdx + 1];
        dst[dIdx + 2] = src[sIdx + 2];
        dst[dIdx + 3] = 255;
      } else {
        const inv = 255 - sa;
        const da = dst[dIdx + 3];
        const outA = sa + Math.round((da * inv) / 255);
        if (outA > 0) {
          dst[dIdx] = Math.round((src[sIdx] * sa + dst[dIdx] * da * (inv / 255)) / outA);
          dst[dIdx + 1] = Math.round((src[sIdx + 1] * sa + dst[dIdx + 1] * da * (inv / 255)) / outA);
          dst[dIdx + 2] = Math.round((src[sIdx + 2] * sa + dst[dIdx + 2] * da * (inv / 255)) / outA);
          dst[dIdx + 3] = outA;
        }
      }
    }
  }
}

export function burnQrIntoRaster(
  artwork: CanonicalRaster,
  qr: QrMatrix,
  options: QrBurnOptions,
): { raster: CanonicalRaster; layout: BurnLayout } {
  const layout = computeBurnLayout(artwork.width, artwork.height, qr.size, options);
  const { outWidth, outHeight, artRegion, qrBox, footerBar, labelArea } = layout;

  const out = new Uint8Array(outWidth * outHeight * 4);

  // Fill background outside artwork region
  if (options.theme === 'pure-white') {
    fillRectRgba(out, outWidth, 0, 0, outWidth, outHeight, 248, 250, 252, 255);
    fillRectRgba(
      out,
      outWidth,
      footerBar.x,
      footerBar.y,
      footerBar.width,
      footerBar.height,
      241,
      245,
      249,
      255,
    );
  } else if (options.theme === 'transparent-margin') {
    // Transparent outer canvas, subtle dark backdrop on footer bar for legibility
    fillRectRgba(out, outWidth, 0, 0, outWidth, outHeight, 0, 0, 0, 0);
    fillRectRgba(
      out,
      outWidth,
      footerBar.x,
      footerBar.y,
      footerBar.width,
      footerBar.height,
      11,
      22,
      38,
      235,
    );
  } else {
    // dark-slate
    fillRectRgba(out, outWidth, 0, 0, outWidth, outHeight, 6, 17, 30, 255);
    fillRectRgba(
      out,
      outWidth,
      footerBar.x,
      footerBar.y,
      footerBar.width,
      footerBar.height,
      11,
      25,
      44,
      255,
    );
  }

  // Copy artwork pixel-for-pixel without ANY alpha premultiplication or resampling!
  const [artX, artY, artW, artH] = artRegion;
  const srcStride = artW * 4;
  const dstStride = outWidth * 4;
  for (let row = 0; row < artH; row++) {
    const srcOffset = row * srcStride;
    const dstOffset = (artY + row) * dstStride + artX * 4;
    out.set(artwork.data.subarray(srcOffset, srcOffset + srcStride), dstOffset);
  }

  // Draw crisp pure white QR quiet zone
  fillRectRgba(out, outWidth, qrBox.x, qrBox.y, qrBox.size, qrBox.size, 255, 255, 255, 255);

  // Draw crisp pure black QR modules (integer pixel scaling, zero anti-aliasing)
  const originX = qrBox.x + qrBox.quietZoneModules * qrBox.modulePx;
  const originY = qrBox.y + qrBox.quietZoneModules * qrBox.modulePx;
  for (let my = 0; my < qr.size; my++) {
    for (let mx = 0; mx < qr.size; mx++) {
      if (qr.data[my * qr.size + mx]) {
        fillRectRgba(
          out,
          outWidth,
          originX + mx * qrBox.modulePx,
          originY + my * qrBox.modulePx,
          qrBox.modulePx,
          qrBox.modulePx,
          0,
          0,
          0,
          255,
        );
      }
    }
  }

  // Draw optional label strictly inside labelArea (never overlapping artwork or QR box)
  if (labelArea && options.labelLines && options.labelLines.length > 0) {
    const labelPixels = renderLabelToRgba(
      labelArea.width,
      labelArea.height,
      options.labelLines,
      options.theme,
    );
    if (labelPixels) {
      alphaCompositeOver(
        out,
        outWidth,
        labelArea.x,
        labelArea.y,
        labelPixels,
        labelArea.width,
        labelArea.height,
      );
    }
  }

  return {
    raster: { width: outWidth, height: outHeight, data: out },
    layout,
  };
}
