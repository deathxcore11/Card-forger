// Lost Memories playable test page (codename crucible). Runs the real engine in the browser.
// The duel is drawn only from viewFor(seat 0), so this page cannot show hidden cards.
import { buildDb, roleOf, weightOf, meldPairRaw } from '../engine/cards.mjs';
import { legalActions, playVariants, planChain, viewFor, forecast } from '../engine/duel.mjs';
import { RELICS as BASE_RELICS, LAB, TUNED_TEXT, relicText } from '../engine/relics.mjs';
const RELICS = { ...BASE_RELICS, ...LAB }; // the page's own copy: an item's words follow the rules in force (see setLabs)
import { newRun, runApply, deckWeight, weightCap, relicList, possibleMasterworks, cardValue, BOSSES, BUILD_FAMILIES, HEAT_RULES, bossLaw, ENCHANT_TEXT } from '../engine/run.mjs';
import { codexResult, codexKnows, codexUpgrade } from '../engine/cards.mjs';
import { powerActions } from '../engine/duel.mjs';
import { FORGERS, FORGER_IDS } from '../engine/forgers.mjs';
import { newProfile, applyRun, buy, maxHeat, VAULT, FORGER_FEATS, featList, runOptions, openKits, nextKit, forgerStats, VAULT_ENCHANTS, KIT_GOALS, START_ENCHANTS } from '../engine/meta.mjs';
import { SCENES } from './story.mjs';
import { LAB_DEFAULTS, labConfig } from './labs.mjs';
import { shortText as shortTextOf, rulesText as rulesTextOf } from './text.mjs';

const D = window.CRUCIBLE_DATA;
const db = buildDb(D.pool, D.tags, D.config);
// Lab rules: experiments under test. Off unless switched on at the home screen.
const LABS = {
  free: 'Free cast: your first Spell, Field or Trap played alone each turn does not use your play. Rivals get it too.',
  solo: 'Lone arrivals: a Zombie, Fairy, Machine or Spellcaster played alone and face up uses an arrival ability.',
  five: 'Five Gifts a run (the current test baseline): Forge Gifts come half as often, new Gifts for Storm, Tomb, Ambush and Furnace join the pool, rivals on floors two and three are turned down to match, and the final bosses are eased.',
  styles: 'Rivals with a style: from the second floor each rival carries a relic of the kind you can earn, shows a tell on its door, and plays toward it. Harder.',
  trap: 'Free Trap: setting your first Trap each turn does not use your play. Floor guardians get it too. (The wider free cast below overrides this.)',
  lean: 'Leaning offers: one of the three Gifts leans toward a build you already hold a piece of, and you may deal one Gift offer again each run.',
  heat: 'Heat ladder: ten Heat levels. Each level adds one written rule you can read before you descend, and rivals no longer just get bigger numbers.',
  allHeat: 'Open every Heat level now. For testing only: normally each level opens when you clear the one below.',
  kits: 'Even kits: weak starter kits may hold stronger monsters and strong kits weaker ones, so the three kits of a Forger play about the same. Off, kits differ a lot, and the kit screen shows by how much.',
  items: 'Tuned items: Storm pieces ask for a meld of four cards, not three, Copper Loop and Patient Coil give less, and Grave Ward works once a duel. Off, those three items decide most runs on their own in testing.',
  veilSet: 'Veilwalker, wider rule: once a turn, while she holds no veiled monster, she may also set one monster veiled in defense without using her play. In testing her current rule is worth nothing; this one is strong with Ambush Gifts.',
  long: 'Long road: more to earn. Each Forger starts with one starter kit and opens the other two by winning duels, each Forger keeps a record of the highest Heat they have cleared (Heat itself stays shared), six of the twelve Enchants are bought in the Memory Vault, and three more feats each unlock a Gift. Nothing here makes a start stronger.',
  tombStart: 'Start with the Tomb set: carry all three Tomb relics from the first duel. A strong demonstration, not a fair run.',
};
let labs = {}; // the rules in force now
let pref = {}; // what the home switches say. A run in progress keeps the set it started with, so its rules never change part-way.
function setLabs(v) { labs = v || {}; Object.assign(db.config, labConfig(labs)); for (const id of Object.keys(TUNED_TEXT)) RELICS[id] = { ...(BASE_RELICS[id] || LAB[id]), text: relicText(db, id) }; }
const $ = s => document.querySelector(s);
const app = $('#app');
const LABKEY = 'lostmemories.labs.v5', RUNLABS = 'lostmemories.runlabs.v1', SAVE = 'lostmemories.run.v1', KNOWN = 'lostmemories.codex.v1', PROFILE = 'lostmemories.profile.v1';
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private window */ } }, del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } } };

const G = { run: null, sel: [], onto: null, attacker: null, frames: [], playing: false, shown: null, inspect: null, toast: '', overlay: null, known: new Set(store.get(KNOWN) || []), tab: null, screen: null, story: null, results: null, pickForger: 'tarn', pickHeat: 0, pickDeck: null, pickTrunk: null, log: [], fast: false, cx: { view: 'found', type: null, open: null } };
const P = Object.assign(newProfile(), store.get(PROFILE) || {});
{ const st = store.get(LABKEY); pref = st ? { heat: true, kits: true, ...st } : { ...LAB_DEFAULTS }; setLabs(pref); }
// Saves from before 20 November 2026 wrote a shared pair (the two Robo fusions) without its order: bring them up to date once.
{ const pc = codexUpgrade(db, P.codex), kn = codexUpgrade(db, [...G.known].concat(pc)); if (pc.join() !== P.codex.join()) { P.codex = pc; store.set(PROFILE, P); } if (kn.join() !== [...G.known].join()) store.set(KNOWN, kn); G.known = new Set(kn); }
const saveP = () => store.set(PROFILE, P);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const card = id => db.byId.get(id);
const cap = x => x[0].toUpperCase() + x.slice(1);
const START6 = START_ENCHANTS.map(cap).join(', ');
// Card pictures come from sprite sheets of 100 (10 by 10), in pool order, so nothing is hot-linked.
const IDX = new Map(D.pool.cards.map((c, i) => [c.id, i]));
const pic = id => { const i = IDX.get(id); if (i == null || !D.sheets) return ''; const k = i % 100; return `<span class="pic" style="background-image:url(${D.sheets}${Math.floor(i / 100)}.webp);background-position:${(k % 10) * 100 / 9}% ${Math.floor(k / 10) * 100 / 9}%"></span>`; };
const ATTR = { DARK: '#7a4bd6', LIGHT: '#e8c95a', FIRE: '#e0562f', WATER: '#3d8fe0', EARTH: '#9a7a45', WIND: '#4fb87a', DIVINE: '#d9d9d9' };
const shortText = id => shortTextOf(db, id), rulesText = id => rulesTextOf(db, id);

// ---------- card drawing ----------
function face(inst, o = {}) {
  if (!inst) return '';
  if (inst.veil && !inst.id) return `<div class="c back ${inst.pos === 'd' ? 'def' : ''}" ${o.attrs || ''}><img decoding="sync" src="art/cardback.webp" alt="Veiled card"></div>`;
  const c = card(inst.id), role = roleOf(db, inst.id), mon = role === 'monster';
  const a = inst.ea ?? (c.atk + (inst.t ? 300 : 0) + (inst.ba || 0)), d = inst.ed ?? (c.def + (inst.t ? 300 : 0) + (inst.bd || 0));
  const up = mon && (a > c.atk || d > c.def), down = mon && (a < c.atk);
  const foil = inst.b ? 'ghost' : inst.t && inst.e ? 'secret' : inst.e ? 'ultra' : inst.t ? 'super' : '';
  return `<div class="c ${role} ${inst.pos === 'd' ? 'def' : ''} ${inst.veil ? 'myveil' : ''} ${foil} ${o.cls || ''}" ${o.attrs || ''} data-id="${inst.id}">
    <div class="art" style="--attr:${mon ? ATTR[c.attr] : '#444'}"><span class="ph">${mon ? esc(c.type) : role.toUpperCase()}</span>${pic(inst.id)}</div>
    <div class="nm">${esc(c.name)}</div>
    ${mon ? `<div class="meta"><i style="background:${ATTR[c.attr]}"></i>${esc(c.attr)} · Lv ${c.level}</div><div class="st ${up ? 'up' : ''} ${down ? 'down' : ''}">${a}<b>/</b>${d}</div>` : `<div class="meta kind">${role === 'fuel' ? 'Fuel' : role[0].toUpperCase() + role.slice(1)}</div><div class="tx">${esc(shortText(inst.id))}</div>`}
    ${inst.e ? `<div class="en">${inst.e}</div>` : ''}${inst.veil ? '<div class="vl">VEILED</div>' : ''}${o.badge ? `<div class="bd">${o.badge}</div>` : ''}
  </div>`;
}
const ART = new Set(D.art || []);
const relicImg = id => { const f = (RELICS[id].kind === 'M' ? 'masterwork' : 'relic') + '-' + id.replace(/_/g, '-'); return ART.has(f) ? `<img class="ri" decoding="sync" src="art/${f}.webp" alt="">` : '<span class="ri gem"></span>'; };
const FAMILY_NAME = { furnace: 'Furnace', shadow: 'Ambush', lean: 'Lean Deck', storm: 'Storm', tomb: 'Tomb' };
const relicRow = (id, extra = '') => `<div class="relic">${relicImg(id)}<div><b>${esc(RELICS[id].name)}</b> <small>${{ C: 'Charm', G: 'Gift', M: 'Masterwork' }[RELICS[id].kind]}</small><br>${esc(RELICS[id].text)}${extra}</div></div>`;

