export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function row(cls: string, ...cells: (string | HTMLElement)[]): HTMLElement {
  const r = el('div', cls);
  for (const c of cells) r.append(typeof c === 'string' ? el('span', undefined, c) : c);
  return r;
}
