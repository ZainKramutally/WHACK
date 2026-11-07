// The three condition sliders, shared by every world so the ranges match (CLAUDE.md "Condition sliders").
import type { ControlDef, ControlId } from './types';

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
