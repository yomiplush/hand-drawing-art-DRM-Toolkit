import { computePerceptualHashes, type PerceptualHashes } from '../core/image/perceptualHash';
import {
  type CanonicalRaster,
  decodeImageFileToCanonicalRgba8,
} from '../core/image/pngCodec';
import {
  type InImageSignedArtworkResult,
  type SignedArtworkResult,
  createInImageSignedArtworkPng,
  createSignedArtworkPng,
} from '../core/manifest/signArtwork';
import type { VerificationResult } from '../core/manifest/types';
import { type QrDecodeResult, decodeQrFromCanonicalRaster } from '../core/qr/qrDecoder';
import { verifyImageWithEmbeddedQr, verifyProofAndArtwork } from '../core/verify/verifier';

export type WorkerProgressStage =
  | 'decoding'
  | 'scanning-qr'
  | 'hashing'
  | 'signing'
  | 'embedding-qr'
  | 'encoding-png'
  | 'verifying'
  | 'complete';

export type ImageWorkerRequest =
  | {
      id: number;
      type: 'decodeImage';
      payload: { bytes: Uint8Array; mimeType?: string };
    }
  | {
      id: number;
      type: 'decodeQr';
      payload: { raster: CanonicalRaster };
    }
  | {
      id: number;
      type: 'computePerceptualHashes';
      payload: { raster: CanonicalRaster };
    }
  | {
      id: number;
      type: 'signFrame';
      payload: Parameters<typeof createSignedArtworkPng>[0];
    }
  | {
      id: number;
      type: 'signInImage';
      payload: Parameters<typeof createInImageSignedArtworkPng>[0];
    }
  | {
      id: number;
      type: 'verifyImage';
      payload: { bytes: Uint8Array; mimeType?: string; computePerceptual?: boolean };
    }
  | {
      id: number;
      type: 'verifyProof';
      payload: {
        proofInput: string;
        artworkRaster?: CanonicalRaster | null;
        computePerceptual?: boolean;
      };
    };

export type ImageWorkerResponse =
  | {
      id: number;
      type: 'progress';
      percent: number;
      stage: WorkerProgressStage;
    }
  | {
      id: number;
      type: 'result';
      data: unknown;
    }
  | {
      id: number;
      type: 'error';
      message: string;
    };

function postProgress(id: number, percent: number, stage: WorkerProgressStage): void {
  self.postMessage({ id, type: 'progress', percent, stage } satisfies ImageWorkerResponse);
}

self.onmessage = async (event: MessageEvent<ImageWorkerRequest>) => {
  const req = event.data;
  const { id } = req;

  try {
    if (req.type === 'decodeImage') {
      postProgress(id, 20, 'decoding');
      const blobOrBytes = req.payload.mimeType
        ? new Blob([new Uint8Array(req.payload.bytes)], { type: req.payload.mimeType })
        : req.payload.bytes;
      const decoded = await decodeImageFileToCanonicalRgba8(blobOrBytes);
      postProgress(id, 100, 'complete');
      const res: ImageWorkerResponse = { id, type: 'result', data: decoded };
      self.postMessage(res, { transfer: [decoded.raster.data.buffer] });
      return;
    }

    if (req.type === 'decodeQr') {
      postProgress(id, 25, 'scanning-qr');
      const qr: QrDecodeResult | null = decodeQrFromCanonicalRaster(req.payload.raster);
      postProgress(id, 100, 'complete');
      self.postMessage({ id, type: 'result', data: qr } satisfies ImageWorkerResponse);
      return;
    }

    if (req.type === 'computePerceptualHashes') {
      postProgress(id, 35, 'hashing');
      const hashes: PerceptualHashes = computePerceptualHashes(req.payload.raster);
      postProgress(id, 100, 'complete');
      self.postMessage({ id, type: 'result', data: hashes } satisfies ImageWorkerResponse);
      return;
    }

    if (req.type === 'signFrame') {
      postProgress(id, 20, 'hashing');
      const result: SignedArtworkResult = await createSignedArtworkPng(req.payload);
      postProgress(id, 100, 'complete');
      const transferables: Transferable[] = [result.pngBytes.buffer, result.raster.data.buffer];
      self.postMessage({ id, type: 'result', data: result } satisfies ImageWorkerResponse, {
        transfer: transferables,
      });
      return;
    }

    if (req.type === 'signInImage') {
      postProgress(id, 20, 'hashing');
      const result: InImageSignedArtworkResult = await createInImageSignedArtworkPng(req.payload);
      postProgress(id, 100, 'complete');
      const transferables: Transferable[] = [result.pngBytes.buffer, result.raster.data.buffer];
      self.postMessage({ id, type: 'result', data: result } satisfies ImageWorkerResponse, {
        transfer: transferables,
      });
      return;
    }

    if (req.type === 'verifyImage') {
      postProgress(id, 20, 'decoding');
      const blobOrBytes = req.payload.mimeType
        ? new Blob([new Uint8Array(req.payload.bytes)], { type: req.payload.mimeType })
        : req.payload.bytes;
      const verified = await verifyImageWithEmbeddedQr({ fileOrBytes: blobOrBytes });
      postProgress(id, 85, 'verifying');
      const perceptualHashes = req.payload.computePerceptual
        ? computePerceptualHashes(verified.raster)
        : undefined;
      postProgress(id, 100, 'complete');
      const payload = { ...verified, perceptualHashes };
      self.postMessage({ id, type: 'result', data: payload } satisfies ImageWorkerResponse, {
        transfer: [verified.raster.data.buffer],
      });
      return;
    }

    if (req.type === 'verifyProof') {
      postProgress(id, 30, 'verifying');
      const verification: VerificationResult = await verifyProofAndArtwork({
        proofInput: req.payload.proofInput,
        artworkRaster: req.payload.artworkRaster,
      });
      const perceptualHashes =
        req.payload.computePerceptual && req.payload.artworkRaster
          ? computePerceptualHashes(req.payload.artworkRaster)
          : undefined;
      postProgress(id, 100, 'complete');
      self.postMessage({
        id,
        type: 'result',
        data: { verification, perceptualHashes },
      } satisfies ImageWorkerResponse);
      return;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Worker processing failed';
    self.postMessage({ id, type: 'error', message } satisfies ImageWorkerResponse);
  }
};
