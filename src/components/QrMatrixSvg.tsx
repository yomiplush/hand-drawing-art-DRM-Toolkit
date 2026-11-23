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
    </svg>
  );
}
