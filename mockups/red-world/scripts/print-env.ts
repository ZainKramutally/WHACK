// Prints every named environment: drivers, material weights, palette and rationale. Usage: npx vite-node scripts/print-env.ts

import { environmentFrom, NAMED, mineralWeights, airWeights, pigmentWeights } from '../src/env/derive';
const hx = (n: number) => '#' + n.toString(16).padStart(6, '0');
{
  for (const [k, v] of Object.entries(NAMED)) {
    const e = environmentFrom(v.soup);
    const r = (w: any) => Object.entries(w).filter(([, x]: any) => x > 0.01).map(([n, x]: any) => `${n}:${x.toFixed(2)}`).join(' ');
    console.log(k, JSON.stringify(Object.fromEntries(Object.entries(e.drivers).map(([a, b]) => [a, +(+b).toFixed(2)]))));
    console.log('  M', r(mineralWeights(e.drivers, v.soup)), '| A', r(airWeights(e.drivers)), '| P', r(pigmentWeights(e.drivers)));
    console.log('  ', Object.entries(e.palette).map(([a, b]) => `${a}=${hx(b)}`).join(' '));
    console.log('  ', e.rationale, 'moons', e.sky.moons, 'glow', e.glow.strength.toFixed(2), 'fog', e.fog.density.toFixed(2));
  }
}
