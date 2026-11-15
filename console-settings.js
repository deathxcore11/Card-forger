// Settings in the Console look (owner's pick of mock-up 2, 14 Nov 2026), the website's copy of the app's ConsoleSettings.kt.
// One line per setting: its name at the left, its value at the right. No descriptions (owner, 14 Nov: "most games don't have
// descriptions like that"); only live state shows (sync, requests waiting, last backup). Every control keeps the data-change or
// data-act the app already handles, so a line changes the setting exactly as the old cards did.
import {ICON} from './icons.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const svg = d => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const CONSOLE_ICON = {
  sound: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  vibrate: svg('<rect x="8" y="3.5" width="8" height="17" rx="2"/><path d="M4.5 8v8M19.5 8v8M2 10.5v3M22 10.5v3"/>'),
};

/** A group's small gold heading. */
export const cHead = title => `<h3 class="c-head">${esc(title)}</h3>`;

const attrs = (id, def, icon) => `data-cline="${esc(id)}"${def ? ` data-cdef="${esc(def)}"` : ''}${icon ? ` data-cicon="${esc(icon)}"` : ''}`;
const nameOf = (name, danger) => `<span class="c-name${danger ? ' danger' : ''}">${esc(name)}</span>`;
const stateOf = state => state ? `<small class="c-state">${esc(state)}</small>` : '';

/** On or Off. The whole line is the label, so a tap anywhere on it flips the switch. */
export function cSwitch({id, name, change, on, def = '', icon = '', state = ''}) {
  return `<label class="c-line c-toggle" ${attrs(id, def, icon)}><span class="c-text">${nameOf(name)}${stateOf(state)}</span><input type="checkbox" class="c-switch" data-change="${esc(change)}" ${on ? 'checked' : ''}><span class="c-val" aria-hidden="true"></span></label>`;
}

/** 0 to 100 in steps of 5, with its number beside it. */
export function cLevel({id, name, change, value, label = name, def = '100%', icon = 'sound'}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return `<label class="c-line c-level" ${attrs(id, def, icon)}><span class="c-text">${nameOf(name)}</span><input type="range" class="c-range" min="0" max="100" step="5" aria-label="${esc(label)}" data-change="${esc(change)}" value="${v}" style="--v:${v}%"><output class="c-pct">${v}%</output></label>`;
}

/** One of a few words (Light, Dark, Aura). Radios keep their name, so the app's own sync of `checked` still finds them. */
export function cChoice({id, name, change, group, options, value, def = '', icon = ''}) {
  return `<div class="c-line c-pick" role="radiogroup" aria-label="${esc(name)}" ${attrs(id, def, icon)}><span class="c-text">${nameOf(name)}</span><span class="c-choice">${options.map(([v, label]) => `<label><input type="radio" name="${esc(group)}" value="${esc(v)}" data-change="${esc(change)}" ${v === value ? 'checked' : ''}${group === 'settingsTheme' ? ` id="settingsTheme-${esc(v)}"` : ''}><span>${esc(label)}</span></label>`).join('')}</span></div>`;
}

/** A line that does something or opens something: a button, or a file picker when [file] names its handler. */
export function cGo({id, name, act = '', value = '', tone = '', file = '', accept = '.json', danger = false, icon = '', extra = '', state = ''}) {
  const val = value ? `<span class="c-val c-word${tone ? ' ' + esc(tone) : ''}">${esc(value)}</span>` : '';
  const inner = `<span class="c-text">${nameOf(name, danger)}${stateOf(state)}</span>${val}<span class="c-chev" aria-hidden="true">${ICON.chevronRight || '›'}</span>`;
  if (file) return `<label class="c-line c-go${danger ? ' danger' : ''}" ${attrs(id, '', icon)}>${inner}<input type="file" accept="${esc(accept)}" data-change="${esc(file)}" hidden></label>`;
  return `<button type="button" class="c-line c-go${danger ? ' danger' : ''}" data-act="${esc(act)}" ${extra} ${attrs(id, '', icon)}>${inner}</button>`;
}

/** A line that opens in place (Edit profile, Earlier saves): a disclosure whose summary is the line. */
export function cOpen({id, name, body, danger = false, value = '', icon = '', cls = ''}) {
  return `<details class="c-open${cls ? ' ' + cls : ''}" ${attrs(id, '', icon)}><summary class="c-line c-go${danger ? ' danger' : ''}"><span class="c-text">${nameOf(name, danger)}</span>${value ? `<span class="c-val c-word">${esc(value)}</span>` : ''}<span class="c-chev" aria-hidden="true">${ICON.chevronRight || '›'}</span></summary><div class="c-open-body">${body}</div></details>`;
}

/** The panel beside the list on a wide screen: the line's picture, its name, its default. Filled by [initConsoleSettings]. */
export const cDetail = () => `<aside class="c-detail" aria-hidden="true"><div class="c-pic"></div><b class="c-dname"></b><small class="c-ddef"></small></aside>`;

/** A section: its lines in a list, and the panel beside them. */
export const cSection = (id, tab, lines, {panel = true} = {}) =>
  `<div id="settings-${id}" class="settings-pane c-pane" role="tabpanel" aria-labelledby="settingsTab-${id}" ${tab === id ? '' : 'hidden'}><div class="c-body"><div class="c-list">${lines}</div>${panel ? cDetail() : ''}</div></div>`;

const ICONS = () => ({...ICON, ...CONSOLE_ICON});
/** Fill a section's panel from the line you are on (pointer, keyboard or the first line). */
export function showConsoleLine(line) {
  const pane = line?.closest?.('.c-pane'), panel = pane?.querySelector('.c-detail');
  if (!panel) return;
  for (const n of pane.querySelectorAll('.c-line.on')) n.classList.remove('on');
  line.classList.add('on');
  const host = line.closest('[data-cline]') || line;
  const icon = ICONS()[host.dataset.cicon] || ICONS()[pane.dataset.cicon] || '';
  panel.querySelector('.c-pic').innerHTML = icon;
  panel.querySelector('.c-dname').textContent = host.querySelector('.c-name')?.textContent || '';
  const def = host.dataset.cdef;
  panel.querySelector('.c-ddef').textContent = def ? `Default: ${def}` : '';
}

/** Show each open section's first line in its panel, and keep a level's number in step while it is dragged. */
export function primeConsoleSettings(root) {
  for (const pane of root?.querySelectorAll?.('.c-pane:not([hidden])') || []) {
    const first = pane.querySelector('.c-line'); if (first && !pane.querySelector('.c-line.on')) showConsoleLine(first);
  }
}
export function initConsoleSettings(doc = globalThis.document) {
  if (!doc?.addEventListener || doc.__consoleSettings) return; doc.__consoleSettings = true;
  const pick = e => { const line = e.target?.closest?.('.c-line'); if (line?.closest('.c-pane')) showConsoleLine(line); };
  doc.addEventListener('focusin', pick); doc.addEventListener('pointerover', pick);
  doc.addEventListener('input', e => {
    const r = e.target; if (!r?.classList?.contains('c-range')) return;
    r.style.setProperty('--v', r.value + '%'); const out = r.parentElement?.querySelector('.c-pct'); if (out) out.textContent = r.value + '%';
  });
}
