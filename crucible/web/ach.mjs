// Lost Memories, the achievements on screen (the console look): the pop-up that says a row was earned, the pages of
// the Feats book that list the rows, a row looked at closely, and the run's last page. The rows and what they pay come
// from the engine (engine/achievements.mjs: achView gives each row as the page shows it); this file only places them.
// Every place below is in frame pixels, as the owner's approved preview drew it (25 November 2026).
import { ACH_BY_ID, ACH_GROUPS, ACH_TIERS } from '../engine/achievements.mjs';
import { box, lb, esc, labelW, pq } from './ps.mjs';

export const TIER = t => ACH_TIERS[t].name.toUpperCase(), PTS = t => ACH_TIERS[t].points;
export const tierPts = t => `${TIER(t)} · ${PTS(t)}`;
// a label set to end on column xr (the label face leaves its last column blank, so the ink ends there)
export const lbR = (xr, y, t, c = '') => lb(xr - labelW(t) + 1, y, t, c);
// the body face is 8 frame pixels a letter: lines are broken here and each one is set on its own row
export const wrap = (s, n) => { const out = []; let cur = ''; for (const w of String(s).split(' ')) { if (cur && (cur + ' ' + w).length > n) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; } if (cur) out.push(cur); return out; };
export const wrapL = (s, px) => { const out = []; let cur = ''; for (const w of String(s).split(' ')) { if (cur && labelW(cur + ' ' + w) > px) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; } if (cur) out.push(cur); return out; };
const tl = (x, y, lines, c = '') => lines.map((t, i) => `<b class="ab tl${c ? ' ' + c : ''}" style="left:${x}px;top:${y + i * 16}px">${esc(t)}</b>`).join('');
const rule = (x, y, w, h = 1) => `<i class="ab" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:var(--dark)"></i>`;
// a seal: lit when earned; a hidden row not yet found carries a question mark
export const seal = (x, y, on, q = false) => `<i class="seal${on ? ' on' : ''}" style="left:${x}px;top:${y}px"></i>` + (q ? lb(x + 3, y + 1, '?', 'g') : '');
const pip = (x, y, on) => `<i class="pip${on ? ' on' : ''}" style="left:${x}px;top:${y}px"></i>`;
const more = (x, y) => `<i class="ab scm" style="left:${x}px;top:${y}px"></i>`;
// a gauge; gain: the part this run added, drawn light at the bar's end
const gauge = (x, y, w, f, gain = 0) => { const k = w - 2, a = Math.round(k * Math.min(1, f));
  return `<i class="ga x" style="left:${x}px;top:${y}px;width:${w}px"><i style="width:${a}px"></i>${gain > 0 ? `<u class="ab" style="top:0;bottom:0;background:var(--gl);left:${Math.round(k * Math.min(1, f - gain))}px;width:${a - Math.round(k * Math.min(1, f - gain))}px"></u>` : ''}</i>`; };
const veiled = r => !r.shownName;
const counting = r => r.goal && !r.earned && !veiled(r);
const NUM = ['NO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN'];
export const numWord = n => NUM[n] || String(n);

// ---- totals and the pack track: a pack for every five rows earned, thirteen steps
export const STEPS = 13, PER = 5;
export const totals = rows => ({ n: rows.length, got: rows.filter(r => r.earned).length, pts: rows.reduce((n, r) => n + PTS(r.tier), 0), gotPts: rows.filter(r => r.earned).reduce((n, r) => n + PTS(r.tier), 0) });
const track = (x, y, got, step = 11) => Array.from({ length: STEPS }, (_, i) => pip(x + i * step, y, i < Math.floor(got / PER))).join('');
const nextPack = tt => Math.floor(tt.got / PER) >= STEPS ? 'EVERY PACK EARNED' : `NEXT PACK IN ${PER - tt.got % PER} MORE`;
export const groupRows = (all, gi) => all.filter(r => r.group === ACH_GROUPS[gi].id);
// The Rumours switch off: the group shows only what was earned while it was on.
export const offNote = (rows, open) => open ? '' : `The Rumours switch is off: this group holds ${numWord(rows.length).toLowerCase()} row${rows.length === 1 ? '' : 's'}.`;

