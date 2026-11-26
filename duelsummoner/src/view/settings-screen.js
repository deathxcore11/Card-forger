// The Settings screen drawn from the schema (src/ui/settings-schema.js): six tabs, the rows of the current device class, each row's control by kind. Values live in save.settings; the four legacy keys keep their old names (shake, fpsCap) so the game reads them unchanged.
import { TABS, visibleRows, defaultFor, ROW_BY_ID } from '../ui/settings-schema.js';
const LEGACY = { camShake: 'shake', frameRate: 'fpsCap' };
const TAB_LABEL = { game: 'Game', display: 'Display', controls: 'Controls', sound: 'Sound', access: 'Access', account: 'Account' };
const SECTION_LABEL = { all: null, controller: 'Controller', touch: 'Touch', kbm: 'Keyboard and mouse', reset: null };
// Rows the game reads today. Only these show to players; a row appears when it is connected. ?dev=1 (or window.__showAllRows) shows every row, marked, so the rest can be built against the real screen.
export const WIRED = new Set(['fov', 'camShake', 'detail', 'reduceMotion', 'frameRate', 'damageNumbers', 'lookSpeed', 'dragLook', 'mouseLook', 'invertLook', 'invertMouse', 'vibration', 'bigMoments', 'duelistMarker', 'camAssist']);
const showAll = () => (typeof window !== 'undefined' && (window.__showAllRows || /[?&]dev=1/.test(window.location.search)));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const CHOICE = { near: 'Near', standard: 'Standard', far: 'Far', off: 'Off', gentle: 'Gentle', strong: 'Strong', big: 'Big hits', all: 'All', balanced: 'Balanced', nearest: 'Nearest', strongest: 'Strongest', small: 'Small', medium: 'Medium', large: 'Large',
  turns: 'Turns with camera', north: 'North up', battery: 'Battery', performance: 'Performance', match: 'Match screen', auto: 'Auto', low: 'Low', high: 'High', quicklook: 'In Quick Look', always: 'Always', hold: 'Hold', toggle: 'Toggle', letters: 'Letters', shapes: 'Shapes',
  swapped: 'Swapped letters', plain: 'Plain', choose: 'Choose…', light: 'Light', smooth: 'Smooth', none: 'None', vertical: 'Vertical', horizontal: 'Horizontal', both: 'Both', floating: 'Floating', fixed: 'Fixed', largest: 'Largest', full: 'Full', soft: 'Soft', redgreen: 'Red-green',
  blueyellow: 'Blue-yellow', contrast: 'High contrast', subtle: 'Subtle', normal: 'Normal', twice: 'Press twice', nameAvatar: 'Name and avatar', name: 'Name only' };
