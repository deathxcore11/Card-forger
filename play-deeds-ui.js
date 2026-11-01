// Play quests and achievements (play-achievements.md): the home's "Today" and "Achievements" panels
// and the Achievements screen. Markup only; app.js wires the actions and play-econ-route.js pays.
// Play's wall: no prices, and nothing here reads the real collection.
import {achievementRows, deedTotals, almostThere, achievementReward, questRows, questReward, LOGIN_WEEK, DEED_TABS, playDay} from './play-achievements.js';
import {coinIcon, sealIcon, packIcon, head, cardImageByName} from './play-econ-ui.js';
import {bar} from './ui.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const n = v => Number(v || 0).toLocaleString('en-US');
const today = () => playDay(-new Date().getTimezoneOffset());

// A reward as icons: coins, seals, packs, XP.
export function rewardIcons(r = {}) {
  const out = [];
  if (r.coins) out.push(`<span class="pd-rw">${coinIcon()}<b>${n(r.coins)}</b></span>`);
  for (const [k, v] of Object.entries(r.seals || {})) if (v) out.push(`<span class="pd-rw">${sealIcon(k)}<b>${v}</b></span>`);
  if (r.packs) out.push(`<span class="pd-rw">${packIcon}<b>${r.packs}</b></span>`);
  if (r.collector) out.push(`<span class="pd-rw pd-rw-collector">${packIcon}<b>${r.collector}</b></span>`);
  if (r.xp) out.push(`<span class="pd-rw pd-rw-xp"><b>${n(r.xp)}</b> XP</span>`);
  const label = [r.coins && `${n(r.coins)} coins`, ...Object.entries(r.seals || {}).filter(([, v]) => v).map(([k, v]) => `${v} ${({c: 'common', u: 'uncommon', r: 'rare', m: 'mythic'})[k]} seal${v === 1 ? '' : 's'}`), r.packs && `${r.packs} pack${r.packs === 1 ? '' : 's'}`, r.collector && `${r.collector} Collector pack${r.collector === 1 ? '' : 's'}`, r.xp && `${n(r.xp)} XP`].filter(Boolean).join(', ');
  return `<span class="pd-rws" role="img" aria-label="Reward: ${esc(label)}">${out.join('')}</span>`;
}
const ctxOf = (state, user) => ({counters: state?.counters || {}, claimed: state?.claimed || [], state, day: today(), user});
const fmtValue = (a, v) => a.unit === 'h' ? Math.floor(v / 60) : v;
const fmtNeed = (a, v) => a.unit === 'h' ? `${n(v / 60)} h` : n(v);

function questLine(q, config, busy) {
  const label = 'Claim';
  return `<li class="pd-quest${q.done ? ' is-done' : ''}${q.claimed ? ' is-claimed' : ''}"><div class="pd-quest-copy"><span class="pd-quest-name">${esc(q.label)}</span>${q.done ? '' : `${bar(q.have / q.need, 'thin')}<span class="pd-quest-count">${n(q.have)} / ${n(q.need)}</span>`}</div>
    ${q.claimed ? '<span class="pd-done">Claimed</span>' : q.done ? `<button class="btn pd-claim" data-act="playEconClaim" data-econ-kind="${q.weekly ? 'weekly' : 'daily'}" data-econ-id="${esc(q.id)}" ${busy ? 'disabled' : ''} aria-label="Claim: ${esc(q.label)}">${label}</button>` : rewardIcons(questReward(q, config))}</li>`;
}

// The home's "Today": the log-in calendar (7 stamps), today's quests and this week's.
export function todayPanel(econ, user = '') {
  const s = econ?.state; if (!s) return '';
  const q = questRows(ctxOf(s, user)), stamp = s.login?.stamp || 0, busy = !!econ.busy;
  const cal = `<ol class="pd-cal" aria-label="Log-in calendar: day ${stamp || 0} of 7 stamped">${LOGIN_WEEK.map((r, i) => `<li class="${i < stamp ? 'on' : ''}${i === stamp - 1 && s.login?.fresh ? ' fresh' : ''}" title="Day ${i + 1}"><span class="pd-cal-day">${i + 1}</span>${rewardIcons(r)}</li>`).join('')}</ol>`;
  const weekDone = q.weekly.filter(x => x.done).length;
  return `<section class="pe-shelf-row pd-today" aria-labelledby="pdTodayTitle"><div class="home-shelf-heading"><h2 id="pdTodayTitle">Today</h2><button class="link small" data-act="playEconView" data-econ-view="deeds">Quests</button></div>
    ${cal}
    <ul class="pd-quests">${q.daily.map(x => questLine(x, s.config, busy)).join('')}</ul>
    <p class="pd-week">This week: ${weekDone} of ${q.weekly.length} weekly quests done</p></section>`;
}