// ---- the pop-up: one grammar everywhere. A head (ACHIEVEMENT, or HIDDEN FOUND for a hidden row), the row's name, its
// points, and n/m while several wait. No tier word and no words of the row: those are in the book and on the last page.
export const TOAST = { x: 4, w: 88, h: 56, gap: 6, clear: 4 }, STRIP = { x: 139, y: 326, w: 135, h: 28 };
export const toastHead = r => r.hidden ? 'HIDDEN FOUND' : 'ACHIEVEMENT';
const cnt = o => o && o.of > 1 ? `${o.n}/${o.of}` : '';
// on a pillar, in its bare stone: y is worked out by the page (six rows under the pillar's last piece)
export function pillarToast(id, y, o) { const r = ACH_BY_ID[id], nm = wrapL(r.name, TOAST.w - 12), { x, w, h } = TOAST;
  return box(x, y, w, h, 'wn') + lb(x + 6, y + 6, toastHead(r), 'g') + nm.slice(0, 2).map((t, i) => lb(x + 6, y + 18 + i * 10, t)).join('') + (cnt(o) ? lb(x + 6, y + h - 14, cnt(o), 'd') : '') + lbR(x + w - 7, y + h - 14, '+' + PTS(r.tier), 'g'); }
// a duel on two screens: the empty middle place of the bottom frame's third row of plaques
export function stripToast(id, o) { const r = ACH_BY_ID[id], { x, y, w, h } = STRIP, hd = toastHead(r);
  return box(x, y, w, h, 'wn') + lb(x + 6, y + 6, hd, 'g') + (cnt(o) ? lb(x + 6 + labelW(hd) + 5, y + 6, cnt(o), 'd') : '') + lbR(x + w - 7, y + 6, '+' + PTS(r.tier), 'g') + lb(x + 6, y + 16, r.name); }

// ---- the list on one screen: inside the Feats book's window (416 wide, h tall); rows stand from y 72 to h - 36
const rowLines = r => wrap(r.shownText, 47);
const rowH = r => 14 + rowLines(r).length * 16 + (counting(r) ? 12 : 0) + 4;
export function rowOne(r, y, sel, dx = 0, act = '') { const L = rowLines(r), v = veiled(r), h = rowH(r);
  let s = act ? `<button class="ab achr" data-a="${esc(act)}" style="left:${4 + dx}px;top:${y - 1}px;width:408px;height:${h - 1}px" aria-label="${esc(v ? 'A hidden row' : r.name)}"></button>` : '';
  if (sel) s += `<i class="ab" style="left:${4 + dx}px;top:${y - 1}px;width:408px;height:${h - 1}px;border:1px solid var(--gl);background:var(--sh);pointer-events:none"></i>`;
  s += seal(10 + dx, y + 2, r.earned, v) + lb(26 + dx, y + 3, v ? '? ? ?' : r.name, r.earned ? 'g' : '') + lbR(405 + dx, y + 3, tierPts(r.tier), r.earned ? 'g' : 'd');
  s += tl(26 + dx, y + 13, L, v || !r.earned ? 'd' : '');
  if (counting(r)) s += gauge(26 + dx, y + 15 + L.length * 16, 120, r.have / r.goal) + lb(152 + dx, y + 15 + L.length * 16, `${r.have} / ${r.goal}`);
  return s; }
