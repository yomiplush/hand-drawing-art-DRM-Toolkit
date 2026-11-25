import { computePerceptualHashes, type PerceptualHashes } from '../image/perceptualHash';
import {
  type CanonicalRaster,
  decodeImageFileToCanonicalRgba8,
} from '../image/pngCodec';
import {
  type InImageSignedArtworkResult,
  type SignedArtworkResult,
  createInImageSignedArtworkPng,
  createSignedArtworkPng,
} from '../manifest/signArtwork';
import type { VerificationResult } from '../manifest/types';
import { type QrDecodeResult, decodeQrFromCanonicalRaster } from '../qr/qrDecoder';
import {
  type KeyNoticeLookup,
  type TrustedKeyLookup,
  verifyImageWithEmbeddedQr,
  verifyProofAndArtwork,
} from '../verify/verifier';
import type {
  ImageWorkerRequest,
  ImageWorkerResponse,
  WorkerProgressStage,
} from '../../workers/imageCrypto.worker';

export type { WorkerProgressStage };

export type WorkerProgressCallback = (percent: number, stage: WorkerProgressStage) => void;

interface PendingJob {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  onProgress?: WorkerProgressCallback;
}

class ImageWorkerClient {
  private worker: Worker | null = null;
  private workerFailed = false;
  private nextId = 1;
  private pending = new Map<number, PendingJob>();

  private getWorker(): Worker | null {
    if (this.workerFailed || typeof Worker === 'undefined') {
      return null;
    }
    if (this.worker) return this.worker;
    try {
      const worker = new Worker(
        new URL('../../workers/imageCrypto.worker.ts', import.meta.url),
        { type: 'module' },
      );
      worker.onmessage = (event: MessageEvent<ImageWorkerResponse>) => {
        const msg = event.data;
        const job = this.pending.get(msg.id);
        if (!job) return;
        if (msg.type === 'progress') {
          job.onProgress?.(msg.percent, msg.stage);
          return;
        }
        this.pending.delete(msg.id);
        if (msg.type === 'error') {
          job.reject(new Error(msg.message));
        } else {
          job.resolve(msg.data);
        }
      };
      worker.onerror = (err) => {
        this.workerFailed = true;
        const error = new Error(err.message || 'Image worker crashed');
        for (const [, job] of this.pending) {
          job.reject(error);
        }
        this.pending.clear();
        this.worker?.terminate();
        this.worker = null;
      };
      this.worker = worker;
      return worker;
    } catch {
      this.workerFailed = true;
      return null;
    }
  }

  private async runInWorker<T>(
    buildReq: (id: number) => ImageWorkerRequest,
    fallback: () => Promise<T>,
    onProgress?: WorkerProgressCallback,
  ): Promise<T> {
    const worker = this.getWorker();
    if (!worker) {
      return fallback();
    }
    const id = this.nextId++;
    const req = buildReq(id);

    try {
      return await new Promise<T>((resolve, reject) => {
        this.pending.set(id, {
          resolve: resolve as (v: unknown) => void,
          reject,
          onProgress,
        });
        try {
          worker.postMessage(req);
        } catch (err) {
          this.pending.delete(id);
          reject(err instanceof Error ? err : new Error('Worker postMessage failed'));
        }
      });
    } catch (err) {
      // Fallback transparently if structured-clone rejected a non-cloneable CryptoKey or Worker failed
      if (
        err instanceof Error &&
        (err.name === 'DataCloneError' ||
          /clone|worker crashed/i.test(err.message))
      ) {
        return fallback();
      }
      throw err;
    }
  }

  async decodeImage(
    fileOrBytes: File | Blob | Uint8Array,
    onProgress?: WorkerProgressCallback,
  ): Promise<{ raster: CanonicalRaster; sourceFormat: 'png' | 'browser-raster' }> {
    const bytes =
      fileOrBytes instanceof Uint8Array
        ? fileOrBytes
        : new Uint8Array(await fileOrBytes.arrayBuffer());
    const mimeType = fileOrBytes instanceof Uint8Array ? undefined : fileOrBytes.type || undefined;

    return this.runInWorker(
      (id) => ({ id, type: 'decodeImage', payload: { bytes, mimeType } }),
      async () => {
        onProgress?.(25, 'decoding');
        const res = await decodeImageFileToCanonicalRgba8(fileOrBytes);
        onProgress?.(100, 'complete');
        return res;
      },
      onProgress,
    );
  }

  async decodeQr(
    raster: CanonicalRaster,
    onProgress?: WorkerProgressCallback,
  ): Promise<QrDecodeResult | null> {
    return this.runInWorker(
      (id) => ({ id, type: 'decodeQr', payload: { raster } }),
      async () => {
        onProgress?.(25, 'scanning-qr');
        const res = decodeQrFromCanonicalRaster(raster);
        onProgress?.(100, 'complete');
        return res;
      },
      onProgress,
    );
  }

