import { useEffect, useRef, useState } from 'react';
import { Camera, StopCircle } from 'lucide-react';
import { decodeQrFromImageData } from '../core/qr/qrDecoder';
import { useI18n } from '../i18n/context';

interface QrCameraScannerProps {
  onDetected: (rawText: string) => void;
}

interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
}

declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

export function QrCameraScanner({ onDetected }: QrCameraScannerProps) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timerId: number | null = null;

    const detector =
      typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function'
        ? new window.BarcodeDetector({ formats: ['qr_code'] })
        : null;

    const tick = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        if (detector) {
          try {
            const found = await detector.detect(video);
            if (found.length > 0 && found[0].rawValue) {
              stopCamera();
              onDetected(found[0].rawValue);
              return;
            }
          } catch {
            // Fallback to jsQR canvas frame below
          }
        }
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const raw = decodeQrFromImageData(imgData);
            if (raw) {
              stopCamera();
              onDetected(raw);
              return;
            }
          }
        }
      }
      if (!cancelled) {
        timerId = window.setTimeout(tick, 180);
      }
    };

    timerId = window.setTimeout(tick, 200);
    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [active, onDetected]);

  const startCamera = async () => {
    setErrorMsg(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg(t.verify.cameraError);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch {
      setErrorMsg(t.verify.cameraError);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {!active ? (
          <button
            type="button"
            onClick={startCamera}
            className="ga-btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors min-h-[44px] cursor-pointer"
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
            <span>{t.verify.cameraStart}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={stopCamera}
            className="ga-status-error inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors min-h-[44px] cursor-pointer"
          >
            <StopCircle className="h-4 w-4" aria-hidden="true" />
            <span>{t.verify.cameraStop}</span>
          </button>
        )}
        <span className="text-xs ga-text-muted">{t.verify.cameraHint}</span>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="ga-status-error rounded-xl border p-3 text-sm"
        >
          {errorMsg}
        </div>
      )}

      <div className={active ? 'relative overflow-hidden rounded-xl border ga-border-strong bg-black' : 'hidden'}>
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-full max-h-[360px] object-contain"
        />
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
