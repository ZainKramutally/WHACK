// "Cinematic start": generate the world straight into the free camera with the UI hidden. Set from the landing page's
// toggle (remembered for the session) or by ?cinematic in the URL. Read by main.ts at spawn.
const KEY = 'lifeCinematic';

export function cinematicOn(): boolean {
  if (new URLSearchParams(location.search).has('cinematic')) return true;
  try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; }
}
export function setCinematic(on: boolean): void {
  try { sessionStorage.setItem(KEY, on ? '1' : '0'); } catch { /* storage unavailable: the toggle just won't persist */ }
}