  async computePerceptualHashes(
    raster: CanonicalRaster,
    onProgress?: WorkerProgressCallback,
  ): Promise<PerceptualHashes> {
    return this.runInWorker(
      (id) => ({ id, type: 'computePerceptualHashes', payload: { raster } }),
      async () => {
        onProgress?.(35, 'hashing');
        const res = computePerceptualHashes(raster);
        onProgress?.(100, 'complete');
        return res;
      },
      onProgress,
    );
  }

  async signArtworkFrame(
    params: Parameters<typeof createSignedArtworkPng>[0],
    onProgress?: WorkerProgressCallback,
  ): Promise<SignedArtworkResult> {
    return this.runInWorker(
      (id) => ({ id, type: 'signFrame', payload: params }),
      async () => {
        onProgress?.(25, 'hashing');
        const res = await createSignedArtworkPng(params);
        onProgress?.(100, 'complete');
        return res;
      },
      onProgress,
    );
  }

  async signArtworkInImage(
    params: Parameters<typeof createInImageSignedArtworkPng>[0],
    onProgress?: WorkerProgressCallback,
  ): Promise<InImageSignedArtworkResult> {
    return this.runInWorker(
      (id) => ({ id, type: 'signInImage', payload: params }),
      async () => {
        onProgress?.(25, 'hashing');
        const res = await createInImageSignedArtworkPng(params);
        onProgress?.(100, 'complete');
        return res;
      },
      onProgress,
    );
  }

  async verifyImage(
    params: {
      fileOrBytes: File | Blob | Uint8Array;
      computePerceptual?: boolean;
      lookupTrustedKey?: TrustedKeyLookup;
      lookupKeyNotices?: KeyNoticeLookup;
    },
    onProgress?: WorkerProgressCallback,
  ): Promise<{
    qrRawText: string;
    qrStrategy: string;
    imageWidth: number;
    imageHeight: number;
    sourceFormat: 'png' | 'browser-raster';
    raster: CanonicalRaster;
    verification: VerificationResult;
    perceptualHashes?: PerceptualHashes;
  }> {
    if (params.lookupTrustedKey || params.lookupKeyNotices) {
      onProgress?.(25, 'decoding');
      const verified = await verifyImageWithEmbeddedQr(params);
      const perceptualHashes = params.computePerceptual
        ? computePerceptualHashes(verified.raster)
        : undefined;
      onProgress?.(100, 'complete');
      return { ...verified, perceptualHashes };
    }
    const bytes =
      params.fileOrBytes instanceof Uint8Array
        ? params.fileOrBytes
        : new Uint8Array(await params.fileOrBytes.arrayBuffer());
    const mimeType =
      params.fileOrBytes instanceof Uint8Array ? undefined : params.fileOrBytes.type || undefined;

    return this.runInWorker(
      (id) => ({
        id,
        type: 'verifyImage',
        payload: { bytes, mimeType, computePerceptual: params.computePerceptual },
      }),
      async () => {
        onProgress?.(25, 'decoding');
        const verified = await verifyImageWithEmbeddedQr({ fileOrBytes: params.fileOrBytes });
        const perceptualHashes = params.computePerceptual
          ? computePerceptualHashes(verified.raster)
          : undefined;
        onProgress?.(100, 'complete');
        return { ...verified, perceptualHashes };
      },
      onProgress,
    );
  }

  async verifyProof(
    params: {
      proofInput: string;
      artworkRaster?: CanonicalRaster | null;
      computePerceptual?: boolean;
    },
    onProgress?: WorkerProgressCallback,
  ): Promise<{
    verification: VerificationResult;
    perceptualHashes?: PerceptualHashes;
  }> {
    return this.runInWorker(
      (id) => ({
        id,
        type: 'verifyProof',
        payload: {
          proofInput: params.proofInput,
          artworkRaster: params.artworkRaster,
          computePerceptual: params.computePerceptual,
        },
      }),
      async () => {
        onProgress?.(30, 'verifying');
        const verification = await verifyProofAndArtwork({
          proofInput: params.proofInput,
          artworkRaster: params.artworkRaster,
        });
        const perceptualHashes =
          params.computePerceptual && params.artworkRaster
            ? computePerceptualHashes(params.artworkRaster)
            : undefined;
        onProgress?.(100, 'complete');
        return { verification, perceptualHashes };
      },
      onProgress,
    );
  }
}

export const imageWorkerClient = new ImageWorkerClient();
