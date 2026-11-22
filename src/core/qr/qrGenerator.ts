import QRCode from 'qrcode';

export type QrErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export interface QrMatrix {
  size: number;
  version: number;
  errorCorrectionLevel: QrErrorCorrectionLevel;
  data: Uint8Array; // 1 for dark module, 0 for light module
}

export function generateQrMatrix(
  text: string,
  errorCorrectionLevel: QrErrorCorrectionLevel = 'M',
): QrMatrix {
  if (!text || text.length === 0) {
    throw new Error('QR payload text must be non-empty');
  }
  const qr = QRCode.create(text, {
    errorCorrectionLevel,
  });
  return {
    size: qr.modules.size,
    version: qr.version,
    errorCorrectionLevel,
    data: new Uint8Array(qr.modules.data),
  };
}