// ---------- run plumbing ----------
function act(a) {
  const run = G.run; if (!run || G.playing) return;
  const frames = [];
  const wasDuel = run.phase === 'duel' || (run.phase === 'chamber' && a.t === 'door');
  try {
    runApply(run, a, db, { onStep: evs => { if (run.duel) frames.push({ view: JSON.parse(JSON.stringify(viewFor(run.duel, db, 0))), evs, rival: info(run) }); } });
  } catch (e) { toast(e.message); render(); return; }
  G.sel = []; G.onto = null; G.attacker = null;
  if (run.codex) { for (const k of run.codex) G.known.add(k); store.set(KNOWN, [...G.known]); }
  if (run.offer && run.offer.fresh && (P.fresh || []).includes(run.offer.fresh)) { P.fresh = P.fresh.filter(x => x !== run.offer.fresh); saveP(); }
  if (run.phase === 'over') { store.del(SAVE); if (!G.results) { G.results = applyRun(P, run, { long: !!labs.long }); saveP(); queueStory(run.result.won ? 'cleared' : 'fell'); } } else store.set(SAVE, run);
  if (wasDuel && frames.length) { G.frames = frames; if (!run.duel && run.lastDuel) G.overlay = { kind: 'duelEnd', sum: run.lastDuel, rival: G.lastRival }; playFrames(); }
  else render();
}
const info = run => (G.lastRival = run.rival ? { name: run.rival.name, tier: run.rival.tier, lawText: run.rival.lawText, bountyText: run.rival.bountyText, twist: run.rival.twist, style: run.rival.style, styleText: run.rival.styleText } : G.lastRival);
// A Law is written for a hand of five. With Deep Pockets the hand is six, so Tyranny's numbers are one higher.
const lawShown = t => G.run && G.run.charms.includes('deep_pockets') ? t.replace('refills to four', 'refills to five').replace('refills to three', 'refills to four') : t;
function toast(m) { G.toast = m; clearTimeout(toast.t); toast.t = setTimeout(() => { G.toast = ''; const t = $('#toast'); if (t) t.textContent = ''; }, 2600); }

async function playFrames() {
  G.playing = true;
  while (G.frames.length) {
    const f = G.frames.shift();
    const ghosts = snapshotGhosts(f.evs);
    G.shown = f; render();
    animate(f.evs, ghosts);
    for (const e of f.evs) logLine(e, f.view);
    const heavy = f.evs.some(e => ['battle', 'summon', 'spell', 'trap', 'terrain', 'meld', 'equip', 'set', 'destroyed'].includes(e.e));
    await new Promise(r => setTimeout(r, G.fast ? 60 : heavy ? 620 : 140));
  }
  G.playing = false; G.shown = null; for (const g of document.querySelectorAll('body > .ghost')) g.remove(); render();
}
// The size of a relic's change, for the log and the flash: " +300/+0", or " -400 ATK" when a relic weakens a monster.
const bonusText = e => !(e.a || e.d) ? '' : e.a < 0 && !e.d ? ` ${e.a} ATK` : ` ${e.a < 0 ? '' : '+'}${e.a || 0}/${e.d < 0 ? '' : '+'}${e.d || 0}`;
function logLine(e, v) {
  const who = s => s === 0 ? 'You' : 'Rival';
  const n = id => id ? card(id).name : 'a veiled card';
  let t = null;
  switch (e.e) {
    case 'summon': t = `${who(e.seat)} played ${n(e.id)}${e.melded ? ' (meld)' : ''}.`; break;
    case 'battle': t = e.direct ? `Direct attack for ${e.a}.` : `Battle: ${e.a} against ${e.d}${e.edgeA || e.edgeD ? ' (Attribute edge)' : ''}.`; break;
    case 'destroyed': t = `${n(e.id)} was destroyed.`; break;
    case 'spell': t = `${who(e.seat)} cast ${n(e.id)}.`; break;
    case 'trap': t = `${who(e.seat)} sprang ${n(e.id)}.`; break;
    case 'terrain': t = `Terrain is now ${n(e.id)}.`; break;
    case 'relic': t = `${e.seat === 0 ? '' : 'Rival: '}${RELICS[e.id].name}${bonusText(e)}.`; break;
    case 'free': t = e.seat === 0 ? 'Free cast: you still have your play.' : 'Rival free cast.'; break;
    case 'solo': t = `${who(e.seat)}: ${e.type} arrival${e.paid ? ' paid off: +300 / +300' : ''}.`; break;
    case 'return': t = `${who(e.seat)} took ${n(e.id)} back from the graveyard.`; break;
    case 'cap': t = `Relic bonus cap reached: +${e.cap} / +${e.cap}.`; break;
    case 'meld': t = e.kind === 'fizzle' ? `Fizzle: ${n(e.lost)} is lost.` : null; break;
    case 'set': t = `${who(e.seat)} set a card.`; break;
    case 'turn': t = `Turn ${e.turn}: ${who(e.seat)}.`; break;
    case 'power': t = `${who(e.seat)} used ${FORGERS[e.forger].power}.`; break;
    case 'lp': t = null; break;
  }
  if (t) { G.log.push(t); if (G.log.length > 40) G.log.shift(); }
}

// ---------- fit ----------
// The stage is drawn at 1600 wide and 900 to 1200 tall, then scaled as one piece, so text never
// drops under a phone's smallest font size and a squarer screen (an unfolded phone) gets a taller table.
const FIT = { k: 1, h: 900 };
function fit() {
  const vw = innerWidth, vh = innerHeight;
  FIT.h = Math.round(Math.max(900, Math.min(1200, 1600 * vh / vw)));
  FIT.k = Math.min(vw / 1600, vh / FIT.h);
  app.style.height = FIT.h + 'px';
  app.style.transform = `translate(-50%,-50%) scale(${FIT.k})`;
  app.style.setProperty('--E', (FIT.h - 900) + 'px');
  app.style.setProperty('--s', FIT.h / 900);
}
addEventListener('resize', fit); fit();

