// Pixel icons for the organism inspect card: diet (grazer / omnivore / hunter) and habitat (land / sea / air).
// 9×9 bitmaps drawn as one SVG path in currentColor (cream) on an ink chip (.wu-ico in ui.css); square corners, crisp edges.
import type { Role } from '../sim/guide';
import type { LocomotionMode } from '../sim/develop';

export type Habitat = 'land' | 'sea' | 'air';

const SIZE = 9;
const BITMAPS: Record<Role | Habitat, string[]> = {
  grazer: [   // sprout
    '.........',
    '..##..##.',
    '.####.###',
    '..###.##.',
    '....##...',
    '....#....',
    '....#....',
    '....#....',
    '.#######.',
  ],
  hunter: [   // fang
    '.#######.',
    '.#######.',
    '.#######.',
    '..#####..',
    '..#####..',
    '...###...',
    '...###...',
    '....#....',
    '.........',
  ],
  omnivore: [   // leaf beside a fang
    '.........',
    '.##...###',
    '####..###',
    '####..###',
    '.##...###',
    '.#....##.',
    '.#....##.',
    '.#.....#.',
    '.#.......',
  ],
  land: [   // hill and a blade of grass
    '.........',
    '.........',
    '....#....',
    '...###..#',
    '..#####.#',
    '.#######.',
    '#########',
    '#########',
    '#########',
  ],
  sea: [   // waves
    '.........',
    '.##...##.',
    '#..#.#..#',
    '.........',
    '.##...##.',
    '#..#.#..#',
    '.........',
    '.##...##.',
    '#..#.#..#',
  ],
  air: [   // wings
    '.........',
    '.........',
    '##.....##',
    '.###.###.',
    '..#####..',
    '...###...',
    '....#....',
    '.........',
    '.........',
  ],
};

export const ROLE_LABEL: Record<Role, string> = { grazer: 'Grazer', hunter: 'Hunter', omnivore: 'Omnivore' };
export const ROLE_TITLE: Record<Role, string> = { grazer: 'Grazer: eats plants', hunter: 'Hunter: eats other animals', omnivore: 'Omnivore: eats plants and other animals' };
export const HABITAT_LABEL: Record<Habitat, string> = { land: 'Land', sea: 'Sea', air: 'Air' };

/** Habitat from the locomotion mode: walk → land, swim → sea, hover → air; a rooted one takes the medium its buoyancy gene suggests. */
export function habitatOf(mode: LocomotionMode, buoy = 0): Habitat {
  return mode === 0 ? 'land' : mode === 1 ? 'sea' : mode === 2 ? 'air' : buoy >= 0.5 ? 'sea' : 'land';
}

/** SVG path data (one rect per run of pixels) for a bitmap. Exported for tests. */
export function bitmapPath(rows: string[]): string {
  const d: string[] = [];
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length;) {
      if (r[x] !== '#') { x++; continue; }
      let n = 1;
      while (r[x + n] === '#') n++;
      d.push(`M${x} ${y}h${n}v1h-${n}z`);
      x += n;
    }
  });
  return d.join('');
}

const NS = 'http://www.w3.org/2000/svg';

/** An icon chip with a visible word beside it; `title`/aria-label carry the full text. */
export function iconChip(kind: Role | Habitat, word: string, title: string): HTMLElement {
  const chip = document.createElement('span');
  chip.className = 'wu-chip';
  chip.title = title;
  chip.setAttribute('aria-label', title);
  const ico = document.createElement('span');
  ico.className = 'wu-ico';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', bitmapPath(BITMAPS[kind]));
  path.setAttribute('fill', 'currentColor');
  svg.append(path);
  ico.append(svg);
  const label = document.createElement('span');
  label.textContent = word;
  chip.append(ico, label);
  return chip;
}