export function pagesOf(rows, y1) { const pages = [[]]; let y = 72; for (const r of rows) { if (y + rowH(r) > y1 && pages[pages.length - 1].length) { pages.push([]); y = 72; } pages[pages.length - 1].push(r); y += rowH(r); } return pages; }
// the book's window: all: every row shown; gi: the group; page; sel: the row being read; h: the window's height; open: the Rumours switch
export function bookOne(all, gi, page, sel, h, open) {
  const g = ACH_GROUPS[gi], rows = groupRows(all, gi), tt = totals(all), tg = totals(rows), pages = pagesOf(rows, h - 36), pg = Math.min(page, pages.length - 1), P = pages[pg], note = g.id === 'rumours' ? offNote(rows, open) : '';
  let s = lb(8, 24, `ACHIEVEMENTS ${tt.got} OF ${tt.n}`, 'g') + lbR(407, 24, `${tt.gotPts} OF ${tt.pts} POINTS`) + lb(8, 37, 'PACK TRACK', 'g') + track(74, 36, tt.got) + lbR(407, 37, nextPack(tt), 'd')
    + rule(8, 49, 400) + pq(8, 53, 28, '<', 'achg:-1') + lb(42, 57, g.name, 'g') + lb(42 + labelW(g.name) + 6, 57, `· GROUP ${gi + 1} OF ${ACH_GROUPS.length}`, 'd') + lbR(374, 57, `${tg.got} OF ${tg.n} EARNED`) + pq(380, 53, 28, '>', 'achg:1');
  let y = 72; for (const r of P) { s += rowOne(r, y, r.id === sel, 0, `achsel:${gi}:${rows.indexOf(r)}`); y += rowH(r); }
  if (note) s += tl(8, y + 6, wrap(note, 50), 'd');
  if (pages.length > 1) s += lb(8, h - 32, `PAGE ${pg + 1} OF ${pages.length}`, 'd') + (pg < pages.length - 1 ? lbR(396, h - 32, 'MORE', 'g') + more(400, h - 30) : '');
  // the plaques: BACK (lit, as the book's own), LOOK CLOSER, and the next page when there is one
  s += pq(8, h - 20, 46, 'BACK', 'screen:feats', { lit: true }) + pq(58, h - 20, 80, 'LOOK CLOSER', 'achlook') + (pages.length > 1 ? pq(145, h - 20, 70, pg < pages.length - 1 ? 'NEXT PAGE' : 'FIRST PAGE', 'achpg') : '');
  return { html: s, pages: pages.length, page: pg, ids: P.map(r => r.id) };
}
// the row's state in words
const stateOf = r => r.earned ? 'EARNED' + (r.at ? ' IN RUN ' + r.at : '') : veiled(r) ? 'NOT FOUND YET' : counting(r) ? 'COUNTING' : 'NOT YET';
const partRows = (parts, x, y, w) => parts.map((p, i) => { const v = veiled(p); return seal(x, y + i * 14, p.earned, v) + lb(x + 16, y + 1 + i * 14, v ? '? ? ?' : p.shownName, p.earned ? 'g' : '') + lbR(x + w, y + 1 + i * 14, p.earned ? 'EARNED' : v ? 'HIDDEN' : 'NOT YET', p.earned ? 'g' : 'd'); }).join('');
// a row looked at closely, one screen: a window 368 wide, as tall as its words (inner html and its height)
export function lookOne(r, all) {
  const v = veiled(r), L = wrap(r.shownText, 43), parts = (r.parts || []).map(id => all.find(x => x.id === id)).filter(Boolean), ph = parts.length * 14;
  let s = lb(10, 10, v ? '? ? ?' : r.name, r.earned || !v ? 'g' : 'd') + lbR(357, 10, tierPts(r.tier), 'd') + tl(10, 24, L, v ? 'd' : ''), y = 24 + L.length * 16;
  if (r.title) { s += lb(10, y + 8, 'ITS TITLE', 'g') + lb(70, y + 8, r.title); y += 18; }
  if (parts.length) { s += lb(10, y + 8, 'ITS PARTS', 'g') + lbR(357, y + 8, `${r.have} OF ${r.goal}`) + gauge(10, y + 20, 347, r.have / r.goal) + partRows(parts, 10, y + 34, 347); y += 34 + ph; }
  else if (counting(r)) { s += gauge(10, y + 8, 240, r.have / r.goal) + lb(256, y + 8, `${r.have} / ${r.goal}`); y += 18; }
  if (!parts.length) { s += lb(10, y + 8, stateOf(r), r.earned ? 'g' : 'd'); y += 18; }
  s += rule(10, y + 2, 348) + lb(10, y + 10, 'REWARD', 'g') + lb(56, y + 10, ACH_TIERS[r.tier].pays, r.earned ? '' : 'd') + pq(10, y + 26, 56, 'CLOSE', 'achclose', { lit: true });
  return { html: s, h: y + 56 };
}

