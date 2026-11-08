// Easter egg (not science): "Life is lead based". A clone of the carbon world whose only life is tardigrades that never change.
// Reuses carbon's terrain, sky, stats and build; only mutation (zeroed), the captions and the labels differ.
import type { WorldConfig } from './types';

export type Egg = 'lead';


export function leadVariant(base: WorldConfig): WorldConfig {
  const rules = base.life.rules;
  return {
    ...base,
    displayName: 'Lead world (easter egg)',
    easterEgg: 'lead',
    build: { ...base.build, captions: { start: "Lead can't hold chains together… but tardigrades survive anything", life: 'Tardigrades. Real ones are carbon life, so this is a joke, not science' } },
    life: { ...base.life, rules: { ...rules, mutation: { ...rules.mutation, size: 0, prefTemp: 0, tolerance: 0, chem: 0, sizeBoost: 0, dietBoost: 0, jumpRate: 0, jumpScale: 0 } } },
  };
}
