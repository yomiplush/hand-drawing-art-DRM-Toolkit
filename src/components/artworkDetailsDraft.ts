import type { ArtworkDetailsDraft } from './ArtworkDetailsPanel';

export function createEmptyArtworkDetailsDraft(): ArtworkDetailsDraft {
  return {
    creationMethod: '',
    envSoftware: '',
    envHardware: '',
    envInputDevice: '',
    envNotes: '',
    evidenceItems: [],
  };
}