// ---- two screens: the open page above (the lectern of the title's books), the group's rows below
const sideTotals = tt => lb(404, 26, 'ACHIEVEMENTS', 'g') + lbR(620, 26, `${tt.got} OF ${tt.n}`) + lb(404, 40, 'POINTS', 'g') + lbR(620, 40, `${tt.gotPts} OF ${tt.pts}`) + lb(404, 62, 'PACK TRACK', 'g') + lbR(620, 62, `${Math.floor(tt.got / PER)} OF ${STEPS}`) + track(404, 74, tt.got, 17) + lb(404, 90, nextPack(tt), 'd') + lb(404, 124, 'A PACK FOR EVERY FIVE EARNED', 'd');
// under a row whose words take one line: what every row is, in the words the Feats page already uses
const GUIDE = ['Rows earned in play, across every descent.'];
const topHead = (t, gi) => lb(10, 8, t, 'g') + lbR(622, 8, `${ACH_GROUPS[gi].name} · GROUP ${gi + 1} OF ${ACH_GROUPS.length}`, 'd');
// inside the lectern's window (632 x 152)
export function lecternTop(all, gi, r) { const v = veiled(r), L = wrap(r.shownText, 46);
  return topHead('FEATS · ACHIEVEMENTS', gi) + seal(16, 25, r.earned, v) + lb(32, 26, v ? '? ? ?' : r.name, r.earned ? 'g' : '') + lb(32, 38, `${tierPts(r.tier)} · ${stateOf(r)}`, 'd')
    + tl(16, 54, L.slice(0, 4), v ? 'd' : '') + (counting(r) && !r.parts ? gauge(16, 60 + L.length * 16, 200, r.have / r.goal) + lb(224, 60 + L.length * 16, `${r.have} / ${r.goal}`) : '')
    + (r.parts && !r.earned ? gauge(16, 60 + L.length * 16, 200, r.have / r.goal) + lb(224, 60 + L.length * 16, `${r.have} OF ${r.goal} PARTS`) : '')
    + (L.length === 1 ? tl(16, 76 + (counting(r) || (r.parts && !r.earned) ? 16 : 0), GUIDE, 'd') : '')
    + rule(16, 122, 364) + lb(16, 130, 'REWARD', 'g') + lb(62, 130, ACH_TIERS[r.tier].pays, r.earned ? '' : 'd') + rule(396, 24, 1, 120) + sideTotals(totals(all)); }
export function lookTop(all, gi, r) { const v = veiled(r), L = wrap(r.shownText, 46), parts = (r.parts || []).map(id => all.find(x => x.id === id)).filter(Boolean);
  let s = topHead('FEATS · ACHIEVEMENTS · LOOKED AT CLOSELY', gi) + seal(16, 25, r.earned, v) + lb(32, 26, v ? '? ? ?' : r.name, r.earned ? 'g' : '') + lb(32, 38, `${tierPts(r.tier)} · ${stateOf(r)}`, 'd') + tl(16, 54, L.slice(0, 3), v ? 'd' : '');
  if (r.title) s += lb(16, 62 + Math.min(3, L.length) * 16, 'ITS TITLE', 'g') + lb(76, 62 + Math.min(3, L.length) * 16, r.title);
  if (L.length === 1) s += tl(16, 76 + (r.title ? 18 : 0), GUIDE, 'd');
  s += rule(16, 122, 364) + lb(16, 130, 'REWARD', 'g') + lb(62, 130, ACH_TIERS[r.tier].pays, r.earned ? '' : 'd') + rule(396, 24, 1, 120);
  if (parts.length) s += lb(404, 26, 'ITS PARTS', 'g') + lbR(620, 26, `${r.have} OF ${r.goal}`) + gauge(404, 38, 216, r.have / r.goal) + partRows(parts.slice(0, 6), 404, 54, 216);
  else if (counting(r)) s += lb(404, 26, 'HOW FAR', 'g') + lbR(620, 26, `${r.have} OF ${r.goal}`) + gauge(404, 38, 216, r.have / r.goal);
  else s += lb(404, 26, 'STATE', 'g') + lbR(620, 26, stateOf(r), r.earned ? 'g' : 'd');
  return s; }
