// Group 14 of the periodic table as the selection screen lists it (CLAUDE.md "The experience").
// Selectable rows point at a world config (status label and everything else comes from there). Greyed rows carry a
// one-line reason. Reasons marked `copy` are design-doc wording with no citation yet: needs a source or an assumption flag.
import type { WorldId } from '../../worlds/types';

export interface ElementRow {
  z: number;
  symbol: string;
  name: string;
  /** Present only on selectable rows. */
  worldId?: WorldId;
  /** Why a greyed row can't be chosen. */
  reason?: string;
  /** True when the reason is draft wording that still needs a source (see docs/features/selection-screen.md §3.2). */
  copy?: boolean;
}

export const group14: ElementRow[] = [
  { z: 6, symbol: 'C', name: 'Carbon', worldId: 'carbon' },
  { z: 14, symbol: 'Si', name: 'Silicon', worldId: 'silicon' },
  { z: 32, symbol: 'Ge', name: 'Germanium', reason: "Bonds even weaker than silicon's" },
  { z: 50, symbol: 'Sn', name: 'Tin', reason: 'A metal: its bonds are too weak to hold a chain', copy: true },
  { z: 82, symbol: 'Pb', name: 'Lead', reason: 'A heavy metal that barely bonds to itself', copy: true },
  { z: 114, symbol: 'Fl', name: 'Flerovium', reason: 'Made in a lab; atoms last only seconds' },
];

export const elementByWorld = (id: WorldId): ElementRow => {
  const e = group14.find((r) => r.worldId === id);
  if (!e) throw new Error(`no element for world ${id}`);
  return e;
};
