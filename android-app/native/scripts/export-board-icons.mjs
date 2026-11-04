// Writes play-board-icons.js BOARD_ICONS (24-unit SVG fragments) as flat drawing ops for the native table.
// Each icon: [{t:'path'|'circle'|'rect'|'text', ...geometry, fill:bool, stroke:bool, sw, s(scale), ...}]
// Usage: node scripts/export-board-icons.mjs <repo root> <out file>
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
const [root, out] = process.argv.slice(2);
const {BOARD_ICONS} = await import(pathToFileURL(join(root, 'play-board-icons.js')).href);
const attrs = s => Object.fromEntries([...s.matchAll(/([a-z-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
const icons = {};
for (const [name, svg] of Object.entries(BOARD_ICONS)) {
  const ops = [], stack = [{fill: true, stroke: false, sw: 1, s: 1, cap: 'butt', join: 'miter'}];
  for (const m of svg.matchAll(/<(\/?)([a-z]+)([^>]*?)(\/?)>([^<]*)/g)) {
    const [, close, tag, rest, self, text] = m;
    if (close) { if (tag === 'g') stack.pop(); continue; }
    const a = attrs(rest), top = stack[stack.length - 1];
    const ctx = {...top};
    if (a.fill) ctx.fill = a.fill !== 'none';
    if (a.stroke) ctx.stroke = a.stroke !== 'none';
    if (a['stroke-width']) ctx.sw = +a['stroke-width'];
    if (a['stroke-linecap']) ctx.cap = a['stroke-linecap'];
    if (a['stroke-linejoin']) ctx.join = a['stroke-linejoin'];
    const sc = a.transform?.match(/scale\(([\d.]+)\)/); if (sc) ctx.s = top.s * +sc[1];
    if (tag === 'g') { if (!self) stack.push(ctx); continue; }
    const base = {fill: ctx.fill, stroke: ctx.stroke, sw: ctx.sw, s: ctx.s, cap: ctx.cap, join: ctx.join};
    if (tag === 'path') ops.push({t: 'path', d: a.d, ...base});
    else if (tag === 'circle') ops.push({t: 'circle', cx: +a.cx, cy: +a.cy, r: +a.r, ...base});
    else if (tag === 'rect') ops.push({t: 'rect', x: +a.x, y: +a.y, w: +a.width, h: +a.height, rx: +(a.rx || 0), ...base});
    else if (tag === 'text') ops.push({t: 'text', x: +a.x, y: +a.y, size: +a['font-size'], bold: a['font-weight'] === '700', anchor: a['text-anchor'] || 'start', text: text, ...base});
  }
  icons[name] = ops;
}
writeFileSync(out, JSON.stringify(icons));
console.log(Object.keys(icons).length, 'icons');
