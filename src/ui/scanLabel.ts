// Hover-lock label for a creature: its kind's name once the player has found that kind, else "NEW SPECIES".
// An undiscovered kind's name is never shown (CLAUDE.md), including animals that match no announced species.
export const NEW_SPECIES = 'NEW SPECIES';

export function scanLabel(form: { name?: string; recognised: boolean } | undefined): string {
  return form?.recognised && form.name ? form.name : NEW_SPECIES;
}