// The home's "Achievements": deeds earned with a progress bar, and the closest ones.
export function deedsPanel(econ, user = '') {
  const s = econ?.state; if (!s) return '';
  const rows = achievementRows(ctxOf(s, user)), t = deedTotals(rows), near = almostThere(rows, 2);
  return `<section class="pe-shelf-row pd-deeds-home" aria-labelledby="pdDeedsTitle"><div class="home-shelf-heading"><h2 id="pdDeedsTitle">Achievements</h2><button class="link small" data-act="playEconView" data-econ-view="deeds">${t.ready ? `${t.ready} to claim` : 'All achievements'}</button></div>
    <div class="pd-total"><span class="pd-total-num"><b>${n(t.earned)}</b><span>of ${n(t.total)} earned</span></span>${bar(t.total ? t.earned / t.total : 0)}</div>
    <ul class="pd-near">${near.map(r => `<li><button class="pd-near-row" data-act="playEconView" data-econ-view="deeds" data-econ-tab="${esc(r.tab)}"><span class="pd-near-art" aria-hidden="true"><img src="${esc(cardImageByName(r.art, 'art_crop'))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span><span class="pd-near-copy"><b>${esc(r.title)}</b>${bar(r.value / r.next.need, 'thin')}<small>${n(fmtValue(r, r.value))} / ${fmtNeed(r, r.next.need)}</small></span></button></li>`).join('')}</ul></section>`;
}

function deedCard(r, config, busy) {
  if (r.hidden && !r.earned) return `<article class="pd-card pd-card--hidden"><span class="pd-card-back" aria-hidden="true"></span><div class="pd-card-body"><h3>Hidden</h3><p>${esc(r.riddle)}</p></div></article>`;
  const ready = r.steps.findIndex(x => x.done && !x.claimed), step = r.next || r.steps.at(-1), shown = ready >= 0 ? ready : r.steps.indexOf(step);
  return `<article class="pd-card${r.complete ? ' is-complete' : ''}${ready >= 0 ? ' is-ready' : ''}">
    <span class="pd-card-art" aria-hidden="true"><img src="${esc(cardImageByName(r.art, 'art_crop'))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>
    <div class="pd-card-body"><h3>${esc(r.title)}</h3><p>${esc(r.lore)}</p>
      ${r.steps.length > 1 ? `<span class="pd-pips" role="img" aria-label="${r.earned} of ${r.steps.length} tiers">${r.steps.map(x => `<i class="pd-pip pd-pip--${x.tier}${x.done ? ' on' : ''}"></i>`).join('')}</span>` : ''}
      ${bar(Math.min(1, r.value / step.need), 'thin')}<span class="pd-card-count">${n(fmtValue(r, Math.min(r.value, step.need)))} / ${fmtNeed(r, step.need)}</span>
      <div class="pd-card-foot">${rewardIcons(achievementReward(r, shown, config))}${ready >= 0 ? `<button class="btn pd-claim" data-act="playEconClaim" data-econ-kind="ach" data-econ-id="${esc(r.id)}" data-econ-step="${ready}" ${busy ? 'disabled' : ''} aria-label="Claim ${esc(r.title)}">Claim</button>` : r.complete ? '<span class="pd-done">Earned</span>' : ''}</div></div></article>`;
}

// The Achievements screen: totals and the closest ones, today's quests, then one tab of deeds.
export function deedsScreenMarkup(snapshot, ui = {}, user = '') {
  const s = snapshot.state, rows = achievementRows(ctxOf(s, user)), t = deedTotals(rows), tab = DEED_TABS.some(([k]) => k === ui.deedTab) ? ui.deedTab : 'journey';
  const q = questRows(ctxOf(s, user)), busy = !!snapshot.busy;
  const weekAll = q.weeklyAll.done && !q.weeklyAll.claimed ? `<button class="btn pd-claim" data-act="playEconClaim" data-econ-kind="weekly-all" data-econ-id="all" ${busy ? 'disabled' : ''}>Claim the weekly bonus</button>` : '';
  const counts = new Map(DEED_TABS.map(([k]) => [k, rows.filter(r => r.tab === k && r.ready).length]));
  return `<section class="play-menu pe-screen pd-screen" aria-labelledby="playTitle">${head('Achievements', snapshot)}
    <div class="pd-top">
      <section class="pe-import pd-summary" aria-labelledby="pdSumTitle"><h2 id="pdSumTitle">Hall of Deeds</h2><div class="pd-total"><span class="pd-total-num"><b>${n(t.earned)}</b> / ${n(t.total)} earned</span>${bar(t.total ? t.earned / t.total : 0)}</div>
        <p class="pd-week">${t.ready ? `${t.ready} ready to claim. Look for the gold edge.` : 'Every count comes from real matches, log-ins and your Trunk. Practice never counts.'}</p></section>
      <section class="pe-import pd-questbook" aria-labelledby="pdQuestTitle"><h2 id="pdQuestTitle">Quests</h2><h3 class="pd-sub">Today</h3><ul class="pd-quests">${q.daily.map(x => questLine(x, s.config, busy)).join('')}</ul>
        <h3 class="pd-sub">This week</h3><ul class="pd-quests">${q.weekly.map(x => questLine({...x, weekly: true}, s.config, busy)).join('')}</ul>${weekAll}</section>
    </div>
    <div class="set-browser-quick pd-tabs" role="group" aria-label="Achievement type" data-audit-scroll>${DEED_TABS.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="playEconDeedTab" data-value="${k}" aria-pressed="${tab === k}">${esc(l)}${counts.get(k) ? ` <span class="pd-dot" aria-label="${counts.get(k)} to claim">${counts.get(k)}</span>` : ''}</button>`).join('')}</div>
    <div class="pd-grid">${rows.filter(r => r.tab === tab).map(r => deedCard(r, s.config, busy)).join('')}</div>
    <p class="pe-status" role="status" aria-live="polite">${esc(snapshot.error || '')}</p></section>`;
}
