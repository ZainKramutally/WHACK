// Hover-lock state and label for a living thing.
//   new:          the sim has announced this creature's kind but the player has not filed it yet (clicking files it)
//   known:        the kind is filed in the bestiary, so its name is shown
//   unclassified: an animal that matches no announced species (clicking cannot file anything)
//   plant:        a producer
// An undiscovered kind's name is never shown (CLAUDE.md).
export type ScanState = 'new' | 'known' | 'unclassified' | 'plant';

export const NEW_SPECIES = 'NEW SPECIES · CLICK TO SCAN';
export const UNCLASSIFIED = 'UNCLASSIFIED';

export function scanState(form: { name?: string; recognised: boolean } | undefined): { state: ScanState; label: string } {
  if (form?.recognised && form.name) return { state: 'known', label: form.name };
  if (form?.name) return { state: 'new', label: NEW_SPECIES };
  return { state: 'unclassified', label: UNCLASSIFIED };
}
