// Live achievement toasts (Randall, 4 Nov 2026: "like Xbox or RetroAchievements"). When a Play answer
// moves the counters (a match report, a Story deed, a pack, the Merchant, the Forge, a log-in), the steps
// that just became done drop in as a glass pill under the status bar: the deed's own art in a ring that
// glows in its tier colour (never a gold frame), its title, the step or riddle, and the reward. One at a
// time; each holds 4.2s; tap opens the deed in Achievements, swipe up dismisses. The server stays the
// only judge: nothing here decides a deed, it only compares two snapshots the server sent.
// The native app ports this file line for line (design: https://claude.ai/artifact/SqdunzSVPvwVbjyad1iPUV).
import {achievementRows, achievementTiers, achievementReward, achievementArt} from './play-achievements.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const n = v => Number(v || 0).toLocaleString('en-US');
const SEAL = {c: 'common', u: 'uncommon', r: 'rare', m: 'mythic'};

// Every step that is done, as "id:step" (Practice honour steps too: earned is earned, they just never pay).
export function doneSteps(state) {
  const out = new Set();
  if (!state?.counters) return out;
  for (const r of achievementRows({counters: state.counters, claimed: state.claimed || [], state}))
    r.steps.forEach((s, i) => { if (s.done) out.add(`${r.id}:${i}`); });
  return out;
}

// The steps done in `after` that were not in `before`, oldest tier first, as toast rows.
export function newlyEarned(before, after, config = {}) {
  if (!(before instanceof Set) || !after?.counters) return [];
  const rows = achievementRows({counters: after.counters, claimed: after.claimed || [], state: after}), out = [];
  for (const r of rows) r.steps.forEach((s, i) => {
    if (!s.done || before.has(`${r.id}:${i}`)) return;
    const tier = achievementTiers(r)[i];
    out.push({id: r.id, step: i, tab: r.tab, title: r.title, art: r.art, tier: r.hidden ? 'hidden' : r.honour ? 'honour' : tier,
      line: r.hidden ? r.riddle : r.steps.length > 1 ? `Tier ${i + 1} of ${r.steps.length} · ${r.unit === 'h' ? n(s.need / 60) + ' h' : n(s.need)}` : r.lore,
      reward: r.honour ? {} : achievementReward(r, i, config)});
  });
  return out;
}

// Up to two short reward lines for the right side of the pill.
export function rewardLines(r = {}) {
  const lines = [];
  if (r.xp) lines.push(`+${n(r.xp)} XP`);
  if (r.coins) lines.push(`${n(r.coins)} coins`);
  for (const [k, v] of Object.entries(r.seals || {})) if (v) lines.push(`${v} ${SEAL[k] || k} seal${v === 1 ? '' : 's'}`);
  if (r.collector) lines.push(`Collector pack`);
  if (r.packs) lines.push(`${r.packs} pack${r.packs === 1 ? '' : 's'}`);
  return lines.slice(0, 2);
}

const EYEBROW = {bronze: 'Achievement · Bronze', silver: 'Achievement · Silver', gold: 'Achievement · Gold', mythic: 'Achievement · Mythic', feat: 'Feat', hidden: 'Hidden feat', honour: 'Earned with honour'};
// Haptic kinds and sounds that already exist (feel.js PACK_PATTERNS, audio.js claim sounds).
export const TOAST_FEEL = {
  bronze: {haptic: 'reward-claim', sound: 'RWD-001'}, silver: {haptic: 'reward-claim', sound: 'RWD-001'},
  gold: {haptic: 'reward-big', sound: 'RWD-006'}, mythic: {haptic: 'pack-tier-4', sound: 'RWD-006'},
  feat: {haptic: 'reward-big', sound: 'RWD-006'}, hidden: {haptic: 'pack-tier-5', sound: 'RWD-006'}, honour: {haptic: 'reward-claim', sound: 'RWD-001'},
};
export const TOAST_TIMING = {inMs: 420, holdMs: 4200, outMs: 320};

export function toastMarkup(t, more = 0) {
  const a = achievementArt(t.art), lines = rewardLines(t.reward);
  return `<span class="ach-toast-art" aria-hidden="true">${a.trim ? `<i style="background-image:url('${esc(a.url)}')"></i>` : `<img src="${esc(a.url)}" alt="" decoding="async" referrerpolicy="no-referrer">`}</span>`
    + `<span class="ach-toast-copy"><span class="ach-toast-eyebrow">${esc(EYEBROW[t.tier] || 'Achievement')}</span><span class="ach-toast-title">${esc(t.title)}</span><span class="ach-toast-line">${esc(t.line)}</span></span>`
    + (lines.length ? `<span class="ach-toast-reward">${lines.map(esc).join('<br>')}</span>` : '')
    + (more ? `<span class="ach-toast-more">+${more}</span>` : '');
}

// The queue. mount/unmount put the pill above any open dialog (feedback-layer.js); onOpen(t) opens the deed.
export function createAchievementToasts({mount = el => document.body.append(el), unmount = el => el.remove(), haptic = () => {}, sound = () => {}, onOpen = () => {}, reduced = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches} = {}) {
  const queue = [];
  let showing = false;
  function next() {
    const t = queue.shift();
    if (!t) { showing = false; return; }
    showing = true;
    const first = !t.queued, el = document.createElement('button');
    el.type = 'button'; el.className = `ach-toast ach-toast--${t.tier}`; el.setAttribute('role', 'status');
    el.setAttribute('aria-label', `${EYEBROW[t.tier] || 'Achievement'}: ${t.title}. ${t.line}. Open in Achievements.`);
    el.innerHTML = toastMarkup(t, first ? queue.length : 0);
    mount(el);
    const feel = TOAST_FEEL[t.tier] || TOAST_FEEL.bronze;
    haptic(first ? feel.haptic : 'tick');
    if (first) sound(feel.sound);
    for (const q of queue) q.queued = true;
    let done = false, timer = 0;
    const close = () => {
      if (done) return; done = true; clearTimeout(timer);
      el.classList.add('is-out');
      setTimeout(() => { unmount(el); next(); }, reduced() ? 0 : TOAST_TIMING.outMs);
    };
    requestAnimationFrame(() => el.classList.add('is-in'));
    timer = setTimeout(close, TOAST_TIMING.inMs + TOAST_TIMING.holdMs);
    let y0 = null, swiped = false;
    el.addEventListener('click', () => { if (swiped) return; close(); onOpen(t); });
    el.addEventListener('pointerdown', e => { y0 = e.clientY; });
    el.addEventListener('pointermove', e => { if (y0 !== null && y0 - e.clientY > 24) { y0 = null; swiped = true; close(); } });
    el.addEventListener('pointerup', () => { y0 = null; });
  }
  return {
    push(list) { if (!list?.length) return; queue.push(...list); if (!showing) next(); },
    get pending() { return queue.length + (showing ? 1 : 0); },
  };
}
