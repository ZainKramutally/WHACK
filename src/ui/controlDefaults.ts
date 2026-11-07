// Fallback slider definitions (CLAUDE.md "Condition sliders" table) until src/worlds/controls.ts is wired in.
// mountWorldUI takes the real list as an option; prefer that.
import type { ControlDef } from '../worlds/types';

export const DEFAULT_CONTROLS: ControlDef[] = [
  { id: 'temperature', label: 'Temperature', unit: '°C', min: -250, max: 150, scale: 'linear', moves: 'orbitDistance',
    hint: 'Moves the planet nearer to or farther from its star.', default: 15 },
  { id: 'nitrogen', label: 'Nitrogen', unit: '× Earth', min: 0.01, max: 1000, scale: 'log', moves: 'nitrogenInventory',
    hint: 'How much nitrogen the planet holds, in its air and seas.', default: 1 },
  { id: 'oxygen', label: 'Oxygen', unit: '%', min: 0, max: 40, scale: 'linear', moves: 'oxygenInventory',
    hint: 'Free oxygen in the air.', default: 21 },
];
