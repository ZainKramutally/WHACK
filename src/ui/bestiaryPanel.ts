// Bestiary tab (replaces the field guide): living kinds the player has found (and "?" tiles for those still out
// there), then kinds that died out, filed automatically. Clicking a found or extinct tile opens its specimen page, a
// paper card beside the drawer. State lives in the life registry (ui/bestiary.ts); this module only draws it.
import { el } from './dom';
import { planRows } from './lifeText';
import { listen, type UiBus } from './uiBus';
import { drawSprite } from '../render/sprite';
import type { BestiaryEntry } from './bestiary';
import type { BodyPlan } from '../sim/develop';
import type { LifeRegistry } from './lifeRegistry';
import type { WorldConfig } from '../worlds/types';

const TILE_W = 48, TILE_H = 34;   // sprite pixels on a tile (drawn 2× in CSS)
const PAGE_W = 80, PAGE_H = 52;   // sprite pixels on the specimen page (drawn 3× in CSS)

/** "1:05" for 65 s: time since Generate, on the snapshot clock. */
export function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function mountBestiary(root: HTMLElement, bus: UiBus, world: WorldConfig, registry: LifeRegistry, onCounts: (found: number, total: number) => void) {
  const speculative = world.status === 'speculative';
  const drawer = el('aside', 'wu-drawer wu-bestiary');
  drawer.setAttribute('aria-label', 'Bestiary');
  drawer.append(el('h2', 'wu-h', 'Bestiary'));
  drawer.append(el('p', 'wu-note', 'Walk up to a living creature and click it to add its kind. Kinds that die out are filed here on their own.'));
  const livingHead = el('h3', 'wu-h3 wu-bt-head');
  const livingCount = el('span', 'wu-bt-count');
  livingHead.append(el('span', undefined, 'Living'), livingCount);
  const livingGrid = el('div', 'wu-bt-grid');
  const livingEmpty = el('p', 'wu-note', 'Nothing has evolved far enough yet. Kinds appear here once a body plan becomes common.');
  const deadHead = el('h3', 'wu-h3 wu-bt-head');
  const deadCount = el('span', 'wu-bt-count');
  deadHead.append(el('span', undefined, 'Died out'), deadCount);
  const deadGrid = el('div', 'wu-bt-grid');
  drawer.append(livingHead, livingEmpty, livingGrid, deadHead, deadGrid);

  // Specimen page: a paper card to the left of the drawer.
  const page = el('aside', 'wu-card wu-specimen');
  page.hidden = true;
  const pageTitle = el('h2', 'wu-h');
  const pageX = el('button', 'wu-x', '×');
  pageX.type = 'button';
  pageX.setAttribute('aria-label', 'Close');
  const pageType = el('p', 'wu-sub');
  const pageStatus = el('p', 'wu-bt-status');
  const pageFrame = el('div', 'wu-bt-frame');
  const pageCanvas = el('canvas', 'wu-bt-sprite');
  pageCanvas.width = PAGE_W; pageCanvas.height = PAGE_H;
  pageFrame.append(pageCanvas);
  const pageRows = el('ul', 'wu-details');
  const pageNote = el('p', 'wu-why-line');
  page.append(pageTitle, pageX, pageType, pageStatus, pageFrame, pageRows, pageNote);
  if (speculative) page.append(el('em', 'wu-tag wu-spec', 'speculative'));
  root.append(page);

  let open = false;
  let pageName: string | null = null;
  let drawnPlan: BodyPlan | undefined;
  const sprites = new WeakMap<BodyPlan, ImageData>();

  function spriteCanvas(plan: BodyPlan | undefined): HTMLCanvasElement {
    const c = el('canvas', 'wu-bt-sprite');
    c.width = TILE_W; c.height = TILE_H;
    if (!plan) return c;
    let img = sprites.get(plan);
    if (!img) {
      drawSprite(c, plan);
      img = c.getContext('2d')?.getImageData(0, 0, TILE_W, TILE_H);
      if (img) sprites.set(plan, img);
    } else c.getContext('2d')?.putImageData(img, 0, 0);
    return c;
  }

  function tile(e: BestiaryEntry): HTMLElement {
    const known = e.found || e.extinct;
    const b = el('button', `wu-bt ${e.extinct ? 'wu-bt-extinct' : e.found ? 'wu-bt-found' : 'wu-bt-locked'}`);
    b.type = 'button';
    if (known) {
      b.append(spriteCanvas(e.plan), el('span', 'wu-bt-name', e.name));
      if (e.extinct) b.append(el('span', 'wu-bt-stamp', 'Extinct'));
      if (e.name === pageName) b.classList.add('wu-bt-sel');
      b.addEventListener('click', () => showPage(e.name));
      b.setAttribute('aria-label', `${e.name}${e.extinct ? ', extinct' : ''}`);
    } else {
      b.append(el('span', 'wu-bt-q', '?'), el('span', 'wu-bt-alive', `${e.alive} alive`));
      b.title = 'Not found yet: find one alive and click it';
      b.setAttribute('aria-label', `Unknown kind, ${e.alive} alive, not found yet`);
    }
    return b;
  }

  function render() {
    const best = registry.bestiary();
    const { found, total } = best.counts();
    onCounts(found, total);
    if (!open && page.hidden) return;
    const living = best.living();
    const dead = best.extinct();
    const livingFound = living.filter((e) => e.found).length;
    livingCount.textContent = living.length ? `${livingFound} of ${living.length} found` : '';
    deadCount.textContent = dead.length ? String(dead.length) : '';
    livingEmpty.hidden = living.length > 0;
    livingGrid.replaceChildren(...living.map(tile));
    deadHead.hidden = dead.length === 0;
    deadGrid.replaceChildren(...dead.map(tile));
    if (!page.hidden) renderPage();
  }

  function renderPage() {
    const e = pageName ? registry.bestiary().get(pageName) : undefined;
    if (!e) return;
    pageTitle.textContent = e.name;
    pageType.textContent = e.type ? e.type[0]!.toUpperCase() + e.type.slice(1) : '';
    pageStatus.textContent = e.extinct ? `Extinct since ${clock(e.lastAliveSec)}` : `${e.alive} alive now`;
    pageStatus.classList.toggle('wu-bt-dead', e.extinct);
    page.classList.toggle('wu-specimen-extinct', e.extinct);
    if (e.plan !== drawnPlan) {
      drawnPlan = e.plan;
      pageCanvas.getContext('2d')?.clearRect(0, 0, PAGE_W, PAGE_H);
      if (e.plan) drawSprite(pageCanvas, e.plan);
    }
    const rows: [string, string][] = [
      ['Found', e.found ? `${clock(e.foundAtSec ?? 0)} after Generate` : 'Never found alive'],
      ['First recorded', `${clock(e.firstSeenSec)} after Generate`],
      ['Most alive at once', String(e.peak)],
    ];
    if (e.generation !== undefined) rows.push(['Specimen generation', String(Math.round(e.generation))]);
    if (e.plan) rows.push(...planRows(e.plan));
    pageRows.replaceChildren(...rows.map(([k, v]) => {
      const li = el('li');
      li.append(el('span', 'wu-k', k), el('span', 'wu-v', v));
      return li;
    }));
    pageNote.textContent = e.found
      ? 'The picture is the specimen you found.'
      : 'Filed when the last one died. The picture is a typical member.';
  }

  function showPage(name: string) {
    if (pageName === name && !page.hidden) { closePage(); return; }
    bus.emit('inspect:close', {}); // one card at a time
    pageName = name;
    drawnPlan = undefined;
    page.hidden = false;
    renderPage();
    render();
  }
  function closePage() {
    if (page.hidden) return;
    page.hidden = true;
    pageName = null;
    render();
  }
  pageX.addEventListener('click', closePage);

  const offs = [
    registry.onChange(render),
    listen(bus, 'inspect:open', () => closePage()), // an inspect card replaces the specimen page
  ];
  render();

  return {
    el: drawer,
    setOpen(o: boolean) { open = o; if (o) render(); else closePage(); },
    pageOpen: () => !page.hidden,
    closePage,
    dispose() { offs.forEach((f) => f()); drawer.remove(); page.remove(); },
  };
}
