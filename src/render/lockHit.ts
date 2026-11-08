// Is a screen point inside a hover lock's rect plus a margin? Used to keep a lock steady and to open the locked creature
// on click even when the ray misses it. Pure.
export function inLock(x: number, y: number, r: { x: number; y: number; width: number; height: number }, margin: number): boolean {
  return x >= r.x - margin && x <= r.x + r.width + margin && y >= r.y - margin && y <= r.y + r.height + margin;
}
