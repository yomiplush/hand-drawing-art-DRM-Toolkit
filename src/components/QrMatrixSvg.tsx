import { useMemo } from 'react';
import { generateQrMatrix } from '../core/qr/qrGenerator';
import type { QrErrorCorrectionLevel } from '../core/qr/qrGenerator';

interface QrMatrixSvgProps {
  value: string;
  ecc?: QrErrorCorrectionLevel;
  quietModules?: number;
  label?: string;
  className?: string;
  testId?: string;
}

export function QrMatrixSvg({
  value,
  ecc = 'M',
  quietModules = 2,
  label = 'QR Code',
  className = 'w-40 h-40 rounded-lg bg-white p-1',
  testId,
}: QrMatrixSvgProps) {
  const matrix = useMemo(() => generateQrMatrix(value, ecc), [value, ecc]);
  const total = matrix.size + quietModules * 2;

  const rects: string[] = [];
  for (let y = 0; y < matrix.size; y += 1) {
    for (let x = 0; x < matrix.size; x += 1) {
      if (matrix.data[y * matrix.size + x]) {
        rects.push(`M${x + quietModules},${y + quietModules}h1v1h-1z`);
      }
    }
  }

  const logoSize = Math.max(4, total * 0.16);
  const logoOffset = (total - logoSize) / 2;

  return (
    <svg
      role="img"
      aria-label={label}
      data-testid={testId}
      viewBox={`0 0 ${total} ${total}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect x={0} y={0} width={total} height={total} fill="#ffffff" />
      <path d={rects.join('')} fill="#06111e" />
      {/* Center Shield + Pencil Brand Emblem */}
      <g shapeRendering="geometricPrecision">
        <rect
          x={logoOffset - logoSize * 0.12}
          y={logoOffset - logoSize * 0.12}
          width={logoSize * 1.24}
          height={logoSize * 1.24}
          rx={logoSize * 0.24}
          fill="#ffffff"
        />
        <g transform={`translate(${logoOffset}, ${logoOffset}) scale(${logoSize / 64})`}>
          <rect width="64" height="64" rx="14" fill="#06111e" />
          <path
            d="M32 9L50 16.5V30.5C50 42.4 42.3 52 32 55.5C21.7 52 14 42.4 14 30.5V16.5L32 9Z"
            stroke="#38bdf8"
            strokeWidth="3.5"
            fill="#0d2847"
          />
          <path
            d="M24 38L27.2 26.5L38.5 18.5L43.5 23.5L35.5 34.8L24 38Z"
            stroke="#e0f2fe"
            strokeWidth="2.8"
            strokeLinejoin="round"
            fill="#0ea5e9"
            fillOpacity="0.3"
          />
          <circle cx="34.5" cy="27.5" r="2.4" fill="#38bdf8" />
        </g>
      </g>
    </svg>
  );
}
