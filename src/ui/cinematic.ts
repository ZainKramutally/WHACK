// Clean frame for the free (cinematic) camera: hide every in-world UI element with one body class, and show a tiny
// "FREE CAMERA · C to exit" hint that fades after 2 s. The hint lives outside the UI root so hiding the UI never hides it.
const HIDE = 'wu-cinematic';

export function setCinematicUI(hidden: boolean): void {
  document.body.classList.toggle(HIDE, hidden);
}
export const isCinematicUI = (): boolean => document.body.classList.contains(HIDE);

let hintEl: HTMLElement | null = null;
let hintTimer: ReturnType<typeof setTimeout> | undefined;
export function showFreeCamHint(): void {
  if (!hintEl) {
    hintEl = document.createElement('div');
    hintEl.className = 'wu-fchint';
    hintEl.textContent = 'FREE CAMERA · C to exit · H toggles the UI';
    document.body.append(hintEl);
  }
  hintEl.classList.add('wu-on');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => hintEl?.classList.remove('wu-on'), 2000);
}
export function hideFreeCamHint(): void {
  clearTimeout(hintTimer);
  hintEl?.classList.remove('wu-on');
}
