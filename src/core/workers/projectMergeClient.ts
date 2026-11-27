import {
  ProjectParseError,
  inspectNativeProjectFile,
  mergeNativeProjectFile,
  type ProjectFileInput,
  type ProjectInspectionResult,
  type ProjectMergeResult,
  type StreamingHashProgress,
} from '../parsers';
import type {
  ProjectWorkerRequest,
  ProjectWorkerResponse,
} from '../../workers/projectMerge.worker';

export type ProjectPipelineStage =
  | 'idle'
  | 'awaiting-consent'
  | 'inspecting'
  | 'merging'
  | 'ready-to-sign'
  | 'signing'
  | 'complete'
  | 'error';

let nextRequestId = 1;
let sharedWorker: Worker | null = null;

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (!sharedWorker) {
    try {
      sharedWorker = new Worker(
        new URL('../../workers/projectMerge.worker.ts', import.meta.url),
        { type: 'module' },
      );
    } catch {
      return null;
    }
  }
  return sharedWorker;
}

export async function inspectProjectInWorker(
  file: ProjectFileInput,
  onHashProgress?: (progress: StreamingHashProgress) => void,
): Promise<ProjectInspectionResult> {
  const worker = typeof File !== 'undefined' && file instanceof File ? getWorker() : null;
  if (!worker) {
    const { inspection } = await inspectNativeProjectFile(file, { onHashProgress });
    return inspection;
  }

  const id = nextRequestId++;
  return new Promise<ProjectInspectionResult>((resolve, reject) => {
    const handleMessage = (event: MessageEvent<ProjectWorkerResponse>) => {
      const msg = event.data;
      if (msg.id !== id) return;
      if (msg.type === 'hash-progress') {
        onHashProgress?.(msg.progress);
        return;
      }
      worker.removeEventListener('message', handleMessage);
      if (msg.type === 'inspect-result') {
        resolve(msg.inspection);
      } else if (msg.type === 'error') {
        reject(new ProjectParseError(msg.code || 'WORKER_ERROR', msg.message, msg.messageJa || msg.message));
      }
    };
    worker.addEventListener('message', handleMessage);
    worker.postMessage({ id, type: 'inspect', file: file as File } satisfies ProjectWorkerRequest);
  });
}

export async function mergeProjectInWorker(
  file: ProjectFileInput,
  inspection: ProjectInspectionResult,
): Promise<ProjectMergeResult> {
  const worker = typeof File !== 'undefined' && file instanceof File ? getWorker() : null;
  if (!worker) {
    return mergeNativeProjectFile(file, inspection);
  }

  const id = nextRequestId++;
  return new Promise<ProjectMergeResult>((resolve, reject) => {
    const handleMessage = (event: MessageEvent<ProjectWorkerResponse>) => {
      const msg = event.data;
      if (msg.id !== id) return;
      worker.removeEventListener('message', handleMessage);
      if (msg.type === 'merge-result') {
        resolve(msg.mergeResult);
      } else if (msg.type === 'error') {
        reject(new ProjectParseError(msg.code || 'WORKER_ERROR', msg.message, msg.messageJa || msg.message));
      }
    };
    worker.addEventListener('message', handleMessage);
    worker.postMessage({
      id,
      type: 'merge',
      file: file as File,
      inspection,
    } satisfies ProjectWorkerRequest);
  });
}