// the bottom frame's list (the window from the top to y1): a row a line of 26, eleven at the most
export function listBottom(all, gi, at, y1, open, look = false) { const g = ACH_GROUPS[gi], rows = groupRows(all, gi), tg = totals(rows), note = g.id === 'rumours' ? offNote(rows, open) : '';
  let s = box(0, 0, 413, y1, 'wn') + lb(8, 6, g.name, 'g') + lbR(405, 6, `ROW ${at + 1} OF ${rows.length} · ${tg.got} EARNED`, 'd');
  rows.forEach((r, i) => { const y = 17 + i * 26, v = veiled(r);
    s += `<button class="rw achrw${r.earned ? ' fam' : ' dk0'}" style="left:4px;top:${y}px;width:405px;height:25px" data-a="nop" data-look="a:${i}" data-k="a${i}"${i === at ? ' data-n0' : ''}${look ? ' data-act="plaque"' : ''} aria-label="${esc(v ? 'A hidden row' : r.name)}">`
      + seal(5, 6, r.earned, v) + lb(21, 3, v ? '? ? ?' : r.name, r.earned ? 'g' : '') + lb(21, 13, tierPts(r.tier), 'd')
      + (r.earned ? lbR(397, 8, 'EARNED', 'g') : counting(r) ? lbR(397, 3, `${r.have} / ${r.goal}`) + gauge(293, 13, 104, r.have / r.goal) : v ? lbR(397, 8, 'HIDDEN', 'd') : '') + '</button>'; });
  const nl = note ? wrap(note, 49) : [];
  if (note) s += tl(8, 17 + rows.length * 26 + 8, nl, 'd');
  // the page's unused lines drawn empty, so a short group reads as a page of its book and not as bare stone
  for (let i = rows.length + (nl.length ? Math.ceil((nl.length * 16 + 12) / 26) : 0); 17 + i * 26 + 25 <= y1 - 4; i++) s += `<i class="rw achgap" style="left:4px;top:${17 + i * 26}px;width:405px;height:25px"></i>`;
  return s; }

// ---- the run's last page
// one screen: a block in the page's flow (the book's box of pages, 400 wide), its rows as in the list
export function runEndOne(got, closer) { const pts = got.reduce((n, r) => n + PTS(r.tier), 0);
  let s = rule(0, 0, 400) + lb(0, 4, 'ACHIEVEMENTS THIS RUN', 'g') + lbR(399, 4, got.length ? `${got.length} EARNED · +${pts} POINTS` : 'NONE EARNED'), y = 16;
  for (const r of got) { s += rowOne(r, y, false, -8); y += rowH(r); }
  // CAME CLOSER: the row's name, then its gauge and number after the name's measured end; when they do not all fit on
  // the line, the gauge and number take the next line, under the name
  if (closer) { const nm = closer.name, num = `${closer.have} / ${closer.goal} (+${closer.gain})`, gx0 = 76 + labelW(nm) + 6, one = gx0 + 126 + labelW(num) <= 400, gx = one ? gx0 : 76, gy = one ? y + 2 : y + 16;
    s += lb(0, y + 2, 'CAME CLOSER', 'd') + lb(76, y + 2, nm) + gauge(gx, gy, 120, closer.have / closer.goal, closer.gain / closer.goal) + lb(gx + 126, gy, num); y = gy + 12; }
  const h = Math.ceil(y / 16) * 16;
  return `<div class="achsec" style="position:relative;height:${h}px">${s}</div>`; }
// two screens, top: the same section in the page's box of words (its pager turns the box): a row every 28, and 16 more
// for each further line its words take, so every row's words are shown whole
export function runEndTop(got) { const pts = got.reduce((n, r) => n + PTS(r.tier), 0);
  let s = lb(0, 4, 'ACHIEVEMENTS THIS RUN', 'g') + lbR(588, 4, `${got.length} EARNED · +${pts} POINTS`), y = 16;
  for (const r of got) { const L = wrap(r.how, 70); s += seal(0, y, true) + lb(16, y + 1, r.name, 'g') + lbR(588, y + 1, tierPts(r.tier), 'g') + tl(16, y + 10, L); y += 12 + L.length * 16; }
  return `<div class="achsec" style="position:relative;height:${Math.ceil(y / 16) * 16}px">${s}</div>`; }
// two screens, bottom: the cells of what this run earned, achievements first, then the feats it moved
export const runEndCells = (got, feats) => got.map(r => ({ name: r.name, sub: tierPts(r.tier), gold: true, seal: true })).concat(feats.map(f => ({ name: f.name, sub: f.done ? 'FEAT · COMPLETE' : `FEAT · ${f.after} / ${f.goal}${f.gain ? ` (+${f.gain})` : ''}`, gold: f.done })));
