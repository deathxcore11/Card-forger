// The site's markup read as a small tree (no DOM) and its inline icons as drawing items: shared by the Collection engine
// (collection-engine-entry.mjs) and the Scanner's WebView engine (scan-web-entry.mjs).
export const VOID = new Set(['img', 'br', 'input', 'meta', 'link', 'hr', 'source', 'wbr']);
export const unescape = t => t.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '}[e.toLowerCase()]);
export function tree(html) {
  const root = {tag: '#root', attrs: {}, kids: []}, stack = [root];
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)|</g;
  let m;
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1];
    if (m[1]) { const tag = m[1].toLowerCase(); const i = stack.map(n => n.tag).lastIndexOf(tag); if (i > 0) stack.length = i; }
    else if (m[2]) {
      const node = {tag: m[2].toLowerCase(), attrs: {}, kids: []}, ar = /([^\s=>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g; let a;
      while ((a = ar.exec(m[3] || ''))) node.attrs[a[1].toLowerCase()] = unescape(a[2] ?? a[3] ?? a[4] ?? '');
      top.kids.push(node); if (!m[4] && !VOID.has(node.tag)) stack.push(node);
    } else if (m[5] !== undefined) top.kids.push({text: unescape(m[5])});
    else if (m[0] === '<') top.kids.push({text: '<'});
  }
  return root;
}
export const classes = n => (n?.attrs?.class || '').split(/\s+/);
export const all = (n, ok, out = []) => { for (const k of n?.kids || []) { if (k.tag && ok(k)) out.push(k); all(k, ok, out); } return out; };
export const one = (n, ok) => all(n, ok)[0] || null;
export const cls = c => n => classes(n).includes(c);
export const tagIs = t => n => n.tag === t;
// Visible words only: screen-reader-only copy and hidden nodes are skipped, whitespace runs fold to one space.
export const text = n => { if (!n) return ''; const walk = x => x.text !== undefined ? x.text : x.tag === 'svg' || x.attrs?.hidden !== undefined || classes(x).includes('home-sr-only') ? '' : (x.kids || []).map(walk).join(''); return walk(n).replace(/\s+/g, ' ').trim(); };

