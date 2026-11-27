import {
  inspectNativeProjectFile,
  mergeNativeProjectFile,
  type ProjectInspectionResult,
  type ProjectMergeResult,
  type StreamingHashProgress,
} from '../core/parsers';

export type ProjectWorkerRequest =
  | { id: number; type: 'inspect'; file: File }
  | { id: number; type: 'merge'; file: File; inspection: ProjectInspectionResult };

export type ProjectWorkerResponse =
  | { id: number; type: 'hash-progress'; progress: StreamingHashProgress }
  | { id: number; type: 'inspect-result'; inspection: ProjectInspectionResult }
  | { id: number; type: 'merge-result'; mergeResult: ProjectMergeResult }
  | { id: number; type: 'error'; code?: string; message: string; messageJa?: string };

self.onmessage = async (event: MessageEvent<ProjectWorkerRequest>) => {
  const req = event.data;
  const { id } = req;

  try {
    if (req.type === 'inspect') {
      const { inspection } = await inspectNativeProjectFile(req.file, {
        onHashProgress: (progress) => {
          self.postMessage({ id, type: 'hash-progress', progress } satisfies ProjectWorkerResponse);
        },
      });
      self.postMessage({ id, type: 'inspect-result', inspection } satisfies ProjectWorkerResponse);
      return;
    }

    if (req.type === 'merge') {
      const mergeResult = await mergeNativeProjectFile(req.file, req.inspection);
      self.postMessage(
        { id, type: 'merge-result', mergeResult } satisfies ProjectWorkerResponse,
        { transfer: [mergeResult.mergedPngBytes.buffer] },
      );
      return;
    }
  } catch (err) {
    const anyErr = err as { code?: string; message?: string; messageJa?: string };
    self.postMessage({
      id,
      type: 'error',
      code: anyErr?.code,
      message: anyErr?.message || 'Project worker failed',
      messageJa: anyErr?.messageJa,
    } satisfies ProjectWorkerResponse);
  }
};