const label = (v, id) => (id === 'stickLayout' && v === 'swapped' ? 'Swapped' : typeof v === 'number' ? String(v) : CHOICE[v] || String(v));
export function getVal(save, row, cls) { const k = LEGACY[row.id] || row.id, v = save.settings[k]; return v !== undefined && !(row.id === 'detail' && v === 'auto') ? v : defaultFor(row.id, cls); }
export function setVal(save, row, cls, v) { const k = LEGACY[row.id] || row.id; if (!(k in LEGACY) && !(k in { reduceMotion: 1, fov: 1, detail: 1, shake: 1, fpsCap: 1 }) && v === defaultFor(row.id, cls)) delete save.settings[k]; else save.settings[k] = v; }
function rowHtml(r, v, ctx) {
  const dis = r.greyInRun && ctx.inRun ? ' disabled' : '';
  let c = '';
  if (r.kind === 'segmented') c = '<span class="seg" data-row="' + r.id + '">' + r.choices.map(x => '<button data-v="' + esc(x) + '"' + (x === v ? ' class="on"' : '') + dis + '>' + esc(label(x, r.id)) + '</button>').join('') + '</span>';
  else if (r.kind === 'plate') c = '<select data-row="' + r.id + '"' + dis + '>' + r.choices.map(x => '<option value="' + esc(x) + '"' + (x === v ? ' selected' : '') + '>' + esc(label(x)) + (typeof x === 'number' && r.id === 'renderScale' ? '%' : '') + '</option>').join('') + '</select>';
  else if (r.kind === 'slider') c = '<input type="range" data-row="' + r.id + '" min="' + r.choices.lo + '" max="' + r.choices.hi + '" step="' + r.choices.step + '" value="' + v + '"' + dis + '><span class="sv" data-val="' + r.id + '">' + v + '</span>';
  else if (r.kind === 'switch') c = '<span class="seg" data-row="' + r.id + '"><button data-v="true"' + (v === true ? ' class="on"' : '') + dis + '>On</button><button data-v="false"' + (v === false ? ' class="on"' : '') + dis + '>Off</button></span>';
  else if (r.kind === 'danger') c = '<button class="dangerBtn" data-act="' + r.id + '"' + dis + '>Hold to reset</button>';
  else if (r.kind === 'action') c = '<button data-act="' + r.id + '"' + dis + '>Open</button>';
  else c = '<span class="dim">' + (r.id === 'version' ? esc(ctx.version || '') : '') + '</span>';
  return '<div class="srow" data-id="' + r.id + '"><span class="sl">' + esc(r.label) + (dis ? ' <small class="dim">(not during a run)</small>' : '') + (showAll() && !WIRED.has(r.id) && r.kind !== 'caption' ? ' <small class="dim">(dev: not connected)</small>' : '') + '</span><span class="sc">' + c + '</span></div>';
}
const rowsFor = (save, tab, ctx) => visibleRows(tab, Object.assign({}, ctx, { values: Object.fromEntries(Object.keys(ROW_BY_ID).map(id => [id, getVal(save, ROW_BY_ID[id], ctx.cls)])) })).filter(r => showAll() || WIRED.has(r.id));
export const tabsFor = (save, ctx) => TABS.filter(t => rowsFor(save, t, ctx).some(r => r.kind !== 'caption'));
export function settingsHtml(save, tab, ctx) {
  const rows = rowsFor(save, tab, ctx), TL = tabsFor(save, ctx);
  let last = null, body = '';
  for (const r of rows) { if (r.section !== last && SECTION_LABEL[r.section]) body += '<h3 class="ssec">' + SECTION_LABEL[r.section] + '</h3>'; last = r.section; body += rowHtml(r, getVal(save, r, ctx.cls), ctx); }
  return '<h2>SETTINGS</h2><div class="tabs">' + TL.map(t => '<button class="tab' + (t === tab ? ' sel' : '') + '" data-stab="' + t + '">' + TAB_LABEL[t] + '</button>').join('') + '</div><div class="panel sbody">' + body + '</div><div class="navRow"><button id="setBack" class="small">BACK</button><span class="dim">' + ctx.cls + '</span></div>';
}
// wires one drawn screen. onChange(id) lets the caller apply the live rows.
export function bindSettingsScreen(root, save, ctx, redraw, onChange) {
  const rowOf = id => ROW_BY_ID[id], fix = (r, raw) => (r.kind === 'switch' ? raw === 'true' : typeof r.choices?.[0] === 'number' || r.kind === 'slider' ? +raw : (r.choices || []).find(c => String(c) === raw) ?? raw);
  for (const sg of root.querySelectorAll('.seg[data-row]')) { const r = rowOf(sg.dataset.row); for (const b of sg.querySelectorAll('button')) b.onclick = () => { setVal(save, r, ctx.cls, fix(r, b.dataset.v)); onChange(r.id); redraw(); }; }
  for (const s of root.querySelectorAll('select[data-row]')) { const r = rowOf(s.dataset.row); s.onchange = () => { const raw = s.value, v = isNaN(+raw) ? raw : +raw; setVal(save, r, ctx.cls, v); onChange(r.id); }; }
  for (const i of root.querySelectorAll('input[type=range][data-row]')) { const r = rowOf(i.dataset.row); i.oninput = () => { const lab = root.querySelector('[data-val="' + r.id + '"]'); if (lab) lab.textContent = i.value; setVal(save, r, ctx.cls, +i.value); onChange(r.id, true); }; i.onchange = () => onChange(r.id); }
}
