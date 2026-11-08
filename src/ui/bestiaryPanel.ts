// Bestiary tab (replaces the field guide): every announced living kind with its name and sprite (a NEW SPECIES stamp until
// the player scans one by clicking it), then kinds that died out, filed automatically. Clicking any tile opens its specimen page, a
// paper card beside the drawer. State lives in the life registry (ui/bestiary.ts); this module only draws it.
// The page shows the kind in 3D: a transparent window whose rect and the specimen's plan go to the render layer on
// bestiary:window (render/counterpart.ts draws it turning slowly from the plan, so extinct kinds work too).
import { el } from './dom';
import { planRows } from './lifeText';
import { listen, type UiBus } from './uiBus';
import { drawSprite } from '../render/sprite';
import { tileState, type BestiaryEntry } from './bestiary';
import type { BodyPlan } from '../sim/develop';
import type { LifeRegistry } from './lifeRegistry';
import type { WorldConfig } from '../worlds/types';

const TILE_W = 48, TILE_H = 34;   // sprite pixels on a tile (drawn 2× in CSS)

/** "1:05" for 65 s: time since Generate, on the snapshot clock. */
export function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function mountBestiary(
  root: HTMLElement, bus: UiBus, world: WorldConfig, registry: LifeRegistry, onCounts: (found: number, total: number) => void,
  /** A specimen page opened (the host closes its other cards: one card at a time). */
  onPageOpen?: () => void,
) {
  const speculative = world.status === 'speculative';
  const drawer = el('aside', 'wu-drawer wu-bestiary');
  drawer.setAttribute('aria-label', 'Bestiary');
  drawer.append(el('h2', 'wu-h', 'Bestiary'));
  drawer.append(el('p', 'wu-note', 'Every kind that evolves is listed here. Click a living creature in the world to scan its kind; kinds that die out are filed on their own.'));
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
  const pageSci = el('p', 'wu-sci');
  const pageX = el('button', 'wu-x', '×');
  pageX.type = 'button';
  pageX.setAttribute('aria-label', 'Close');
  const pageType = el('p', 'wu-sub');
  const pageStatus = el('p', 'wu-bt-status');
  const pageFrame = el('div', 'wu-bt-frame');
  const pageViewport = el('div', 'wu-bt-viewport');
  pageFrame.append(pageViewport);
  const pageRows = el('ul', 'wu-details');
  const pageNote = el('p', 'wu-why-line');
  page.append(pageTitle, pageSci, pageX, pageType, pageStatus, pageFrame, pageRows, pageNote);
  if (speculative) page.append(el('em', 'wu-tag wu-spec', 'speculative'));
  root.append(page);

  let open = false;
  let pageName: string | null = null;
  const sprites = new WeakMap<BodyPlan, ImageData>();
  let lastWindow = '';
  let lastPageName: string | null = null;
  let lastPagePlan: BodyPlan | undefined;

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
    const st = tileState(e);
    const b = el('button', `wu-bt ${st === 'extinct' ? 'wu-bt-extinct' : st === 'scanned' ? 'wu-bt-found' : 'wu-bt-new'}`);
    b.type = 'button';
    // Every announced kind shows its real name and sprite; only the stamp says whether the player has scanned it.
    b.append(spriteCanvas(e.plan), el('span', 'wu-bt-name', e.name));
    if (e.scientific) b.append(el('span', 'wu-sci', e.scientific));
    if (st === 'extinct') b.append(el('span', 'wu-bt-stamp', 'Extinct'));
    else if (st === 'new') b.append(el('span', 'wu-bt-stamp wu-bt-stamp-new', 'New species'));
    else b.append(el('span', 'wu-bt-check', 'Scanned'));
    if (e.name === pageName) b.classList.add('wu-bt-sel');
    b.addEventListener('click', () => showPage(e.name));
    b.setAttribute('aria-label', `${e.name}${st === 'extinct' ? ', extinct' : st === 'new' ? ', new species, not scanned yet' : ', scanned'}`);
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
    livingCount.textContent = living.length ? `${livingFound} of ${living.length} scanned` : '';
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
    pageSci.textContent = e.scientific ?? '';
    pageSci.hidden = !e.scientific;
    pageType.textContent = e.type ? e.type[0]!.toUpperCase() + e.type.slice(1) : '';
    pageStatus.textContent = e.extinct ? `Extinct since ${clock(e.lastAliveSec)}` : `${e.alive} alive now`;
    pageStatus.classList.toggle('wu-bt-dead', e.extinct);
    page.classList.toggle('wu-specimen-extinct', e.extinct);
    pageFrame.classList.toggle('wu-bt-no-model', !e.plan);
    const rows: [string, string][] = [
      ['Found', e.found ? `${clock(e.foundAtSec ?? 0)} after Generate` : 'Not scanned yet'],
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
      ? 'The model is the specimen you scanned.'
      : e.extinct ? 'Filed when the last one died. The model is a typical member.' : 'Not scanned yet: click one alive in the world to scan it. The model is a typical member.';
    if (pageName !== lastPageName || e.plan !== lastPagePlan) {
      lastPageName = pageName;
      lastPagePlan = e.plan;
      lastWindow = ''; // a new specimen: report the window again with its plan
    }
    reportWindow();
  }

  /** Show the shared 3D renderer through the frame, clipping it to the visible part of this scrollable card. */
  function reportWindow() {
    const e = pageName ? registry.bestiary().get(pageName) : undefined;
    if (page.hidden || !e?.plan) {
      page.style.maskImage = '';
      page.style.removeProperty('-webkit-mask-image');
      if (lastWindow !== 'hidden') { lastWindow = 'hidden'; bus.emit('bestiary:window', null); }
      return;
    }
    const frame = pageViewport.getBoundingClientRect(), clip = page.getBoundingClientRect();
    const left = Math.max(frame.left, clip.left, 0), top = Math.max(frame.top, clip.top, 0);
    const right = Math.min(frame.right, clip.right, window.innerWidth), bottom = Math.min(frame.bottom, clip.bottom, window.innerHeight);
    const visible = right - left >= 4 && bottom - top >= 4;
    const key = visible ? [left, top, right - left, bottom - top].map(Math.round).join(',') : 'hidden';
    if (visible) {
      const card = page.getBoundingClientRect();
      const x = Math.round(left - card.left) + 1, y = Math.round(top - card.top) + 1;
      const size = `100% 100%, ${Math.max(0, Math.round(right - left) - 2)}px ${Math.max(0, Math.round(bottom - top) - 2)}px`;
      const pos = `0 0, ${x}px ${y}px`, solid = 'linear-gradient(#000, #000)';
      const style = page.style as CSSStyleDeclaration & Record<string, string>;
      for (const k of ['mask', 'webkitMask']) {
        style[`${k}Image`] = `${solid}, ${solid}`;
        style[`${k}Size`] = size;
        style[`${k}Position`] = pos;
        style[`${k}Repeat`] = 'no-repeat';
      }
      page.style.maskComposite = 'exclude';
      page.style.webkitMaskComposite = 'xor';
    } else {
      page.style.maskImage = '';
      page.style.removeProperty('-webkit-mask-image');
    }
    if (key === lastWindow) return;
    lastWindow = key;
    // one event carries both (render/counterpart.ts): the window and the plan to draw in it, so they never disagree
    bus.emit('bestiary:window', visible ? { rect: { x: left, y: top, width: right - left, height: bottom - top }, plan: e.plan } : null);
  }

  function showPage(name: string) {
    if (pageName === name && !page.hidden) { closePage(); return; }
    bus.emit('inspect:close', {}); // one card at a time
    onPageOpen?.();
    pageName = name;
    page.hidden = false;
    renderPage();
    render();
  }
  function closePage() {
    if (page.hidden) return;
    page.hidden = true;
    pageName = null;
    lastPageName = null;
    lastPagePlan = undefined;
    page.style.maskImage = '';
    page.style.removeProperty('-webkit-mask-image');
    lastWindow = '';
    bus.emit('bestiary:window', null);
    render();
  }
  pageX.addEventListener('click', closePage);
  page.addEventListener('scroll', reportWindow);
  const onResize = () => reportWindow();
  window.addEventListener('resize', onResize);

  const offs = [
    registry.onChange(render),
    listen(bus, 'inspect:open', () => closePage()), // an inspect card replaces the specimen page
    () => window.removeEventListener('resize', onResize),
  ];
  render();

  return {
    el: drawer,
    setOpen(o: boolean) { open = o; if (o) render(); else closePage(); },
    pageOpen: () => !page.hidden,
    closePage,
    dispose() { closePage(); offs.forEach((f) => f()); drawer.remove(); page.remove(); },
  };
}
