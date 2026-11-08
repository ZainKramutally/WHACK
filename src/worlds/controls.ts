// The three condition sliders, shared by every world so the ranges match (CLAUDE.md "Condition sliders").
import type { ControlDef, ControlId, CrustPickId } from './types';

/** The rock chips every world shows, in order (docs/features/crust.md); each world maps them to its own minerals via its mineral of the same id. */
export const CRUST_PICKS: readonly { id: CrustPickId; label: string }[] = [
  { id: 'basalt', label: 'Basalt' },
  { id: 'granite', label: 'Granite' },
  { id: 'ironstone', label: 'Ironstone' },
  { id: 'silicide', label: 'Silicide' },
  { id: 'nitride', label: 'Nitride' },
];

export const controls: Record<ControlId, ControlDef> = {
  temperature: {
    id: 'temperature',
    label: 'Temperature',
    unit: '°C',
    min: -250,
    max: 150,
    scale: 'linear',
    moves: 'orbitDistance',
    hint: "Moves the planet's distance from its star, so starlight changes with it.",
    default: 15,
  },
  nitrogen: {
    id: 'nitrogen',
    label: 'Nitrogen',
    unit: '× Earth',
    min: 0.01,
    max: 1000,
    scale: 'log',
    moves: 'nitrogenInventory',
    hint: "How much nitrogen the planet has per square metre, in its air and (on cold worlds) its seas, relative to Earth's.",
    default: 1,
  },
  oxygen: {
    id: 'oxygen',
    label: 'Oxygen',
    unit: '%',
    min: 0,
    max: 40,
    scale: 'linear',
    moves: 'oxygenInventory',
    hint: 'How much free oxygen is in the air.',
    default: 21,
  },
};

export const controlList: ControlDef[] = [controls.temperature, controls.nitrogen, controls.oxygen];
export const controlIds: ControlId[] = ['temperature', 'nitrogen', 'oxygen'];