// An inline site icon (icons.js actionIcon / importance.js emblemIcon), as drawing items the app paints itself: the svg's own
// shapes, strokes and gradients, with currentColor left for the caller (the button's colour).
// A rect under transform="rotate(a cx cy)" (war-chest.js's Draw a hand cards) as the path it draws: its corners turned about the
// centre; its round corners stay circular arcs, which a turn leaves the same.
export function turnedRect(x, y, w, h, r0, transform) {
  const [deg = 0, cx = 0, cy = 0] = (/rotate\(([^)]*)\)/.exec(transform)?.[1] || '').trim().split(/[\s,]+/).map(Number);
  const t = deg * Math.PI / 180, cos = Math.cos(t), sin = Math.sin(t), r = Math.min(r0, w / 2, h / 2);
  const at = (px, py) => { const dx = px - cx, dy = py - cy; return `${+(cx + dx * cos - dy * sin).toFixed(3)} ${+(cy + dx * sin + dy * cos).toFixed(3)}`; };
  const arc = (px, py) => r ? `A${r} ${r} 0 0 1 ${at(px, py)}` : `L${at(px, py)}`;
  return `M${at(x + r, y)}L${at(x + w - r, y)}${arc(x + w, y + r)}L${at(x + w, y + h - r)}${arc(x + w - r, y + h)}L${at(x + r, y + h)}${arc(x, y + h - r)}L${at(x, y + r)}${arc(x + r, y)}Z`;
}
export function icon(svg, css = {}) {
  if (!svg) return null;
  const num = v => v === undefined || v === '' ? undefined : Number(v);
  const grads = {};
  for (const g of all(svg, tagIs('lineargradient'))) grads[g.attrs.id] = {x1: num(g.attrs.x1) ?? 0, y1: num(g.attrs.y1) ?? 0, x2: num(g.attrs.x2) ?? 1, y2: num(g.attrs.y2) ?? 0,
    stops: all(g, tagIs('stop')).map(s => [num(String(s.attrs.offset || '0').replace('%', '')) / (String(s.attrs.offset || '').includes('%') ? 100 : 1), s.attrs['stop-color'] || '#000'])};
  // [css]: what a stylesheet rule sets on this svg (e.g. .wc-open svg strokes an outline), over its own attributes.
  const base = {fill: css.fill ?? svg.attrs.fill ?? 'currentColor', stroke: css.stroke ?? svg.attrs.stroke ?? 'none', sw: css.sw ?? num(svg.attrs['stroke-width']) ?? 1, cap: css.cap || svg.attrs['stroke-linecap'] || 'butt', join: css.join || svg.attrs['stroke-linejoin'] || 'miter'};
  const paint = (n, inh) => ({fill: n.attrs.fill ?? inh.fill, stroke: n.attrs.stroke ?? inh.stroke, sw: num(n.attrs['stroke-width']) ?? inh.sw, cap: n.attrs['stroke-linecap'] || inh.cap, join: n.attrs['stroke-linejoin'] || inh.join});
  const items = [];
  const walk = (n, inh) => { for (const k of n.kids || []) { if (!k.tag || k.tag === 'defs') continue; const p = paint(k, inh), a = k.attrs;
    if (k.tag === 'g') walk(k, p);
    else if (k.tag === 'path') items.push({t: 'path', d: a.d || '', ...p});
    else if (k.tag === 'rect' && /rotate\(/.test(a.transform || '')) items.push({t: 'path', d: turnedRect(num(a.x) ?? 0, num(a.y) ?? 0, num(a.width) ?? 0, num(a.height) ?? 0, num(a.rx) ?? num(a.ry) ?? 0, a.transform), ...p});
    else if (k.tag === 'rect') items.push({t: 'rect', x: num(a.x) ?? 0, y: num(a.y) ?? 0, w: num(a.width) ?? 0, h: num(a.height) ?? 0, rx: num(a.rx) ?? num(a.ry) ?? 0, ...p});
    else if (k.tag === 'circle') items.push({t: 'circle', cx: num(a.cx) ?? 0, cy: num(a.cy) ?? 0, r: num(a.r) ?? 0, ...p});
    else if (k.tag === 'ellipse') items.push({t: 'ellipse', cx: num(a.cx) ?? 0, cy: num(a.cy) ?? 0, rx: num(a.rx) ?? 0, ry: num(a.ry) ?? 0, ...p});
    else if (k.tag === 'line') items.push({t: 'path', d: `M${a.x1 || 0} ${a.y1 || 0}L${a.x2 || 0} ${a.y2 || 0}`, ...p});
    else if (k.tag === 'polyline' || k.tag === 'polygon') { const pts = String(a.points || '').trim().split(/[\s,]+/); let d = ''; for (let i = 0; i + 1 < pts.length; i += 2) d += (i ? 'L' : 'M') + pts[i] + ' ' + pts[i + 1]; items.push({t: 'path', d: d + (k.tag === 'polygon' ? 'Z' : ''), ...p}); }
  } };
  walk(svg, base);
  const vb = String(svg.attrs.viewbox || '0 0 24 24').split(/[\s,]+/).map(Number);
  // A glyph drawn as text (emblems.js ygoProperty's 魔 / 罠 for a property without its own shape).
  const texts = all(svg, tagIs('text')).map(x => ({x: num(x.attrs.x) ?? 0, y: num(x.attrs.y) ?? 0, text: text(x), size: num(x.attrs['font-size']) ?? 12, weight: num(x.attrs['font-weight']) ?? 400,
    fill: x.attrs.fill || base.fill, anchor: x.attrs['text-anchor'] || 'start'}));
  return {vb, items, grads, ...(texts.length ? {texts} : {})};
}
export const svgIn = n => n && (n.tag === 'svg' ? n : one(n, tagIs('svg')));
export const sources = img => { try { return JSON.parse(img?.attrs['data-art-sources'] || '[]'); } catch { return []; } };
export const SITE = 'https://cardstashy.com';
// The site's own relative addresses (img/ygo/s/…, img/pks/s/…) as the app fetches them.
export const abs = u => !u ? '' : /^(https?:|data:)/.test(u) ? u : SITE + '/' + String(u).replace(/^\/+/, '');
export const picture = img => img ? {src: abs(img.attrs.src || ''), sources: sources(img).map(abs)} : null;