// ---------- motion ----------
const RM = matchMedia('(prefers-reduced-motion:reduce)').matches;
function zoneEl(seat, z) { return document.querySelector(`[data-zone="${seat}:${z}"]`); }
function snapshotGhosts(evs) {
  const out = [];
  for (const e of evs) if (e.e === 'destroyed' || e.e === 'bounce') { const el = zoneEl(e.seat, e.zone); const c = el && el.querySelector('.c'); if (c) { const r = c.getBoundingClientRect(); out.push({ html: c.outerHTML, r, fs: getComputedStyle(c).fontSize, kind: e.e }); } }
  return out;
}
function animate(evs, ghosts) {
  if (RM) return;
  for (const g of ghosts) {
    const w = document.createElement('div'); w.className = 'ghost'; w.innerHTML = g.html;
    Object.assign(w.style, { left: g.r.left + 'px', top: g.r.top + 'px', width: g.r.width / FIT.k + 'px', height: g.r.height / FIT.k + 'px', fontSize: g.fs, transform: `scale(${FIT.k})`, transformOrigin: '0 0' });
    document.body.appendChild(w);
    w.animate(g.kind === 'destroyed' ? [{ opacity: 1, filter: 'brightness(1)' }, { opacity: 1, filter: 'brightness(2.2) sepia(1) saturate(4) hue-rotate(-20deg)', offset: .35 }, { opacity: 0, transform: 'scale(.82) translateY(10%)', filter: 'brightness(.3)' }] : [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-40%) scale(.8)' }], { duration: 480, easing: 'ease-in' }).onfinish = () => w.remove();
  }
  for (const e of evs) {
    if (e.e === 'summon') { const c = zoneEl(e.seat, e.zone)?.querySelector('.c'); if (c) c.animate([{ transform: `translateY(${e.seat === 0 ? 60 : -60}%) scale(1.25)`, opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, filter: 'brightness(1.7)', offset: .7 }, { transform: 'none', filter: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' }); }
    if (e.e === 'attack') { const a = zoneEl(e.seat, e.from)?.querySelector('.c'); const t = e.to >= 0 ? zoneEl(1 - e.seat, e.to) : $(e.seat === 0 ? '#rivalLp' : '#myLp'); if (a && t) { const ra = a.getBoundingClientRect(), rt = t.getBoundingClientRect(); const dx = ((rt.left + rt.width / 2) - (ra.left + ra.width / 2)) / FIT.k, dy = ((rt.top + rt.height / 2) - (ra.top + ra.height / 2)) / FIT.k; a.animate([{ transform: 'none' }, { transform: `translate(${dx * .08 * -1}px,${dy * -.08}px) scale(1.06)`, offset: .25 }, { transform: `translate(${dx * .8}px,${dy * .8}px) scale(1.12)`, offset: .55 }, { transform: 'none' }], { duration: 460, easing: 'cubic-bezier(.5,0,.2,1)' }); a.style.zIndex = 5; setTimeout(() => (a.style.zIndex = ''), 470); } }
    if (e.e === 'lp') { const el = $(e.seat === 0 ? '#myLp' : '#rivalLp'); if (el) { el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)', color: e.d < 0 ? '#ff6b5a' : '#7be08d', offset: .3 }, { transform: 'scale(1)' }], { duration: 500 }); const f = document.createElement('span'); f.className = 'float ' + (e.d < 0 ? 'neg' : 'pos'); f.textContent = (e.d > 0 ? '+' : '') + e.d; el.appendChild(f); setTimeout(() => f.remove(), 900); } if (e.d <= -1500) { (document.querySelector('.duel') || app).animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-.5%,.4%)' }, { transform: 'translate(.5%,-.3%)' }, { transform: 'none' }], { duration: 240 }); } }
    if (e.e === 'relic') { const b = $(e.seat === 0 ? '#relicFlash' : '#rivalFlash'); if (b) { b.textContent = (e.seat === 0 ? '' : 'Rival: ') + RELICS[e.id].name + bonusText(e); b.animate([{ opacity: 0, transform: 'translateY(40%)' }, { opacity: 1, transform: 'none', offset: .2 }, { opacity: 1, offset: .8 }, { opacity: 0 }], { duration: 1100 }); } }
    if (e.e === 'terrain') { const t = $('#terrain'); if (t) t.animate([{ filter: 'brightness(2.4)' }, { filter: 'none' }], { duration: 500 }); }
    if (e.e === 'draw' && e.seat === 0) { const cs = [...document.querySelectorAll('.hand .hs .c')].slice(-e.n); cs.forEach((c, i) => c.animate([{ transform: 'translate(120%,-40%) rotate(8deg) scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, delay: i * 70, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' })); }
  }
}

// ---------- story ----------
function queueStory(id, then) {
  if (!SCENES[id] || P.seen.includes(id)) { if (then) then(); return; }
  P.seen.push(id); saveP(); G.story = { id, i: 0, then: then || null };
}
function storyPanel() {
  const st = G.story; if (!st || G.playing || G.overlay) return '';
  const sc = SCENES[st.id];
  return `<div class="story" data-a="storynext">${sc.face && ART.has(sc.face) ? `<img class="port" src="art/${sc.face}.webp" alt="">` : ''}<div class="say glass">${sc.who ? `<h3>${esc(sc.who)}</h3>` : ''}<p>${esc(sc.lines[st.i])}</p><span class="go">Tap to continue ▸</span></div><button class="skip" data-a="storyskip">Skip</button></div>`;
}

// ---------- screens around a run ----------
const ruleText = id => RELICS[id].text + (id === 'f_veil' && labs.veilSet ? ' Also once a turn, while you hold no veiled monster, setting one monster veiled in defense does not use your play.' : '');
function screenForger() {
  const top = heatTop(), heatMax = heatOpen(), hr = labs.heat ? HEAT_RULES.filter(x => x.n <= G.pickHeat) : [];
  const cardOf = id => { const f = FORGERS[id], own = P.forgers.includes(id), on = G.pickForger === id, face = 'face-' + (id === 'tarn' ? 'tarn' : id);
    return `<div class="ch glass ${own ? '' : 'locked'} ${on ? 'on' : ''}" ${own ? `data-a="forger:${id}"` : ''}>${own && ART.has(face) ? `<img src="art/${face}.webp" alt="">` : `<div class="q">${own ? esc(f.name.replace('The ', '')[0]) : '?'}</div>`}<b>${esc(f.name)}</b><i>${esc(f.tag)}</i>${own ? `<span><u>Rule:</u> ${esc(ruleText(f.rule))}</span><span><u>${esc(f.power)}:</u> ${esc(f.powerText)}</span>${labs.long ? `<span class="road">${roadLine(id)}</span>` : ''}` : `<span>Unlock: ${esc(FORGER_FEATS[id].text)}</span>`}</div>`; };
  return `<div class="hall"><div class="panel glass wide"><h2>Choose your Forger</h2><div class="chars">${FORGER_IDS.map(cardOf).join('')}<div class="ch glass locked"><div class="q">?</div><b>The Last One</b><i>Hidden</i><span>Not in this build yet.</span></div></div>
    <div class="row"><span class="fine">Heat</span>${Array.from({ length: top + 1 }, (_, h) => `<button class="${G.pickHeat === h ? 'gold' : ''}" data-a="heat:${h}" ${h > heatMax ? 'disabled' : ''}>${h}</button>`).join('')}<span class="fine">${G.pickHeat ? `${labs.heat ? '' : 'Rivals are stronger. '}Memories +${G.pickHeat * 20}%.` : heatMax ? '' : 'Clear the pyramid to unlock Heat 1.'}</span></div>
    ${hr.length ? `<div class="heatbox glass"><span class="new"><b>Heat ${G.pickHeat}: ${esc(hr[hr.length - 1].name)}.</b> ${esc(hr[hr.length - 1].text)}</span>${hr.length > 1 ? `<span class="fine">Still in force: ${hr.slice(0, -1).map(x => esc(x.name)).join(', ')}.</span><button data-a="heatinfo:${G.pickHeat}">Read all ${hr.length} rules</button>` : ''}</div>` : labs.heat && heatMax ? '<div class="heatbox glass"><span class="fine">Each Heat level adds one rule. Pick a level to read it.</span></div>' : ''}
    <div class="row"><button class="gold big" data-a="descend">Descend as ${esc(FORGERS[G.pickForger].name)}</button><button data-a="home">Back</button></div></div></div>`;
}
// Long road: what this Forger has open and what comes next.
const roadLine = id => { const st = forgerStats(P, id), nk = nextKit(P, id); return `Kits ${openKits(P, id).length} of ${FORGERS[id].kits.length}${nk ? `, next at ${nk.goal} duels won (${Math.min(nk.wins, nk.goal)}/${nk.goal})` : ''}. ${st.heat >= 0 ? 'Best clear: Heat ' + st.heat : 'No clear yet'}.`; };
const heatTop = () => labs.heat ? HEAT_RULES.length : 5;
const heatOpen = () => labs.allHeat ? heatTop() : Math.min(maxHeat(P), heatTop());
function screenVault() {
  return `<div class="hall"><div class="panel glass wide ${labs.long ? 'scroll' : ''}"><h2>Memory Vault · ${P.memories} Memories</h2><p>Spend Memories to widen what a run can offer. Nothing here makes you stronger at the start.</p><div class="vgrid">${VAULT.map(v => { const own = P.bought.includes(v.id), r = RELICS[v.id]; return `<div class="tile glass ${own ? 'own' : ''}"><small>${r.kind === 'M' ? 'Masterwork' : 'Charm'}</small>${relicImg(v.id)}<b>${esc(r.name)}</b><span>${esc(r.text)}</span><button class="gold" data-a="vbuy:${v.id}" ${own || P.memories < v.price ? 'disabled' : ''}>${own ? 'Owned' : v.price + ' Memories'}</button></div>`; }).join('')}</div>${labs.long ? `<h3 class="vh">Enchants</h3><p class="fine">An Anvil offers three Enchants from the ones you hold. Six are yours from the start: ${START6}.</p><div class="vgrid vench">${VAULT_ENCHANTS.map(v => { const own = P.bought.includes(v.key); return `<div class="tile glass ${own ? 'own' : ''}"><small>Enchant</small><b>${cap(v.id)}</b><span>${esc(ENCHANT_TEXT[v.id])}</span><button class="gold" data-a="vbuy:${v.key}" ${own || P.memories < v.price ? 'disabled' : ''}>${own ? 'Owned' : v.price + ' Memories'}</button></div>`; }).join('')}</div>` : ''}<div class="row"><button class="gold" data-a="home">Back</button></div></div></div>`;
}
// The Codex is a book of results. Every result that any two monsters can make has a page; the
// page says why the rule makes it, and lists the recipes this player has found for it.
let CX = null;
function codexIndex() {
  if (CX) return CX;
  const mons = D.pool.cards.filter(c => c.kind === 'monster' || c.kind === 'fusion');
  const res = new Map();
  for (let i = 0; i < mons.length; i++) for (let j = i; j < mons.length; j++) { const r = meldPairRaw(db, mons[i].id, mons[j].id); if (r.id && !res.has(r.id)) res.set(r.id, { id: r.id, kind: r.kind }); }
  for (const [k, id] of db.recipes) if (!res.has(id)) res.set(id, { id, kind: 'printed' });
  for (const [k, id] of db.recipes) res.get(id).mats = k.split('+').map(Number);
  // two printed fusions that share their materials: each has its own page, and the order of the two decides
  for (const [k, id] of db.ordered) { if (!res.has(id)) res.set(id, { id, kind: 'printed' }); const R = res.get(id); R.mats = k.split('>').map(Number); R.first = R.mats[0]; R.twin = db.ordered.get(R.mats[1] + '>' + R.mats[0]); }
  for (const R of res.values()) if (R.kind === 'cross') { const c = card(R.id), l = db.ladders.get(c.type + '|' + c.attr), i = l.indexOf(c); R.lo = i > 0 ? l[i - 1].atk : 0; }
  const list = [...res.values()].sort((x, y) => card(x.id).type.localeCompare(card(y.id).type) || card(x.id).atk - card(y.id).atk);
  return (CX = { res, list, types: [...new Set(list.map(R => card(R.id).type))].sort() });
}
function codexFound() {
  const found = new Map();
  for (const k of G.known) { const r = codexResult(db, k); if (!r) continue; if (!found.has(r.id)) found.set(r.id, []); found.get(r.id).push(r.mats); }
  return found;
}
function whyLine(R) {
  const c = card(R.id);
  if (R.kind === 'printed' && R.first) return `A printed fusion. Only its two named materials make it, and the meld must start with ${card(R.first).name}.${R.twin ? ` Start with the other one and the same two make ${card(R.twin).name}.` : ''}`;
  if (R.kind === 'printed') return `A printed fusion. Only its ${R.mats.length === 3 ? 'three' : 'two'} named materials make it, in any order.${R.mats.length === 3 ? ' All three go into one meld, one after another.' : ''}`;
  return `${c.type} Type + ${c.attr} Attribute. A meld takes the Type of one monster and the Attribute of the other, and makes the weakest ${c.attr} ${c.type} with more ATK than both. This is that monster when your stronger ingredient has ${R.lo} to ${c.atk - 1} ATK. If the pair can also make something weaker the other way round, the weaker one is made.`;
}
function codexPage(found) {
  const X = codexIndex(), R = X.res.get(G.cx.open); if (!R) return '';
  const c = card(R.id), recs = found.get(R.id) || [], known = recs.length > 0;
  const hint = R.kind === 'printed' ? `A printed fusion of ${R.mats.map(m => 'a ' + card(m).type).join(' and ')}.` : `A ${c.attr} ${c.type}. Some ${c.type} melded with some ${c.attr} monster makes it. Which ones is for you to find.`;
  return `<div class="modal" data-a="cxclose"><div class="glass panel cxpage">${known ? face({ id: R.id }, { cls: 'big' }) : '<div class="c big unk"><span>?</span></div>'}<div><h3>${known ? esc(c.name) : 'Not found yet'}</h3><p>${known ? `${esc(c.type)} · ${esc(c.attr)} · Level ${c.level} · ATK ${c.atk} · DEF ${c.def}` : esc(hint)}</p>${known ? `<p><b>Why:</b> ${esc(whyLine(R))}</p><p><b>Use it again:</b> ${R.kind === 'printed' ? (R.first ? 'the same two materials make it when the meld starts with ' + esc(card(R.first).name) + '.' : 'the same named materials always make it.') : `any ${esc(c.type)} with any ${esc(c.attr)} monster in that ATK range makes it, so cheap cards work as well as good ones.`}</p><h3>Recipes you have found (${recs.length})</h3><div class="recs">${recs.slice(0, 8).map(ids => ids.map(x => `<span class="chip">${esc(card(x).name)}</span>`).join('<b>+</b>')).join('<br>')}${recs.length > 8 ? `<br><span class="fine">and ${recs.length - 8} more</span>` : ''}</div>` : ''}<p class="fine">Tap anywhere to close.</p></div></div></div>`;
}
function screenCodex() {
  const X = codexIndex(), found = codexFound(), v = G.cx;
  let list = X.list.filter(R => (v.view === 'all' || found.has(R.id)) && (!v.type || card(R.id).type === v.type));
  const total = list.length; list = list.slice(0, 120);
  const byType = t => X.list.filter(R => card(R.id).type === t);
  const tiles = list.map(R => { const c = card(R.id); return found.has(R.id) ? `<div class="cxt" data-a="cxopen:${R.id}">${face({ id: R.id }, { cls: 'small' })}<small>${found.get(R.id).length} recipe${found.get(R.id).length > 1 ? 's' : ''}</small></div>` : `<div class="cxt unk" data-a="cxopen:${R.id}"><div class="c small unk"><span>?</span></div><small>${R.kind === 'printed' ? 'Printed fusion' : esc(c.type) + ' · ' + esc(c.attr)}</small></div>`; }).join('');
  return `<div class="hall"><div class="panel glass wide scroll"><h2>Codex · ${found.size} of ${X.list.length} results found</h2><p>Every monster a meld can make has a page here. A page you have found shows why the meld works, so you can make it again from other cards. ${G.known.size} recipes written.</p>
    <div class="row left"><button class="${v.view === 'found' ? 'gold' : ''}" data-a="cxview:found">Found</button><button class="${v.view === 'all' ? 'gold' : ''}" data-a="cxview:all">All pages</button>${X.types.map(t => `<button class="ty ${v.type === t ? 'gold' : ''}" data-a="cxtype:${t}">${esc(t)} ${byType(t).filter(R => found.has(R.id)).length}/${byType(t).length}</button>`).join('')}</div>
    <div class="cxgrid">${tiles || '<p class="fine">Nothing here yet. Meld two monsters in a duel to write the first page.</p>'}</div>${total > 120 ? `<p class="fine">Showing 120 of ${total}. Pick a Type to narrow it.</p>` : ''}
    <h3 style="margin-top:1em">Record</h3><p>Runs ${P.runs} · Clears ${P.clears} · Duels won ${P.duelWins} · Guardians beaten ${P.bossWins} · Memories earned ${P.earned}</p><div class="row"><button class="gold" data-a="home">Back</button></div></div>${G.cx.open != null ? codexPage(found) : ''}</div>`;
}

// ---------- screens ----------
function hud() {
  const r = G.run; if (!r || r.phase === 'kit') return '';
  const cap = weightCap(db, r), w = deckWeight(db, r.deck);
  const sparks = '◆'.repeat(Math.max(0, r.sparks)) + '◇'.repeat(Math.max(0, db.config.sparks - r.sparks));
  return `<div class="hud glass"><span>Floor ${r.floor + 1} · Chamber ${Math.min(r.chamber + 1, 6)}</span><span class="sp" title="Sparks">${sparks}</span><span>Embers <b>${r.embers}</b></span><span>Seals <b>${Math.min(2, r.seals)}/2</b></span><span>Weight <b>${w}/${cap}</b></span><span>Forge Lv <b>${r.level}</b></span>
    <button data-a="tab:deck">Deck</button><button data-a="tab:relics">Relics (${relicList(r).length})</button><button data-a="tab:help">Rules</button><button data-a="quit">Abandon</button></div>`;
}

function screenHome() {
  const saved = store.get(SAVE);
  return `<div class="hall home"><div class="title"><small>CARDSTASHY</small><h1>LOST MEMORIES</h1><p>Test build of the real rules engine. Three floors, six chambers each, three Sparks.</p>
    <div class="row">${saved && saved.phase !== 'over' ? '<button class="gold" data-a="resume">Continue run</button>' : ''}<button class="${saved && saved.phase !== 'over' ? '' : 'gold'}" data-a="new">New run</button><button data-a="screen:codex">Codex (${G.known.size})</button><button data-a="screen:feats">Feats (${(P.featsDone || []).length}/${featList(!!labs.long).length})</button><button data-a="screen:vault">Memory Vault (${P.memories})</button><button data-a="tab:help">How to play</button></div>
    <div class="labs glass"><b>Lab rules</b> <small>experiments. Five Gifts, Leaning offers, the Heat ladder, Even kits and Tuned items start on: they are the current test baseline.${saved && saved.phase !== 'over' ? ' Your run in progress keeps the rules it started with; changes here apply to the next run.' : ''}</small><div class="labgrid">${['five', 'lean', 'heat', 'allHeat', 'kits', 'items', 'long', 'veilSet', 'styles', 'trap', 'free', 'solo', 'tombStart'].map(k => `<button class="lab ${pref[k] ? 'on' : ''}" data-a="lab:${k}"><i>${pref[k] ? 'ON' : 'OFF'}</i><span>${LABS[k]}</span></button>`).join('')}</div></div>
    <p class="fine">Not final art. Seen only in a test browser so far.</p></div></div>`;
}
function summary(deck) {
  const mons = deck.filter(e => db.isMonster(e.id)).map(e => card(e.id));
  const types = {}; mons.forEach(c => types[c.type] = (types[c.type] || 0) + 1);
  const top = Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, n]) => `${n} ${t}`).join(', ');
  return `${mons.length} monsters (${top}), average ATK ${Math.round(mons.reduce((n, c) => n + c.atk, 0) / mons.length)}, weight ${deckWeight(db, deck)}`;
}
// Simulator clear rates by Forger and kit (Heat 0, 1,500 expert-CPU runs each, 20 November). A lab note, not a rule.
const KIT_SIM_EVEN = { none: { spellcasters_fiends: 48, dragons_warriors: 44, beasts_plants: 46 }, tarn: { fire_scale: 67, dragons_warriors: 65, blades_claws: 71 }, scrapper: { stone_gears: 62, machines_thunder: 59, swarm: 65 }, veil: { lantern_choir: 48, spellcasters_fiends: 47, grave_court: 47 }, storm: { high_wind: 63, beasts_plants: 61, tide: 65 } };
const KIT_SIM = { none: { spellcasters_fiends: 48, dragons_warriors: 43, beasts_plants: 42 }, tarn: { fire_scale: 77, dragons_warriors: 63, blades_claws: 52 }, scrapper: { stone_gears: 76, machines_thunder: 60, swarm: 52 }, veil: { lantern_choir: 57, spellcasters_fiends: 47, grave_court: 35 }, storm: { high_wind: 72, beasts_plants: 59, tide: 36 } };
function screenKit() {
  const r = G.run, sim = (labs.kits ? KIT_SIM_EVEN : KIT_SIM)[r.forger || 'none'] || {};
  return `<div class="hall"><div class="panel glass wide"><h2>Pick a starter kit</h2><div class="kits">${r.offer.map((k, i) => `<div class="kit glass"><h3>${esc(k.name)}</h3><p>${summary(k.deck)}</p>${sim[k.kit] ? `<p class="fine kitsim">Lab note: the test CPU clears ${sim[k.kit]}% of runs with this kit${labs.kits ? ' (even kits on)' : ''}.</p>` : ''}<div class="mini">${k.deck.slice().sort((a, b) => cardValue(db, b) - cardValue(db, a)).slice(0, 5).map(e => face(e, { attrs: `data-a="inspect:${e.id}"` })).join('')}</div><button class="gold" data-a="kit:${i}">Take this kit</button></div>`).join('')}</div>
    ${labs.long && r.forger && nextKit(P, r.forger) ? (nk => `<p class="fine">Long road: these are the kits ${esc(FORGERS[r.forger].name)} has open, dealt three ways. ${esc(nk.name)} opens at ${nk.goal} duels won as ${esc(FORGERS[r.forger].name)} (${Math.min(nk.wins, nk.goal)}/${nk.goal}).</p>`)(nextKit(P, r.forger)) : ''}
    <div class="row">${r.redeal ? '<button data-a="redeal">Deal again (once)</button>' : '<span class="fine">Re-deal used.</span>'}</div></div></div>`;
}
function pickList(title, items, sub = '') { return `<div class="hall"><div class="panel glass wide"><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}<div class="picks">${items.join('')}</div></div></div>`; }
function screenCharm() { return pickList('Pick one charm', G.run.offer.options.map((id, i) => `<div class="pick glass">${relicRow(id)}<button class="gold" data-a="pick:${i}">Take</button></div>`), 'A charm changes a rule for the whole run.'); }

// "Guardian" means the guardian of a floor everywhere else (the Guardian Reward, Guardians beaten, the Veilwalker's feat), so the
// hard rival behind an ordinary door is shown as an Elite. The engine keeps its own word, which is part of the recorded fixtures.
const doorName = d => d.tier === 'guardian' ? d.name.replace(/^Guardian: /, 'Elite: ') : d.name;
const DOOR_ART = { duel: 'duel', cursed: 'cursed', champion: 'champion', guardian: 'guardian', anvil: 'anvil', bazaar: 'bazaar', sanctum: 'sanctum', omen: 'omen', treasure: 'treasure', boss: 'boss', mystery: 'omen' };
function screenChamber() {
  const r = G.run, boss = BOSSES[r.floor][r.bossOrder[r.floor]];
  return `<div class="hall doorsHall">${r.lastNote ? `<div class="note glass">${esc(r.lastNote)}</div>` : ''}<div class="bossline glass">Guardian of this floor: <b>${esc(boss.name)}</b>${r.chamber >= 2 ? '. ' + esc(bossLaw(db, r)) : '. Its Law shows from chamber 3.'}${db.config.heatRules && r.heat ? ` <button class="heatchip" data-a="heatinfo:${r.heat}">Heat ${r.heat} rules</button>` : ''}</div>
    <div class="doors">${r.doors.map((d, i) => { const locked = d.type === 'boss' && r.seals < 2; return `<button class="door t-${d.type}" data-a="door:${i}" ${locked ? 'disabled' : ''}><img decoding="sync" src="art/door-${DOOR_ART[d.type]}.webp" alt=""><div class="dtxt glass"><b>${esc(doorName(d))}</b><span class="k">${d.know === 'known' ? 'Known' : d.know === 'partial' ? 'Partly hidden' : 'Mysterious'}</span><span><i>Cost</i> ${esc(d.cost)}</span><span><i>Reward</i> ${esc(d.reward)}</span>${d.law ? `<span><i>Law</i> ${esc(lawShown(d.law))}</span>` : ''}${d.tell ? `<span class="tell"><i>${esc(d.style)}</i> ${esc(d.tell)}</span>` : ''}${(d.tags || []).map(t => `<em>${esc(t)}</em>`).join('')}</div></button>`; }).join('')}</div></div>`;
}

function screenDuel() {
  const live = G.run.duel, f = G.shown;
  const v = f ? f.view : live ? viewFor(live, db, 0) : null;
  if (!v) return '';
  const rv = f ? f.rival : info(G.run);
  const myTurn = !G.playing && live && !live.pending && live.active === 0;
  const pend = !G.playing && live && live.pending && live.active === 1;
  const la = myTurn ? legalActions(live, db, { maxChain: 1 }) : [];
  const canAtk = new Map(); la.filter(a => a.t === 'attack').forEach(a => { if (!canAtk.has(a.from)) canAtk.set(a.from, []); canAtk.get(a.from).push(a.to); });
  const canPos = new Set(la.filter(a => a.t === 'pos').map(a => a.zone));
  const canPlay = myTurn && !live.played && !live.attacked;
  const targets = G.attacker != null ? (canAtk.get(G.attacker) || []) : [];
  const fc = z => { const X = live.mon[0][G.attacker], T = z >= 0 ? v.mon[1][z] : null; if (z < 0) return `Direct: ${v.mon[0][G.attacker].ea} to Life Points`; if (T.veil) return '?'; const q = forecast(live, db, 0, X, 1, live.mon[1][z]); return `${q.a} v ${q.d}${q.edgeA ? ' ▲' : ''}${q.edgeD ? ' ▼' : ''}: ${q.killT ? 'destroys it' : q.killX ? 'you lose yours' : 'no kill'}${q.dmgDef ? `, ${q.dmgDef} dmg` : ''}${q.dmgAtk ? `, you take ${q.dmgAtk}` : ''}`; };
  const row = (seat) => v.mon[seat].map((m, z) => {
    let cls = 'slot', attrs = `data-zone="${seat}:${z}"`, tip = '';
    if (seat === 0 && m && myTurn) { if (canAtk.has(z)) cls += ' ready'; attrs += ` data-a="mine:${z}"`; if (G.attacker === z) cls += ' picked'; if (G.onto === z) cls += ' onto'; }
    if (seat === 1 && m && targets.includes(z)) { cls += ' target'; attrs += ` data-a="hit:${z}"`; tip = `<div class="fc">${fc(z)}</div>`; }
    else if (m) attrs += ` data-a="inspectz:${seat}:${z}"`;
    return `<div class="${cls}" ${attrs}>${m ? face(m) : ''}${tip}</div>`;
  }).join('');
  const shut = v.mon[0].length < 5 ? '<div class="slot closed"></div>' : ''; // Narrow Pass: the outer zones stay drawn, sealed, so the table never changes shape
  const traps = seat => v.traps[seat].map(t => `<div class="tslot">${t ? (seat === 0 ? face(t, { cls: 'tiny', attrs: `data-a="inspect:${t.id}"` }) : '<div class="c back tiny"><img decoding="sync" src="art/cardback.webp" alt="Set card"></div>') : ''}</div>`).join('');
  // meld tray
  let tray = '<span class="fine">Tap hand cards in order. One card plays it. Two or more meld left to right.</span>', buttons = '';
  if (canPlay && G.sel.length) {
    const cards = G.sel.map(i => live.hand[0][i]); const ontoM = G.onto != null ? live.mon[0][G.onto] : null;
    const plan = planChain(db, cards, ontoM, { tinder: v.relics.includes('tinder_vow'), steady: v.relics.includes('steady_hand') && !v.rs.steady });
    const ids = (ontoM ? [ontoM.id] : []).concat(cards.map(c => c.id));
    // the result is shown only when every step that puts two monsters together is already in the Codex
    const allKnown = plan.tried.every(t => codexKnows(db, k => G.known.has(k), t[0], t[1], t[2]));
    const vars = playVariants(live, db, 0, G.sel, G.onto);
    const chain = ids.map(id => `<span class="chip">${esc(card(id).name)}</span>`).join('<b>→</b>');
    const res = ids.length < 2 ? '' : `<b>=</b><span class="chip res">${allKnown ? esc(card(plan.final.id).name) + (plan.fizzles ? ` (${plan.fizzles} fizzle)` : '') : '? unknown meld'}</span>`;
    tray = `<div class="chain">${chain}${res}</div>` + cards.filter((c, i) => !db.isMonster(c.id) || cards.length === 1).slice(0, 3).map(c => `<div class="what"><b>${esc(card(c.id).name)}</b> ${esc(rulesText(c.id))}</div>`).join('');
    if (!vars.length) tray += '<span class="fine bad">That cannot be played right now.</span>';
    const lab = x => x.pos === 'a' ? (x.veiled ? 'Veiled attack' : 'Attack position') : x.pos === 'd' ? (x.veiled ? 'Veiled defense' : 'Defense position') : 'Play';
    buttons = vars.map(x => `<button class="gold" data-a="play:${x.pos || ''}:${x.veiled ? 1 : 0}">${lab(x)}</button>`).join('') + '<button data-a="undo">Undo</button>';
    if (G.sel.length === 1) buttons += '<button data-a="scrap">Scrap card</button>';
  } else if (G.attacker != null) {
    tray = `<span>Pick a target${targets.length ? '' : ' (none legal)'}.</span>`;
    buttons = (targets.includes(-1) ? `<button class="gold" data-a="hit:-1">Direct attack (${v.mon[0][G.attacker].ea})</button>` : '') + (canPos.has(G.attacker) ? '<button data-a="pos">Change position</button>' : '') + '<button data-a="undo">Cancel</button>';
  } else if (G.onto != null) { tray = '<span>Now tap hand cards to meld onto it.</span>'; buttons = '<button data-a="undo">Cancel</button>'; }
  const hand = [0, 1, 2, 3, 4, 5].map(i => { const c = v.hand[i]; const k = G.sel.indexOf(i); return `<div class="hs">${c ? face(c, { cls: (canPlay ? 'can ' : '') + (k >= 0 ? 'sel' : ''), attrs: `data-a="hand:${i}"`, badge: k >= 0 ? k + 1 : '' }) : ''}</div>`; }).join('');
  let powerBtn = '';
  if (myTurn && v.forger && !v.rs.power) {
    const F = FORGERS[v.forger], pa = powerActions(live, db, 0);
    const ok = F.needs === 'hand' ? G.sel.length === 1 && pa.some(p => p.hand === G.sel[0]) : F.needs === 'zone' ? G.attacker != null && pa.some(p => p.zone === G.attacker) : pa.length > 0 && !G.sel.length;
    const hint = F.needs === 'hand' ? ' (pick one hand card)' : F.needs === 'zone' ? ' (pick your monster)' : '';
    powerBtn = `<button class="pow" data-a="power:${F.needs || ''}" ${ok ? '' : 'disabled'} title="${esc(F.powerText)}">${esc(F.power)}${ok ? '' : hint}</button>`;
  }
  const terr = v.terrain ? `Terrain: <b>${esc(card(v.terrain.id).name)}</b>${v.terrain.temp != null ? ` (holds ${v.terrain.temp} more of your turns)` : ''}${v.terrain.lock ? ' (locked)' : ''}` : 'No terrain';
  const pv = pend ? viewFor(live, db, 0) : null, pX = pend ? pv.mon[1][live.pending.from] : null, pT = pend && live.pending.to >= 0 ? pv.mon[0][live.pending.to] : null;
  // The prompt covers the table, so it names the attacker, its target and both numbers.
  const prompt = pend ? `<div class="modal"><div class="glass panel"><h3>${pX && !pX.veil ? esc(card(pX.id).name) + ' (' + pX.ea + ' ATK)' : 'A veiled monster'} attacks ${pT ? esc(card(pT.id).name) + ' (' + (pT.pos === 'd' ? pT.ed + ' DEF' : pT.ea + ' ATK') + (pT.veil ? ', veiled' : '') + ')' : 'you directly'}</h3><p>Spring a Trap?</p><div class="picks">${live.pending.options.map(i => `<div class="pick glass">${face(live.traps[0][i], { cls: 'tiny' })}<div><b>${esc(card(live.traps[0][i].id).name)}</b><br>${esc(rulesText(live.traps[0][i].id))}</div><button class="gold" data-a="respond:${i}">Spring it</button></div>`).join('')}</div><div class="row"><button data-a="respond:-1">Let the attack through</button></div></div></div>` : '';
  return `<div class="duel ${v.twist || ''}"><div class="side top"><div class="who glass"><b id="rivalLp" class="lp">${v.lp[1]}</b><span>${esc(rv.name)}</span><small>Hand ${v.rivalHand} · Deck ${v.deckCount[1]}</small></div>
      <div class="rules glass"><b>This duel</b>${rv.styleText ? `<span class="rstyle">${esc(rv.styleText)}</span>` : ''}${rv.lawText ? `<span>${esc(lawShown(rv.lawText))}</span>` : ''}${rv.twist ? `<span>${{ fog: 'Fog: monsters arrive veiled.', narrow: 'Narrow Pass: three zones.', storm: 'Storm Front: terrain shifts every third turn.', locked: 'Locked terrain.' }[rv.twist]}</span>` : ''}<span>Bounty: ${esc(rv.bountyText || '')}</span>${v.forger ? `<span class="frule"><b>${esc(FORGERS[v.forger].name)}</b> ${esc(ruleText(FORGERS[v.forger].rule))} <br><b>${esc(FORGERS[v.forger].power)}</b> ${v.rs.power ? 'used this duel.' : esc(FORGERS[v.forger].powerText.replace(/^Once a duel, before you play: /, 'once a duel, before you play: '))}</span>` : ''}</div></div>
    <div class="board"><div class="trow">${traps(1)}</div><div class="mrow">${shut}${row(1)}${shut}</div><div id="terrain" class="terrain">${terr}</div><div class="mrow">${shut}${row(0)}${shut}</div><div class="trow">${traps(0)}</div><div id="relicFlash" class="relicFlash"></div><div id="rivalFlash" class="relicFlash rivalf"></div></div>
    <div class="side bot"><div class="who glass"><b id="myLp" class="lp">${v.lp[0]}</b><span>You</span><small>Deck ${v.deckCount[0]} · Turn ${v.turn}</small></div>
      <div class="logbox glass">${G.log.slice(-5).map(esc).join('<br>')}</div></div>
    <div class="tray"><div class="hand">${hand}</div><div class="actions glass"><div class="trayline">${G.playing ? '<span>…</span>' : myTurn ? tray : pend ? '<span>Answer the attack.</span>' : '<span>Rival is thinking.</span>'}</div><div class="row">${buttons}${myTurn && !G.sel.length && G.attacker == null ? `<button class="gold" data-a="end">${v.turn === 1 || (!canAtk.size) ? 'End turn' : 'End turn'}</button>` : ''}${v.relics.includes('clean_draw') && !v.rs.cleanDraw && canPlay && G.sel.length === 1 ? '<button data-a="clean">Clean Draw this card</button>' : ''}${powerBtn}<button data-a="speed">${G.fast ? 'Speed: fast' : 'Speed: normal'}</button></div></div></div>${prompt}</div>`;
}

function screenReward() {
  const r = G.run, o = r.offer;
  if (o.kind === 'card') return pickList('Pick a card', o.options.map((e, i) => `<div class="pick glass">${face(e, { attrs: `data-a="inspect:${e.id}"` })}<div>${esc(rulesText(e.id))}<br><small>Weight ${weightOf(db, e.id)}</small></div><button class="gold" data-a="pick:${i}">Take</button></div>`).concat('<div class="row"><button data-a="skip">Take nothing</button></div>'), 'It goes to your trunk. Swap it into the deck from the Deck button.');
  if (o.kind === 'gift') {
    const held = new Set(relicList(r).map(id => RELICS[id].family).filter(f => BUILD_FAMILIES.includes(f)));
    const tag = id => (o.fresh === id ? `<br><em class="newtag">NEW</em> You unlocked this with ${esc((featList(true).find(f => f.gift === id) || {}).name || 'a feat')}.` : '') + (held.has(RELICS[id].family) ? `<br><em class="fits">Fits your ${esc(FAMILY_NAME[RELICS[id].family])} pieces</em>` : '');
    return pickList('Forge Level up: pick a Gift', o.options.map((id, i) => `<div class="pick glass ${o.fresh === id ? 'fresh' : ''}">${relicRow(id, tag(id))}<button class="gold" data-a="pick:${i}">Take</button></div>`).concat(r.rerolls ? `<div class="row"><button data-a="reroll">Deal these three again (${r.rerolls} left this run)</button></div>` : ''), 'A Gift lasts the whole run. ' + (held.size ? 'You hold ' + [...held].map(f => FAMILY_NAME[f]).join(' and ') + ' pieces.' : 'Your first build piece decides what the forge leans toward.'));
  }
  if (o.kind === 'charm') return pickList('Pick a charm', o.options.map((id, i) => `<div class="pick glass">${relicRow(id)}<button class="gold" data-a="pick:${i}">Take</button></div>`).concat('<div class="row"><button data-a="skip">Take nothing</button></div>'), `Charm slots ${r.charms.length}/${db.config.charmSlots}.`);
  if (o.kind === 'guardian') return pickList('Guardian Reward', o.options.map((g, i) => `<div class="pick glass">${g.kind === 'card' ? face(g.entry) : g.kind === 'masterwork' ? relicRow(g.id) : '<div class="col">' + g.ids.map(id => relicRow(id)).join('') + '</div>'}<div><b>${esc(g.text)}</b></div><button class="gold" data-a="pick:${i}">Choose</button></div>`), 'One of three kinds of power. The weight cap rises by 20.');
  if (o.kind === 'treasure') return pickList('Treasure', o.options.map((g, i) => `<div class="pick glass">${g.kind === 'card' ? face(g.entry) : relicRow(g.id)}<button class="gold" data-a="pick:${i}">Take</button></div>`));
  if (o.kind === 'sanctum') return pickList('Sanctum', [`<div class="pick glass"><div><b>Take back one Spark</b><br>${r.sparks >= db.config.sparks ? 'Your Sparks are full.' : ''}</div><button class="gold" data-a="pick:0" ${r.sparks >= db.config.sparks ? 'disabled' : ''}>Take</button></div>`, `<div class="pick glass"><div><b>Raise your weight cap by 5</b></div><button class="gold" data-a="pick:1">Take</button></div>`]);
  if (o.kind === 'omen') return pickList('Omen', [`<div class="pick glass">${o.seen ? face(o.card) : '<div class="c back"><img decoding="sync" src="art/cardback.webp" alt=""></div>'}<div>${esc(o.text)}<br><small>Trunk cards: ${r.trunk.length}. Your two weakest trunk cards are taken.</small></div><div class="col"><button class="gold" data-a="pick:0" ${r.trunk.length < 2 ? 'disabled' : ''}>Give two trunk cards</button><button data-a="pick:1" ${o.seen || r.embers < 30 ? 'disabled' : ''}>Pay 30 Embers to see it</button><button data-a="skip">Leave</button></div></div>`]);
  return '';
}
function deckList(list, key, picked) { return list.map((e, i) => [e, i]).sort((a, b) => cardValue(db, b[0]) - cardValue(db, a[0])).map(([e, i]) => face(e, { cls: 'small ' + (picked === i ? 'sel' : ''), attrs: `data-a="${key}:${i}"` })).join(''); }
function screenAnvil() {
  const r = G.run, o = r.offer, P = db.config.prices, e = G.pickDeck != null ? r.deck[G.pickDeck] : null, e2 = G.pickTrunk != null ? r.deck[G.pickTrunk] : null;
  return `<div class="hall"><div class="panel glass wide"><h2>Anvil</h2><p>One working, then you move on. Tap a deck card (tap a second for a Bind).</p>
    <div class="row">${o.masterworks.map(id => `<button class="gold" data-a="mw:${id}" ${r.embers < P.masterwork ? 'disabled' : ''}>Forge ${esc(RELICS[id].name)} (${P.masterwork})</button>`).join('')}
      <button data-a="temper" ${!e || !db.isMonster(e.id) || e.t || r.embers < P.temper ? 'disabled' : ''}>Temper +300 (${P.temper})</button>
      ${o.enchants.map(x => `<button data-a="enchant:${x}" ${!e || !db.isMonster(e.id) || e.e || r.embers < P.enchant ? 'disabled' : ''} title="${esc(ENCHANT_TEXT[x])}">Enchant: ${cap(x)} (${P.enchant})</button>`).join('')}
      <button data-a="bind" ${!e || !e2 || r.embers < P.bind ? 'disabled' : ''}>Bind the two (${P.bind})</button><button data-a="leave">Leave</button></div>
    <div class="ench">${o.enchants.map(x => `<span><b>${cap(x)}:</b> ${esc(ENCHANT_TEXT[x])}</span>`).join('')}</div>
    <div class="grid">${r.deck.map((c, i) => [c, i]).sort((a, b) => cardValue(db, b[0]) - cardValue(db, a[0])).map(([c, i]) => face(c, { cls: 'small ' + (G.pickDeck === i ? 'sel' : G.pickTrunk === i ? 'sel2' : ''), attrs: `data-a="anvilpick:${i}"` })).join('')}</div></div></div>`;
}
function screenBazaar() {
  const r = G.run, o = r.offer;
  return `<div class="hall"><div class="panel glass wide"><h2>Bazaar</h2><p>You have ${r.embers} Embers.</p><div class="picks">${o.items.map((it, i) => `<div class="pick glass ${it.sold ? 'sold' : ''}">${it.kind === 'card' ? (it.sealed ? '<div class="c back"><img decoding="sync" src="art/cardback.webp" alt=""></div>' : face(it.entry, { attrs: `data-a="inspect:${it.entry.id}"` })) : it.kind === 'charm' ? relicRow(it.id) : '<div><b>The Scrapper</b><br>Removes one trunk card. Tap a trunk card below first.</div>'}<button class="gold" data-a="buy:${i}" ${it.sold || r.embers < it.price || (it.kind === 'charm' && r.charms.length >= db.config.charmSlots) || (it.kind === 'scrap' && G.pickTrunk == null) ? 'disabled' : ''}>${it.sold ? 'Sold' : it.kind === 'charm' && r.charms.length >= db.config.charmSlots ? 'Charm slots full' : it.price + ' Embers'}</button></div>`).join('')}</div>
    ${o.merchant === 'scrapper' ? `<div class="grid">${deckList(r.trunk, 'trunkpick', G.pickTrunk)}</div>` : ''}<div class="row"><button data-a="leave">Leave</button></div></div></div>`;
}
function screenOver() {
  const r = G.run, S = r.stats, R = G.results;
  return `<div class="hall"><div class="panel glass wide scroll"><h2>${r.result.won ? 'The pyramid is cleared' : `The run ends · Floor ${r.floor + 1}, Chamber ${Math.min(6, r.chamber + 1)}`}</h2>
    ${R ? R.unlocks.filter(u => u.kind !== 'heat' || u.id <= heatTop()).map(u => u.kind === 'heat' && labs.heat ? { ...u, name: `Heat ${u.id}, ${HEAT_RULES[u.id - 1].name}`, text: HEAT_RULES[u.id - 1].text + ' It pays more Memories.' } : u).map(u => u.kind === 'gift' ? `<div class="unlock glass gift">${relicImg(u.id)}<div><b>New Gift unlocked: ${esc(u.name)}</b> <small>${esc(u.feat)} complete</small><br>${esc(RELICS[u.id].text)}<br><i>${esc(u.why)} It will be in the first Gift offer of your next run.</i></div></div>` : `<div class="unlock glass"><div><b>${u.kind === 'record' ? 'New record' : 'Unlocked'}: ${esc(u.name)}</b><br>${esc(u.text)}</div></div>`).join('') : ''}
    <div class="cols"><div class="box glass"><h3>This run</h3><table class="tally"><tr><td>Forger</td><td>${esc(r.forger ? FORGERS[r.forger].name : 'None')}</td></tr><tr><td>Duels won</td><td>${S.wins} of ${S.duels}</td></tr><tr><td>Guardians beaten</td><td>${S.bossWins}</td></tr><tr><td>Melds</td><td>${S.melds}</td></tr><tr><td>Ranks</td><td>${Object.entries(S.ranks).map(([k, v]) => k + '×' + v).join(' ') || 'None'}</td></tr></table></div>
    <div class="box glass"><h3>Memories earned</h3>${R ? `<table class="tally">${R.lines.map(l => `<tr><td>${esc(l[0])}</td><td>+${l[1]}</td></tr>`).join('')}</table><div class="bigm">+${R.total} Memories</div>` : '<p class="fine">Already banked.</p>'}</div></div>
    ${R && R.feats.length ? `<div class="box glass featbox"><h3>Feats</h3>${R.feats.map(featRow).join('')}<p class="fine">Feats count across runs, win or lose.</p></div>` : ''}
    <div class="row"><button class="gold" data-a="new">New run</button><button data-a="screen:codex">Codex</button><button data-a="screen:feats">Feats</button><button data-a="screen:vault">Memory Vault (${P.memories})</button><button data-a="home">Home</button></div></div></div>`;
}
const featRow = f => `<div class="feat ${f.done ? 'done' : ''}"><div><b>${esc(f.name)}</b> <small>${esc(f.build)}</small><br>${esc(f.text)}</div><div class="bar"><i style="width:${Math.round(100 * f.after / f.goal)}%"></i><u style="left:${Math.round(100 * f.before / f.goal)}%;width:${Math.round(100 * (f.after - f.before) / f.goal)}%"></u></div><span>${f.done ? 'Complete' : f.after + ' / ' + f.goal}${f.gain && !f.done ? ' (+' + f.gain + ')' : ''}</span></div>`;
const kitRows = () => FORGER_IDS.filter(id => P.forgers.includes(id)).map(id => FORGERS[id].kits.map((k, i) => { const w = forgerStats(P, id).wins, g = KIT_GOALS[i], n = Math.min(w, g), done = w >= g; return i ? `<div class="feat ${done ? 'done' : ''}"><div><b>${esc(k.name)}</b> <small>${esc(FORGERS[id].name)}</small><br>Win ${g} duels as ${esc(FORGERS[id].name)}.</div><div class="bar"><i style="width:${Math.round(100 * n / g)}%"></i></div><span>${done ? 'Open' : n + ' / ' + g}</span></div>` : ''; }).join('')).join('');
function screenFeats() {
  const rows = featList(!!labs.long).map(f => { const done = (P.featsDone || []).includes(f.id), n = done ? f.goal : (P.feats || {})[f.id] || 0; return featRow({ ...f, before: n, after: n, gain: 0, done }) + `<div class="featgift ${done ? '' : 'lockedg'}">${relicImg(f.gift)}<div><b>${esc(RELICS[f.gift].name)}</b> <small>${done ? 'Unlocked Gift' : 'Gift, locked'}</small><br>${esc(RELICS[f.gift].text)}</div></div>`; }).join('');
  const forg = FORGER_IDS.filter(id => id !== 'tarn').map(id => `<div class="feat ${P.forgers.includes(id) ? 'done' : ''}"><div><b>${esc(FORGERS[id].name)}</b> <small>Forger</small><br>${esc(FORGER_FEATS[id].text)}</div><span>${P.forgers.includes(id) ? 'Unlocked' : 'Locked'}</span></div>`).join('');
  return `<div class="hall"><div class="panel glass wide scroll"><h2>Feats</h2><p>Each feat follows a way of playing and adds one Gift to what the forge can offer. Progress counts across runs, win or lose.</p>${rows}<h3 style="margin-top:1em">Forgers</h3>${forg}${labs.long ? `<h3 style="margin-top:1em">Starter kits</h3>${kitRows()}` : ''}<div class="row"><button class="gold" data-a="home">Back</button></div></div></div>`;
}
function tabPanel() {
  const r = G.run;
  if (G.tab === 'help') return `<div class="modal"><div class="glass panel wide"><h2>How a duel works</h2><ul><li>Each turn: draw toward five cards (two a turn at most), play one card or one meld, then attack.</li><li>Meld: tap two or more hand cards in order. They combine left to right into one monster. Tap one of your table monsters first to meld onto it.</li><li>Attack position fights with ATK. Defense uses DEF and protects your Life Points. Veiled is face down in defense.</li><li>WATER beats FIRE beats WIND beats EARTH beats WATER. LIGHT and DARK beat each other when attacking. The edge is +500 for that battle.</li><li>Field Spells set the terrain (+500 for its Types). Equips give +500. Traps wait face down for an attack. Other cards are fuel: +300 in a meld.</li><li>Play comes before attacks. A monster that attacked or just arrived cannot change position.</li><li>Lose a duel and you lose a Spark. The boss door needs two seals, one from each duel you win on the floor.</li></ul><div class="row"><button class="gold" data-a="tab:">Close</button></div></div></div>`;
  if (!r) return '';
  if (G.tab === 'relics') return `<div class="modal"><div class="glass panel wide"><h2>Your relics</h2>${relicList(r).map(id => relicRow(id)).join('') || '<p>None yet.</p>'}${possibleMasterworks(r).map(id => `<p class="fine">Masterwork ready at an Anvil: ${esc(RELICS[id].name)}.</p>`).join('')}<div class="row"><button class="gold" data-a="tab:">Close</button></div></div></div>`;
  if (G.tab === 'deck') return `<div class="modal"><div class="glass panel wide"><h2>Deck ${r.deck.length} cards · weight ${deckWeight(db, r.deck)}/${weightCap(db, r)}</h2><p>${r.phase === 'chamber' ? 'Tap a deck card, then a trunk card, to swap them.' : 'You can swap cards between duels, in a chamber.'}</p><div class="grid">${deckList(r.deck, 'deckpick', G.pickDeck)}</div><h3>Trunk ${r.trunk.length}</h3><div class="grid">${deckList(r.trunk, 'trunkpick', G.pickTrunk) || '<span class="fine">Empty.</span>'}</div><div class="row"><button class="gold" data-a="tab:">Close</button></div></div></div>`;
  return '';
}
function overlay() {
  const o = G.overlay; if (!o || G.playing) return '';
  if (o.kind === 'duelEnd') { const s = o.sum; return `<div class="modal"><div class="glass panel"><h2>${s.won ? 'Victory' : 'Defeat'}</h2><p>${esc(o.rival ? o.rival.name : '')} · ${s.turns} turns${s.reason === 'deckout' ? ' · a deck ran out' : ''}</p>${s.won ? `<div class="rankbig">${s.rank.rank}</div><table>${s.rank.lines.filter(l => l[1]).map(l => `<tr><td>${esc(l[0])}</td><td>${l[1] > 0 ? '+' : ''}${l[1]}</td></tr>`).join('')}<tr><td><b>Total</b></td><td><b>${s.rank.points}</b></td></tr></table><p>Style: ${s.rank.style === 'craft' ? 'Craft' : 'Fury'} · Embers +${s.embers}${s.bountyMet ? ' · Bounty met' : ''}</p>` : `<p>You lose a Spark. ${G.run.sparks} left.</p>`}<div class="row"><button class="gold" data-a="closeov">Continue</button></div></div></div>`; }
  if (o.kind === 'heat') return `<div class="modal"><div class="glass panel"><h2>Heat ${o.n}</h2><p>Every rule below is in force on this descent.</p><div class="heatlist">${HEAT_RULES.filter(x => x.n <= o.n).map(x => `<div><i>${x.n}</i><span><b>${esc(x.name)}.</b> ${esc(x.text)}</span></div>`).join('')}</div><div class="row"><button class="gold" data-a="closeov">Close</button></div></div></div>`;
  return '';
}
function inspectPanel() {
  if (!G.inspect) return '';
  const c = card(G.inspect.id);
  return `<div class="modal" data-a="closeinspect"><div class="glass panel insp">${face(G.inspect, { cls: 'big' })}<div><h3>${esc(c.name)}</h3>${db.isMonster(c.id) ? `<p>${esc(c.type)} · ${esc(c.attr)} · Level ${c.level}<br>ATK ${c.atk} · DEF ${c.def}${G.inspect.ea != null ? `<br>Now ${G.inspect.ea} / ${G.inspect.ed}` : ''}</p>` : ''}<p>${esc(rulesText(c.id))}</p>${G.inspect.e ? `<p><b>Enchant, ${cap(G.inspect.e)}:</b> ${esc(ENCHANT_TEXT[G.inspect.e])}</p>` : ''}<p class="fine">Weight ${weightOf(db, c.id)}. Tap anywhere to close.</p></div></div></div>`;
}

function render() {
  const r = G.run; let body;
  if (G.screen) body = { forger: screenForger, vault: screenVault, codex: screenCodex, feats: screenFeats }[G.screen]();
  else if (!r) body = screenHome();
  else if (G.shown || r.phase === 'duel') body = screenDuel();
  else body = { kit: screenKit, charm: screenCharm, chamber: screenChamber, reward: screenReward, anvil: screenAnvil, bazaar: screenBazaar, over: screenOver }[r.phase]();
  app.innerHTML = `${G.screen || G.shown || (r && (r.phase === 'duel' || r.phase === 'over')) ? '' : hud()}${body}${tabPanel()}${overlay()}${inspectPanel()}${storyPanel()}<div id="toast" class="toast">${esc(G.toast)}</div>`;
  app.dataset.phase = r ? (G.shown ? 'duel' : r.phase) : 'home';
}

// ---------- input ----------
app.addEventListener('click', ev => {
  const el = ev.target.closest('[data-a]'); if (!el || el.disabled) return;
  const [verb, x, y] = el.dataset.a.split(':'); const r = G.run, n = x === undefined || x === '' ? null : +x;
  const duel = a => act({ t: 'duel', action: a });
  switch (verb) {
    case 'new': G.screen = 'forger'; if (!P.forgers.includes(G.pickForger)) G.pickForger = 'tarn'; G.pickHeat = Math.min(G.pickHeat, heatOpen()); render(); break;
    case 'home': G.screen = null; if (r && r.phase === 'over') { G.run = null; G.results = null; setLabs(pref); } render(); break;
    case 'screen': G.screen = x; render(); break;
    case 'lab': pref = { ...pref, [x]: !pref[x] }; store.set(LABKEY, pref); setLabs(pref); render(); break;
    case 'forger': G.pickForger = x; G.pickHeat = Math.min(G.pickHeat, heatOpen()); render(); break;
    case 'heat': G.pickHeat = n; render(); break;
    case 'descend': store.del(SAVE); setLabs(pref); store.set(RUNLABS, pref); G.screen = null; G.results = null; G.run = newRun(db, { seed: (Date.now() % 2147483647) + Math.floor(Math.random() * 1e6), heat: G.pickHeat, forger: G.pickForger, ...runOptions(P, G.pickForger, !!labs.long) }); G.log = []; G.overlay = null; queueStory('intro'); render(); break;
    case 'vbuy': try { const b = buy(P, y ? x + ':' + y : x); saveP(); toast(b.name + (y ? ' can now be offered at an Anvil.' : ' can now appear in your runs.')); } catch (e) { toast(e.message); } render(); break;
    case 'storynext': { const st = G.story; if (!st) break; if (++st.i >= SCENES[st.id].lines.length) { G.story = null; if (st.then) { st.then(); break; } } render(); break; }
    case 'storyskip': { const st = G.story; G.story = null; if (st && st.then) { st.then(); break; } render(); break; }
    case 'power': { const a = { t: 'power' }; if (x === 'hand') a.hand = G.sel[0]; if (x === 'zone') a.zone = G.attacker; duel(a); break; }
    case 'resume': setLabs(store.get(RUNLABS) || pref); G.run = store.get(SAVE); if (G.run && G.run.codex) G.run.codex = codexUpgrade(db, G.run.codex); render(); break;
    case 'quit': if (el.dataset.sure) { store.del(SAVE); G.run = null; setLabs(pref); render(); } else { el.dataset.sure = 1; el.textContent = 'Tap again to abandon'; } break;
    case 'kit': act({ t: 'kit', i: n }); break;
    case 'redeal': act({ t: 'redeal' }); break;
    case 'pick': act({ t: 'pick', i: n }); break;
    case 'skip': act({ t: 'skip' }); break;
    case 'reroll': act({ t: 'reroll' }); break;
    case 'cxview': G.cx.view = x; G.cx.type = null; render(); break;
    case 'cxtype': G.cx.type = G.cx.type === x ? null : x; render(); break;
    case 'cxopen': G.cx.open = n; render(); break;
    case 'cxclose': G.cx.open = null; render(); break;
    case 'door': { G.log = []; const d = r.doors[n]; const go = () => act({ t: 'door', i: n }); if (d && d.type === 'boss' && r.seals >= 2) { queueStory('boss:' + BOSSES[r.floor][r.bossOrder[r.floor]].id, go); if (G.story) render(); } else go(); break; }
    case 'leave': G.pickDeck = G.pickTrunk = null; act({ t: 'leave' }); break;
    case 'tab': G.tab = x || null; G.pickDeck = G.pickTrunk = null; render(); break;
    case 'deckpick': G.pickDeck = n; trySwap(); break;
    case 'trunkpick': G.pickTrunk = n; trySwap(); break;
    case 'anvilpick': if (G.pickDeck == null || G.pickDeck === n) G.pickDeck = G.pickDeck === n ? null : n; else G.pickTrunk = G.pickTrunk === n ? null : n; render(); break;
    case 'temper': { const d = G.pickDeck; G.pickDeck = G.pickTrunk = null; act({ t: 'anvil', kind: 'temper', deck: d }); break; }
    case 'enchant': { const d = G.pickDeck; G.pickDeck = G.pickTrunk = null; act({ t: 'anvil', kind: 'enchant', deck: d, enchant: x }); break; }
    case 'bind': { const a = G.pickDeck, b = G.pickTrunk; G.pickDeck = G.pickTrunk = null; act({ t: 'anvil', kind: 'bind', a, b }); break; }
    case 'mw': act({ t: 'anvil', kind: 'masterwork', id: x }); break;
    case 'buy': { const t = G.pickTrunk; G.pickTrunk = null; act({ t: 'buy', i: n, trunk: t ?? 0 }); break; }
    case 'inspect': G.inspect = { id: n }; render(); break;
    case 'inspectz': { const v = viewFor(r.duel, db, 0); const m = v.mon[n][+y]; if (m && m.id) { G.inspect = m; render(); } break; }
    case 'closeinspect': G.inspect = null; render(); break;
    case 'closeov': G.overlay = null; render(); break;
    case 'heatinfo': G.overlay = { kind: 'heat', n }; render(); break;
    case 'speed': G.fast = !G.fast; render(); break;
    // duel
    case 'hand': { if (G.playing || !r.duel || r.duel.active !== 0 || r.duel.pending) break; if (r.duel.played || r.duel.attacked) { G.inspect = r.duel.hand[0][n]; render(); break; } G.attacker = null; const k = G.sel.indexOf(n); if (k >= 0) G.sel.splice(k, 1); else G.sel.push(n); render(); break; }
    case 'mine': { if (G.sel.length) { toast('Finish or undo your card pick first.'); break; } if (G.attacker === n) { G.attacker = null; G.onto = n; } else if (G.onto === n) { G.onto = null; G.inspect = viewFor(r.duel, db, 0).mon[0][n]; } else { G.attacker = n; G.onto = null; } render(); break; }
    case 'hit': duel({ t: 'attack', from: G.attacker, to: n }); break;
    case 'pos': duel({ t: 'pos', zone: G.attacker }); break;
    case 'undo': G.sel = []; G.attacker = null; G.onto = null; render(); break;
    case 'play': { const a = { t: 'play', hand: G.sel.slice(), onto: G.onto }; if (x) a.pos = x; if (y === '1') a.veiled = true; duel(a); break; }
    case 'scrap': duel({ t: 'discard', hand: G.sel[0] }); break;
    case 'clean': duel({ t: 'cleanDraw', hand: G.sel[0] }); break;
    case 'end': duel({ t: 'end' }); break;
    case 'respond': duel({ t: 'respond', trap: n }); break;
  }
});
function trySwap() {
  const r = G.run;
  if (r.phase === 'chamber' && G.pickDeck != null && G.pickTrunk != null) { const a = { t: 'swap', deck: G.pickDeck, trunk: G.pickTrunk }; G.pickDeck = G.pickTrunk = null; act(a); G.tab = 'deck'; render(); }
  else render();
}
for (const f of D.art || []) { const im = new Image(); im.src = 'art/' + f + '.webp'; (window.__keep = window.__keep || []).push(im); } // keep pictures warm so a redraw never flashes
for (let i = 0; D.sheets && i < Math.ceil(D.pool.cards.length / 100); i++) { const im = new Image(); im.src = D.sheets + i + '.webp'; window.__keep.push(im); }
window.LM = { G, db, act, render }; // for tests
render();
