import type { CanonicalRaster } from '../image/pngCodec';
import type { HumanMadeAssessmentStatus } from '../manifest/types';

export interface HumanMadeAssessmentResult {
  status: HumanMadeAssessmentStatus;
  modelId: string | null;
  summaryKey: 'notAssessedNoModel' | 'inconclusive' | 'experimentalAvailable';
  notes: string[];
}

export interface HumanMadeAssessor {
  readonly id: string;
  readonly isModelBundled: boolean;
  assess(raster?: CanonicalRaster | null): Promise<HumanMadeAssessmentResult>;
}

/**
 * Default MVP assessor: does NOT fabricate probabilities or confidence scores.
 * Ready to be swapped for an audited, benchmarked local ONNX Runtime Web model in Phase 5.
 */
export const defaultHumanMadeAssessor: HumanMadeAssessor = {
  id: 'none-mvp-placeholder',
  isModelBundled: false,
  async assess(): Promise<HumanMadeAssessmentResult> {
    return {
      status: 'not-assessed',
      modelId: null,
      summaryKey: 'notAssessedNoModel',
      notes: [
        'No validated local ONNX classification model is bundled in this release.',
        'Cryptographic signatures verify author declarations only and cannot prove whether pixels were hand-drawn.',
      ],
    };
  },
};
