// Pixel icons for the group-14 carousel cards: a periodic-table tile (atomic number + symbol) beside a small pixel motif
// that hints at the element's chemistry. Motifs are rasterised from atoms and bonds into a 26×24 grid and emitted as three
// crisp SVG paths (ink, main, highlight); colours come from CSS vars (--ink, --ea, --eb) set per card in selection.css.
import type { ElementRow } from './elements';

const W = 26;
const H = 24;
type Atom = [x: number, y: number, size?: 3 | 5 | 7];

function motif(atoms: Atom[], bonds: [number, number][] = [], dots: [number, number][] = []): string {
  const g: string[][] = Array.from({ length: H }, () => Array<string>(W).fill('.'));
  const put = (x: number, y: number, c: string) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; };

  // Bonds first (1-unit Bresenham lines between atom centres), so atoms draw over their ends.
  for (const [i, j] of bonds) {
    let [x, y] = atoms[i];
    const [x1, y1] = atoms[j];
    const dx = Math.abs(x1 - x), dy = -Math.abs(y1 - y), sx = x < x1 ? 1 : -1, sy = y < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      put(x, y, 'k');
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
  }
  for (const [x, y] of dots) put(x, y, 'k');

  // Atoms: ink outline, main-colour body, a highlight pixel at the top-left of the body (5 and 7 only).
  for (const [cx, cy, s = 5] of atoms) {
    const h = (s - 1) / 2;
    for (let y = -h; y <= h; y++) {
      for (let x = -h; x <= h; x++) {
        const edge = Math.abs(x) === h || Math.abs(y) === h;
        put(cx + x, cy + y, edge ? 'k' : x === -h + 1 && y === -h + 1 && s >= 5 ? 'b' : 'a');
      }
    }
  }

  const path = (c: string) => {
    let d = '';
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (g[y][x] !== c) continue;
        let n = 1;
        while (x + n < W && g[y][x + n] === c) n++;
        d += `M${x} ${y}h${n}v1h-${n}z`;
        x += n - 1;
      }
    }
    return d;
  };
  return `<svg class="motif" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path class="k" d="${path('k')}"/><path class="a" d="${path('a')}"/><path class="b" d="${path('b')}"/></svg>`;
}

const ring: Atom[] = [[13, 3], [21, 8], [21, 16], [13, 21], [5, 16], [5, 8]];
const lattice: Atom[] = [
  [4, 4], [13, 4], [22, 4],
  [4, 12], [13, 12, 7], [22, 12],
  [4, 20], [13, 20], [22, 20],
];

const MOTIFS: Record<number, () => string> = {
  // Carbon: a six-membered ring, the backbone shape of organic chemistry.
  6: () => motif(ring, ring.map((_, i) => [i, (i + 1) % 6] as [number, number])),
  // Silicon: a crystal lattice, every atom bonded into a rigid framework (silicon is rock-forming).
  14: () => motif(lattice, [
    [0, 1], [1, 2], [3, 4], [4, 5], [6, 7], [7, 8], [0, 3], [3, 6], [1, 4], [4, 7], [2, 5], [5, 8],
    [4, 0], [4, 2], [4, 6], [4, 8],
  ]),
  // Germanium: the same framework with a bond already giving way (weaker bonds than silicon).
  32: () => motif([[13, 12, 7], [4, 4], [22, 4], [4, 20], [22, 20]], [[0, 1], [0, 2], [0, 3]], [[17, 16], [19, 18]]),
  // Tin: metallic, atoms packed together with no bonds between them.
  50: () => motif([[8, 5], [18, 5], [3, 12], [13, 12], [23, 12], [8, 19], [18, 19]]),
  // Lead: heavy, big atoms stacked like bricks.
  82: () => motif([[5, 5, 7], [13, 5, 7], [21, 5, 7], [9, 12, 7], [17, 12, 7], [5, 19, 7], [13, 19, 7], [21, 19, 7]]),
  // Flerovium: one big nucleus and a trail of smaller, fading atoms (it decays in seconds).
  114: () => motif([[7, 12, 7], [15, 12, 5], [21, 12, 3]], [], [[12, 12], [24, 12], [15, 6], [15, 18], [21, 8], [21, 16]]),
};

/** The element's icon: table tile (Z and symbol) plus its chemistry motif. */
export function elementIcon(e: ElementRow): string {
  const m = MOTIFS[e.z];
  return `<span class="eltile"><i>${e.z}</i><b>${e.symbol}</b></span>${m ? m() : ''}`;
}
