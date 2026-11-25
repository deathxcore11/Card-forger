// Lost Memories playable test page (codename crucible). Runs the real engine in the browser.
// The duel is drawn only from viewFor(seat 0), so this page cannot show hidden cards.
import { buildDb, roleOf, weightOf, meldPairRaw } from '../engine/cards.mjs';
import { legalActions, playVariants, planChain, viewFor, forecast } from '../engine/duel.mjs';
import { RELICS as BASE_RELICS, LAB, TUNED_TEXT, relicText, relicLinks } from '../engine/relics.mjs';
const RELICS = { ...BASE_RELICS, ...LAB }; // the page's own copy: an item's words follow the rules in force (see setLabs)
import { newRun, MIN_DECK, deckWeight, weightCap, relicList, possibleMasterworks, cardValue, BOSSES, BUILD_FAMILIES, HEAT_RULES, bossLaw, ENCHANT_TEXT, carries, THEMES, TWISTS } from '../engine/run.mjs';
import { codexResult, codexKnows, codexUpgrade } from '../engine/cards.mjs';
import { powerActions } from '../engine/duel.mjs';
import { FORGERS, FORGER_IDS, HIDDEN_FORGERS } from '../engine/forgers.mjs';
import { newProfile, applyRun, scoreRun, buy, maxHeat, VAULT, FORGER_FEATS, featList, runOptions, openKits, nextKit, forgerStats, VAULT_ENCHANTS, KIT_GOALS, START_ENCHANTS } from '../engine/meta.mjs';
import { SCENES, RUMOURS } from './story.mjs';
import { LAB_DEFAULTS, LAB_ORDER, DEPTH_SET, labConfig } from './labs.mjs';
import { aimFor } from './aim.mjs';
import { F, F2, fitConsole, fitDual, yb, xr, cx0, cy0, viewSize, ledgeW, pq, pqW, labelW, lb, lbr, box, gauge, frame, win, carveImg, carve, fogSprite } from './ps.mjs';
import * as R3 from './raster.mjs';
import { kc, foot, rowsOf, plaques, navItems, navKeys, navStep, padLoop, KEYS } from './dual.mjs';
import { pixelText } from './pxtext.mjs';
import { achRunApply, achCheck, achView, achProgress, ACH_BY_ID, ACH_GROUPS } from '../engine/achievements.mjs';
import * as AC from './ach.mjs';
import { shortText as shortTextOf, rulesText as rulesTextOf } from './text.mjs';
import './sound.mjs';
import { runFault, okProfile } from './saves.mjs'; // sets window.LMAudio; the cue() hook below is all the page knows about sound
import { lessonFor, learnFrom, lessonText, learnedAll, newNote, noteFrames, whyLost, lawAnswer } from './coach.mjs';

const D = window.CRUCIBLE_DATA;
const db = buildDb(D.pool, D.tags, D.config);
// Lab rules: experiments under test. Off unless switched on at the home screen.
const LABS = {
  free: 'Free cast: your first Spell, Field or Trap played alone each turn does not use your play. Rivals get it too.',
  solo: 'Lone arrivals: a Zombie, Fairy, Machine or Spellcaster played alone and face up uses an arrival ability.',
  five: 'Five Gifts a run (the current test baseline): Forge Gifts come half as often, new Gifts for Storm, Tomb, Ambush and Furnace join the pool, rivals on floors two and three are turned down to match, the final bosses are eased, and the Kiln Warden is turned down to match the Stone Sentinel.',
  early: 'Early first Gift: your first Forge Gift comes after your first duel won, not your third or fourth. The later Gifts stay where they were. In testing this did not help a weak CPU player past the first guardian and gave a strong one about three points.',
  styles: 'Rivals with a style: from the second floor each rival carries a relic of the kind you can earn, shows a tell on its door, and plays toward it. Harder.',
  trap: 'Free Trap: setting your first Trap each turn does not use your play, and every starter kit holds at least two Traps. Floor guardians get the free set too. (Free cast and Support turn override the free set.)',
  depth: 'Depth set: one switch for the three strategy pieces, measured together. It turns on Equips that differ, Two builds a run and Free Trap. In testing a player with no plan clears about as often as without it, and a player who commits to one build clears about six points more often.',
  lean: 'Leaning offers: one of the three Gifts leans toward a build you already hold a piece of, and you may deal one Gift offer again each run.',
  heat: 'Heat ladder: ten Heat levels. Each level adds one written rule you can read before you descend, and rivals no longer just get bigger numbers.',
  allHeat: 'Open every Heat level now. For testing only: normally each level opens when you clear the one below.',
  kits: 'Even kits: weak starter kits may hold stronger monsters and strong kits weaker ones, so the three kits of a Forger play about the same. Off, kits differ a lot, and the kit screen shows by how much.',
  items: 'Tuned items: Storm pieces ask for a meld of four cards, not three, Copper Loop and Patient Coil give less, and Grave Ward works once a duel. Off, those three items decide most runs on their own in testing.',
  veilSet: 'Veilwalker, wider rule: once a turn, while she holds no veiled monster, she may also set one monster veiled in defense without using her play. In testing her current rule is worth nothing; this one is strong with Ambush Gifts.',
  long: 'Long road: more to earn. Each Forger starts with one starter kit and opens the other two by winning duels, each Forger keeps a record of the highest Heat they have cleared (Heat itself stays shared), six of the twelve Enchants are bought in the Memory Vault, and three more feats each unlock a Gift. Nothing here makes a start stronger.',
  links: 'Linked relics: seven new Gifts that join two builds, so one relic can set off another (a battle win becomes a Tomb mark, a relic heal becomes rival damage, a lone monster makes your next meld count as one card longer). A link that needs a partner is only offered once you hold one, and with two pieces of a build held, two of the three Gifts lean toward it.',
  lone: 'Support turn: once a turn, a Spell, Trap, Field or Equip played on its own does not use your play, but you may not meld that turn. You still play one card on its own. Floor guardians get it too. (Free cast overrides this.)',
  builds: 'Two builds a run: each descent carries the Gifts of two of the four builds (Storm, Tomb, Ambush, Furnace), named on the kit screen and on every Gift offer. Gifts of the other two are not offered that run, so the pieces of one build meet more often. Lean Deck and plain Gifts are in every run, and the Veilwalker always carries Ambush. Still five Gifts a run.',
  equips: 'Equips that differ: an Equip made for one Type or Attribute gives +800 ATK and DEF to a monster of that kind and only +300 to any other, judged at the moment it is attached, in a meld too. Blades give +800 ATK and no DEF, armour gives +1000 DEF and no ATK, and the rest stay at +500. Each card says which it is. Off, all 66 Equips give +500.',
  odd: 'Odd Gift at the Bazaar: every Bazaar also sells one Gift from a build this descent does not carry (or, without Two builds a run, a build you hold nothing of), for 70 Embers. It is marked as such and is a Gift beyond your five. Not played by a person yet.',
  secret: 'Rumours (the first secret): a guardian leaves a memory behind when it falls, the Codex keeps them, and something is hidden for a player who works out what they mean. Not played by a person yet.',
  era: 'Era look (a preview of the studio direction, not a rule): the game drawn as a 1998 console release, with fog that hides what you do not know, film grain, old gold and rust, paper door labels, relics on cloth and letterboxed scenes. Nothing about play changes, and it applies at once, even to a run in progress.',
  table: 'New table look (a preview, not a rule): the duel table is drawn as a tilted stone board with life bars, the rival\'s hand shown as card backs and your Forger\'s face. Nothing about play changes, and it applies at once, even to a run in progress.',
  tombStart: 'Start with the Tomb set: carry all three Tomb relics from the first duel. A strong demonstration, not a fair run.',
};
let labs = {}; // the rules in force now
let pref = {}; // what the home switches say. A run in progress keeps the set it started with, so its rules never change part-way.
function setLabs(v) { labs = v || {}; Object.assign(db.config, labConfig(labs)); for (const id of Object.keys(TUNED_TEXT)) RELICS[id] = { ...(BASE_RELICS[id] || LAB[id]), text: relicText(db, id) }; }
const $ = s => document.querySelector(s);
const app = $('#app');
const labKeys = () => LAB_ORDER.filter(k => LABS[k]).concat(Object.keys(LABS).filter(k => !LAB_ORDER.includes(k)));
const LABKEY = 'lostmemories.labs.v5', RUNLABS = 'lostmemories.runlabs.v1', SAVE = 'lostmemories.run.v1', REV = 'lostmemories.runrev.v1', KNOWN = 'lostmemories.codex.v1', PROFILE = 'lostmemories.profile.v1', UNSAVED = SAVE + '.unsaved';
// Everything kept between visits goes through here. A write that fails is never swallowed: it is remembered in
// store.failed (key to the value that was not stored) and the page shows a bar until a retry gets it stored.
// Stored text that can no longer be read is copied aside under "<key>.unreadable" before anything overwrites it.
const store = {
  failed: new Map(), unreadable: new Set(),
  get(k) {
    let raw = null; try { raw = localStorage.getItem(k); } catch { return null; }
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch { store.unreadable.add(k); try { localStorage.setItem(k + '.unreadable', raw); localStorage.removeItem(k); } catch { /* the copy could not be kept */ } return null; }
  },
  set(k, v) { if (lostStore) return false; try { localStorage.setItem(k, JSON.stringify(v)); store.failed.delete(k); markStore(); return true; } catch { store.failed.set(k, v); return false; } },
  del(k) { if (lostStore) return false; store.failed.delete(k); try { localStorage.removeItem(k); return true; } catch { return false; } },
  // The list of cards seen only ever grows, so a waiting copy of it is joined to what is stored now (another tab may have added to it).
  retry(only) { for (const [k, v] of [...store.failed]) if (!only || only(k)) store.set(k, k === KNOWN ? [...new Set([...(store.get(KNOWN) || []), ...v])] : v); return store.failed.size === 0; },
};
// A browser can, rarely, hand a page an empty store for one load although everything it saved is still there. Seen in the
// headless test browser under load: six keys before a reload, none after it, all six again after the next reload.
// A page that believed the empty store would begin a new profile and, at its first save, write it over the real one.
// So this tab remembers (in sessionStorage, which a reload keeps) that the store held something. If the store then
// comes back with nothing at all in it, the page says so, offers to load again, and writes nothing until the player chooses.
const HAD = 'lostmemories.had';
const storeSize = () => { try { return localStorage.length; } catch { return -1; } };
let lostStore = storeSize() === 0 && (() => { try { return sessionStorage.getItem(HAD) === '1'; } catch { return false; } })();
const markStore = () => { try { if (storeSize() > 0) sessionStorage.setItem(HAD, '1'); } catch { /* no session store, so no guard */ } };
markStore();

const G = { run: null, sel: [], onto: null, attacker: null, aim: null, frames: [], playing: false, shown: null, inspect: null, toast: '', overlay: null, known: new Set(store.get(KNOWN) || []), tab: null, screen: null, story: null, results: null, pickForger: 'tarn', pickHeat: 0, pickDeck: null, pickTrunk: null, log: [], fast: false, cx: { view: 'found', type: null, open: null }, achOff: new Set() }; // achOff: rows a Vault purchase earned between runs (they belong to no run's last page)
const P = Object.assign(newProfile(), (() => { const s = store.get(PROFILE); if (s == null) return {}; if (okProfile(s)) return s; store.unreadable.add(PROFILE); try { localStorage.setItem(PROFILE + '.unreadable', JSON.stringify(s)); } catch { /* the copy could not be kept */ } return {}; })());
// Switches stored before Rumours was on for everyone (22 November 2026) take it on once; a player may turn it off after.
{ const st = store.get(LABKEY); pref = st ? { heat: true, kits: true, ...st, ...(st.rumoursOn ? {} : { secret: true, rumoursOn: 1 }) } : { ...LAB_DEFAULTS, rumoursOn: 1 }; setLabs(pref); }
// Saves from before 20 November 2026 wrote a shared pair (the two Robo fusions) without its order: bring them up to date once.
{ const pc = codexUpgrade(db, P.codex), kn = codexUpgrade(db, [...G.known].concat(pc)); if (pc.join() !== P.codex.join()) { P.codex = pc; store.set(PROFILE, P); } if (kn.join() !== [...G.known].join()) store.set(KNOWN, kn); G.known = new Set(kn); }
// Achievements (engine/achievements.mjs): a profile from before them has no p.ach. Keep only rows the engine knows, each
// once, with a run number; then judge the profile as it stands, so what was already done is earned (quietly) at once.
function achMigrate() {
  const ids = Array.isArray(P.ach) ? P.ach.filter((id, i, a) => typeof id === 'string' && ACH_BY_ID[id] && a.indexOf(id) === i) : [];
  const at = P.achAt && typeof P.achAt === 'object' && !Array.isArray(P.achAt) ? P.achAt : {}, was = JSON.stringify([P.ach, P.achAt]);
  P.ach = ids; P.achAt = Object.fromEntries(ids.map(id => [id, Number.isFinite(at[id]) ? at[id] : P.runs || 0]));
  try { achCheck(db, P, null); } catch (e) { later(e); }
  return JSON.stringify([P.ach, P.achAt]) !== was;
}
// Two tabs of this page share one store. Each keeps its own copy of the profile in P, so before a tab changes P it
// takes in whatever another tab stored since (syncP), and a tab's write never undoes what another tab banked.
const rawP = () => { try { return localStorage.getItem(PROFILE); } catch { return null; } };
const setP = o => { for (const k of Object.keys(P)) delete P[k]; Object.assign(P, newProfile(), o); };
let pRaw = rawP(); // the profile text this tab last read or wrote
const saveP = () => { const ok = store.set(PROFILE, P); if (ok) pRaw = rawP(); return ok; };
function syncP() {
  if (store.failed.has(PROFILE)) return; // this tab holds progress that is not stored yet: it is the newer one
  const raw = rawP(); if (raw == null || raw === pRaw) return;
  let o = null; try { o = JSON.parse(raw); } catch { return; }
  if (okProfile(o)) { setP(o); pRaw = raw; achMigrate(); }
}
// First lessons: a profile that has finished a few runs already knows them. "Show the first lessons again" on the Rules page resets this.
const tips = () => P.tips || (P.tips = P.runs > 2 ? learnedAll() : {});
// A stored run is used only if it is a run this page can play (saves.mjs); anything else is set aside like text that
// cannot be read: copied to "<key>.unreadable", removed, never played and never banked.
const okRun = s => runFault(db, s) === '';
function setAside(s) { store.unreadable.add(SAVE); try { localStorage.setItem(SAVE + '.unreadable', JSON.stringify(s)); localStorage.removeItem(SAVE); localStorage.removeItem(REV); } catch { /* the copy could not be kept */ } }
function readRun() { const s = store.get(SAVE); if (s == null || okRun(s)) return s; setAside(s); return null; }
const liveSave = () => { const s = readRun(); return s && s.phase !== 'over' ? s : null; };
const nameRun = run => { if (run && !run.uid) run.uid = 'r' + run.seed; return run; }; // runs begun before 21 November 2026 had no name
// The same run can be open in two tabs. REV counts the writes of the stored run and says which run they were, so a
// tab can tell, before it writes over the stored run or removes it, that the stored run is still the one it shows.
// A tab that is behind stops with a notice (overlay 'moved') and changes nothing.
const uidOf = s => s ? s.uid || 'r' + s.seed : null;
const revOf = run => { const v = store.get(REV); return v && typeof v === 'object' && v.uid === uidOf(run) && Number.isFinite(v.n) ? v.n : 0; };
// Which stored run this is and how many times it has been written: '' when no run is stored.
const storedAt = () => { const s = store.get(SAVE); if (!s) return ''; const v = store.get(REV); return uidOf(s) + '#' + (v && typeof v === 'object' && v.uid === uidOf(s) && Number.isFinite(v.n) ? v.n : 0); };
const unsavedRun = () => store.failed.has(SAVE) || store.failed.has(REV);
const holds = run => {
  // A write of this tab's own is still waiting to be stored. The run is this tab's to carry on only while the stored run
  // is exactly as this tab last saw it (G.at). If another tab ended it or began a new run meanwhile, this tab is behind,
  // and neither its next move nor "Try again" may write over what that tab stored (reported 21 November 2026).
  if (unsavedRun()) return storedAt() === G.at;
  const s = store.get(SAVE); return !!s && uidOf(s) === uidOf(run) && revOf(run) === (G.rev || 0);
};
// The run is written first and its counter after it, so a write that fails leaves the stored run and its counter as they were.
const writeRun = run => {
  if (unsavedRun() && storedAt() !== G.at) return false;
  G.rev = (G.rev || 0) + 1; const rev = { uid: uidOf(run), n: G.rev };
  if (!store.set(SAVE, run)) { store.failed.set(REV, rev); return false; }
  if (!store.set(REV, rev)) return false;
  G.at = storedAt(); return true;
};
const storedIs = run => { if (store.failed.has(SAVE)) return true; const s = store.get(SAVE); return !s || uidOf(s) === uidOf(run); }; // nothing stored, or this very run
// Banks a finished run exactly once. The profile is written first and the saved run is removed only after that
// write is known to be stored, so a full or blocked store can lose nothing and can pay nothing twice. A stored run
// that is not this run (another tab began it) is never removed or written over.
function bank(run, long) {
  syncP();
  const before = JSON.stringify(P); let res;
  try { res = applyRun(P, nameRun(run), { long }); achAdd(achCheck(db, P, null)); } catch (e) { setP(JSON.parse(before)); throw e; } // a run that cannot be banked leaves the profile as it was
  const same = storedIs(run);
  if (saveP()) { if (same) { store.del(SAVE); store.del(REV); } } else if (same) store.set(SAVE, run);
  if (!res.already && ((res.unlocks || []).length || (res.feats || []).length)) cueShown('unlock', { big: (res.unlocks || []).length > 0 });
  return res.already ? null : res;
}
if (achMigrate() && !store.unreadable.has(PROFILE)) saveP();
if (store.unreadable.has(PROFILE)) G.notice = 'Your saved progress could not be read, so this is a fresh start. A copy of the old data was kept on this device.';
// A finished run still on disk means the page closed before the run was banked (or before the bank was stored): bank it now, once.
{ const s = readRun();
  if (store.unreadable.has(SAVE)) G.notice = (G.notice ? G.notice + ' ' : '') + 'Your run in progress could not be read and cannot be continued. A copy was kept on this device.';
  else if (s && s.phase === 'over') { try { const res = bank(s, !!((store.get(RUNLABS) || pref).long)); if (res && res.total) G.notice = `A finished run was waiting. It is banked now: +${res.total} Memories.`; } catch (e) { setAside(s); G.notice = 'A finished run on this device could not be read, so it was not banked. A copy was kept on this device.'; later(e); } } }
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
    ${inst.e ? `<div class="en">${inst.e}</div>` : ''}${inst.veil ? '<div class="vl">VEILED</div>' : ''}${o.badge ? `<div class="bd">${o.badge}</div>` : o.pip ? `<div class="pip">${o.pip}</div>` : ''}
  </div>`;
}
const ART = new Set(D.art || []);
const relicImg = id => { const f = (RELICS[id].kind === 'M' ? 'masterwork' : 'relic') + '-' + id.replace(/_/g, '-'); return ART.has(f) ? `<img class="ri" decoding="sync" src="art/${f}.webp" alt="">` : `<span class="ri gem" data-l="${esc(RELICS[id].name.replace(/^The /, '')[0] || '')}"></span>`; }; // no picture yet: a plain gem, or in the Era look a worn coin stamped with the relic's first letter
const FAMILY_NAME = { furnace: 'Furnace', shadow: 'Ambush', lean: 'Lean Deck', storm: 'Storm', tomb: 'Tomb' };
const relicRow = (id, extra = '') => `<div class="relic">${relicImg(id)}<div><b>${esc(RELICS[id].name)}</b> <small>${{ C: 'Charm', G: 'Gift', M: 'Masterwork' }[RELICS[id].kind]}</small><br>${esc(RELICS[id].text)}${extra}</div></div>`;

// ---------- run plumbing ----------
function act(a) {
  const run = G.run; if (!run || G.playing) return;
  syncP();
  if (run.phase !== 'over' && !holds(run)) { movedOn(); return; }
  const frames = [];
  const wasDuel = run.phase === 'duel' || (run.phase === 'chamber' && a.t === 'door');
  const bossId = run.door && run.door.type === 'boss' ? run.door.boss : run.phase === 'chamber' && a.t === 'door' && run.doors[a.i] && run.doors[a.i].type === 'boss' ? run.doors[a.i].boss : null;
  const cx0 = run.codex ? run.codex.length : 0, hidden = (run.phase === 'duel' && run.rival && run.rival.tier === 'secret') || (run.phase === 'chamber' && a.t === 'door' && run.doors[a.i] && run.doors[a.i].type === 'secret');
  let rev; const fl0 = run.floor;
  let last = run.duel ? JSON.parse(JSON.stringify(viewFor(run.duel, db, 0))) : null; // each frame keeps the board it began from, which it shows until each move lands
  try {
    rev = achRunApply(run, a, db, P, { onStep: evs => { if (run.duel) { const view = JSON.parse(JSON.stringify(viewFor(run.duel, db, 0))); frames.push({ view, prev: last, evs, rival: info(run) }); last = view; } } });
  } catch (e) { if (e && e.constructor !== Error) { recover(e, true); return; } cue('refused', { action: a.t }); toast(e.message); render(); return; } // the engine refuses a move with a plain Error; anything else means the run itself is damaged
  G.faulty = null;
  { const got = (rev || []).filter(e => e.e === 'ach').map(e => e.id); if (got.length) { saveP(); achAdd(got, wasDuel); } }
  if (run.floor > fl0 && run.phase !== 'over') G.floorCard = { u: uidOf(run), n: run.floor + 1 }; // shown at the new floor's first chamber
  holding = wasDuel && frames.length > 0; // released by playFrames when the last frame has been shown
  if (bossId && (rev || []).some(e => e.e === 'duelWon') && !(P.beaten || []).includes(bossId)) { P.beaten = (P.beaten || []).concat(bossId); saveP(); } // counsel on a guardian's door stops once it has been beaten
  if (run.codex && run.codex.length > cx0) cueShown('codex:new', { n: run.codex.length - cx0 });
  for (const e of rev || []) if (['door', 'duelStart', 'duelWon', 'duelLost', 'boss', 'kit', 'mystery'].includes(e.e)) (e.e === 'duelWon' || e.e === 'duelLost' ? cueShown : cue)('run:' + e.e, e); // duel events are cued as they are shown; the result waits for the last of them
  G.sel = []; G.onto = null; G.attacker = null; G.aim = null;
  if (run.codex) { for (const k of run.codex) G.known.add(k); store.set(KNOWN, [...G.known]); }
  if (run.offer && run.offer.fresh && (P.fresh || []).includes(run.offer.fresh)) { P.fresh = P.fresh.filter(x => x !== run.offer.fresh); saveP(); }
  // The first secret: a fallen guardian leaves a memory (the clue), and The Last One has a line for either end of the hidden duel.
  if (db.config.secretLast && bossId && (rev || []).some(e => e.e === 'duelWon')) queueStory('memory:' + bossId);
  if (hidden && (rev || []).some(e => e.e === 'duelWon' || e.e === 'duelLost')) queueStory((rev || []).some(e => e.e === 'duelWon') ? 'secret:won' : 'secret:lost');
  if (run.phase === 'over') { if (!G.banked) { G.banked = true; G.results = bank(run, !!labs.long); cueShown('run:over', { won: !!run.result.won, reason: run.result.reason || null, floor: run.floor }); queueStory(run.result.won ? 'cleared' : run.result.reason === 'abandoned' ? 'left' : 'fell'); } } else writeRun(run);
  if (wasDuel && frames.length) {
    if (a.t === 'door' || !G.note) G.note = newNote(a.t !== 'door'); // a note begun part-way (after a reload) is partial
    noteFrames(G.note, frames);
    if (learnFrom(tips(), frames.flatMap(f => f.evs))) saveP();
    G.frames = frames; if (!run.duel && run.lastDuel) { G.overlay = { kind: 'duelEnd', sum: run.lastDuel, rival: G.lastRival, ach: achToWindow(), why: run.lastDuel.won ? [] : whyLost(G.note, run.lastDuel, G.lastRival || {}) }; G.note = null; } playFrames(); }
  else render();
}
const info = run => (G.lastRival = run.rival ? { name: run.rival.name, tier: run.rival.tier, law: run.rival.law || null, lawText: run.rival.lawText, bountyText: run.rival.bountyText, twist: run.rival.twist, style: run.rival.style, styleText: run.rival.styleText } : G.lastRival);
// A Law is written for a hand of five. With Deep Pockets the hand is six, so Tyranny's numbers are one higher.
const counsel = () => { const r = G.run, rv = r && r.phase === 'duel' && r.rival; if (!rv || !rv.law || !(rv.tier === 'boss' || rv.tier === 'secret')) return ''; if (rv.tier === 'boss' && r.door && (P.beaten || []).includes(r.door.boss)) return ''; return lawAnswer(rv.law); };
const lawShown = t => G.run && G.run.charms.includes('deep_pockets') ? t.replace('refills to four', 'refills to five').replace('refills to three', 'refills to four') : t;
// Sound hook. The page plays no sound itself: an audio module that sets window.LMAudio = { cue(name, data) } hears every
// event as the page shows it. Names: 'ui:<button verb>', 'duel:<engine event>', 'run:<run event>', 'run:over',
// 'duel:frame' (all the events shown together, in order), 'screen:<screen>', 'story:<scene id>', 'codex:new', 'unlock', 'toast', 'refused'.
// The third argument is the duel view for duel cues and the tapped element for ui cues. A cue that throws never reaches the game.
function cue(name, data, ctx) { try { const A = window.LMAudio; if (A && typeof A.cue === 'function') A.cue(name, data || {}, ctx); } catch (e) { /* sound never breaks play */ } }
// The sound of an outcome waits for its picture. A move that ends a duel is worked out at once, but the last hit and
// the Life Points falling are shown afterwards, frame by frame. So cues that announce a result (duel won or lost, the
// run over, a new meld in the Codex, an unlock, a story scene) are held while frames are still to be shown and are
// sent when the last frame has been shown, at any speed. Reported 21 November 2026: the fanfare could start before the last hit.
const held = []; let holding = false;
function cueShown(name, data) { if (holding) held.push([name, data]); else cue(name, data); }
function releaseCues() { holding = false; for (const [n, d] of held.splice(0)) cue(n, d); }
function toast(m) { cue('toast', { text: m }); G.toast = m; clearTimeout(toast.t); toast.t = setTimeout(() => { G.toast = ''; const t = $('#toast'); if (t) t.textContent = ''; }, 2600); }

// ---- the achievement pop-up (ach.mjs draws it). Rows earned wait in a queue and show one at a time: 4 s alone, 3 s each
// while several wait (n/m says which). One starts only when the move's frames have been shown and no window, story or
// Trap question is open; it never needs a press. Its place is a rule: on one screen (and the rooms of two) the bare stone
// of your own pillar, six rows under its last piece and ending four rows above its first plaque, else nowhere; in a duel
// on two screens the empty middle place of the bottom frame's third row of plaques, while no command needs it. A row
// earned in a duel on a frame too short for the pillar is written in the VICTORY window instead; one earned in a room
// there waits for the run's last page, which lists every row the run earned.
function achAdd(ids, duel = false) {
  const Q = G.aq || (G.aq = { q: [], cur: null, n: 0, of: 0, timer: 0 });
  for (const id of ids || []) if (ACH_BY_ID[id]) { Q.q.push({ id, duel: !!duel }); Q.of++; }
  if (Q.q.length) setTimeout(achPaint);
}
const achCalm = () => { const r = G.run, d = r && r.duel;
  return !G.playing && !G.tab && !G.overlay && !G.inspect && !G.story && !G.screen && !G.forge && !G.opening && !G.floorCard && !(d && d.pending && d.active === 1) && !!r && r.phase !== 'over'; };
// where the pop-up may stand on the frame now: { el, html } or null
function achSpot(id, o) {
  if (!app.classList.contains('ps') || look === 'old') return null;
  const phase = app.dataset.phase;
  if (DUAL && phase === 'duel') return G.achStrip ? { el: scrB, html: AC.stripToast(id, o) } : null;
  const pil = (DUAL ? scrT : app).querySelector('.fr > .pil0'); if (!pil) return null;
  // measured in the frame's own pixels (offsets), never the page's: a frame turned for an upright phone has its rects turned too
  const top = e => { let y = 0, n = e; while (n && n !== pil) { y += n.offsetTop; n = n.offsetParent; } return n === pil ? y : null; };
  let last = 0, plq = DUAL ? 360 : F.H;
  if (phase === 'duel') { last = G.achTerr ? 176 : 146; plq = F.H - 64; } // the duel's pillar: SPARKS ends at 146, a terrain's lines at 176; the Forger's Power plaque stands 64 rows from the foot
  else { const parts = [...pil.querySelectorAll('*')].filter(e => e instanceof HTMLElement && !e.closest('.pq, .acht') && e.getClientRects().length);
    for (const e of parts) { const t = top(e); if (t == null || !e.offsetHeight) continue; last = Math.max(last, t + e.offsetHeight + (e.classList.contains('ga') ? 1 : 0)); }
    for (const e of pil.querySelectorAll('.pq')) { const t = top(e); if (t != null && t >= last) plq = Math.min(plq, t); } }
  const y = last + AC.TOAST.gap; if (y + AC.TOAST.h + AC.TOAST.clear > plq) return null;
  return { el: pil, html: AC.pillarToast(id, y, o) };
}
function achPaint() {
  for (const e of app.querySelectorAll('.acht')) e.remove();
  const Q = G.aq; if (!Q || (!Q.cur && !Q.q.length)) return;
  if (G.run && G.run.phase === 'over') { clearTimeout(Q.timer); G.aq = null; return; } // the run's last page lists them all
  const calm = achCalm();
  if (!Q.cur) { if (!calm) return; const nx = Q.q[0], sp = achSpot(nx.id, { n: Q.n + 1, of: Q.of }); if (!sp) return;
    Q.q.shift(); Q.cur = { ...nx, left: Q.of > 1 ? 3000 : 4000, t0: 0 }; Q.n++; }
  const d = G.run && G.run.duel, C = Q.cur, sp = (calm || C.t0) && !(G.tab || G.overlay || G.story || G.screen || (d && d.pending && d.active === 1)) ? achSpot(C.id, { n: Q.n, of: Q.of }) : null;
  if (!sp) { if (C.t0) { C.left -= performance.now() - C.t0; C.t0 = 0; clearTimeout(Q.timer); } return; } // put away until its place is free again, keeping the time it has left
  sp.el.insertAdjacentHTML('beforeend', `<div class="ab acht" data-ach="${C.id}">${sp.html}</div>`);
  if (!C.t0) { C.t0 = performance.now(); clearTimeout(Q.timer); Q.timer = setTimeout(achNext, Math.max(0, C.left)); }
}
function achNext() { const Q = G.aq; if (!Q) return; Q.cur = null; if (!Q.q.length) { Q.n = 0; Q.of = 0; } achPaint(); }
// A duel ends on a frame too short for the pillar's pop-up: the rows it earned that are still waiting go to its window.
function achToWindow() {
  const Q = G.aq; if (DUAL || !Q) return [];
  const dfit = (G.achTerr ? 176 : 146) + AC.TOAST.gap + AC.TOAST.h + AC.TOAST.clear <= F.H - 64; if (dfit) return [];
  const out = [Q.cur, ...Q.q].filter(x => x && x.duel).map(x => x.id);
  if (Q.cur && Q.cur.duel) { clearTimeout(Q.timer); Q.cur = null; }
  Q.q = Q.q.filter(x => !x.duel); if (!Q.cur && !Q.q.length) { Q.n = 0; Q.of = 0; }
  return out;
}

// The frames of a move, one after another. The text bar reads out each step as it begins, never the one before.
// In the console look each frame is a beat (beatOf): the frame lasts as long as its beat, its sounds are sent as the
// beat comes to them, and the last frame stays a moment longer so its words can be read. The board the duel ended on
// is kept for the window that ends it.
async function playFrames() {
  G.playing = true;
  while (G.frames.length) {
    const f = G.frames.shift(), last = !G.frames.length, t0 = performance.now();
    const heavy = f.evs.some(e => ['battle', 'summon', 'spell', 'trap', 'terrain', 'meld', 'equip', 'set', 'destroyed'].includes(e.e));
    if (look === 'old' || lostStore) {
      for (const e of f.evs) logLine(e, f.view);
      const ghosts = snapshotGhosts(f.evs);
      G.shown = f; render();
      animate(f.evs, ghosts);
      cue('duel:frame', { evs: f.evs, fast: !!G.fast }, f.view); for (const e of f.evs) cue('duel:' + e.e, e, f.view);
      await new Promise(r => setTimeout(r, G.fast ? 60 : heavy ? 620 : 140));
      continue;
    }
    // With two frames the bar only tells the fight, so an attack is told from its first step, before the blow lands.
    if (DUAL) for (const e of f.evs) if (e.e === 'attack') { G.log.push(e.seat === 0 ? 'You attack.' : 'The rival attacks.'); if (G.log.length > 40) G.log.shift(); }
    G.shown = f; const B = startBeat(f);
    if (RM) B.t0 -= (B.end + 2) * TICK / B.speed; // no motion asked for: each step shows as it ends, and stays as long as it used to
    render(); psLoop();
    const ms = t => Math.max(0, B.t0 + t * TICK / B.speed - performance.now()), first = B.cues.filter(([, e]) => e.e === 'relic' || e.e === 'meld').map(([t]) => t);
    setTimeout(() => cue('duel:frame', { evs: f.evs, fast: !!G.fast }, f.view), ms(first.length ? Math.min(...first) : 0)); // the frame's sound sequences its melds and relics: sent when the first of them is shown
    for (const [t, e] of B.cues) setTimeout(() => { logLine(e, f.view); barSay(); cue('duel:' + e.e, e, f.view); }, ms(t)); // each line is read out as the beat reaches its move
    const hold = Math.max(RM ? (G.fast ? 60 : heavy ? 620 : 140) : 0, last ? (G.fast ? 400 : 800) : 0);
    await new Promise(r => setTimeout(r, Math.max(ms(B.end + 1), t0 + hold - performance.now())));
  }
  if (G.overlay && G.overlay.kind === 'duelEnd' && G.shown) G.endFrame = G.shown;
  G.playing = false; G.shown = null; for (const g of document.querySelectorAll('body > .ghost')) g.remove(); render();
  releaseCues(); // the result is on screen now
}
// The text bar while a move plays: the last two lines of the log, as each is reached.
function barSay() {
  const p = app.querySelector(DUAL ? '#app.ps .fr > .bar .pgw > p' : '#app.ps .fr > .bar > p'); if (!p || !G.playing) return;
  const t = esc(G.log.slice(-2).join(' ') || ''); if (p.innerHTML !== t) { p.innerHTML = t; G.barText = t; barFits(); }
}
// The size of a relic's change, for the log and the flash: " +300/+0", or " -400 ATK" when a relic weakens a monster.
const bonusText = e => e.longer ? ` (the meld counts as ${e.longer} cards)` : !(e.a || e.d) ? '' : e.a < 0 && !e.d ? ` ${e.a} ATK` : ` ${e.a < 0 ? '' : '+'}${e.a || 0}/${e.d < 0 ? '' : '+'}${e.d || 0}`;
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
    case 'free': t = e.seat === 0 ? (e.lone ? 'Support turn: that card was free. You may still play one card on its own, but not meld.' : 'Free cast: you still have your play.') : 'Rival free cast.'; break;
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
// A phone held sideways gets its own stage. The wide stage is 100 by 56 em; shrunk to a phone it draws text 6 to 8 px
// tall. The phone stage is 90 em wide and as tall as the screen allows (40 em on a 915 x 412 screen), so one em is
// about 10 px there, and every screen is laid out again for that shape under "#app.phone" in play.css.
// It is used when the wide stage would be shrunk below 0.72 (a window under 1152 px wide) on a screen at least 1.6 wide to 1 tall.
const PHONE_W = 1440, PHONE_MIN = 640, PHONE_MAX = 900;
function fit() {
  if (app.classList.contains('ps')) { const c = fitFrame(); FIT.k = c.k; FIT.phone = false; const n = document.getElementById('turn'); if (n) n.remove(); if (c.changed) { if (booting) bootScreen(); else render(); } return; } // a new frame size: the screen is laid out again
  const vw = innerWidth, vh = innerHeight;
  const phone = vw > vh && vw / 1600 < 0.72 && vw / vh >= 1.6;
  app.classList.toggle('phone', phone); FIT.phone = phone;
  if (phone) {
    FIT.h = Math.round(Math.max(PHONE_MIN, Math.min(PHONE_MAX, PHONE_W * vh / vw)));
    FIT.k = Math.min(vw / PHONE_W, vh / FIT.h);
    app.style.width = PHONE_W + 'px'; app.style.height = FIT.h + 'px';
    app.style.transform = `translate(-50%,-50%) scale(${FIT.k})`;
    app.style.setProperty('--E', '0px'); app.style.setProperty('--s', 1);
    app.style.setProperty('--X', (FIT.h - PHONE_MIN) + 'px'); // height beyond the shortest phone stage; the duel table and the tray share it
    turnNote(vw, vh); return;
  }
  app.style.width = ''; app.style.setProperty('--X', '0px');
  FIT.h = Math.round(Math.max(900, Math.min(1200, 1600 * vh / vw)));
  FIT.k = Math.min(vw / 1600, vh / FIT.h);
  app.style.height = FIT.h + 'px';
  app.style.transform = `translate(-50%,-50%) scale(${FIT.k})`;
  app.style.setProperty('--E', (FIT.h - 900) + 'px');
  app.style.setProperty('--s', FIT.h / 900);
  turnNote(vw, vh);
}
// A phone held upright shrinks the whole table to a strip: say so, and let the player go on if they want.
let uprightOk = false;
function turnNote(vw, vh) {
  let n = document.getElementById('turn'); const need = vh > vw && vw < 600 && !uprightOk;
  if (need && !n) { n = document.createElement('div'); n.id = 'turn'; n.innerHTML = '<div><b>Turn your phone sideways</b><p>Lost Memories is laid out for a wide screen. Held upright, the table is too small to read.</p><button id="turnok">Play upright anyway</button></div>'; document.body.appendChild(n); n.querySelector('#turnok').onclick = () => { uprightOk = true; n.remove(); }; }
  else if (!need && n) n.remove();
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
    w.animate(g.kind === 'destroyed' && pref.era ? [{ opacity: 1, filter: 'none' }, { opacity: 1, filter: 'grayscale(1) brightness(1.35)', offset: .22 }, { opacity: 0, transform: 'translateY(9%) scale(.95)', filter: 'grayscale(1) brightness(.35) blur(3px)' }] : g.kind === 'destroyed' ? [{ opacity: 1, filter: 'brightness(1)' }, { opacity: 1, filter: 'brightness(2.2) sepia(1) saturate(4) hue-rotate(-20deg)', offset: .35 }, { opacity: 0, transform: 'scale(.82) translateY(10%)', filter: 'brightness(.3)' }] : [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-40%) scale(.8)' }], { duration: 480, easing: 'ease-in' }).onfinish = () => w.remove();
  }
  for (const e of evs) {
    if (e.e === 'summon') { const c = zoneEl(e.seat, e.zone)?.querySelector('.c'); if (c) c.animate([{ transform: `translateY(${e.seat === 0 ? 60 : -60}%) scale(1.25)`, opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, filter: 'brightness(1.7)', offset: .7 }, { transform: 'none', filter: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' }); }
    if (e.e === 'attack') { const a = zoneEl(e.seat, e.from)?.querySelector('.c'); const t = e.to >= 0 ? zoneEl(1 - e.seat, e.to) : $(e.seat === 0 ? '#rivalLp' : '#myLp'); if (a && t) { const ra = a.getBoundingClientRect(), rt = t.getBoundingClientRect(); const dx = ((rt.left + rt.width / 2) - (ra.left + ra.width / 2)) / FIT.k, dy = ((rt.top + rt.height / 2) - (ra.top + ra.height / 2)) / FIT.k; a.animate([{ transform: 'none' }, { transform: `translate(${dx * .08 * -1}px,${dy * -.08}px) scale(1.06)`, offset: .25 }, { transform: `translate(${dx * .8}px,${dy * .8}px) scale(1.12)`, offset: .55 }, { transform: 'none' }], { duration: 460, easing: 'cubic-bezier(.5,0,.2,1)' }); a.style.zIndex = 5; setTimeout(() => (a.style.zIndex = ''), 470); } }
    // The old look only: the console look shows its Life Points and relics through the duel's beats (beatDom).
    if (e.e === 'lp') { const el = $(e.seat === 0 ? '#myLp' : '#rivalLp');
      if (el) { el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)', color: e.d < 0 ? '#ff6b5a' : '#7be08d', offset: .3 }, { transform: 'scale(1)' }], { duration: 500 }); const f = document.createElement('span'); f.className = 'float ' + (e.d < 0 ? 'neg' : 'pos'); f.textContent = (e.d > 0 ? '+' : '') + e.d; el.appendChild(f); setTimeout(() => f.remove(), 900); }
      if (e.d <= -1500) { (document.querySelector('.duel') || app).animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-.5%,.4%)' }, { transform: 'translate(.5%,-.3%)' }, { transform: 'none' }], { duration: 240, easing: 'linear' }); } }
    if (e.e === 'relic') { const b = $(e.seat === 0 ? '#relicFlash' : '#rivalFlash'); if (b) { b.textContent = (e.seat === 0 ? '' : 'Rival: ') + RELICS[e.id].name + bonusText(e); b.animate([{ opacity: 0, transform: 'translateY(40%)' }, { opacity: 1, transform: 'none', offset: .2 }, { opacity: 1, offset: .8 }, { opacity: 0 }], { duration: 1100, easing: 'linear' }); } }
    if (e.e === 'terrain') { const t = $('#terrain'); if (t) t.animate([{ filter: 'brightness(2.4)' }, { filter: 'none' }], { duration: 500 }); }
    if (e.e === 'draw' && e.seat === 0) { const cs = [...document.querySelectorAll('.hand .hs .c')].slice(-e.n); cs.forEach((c, i) => c.animate([{ transform: 'translate(120%,-40%) rotate(8deg) scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, delay: i * 70, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' })); }
  }
}

// ---------- story ----------
function queueStory(id, then) {
  if (!SCENES[id] || P.seen.includes(id)) { if (then) then(); return; }
  if (G.story) { (G.storyQ = G.storyQ || []).push(id); return; } // one scene at a time: a memory and the end of a run can fall on the same tap
  P.seen.push(id); saveP(); G.story = { id, i: 0, then: then || null }; cueShown('story:' + id, {});
}
function nextStory() { while (!G.story && G.storyQ && G.storyQ.length) queueStory(G.storyQ.shift()); }
function storyPanel() {
  const st = G.story; if (!st || G.playing || G.overlay) return '';
  const sc = SCENES[st.id];
  return `<div class="story${sc.face && ART.has(sc.face) ? ' faced' : ''}" data-a="storynext">${sc.face && ART.has(sc.face) ? `<img class="port" src="art/${sc.face}.webp" alt="">` : ''}<div class="say glass">${sc.who ? `<h3>${esc(sc.who)}</h3>` : ''}<p>${esc(sc.lines[st.i])}</p><span class="go">Tap to continue ▸</span></div><button class="skip" data-a="storyskip">Skip</button></div>`;
}

// ---------- screens around a run ----------
// What a relic sets off and what sets it off, for the pieces the player holds or could still be offered.
function linkLine(id, r) {
  const mine = new Set(relicList(r)), pool = x => mine.has(x) || (!LAB[x] || (db.config.labPool || []).includes(x)) && carries(r, x); // a piece this run does not carry cannot be offered, so it is not named
  const names = ids => ids.filter(pool).sort((a, b) => mine.has(b) - mine.has(a)).map(x => mine.has(x) ? `<b class="heldp">${esc(RELICS[x].name)} (held)</b>` : esc(RELICS[x].name)).join(', ');
  const L = relicLinks(id), s = names(L.sets), b = names(L.by);
  return (s ? `<br><small class="sets">Sets off: ${s}</small>` : '') + (b ? `<br><small class="sets">Set off by: ${b}</small>` : '');
}
// A monster offered as a pick: its Type, and any printed fusion it makes with a monster already in the deck. Every monster
// fights with its printed numbers, which How to play and the card's own page (tap it) say; repeating that on every pick told
// the player nothing new.
// A partner is named only once that pair is in the Codex, so the pick never gives away a fusion still to be found.
function pickNote(id, r) {
  if (!db.isMonster(id)) return esc(rulesText(id));
  const c = card(id), seen = new Set(), named = []; let hidden = 0;
  for (const e of (r && r.deck) || []) { if (seen.has(e.id) || e.id === id || !db.isMonster(e.id)) continue; seen.add(e.id); const m = meldPairRaw(db, id, e.id); if (!m || m.kind !== 'printed') continue; if (codexKnows(db, k => G.known.has(k), id, e.id) || codexKnows(db, k => G.known.has(k), e.id, id)) named.push(card(e.id).name); else hidden++; }
  return `<b>${esc(c.type)}</b>` + (named.length ? `<br>Printed fusion with ${esc(named.slice(0, 2).join(' and '))}${named.length > 2 ? ` and ${named.length - 2} more` : ''} in your deck.` : '') + (hidden ? `<br>${named.length ? 'And a' : 'A'} monster in your deck makes a printed fusion with it.` : '');
}
const ruleText = id => RELICS[id].text + (id === 'f_veil' && labs.veilSet ? ' Also once a turn, while you hold no veiled monster, setting one monster veiled in defense does not use your play.' : '');
function screenForger() {
  const top = heatTop(), heatMax = heatOpen(), hr = labs.heat ? HEAT_RULES.filter(x => x.n <= G.pickHeat) : [];
  const cardOf = id => { const f = FORGERS[id], own = P.forgers.includes(id), on = G.pickForger === id, face = 'face-' + (id === 'last' ? 'last-one' : id);
    return `<div class="ch glass ${own ? '' : 'locked'} ${on ? 'on' : ''}" ${own ? `data-a="forger:${id}"` : ''}>${ART.has(face) ? `<img ${own ? '' : 'class="shade" '}src="art/${face}.webp" alt="">` : `<div class="q">${own ? esc(f.name.replace('The ', '')[0]) : '?'}</div>`}<b>${esc(f.name)}</b><i>${esc(f.tag)}</i>${own ? `<span><u>Rule:</u> ${esc(ruleText(f.rule))}</span><span><u>${esc(f.power)}:</u> ${esc(f.powerText)}</span>${labs.long ? `<span class="road">${roadLine(id)}</span>` : ''}` : `<span>Unlock: ${esc(FORGER_FEATS[id].text)}</span>`}</div>`; };
  return `<div class="hall"><div class="panel glass wide"><h2>Choose your Forger</h2><div class="chars">${FORGER_IDS.map(cardOf).join('')}${P.forgers.includes('last') ? cardOf('last') : labs.secret ? `<div class="ch glass locked"><div class="q">?</div><b>The Last One</b><i>Hidden</i><span>Nobody says how. The guardians remember things as they fall, and the Codex keeps what they say.</span></div>` : ''}</div>
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
// Rumours: what the guardians let slip as they fell, kept word for word, and what the player has since found out. Shown
// once the first memory has been heard (or while the switch is on, so a player knows the page exists).
function rumours() {
  const heard = BOSSES.flat().filter(b => P.seen.includes('memory:' + b.id)), sc = (G.run && G.run.secret) || {};
  const near = P.loneNear || sc.near, met = P.loneMet || sc.met, won = P.forgers.includes('last') || sc.won;
  if (!heard.length && !near && !met && !won && !labs.secret) return '';
  return `<div class="rumours glass"><h3>Rumours · ${heard.length} of ${BOSSES.flat().length} memories heard</h3>${heard.length ? heard.map(b => `<p><b>${esc(b.name)}</b> ${esc(SCENES['memory:' + b.id].lines[0])}</p>`).join('') : '<p class="fine">Nothing yet. A guardian remembers something as it falls.</p>'}${near && !met ? `<p class="near">${esc(RUMOURS.near)}</p>` : ''}${met ? `<p class="near">${esc(RUMOURS.met)}</p>` : ''}${won ? `<p class="near"><b>The Last One.</b> ${esc(RUMOURS.won)}</p>` : ''}</div>`;
}
function screenCodex() {
  const X = codexIndex(), found = codexFound(), v = G.cx;
  let list = X.list.filter(R => (v.view === 'all' || found.has(R.id)) && (!v.type || card(R.id).type === v.type));
  const total = list.length; list = list.slice(0, 120);
  const byType = t => X.list.filter(R => card(R.id).type === t);
  const tiles = list.map(R => { const c = card(R.id); return found.has(R.id) ? `<div class="cxt" data-a="cxopen:${R.id}">${face({ id: R.id }, { cls: 'small' })}<small>${found.get(R.id).length} recipe${found.get(R.id).length > 1 ? 's' : ''}</small></div>` : `<div class="cxt unk" data-a="cxopen:${R.id}"><div class="c small unk"><span>?</span></div><small>${R.kind === 'printed' ? 'Printed fusion' : esc(c.type) + ' · ' + esc(c.attr)}</small></div>`; }).join('');
  return `<div class="hall"><div class="panel glass wide scroll"><h2>Codex · ${found.size} of ${X.list.length} results found</h2><p>Every monster a meld can make has a page here. A page you have found shows why the meld works, so you can make it again from other cards. ${G.known.size} recipes written.</p>${rumours()}
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
    <button data-a="tab:deck">Deck</button><button data-a="tab:relics">Relics (${relicList(r).length})</button><button data-a="tab:help">Rules</button><button data-a="tab:sound">Sound</button><button data-a="quit">Abandon</button></div>`;
}

function screenHome() {
  const saved = liveSave();
  return `<div class="hall home"><div class="title"><small>CARDSTASHY</small><h1>LOST MEMORIES</h1><p>${pref.era ? 'Three floors beneath Asterhold. Three Sparks to carry you down.' : 'Test build of the real rules engine. Three floors, six chambers each, three Sparks.'}</p>${G.notice ? `<p class="notice glass">${esc(G.notice)}</p>` : ''}
    <div class="row">${saved && saved.phase !== 'over' ? '<button class="gold" data-a="resume">Continue run</button>' : ''}<button class="${saved && saved.phase !== 'over' ? '' : 'gold'}" data-a="new">New run</button><button data-a="screen:codex">Codex (${G.known.size})</button><button data-a="screen:feats">Feats (${(P.featsDone || []).length}/${featList(!!labs.long).length})</button><button data-a="screen:vault">Memory Vault (${P.memories})</button><button data-a="tab:help">How to play</button><button data-a="tab:sound">Sound</button>${look === 'old' ? '<button data-a="look">Console look</button>' : ''}${pref.era ? `<button data-a="labsopen" class="${G.labsOpen ? 'on' : ''}">Lab switches</button>` : ''}</div>
    ${pref.era && !G.labsOpen ? '' : `<div class="labs glass"><b>Lab rules</b> <small>experiments. Five Gifts, Leaning offers, the Heat ladder, Even kits, Tuned items and Rumours start on: they are the current test baseline.${saved && saved.phase !== 'over' ? ' Your run in progress keeps the rules it started with; changes here apply to the next run.' : ''}</small><div class="labgrid">${labKeys().map(k => { const held = pref.depth && DEPTH_SET.includes(k); return `<button class="lab ${pref[k] || held ? 'on' : ''}" data-a="lab:${k}"><i>${pref[k] || held ? 'ON' : 'OFF'}</i><span>${LABS[k]}${held && !pref[k] ? ' (On through the depth set.)' : ''}</span></button>`; }).join('')}</div></div>`}
    ${pref.era ? '' : '<p class="fine">Not final art. Seen only in a test browser so far.</p>'}</div></div>`;
}
function summary(deck) {
  const mons = deck.filter(e => db.isMonster(e.id)).map(e => card(e.id));
  const types = {}; mons.forEach(c => types[c.type] = (types[c.type] || 0) + 1);
  const top = Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, n]) => `${n} ${t}`).join(', ');
  // How many two-monster pairs in this kit meld at all: a kit whose halves do not mix is harder to learn.
  let ok = 0, all = 0; for (const a of mons) for (const b of mons) if (a !== b) { all++; if (meldPairRaw(db, a.id, b.id).kind !== 'fizzle') ok++; }
  const pct = all ? Math.round(100 * ok / all) : 100;
  return `${mons.length} monsters (${top}), average ATK ${Math.round(mons.reduce((n, c) => n + c.atk, 0) / mons.length)}, weight ${deckWeight(db, deck)}. ${pct}% of its monster pairs meld${pct < 85 ? ': some of its monsters never meld with each other, so learn which before you chain' : ''}.${db.config.kitTraps ? ` ${deck.filter(e => roleOf(db, e.id) === 'trap').length} Traps, and your first Trap set each turn is free.` : ''}`;
}
// Simulator clear rates by Forger and kit (Heat 0, 1,500 expert-CPU runs each, 20 November). A lab note, not a rule.
const KIT_SIM_EVEN = { none: { spellcasters_fiends: 48, dragons_warriors: 44, beasts_plants: 46 }, tarn: { fire_scale: 67, dragons_warriors: 65, blades_claws: 71 }, scrapper: { stone_gears: 62, machines_thunder: 59, swarm: 65 }, veil: { lantern_choir: 48, spellcasters_fiends: 47, grave_court: 47 }, storm: { high_wind: 63, beasts_plants: 61, tide: 65 } };
const KIT_SIM = { none: { spellcasters_fiends: 48, dragons_warriors: 43, beasts_plants: 42 }, tarn: { fire_scale: 77, dragons_warriors: 63, blades_claws: 52 }, scrapper: { stone_gears: 76, machines_thunder: 60, swarm: 52 }, veil: { lantern_choir: 57, spellcasters_fiends: 47, grave_court: 35 }, storm: { high_wind: 72, beasts_plants: 59, tide: 36 } };
function screenKit() {
  const r = G.run, sim = (labs.kits ? KIT_SIM_EVEN : KIT_SIM)[r.forger || 'none'] || {};
  return `<div class="hall"><div class="panel glass wide"><h2>Pick a starter kit</h2>${r.builds ? `<p class="fine veins">This descent carries <b>${r.builds.map(f => FAMILY_NAME[f]).join('</b> and <b>')}</b> Gifts. Gifts of the other builds will not be offered this run.</p>` : ''}<div class="kits">${r.offer.map((k, i) => `<div class="kit glass"><h3>${esc(k.name)}</h3><p>${summary(k.deck)}</p>${sim[k.kit] && !pref.era ? `<p class="fine kitsim">Lab note: the test CPU clears ${sim[k.kit]}% of runs with this kit${labs.kits ? ' (even kits on)' : ''}.</p>` : ''}<div class="mini">${k.deck.slice().sort((a, b) => cardValue(db, b) - cardValue(db, a)).slice(0, 5).map(e => face(e, { attrs: `data-a="inspect:${e.id}"` })).join('')}</div><button class="gold" data-a="kit:${i}">Take this kit</button></div>`).join('')}</div>
    ${labs.long && r.forger && nextKit(P, r.forger) ? (nk => `<p class="fine">Long road: these are the kits ${esc(FORGERS[r.forger].name)} has open, dealt three ways. ${esc(nk.name)} opens at ${nk.goal} duels won as ${esc(FORGERS[r.forger].name)} (${Math.min(nk.wins, nk.goal)}/${nk.goal}).</p>`)(nextKit(P, r.forger)) : ''}
    <div class="row">${r.redeal ? '<button data-a="redeal">Deal again (once)</button>' : '<span class="fine">Re-deal used.</span>'}</div></div></div>`;
}
function pickList(title, items, sub = '', cls = '') { return `<div class="hall"><div class="panel glass wide"><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}<div class="picks ${cls}">${items.join('')}</div></div></div>`; } // cls "abreast": on a phone the choices stand side by side
function screenCharm() { return pickList('Pick one charm', G.run.offer.options.map((id, i) => `<div class="pick glass">${relicRow(id)}<button class="gold" data-a="pick:${i}">Take</button></div>`), 'A charm changes a rule for the whole run.'); }

// "Guardian" means the guardian of a floor everywhere else (the Guardian Reward, Guardians beaten, the Veilwalker's feat), so the
// hard rival behind an ordinary door is shown as an Elite. The engine keeps its own word, which is part of the recorded fixtures.
const doorName = d => d.tier === 'guardian' ? d.name.replace(/^Guardian: /, 'Elite: ') : d.name;
const DOOR_ART = { duel: 'duel', cursed: 'cursed', champion: 'champion', guardian: 'guardian', anvil: 'anvil', bazaar: 'bazaar', sanctum: 'sanctum', omen: 'omen', treasure: 'treasure', boss: 'boss', mystery: 'omen', secret: 'duel-sealed', onward: 'duel-open' };
function screenChamber() {
  const r = G.run, boss = BOSSES[r.floor][r.bossOrder[r.floor]];
  return `<div class="hall doorsHall">${r.lastNote ? `<div class="note glass">${esc(r.lastNote)}</div>` : ''}${r.doors.some(d => d.type === 'secret') ? '' : `<div class="bossline glass">Guardian of this floor: <b>${esc(boss.name)}</b>${r.chamber >= 2 ? '. ' + esc(bossLaw(db, r)) : '. Its Law shows from chamber 3.'}${db.config.heatRules && r.heat ? ` <button class="heatchip" data-a="heatinfo:${r.heat}">Heat ${r.heat} rules</button>` : ''}</div>`}
    <div class="doors${r.doors.length === 2 ? ' pair' : ''}">${r.doors.map((d, i) => { const locked = d.type === 'boss' && r.seals < 2; return `<button class="door t-${d.type} k-${d.know || 'known'}" data-a="door:${i}" ${locked ? 'disabled' : ''}><img decoding="sync" src="art/door-${DOOR_ART[d.type]}.webp" alt=""><div class="dtxt glass"><b>${esc(doorName(d))}</b><span class="k">${d.know === 'known' ? 'Known' : d.know === 'partial' ? 'Partly hidden' : 'Mysterious'}</span><span><i>Cost</i> ${esc(d.cost)}</span><span><i>Reward</i> ${esc(d.reward)}</span>${d.law ? `<span><i>Law</i> ${esc(lawShown(d.law))}</span>` : ''}${d.type === 'boss' && !(P.beaten || []).includes(d.boss) && lawAnswer(boss.law) ? `<span class="counsel"><i>Counsel</i> ${esc(lawAnswer(boss.law))}</span>` : ''}${d.tell ? `<span class="tell"><i>${esc(d.style)}</i> ${esc(d.tell)}</span>` : ''}${(d.tags || []).map(t => `<em>${esc(t)}</em>`).join('')}</div></button>`; }).join('')}</div></div>`;
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
  const holds = m => m.e === 'bulwark' && !m.bulwarkUsed;
  const fate = (q, X, T) => { const t = q.killT ? (holds(T) ? 'its Bulwark holds' : 'destroys it') : '', x = q.killX ? (holds(X) ? 'your Bulwark holds' : 'you lose yours') : ''; return t && x ? t + ', ' + x : t || x || 'no kill'; };
  const fc = z => { const X = live.mon[0][G.attacker], T = z >= 0 ? v.mon[1][z] : null; if (z < 0) return `Direct: ${v.mon[0][G.attacker].ea} to Life Points`; if (T.veil) return '?'; const q = forecast(live, db, 0, X, 1, live.mon[1][z]); return `${q.a} v ${q.d}${q.edgeA ? ' ▲' : ''}${q.edgeD ? ' ▼' : ''}: ${fate(q, X, live.mon[1][z])}${q.dmgDef ? `, ${q.dmgDef} dmg` : ''}${q.dmgAtk ? `, you take ${q.dmgAtk}` : ''}`; };
  // A Spell or Equip picked on its own may be aimed: its legal targets light up and a tap chooses one.
  const aim = canPlay && G.sel.length === 1 && G.onto == null && live.hand[0][G.sel[0]] ? aimFor(db, live, live.hand[0][G.sel[0]].id) : null;
  const aimed = aim && G.aim != null && aim.zones.includes(G.aim) ? G.aim : null;
  const row = (seat) => v.mon[seat].map((m, z) => {
    let cls = 'slot', attrs = `data-zone="${seat}:${z}"`, tip = '';
    if (aim && aim.side === seat && m) { cls += ' target' + (aimed === z ? ' picked' : ''); attrs += ` data-a="aim:${z}"`; return `<div class="${cls}" ${attrs}>${face(m)}</div>`; }
    if (seat === 0 && m && myTurn) { if (canAtk.has(z)) cls += ' ready'; attrs += ` data-a="mine:${z}"`; if (G.attacker === z) cls += ' picked'; if (G.onto === z) cls += ' onto'; }
    if (seat === 1 && m && targets.includes(z)) { cls += ' target'; attrs += ` data-a="hit:${z}"`; tip = `<div class="fc">${fc(z)}</div>`; }
    else if (m) attrs += ` data-a="inspectz:${seat}:${z}"`;
    return `<div class="${cls}" ${attrs}>${m ? face(m) : ''}${tip}</div>`;
  }).join('');
  const shut = v.mon[0].length < 5 ? '<div class="slot closed"></div>' : ''; // Narrow Pass: the outer zones stay drawn, sealed, so the table never changes shape
  const traps = seat => v.traps[seat].map(t => `<div class="tslot">${t ? (seat === 0 ? face(t, { cls: 'tiny', attrs: `data-a="inspect:${t.id}"` }) : '<div class="c back tiny"><img decoding="sync" src="art/cardback.webp" alt="Set card"></div>') : ''}</div>`).join('');
  // first lessons: one line in the tray and a numbered pip on the cards it names
  const T = tips(), lesson = canPlay && G.attacker == null && G.onto == null && live.seat[0].rs.loneTurn !== live.turn && !(T.meld && T.fuel && T.single) ? lessonFor(db, live, T) : null;
  G.lesson = lesson ? lesson.kind : null;
  // meld tray
  let tray = canPlay && live.seat[0].rs.loneTurn === live.turn ? '<span class="fine">Support turn: your support card was free. Play one card on its own. No meld this turn.</span>' : db.config.freeCast === 'lone' ? '<span class="fine">Tap hand cards in order. One card plays it. Two or more meld left to right. Once a turn, a Spell, Trap, Field or Equip on its own is free if you do not meld.</span>' : '<span class="fine">Tap hand cards in order. One card plays it. Two or more meld left to right.</span>', buttons = '';
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
    const loneNow = live.seat[0].rs.loneTurn === live.turn, freeNow = db.config.freeCast === 'lone' && !live.seat[0].noFree && live.seat[0].rs.freeTurn !== live.turn && G.sel.length === 1 && G.onto == null;
    if (!vars.length) tray += `<span class="fine bad">${loneNow && (G.sel.length > 1 || G.onto != null) ? 'You played a free support card this turn, so you cannot meld. Play one card on its own.' : 'That cannot be played right now.'}</span>`;
    const aimM = aimed != null ? v.mon[aim.side][aimed] : null, aimName = aimM ? (aimM.id ? card(aimM.id).name : 'the veiled monster') : '';
    if (aim && vars.length) tray += `<span class="fine">${aimM ? 'Target: ' + esc(aimName) + '. Tap it again to let the card choose.' : `Tap ${aim.side ? 'a rival monster' : 'one of your monsters'} to choose the target. With no choice it takes the strongest${aim.side ? ' face-up' : ''} one.`}</span>`;
    const lab = x => x.pos === 'a' ? (x.veiled ? 'Veiled attack' : 'Attack position') : x.pos === 'd' ? (x.veiled ? 'Veiled defense' : 'Defense position') : (freeNow ? 'Play free' : 'Play') + (aimM ? ' on ' + esc(aimName) : '') + (freeNow ? ' (no meld this turn)' : '');
    buttons = vars.map(x => `<button class="gold" data-a="play:${x.pos || ''}:${x.veiled ? 1 : 0}">${lab(x)}</button>`).join('') + '<button data-a="undo">Undo</button>';
    if (G.sel.length === 1) buttons += '<button data-a="scrap">Scrap card</button>';
  } else if (G.attacker != null) {
    tray = `<span>Pick a target${targets.length ? '' : ' (none legal)'}.</span>`;
    buttons = (targets.includes(-1) ? `<button class="gold" data-a="hit:-1">Direct attack (${v.mon[0][G.attacker].ea})</button>` : '') + (canPos.has(G.attacker) ? '<button data-a="pos">Change position</button>' : '') + '<button data-a="undo">Cancel</button>';
  } else if (G.onto != null) { tray = '<span>Now tap hand cards to meld onto it.</span>'; buttons = '<button data-a="undo">Cancel</button>'; }
  else if (lesson) { const [h, t] = lessonText(lesson.kind, lesson.cards.map(i => card(live.hand[0][i].id).name)); tray = `<span class="lesson"><b>${esc(h)}.</b> ${esc(t)}</span>`; buttons = '<button data-a="tipsoff">No more lessons</button>'; }
  else if (counsel()) tray += `<span class="fine counsel"><b>Counsel.</b> ${esc(counsel())}</span>`; // a guardian's Law, taught in the duel itself until that guardian has been beaten once, under the tray's own words (a rule notice there must stay)
  const hand = [0, 1, 2, 3, 4, 5].map(i => { const c = v.hand[i]; const k = G.sel.indexOf(i); const lp = lesson ? lesson.cards.indexOf(i) : -1; return `<div class="hs">${c ? face(c, { cls: (canPlay ? 'can ' : '') + (k >= 0 ? 'sel' : ''), attrs: `data-a="hand:${i}"`, badge: k >= 0 ? k + 1 : '', pip: lp >= 0 ? lp + 1 : '' }) : ''}</div>`; }).join('');
  let powerBtn = '';
  if (myTurn && v.forger && !v.rs.power) {
    const F = FORGERS[v.forger], pa = powerActions(live, db, 0);
    const ok = F.needs === 'hand' ? G.sel.length === 1 && pa.some(p => p.hand === G.sel[0]) : F.needs === 'zone' ? G.attacker != null && pa.some(p => p.zone === G.attacker) : pa.length > 0 && !G.sel.length;
    const hint = F.needs === 'hand' ? ' (pick one hand card)' : F.needs === 'zone' ? ' (pick your monster)' : F.needs === 'lone' ? ' (with exactly one monster)' : '';
    powerBtn = `<button class="pow" data-a="power:${F.needs || ''}" ${ok ? '' : 'disabled'} title="${esc(F.powerText)}">${esc(F.power)}${ok ? '' : hint}</button>`;
  }
  const terr = v.terrain ? `Terrain: <b>${esc(card(v.terrain.id).name)}</b>${v.terrain.temp != null ? ` (holds ${v.terrain.temp} more of your turns)` : ''}${v.terrain.lock ? ' (locked)' : ''}` : 'No terrain';
  const pv = pend ? viewFor(live, db, 0) : null, pX = pend ? pv.mon[1][live.pending.from] : null, pT = pend && live.pending.to >= 0 ? pv.mon[0][live.pending.to] : null;
  // The prompt covers the table, so it names the attacker, its target and both numbers.
  const prompt = pend ? `<div class="modal"><div class="glass panel"><h3>${pX && !pX.veil ? esc(card(pX.id).name) + ' (' + pX.ea + ' ATK)' : 'A veiled monster'} attacks ${pT ? esc(card(pT.id).name) + ' (' + (pT.pos === 'd' ? pT.ed + ' DEF' : pT.ea + ' ATK') + (pT.veil ? ', veiled' : '') + ')' : 'you directly'}</h3><p>Spring a Trap?</p><div class="picks">${live.pending.options.map(i => `<div class="pick glass">${face(live.traps[0][i], { cls: 'tiny' })}<div><b>${esc(card(live.traps[0][i].id).name)}</b><br>${esc(rulesText(live.traps[0][i].id))}</div><button class="gold" data-a="respond:${i}">Spring it</button></div>`).join('')}</div><div class="row"><button data-a="respond:-1">Let the attack through</button></div></div></div>` : '';
  const bar = n => `<i class="lpbar"><i style="width:${Math.max(0, Math.min(100, Math.round(n / 80)))}%"></i></i>`, ff = v.forger ? 'face-' + (v.forger === 'last' ? 'last-one' : v.forger) : '', myFace = ff && ART.has(ff) ? `<img class="pface" decoding="sync" src="art/${ff}.webp" alt="">` : '',
    rf = rv.tier === 'secret' ? 'face-last-one' : rv.tier === 'boss' ? 'face-' + String(rv.name || '').toLowerCase().replace(/^the /, '').replace(/[^a-z]+/g, '-') : '', rivalFace = rf && ART.has(rf) ? `<img class="pface" decoding="sync" src="art/${rf}.webp" alt="">` : ''; // a guardian's portrait, when the art folder has one
  return `<div class="duel ${v.twist || ''}${pref.table ? ' look2' : ''}"><div class="side top"><div class="who glass">${rivalFace}<b id="rivalLp" class="lp">${v.lp[1]}</b>${bar(v.lp[1])}<span>${esc(rv.name)}</span><small>Hand ${v.rivalHand} · Deck ${v.deckCount[1]}</small><i class="backs">${'<u></u>'.repeat(Math.min(v.rivalHand, 7))}</i></div>
      <div class="rules glass"><b>This duel</b>${rv.styleText ? `<span class="rstyle">${esc(rv.styleText)}</span>` : ''}${rv.lawText ? `<span>${esc(lawShown(rv.lawText))}</span>` : ''}${rv.twist ? `<span>${{ fog: 'Fog: monsters arrive veiled.', narrow: 'Narrow Pass: three zones.', storm: 'Storm Front: terrain shifts every third turn.', locked: 'Locked terrain.' }[rv.twist]}</span>` : ''}<span>Bounty: ${esc(rv.bountyText || '')}</span>${v.forger ? `<span class="frule"><b>${esc(FORGERS[v.forger].name)}</b> ${esc(ruleText(FORGERS[v.forger].rule))} <br><b>${esc(FORGERS[v.forger].power)}</b> ${v.rs.power ? 'used this duel.' : esc(FORGERS[v.forger].powerText.replace(/^Once a duel, before you play: /, 'once a duel, before you play: '))}</span>` : ''}</div></div>
    <div class="board"><div class="trow">${traps(1)}</div><div class="mrow">${shut}${row(1)}${shut}</div><div id="terrain" class="terrain">${terr}</div><div class="mrow">${shut}${row(0)}${shut}</div><div class="trow">${traps(0)}</div><div id="relicFlash" class="relicFlash"></div><div id="rivalFlash" class="relicFlash rivalf"></div></div>
    <div class="side bot"><div class="who glass">${myFace}<b id="myLp" class="lp">${v.lp[0]}</b>${bar(v.lp[0])}<span>You</span><small>Deck ${v.deckCount[0]} · Turn ${v.turn}</small></div>
      <div class="logbox glass">${G.log.slice(-5).map(esc).join('<br>')}</div></div>
    <div class="tray"><div class="hand">${hand}</div><div class="actions glass"><div class="trayline">${G.playing ? '<span>…</span>' : myTurn ? tray : pend ? '<span>Answer the attack.</span>' : '<span>Rival is thinking.</span>'}</div><div class="row">${buttons}${myTurn && !G.sel.length && G.attacker == null ? `<button class="gold" data-a="end">${v.turn === 1 || (!canAtk.size) ? 'End turn' : 'End turn'}</button>` : ''}${v.relics.includes('clean_draw') && !v.rs.cleanDraw && canPlay && G.sel.length === 1 ? '<button data-a="clean">Clean Draw this card</button>' : ''}${powerBtn}<button data-a="speed">${G.fast ? 'Speed: fast' : 'Speed: normal'}</button><button data-a="tab:sound">Sound</button></div></div></div>${prompt}</div>`;
}

function screenReward() {
  const r = G.run, o = r.offer;
  if (o.kind === 'card') return pickList('Pick a card', o.options.map((e, i) => `<div class="pick glass">${face(e, { attrs: `data-a="inspect:${e.id}"` })}<div>${pickNote(e.id, r)}<br><small>Weight ${weightOf(db, e.id)}</small></div><button class="gold" data-a="pick:${i}">Take</button></div>`).concat('<div class="row"><button data-a="skip">Take nothing</button></div>'), 'It goes to your trunk. Swap it into the deck from the Deck button.', 'abreast');
  if (o.kind === 'gift') {
    const held = new Set(relicList(r).map(id => RELICS[id].family).filter(f => BUILD_FAMILIES.includes(f)));
    const tag = id => (o.fresh === id ? `<br><em class="newtag">NEW</em> You unlocked this with ${esc((featList(true).find(f => f.gift === id) || {}).name || 'a feat')}.` : '') + (RELICS[id].link && (held.has(RELICS[id].family) || held.has(RELICS[id].link)) ? `<br><em class="fits">Links ${esc(FAMILY_NAME[RELICS[id].family])} to ${esc(FAMILY_NAME[RELICS[id].link])}</em>` : held.has(RELICS[id].family) ? `<br><em class="fits">Fits your ${esc(FAMILY_NAME[RELICS[id].family])} pieces</em>` : '') + linkLine(id, r);
    return pickList('Forge Level up: pick a Gift', o.options.map((id, i) => `<div class="pick glass ${o.fresh === id ? 'fresh' : ''}">${relicRow(id, tag(id))}<button class="gold" data-a="pick:${i}">Take</button></div>`).concat(r.rerolls ? `<div class="row"><button data-a="reroll">Deal these three again (${r.rerolls} left this run)</button></div>` : ''), 'A Gift lasts the whole run. ' + (r.builds ? 'This descent carries ' + r.builds.map(f => FAMILY_NAME[f]).join(' and ') + ' Gifts. ' : '') + (held.size ? 'You hold ' + [...held].map(f => FAMILY_NAME[f]).join(' and ') + ' pieces.' : 'Your first build piece decides what the forge leans toward.'));
  }
  if (o.kind === 'charm') return pickList('Pick a charm', o.options.map((id, i) => `<div class="pick glass">${relicRow(id)}<button class="gold" data-a="pick:${i}">Take</button></div>`).concat('<div class="row"><button data-a="skip">Take nothing</button></div>'), `Charm slots ${r.charms.length}/${db.config.charmSlots}.`);
  if (o.kind === 'guardian') return pickList('Guardian Reward', o.options.map((g, i) => `<div class="pick glass">${g.kind === 'card' ? face(g.entry) : g.kind === 'masterwork' ? relicRow(g.id) : '<div class="col">' + g.ids.map(id => relicRow(id)).join('') + '</div>'}<div class="cap"><b>${esc(g.text)}</b></div><button class="gold" data-a="pick:${i}">Choose</button></div>`), 'One of three kinds of power. The weight cap rises by 20.', 'abreast');
  if (o.kind === 'treasure') return pickList('Treasure', o.options.map((g, i) => `<div class="pick glass">${g.kind === 'card' ? face(g.entry) : relicRow(g.id)}<button class="gold" data-a="pick:${i}">Take</button></div>`), '', 'abreast');
  // Each blessing says what it changes, in the run's own numbers, so the choice is read at a glance (22 November).
  if (o.kind === 'sanctum') { const full = r.sparks >= db.config.sparks, cap = weightCap(db, r), add = db.config.prices.sanctumCap;
    return pickList('Sanctum', [`<div class="pick glass"><div><b>Take back one Spark</b><br>${full ? 'Your Sparks are full.' : `Sparks ${r.sparks} → ${r.sparks + 1}`}</div><button class="gold" data-a="pick:0" ${full ? 'disabled' : ''}>Take</button></div>`, `<div class="pick glass"><div><b>Raise your weight cap by ${add}</b><br>Cap ${cap} → ${cap + add}. Your deck weighs ${deckWeight(db, r.deck)}.</div><button class="gold" data-a="pick:1">Take</button></div>`], 'A quiet room and one candle. Take one blessing, then go on.', 'abreast two'); }
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
  return `<div class="hall"><div class="panel glass wide"><h2>Bazaar</h2><p>You have ${r.embers} Embers.</p><div class="picks shop">${o.items.map((it, i) => `<div class="pick glass k-${it.kind} ${it.sold ? 'sold' : ''}">${it.kind === 'card' ? (it.sealed ? '<div class="c back"><img decoding="sync" src="art/cardback.webp" alt=""></div>' : face(it.entry, { attrs: `data-a="inspect:${it.entry.id}"` })) : it.kind === 'charm' ? relicRow(it.id) : it.kind === 'gift' ? relicRow(it.id) + `<div class="fine oddnote"><b>From outside this descent.</b> ${r.builds ? 'Its build is not one of the two this descent carries, so no other piece of it will be offered.' : 'You hold no other piece of its build.'} It does not count toward your Gifts.</div>` : `${ART.has('face-winnower') ? '<img class="wface" decoding="sync" src="art/face-winnower.webp" alt="">' : ''}<div><b>The Winnower</b><br>Cuts one card out of your deck for the rest of the run, so the cards you want come round sooner. Tap a deck card below first. ${it.uses} cut${it.uses === 1 ? '' : 's'} left here. Your deck is ${r.deck.length} cards and cannot go below ${MIN_DECK}. A bound meld cannot be cut.</div>`}<button class="gold" data-a="buy:${i}" ${it.sold || r.embers < it.price || (it.kind === 'charm' && r.charms.length >= db.config.charmSlots) || (it.kind === 'scrap' && (G.pickDeck == null || !r.deck[G.pickDeck] || r.deck[G.pickDeck].b || r.deck.length <= MIN_DECK)) ? 'disabled' : ''}>${it.sold ? 'Sold' : it.kind === 'charm' && r.charms.length >= db.config.charmSlots ? 'Charm slots full' : (it.kind === 'scrap' && G.pickDeck != null && r.deck[G.pickDeck] ? 'Cut ' + card(r.deck[G.pickDeck].id).name + ': ' : '') + it.price + ' Embers'}</button></div>`).join('')}</div>
    ${o.merchant === 'scrapper' ? `<h3>Your deck, weakest first</h3><div class="grid">${r.deck.map((e, i) => [e, i]).sort((a, b) => cardValue(db, a[0]) - cardValue(db, b[0])).map(([e, i]) => face(e, { cls: 'small ' + (G.pickDeck === i ? 'sel' : ''), attrs: `data-a="deckpick:${i}"` })).join('')}</div>` : ''}<div class="row"><button data-a="leave">Leave</button></div></div></div>`;
}
function screenOver() {
  const r = G.run, S = r.stats, R = G.results;
  return `<div class="hall"><div class="panel glass wide scroll"><h2>${r.result.won ? 'The pyramid is cleared' : `${r.result.reason === 'abandoned' ? 'You left the pyramid' : 'The run ends'} · Floor ${r.floor + 1}, Chamber ${Math.min(6, r.chamber + 1)}`}</h2>
    ${R ? R.unlocks.filter(u => u.kind !== 'heat' || u.id <= heatTop()).map(u => u.kind === 'heat' && labs.heat ? { ...u, name: `Heat ${u.id}, ${HEAT_RULES[u.id - 1].name}`, text: HEAT_RULES[u.id - 1].text + ' It pays more Memories.' } : u).map(u => u.kind === 'gift' ? `<div class="unlock glass gift">${relicImg(u.id)}<div><b>New Gift unlocked: ${esc(u.name)}</b> <small>${esc(u.feat)} complete</small><br>${esc(RELICS[u.id].text)}<br><i>${esc(u.why)} It will be in the first Gift offer of your next run.</i></div></div>` : `<div class="unlock glass"><div><b>${u.kind === 'record' ? 'New record' : 'Unlocked'}: ${esc(u.name)}</b><br>${esc(u.text)}</div></div>`).join('') : ''}
    <div class="cols"><div class="box glass"><h3>This run</h3><table class="tally"><tr><td>Forger</td><td>${esc(r.forger ? FORGERS[r.forger].name : 'None')}</td></tr><tr><td>Duels won</td><td>${S.wins} of ${S.duels}</td></tr><tr><td>Guardians beaten</td><td>${S.bossWins}</td></tr><tr><td>Melds</td><td>${S.melds}</td></tr><tr><td>Ranks</td><td>${Object.entries(S.ranks).map(([k, v]) => k + '×' + v).join(' ') || 'None'}</td></tr></table></div>
    <div class="box glass"><h3>Memories earned</h3>${R ? `<table class="tally">${R.lines.map(l => `<tr><td>${esc(l[0])}</td><td>+${l[1]}</td></tr>`).join('')}</table><div class="bigm">+${R.total} Memories</div>` : '<p class="fine">Already banked.</p>'}</div></div>
    ${R && R.feats.length ? `<div class="box glass featbox"><h3>Feats</h3>${R.feats.map(featRow).join('')}<p class="fine">Feats count across runs, win or lose.</p></div>` : ''}
    <div class="row"><button class="gold" data-a="new">New run</button><button data-a="screen:codex">Codex</button><button data-a="screen:feats">Feats</button><button data-a="screen:vault">Memory Vault (${P.memories})</button><button data-a="home">Home</button></div></div></div>`;
}
const featRow = f => `<div class="feat ${f.done ? 'done' : ''}"><div><b>${esc(f.name)}</b> <small>${esc(f.build)}</small><br>${esc(f.text)}</div><div class="bar"><i style="width:${Math.round(100 * f.after / f.goal)}%"></i><u style="left:${Math.round(100 * f.before / f.goal)}%;width:${Math.round(100 * (f.after - f.before) / f.goal)}%"></u></div><span>${f.done ? 'Complete' : f.after + ' / ' + f.goal}${f.gain && !f.done ? ' (+' + f.gain + ')' : ''}</span></div>`;
const kitRows = () => FORGER_IDS.concat(HIDDEN_FORGERS).filter(id => P.forgers.includes(id)).map(id => FORGERS[id].kits.map((k, i) => { const w = forgerStats(P, id).wins, g = KIT_GOALS[i], n = Math.min(w, g), done = w >= g; return i ? `<div class="feat ${done ? 'done' : ''}"><div><b>${esc(k.name)}</b> <small>${esc(FORGERS[id].name)}</small><br>Win ${g} duels as ${esc(FORGERS[id].name)}.</div><div class="bar"><i style="width:${Math.round(100 * n / g)}%"></i></div><span>${done ? 'Open' : n + ' / ' + g}</span></div>` : ''; }).join('')).join('');
function screenFeats() {
  const rows = featList(!!labs.long).map(f => { const done = (P.featsDone || []).includes(f.id), n = done ? f.goal : (P.feats || {})[f.id] || 0; return featRow({ ...f, before: n, after: n, gain: 0, done }) + `<div class="featgift ${done ? '' : 'lockedg'}">${relicImg(f.gift)}<div><b>${esc(RELICS[f.gift].name)}</b> <small>${done ? 'Unlocked Gift' : 'Gift, locked'}</small><br>${esc(RELICS[f.gift].text)}</div></div>`; }).join('');
  const forg = FORGER_IDS.concat(HIDDEN_FORGERS.filter(id => P.forgers.includes(id))).filter(id => id !== 'tarn').map(id => `<div class="feat ${P.forgers.includes(id) ? 'done' : ''}"><div><b>${esc(FORGERS[id].name)}</b> <small>Forger</small><br>${esc(FORGER_FEATS[id].text)}</div><span>${P.forgers.includes(id) ? 'Unlocked' : 'Locked'}</span></div>`).join('');
  return `<div class="hall"><div class="panel glass wide scroll"><h2>Feats</h2><p>Each feat follows a way of playing and adds one Gift to what the forge can offer. Progress counts across runs, win or lose.</p>${rows}<h3 style="margin-top:1em">Forgers</h3>${forg}${labs.long ? `<h3 style="margin-top:1em">Starter kits</h3>${kitRows()}` : ''}<div class="row"><button class="gold" data-a="home">Back</button></div></div></div>`;
}
function tabPanel() {
  const r = G.run;
  if (G.tab === 'help') return `<div class="modal"><div class="glass panel wide"><h2>How a duel works</h2><ul><li>Each turn: draw toward five cards (two a turn at most), play one card or one meld, then attack.</li><li>Meld: tap two or more hand cards in order. They combine left to right into one monster. Tap one of your table monsters first to meld onto it.</li><li>Monsters fight with their printed ATK and DEF. Effects printed on a card are not used in Lost Memories.</li><li>Attack position fights with ATK. Defense uses DEF and protects your Life Points. Veiled is face down in defense.</li><li>WATER beats FIRE beats WIND beats EARTH beats WATER. LIGHT and DARK beat each other when attacking. The edge is +500 for that battle.</li><li>Field Spells set the terrain (+500 for its Types). ${db.config.equipKinds ? 'Equips differ: one made for a Type or an Attribute gives +800 to that kind and +300 to any other, judged when it is attached, so in a meld attach it after the right monster is made. Blades give ATK only, armour DEF only, the rest +500. Each card says which it is.' : 'Equips give +500.'} Traps wait face down for an attack. Other cards are fuel: +300 in a meld.</li><li>Play comes before attacks. A monster that attacked or just arrived cannot change position.</li><li>Lose a duel and you lose a Spark. The boss door needs two seals, one from each duel you win on the floor.</li></ul><div class="row"><button class="gold" data-a="tab:">Close</button><button data-a="relearn">Show the first lessons again</button></div></div></div>`;
  if (G.tab === 'sound') return `<div class="modal"><div class="glass panel"><h2>Sound</h2><div id="soundslot" class="soundslot"></div><p class="fine">Draft sounds: made by machine and not yet listened to by anyone. Say which ones are wrong.</p><div class="row"><button class="gold" data-a="tab:">Close</button></div></div></div>`;
  if (!r) return '';
  if (G.tab === 'relics') return `<div class="modal"><div class="glass panel wide"><h2>Your relics</h2>${relicList(r).map(id => relicRow(id)).join('') || '<p>None yet.</p>'}${possibleMasterworks(r).map(id => `<p class="fine">Masterwork ready at an Anvil: ${esc(RELICS[id].name)}.</p>`).join('')}<div class="row"><button class="gold" data-a="tab:">Close</button></div></div></div>`;
  if (G.tab === 'deck') return `<div class="modal"><div class="glass panel wide"><h2>Deck ${r.deck.length} cards · weight ${deckWeight(db, r.deck)}/${weightCap(db, r)}</h2><p>${r.phase === 'chamber' ? 'Tap a deck card, then a trunk card, to swap them.' : 'You can swap cards between duels, in a chamber.'}</p><div class="grid">${deckList(r.deck, 'deckpick', G.pickDeck)}</div><h3>Trunk ${r.trunk.length}</h3><div class="grid">${deckList(r.trunk, 'trunkpick', G.pickTrunk) || '<span class="fine">Empty.</span>'}</div><div class="row"><button class="gold" data-a="tab:">Close</button></div></div></div>`;
  return '';
}
// What a run would bank if it ended now (nothing is changed).
const worth = run => scoreRun(P, { ...run, result: { won: false, reason: 'abandoned' } });
function overlay() {
  const o = G.overlay; if (!o || G.playing) return '';
  if (o.kind === 'duelEnd') { const s = o.sum; return `<div class="modal"><div class="glass panel"><h2>${s.won ? 'Victory' : 'Defeat'}</h2><p>${esc(o.rival ? o.rival.name : '')} · ${s.turns} turns${s.reason === 'deckout' ? ' · a deck ran out' : ''}</p>${s.won ? `<div class="rankbig">${s.rank.rank}</div><table>${s.rank.lines.filter(l => l[1]).map(l => `<tr><td>${esc(l[0])}</td><td>${l[1] > 0 ? '+' : ''}${l[1]}</td></tr>`).join('')}<tr><td><b>Total</b></td><td><b>${s.rank.points}</b></td></tr></table><p>Style: ${s.rank.style === 'craft' ? 'Craft' : 'Fury'} · Embers +${s.embers}${s.bountyMet ? ' · Bounty met' : ''}</p>` : `<p>You lose a Spark. ${G.run.sparks} left.</p>${(o.why || []).length ? `<div class="why"><b>What happened</b><ul>${o.why.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>` : ''}`}<div class="row"><button class="gold" data-a="closeov">Continue</button></div></div></div>`; }
  if (o.kind === 'moved') return `<div class="modal"><div class="glass panel leave moved"><h2>This run moved on</h2><p>${o.asked ? 'The run that question was about was ended or carried on in another tab or window after the question was shown. Nothing was changed from here, and nothing was lost.' : o.unsaved ? 'This tab could not save its last moves, and meanwhile the run was ended or carried on in another tab or window. The saved game was left as that tab wrote it. What this tab had not saved cannot be carried on. ' + (store.failed.has(UNSAVED) ? 'This device has not stored a copy of it yet: tap Try again at the top of the screen.' : 'A copy of it was kept on this device.') : 'The run was carried on in another tab or window, so what this tab shows is behind it. Nothing can be done to the run from here, and nothing was lost.'}</p><div class="row"><button class="gold" data-a="leavetab">Back to the start</button></div></div></div>`;
  if (o.kind === 'leave') { const run = o.saved || G.run, w = worth(run), S = run.stats;
    return `<div class="modal"><div class="glass panel leave"><h2>${o.saved ? 'You have a run in progress' : 'Leave the pyramid?'}</h2>
      <p>${o.saved ? `${esc(run.forger ? FORGERS[run.forger].name : 'No Forger')}, Floor ${run.floor + 1}, Chamber ${Math.min(6, run.chamber + 1)}. Starting a new run ends that one.` : 'Leaving ends this run as a loss. It cannot be continued afterwards.'}</p>
      <p><b>You keep what it earned:</b> ${w.total} Memories, ${S.wins} duel${S.wins === 1 ? '' : 's'} won and your feat progress${w.fresh.length ? `, and ${w.fresh.length} new meld${w.fresh.length === 1 ? '' : 's'} in the Codex` : ''}.${run.phase === 'duel' ? ' The duel you are in does not count.' : ''}</p>
      <div class="row">${o.saved ? '<button class="gold" data-a="resume">Continue that run</button><button data-a="bankold">Bank it and start a new run</button><button data-a="closeov">Back</button>' : '<button class="gold" data-a="closeov">Keep playing</button><button data-a="abandon">Leave and bank it</button>'}</div></div></div>`; }
  if (o.kind === 'heat') return `<div class="modal"><div class="glass panel"><h2>Heat ${o.n}</h2><p>Every rule below is in force on this descent.</p><div class="heatlist">${HEAT_RULES.filter(x => x.n <= o.n).map(x => `<div><i>${x.n}</i><span><b>${esc(x.name)}.</b> ${esc(x.text)}</span></div>`).join('')}</div><div class="row"><button class="gold" data-a="closeov">Close</button></div></div></div>`;
  return '';
}
function inspectPanel() {
  if (!G.inspect) return '';
  const c = card(G.inspect.id);
  return `<div class="modal" data-a="closeinspect"><div class="glass panel insp">${face(G.inspect, { cls: 'big' })}<div><h3>${esc(c.name)}</h3>${db.isMonster(c.id) ? `<p>${esc(c.type)} · ${esc(c.attr)} · Level ${c.level}<br>ATK ${c.atk} · DEF ${c.def}${G.inspect.ea != null ? `<br>Now ${G.inspect.ea} / ${G.inspect.ed}` : ''}</p>` : ''}<p>${esc(rulesText(c.id))}</p>${G.inspect.e ? `<p><b>Enchant, ${cap(G.inspect.e)}:</b> ${esc(ENCHANT_TEXT[G.inspect.e])}${G.inspect.bulwarkUsed || G.inspect.x ? ' <i>Used this duel.</i>' : ''}</p>` : ''}<p class="fine">Weight ${weightOf(db, c.id)}. Tap anywhere to close.</p></div></div></div>`;
}

// Reports a fault the page recovered from without stopping the page: the checks and the click bot count page errors.
function later(e) { try { (window.LM.faults = window.LM.faults || []).push(String(e && e.stack || e)); } catch { /* start-up: LM is not there yet */ } setTimeout(() => { throw new Error('recovered: ' + (e && e.message)); }); }
function movedOn() {
  let unsaved = !!(G.overlay && G.overlay.kind === 'moved' && G.overlay.unsaved);
  if (unsavedRun()) { // this tab's waiting write must never be stored now: keep a copy aside and stop offering to save it
    const mine = store.failed.get(SAVE); store.failed.delete(SAVE); store.failed.delete(REV); store.failed.delete(RUNLABS); unsaved = true; // the switch set belongs to that run too
    if (mine) store.set(UNSAVED, mine); // if the device still cannot store, the copy waits with the bar and Try again
  }
  store.retry(k => k !== PROFILE); // what else waits (the cards seen, the copy) is stored if the device can; the profile has its own care under Try again
  G.sel = []; G.onto = G.attacker = G.aim = G.inspect = null; G.tab = null; G.rev = -1; G.at = null; // from here this tab never counts as holding the stored run, whatever number the other tab reaches
  G.overlay = { kind: 'moved', unsaved }; render();
}
// A run that cannot be shown or cannot take a move must never leave a dead page. The page goes back to the start.
// The stored run is set aside only when it could not even be shown after Continue, or failed a move twice running;
// otherwise it stays stored as it was.
function recover(e, moving) {
  const r = G.run, drop = !!r && r.phase !== 'over' && (G.fresh || (moving && G.faulty === uidOf(r)));
  if (r && moving) G.faulty = uidOf(r);
  Object.assign(G, { run: null, sel: [], onto: null, attacker: null, aim: null, frames: [], playing: false, shown: null, inspect: null, overlay: null, tab: null, screen: null, story: null, results: null, banked: false, fresh: false }); held.length = 0; holding = false;
  if (drop) { const s = store.get(SAVE); if (s && uidOf(s) === uidOf(r)) setAside(s); G.notice = 'Your run in progress could not be read and cannot be continued. A copy was kept on this device.'; }
  else G.notice = 'Something went wrong on that screen, so you are back at the start.' + (r && r.phase !== 'over' ? ' Your run is saved as it was before.' : '');
  setLabs(pref); later(e);
  try { draw(); } catch (e2) { app.innerHTML = `<div class="hall home"><div class="title"><h1>LOST MEMORIES</h1><p class="notice glass">${esc(G.notice)} Reload this page to go on.</p></div></div>`; later(e2); }
}
// Era look (Lab switch, display only): the layers under every screen. They sit below the page's own elements, so fog and
// grain never cross a number, a card or a button.
const ERA_LAYERS = '<div class="eraBg"></div><div class="eraFog"><i></i><i></i></div><div class="eraGrain"></div>'; // names of their own: a duel's twist puts the class fog on the table (found 22 November)
const sparksMax = r => db.config.sparks - (db.config.heatRules && (r.heat || 0) >= 7 ? 1 : 0); // as newRun deals them
const fogK = r => !r || r.phase === 'over' ? .8 : Math.max(.7, Math.min(1.3, .75 + .025 * (r.heat || 0) + .12 * Math.max(0, 3 - (r.sparks ?? 3))));
let booting = false; // while the console pictures arrive, nothing is drawn over the loading screen
function render() { if (booting) return; try { draw(); G.fresh = false; } catch (e) { recover(e, false); } }
function draw() {
  if (lostStore) { // the store came back empty in a tab that had progress: nothing is drawn but the notice, and nothing is written
    app.dataset.phase = 'home';
    app.innerHTML = '<div class="modal"><div class="glass panel leave moved"><h2>Your saved progress did not load</h2><p>This browser handed the game an empty store just now, though this tab held your progress a moment ago. That can happen when a device is busy. Nothing has been changed, and what you saved should still be there.</p><div class="row"><button class="gold" data-a="loadagain">Load the page again</button><button data-a="startempty">Start without it</button></div><p><small>Start without it only if you cleared this site\'s data yourself.</small></p></div></div>';
    return;
  }
  const psOn = psScreen();
  if (psOn) { drawConsole(psOn); screenCue(); return; }
  if (app.classList.contains('ps')) { app.classList.remove('ps'); document.body.classList.remove('ps'); app.style.margin = app.style.left = app.style.top = app.style.transformOrigin = ''; fit(); }
  const r = G.run; let body;
  if (G.screen) body = { forger: screenForger, vault: screenVault, codex: screenCodex, feats: screenFeats, ach: screenFeats }[G.screen]();
  else if (!r) body = screenHome();
  else if (G.shown || r.phase === 'duel') body = screenDuel();
  else body = { kit: screenKit, charm: screenCharm, chamber: screenChamber, reward: screenReward, anvil: screenAnvil, bazaar: screenBazaar, over: screenOver }[r.phase]();
  const rulesAt = ($('.rules') || {}).scrollTop || 0; // the duel rules box keeps its place when the screen is drawn again
  const era = !!pref.era; app.classList.toggle('era', era);
  app.innerHTML = `${era ? ERA_LAYERS : ''}${G.screen || G.shown || (r && (r.phase === 'duel' || r.phase === 'over')) ? '' : hud()}${body}${tabPanel()}${overlay()}${inspectPanel()}${storyPanel()}${store.failed.size ? `<div class="savebar"><b>Not saved.</b> This device would not store your progress (its storage is full or blocked). You can keep playing, but closing this page now would lose ${store.failed.has(PROFILE) ? 'what you have earned' : unsavedRun() ? 'this run' : store.failed.has(UNSAVED) ? 'the copy of the run this tab could not save' : store.failed.has(KNOWN) ? 'the list of cards you have seen' : 'your settings'}. <button data-a="resave">Try again</button></div>` : ''}<div id="toast" class="toast">${esc(G.toast)}</div>`;
  app.dataset.phase = r ? (G.shown ? 'duel' : r.phase) : 'home';
  { const fl = r && r.phase !== 'over' && !G.screen ? r.floor + 1 : 0; app.dataset.room = fl >= 2 && ART.has('hall-' + (app.dataset.phase === 'duel' ? 'duel' : 'doors') + '-' + fl) ? String(fl) : ''; } // floors two and three have rooms of their own when the art folder holds them
  { const rb = $('.rules'); if (rb) { rb.scrollTop = rulesAt; moreBelow(rb); } const tl = $('.trayline'); if (tl) moreBelow(tl); }
  { const slot = $('#soundslot'); if (slot && window.LMAudio && window.LMAudio.panel) { try { slot.appendChild(window.LMAudio.panel()); } catch (e) { slot.textContent = 'Sound is not available in this browser.'; } } }
  if (era) app.style.setProperty('--fog', String(fogK(r))); // Era look: the fog thickens as Sparks are lost and Heat rises
  screenCue(era);
}

// ---------- the console look (ps.css, ps.mjs, raster.mjs) ----------
// On for everyone. The old look stays one switch away in Options, to compare. Every screen of a run and the three books
// (Codex, Feats, Vault) are drawn the console way; psScreen falls back to the old look for anything it does not know.
const LOOKKEY = 'lostmemories.look.v1';
// The two-screen layout, asked for with ?dual=1 (DUAL.md): the console look on a top frame of 640 x 360 and a bottom frame
// of 413 x 360. Each frame is an element of its own inside the page, kept for as long as the page lives, and the host
// that shows the game on two displays finds them in window.LM_DUAL: top and bottom (the two elements), frames (their
// sizes in frame pixels), rects() (where each stands in the page, in device pixels) and press(key), which presses a pad
// key by its name for a host that reads the pad itself. Every screen describes its parts once; with one frame they are
// placed as they always were, with two the parts are shared out between the frames (the section further down).
const DUAL = /[?&]dual=1(?:[&#]|$)/.test(location.search) || window.LM_HOST_DUAL === true; // the address asks for it, or the host page set the switch before this script ran
const scrT = Object.assign(document.createElement('div'), { className: 'scr scrT' }), scrB = Object.assign(document.createElement('div'), { className: 'scr scrB' });
if (DUAL) window.LM_DUAL = { top: scrT, bottom: scrB, frames: { top: [640, 360], bottom: [413, 360] }, press: k => padPress(k),
  rects: () => { const d = devicePixelRatio || 1, q = e => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(v => Math.round(v * d)); }; return { top: q(scrT), bottom: q(scrB), scale: F.n }; }, walk: () => navWalk() };
const fitFrame = () => DUAL ? fitDual(app, scrT, scrB) : fitConsole(app);
let look = store.get(LOOKKEY) || D.look || 'ps';
const CART = new Set((D.cart && D.cart.art) || []);
// The console pictures arrive in one pack (tools/crucible/build-web.mjs lists where each sits in it), cut out here as
// pictures of their own. Without a pack, or if it cannot be read, each picture is asked for by its own file.
const PACK = (D.cart && D.cart.pack) || null, PURL = Object.create(null);
const cimg = n => PURL[n] || `art/c/${n}.png`;
let packing = null, packShow = null, packDone = !PACK;
function loadPack(show) {
  if (show) packShow = show;
  if (!PACK) return Promise.resolve();
  return packing || (packing = (async () => {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null; let idle = 0;
    const wake = () => { clearTimeout(idle); idle = setTimeout(() => { if (ctl) ctl.abort(); }, 20000); }; // no bytes for 20 seconds: stop waiting
    try {
      wake(); const res = await fetch('art/c/' + PACK.file, ctl ? { signal: ctl.signal } : undefined);
      if (!res.ok) throw new Error('pack ' + res.status);
      const size = PACK.size || 0, rd = res.body && res.body.getReader ? res.body.getReader() : null, parts = []; let got = 0;
      if (rd) for (;;) { const { done, value } = await rd.read(); if (done) break; wake(); parts.push(value); got += value.length; if (packShow && size) packShow(Math.min(99, Math.floor(got * 100 / size))); }
      else parts.push(await res.arrayBuffer());
      const all = new Blob(parts); // counted against the pack's own size, never the transfer's (a host may send it compressed)
      if (size && all.size !== size) throw new Error(`pack ${all.size} of ${size} bytes`);
      for (const [n, [o, l]] of Object.entries(PACK.at)) PURL[n] = URL.createObjectURL(all.slice(o, o + l, 'image/png'));
    } catch (e) { /* the pictures are then asked for one by one, each by its own file */ } finally { clearTimeout(idle); packDone = true; }
  })());
}
// The wait, drawn the way a game of the day drew its own: black, the turning crest and two words. It is a screen of the
// frame like any other, so it has the frame's whole pixels and turns with it on a phone held upright; every part is
// placed at a whole frame pixel (the word in the label face at twice its size, the coin at its own size).
function bootScreen(p) {
  let b = document.getElementById('boot');
  if (!b || !app.contains(b)) {
    app.classList.add('ps'); app.classList.remove('phone', 'era'); document.body.classList.add('ps'); fitFrame();
    { const n = document.getElementById('turn'); if (n) n.remove(); } // the old look's turn-your-phone note: the frame turns by itself
    const boot = '<div id="boot" class="ab"><canvas id="bootcoin" class="ab" width="64" height="64"></canvas><i class="ab bw"></i><b class="ab lb bpc"></b></div>';
    // with two frames the coin and the words turn on the top one, and the bottom one says what is being waited for
    if (DUAL) { app.classList.add('dual'); app.innerHTML = ''; app.append(scrT, scrB); scrT.innerHTML = boot; scrB.innerHTML = box(0, 0, 413, 360, 'st dk') + box(104, 150, 205, 60, 'wn', lb(8, 8, 'LOST MEMORIES', 'g') + lb(8, 24, 'THE PICTURES ARE COMING IN') + lb(8, 40, 'THE GAME BEGINS BY ITSELF', 'd')); }
    else app.innerHTML = boot;
    b = document.getElementById('boot'); coinLoop(); pixelText(); // the body face struck on whole pixels while the pictures load
  }
  { const w = b.querySelector('.bw'), c = carve('NOW LOADING', 16, () => { if (booting) bootScreen(); }); if (c && w.dataset.f !== c.url) { w.dataset.f = c.url; w.innerHTML = `<img src="${c.url}" width="${c.w}" height="${c.h}" alt="NOW LOADING">`; } } // carved in the capitals of the book headings, once their face is in
  if (p !== undefined) bootScreen.p = p; p = bootScreen.p; // a new frame size lays out the last share again
  const { W, H } = F, top = (H - 98) >> 1, w = b.querySelector('.bw'), q = b.querySelector('.bpc');
  Object.assign(b.querySelector('canvas').style, { left: ((W - 64) >> 1) + 'px', top: top + 'px' });
  q.textContent = p == null ? '' : p + '%'; // each word centred from its own width, so it starts on a whole pixel
  w.style.left = ((W - w.offsetWidth) >> 1) + 'px'; w.style.top = top + 70 + 'px'; q.style.left = ((W - q.offsetWidth) >> 1) + 'px'; q.style.top = top + 92 + 'px';
}
// ---- the crest as a struck coin that turns: on the loading screen, and beside the lit choice on the title as its
// cursor. A 12-sided disc with a rim, the crest on both faces, drawn by the same renderer as the table. The crest
// picture comes inside the page (D.cart.crest), so it turns before the picture pack has arrived.
const COIN = { tex: null, asked: false, small: null };
function coinTex() {
  if (COIN.asked || !(D.cart && D.cart.crest)) return COIN.tex; COIN.asked = true;
  const im = new Image(); im.onload = () => { try {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.fillStyle = '#5c3d1c'; x.beginPath(); x.arc(32, 32, 31, 0, Math.PI * 2); x.fill(); // the struck bronze
    x.strokeStyle = '#d6ad5c'; x.lineWidth = 3; x.beginPath(); x.arc(32, 32, 29, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = '#2a1a0c'; x.lineWidth = 1; x.beginPath(); x.arc(32, 32, 26.5, 0, Math.PI * 2); x.stroke();
    x.drawImage(im, 8, 8, 48, 48); COIN.tex = R3.crunch(R3.texFrom(c, 64, 64)); } catch { /* a plain disc then */ } };
  im.src = D.cart.crest; return null;
}
// The cursor coin on the title is 16 pixels: the crest's wreath would be a smudge there, so its faces are struck plainer, a
// bright rim round a dark field and the hammer in the middle, which read at that size as the crest does on the large coin.
function coinTexSmall() {
  if (COIN.small) return COIN.small;
  try {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#f0cc70'; x.beginPath(); x.arc(32, 32, 32, 0, Math.PI * 2); x.fill(); // the rim, bright gold
    x.fillStyle = '#4a2a12'; x.beginPath(); x.arc(32, 32, 22, 0, Math.PI * 2); x.fill(); // the field, dark bronze
    x.fillStyle = '#ffe8a8'; x.fillRect(18, 18, 28, 10); x.fillRect(28, 28, 8, 20); // the hammer: head and handle
    COIN.small = R3.crunch(R3.texFrom(c, 64, 64));
  } catch { COIN.small = null; }
  return COIN.small;
}
function paintCoin(cv, a) {
  const w = cv.width, h = cv.height, view = R3.makeView(cv, w, h); view.px.fill(0);
  const R = 100, T = 16, N = 12, ca = Math.cos(a), sa = Math.sin(a), t = w <= 24 ? coinTexSmall() : coinTex();
  const P = (x, y, z) => [x * ca + z * sa, y, -x * sa + z * ca], ring = i => { const q = i / N * Math.PI * 2; return [Math.cos(q) * R, Math.sin(q) * R]; };
  const lo = w <= 24 ? .8 : .5; // the small coin is lit more evenly, so its rim stays bright beside the plaques as it turns
  const L = [-.4, .5, .77], lit = n => { const m = P(...n); return lo + (1.15 - lo) * Math.max(0, m[0] * L[0] + m[1] * L[1] + m[2] * L[2]); };
  const uv = (x, y) => [(.5 + .5 * x / R) * 63, (.5 - .5 * y / R) * 63];
  for (let i = 0; i < N; i++) { const [x0, y0] = ring(i), [x1, y1] = ring(i + 1);
    const face = (z, back) => { const pts = back ? [[0, 0], [x1, y1], [x0, y0], [0, 0]] : [[0, 0], [x0, y0], [x1, y1], [0, 0]];
      // the back is the same crest seen from behind, so it reads the right way round once the coin has turned
      R3.quad(view, { p: pts.map(([x, y]) => P(x, y, z)), uv: pts.map(([x, y]) => uv(back ? -x : x, y)), tex: t || undefined, col: t ? undefined : [120, 84, 40], shade: lit([0, 0, back ? -1 : 1]), cull: true }); };
    face(T / 2, false); face(-T / 2, true);
    const mx = (x0 + x1) / 2 / R, my = (y0 + y1) / 2 / R; // the rim, bright gold where the light catches it
    R3.quad(view, { p: [P(x0, y0, T / 2), P(x0, y0, -T / 2), P(x1, y1, -T / 2), P(x1, y1, T / 2)], uv: [[0, 0], [0, 0], [0, 0], [0, 0]], col: [200, 158, 80], shade: lit([mx, my, 0]), cull: true }); }
  R3.draw(view, R3.camera({ y: 0, z: 1000, pitch: 0, f: Math.round((h / 2 - 1) * 1000 / (R + T)), cx: w >> 1, cy: h >> 1 })); R3.present(view);
}
let coinRaf = 0;
function coinLoop() {
  cancelAnimationFrame(coinRaf);
  const cs = ['bootcoin', 'coin'].map(id => document.getElementById(id)).filter(Boolean); if (!cs.length) return;
  const t = Math.floor(performance.now() * .03) / .03, a = t / 2400 * Math.PI * 2; // a turn in 2.4 seconds, in thirtieths
  for (const cv of cs) if (cv.dataset.t !== String(t)) { cv.dataset.t = t; paintCoin(cv, a); }
  coinRaf = requestAnimationFrame(coinLoop);
}
// The models' skins and the duel table's pictures load with the pack, so the first room, forge beat or duel frame is
// drawn whole (a slow one is not waited on for more than three seconds).
function bootWait() { booting = true; bootScreen(); return loadPack(bootScreen).then(() => Promise.race([Promise.all([propTextures(), psTextures()]), new Promise(ok => setTimeout(ok, 3000))])).then(() => { const b = document.getElementById('boot'); if (b) b.remove(); booting = false; render(); }); }
const faceName = id => 'face-' + (id === 'last' ? 'last-one' : id);
const relicFile = id => (RELICS[id].kind === 'M' ? 'masterwork' : 'relic') + '-' + id.replace(/_/g, '-');
// Card pictures at console size: each sheet of 100 shrunk to 40 (and, for the card page, 96) pixels a card and cut to
// 15-bit colour when the game loads. A page opened straight from the disk may not read its own pictures: it then shows
// the sheets as they are, shrunk without smoothing.
const CSHEET = { 40: [], 64: [], 96: [] }, CCANVAS = [];
function convertSheets(size) {
  if (!D.sheets || convertSheets[size]) return; convertSheets[size] = 1;
  if (DUAL && size === 40) convertSheets(96); // with two frames every card under the cursor is shown large: its sheet is made ready before it is asked for
  const n = Math.ceil(D.pool.cards.length / 100);
  for (let i = 0; i < n; i++) {
    // With two frames each finished sheet is also held decoded, so the first card shown from it is drawn at once.
    const im = new Image(); im.onload = () => {
      const t = R3.crunch(R3.texFrom(im, size * 10, size * 10, 0, 0, im.naturalWidth, im.naturalHeight)); if (!t) return;
      const c = document.createElement('canvas'); c.width = c.height = size * 10; const x = c.getContext('2d'); const id = x.createImageData(size * 10, size * 10); new Uint32Array(id.data.buffer).set(t.d); x.putImageData(id, 0, 0);
      if (size === 40) CCANVAS[i] = t;
      c.toBlob(b => { if (!b) return; CSHEET[size][i] = URL.createObjectURL(b); if (DUAL) { const pre = new Image(); pre.src = CSHEET[size][i]; if (pre.decode) pre.decode().catch(() => {}); (convertSheets.kept = convertSheets.kept || []).push(pre); } clearTimeout(convertSheets.t); convertSheets.t = setTimeout(() => { TEX.cards.clear(); if (app.classList.contains('ps')) render(); }, 60); });
    };
    im.src = D.sheets + i + '.webp';
  }
}
const cpic = (id, size) => { const i = IDX.get(id); if (i == null || !D.sheets) return ''; const s = Math.floor(i / 100), k = i % 100, url = CSHEET[size][s]; if (!url) { convertSheets(size); return ''; } /* shown only once cut to console colour */ return `background-image:url(${url});background-size:${size * 10}px ${size * 10}px;background-position:-${(k % 10) * size}px -${Math.floor(k / 10) * size}px`; };

// A card, 44 x 60: its picture, then ATK over DEF, or what kind of card it is.
function psCard(inst, x, y, o = {}) {
  if (!inst) return '';
  const pos = x == null ? 'position:relative' : `left:${x}px;top:${y}px`;
  if (inst.veil && !inst.id) return `<button class="cd back ${o.cls || ''}" style="${pos}" ${o.attrs || ''}><i class="art"></i></button>`;
  const c = card(inst.id), role = roleOf(db, inst.id), mon = role === 'monster';
  const a = inst.ea ?? (c.atk + (inst.t ? 300 : 0) + (inst.ba || 0)), d = inst.ed ?? (c.def + (inst.t ? 300 : 0) + (inst.bd || 0));
  const up = mon && (a > c.atk || d > c.def), down = mon && a < c.atk;
  return `<button class="cd ${role}${up ? ' up' : ''}${down ? ' down' : ''} ${o.cls || ''}" style="${pos}" ${o.attrs || ''} data-id="${inst.id}" aria-label="${esc(c.name)}"><i class="art" style="${cpic(inst.id, 40)}"></i>${mon ? `<i class="n1">${a}</i><i class="n2">${d}</i>` : `<i class="n1">${role === 'fuel' ? 'FUEL' : role.toUpperCase()}</i>`}${inst.e ? (CART.has('enchant-' + inst.e) ? `<img class="en" src="${cimg('enchant-' + inst.e)}" width="16" height="16" alt="">` : '<i class="en"></i>') : ''}${o.badge ? `<i class="bd">${o.badge}</i>` : o.pip ? `<i class="pp">${o.pip}</i>` : ''}</button>`;
}
// A portrait. Someone with no face of their own (a rival of the halls) shows the crest of the pyramid's keepers.
// A card on a plinth, 68 x 92: its picture at 64. On a short plinth the card may stand with its last 6 rows (the blank
// under its numbers and its border) behind the name plate in front of it; with the 2 pixels a plinth keeps between its
// picture and its plate, the card then reaches CARD_FOOT rows past the room kept for its picture. RIM: from a plinth's
// border to the outline of what stands on it, the ring and a pixel of plinth (psOffer).
const CARD_FOOT = 8, RIM = 2;
// o.small: the card at its table size, 44 x 60, its picture at 40 and its numbers bare, for a plinth too low for the large one.
function psCardL(inst, x, y, o = {}) {
  const c = card(inst.id), role = roleOf(db, inst.id), mon = role === 'monster', a = c.atk + (inst.t ? 300 : 0), d = c.def + (inst.t ? 300 : 0), s = o.small;
  return `<i class="cd${s ? '' : ' l'} ${role} ${o.cls || ''}" style="left:${x}px;top:${y}px"><i class="art" style="${cpic(inst.id, s ? 40 : 64)}"></i>${mon ? `<i class="n1">${s ? '' : 'ATK '}${a}</i><i class="n2">${s ? '' : 'DEF '}${d}</i>` : `<i class="n1">${role === 'fuel' ? 'FUEL' : role.toUpperCase()}</i>`}${inst.e ? (CART.has('enchant-' + inst.e) ? `<img class="en" src="${cimg('enchant-' + inst.e)}" width="16" height="16" alt="">` : '<i class="en"></i>') : ''}</i>`;
}
// An item's medallion; one without a picture yet is a blank medallion of its kind with its first letter struck in.
const medal = (id, size) => { const f = relicFile(id) + (size === 32 ? '' : '-' + size); if (CART.has(f)) return `<img src="${cimg(f)}" width="${size}" height="${size}" alt="">`;
  const b = 'coin-' + ({ C: 'c', M: 'm' }[RELICS[id].kind] || 'g') + (size === 32 ? '' : '-' + size), L = RELICS[id].name.replace(/^The /, '')[0].toUpperCase(), c = carve(L, Math.round(size * .5), render);
  return `<i class="coin s${size}">${CART.has(b) ? `<img src="${cimg(b)}" width="${size}" height="${size}" alt="">` : ''}${c ? `<img class="lt" src="${c.url}" style="left:${(size - c.w + 2) >> 1}px;top:${(size - c.h + 3) >> 1}px;width:${c.w}px;height:${c.h}px" alt="">` : `<b>${esc(L)}</b>`}</i>`; };
// pic names the portrait for what is placed on it (a duel's Life Points rising over the face they struck).
const psPort = (n, x, y, shade = false, pic = '') => `<div class="pf ${n && CART.has(n) ? (shade ? 'pflk' : '') : 'none'}"${pic ? ` data-face="${pic}"` : ''} style="left:${x}px;top:${y}px">${n && CART.has(n) ? `<img${pic ? ` data-pic="${pic}"` : ''} src="${cimg(n)}" alt="">` : CART.has('key-crest-48') ? `<img class="crest" src="${cimg('key-crest-48')}" alt="">` : ''}</div>`;
const shortName = s => String(s || '').replace(/^the /i, '');
const stop = s => { s = String(s || '').trim(); return !s || /[.!?]$/.test(s) ? s : s + '.'; }; // a sentence ends once
// The Forge level: how far toward the next Gift (the same sums as the engine's level-up).
const forgeFrac = r => { const c = db.config, at = l => l === 0 && c.giftFirstXp ? Math.min(c.giftFirstXp, c.xp.perLevel * (c.giftXpScale || 1)) : (l + 1) * c.xp.perLevel * (c.giftXpScale || 1); const lo = r.level ? at(r.level - 1) : 0, hi = at(r.level); return Math.max(0, Math.min(1, (r.xp - lo) / Math.max(1, hi - lo))); };
const sparkRow = (r, x, y) => Array.from({ length: sparksMax(r) }, (_, i) => `<i class="spk${i < r.sparks ? '' : ' out'}" style="left:${x + i * 12}px;top:${y}px"></i>`).join('');

// The left pillar: you.
// In a duel the Life Points shown are the beat's (lifeAt draws the number): they fall as the blow lands, not before.
function psYou(r, v = null, extra = '', lifeAt = null) {
  const f = r && r.forger;
  let s = psPort(f ? faceName(f) : '', 14, 6, false, v ? 'face0' : '') + lb(8, 79, f ? shortName(FORGERS[f].name) : 'YOU', 'g');
  if (v) { const L = lpNow(v, 0);
    s += lb(8, 92, 'LIFE', 'g') + (lifeAt ? lifeAt('myLp', L) : `<b id="myLp" class="ab lb" style="left:${88 - String(L.n).length * 6}px;top:92px">${L.n}</b>`) + gauge(8, 101, 80, L.g / 8000).replace('<i class="ga', '<i id="myGa" class="ga')
      + lb(8, 114, 'DECK', 'g') + lbr(88, 114, v.deckCount[0]) + lb(8, 125, 'TURN', 'g') + lbr(88, 125, v.turn) + lb(8, 138, 'SPARKS', 'g') + sparkRow(r, 52, 136);
  } else if (r) {
    const cap = weightCap(db, r), w = deckWeight(db, r.deck);
    s += lb(8, 92, 'SPARKS', 'g') + sparkRow(r, 52, 90) + lb(8, 106, 'EMBERS', 'g') + lbr(88, 106, r.embers)
      + lb(8, 120, 'SEALS', 'g') + [0, 1].map(i => `<i class="seal${i < Math.min(2, r.seals) ? ' on' : ''}" style="left:${64 + i * 13}px;top:118px"></i>`).join('')
      + lb(8, 134, 'WEIGHT', 'g') + lbr(88, 134, `${w}/${cap}`) + gauge(8, 143, 80, w / cap, 'w' + (w > cap ? ' over' : ''))
      + lb(8, 156, 'FORGE LV ' + r.level, 'g') + gauge(8, 165, 80, forgeFrac(r), 'x');
  }
  if (DUAL) return s + (r && !v ? lb(8, 184, 'DECK', 'g') + lbr(88, 184, r.deck.length) + lb(8, 196, 'TRUNK', 'g') + lbr(88, 196, r.trunk.length) : '') + noPq(extra); // the plaques stand on the bottom frame
  return s + extra + pq(4, yb(220), 88, 'MENU', 'tab:menu');
}

// ---- title
// The title picture's moving parts, each placed from the picture's own pixels (the 720 x 480 cut) through the same
// offset as the picture. at: the point in the picture; pin: the point of the part that sits on it.
// The torches: tools/crucible/console-art.py lifts each painted flame off its wall and sways it through a loop of
// frames, cut with the title's own colours and dither, and keeps the patch of the picture that ever changes; the patch
// is laid back exactly where it was cut from (index.json 'torches'), so its edge is the picture's own pixels.
// Nothing else moves on it: a drawn shape drifting over a painting reads as a sticker, not as the place.
// tools/crucible/console-checks.cjs measures every part against its picture.
function titleLife(ox, oy) {
  const part = (cls, at, pin, more = '') => `<i class="${cls}" data-art="title" data-at="${at}" data-pin="${pin}" style="left:${ox + at[0] - pin[0]}px;top:${oy + at[1] - pin[1]}px;${more}"></i>`;
  return (D.cart.torches || []).map(([x, y, w, h, n], i) => CART.has(`torch-${i + 1}`) ? part('flm', [x, y], [0, 0], `width:${w}px;height:${h}px;background-image:url(${cimg(`torch-${i + 1}`)});--to:-${w * n}px;animation-timing-function:steps(${n});animation-delay:-${(i * .45).toFixed(2)}s" data-frames="${n}`) : '').join('');
}
// The title's right-hand column (the logo, its line, the menu with the turning crest beside it, the saved run) and the
// picture behind it are laid out together, so that nothing of the column ever lies over a torch (each torch keeps a
// two-pixel margin). The picture stands centred if it can; else it is moved, never so far that the left torch leaves the
// frame; then the menu steps down below the right torch's foot, its line moves under the logo's right end, and the
// plaques close up to two pixels apart. The cheapest arrangement that is clear wins. The saved run lies under the menu,
// lined up with it, or, on a frame too short, beside its foot, clear of the crest's column.
const TITLE_SUB = 'BENEATH ASTERHOLD', SLOT_H = 45;
function titleLayout(W, H, items, has) {
  const T = (D.cart && D.cart.title === 720 && D.cart.torches) || [], key = [W, H, items, has, T.length].join(); if (titleLayout.key === key) return titleLayout.v;
  const dy = cy0(), cx = (W - 720) >> 1, cy = (H - 480) >> 1, mx = W - 148;
  const hit = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
  const xs = T.map(t => t[0]), xe = T.map(t => t[0] + t[2]), ys = T.map(t => t[1]), ye = T.map(t => t[1] + t[3]);
  const oxLo = T.length ? Math.max(W - 720, 2 - Math.min(...xs)) : cx, oxHi = T.length ? Math.min(0, W - 2 - Math.max(...xe)) : cx;
  const oyLo = T.length ? Math.max(H - 480, 2 - Math.min(...ys)) : cy, oyHi = T.length ? Math.min(0, H - 12 - Math.max(...ye)) : cy; // the foot line stays clear too
  const subW = TITLE_SUB.length * 6;
  let best = null;
  for (const pitch of [20, 18]) for (const subR of [false, true]) for (const below of [false, true]) for (let oy = oyLo; oy <= oyHi; oy++) {
    const mt = below ? Math.max(dy + 78, oy + Math.max(...ye, 0) + 3) : dy + 78, mh = items * pitch - (pitch - 16), mb = mt + mh;
    if (mb > H - 4) continue;
    const low = mb + 4 + SLOT_H <= H - 2, slot = has ? (low ? [mx, mb + 4, 136, SLOT_H] : [mx - 22 - 136, mb - SLOT_H, 136, SLOT_H]) : null;
    const R = [[W - 160, dy + 6, 160, 60], [subR ? W - 8 - subW : W - 154, dy + 66, subW, 8], [mx - 19, mt, 155, mh]].concat(slot ? [slot] : []);
    const cost0 = Math.abs(oy - cy) + (pitch === 18 ? 40 : 0) + (below ? 20 : 0) + (subR ? 10 : 0);
    if (best && cost0 >= best.cost) continue;
    for (let ox = oxLo; ox <= oxHi; ox++) {
      const cost = cost0 + Math.abs(ox - cx); if (best && cost >= best.cost) continue;
      if (T.some(([x, y, w, h]) => R.some(r => hit(r, [ox + x - 2, oy + y - 2, w + 4, h + 4])))) continue;
      best = { cost, ox, oy, mx, mt, pitch, subX: R[1][0], slot, low };
    }
  }
  if (!best) best = { cost: 0, ox: cx, oy: cy, mx, mt: dy + 78, pitch: 20, subX: W - 154, slot: has ? [W - 306, dy + 78 + items * 20 - 4 - SLOT_H, 136, SLOT_H] : null }; // no torches, or no room: the old place
  titleLayout.key = key; titleLayout.v = best; return best;
}
function psHome() {
  const saved = liveSave(), has = saved && saved.phase !== 'over';
  const { W, H } = F, dy = cy0();
  const items = [has && ['CONTINUE', 'resume'], ['NEW DESCENT', 'new'], [`CODEX ${G.known.size}`, 'screen:codex'], [`FEATS ${(P.featsDone || []).length}/${featList(!!labs.long).length}`, 'screen:feats'], [`MEMORY VAULT ${P.memories}`, 'screen:vault'], ['HOW TO PLAY', 'tab:help'], ['OPTIONS', 'tab:options']].filter(Boolean);
  const L = DUAL ? titleLayout(W, H, 0, false) : titleLayout(W, H, items.length, !!has), { mx, mt, pitch } = L; // with two frames the menu is on the bottom one, and the painting stands alone
  // The title picture is 720 x 480 (the whole painting at 15/32 of its size); the frame shows the part titleLayout
  // chose. The older cut, 512 x 240, is the middle band at a third of the size, and gets no moving parts.
  let pic = box(0, 0, W, H, 'st dk'), life = '';
  if (CART.has('key-title') && D.cart && D.cart.title === 720) { const { ox, oy } = L; pic = `<img class="bg" data-pic="title" src="${cimg('key-title')}" width="720" height="480" style="left:${ox}px;top:${oy}px;width:720px;height:480px" alt="">`; life = titleLife(ox, oy); }
  else if (CART.has('key-title')) { const ox = (W - 512) >> 1, oy = (H - 240) >> 1; pic = `<img class="bg" src="${cimg('key-title')}" width="512" height="240" style="left:${ox}px;top:${oy}px;width:512px;height:240px" alt="">`; }
  if (render.scr !== 'home') G.tcur = 0; // the hammer starts on the first choice; while the title stays, it stays where the mouse or the keys put it
  const cur = Math.max(0, Math.min(items.length - 1, G.tcur || 0));
  const menu = items.map(([t, a], i) => pq(mx, mt + i * pitch, 136, t, a, { lit: i === cur, cls: 'tm' })).join('') + (coinTex() || (D.cart && D.cart.crest) ? `<canvas id="coin" class="ab" width="16" height="16" style="left:${mx - 19}px;top:${mt + cur * pitch}px;pointer-events:none"></canvas>` : ''); // the turning crest marks the lit choice
  const slot = has && L.slot ? `<div class="wn runslot" style="left:${L.slot[0]}px;top:${L.slot[1]}px;width:${L.slot[2]}px;height:${L.slot[3]}px">${lb(6, 6, saved.forger ? shortName(FORGERS[saved.forger].name) : 'NO FORGER', 'g')}${lb(6, 18, `FLOOR ${saved.floor + 1} · CHAMBER ${Math.min(6, saved.chamber + 1)}`)}${lb(6, 30, `SPARKS ${saved.sparks}`)}${lbr(L.slot[2] - 6, 30, `EMBERS ${saved.embers}`)}</div>` : '';
  if (DUAL) { const at = G.look && G.look.startsWith('m:') && items.some(x => x[1] === G.look.slice(2)) ? G.look.slice(2) : items[0][1];
    return two(`<div class="ti">${pic}${life}${CART.has('key-logo') && D.cart.logo ? `<img class="ab" src="${cimg('key-logo')}" width="${D.cart.logo[0]}" height="${D.cart.logo[1]}" style="left:${W - 152}px;top:${dy + 6}px" alt="Lost Memories">` : `<div class="ab" style="left:${W - 160}px;top:${dy + 8}px;width:160px;display:flex;flex-direction:column;align-items:center;gap:0">${carveImg('LOST', 22, render)}${carveImg('MEMORIES', 22, render)}</div>`}${lb(L.subX, dy + 66, TITLE_SUB, 'd')}${G.notice ? `<div class="wn" style="position:absolute;left:8px;top:8px;width:200px;padding:5px 6px">${esc(G.notice)}</div>` : ''}${lb(8, H - 10, 'A CARDSTASHY GAME · FREE, NOT FOR SALE', 'd')}</div>`,
      menuB(items.map(([t, a]) => [t, a, '']), titlePanel(at, has ? saved : null))); }
  return `<div class="ti">${pic}${life}
    ${CART.has('key-logo') && D.cart.logo ? `<img class="ab" src="${cimg('key-logo')}" width="${D.cart.logo[0]}" height="${D.cart.logo[1]}" style="left:${W - 152}px;top:${dy + 6}px" alt="Lost Memories">` : `<div class="ab" style="left:${W - 160}px;top:${dy + 8}px;width:160px;display:flex;flex-direction:column;align-items:center;gap:0">${carveImg('LOST', 22, render)}${carveImg('MEMORIES', 22, render)}</div>`}
    ${lb(L.subX, dy + 66, TITLE_SUB, 'd')}${menu}${slot}
    ${G.notice ? `<div class="wn" style="position:absolute;left:8px;top:8px;width:200px;padding:5px 6px">${esc(G.notice)}</div>` : ''}
    ${lb(8, H - 10, 'A CARDSTASHY GAME · FREE, NOT FOR SALE', 'd')}</div>`;
}

// ---- the chamber of doors
// The room pictures are whole: 352 x 198, and 440 x 248 for a larger frame (art/c/index.json says which are there).
// The view shows the part around the doors. A room is a painting and is held still: nothing on it moves but what was
// cut from it to move, and the cursor.
// A view taller than the picture shows darkness above it (the chamber: a high ceiling lost in the dark) or below it
// (the duel hall, where the table covers it). Each dot pattern is laid on the frame's own grid of dots, wherever its
// box falls, so two patterns never meet out of step.
const meshAt = (x, y) => `background-position:${x & 1}px ${y & 1}px`; // x, y: the box's place in the view (the view itself sits on even frame pixels)
// The rooms where the view is moved off the doorways' height: the forge, to show the floor its anvil stands on.
const FOCUS = { 'room-forge': 108 };
function roomPic(name, focus, low = false) {
  const { w, h } = viewSize(), big = (w > 360 || h > 170) && CART.has(name + '-l'), s = big ? 1.25 : 1, pw = big ? 440 : 352, ph = big ? 248 : 198;
  focus = FOCUS[name] || focus;
  const ox = (w - pw) >> 1, oy = ph >= h ? -Math.max(0, Math.min(ph - h, Math.round(focus * s - h * .55))) : low ? h - ph : 0;
  // Where the view runs past the painting, its edge dissolves to black through the dot pattern: two strips laid on the
  // picture's own rows (data-art, measured like every part on it), as wide as the picture. o: the picture's corner in the
  // box the strips are laid in (the view; the room's own box in the chamber).
  const fade = (t, cls, o) => `<i class="fade${cls}" data-art="room" data-still data-at="0,${t}" data-pin="0,0" style="left:${o[0]}px;top:${o[1] + t}px;width:${pw}px;${meshAt(ox, oy + t)}"></i>`;
  const edgeAt = o => ph >= h ? '' : low ? fade(0, ' d75', o) + fade(4, '', o) : fade(ph - 8, '', o) + fade(ph - 4, ' d75', o);
  return { name, src: cimg(big ? name + '-l' : name), s, k: s / 1.25, big, ox, oy, pw, ph, edge: edgeAt([ox, oy]), edgeIn: edgeAt([0, 0]) };
}
// The picture of a room, laid at its place in the view: what every part drawn on it is measured against (data-pic).
const roomImg = rp => `<img class="ab" data-pic="room" src="${rp.src}" style="left:${rp.ox}px;top:${rp.oy}px" width="${rp.pw}" height="${rp.ph}" alt="">`;
// A part laid on the room picture at a point measured in it: at, the point in the picture; pin, the point of the part that
// sits on it. tools/crucible/console-checks.cjs measures every such part against the picture as laid out.
// o: where the picture's corner is in the part's box (the room's own box in the chamber, the view elsewhere).
// A part that never moves (a door's leaves at rest, a number on the step, a model standing in its room) carries data-still:
// it is scenery, and the choices may stand in front of it, as they stand in front of the painting. The checks keep
// controls off the parts that move (the fog, the cursor, the forge's hammer) and hold a still part to staying still.
const onPic = (tag, cls, at, pin, style = '', attrs = '', inner = '', o = [0, 0]) => `<${tag} class="${cls}" data-art="room" data-at="${at}" data-pin="${pin}" style="left:${o[0] + at[0] - pin[0]}px;top:${o[1] + at[1] - pin[1]}px;${style}" ${attrs}>${inner}</${tag}>`;
// The three empty doorways of each hall of doors, measured from the hall's own pixels at both sizes
// (tools/crucible/console-art.py, index.json 'niches'): x, y, w, h, and the stepped corners of the frame at the top
// (width and depth, left then right). Each door's leaves were cut for each doorway of each hall, toned to its stone and
// lit as the doorway is lit, so they are laid in exactly where they were cut for. Without the measures (an art folder cut
// before them) the doorways stand where they were first placed by eye.
const NICHE = [62, 145, 230], NICHE_Y = 60;
const hallInfo = hall => (D.cart && D.cart.niches && D.cart.niches[hall]) || null;
const doorways = (hall, rp) => { const m = hallInfo(hall); return m ? m[rp.big ? 'l' : 's'] : NICHE.map(x => [Math.round(x * rp.s), Math.round(NICHE_Y * rp.s), rp.big ? 78 : 62, rp.big ? 85 : 68, 0, 0, 0, 0]); };
const leafPic = (hall, art, at, rp) => hallInfo(hall) ? `leaf-${art}-${hall}-${at}${rp.big ? '-l' : ''}` : `door-${art}-leaf${rp.big ? '-l' : ''}`;
// Fog in a doorway: patches of the console's falling-off dither (fogSprite), wider than the doorway so it spills onto the
// frame and the step, its colour the hall's own stone gone pale. A door partly hidden gets a thin mist; one in fog a thick
// one and a second, paler layer drifting against it, its shape still showing at the edges.
// The patch stands still; its cloud drifts two pixels either way and back through eight frames, while its dots stay on the
// frame's grid (fogSprite), so the mist and a dimmed screen's mesh over it meet the same on every shape and at every step.
const FOG_DRIFT = [-2, -1, 0, 1, 2, 1, 0, -1];
function doorFog(d, [x, y, w, h], rp, H) {
  if (!d.know || d.know === 'known') return '';
  const pw = w + Math.round(22 * rp.k) + 4, ph = h + Math.round(16 * rp.k), at = [x + (w >> 1), y + (h >> 1) + Math.round(4 * rp.k)], pin = [pw >> 1, ph >> 1]; // 4 more across: room for the drift
  const st = (H && H.stone) || [150, 110, 70], mist = st.map(v => Math.min(255, Math.round(v * .8 + 70))), deep = d.know === 'mystery';
  const grid = [100 + rp.ox + at[0] - pin[0], 4 + rp.oy + at[1] - pin[1]].map(v => v & 3); // the patch's corner on the frame's grid: the view stands at 100, 4
  const patch = (cls, dens, rgb, gaps) => onPic('i', 'dfog ' + cls, at, pin, `width:${pw}px;height:${ph}px;background-image:url(${fogSprite(pw, ph, dens, rgb, grid, FOG_DRIFT, gaps)});--to:-${pw * FOG_DRIFT.length}px`, `data-grid="${grid}"`);
  return patch('fa', deep ? .9 : .55, mist) + (deep ? patch('fb', .6, mist.map(v => Math.min(255, v + 24)), true) : '');
}
function psChamber() {
  const r = G.run, boss = BOSSES[r.floor][r.bossOrder[r.floor]], fl = r.floor + 1;
  const hall = ART.has('hall-doors-' + fl) && CART.has('hall-doors-' + fl) ? 'hall-doors-' + fl : 'hall-doors';
  const at = r.doors.length === 1 ? [1] : r.doors.length === 2 ? [0, 2] : [0, 1, 2];
  // A cursor rests on one door, as on a pad: the ledge reads that door out, a second tap on it (or ENTER) goes in.
  const lockedAt = i => r.doors[i].type === 'boss' && r.seals < 2, key = `${r.floor}.${r.chamber}.${r.doors.map(d => d.type).join()}`;
  if (!G.doorSel || G.doorSel.at !== key || !r.doors[G.doorSel.i]) G.doorSel = { at: key, i: Math.max(0, r.doors.findIndex((d, i) => !lockedAt(i))) };
  const sel = G.doorSel.i, d = r.doors[sel], n = r.doors.length;
  // A door is closed until the player goes through it. The one just opened stands open only while the words it led to are
  // told over this chamber; once they end the player has gone through, and a chamber met again (a guardian lost to, the
  // Second Gate) shows the door shut.
  const rp = roomPic(hall, NICHE_Y + 34, true), ways = doorways(hall, rp), H = hallInfo(hall), open = G.doorOpen && G.doorOpen.at === key && G.story ? G.doorOpen : null;
  const doors = r.doors.map((d, i) => { const [x, y, w, h] = ways[at[i]], locked = lockedAt(i), art = d.type === 'secret' && CART.has(leafPic(hall, 'hidden', at[i], rp)) ? 'hidden' : DOOR_ART[d.type], leaf = leafPic(hall, art, at[i], rp); // the door that is not there has its own plain leaves
    const src = open && open.i === i ? open.url : CART.has(leaf) ? cimg(leaf) : ''; // a door opened while its guardian speaks stays open
    return onPic('button', `dr k-${d.know || 'known'}${locked ? ' lock' : ''}${i === sel ? ' on' : ''}${open && open.i === i ? ' opn' : ''}`, [x, y], [0, 0], `width:${w}px;height:${h}px;--mesh:${(rp.ox + x) & 1}px ${(rp.oy + y) & 1}px${src ? `;--lf:url(${src})` : ''}`, `data-still data-i="${i}" data-k="d${i}" data-f${i === sel ? ' data-n0' : ''} data-a="${i === sel && !(DUAL && locked) ? 'door' : 'dsel'}:${i}" ${locked && i === sel ? (DUAL ? 'aria-disabled="true"' : 'disabled') : ''} aria-label="${esc(doorName(d))}"`, src ? `<img src="${src}" width="${w}" height="${h}" style="width:${w}px;height:${h}px" alt="">` : '') + doorFog(d, [x, y, w, h], rp, H); }).join('');
  // Each door's number on the step under it, and the cursor under the chosen one, pointing up at it: clear of the carving.
  const marks = r.doors.map((d, i) => { const [x, y, w, h] = ways[at[i]], foot = [x + (w >> 1), y + h + Math.round(3 * rp.k)];
    return onPic('i', `dno${i === sel ? ' on' : ''}`, foot, [5, 0], '', 'data-still', i + 1) + (i === sel ? onPic('i', 'cur curu', [foot[0], foot[1] + 12], [4, 0]) : ''); }).join('');
  const view = `<div class="room" style="left:${rp.ox}px;top:${rp.oy}px;width:${rp.pw}px;height:${rp.ph}px"><img data-pic="room" src="${rp.src}" width="${rp.pw}" height="${rp.ph}" alt="">${doors}${keepers(r, rp, ways, H)}${marks}${rp.edgeIn}</div>`;
  const lw = ledgeW(), ledge = `<div class="dt" style="width:${lw - 82}px"><b>${sel + 1} · ${esc(doorName(d))}</b><p><i class="lmc">COST</i> ${esc(d.cost)}</p><p><i class="lmg">GAIN</i> ${esc(d.reward)}</p></div>`
    + (n > 1 ? pq(lw - 72, 4, 30, '<', `dsel:${(sel + n - 1) % n}`, { title: 'Door to the left' }) + pq(lw - 38, 4, 30, '>', `dsel:${(sel + 1) % n}`, { title: 'Door to the right' }) : '')
    + pq(lw - 72, 40, 64, lockedAt(sel) ? 'SEALED' : 'ENTER', `door:${sel}`, { lit: !lockedAt(sel), off: lockedAt(sel) });
  const secret = r.doors.some(d => d.type === 'secret');
  const said = d.law ? 'Its Law: ' + lawShown(d.law) : d.tell ? `${d.style}: ${d.tell}` : d.hidden ? d.hidden : d.know === 'mystery' ? 'Fog hides what waits behind it.' : (d.tags || []).length ? d.tags.join('. ') + '.' : '';
  const bar = [r.lastNote, said, lockedAt(sel) ? 'It needs two seals.' : '', said || r.lastNote ? '' : secret ? 'A door that was not there before.' : `Guardian of this floor: ${boss.name}. ${r.chamber >= 2 ? bossLaw(db, r) : 'Its Law shows from chamber 3.'}`].filter(Boolean).map(esc).join(' ');
  const pips = Array.from({ length: 6 }, (_, i) => `<i class="pip${i < r.chamber ? ' on' : i === r.chamber ? ' at' : ''}" style="left:${8 + i * 11}px;top:20px"></i>`).join('') + `<i class="seal${r.seals >= 2 ? ' on' : ''}" style="left:76px;top:19px"></i>`;
  const rel = relicList(r), belt = Array.from({ length: 9 }, (_, i) => { const id = rel[i]; return `<button class="sl" style="left:${8 + (i % 3) * 28}px;top:${54 + Math.floor(i / 3) * 28}px" data-a="tab:relics" aria-label="${id ? esc(RELICS[id].name) : 'Empty relic slot'}">${id ? medal(id, 24) : ''}</button>`; }).join('');
  const right = lb(8, 8, `FLOOR ${fl}`, 'g') + pips + lb(8, 40, 'RELICS', 'g') + (rel.length > 9 ? lbr(88, 40, '+' + (rel.length - 9)) : '') + belt
    + lb(8, 142, `CHARMS ${r.charms.length}/${db.config.charmSlots}`, 'g') + (db.config.heatRules && r.heat ? pq(4, yb(160), 88, `HEAT ${r.heat}`, `heatinfo:${r.heat}`) : '')
    + pq(4, yb(180), 88, 'ALL DOORS', 'tab:doors') + pq(4, yb(200), 88, 'DECK', 'tab:deck') + pq(4, yb(220), 88, 'RELICS', 'tab:relics');
  G.barText = bar;
  if (DUAL) return chamberDual({ r, sel, d, n, at, view, said, secret, boss, locked: lockedAt(sel), pips });
  return frame({ left: psYou(r), right, view, ledge, bar });
}
// Going through a door: its two leaves swing in on their hinges, four steps at twelve a second, drawn from the leaves' own
// pixels a column at a time (each leaf narrows toward its hinge and its far edge stands shorter, as the console drew a
// door turning away, with the dark of the passage behind); then the view goes dark through the half dot pattern to black
// and the next room is cut in. A guardian's or the hidden door stays open behind the words that follow it instead.
const SWING = [26, 50, 70, 84];
function doorBeat(i, stay, then) {
  const r = G.run, b = app.querySelector(`.dr[data-i="${i}"]`), img = b && b.querySelector('img'), vw = app.querySelector('.fr .vw');
  if (RM || !b || !vw) { then(); return; }
  let src = null, w = 0, h = 0;
  if (img && img.complete && img.naturalWidth && r.doors[i].type !== 'onward') { // the way on already stands open: it only darkens
    w = img.naturalWidth; h = img.naturalHeight;
    try { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, 0, 0); src = new Uint32Array(x.getImageData(0, 0, w, h).data.buffer); } catch { src = null; }
  }
  const cv = src && document.createElement('canvas');
  if (cv) { cv.width = w; cv.height = h; cv.style.cssText = `width:${w}px;height:${h}px`; img.replaceWith(cv); b.removeAttribute('data-still'); } // the leaves move now
  // The dither's place: the leaf's own place in the room picture, where its pixels were cut.
  const leafAt = b.offsetLeft & 3, rowAt = b.offsetTop & 3;
  const paint = deg => {
    const g = cv.getContext('2d'), id = g.createImageData(w, h), px = new Uint32Array(id.data.buffer), a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    const half = [[0, w >> 1, 1], [w - 1, w - (w >> 1), -1]], yc = h * .55, dark = 1 - .35 * sa; // each leaf: its hinge column, its width, the way it opens
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (src[y * w + x] >>> 24) px[y * w + x] = 0xff000000; // the passage behind, within the doorway's shape
    for (const [hx, hw, dir] of half) {
      const pw = Math.max(1, Math.round(hw * ca));
      for (let c = 0; c < pw; c++) {
        const t = (c + .5) / pw, u = Math.min(hw - 1, Math.floor(t * hw)), k = 1 - .2 * sa * t, x = hx + dir * c, sx = hx + dir * u; // the far edge stands shorter
        for (let y = 0; y < h; y++) {
          const v = Math.floor(yc + (y + .5 - yc) / k); if (v < 0 || v >= h) continue;
          const p = src[v * w + sx]; if (!(p >>> 24)) continue;
          const d = BAYER4[((y + rowAt) & 3) * 4 + ((x + leafAt) & 3)], ch = s => Math.max(0, Math.min(255, ((p >> s) & 255) * dark + d)) & 0xf8; // turned from the light: darker, cut to 15-bit colour with the dither
          px[y * w + x] = 0xff000000 | (ch(16) << 16) | (ch(8) << 8) | ch(0);
        }
      }
    }
    g.putImageData(id, 0, 0);
  };
  G.opening = true; let k = 0;
  const step = () => {
    try {
      if (cv && k < SWING.length) { paint(SWING[k++]); setTimeout(step, 83); return; }
      if (stay) { if (cv) G.doorOpen = { at: G.doorSel && G.doorSel.at, i, url: cv.toDataURL() }; }
      else if (!vw.classList.contains('dk1')) { vw.classList.add('dk1'); setTimeout(step, 83); return; }
      else if (!vw.classList.contains('dk2')) { vw.classList.add('dk2'); setTimeout(step, 83); return; }
      else G.doorOpen = null;
    } catch { G.doorOpen = null; } // a door that cannot be drawn turning is simply gone through
    G.opening = false; then();
  };
  step();
}
const BAYER4 = [-4, 0, -3, 1, 2, -2, 3, -1, -3, 1, -4, 0, 3, -1, 2, -2];

// ---- the duel: a 3D table in the window, the hand on the ledge
const TBL = { cam: { y: 200, z: 525, pitch: .75, f: 350, cx: 156, cy: 198 }, zx: i => (i - 2) * 62, row: { 1: -76, 0: 76 }, trap: { 1: -138, 0: 138 } }; // the trap rows stay inside the table's braided border
// The duel hall and its table are one scene. The hall's painting stands whole at its own size with its foot on the
// view's foot, and the table stands on its floor at the painting's scale (s: 1 for the 352-wide cut, 1.25 for the
// 440-wide one, 656 / 352 for the tall cut), never larger, and as large as the view's height and width allow under that.
// The table's near edge lies on the view's bottom edge, so at the painting's own scale its far edge falls on the row
// where the painted floor meets the back wall, and a taller view shows more of the hall above it.
const tableCam = (w, h, s = 1) => { const k = Math.min(h / 128, (w / 2 - 6) / 119, s);
  return { y: 200, z: 525, pitch: .75, f: Math.round(350 * k), cx: w >> 1, cy: Math.round(h + 74 * k) + 1 }; };
// The hall's painting for this view. Of its cuts (352 x 198, 440 x 248 and the tall 656 x 369, art/c/*-l and *-x) that
// cover the view's width and leave at most an eighth of it dark above, the one that lets the table be drawn largest at
// the painting's own scale (within a twentieth of it); when no cut is that close, the closest. When none leaves so
// little dark, the tallest: the view then shows the hall's high ceiling lost in the dark above the painting.
function hallPic(name) {
  const { w, h } = viewSize(), kv = Math.min(h / 128, (w / 2 - 6) / 119);
  const cuts = [['', 352, 198], ['-l', 440, 248], ['-x', 656, 369]].filter(([t, pw]) => (!t || CART.has(name + t)) && pw >= w).map(([tail, pw, ph]) => ({ tail, pw, ph, s: pw / 352, k: Math.min(kv, pw / 352), dark: h - ph }));
  const ok = cuts.filter(c => c.dark <= h / 8), near = ok.filter(c => c.s / c.k <= 1.06);
  const c = near.length ? near.reduce((a, b) => b.k > a.k ? b : a) : ok.length ? ok.reduce((a, b) => b.s / b.k < a.s / a.k ? b : a) : cuts.reduce((a, b) => b.ph > a.ph ? b : a, cuts[0] || { tail: '', pw: 352, ph: 198, s: 1 });
  const ox = (w - c.pw) >> 1, oy = h - c.ph;
  return { src: cimg(name + c.tail), s: c.s, pw: c.pw, ph: c.ph, ox, oy, edge: oy > 0 ? `<i class="fade d75" style="top:${oy}px"></i><i class="fade" style="top:${oy + 4}px"></i>` : '' };
}
// The duel table: Randall's own model, built to console size (22 November 2026): 26 flat faces, a 128-pixel top and a
// 64-pixel stone, loaded from art/c/index.json ("models") as a game of the day loaded its models. Model units are
// metres with Z up; 216 world units to one, the top at height 0. A big face is cut into pieces so the console's flat
// texture mapping does not bend it far (as the games of the day did). Light comes from above, a little from the left.
const TS = 216, tmodel = () => (D.cart && D.cart.models && D.cart.models.table) || null;
function tableQuads(view) {
  const M = tmodel(); if (!M) return false;
  const top = Math.max(...M.faces.flatMap(f => f.p.map(p => p[2]))), W = p => [p[0] * TS, (p[2] - top) * TS, -p[1] * TS];
  const L = [-.35, .8, .5], ln = Math.hypot(...L), mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
  let drawn = 0;
  for (const f of M.faces) {
    const t = TEX['m-' + f.t]; if (!t || f.p.length !== 4 || !f.uv) continue;
    const P = f.p.map(W), UV = f.uv.map(([u, v]) => [u * t.w, v * t.h]), n = [f.n[0], f.n[2], -f.n[1]];
    const lit = .42 + .5 * Math.max(0, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / ln), isTop = n[1] > .9 && f.p.every(p => p[2] > top - 1e-3);
    const bias = isTop ? 2000 : 2500 + Math.round((top - f.p.reduce((a, p) => a + p[2], 0) / 4) * 1000);
    const span = Math.max(Math.hypot(...P[0].map((x, i) => x - P[1][i])), Math.hypot(...P[1].map((x, i) => x - P[2][i]))), k = Math.min(6, Math.max(1, Math.ceil(span / 110)));
    const zs = P.map(p => p[2]), z0 = Math.min(...zs), z1 = Math.max(...zs);
    const at = (i, j) => { const a = mix(P[0], P[1], i / k), b = mix(P[3], P[2], i / k), ua = mix(UV[0], UV[1], i / k), ub = mix(UV[3], UV[2], i / k); return [mix(a, b, j / k), mix(ua, ub, j / k)]; };
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
      const c = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
      const sh = c.map(([p]) => lit * (isTop ? .62 + .38 * (p[2] - z0) / Math.max(1, z1 - z0) : 1)); // the top darkens toward the far side
      c.reverse(); sh.reverse(); // the file winds its faces the other way round from the renderer
      R3.quad(view, { p: c.map(x => x[0]), uv: c.map(x => x[1]), tex: t, shade: sh, bias, cull: true }); drawn++;
    }
  }
  return drawn > 0;
}
const TEX = { cards: new Map(), table: undefined, back: undefined, loading: null, wait: {}, laid: false };
// A Field Spell's ground (Randall's terrain sheet, cut to 128 x 64). Every ground loads with the table's own pictures
// (psTextures), so a ground is never laid a moment after the table it lies on. TEX['t-' + id]: null while it loads,
// then its picture, or false when there is none or it failed.
const terrainTex = id => { const n = 'terrain-' + String(card(id).name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), k = 't-' + id;
  if (TEX[k] !== undefined) return TEX.wait[k] || Promise.resolve();
  if (!CART.has(n)) { TEX[k] = false; return Promise.resolve(); }
  TEX[k] = null; return (TEX.wait[k] = new Promise(done => { const im = new Image(), end = t => { TEX[k] = t; done(); if (app.classList.contains('ps')) psPaint(true); };
    im.onload = () => end(R3.texFrom(im, 128, 64) || false); im.onerror = () => end(false); im.src = cimg(n); })); };
// ---- props: Randall's models cut to console size (tools/crucible/console-prop.py), each standing on a spot of its room's
// painted floor: the shrine in the Sanctum, the bowl in the Omen room, the chest among the treasure, the stall in the
// Bazaar, the anvil in the forge; and the two keepers before the side doorways of the guardian's chamber. A spot is a
// place in the painting (index.json 'spots', in the 440 x 248 picture, with the light the model stands in), so a model
// keeps its one place and size in its room on every screen, and the view crops it as it crops the painting.
const pmodel = n => (D.cart && D.cart.models && D.cart.models[n]) || null;
const spotsOf = room => (D.cart && D.cart.spots && D.cart.spots[room]) || [];
// A model's place in this picture: [model, turn, middle x, foot y, height, light], from a spot in the larger picture.
const spotAt = (rp, [m, x, foot, h, yaw, tint]) => [m, yaw, Math.round(x * rp.k), Math.round(foot * rp.k), Math.round(h * rp.k), tint || null];
// One canvas the size of the room picture, laid exactly on it, for the models standing in it: drawn under the dimming of
// the room, so a model is dimmed with its room (the one a room is about stands over it, see psOffer). data-foot lists where each model's foot is in the picture, and the
// checks find each drawn model standing there. It takes no taps, so what lies under it is tapped as before. The models
// in a room are drawn once and stand still (data-still); the forge's canvas is drawn by the clock as the hammer falls.
const modelCanvas = (rp, items, inRoom = false, id = 'prop', still = true) => items.length ? onPic('canvas', 'ab', [0, 0], [0, 0], 'pointer-events:none', `id="${id}"${still ? ' data-still' : ''} width="${rp.pw}" height="${rp.ph}" data-foot="${items.map(i => i[2] + ',' + i[3]).join(' ')}" data-items='${JSON.stringify(items)}'`, '', inRoom ? [0, 0] : [rp.ox, rp.oy]) : '';
// The model a room is about (the spot its plinths keep clear: the treasure's chest, the Omen's bowl, the Sanctum's shrine)
// stands in the key light the models are lit to: the colour of its place, never darker than that key. (The vault's floor
// lies in shadow, and its chest, darkened to it and then dimmed with the room, read as a dark blot.)
const KEY_LIGHT = .9, lightLum = t => .3 * t[0] + .59 * t[1] + .11 * t[2]; // as console-art.py measures a place's light
function propSpot(rp, kind) { // the models standing in an offer room, or nothing
  if (rp.name === 'room-vault' && kind !== 'treasure') return ''; // the chest stands at a treasure only, not at the other vault offers
  const subject = CLEAR[rp.name] && (!CLEAR[rp.name][2] || CLEAR[rp.name][2] === kind);
  return modelCanvas(rp, spotsOf(rp.name).filter(s => pmodel(s[0])).map(s => { const t = s[5], l = t ? lightLum(t) : KEY_LIGHT;
    return spotAt(rp, subject && l < KEY_LIGHT ? [...s.slice(0, 5), t.map(v => Math.round(v * KEY_LIGHT / l * 1000) / 1000)] : s); }));
}
// The two keepers stand before the side doorways while the guardian's door stands alone in the middle one, as statues
// flanked a boss's door in the games of the day: each on the step in front of its doorway, as tall as the doorway,
// turned a little toward the guardian's door, lit by the hall's own light.
function keepers(r, rp, ways, H) {
  if (!pmodel('keeper') || !r.doors.some(d => d.type === 'boss')) return '';
  const items = [0, 2].map(p => { const [x, y, w, h] = ways[p]; return ['keeper', p ? -28 : 28, x + (w >> 1), y + h + Math.round(6 * rp.k), Math.round(h * 1.04), H && H.tint || null]; });
  return modelCanvas(rp, items, true);
}
let propLoading = null;
// The models' pictures, all of them, as soon as the picture pack is in (bootWait waits for them), so no model is ever
// drawn without its skin. Resolves when every one has loaded or failed.
function propTextures() {
  return propLoading || (propLoading = Promise.all(Object.entries((D.cart && D.cart.models) || {}).filter(([mn]) => mn !== 'table').flatMap(([mn, M]) => Object.entries(M.pics).map(([t, [w, h]]) => {
    const n = `model-${mn}-${t}`; if (!CART.has(n)) return null;
    return new Promise(done => { const im = new Image(); im.onload = () => { TEX[`m-${mn}-${t}`] = R3.texFrom(im, w, h); done(); }; im.onerror = done; im.src = cimg(n); }); }).filter(Boolean)))
    .then(() => { if (app.classList.contains('ps')) { propPaint(); if (G.forge) forgePaint(); } }));
}
const skinsIn = (...ms) => ms.every(m => pmodel(m) && Object.keys(pmodel(m).pics).every(t => TEX[`m-${m}-${t}`]));
// A model's skin in the light of its place: each colour multiplied by the light, once (the renderer then cuts it to
// 15-bit colour with the dither as it draws).
function skin(m, t, tint) {
  const base = TEX[`m-${m}-${t}`]; if (!base || !tint) return base;
  const k = `m-${m}-${t}@${tint}`; if (TEX[k]) return TEX[k];
  const d = new Uint32Array(base.d.length);
  for (let i = 0; i < d.length; i++) { const c = base.d[i]; d[i] = (c & 0xff000000) | (Math.min(255, ((c >> 16) & 255) * tint[2]) << 16) | (Math.min(255, ((c >> 8) & 255) * tint[1]) << 8) | Math.min(255, (c & 255) * tint[0]); }
  return (TEX[k] = { w: base.w, h: base.h, d });
}
// Queue a model's faces. Each face of four corners goes in as two triangles, each kept or dropped by its own facing:
// a face that is not flat could otherwise be dropped whole by the facing of its first three corners (the hole once seen
// in the left keeper's chest).
function modelFaces(view, M, name, place, normal, shade, o = {}) {
  for (const f of M.faces) {
    const t = skin(name, f.t, o.tint); if (!t || !f.uv) continue;
    const c = f.p.map((p, i) => [place(p), [f.uv[i][0] * (t.w - 1), f.uv[i][1] * (t.h - 1)]]), lit = shade(normal(f.n));
    for (const tri of c.length === 4 ? [[c[0], c[1], c[2]], [c[0], c[2], c[3]]] : [c.slice(0, 3)]) {
      tri.push(tri[0]); tri.reverse(); // the file winds its faces the other way round from the renderer
      R3.quad(view, { p: tri.map(x => x[0]), uv: tri.map(x => x[1]), tex: t, shade: lit, cull: true, bias: o.bias || 0 });
    }
  }
}
function propPaint() {
  const cv = document.getElementById('prop'); if (!cv) return;
  let items; try { items = JSON.parse(cv.dataset.items || '[]'); } catch { return; }
  const view = R3.makeView(cv, cv.width, cv.height); view.px.fill(0);
  const L = [-.35, .8, .5], ln = Math.hypot(...L);
  for (const [prop, yaw, cx, by, h, tint] of items) { // each prop has its own camera, fitted to its place: drawn one after the other
    const M = pmodel(prop); if (!M) continue;
    const a = yaw * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), turn = p => [p[0] * ca - p[1] * sa, p[0] * sa + p[1] * ca, p[2]];
    const Wp = p => { const q = turn(p); return [q[0] * TS, q[2] * TS, -q[1] * TS]; }, tall = Math.max(...M.faces.flatMap(f => f.p.map(p => p[2]))) * TS;
    const cam = { y: tall * .5 + 160, z: 900, pitch: Math.atan2(160, 900), f: 300, cx: 0, cy: 0 };
    const box = c => { const P = R3.camera(c), pts = M.faces.flatMap(f => f.p.map(p => P(Wp(p)))).filter(Boolean), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
    let b = box(cam); cam.f = Math.round(cam.f * h / Math.max(1, b[3] - b[1]));
    b = box(cam); cam.cx = Math.round(cx - (b[0] + b[2]) / 2); cam.cy = Math.round(by - b[3]); // the foot on its spot
    view.list.length = 0;
    modelFaces(view, M, prop, Wp, n => { const q = turn(n); return [q[0], q[2], -q[1]]; }, n => .45 + .55 * Math.max(0, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / ln), { tint });
    R3.draw(view, R3.camera(cam));
  }
  R3.present(view);
}
// The table's pictures and the card back. They load with the pack (bootWait waits for them as for the models' skins), so
// the first duel frame is drawn with them; until each has loaded or failed (false) the table is not drawn.
function psTextures() {
  if (TEX.loading) return TEX.loading;
  const load = (n, w, h, k) => new Promise(done => { if (!CART.has(n)) { TEX[k] = false; return done(); }
    const im = new Image(), end = t => { TEX[k] = t; done(); if (app.classList.contains('ps')) psPaint(true); };
    im.onload = () => end(R3.texFrom(im, w, h) || false); im.onerror = () => end(false); im.src = cimg(n); });
  const M = tmodel();
  return (TEX.loading = Promise.all([load('table', 128, 128, 'table'), load('cardback', 44, 60, 'back'), ...(M ? Object.entries(M.pics).map(([t, [w, h]]) => load('model-table-' + t, w, h, 'm-' + t)) : []),
    ...D.pool.cards.filter(c => c.kind === 'field').map(c => terrainTex(c.id))]));
}
function cardTex(id) {
  if (TEX.cards.has(id)) return TEX.cards.get(id);
  const i = IDX.get(id), sh = i == null ? null : CCANVAS[Math.floor(i / 100)];
  let t = null; if (sh) { const k = i % 100, sx = (k % 10) * 40, sy = Math.floor(k / 10) * 40, d = new Uint32Array(40 * 40); for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) d[y * 40 + x] = sh.d[(sy + y) * 400 + sx + x]; t = { w: 40, h: 40, d }; }
  if (t) TEX.cards.set(id, t);
  return t;
}
// ---- the duel's beats
// A step of the duel (a frame: the events of one move and the board after it) is shown as a short scene, drawn at 30
// frames a second as the console drew such moments. beatOf lays the step out in thirtieths of a second (ticks; FAST
// plays the same beat at twice the speed, every other drawing): the board as it was until each move lands, then as it
// is; who moves, where and when; when a card breaks, when the Life Points fall, when a relic fires. The table (psPaint),
// the pillars and the strips over the view (beatDom) and the sound cues are all read from it, so nothing shows its
// result before the blow that brings it.
const TICK = 1000 / 30;
let PSV = null; // what the table shows: { v: the board, beat, hl: zone marks, marks: battle forecasts, pend: an attack waiting on your answer, s: the scene's scale, floats, strips }
const mkey = (s, z) => `m${s}.${z}`, tkey = (s, z) => `t${s}.${z}`;
// An attack, tick by tick: how far toward its target (0 at home, 1 on it) and how high. The blow lands at LUNGE_HIT.
// The last tick lays it down on its zone again, where it shows its numbers once more.
const LUNGE = [[-.03, 4], [-.06, 8], [-.06, 10], [.08, 12], [.24, 14], [.46, 14], [.72, 12], [.94, 8], [1, 4], [.98, 4], [.96, 6], [.8, 10], [.55, 12], [.3, 10], [.12, 6], [.03, 2], [0, 0]], LUNGE_HIT = 8;
// An attack the defender may answer with a Trap stops poised a third of the way, and goes on from there once answered
// (or goes back, when the Trap stops it).
const POISE = [[-.03, 4], [-.06, 8], [-.06, 10], [.04, 12], [.1, 13], [.14, 12]], RESUME = [[.14, 12], [.4, 14], [.78, 12], [.95, 8], ...LUNGE.slice(LUNGE_HIT)], RESUME_HIT = 4;
const RETREAT = [[.3, 12], [.22, 10], [.12, 8], [.05, 4], [0, 0]];
// A card shown and spent (a Spell, a Field, an Equip, a Trap springing): it rises and stands up toward you face down,
// turns over in two steps, holds, and breaks. Each tick: [height, how far it stands up, width (below 0: face up)].
const SHOW = [[6, .3, 1], [14, .6, 1], [22, .85, 1], [24, .85, .5], [24, .85, .05], [24, .85, -.05], [24, .85, -.5], [24, .85, -1], [24, .85, -1], [24, .85, -1], [24, .85, -1]], SHOW_END = SHOW.length;
// A card arriving on the table slides in over its owner's edge, a little above the top, and lands on its zone in five
// steps: each tick, how far it has come (1 on its zone) and its height.
const ARRIVE = [[0, 12], [.35, 10], [.65, 8], [.85, 5], [.96, 2], [1, 0]];
const SHARD_LIFE = 14;
function beatOf(f) {
  const P = f.prev, V = f.view, evs = f.evs;
  const B = { f, P, V, t0: performance.now(), speed: G.fast ? 2 : 1, swap: {}, look: {}, acts: [], shards: [], lp: [], relics: [], shakes: [], flash: [], wipe: null, hand: -1, cues: [], end: 5, fights: [] };
  if (!P) { for (const e of evs) B.cues.push([0, e]); return B; } // the first step of a duel: the board is laid out at once
  const off = V.mon[0].length < 5 ? 1 : 0, home = (s, z) => ({ x: TBL.zx(z + off), y: 0, z: TBL.row[s] });
  const sw = (k, t) => { if (B.swap[k] == null) B.swap[k] = t; }; // a card arrives or leaves: the slot changes then
  const cued = new Set(), cueAt = (t, e) => { if (!cued.has(e)) { cued.add(e); B.cues.push([t, e]); } };
  const hasBattle = evs.some(e => e.e === 'battle');
  const sprung = [0, 1].map(s => (P.traps[s] || []).map((x, i) => x && !(V.traps[s] || [])[i] ? i : -1).filter(i => i >= 0));
  let t = 0, at = 0, lunge = null;
  const lungeActor = L => { const H = home(L.seat, L.from), T = L.to >= 0 ? home(1 - L.seat, L.to) : { x: H.x * .5, z: L.seat ? 160 : -160 };
    const A = { x: H.x + (T.x - H.x) * (L.to >= 0 ? .85 : 1), z: H.z + (T.z - H.z) * (L.to >= 0 ? .85 : 1) };
    const at2 = ([s, y]) => ({ x: H.x + (A.x - H.x) * s, y, z: H.z + (A.z - H.z) * s });
    B.acts.push(L.act = { key: mkey(L.seat, L.from), t0: L.held ? 0 : L.start, t1: Infinity,
      inst: tk => L.rev && L.start != null && tk >= L.start + 2 && (L.hit == null || tk < L.hit) ? L.rev : undefined,
      pose: tk => {
        if (L.start == null || tk < L.start) return { ...at2(POISE[POISE.length - 1]), poised: true }; // poised, waiting on the answer
        const i = tk - L.start, seq = L.back ? RETREAT : L.seq, p = at2(seq[Math.min(i, seq.length - 1)]);
        if (L.rev && i < 4) Object.assign(p, { wide: [.5, .05, .5, 1][i], face: i >= 2 }); // a veiled attacker turns over as it sets off
        return p; } });
    L.end = () => L.start == null || L.start === Infinity ? Infinity : L.start + (L.back ? RETREAT : L.seq).length; B.fights.push(L); };
  // a poised attack from the last step goes on here, from where it waits
  const pend = P.pending && P.pending.kind === 'trap' ? { seat: P.active, from: P.pending.from, to: P.pending.to } : null;
  if (pend && P.mon[pend.seat][pend.from]) { lunge = { ...pend, start: null, held: true }; lungeActor(lunge); }
  // A card is shown in front of its owner's row, mid-table. A set card first lifts off its slot face down and slides
  // there in three steps (stood up in its slot, near the eye, it would fill the view).
  const show = (from, inst, t0, key, seat) => {
    const mid = { x: 0, y: 0, z: seat ? -40 : 40 }, lead = from ? 3 : 0, end = t0 + lead + SHOW_END;
    const pose = tk => { const i = tk - t0;
      if (i < lead) { const k = (i + 1) / (lead + 1); return { x: from.x + (mid.x - from.x) * k, y: 2 + 2 * i, z: from.z + (mid.z - from.z) * k, face: false, bias: -800 }; }
      const [y, tilt, w] = SHOW[Math.min(i - lead, SHOW_END - 1)]; return { ...mid, y, tilt, wide: Math.abs(w), face: w < 0, shade: i - lead === 7 ? 1.3 : 1, bias: -800 }; };
    B.acts.push({ key, t0, t1: end, inst: () => inst, seat, pose, shown: true });
    B.shards.push({ t: end, inst, seat, pose: { ...pose(end - 1), shade: 1 } });
    if (key) sw(key, end);
    return end; };
  const busy = k => Math.max(0, ...B.acts.filter(a => a.key === k && a.t1 !== Infinity).map(a => a.t1));
  for (const e of evs) {
    switch (e.e) {
      case 'attack':
        lunge = { seat: e.seat, from: e.from, to: e.to, start: t, hit: hasBattle ? t + LUNGE_HIT : null, seq: hasBattle ? LUNGE : POISE };
        lungeActor(lunge); cueAt(t, e); t = at = hasBattle ? lunge.hit : t + POISE.length; break;
      case 'trap': { const s = e.seat, i = sprung[s].shift(); cueAt(t, e);
        t = at = show(i != null ? { x: TBL.zx(i), z: TBL.trap[s] } : null, { id: e.id }, t, i != null ? tkey(s, i) : null, s); break; }
      case 'spell': cueAt(t, e); t = at = show(null, { id: e.id }, t, null, e.seat); break;
      case 'equip': { const t0 = t, base = { x: 0, y: 0, z: e.seat ? -40 : 40 }, tg = home(e.seat, e.zone), k = mkey(e.seat, e.zone);
        // shown as a Spell is, then it flies onto its monster and sinks into it, and the monster flashes
        B.acts.push({ t0, t1: t0 + 11, inst: () => ({ id: e.id }), seat: e.seat, pose: tk => { const i = tk - t0; if (i < 7) { const [y, tilt, w] = SHOW[i]; return { ...base, y, tilt, wide: Math.abs(w), face: w < 0, bias: -800 }; }
          const s = (i - 6) / 4; return { x: base.x + (tg.x - base.x) * s, y: 24 - 18 * s, z: base.z + (tg.z - base.z) * s, tilt: .85 * (1 - s), wide: 1 - .5 * s, face: true, bias: -800 }; } });
        B.flash.push({ key: k, t: t0 + 11, k: [1.6, 1, 1.6, 1] }); B.look[k] = t0 + 11; cueAt(t0 + 6, e); t = at = t0 + 12; break; }
      case 'terrain': { const t0 = e.law || e.storm ? t : show(null, { id: e.id }, t, null, e.seat);
        if (!B.wipe) B.wipe = { t: t0, from: P.terrain, to: V.terrain, near: e.seat === 0 }; // the ground is laid row by row from its owner's side
        cueAt(t0, e); t = at = t0 + 8; break; }
      case 'reveal': { const k = mkey(e.seat, e.zone), was = P.mon[e.seat][e.zone], face = was ? { ...was, id: e.id, veil: false } : null;
        if (lunge && lunge.seat === e.seat && lunge.from === e.zone) { lunge.rev = face; cueAt(lunge.start ?? t, e); break; } // an attacker shows its face as it sets off
        const hit = hasBattle && lunge ? lunge.hit ?? t + RESUME_HIT : null, c = hit != null ? hit - 3 : at, h = home(e.seat, e.zone); // a defender turns over as the blow comes
        B.acts.push({ key: k, t0: c, t1: Math.max(c + 4, hit ?? 0), inst: tk => tk - c >= 2 ? face : undefined, pose: tk => tk - c < 4 ? { ...h, y: 3, wide: [.5, .05, .5, 1][tk - c], face: tk - c >= 2 } : h });
        B.look[k] = hit ?? c + 2; cueAt(c, e); break; }
      case 'battle':
        if (lunge && lunge.held && lunge.start == null) { lunge.start = t; lunge.hit = t + RESUME_HIT; lunge.seq = RESUME; }
        if (lunge && lunge.hit != null) { const ka = mkey(lunge.seat, lunge.from); sw(ka, lunge.hit); B.look[ka] = lunge.hit; if (lunge.to >= 0) { const kd = mkey(1 - lunge.seat, lunge.to); sw(kd, lunge.hit); B.look[kd] = Math.max(B.look[kd] ?? 0, lunge.hit); } t = Math.max(t, lunge.hit); at = lunge.hit; }
        cueAt(at, e); break;
      case 'lp': B.lp.push({ t: at, seat: e.seat, d: e.d }); if (e.d <= -1500) B.shakes.push(at); cueAt(at, e); break;
      case 'destroyed': { const k = mkey(e.seat, e.zone), was = P.mon[e.seat][e.zone]; B.shards.push({ key: k, t: at, seat: e.seat, inst: { id: e.id, pos: was ? was.pos : 'a' } }); sw(k, at); cueAt(at, e); break; }
      // A card sent back is lifted off and slid toward its owner's hand.
      case 'bounce': { const k = mkey(e.seat, e.zone), h = home(e.seat, e.zone), dir = e.seat ? -1 : 1, t0 = Math.max(at, busy(k));
        B.acts.push({ key: k, t0, t1: t0 + 7, pose: tk => { const i = tk - t0; return { ...h, y: Math.min(8, 4 + i * 4), z: h.z + dir * [0, 0, 20, 50, 90, 140, 200][i] }; } });
        sw(k, t0 + 7); if (e.seat === 0) B.hand = t0 + 7; cueAt(t0, e); t = at = Math.max(t, t0 + 7); break; }
      case 'summon': case 'revive': { const k = mkey(e.seat, e.zone), h = home(e.seat, e.zone), t0 = t, land = t0 + ARRIVE.length - 1, inst = V.mon[e.seat][e.zone], from = e.seat ? -260 : 260;
        if (inst) B.acts.push({ t0, t1: land, inst: () => inst, seat: e.seat, pose: tk => { const [s, y] = ARRIVE[tk - t0]; return { ...h, y, z: from + (h.z - from) * s }; } }); // it comes in over its owner's edge of the table; whatever lay there stays until it lands
        sw(k, land); B.look[k] = land; B.flash.push({ key: k, t: land, k: [e.melded ? 1.6 : 1.35] }); cueAt(t0, e); t = at = land + 1; break; }
      case 'set': { const k = tkey(e.seat, e.zone), t0 = t, h = { x: TBL.zx(e.zone), y: 0, z: TBL.trap[e.seat], small: true }, from = e.seat ? -260 : 260;
        B.acts.push({ t0, t1: t0 + 3, inst: () => ({ veil: true }), seat: e.seat, pose: tk => { const [s, y] = [[0, 8], [.6, 4], [.9, 1]][tk - t0]; return { ...h, y, z: from + (h.z - from) * s }; } }); sw(k, t0 + 3); cueAt(t0, e); t = at = t0 + 4; break; }
      case 'pos': { const k = mkey(e.seat, e.zone), h = home(e.seat, e.zone), t0 = Math.max(t, busy(k), lunge && lunge.from === e.zone && lunge.seat === e.seat && lunge.end() !== Infinity ? lunge.end() : 0), dir = e.pos === 'd' ? 1 : -1;
        // a quarter turn in two steps, lifted a little off the table
        B.acts.push({ key: k, t0, t1: t0 + 4, pose: tk => ({ ...h, y: 4, turn: tk - t0 < 2 ? dir * .5 : 0 }) }); B.look[k] = t0 + 2; cueAt(t0, e); t = at = t0 + 4; break; }
      case 'stat': case 'enchant': if (e.zone != null) { const k = mkey(e.seat, e.zone); B.flash.push({ key: k, t: at, k: (e.a ?? 1) < 0 ? [.45, 1, .45, 1] : [1.6, 1, 1.6, 1] }); B.look[k] = Math.max(B.look[k] ?? 0, at); } cueAt(at, e); break;
      case 'relic': B.relics.push({ t: at, e }); cueAt(at, e); break;
      case 'draw': if (e.seat === 0 && B.hand < 0) B.hand = at; cueAt(at, e); break;
      default: cueAt(e.e === 'turn' ? t : at, e);
    }
  }
  // an attack stopped by the Trap that answered it goes back to its zone
  if (lunge && lunge.held && lunge.start == null && V.mon[lunge.seat][lunge.from]) { lunge.start = Math.max(t, at); lunge.back = true; lunge.seq = RETREAT; t = lunge.start + RETREAT.length; }
  else if (lunge && lunge.held && lunge.start == null) lunge.start = Infinity; // it broke where it waited
  const ends = [t, at, ...B.acts.map(a => a.t1).filter(x => x !== Infinity), ...B.shards.map(s => s.t + SHARD_LIFE), ...B.flash.map(x => x.t + x.k.length), ...B.lp.map(x => x.t + 4), B.wipe ? B.wipe.t + 8 : 0];
  if (lunge && lunge.end() !== Infinity) ends.push(lunge.end());
  B.end = Math.max(B.end, ...ends);
  // the Life Points: each change from what was shown, the last one to what the board says (it may have been held at 0 or set by a relic)
  for (const s of [0, 1]) { let n = P.lp[s]; const l = B.lp.filter(x => x.seat === s); l.forEach((x, i) => { x.from = n; x.to = i === l.length - 1 ? V.lp[s] : n + x.d; n = x.to; }); }
  return B;
}
const beatTick = (B, now = performance.now()) => Math.floor((now - B.t0) / TICK) * B.speed;
// The Life Points a pillar shows at a tick of the beat: the number turns at once, the gauge steps down (or up) in four.
function lpAt(B, seat, tick) {
  let n = B.P ? B.P.lp[seat] : B.V.lp[seat], g = n, hot = null;
  for (const x of B.lp) if (x.seat === seat && tick >= x.t) { n = x.to; g = x.from + (x.to - x.from) * Math.min(1, (tick - x.t + 1) / 4); if (tick < x.t + 15) hot = x.d; }
  return { n: Math.max(0, n), g: Math.max(0, g), hot };
}
const lpNow = (v, seat) => { const B = PSV && PSV.beat; return B && B.V === v ? lpAt(B, seat, beatTick(B)) : { n: v.lp[seat], g: v.lp[seat], hot: null }; };

// The corners of a card at a pose: x, y, z its middle; turn: quarter turns from how it lies (1 turns an attack card to
// defense); tilt: how far it stands up toward you, about its width; wide: its width while it turns over (1 flat, 0 edge-on).
// A monster card is 40 x 53 (CARD_HW, CARD_HD: half of each) on a zone of 50 x 66, 62 apart, so one lying sideways in
// defense reaches 1.5 past its zone's sides, and two side by side leave 9 between their ends for their marks (ring) and
// stone between. (At 42 x 58 they left 4, and two marks there ran into one band.)
const CARD_HW = 20, CARD_HD = 26.5;
function cardQuad(pose, def) {
  const small = pose.small, hw = small ? 16 : CARD_HW, hd = small ? 21 : CARD_HD, th = ((def ? 1 : 0) + (pose.turn || 0)) * Math.PI / 2;
  const c = Math.cos(th), s = Math.sin(th), ct = Math.cos(pose.tilt || 0), st = Math.sin(pose.tilt || 0), wd = pose.wide ?? 1;
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, lz]) => { lx *= wd; const y = -lz * st, z = lz * ct; return [pose.x + lx * c - z * s, pose.y + y, pose.z + lx * s + z * c]; });
}
const UV_FACE = [[0, 0], [39, 0], [39, 39], [0, 39]], UV_BACK = [[0, 0], [43, 0], [43, 59], [0, 59]], UV0 = [[0, 0], [0, 0], [0, 0], [0, 0]];
const ROLE_RGB = { monster: [168, 126, 79], spell: [76, 138, 124], field: [76, 138, 124], trap: [150, 64, 52], equip: [122, 84, 60], fuel: [90, 80, 72] };
const cardLook = (inst, seat, pose) => { const back = pose.face != null ? !pose.face : !inst.id || (inst.veil && seat === 1); return { back, def: inst.pos === 'd' && !pose.small, tex: back ? TEX.back : cardTex(inst.id) }; };
function layCard(view, inst, seat, pose, shade = 1) {
  const { back, def, tex } = cardLook(inst, seat, pose), p = cardQuad(pose, def), sh = p.map(q => (q[2] < pose.z - 1 ? .8 : 1) * shade * (pose.shade ?? 1)), bias = pose.bias ?? -Math.round(pose.y * 4);
  if (tex) R3.quad(view, { p, uv: back ? UV_BACK : UV_FACE, tex, shade: sh, bias });
  else R3.quad(view, { p, uv: UV0, col: back ? [65, 27, 40] : ROLE_RGB[roleOf(db, inst.id)] || [168, 126, 79], shade: sh, bias });
  return p;
}
// A card breaking: its own picture cut four by four where it lay, the pieces thrown up and apart, turning, falling back
// onto the table where they stop, then taken away a few at a time in a fixed order (no piece blinks, none fades).
// Across the table the pieces keep to the card's own lane, half a zone's pitch to each side of where it broke (less a
// unit), so those of a card broken in its zone never reach the zone beside it or the numbers there; toward and away from
// you they fly freely. Returns the pieces' corners, for the numbers they lie over.
function layShards(view, inst, seat, pose, age) {
  const { back, def, tex } = cardLook(inst, seat, pose), p = cardQuad({ ...pose, tilt: pose.tilt || 0 }, def), uv = back ? UV_BACK : UV_FACE;
  const lerp = (a, b, k) => a.map((x, i) => x + (b[i] - x) * k), at = (q, u, v) => lerp(lerp(q[0], q[1], u), lerp(q[3], q[2], u), v);
  const mid = at(p, .5, .5), rnd = i => { const s = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return s - Math.floor(s); };
  const dim = age < 8 ? 1 : .8, lane = (TBL.zx(1) - TBL.zx(0)) / 2 - 1, pieces = [];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const n = j * 4 + i, r = rnd(n); if (age >= 8 + Math.floor(rnd(n + 31) * 6)) continue; // gone, from the eighth thirtieth on
    const q = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => at(p, a / 4, b / 4)), u = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => at(uv, a / 4, b / 4));
    const c = at(q, .5, .5), up = 3.5 + r * 2, land = (up + Math.sqrt(up * up + 2.2 * Math.max(0, c[1]))) / 1.1, fly = Math.min(age, land); // a piece goes up, comes down onto the table, and lies where it lands
    const dx = c[0] - mid[0], dz = c[2] - mid[2], dl = Math.hypot(dx, dz) || 1, out = fly * (1.2 + r * 1.2);
    const reach = Math.max(...q.map(m => Math.hypot(m[0] - c[0], m[2] - c[2]))), room = Math.max(0, lane - reach - Math.abs(dx)), ox = Math.max(-room, Math.min(room, dx / dl * out)); // however it turns, the piece stays in the lane
    const y = Math.max(0, c[1] + fly * up - .55 * fly * fly) - c[1], a = (r - .5) * fly * .3, ca = Math.cos(a), sa = Math.sin(a);
    const moved = q.map(([x, yy, z]) => { const lx = x - c[0], lz = z - c[2]; return [c[0] + ox + lx * ca - lz * sa, c[1] + (yy - c[1]) * (1 - fly / land) + y, c[2] + dz / dl * out + lx * sa + lz * ca]; }); // a piece of a card held up lies flat once it lands
    // a piece is drawn in its place among the cards by its height, as a card is: so at the blow the pieces of the card
    // struck lie under the attacker above them, and rise over it only as they are thrown up
    const bias = -1 - Math.round(4 * Math.max(...moved.map(m => m[1])));
    if (tex) R3.quad(view, { p: moved, uv: u, tex, shade: dim, bias });
    else R3.quad(view, { p: moved, uv: UV0, col: back ? [65, 27, 40] : ROLE_RGB[roleOf(db, inst.id)] || [168, 126, 79], shade: dim, bias });
    pieces.push(moved);
  }
  return pieces;
}
// The label face drawn into the table's picture: each letter cut once to one bit from the page's own label face, so the
// numbers on the table are the letters used everywhere else in the frame, never smoothed. They lie flat on the screen,
// as the console laid its numbers over a scene, and are placed from the card's corners as drawn, so they go with it.
const GL = new Map(); let glOk = false, glTop = 0;
function glyphsReady() {
  if (glOk) return true;
  try { if (document.fonts && document.fonts.check && !document.fonts.check('8px "LM Label"')) { if (!glyphsReady.asked) { glyphsReady.asked = 1; document.fonts.load('8px "LM Label"').then(() => { glOk = true; GL.clear(); psPaint(true); }).catch(() => {}); } return false; } } catch { /* no way to ask: use what there is */ }
  glOk = true; return true;
}
function glyph(ch) {
  let g = GL.get(ch); if (g) return g;
  const c = document.createElement('canvas'); c.width = 12; c.height = 12; const x = c.getContext('2d', { willReadFrequently: true });
  x.font = '8px "LM Label"'; x.textBaseline = 'top'; x.fillStyle = '#fff'; x.fillText(ch, 0, 1);
  const d = x.getImageData(0, 0, 12, 12).data, bits = [];
  for (let y = 0; y < 12; y++) for (let i = 0; i < 12; i++) if (d[(y * 12 + i) * 4 + 3] >= 128) bits.push(i, y);
  g = { w: Math.round(x.measureText(ch).width), bits }; GL.set(ch, g);
  if (ch === '0') { let top = 12, bot = 0; for (let i = 1; i < bits.length; i += 2) { top = Math.min(top, bits[i]); bot = Math.max(bot, bits[i]); } glTop = top; GL.h = bot - top + 1; }
  return g;
}
const GLH = () => { glyph('0'); return GL.h || 5; };
const textW = s => [...s].reduce((n, ch) => n + glyph(ch).w, 0) - 1;
const RGB = { ink: [243, 234, 216], g: [233, 196, 106], r: [240, 138, 114], d: [194, 180, 156], v: [159, 208, 192], sh: [26, 15, 18], gold: [219, 164, 89] };
const px15 = rgb => 0xff000000 | ((rgb[2] & 0xf8) << 16) | ((rgb[1] & 0xf8) << 8) | (rgb[0] & 0xf8);
function putBox(view, x, y, w, h, rgb) { const c = px15(rgb); for (let j = Math.max(0, y); j < Math.min(view.h, y + h); j++) for (let i = Math.max(0, x); i < Math.min(view.w, x + w); i++) view.px[j * view.w + i] = c; }
function putText(view, x, y, s, rgb) { glyph('0'); const c = px15(rgb); for (const ch of s) { const g = glyph(ch); for (let i = 0; i < g.bits.length; i += 2) { const px = x + g.bits[i], py = y + g.bits[i + 1] - glTop; if (px >= 0 && py >= 0 && px < view.w && py < view.h) view.px[py * view.w + px] = c; } x += g.w; } return x; }
// A plate of lines on the dark of the frame with a pixel round the letters. Each line is a list of [text, colour], and a
// bare number in it is that many pixels of space.
const lineW = l => l.reduce((n, g) => n + (typeof g === 'number' ? g : textW(g[0]) + 1), -1);
function putPlate(view, x, y, lines) {
  const h = GLH(), w = Math.max(...lines.map(lineW)), H = lines.length * (h + 1) + 1;
  putBox(view, x, y, w + 2, H, RGB.sh);
  lines.forEach((l, i) => { let cx = x + 1; for (const g of l) cx = typeof g === 'number' ? cx + g : putText(view, cx, y + 1 + i * (h + 1), g[0], RGB[g[1]]); });
  return [x, y, w + 2, H];
}
const plateSize = lines => [Math.max(...lines.map(lineW)) + 2, lines.length * (GLH() + 1) + 1];
// A table monster's two numbers, ATK then DEF. The number its position fights with is bright (gold when raised above the
// printed number, red when lowered, sea-green for DEF in defense); the other is dim. Yours on one line just beyond your
// card's far edge, the two three pixels apart (the hand's cards print theirs without a stroke between, so the table does
// too); the rival's ATK over DEF just short of its near edge: both in the space between the two rows. On a table drawn too
// small for both (tight), each shows only the number it fights with, in its colour.
function numLines(m, seat, tight = false) {
  const c = m.id ? card(m.id) : null, d = m.pos === 'd', tone = (n, p) => !c ? 'ink' : n > p ? 'g' : n < p ? 'r' : 'ink';
  const a = [String(m.ea), d ? 'd' : tone(m.ea, c && c.atk)], e = [String(m.ed), d ? (tone(m.ed, c && c.def) === 'ink' ? 'v' : tone(m.ed, c && c.def)) : 'd'];
  return tight ? [[d ? e : a]] : seat === 0 ? [[a, 2, e]] : [[a], [e]];
}
// Whether the table is drawn too small for every monster's two numbers. It is decided by the frame (the table's camera)
// for the widest numbers a monster can have, four digits each, never by the cards lying there, so the numbers keep one
// notation for the whole duel: two of your plates side by side must leave four pixels of stone between them at your
// row's far edge, and the rival's two lines and your one must fit between the rows.
const STONE = 4;
function tightPlates(proj) {
  if (!glyphsReady()) return false;
  const far = TBL.row[0] - 33, near = TBL.row[1] + 33, h = GLH(), n = [...'0123456789'].reduce((a, b) => glyph(b).w > glyph(a).w ? b : a).repeat(4);
  const w = plateSize([[[n, 'ink'], 2, [n, 'd']]])[0], gap = proj([TBL.zx(1), 0, far])[0] - proj([TBL.zx(0), 0, far])[0];
  return w + STONE > gap || 3 * (h + 1) + 2 + 3 > proj([0, 0, far])[1] - proj([0, 0, near])[1];
}
const MARK_LINES = { WINS: [[['WINS', 'g']]], LOSES: [[['LOSES', 'r']]], 'BOTH FALL': [[['BOTH', 'r']], [['FALL', 'r']]], 'NO KILL': [[['NO', 'ink']], [['KILL', 'ink']]], '?': [[['?', 'ink']]] };
// Zone marks, cut into the stone round the zone (under the cards) as the console drew a cursor on its table: a frame of
// whole pixels round the zone as the camera shows it, as wide on all four sides. Ready gold; picked ember round ink; a
// target red, its two reds changing every 0.4 seconds in two hard steps, as the console blinked a cursor; onto sea-green
// round ink (a frame one pixel wide has room for one colour: picked is then ink, onto sea-green). A card in defense lies
// sideways, 26.5 to each side of its zone's middle where the zone is 25, so the frame round it is cut round the card's
// width and the zone's depth: its sides then show beside the card, not under it.
const RING = { ready: () => [RGB.gold], picked: () => [[189, 116, 51], RGB.ink], target: b => [b ? [150, 64, 52] : RGB.r], onto: () => [[76, 138, 124], RGB.ink] }, RING_ONE = { picked: RGB.ink, onto: [76, 138, 124] };
// How wide the frames of a row are: two cards in defense side by side leave 9 between their ends, where both their
// frames and a pixel of stone between them must fit, at the row's far edge where it is drawn smallest. The pixels left
// between two shapes g pixels apart may be one fewer than g, so a frame is (g - 2) / 2 pixels wide, from one to three.
function ringWidth(seat) {
  const c = TBL.cam, z = TBL.row[seat] - 33 - 6, k = c.f / (c.y * Math.sin(c.pitch) + (c.z - z) * Math.cos(c.pitch));
  return Math.max(1, Math.min(3, (Math.floor((TBL.zx(1) - TBL.zx(0) - 2 * CARD_HD) * k) - 2) >> 1));
}
// The pixels of a frame t wide round a four-cornered shape as drawn (its corners on the screen: far left, far right, near
// right, near left, the far two on one row and the near two on another), each with how far out it lies (1 next to the
// shape). The shape covers what the rasteriser covers: each pixel whose middle lies inside it.
function ringPixels(q, t, put) {
  const [A, B, C, D] = q, yf = A[1], yn = D[1], y0 = Math.ceil(yf - .5), y1 = Math.floor(yn - .5);
  const span = yc => { const k = (yc - yf) / (yn - yf || 1); return [Math.ceil(A[0] + (D[0] - A[0]) * k - .5), Math.floor(B[0] + (C[0] - B[0]) * k - .5)]; };
  for (let y = y0 - t; y <= y1 + t; y++) { const dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0, [l, r] = span(y + .5);
    for (let x = l - t; x <= r + t; x++) { const d = Math.max(dy, x < l ? l - x : x > r ? x - r : 0); if (d >= 1) put(x, y, d); } }
}
// A zone's mark, put into the scene after the table, its ground and its zone outlines and before the numbers and the
// cards (RING_Z among the shapes' depths). Returns its shape's corners on the screen, for the checks.
const RING_Z = 950;
function ring(view, proj, seat, zd, kind, blink, t, def = false) {
  const cx = TBL.zx(zd), cz = TBL.row[seat], hw = def ? CARD_HD : 25, cols = t > 1 ? RING[kind](blink) : [RING_ONE[kind] || RING[kind](blink)[0]];
  const q = [[cx - hw, 0, cz - 33], [cx + hw, 0, cz - 33], [cx + hw, 0, cz + 33], [cx - hw, 0, cz + 33]].map(proj); if (q.some(p => !p)) return null;
  const c = cols.map(px15), inner = cols.length > 1 ? t >> 1 : 0; // the inner colour takes the inner half
  R3.sprite(view, RING_Z, v => ringPixels(q, t, (x, y, d) => { if (x >= 0 && y >= 0 && x < v.w && y < v.h) v.px[y * v.w + x] = c[d <= inner ? 1 : 0]; }));
  return q;
}
// Draw the table and everything on it into the window's canvas, as it stands at this moment of the beat. Cards lie flat;
// a card in defense lies sideways. Drawn only when the moment has moved on by a whole tick (or the blink has turned).
function psPaint(force) {
  const cv = document.getElementById('tbl'); if (!cv || !PSV) return;
  const B = PSV.beat, now = performance.now(), tick = B ? beatTick(B, now) : -1, live = B && tick <= B.end + 1;
  const blink = PSV.hl && [...PSV.hl.values()].includes('target') ? Math.floor(now / 400) & 1 : 0, key = `${live ? tick : 'x'}|${blink}`;
  if (!force && cv.dataset.k === key) return; cv.dataset.k = key;
  const vs = viewSize(); TBL.cam = tableCam(vs.w, vs.h, PSV.s);
  const view = R3.makeView(cv, vs.w, vs.h), proj = R3.camera(TBL.cam), v = live ? B.V : PSV.v, P = live ? B.P || B.V : v;
  R3.clear(view, 0); view.px.fill(0); // see-through: the hall picture behind the canvas shows where nothing is drawn
  // Its pictures load with the pack, and the ground with them; until they are in, the hall stands alone (never a bare
  // table, and never a table whose ground is laid a moment later). Once a table has stood, it is never taken away again
  // to wait for a ground.
  const W = live && B.wipe, grounds = (W ? [W.from, W.to] : [v.terrain]).filter(Boolean);
  grounds.forEach(t => terrainTex(t.id));
  if (!tableReady() || (!TEX.laid && grounds.some(t => TEX['t-' + t.id] === null))) { R3.present(view); delete cv.dataset.k; return; }
  TEX.laid = true;
  const T = TEX.table || R3.flat(8, 8, [168, 126, 79]);
  if (!tableQuads(view)) R3.quad(view, { p: [[-190, 0, -192], [190, 0, -192], [190, 0, 192], [-190, 0, 192]], uv: [[0, 0], [T.w * 3 - 1, 0], [T.w * 3 - 1, T.h * 3 - 1], [0, T.h * 3 - 1]], tex: { w: T.w * 3, h: T.h * 3, d: tile3(T) }, shade: [.55, .55, 1, 1], bias: 2000 });
  // the terrain's ground, laid inside the table's border while it holds; a new ground comes in row by row from its owner's side
  for (let j = 0; j < 4; j++) { const ter = W ? (tick >= W.t + (W.near ? 3 - j : j) * 2 ? W.to : W.from) : v.terrain, tg = ter && TEX['t-' + ter.id];
    if (tg) for (let i = 0; i < 2; i++) { const x0 = -170 + i * 170, z0 = -170 + j * 85;
      R3.quad(view, { p: [[x0, 0, z0], [x0 + 170, 0, z0], [x0 + 170, 0, z0 + 85], [x0, 0, z0 + 85]], uv: [[0, 0], [tg.w - 1, 0], [tg.w - 1, tg.h - 1], [0, tg.h - 1]], tex: tg, shade: .66 + .34 * (j + 1) / 4, bias: 1500 }); } }
  const off = v.mon[0].length < 5 ? 1 : 0;
  for (const seat of [0, 1]) for (let z = 0; z < 5; z++) { // the zone outlines, cut into the stone
    const cx = TBL.zx(z), cz = TBL.row[seat], shut = off && (z === 0 || z === 4);
    R3.quad(view, { p: [[cx - 25, 0, cz - 33], [cx + 25, 0, cz - 33], [cx + 25, 0, cz + 33], [cx - 25, 0, cz + 33]], uv: UV0, col: shut ? [58, 36, 25] : [96, 66, 44], shade: .9, bias: 1000 });
    if (!shut) R3.quad(view, { p: [[cx - 23, 0, cz - 31], [cx + 23, 0, cz - 31], [cx + 23, 0, cz + 31], [cx - 23, 0, cz + 31]], uv: UV0, col: [140, 104, 66], shade: .9, bias: 999 });
  }
  const rings = [];
  if (!live && PSV.hl) for (const [k, kind] of PSV.hl) { const [s, z] = k.slice(1).split('.').map(Number), t = ringWidth(s), q = ring(view, proj, s, z + off, kind, blink, t, !!(v.mon[s][z] && v.mon[s][z].pos === 'd')); if (q) rings.push([s, z, kind, t, ...q.flatMap(p => [p[0], p[1]])]); }
  const home = (s, z, small) => small ? { x: TBL.zx(z), y: 0, z: TBL.trap[s], small: true } : { x: TBL.zx(z + off), y: 0, z: TBL.row[s] };
  const actorOn = (k, tk) => { let a = null; if (live) for (const x of B.acts) if (x.key === k && tk >= x.t0 && tk < x.t1 && (!a || x.t0 >= a.t0)) a = x; return a; };
  const instAt = (k, pi, vi, tk) => !live ? vi : pi && vi && pi.u != null && pi.u === vi.u ? (tk >= (B.look[k] ?? 0) ? vi : pi) : (tk < (B.swap[k] ?? 0) ? pi : vi);
  const shadeAt = (k, tk) => { if (!live) return 1; let s = 1; for (const x of B.flash) if (x.key === k && tk >= x.t && tk < x.t + x.k.length) s *= x.k[tk - x.t]; return s; };
  const plates = [], marks = [], cards = [], tight = tightPlates(proj), scr = p => p.map(proj).filter(Boolean);
  // Each card and each piece drawn, with the last tick at which it may still lie where it is drawn now: a card at rest
  // only now, a card in a move until the move is over, a piece until the last piece of its card is taken away.
  const covers = [], lungeEnd = a => { const L = B.fights.find(x => x.act === a), e = L ? L.end() : Infinity; return e === Infinity ? tick + 1 : e; };
  const coverTill = a => !live || !a ? tick + 1 : a.t1 !== Infinity ? a.t1 : lungeEnd(a);
  // The monster a blow is coming at stands its numbers down with the attacker's: from the moment the attack sets off (or
  // while it waits poised on your answer) until the attacker is home again or has broken, so in a fight neither number
  // is half hidden by the other card. The one left standing shows its numbers again then; the one that falls takes them.
  const fightEnd = L => L.end() !== Infinity ? L.end() : Math.min(Infinity, ...B.shards.filter(s => s.key === mkey(L.seat, L.from)).map(s => s.t));
  const struck = (seat, z) => live ? B.fights.some(L => L.to === z && 1 - L.seat === seat && tick >= (L.held ? 0 : L.start) && tick < fightEnd(L)) : !!(PSV.pend && PSV.pend.to === z && 1 - PSV.pend.seat === seat);
  const slot = (seat, z, small) => {
    const k = small ? tkey(seat, z) : mkey(seat, z), pi = small ? (P.traps[seat] || [])[z] : P.mon[seat][z], vi = small ? (v.traps[seat] || [])[z] : v.mon[seat][z];
    const a = actorOn(k, tick), base = instAt(k, pi, vi, tick), o = a && a.inst ? a.inst(tick) : undefined, inst0 = o === undefined ? base : o;
    let pose = a ? a.pose(tick) : home(seat, z, small);
    if (!live && !small && PSV.pend && PSV.pend.seat === seat && PSV.pend.from === z) { const pk = PSV.pend, H = home(seat, z), Tg = pk.to >= 0 ? home(1 - seat, pk.to) : { x: H.x * .5, z: seat ? 160 : -160 }, kk = POISE[POISE.length - 1][0] * (pk.to >= 0 ? .85 : 1); pose = { x: H.x + (Tg.x - H.x) * kk, y: 12, z: H.z + (Tg.z - H.z) * kk, poised: true }; } // poised while you answer it
    if (!inst0) return;
    const inst = small && !(a && a.shown) ? (seat === 1 ? { veil: true } : { ...inst0, veil: true, id: null }) : inst0; // set cards lie face down
    const p = layCard(view, inst, seat, pose, shadeAt(k, tick)); cards.push([k, p]); covers.push([k, scr(p), coverTill(a)]);
    // A monster shows its numbers only while it lies on its zone. A card off the table (lunging, poised over the gap while
    // its attack is answered, turning, sent back) takes them with it and lays them down again when it lands, so in a
    // battle the attacker's numbers never fly over the other card, and the prompt that holds a poised card names them.
    if (!small && inst.id && inst.ea != null && !(seat === 1 && inst.veil) && !pose.y && (pose.wide ?? 1) === 1 && !pose.tilt && !pose.turn && !pose.poised && !struck(seat, z)) plates.push({ seat, z, lines: numLines(inst, seat, tight), p }); // a card turned face up in the beat shows its numbers once the board has them
    if (!small && !live && PSV.marks && seat === 1 && PSV.marks.has(z)) marks.push({ lines: MARK_LINES[PSV.marks.get(z)], p });
  };
  for (const seat of [1, 0]) { v.mon[seat].forEach((m, z) => slot(seat, z, false)); (v.traps[seat] || []).forEach((t, z) => slot(seat, z, true)); }
  if (live) {
    for (const a of B.acts) if (!a.key && tick >= a.t0 && tick < a.t1) { const p = layCard(view, a.inst(tick), a.seat, a.pose(tick)); cards.push(['', p]); covers.push(['', scr(p), a.t1]); }
    for (const s of B.shards) { const age = tick - s.t; if (age < 0 || age >= SHARD_LIFE) continue;
      let pose = s.pose; if (!pose) { const a = actorOn(s.key, s.t), [sd, zz] = s.key.slice(1).split('.').map(Number); pose = a ? a.pose(s.t) : home(sd, zz, s.key[0] === 't'); }
      for (const p of layShards(view, s.inst, s.seat, pose, age)) { cards.push(['*', p]); covers.push(['*', scr(p), s.t + SHARD_LIFE]); } }
  }
  // The numbers lie on the table beside their cards, under every card: they are put into the scene after the table, its
  // ground and its marks and before the first card (PLATE_Z among the shapes' depths), so they never lie over a card's
  // picture. And a number is shown whole or not at all: a monster's numbers are held back while another card or a piece
  // lies over any pixel of them, and in a move from the first drawing at which one does until it may have gone (its move
  // over, or the last piece of its card taken away), so they never show cut ('200' over a piece) nor blink as it passes.
  const out = [], ready = glyphsReady();
  for (const pl of ready ? plates : []) { const s = scr(pl.p); if (s.length < 4) continue; const [w, h] = plateSize(pl.lines), by = [...s].sort((a, b) => a[1] - b[1]);
    const edge = pl.seat === 0 ? by.slice(0, 2) : by.slice(2), mx = Math.round((edge[0][0] + edge[1][0]) / 2);
    pl.r = [mx - (w >> 1), pl.seat === 0 ? Math.min(...edge.map(q => q[1])) - 1 - h : Math.max(...edge.map(q => q[1])) + 2, w, h]; }
  const whole = pl => { if (!pl.r) return false; const k = mkey(pl.seat, pl.z); let till = -1;
    for (const [ck, s, t] of covers) if (ck !== k && t > till && s.length === 4 && quadMeets(s, pl.r)) till = t;
    if (!live) return till < 0;
    B.held = B.held || {}; if (till > (B.held[k] ?? -1)) B.held[k] = till;
    return tick >= (B.held[k] ?? -1); };
  const shown = plates.filter(whole);
  if (ready) R3.sprite(view, PLATE_Z, () => { for (const pl of shown) out.push([pl.seat, pl.z, ...putPlate(view, pl.r[0], pl.r[1], pl.lines)]); });
  R3.draw(view, proj, [420, 760]);
  // the forecasts, flat over the scene on the middle of the card each speaks of (drawn only while no move plays)
  if (ready) for (const mk of marks) { const s = scr(mk.p); if (s.length < 4) continue; const [w, h] = plateSize(mk.lines), mx = Math.round(s.reduce((n, q) => n + q[0], 0) / 4), my = Math.round(s.reduce((n, q) => n + q[1], 0) / 4);
    putPlate(view, mx - (w >> 1), my - (h >> 1), mk.lines); }
  R3.present(view);
  // for the checks: the plates as drawn, each card's corners on the screen, the camera, the notation, the beat's tick, the
  // zones' marks (seat, zone, kind, width, the corners of the shape each goes round) and the numbers held back (seat, zone)
  const held = plates.filter(pl => pl.r && !shown.includes(pl)).map(pl => [pl.seat, pl.z]);
  Object.assign(cv.dataset, { plates: JSON.stringify(out), cards: JSON.stringify(cards.map(([k, p]) => [k, ...scr(p).flatMap(q => [q[0], q[1]])])), cam: JSON.stringify({ ...TBL.cam, off }), tight: tight ? 1 : 0, tick: live ? tick : -1, rings: JSON.stringify(rings), held: JSON.stringify(held) });
}
// Whether a shape as drawn (four corners on the screen) covers any pixel of a box (x, y, w, h): a pixel whose middle lies
// inside it or on its edge, as the rasteriser covers one.
function quadMeets(s, [x, y, w, h]) {
  const xs = s.map(p => p[0]), ys = s.map(p => p[1]);
  if (Math.max(...xs) < x + .5 || Math.min(...xs) > x + w - .5 || Math.max(...ys) < y + .5 || Math.min(...ys) > y + h - .5) return false;
  const inside = (px, py) => { let sg = 0; for (let i = 0; i < 4; i++) { const a = s[i], b = s[(i + 1) % 4], c = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]); if (c) { if (sg && Math.sign(c) !== sg) return false; sg = Math.sign(c); } } return true; };
  for (let j = Math.max(y, Math.floor(Math.min(...ys))); j < Math.min(y + h, Math.ceil(Math.max(...ys)) + 1); j++) for (let i = Math.max(x, Math.floor(Math.min(...xs))); i < Math.min(x + w, Math.ceil(Math.max(...xs)) + 1); i++) if (inside(i + .5, j + .5)) return true;
  return false;
}
// Where the numbers fall in the table's drawing order: farther than every card (a card lies at depth 400 to 700 and one
// lifted or shown is drawn nearer still), nearer than the table, its ground, its zone outlines (all biased by 999 and more
// past their depth) and the zones' marks (RING_Z).
const PLATE_Z = 900;
// The table's own pictures (its model's skins, or its top) and the card back: the table is drawn only once they are in.
const tableReady = () => { const M = tmodel(); return TEX.back !== undefined && (M ? Object.keys(M.pics).every(t => TEX['m-' + t] !== undefined) : TEX.table !== undefined); };
function tile3(T) { if (T.t3) return T.t3; const w = T.w * 3, h = T.h * 3, d = new Uint32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d[y * w + x] = T.d[(y % T.h) * T.w + (x % T.w)]; T.t3 = d; return d; }
// The things over the view and the pillars that move with the beat: the Life Points as the blows land, the change rising
// over the face it struck, the relics' strips, the view shaking under a heavy blow. Read from the beat's clock, so a
// screen drawn again part-way (a window opened) picks them up where they are.
const FLOAT_LIFE = 27, STRIP_STEP = 6, STRIP_HOLD = 24;
function beatDom() {
  if (!PSV) return;
  const B = PSV.beat, now = performance.now(), tick = B ? beatTick(B, now) : 0;
  if (B && B.P) for (const seat of [0, 1]) { const el = document.getElementById(seat ? 'rivalLp' : 'myLp'), ga = document.getElementById(seat ? 'rivalGa' : 'myGa'); if (!el) continue;
    const st = lpAt(B, seat, tick), txt = String(st.n); if (el.textContent !== txt) { el.textContent = txt; el.style.left = ((+el.dataset.r || 88) - txt.length * 6) + 'px'; }
    el.style.color = st.hot == null ? '' : st.hot < 0 ? '#f08a72' : '#9fd0c0';
    if (ga && ga.firstElementChild) { const gw = ga.clientWidth || 78; ga.firstElementChild.style.width = Math.max(0, Math.min(gw, Math.round(gw * st.g / 8000))) + 'px'; } }
  // the change in Life Points rises over the face of the one it struck, in whole pixels, and is gone
  PSV.floats = PSV.floats.filter(x => now - x.at < FLOAT_LIFE * TICK);
  for (const seat of [0, 1]) { const fl = PSV.floats.filter(x => x.seat === seat && now >= x.at).pop(), host = document.querySelector(`#app.ps .pf[data-face="face${seat}"]`), pf = host && host.querySelector('img[data-pic]');
    let el = document.querySelector(`#app.ps [data-lpf="${seat}"]`);
    if (!fl || !host) { if (el) el.remove(); continue; }
    if (!el || el.parentElement !== host) { if (el) el.remove(); el = document.createElement('b'); el.dataset.lpf = seat; host.appendChild(el); }
    const age = Math.floor((now - fl.at) / TICK), txt = (fl.d > 0 ? '+' : '') + fl.d; el.className = 'lpfl' + (fl.d > 0 ? ' lpgn' : '');
    if (el.textContent !== txt) { el.textContent = txt; const half = el.offsetWidth >> 1, fs = pf ? pf.width || 64 : 64, fx = fs >> 1, fy = fs * 5 >> 3; el.style.left = (fx - half) + 'px'; el.style.top = fy + 'px'; if (pf) Object.assign(el.dataset, { art: 'face' + seat, at: `${fx},${fy}`, pin: `${half},0` }); } // its top middle on the point of the face under the eyes
    el.style.transform = `translateY(-${Math.min(4, Math.floor(age / 3)) * 2}px)`; }
  // the relics that fire: a strip at the rival's side of the view (the top) or yours (the bottom), its medals set in one by one
  PSV.strips = PSV.strips.filter(x => now < x.until);
  const vw = DUAL ? null : document.querySelector('#app.ps .vw');
  // With two frames nothing is drawn over the table: the bar says the relic's words, and a relic of yours that fires
  // lights its own place on the relic belt of the bottom frame (the last place, when it is one of those counted there).
  if (DUAL) { const st = PSV.strips.find(x => x.seat === 0), on = new Set(st ? st.list.filter(x => now >= x.at).map(x => x.e.id) : []), sl = [...scrB.querySelectorAll('.sl[data-rid]')];
    for (const e of sl) e.classList.toggle('fire', on.has(e.dataset.rid) || (e.dataset.rid === '+' && [...on].some(id => !sl.some(x => x.dataset.rid === id)))); }
  for (const seat of [0, 1]) { const st = PSV.strips.find(x => x.seat === seat), el = vw && vw.querySelector(`[data-rs="${seat}"]`);
    const shown = st ? st.list.filter(x => now >= x.at) : [];
    if (!shown.length || !vw) { if (el) el.remove(); continue; }
    const sig = shown.map(x => x.e.id).join(); if (el && el.dataset.sig === sig) continue;
    const last = shown[shown.length - 1].e, html = `<span class="wn rlc">${shown.slice(-3).map(x => medal(x.e.id, 24)).join('')}<b class="lb g">${esc(fitName(RELICS[last.id].name + bonusText(last), 30))}</b></span>`;
    const box = el || Object.assign(document.createElement('div'), { className: 'rlcw' }); box.dataset.rs = seat; box.dataset.sig = sig; box.innerHTML = html;
    box.style.top = seat ? '2px' : (viewSize().h - 30) + 'px'; if (!el) vw.appendChild(box);
    const s = box.firstElementChild; s.style.left = ((box.clientWidth - s.offsetWidth) >> 1) + 'px'; } // in the middle of the view, at a whole pixel
  // a heavy blow shakes the picture inside the window, never the window
  const tv = document.querySelector('#app.ps .tvw'), sh = B ? B.shakes.map(t => tick - t).find(a => a >= 0 && a < 5) : undefined;
  if (tv) tv.style.transform = sh == null ? '' : ['translate(-2px,1px)', 'translate(-2px,1px)', 'translate(2px,-1px)', 'translate(2px,-1px)', 'translate(-1px,0)'][sh];
}
// The beat begins: what the frame brings that outlives it (the floats and the strips) is set by the clock now.
function startBeat(f) {
  if (!PSV) PSV = { v: f.view, beat: null, hl: null, marks: null, pend: null, s: 1, floats: [], strips: [] };
  const B = beatOf(f), abs = t => B.t0 + t * TICK / B.speed; PSV.beat = B;
  for (const x of B.lp) PSV.floats.push({ seat: x.seat, d: x.to - x.from, at: abs(x.t) });
  const bySeat = [[], []]; for (const r of B.relics) bySeat[r.e.seat === 0 ? 0 : 1].push(r);
  bySeat.forEach((l, seat) => { if (!l.length) return; let st = PSV.strips.find(x => x.seat === seat && x.until > B.t0);
    if (!st) PSV.strips.push(st = { seat, list: [], until: 0 });
    l.forEach((r, i) => { const t = Math.max(abs(r.t + i * STRIP_STEP), st.list.length ? st.list[st.list.length - 1].at + STRIP_STEP * TICK / B.speed : 0); st.list.push({ e: r.e, at: t }); st.until = t + STRIP_HOLD * TICK; }); });
  return B;
}
let psRaf = 0;
// The table's clock: while a beat runs, a float rises, a strip shows or a target blinks, draw again at each new tick.
function psLoop() {
  cancelAnimationFrame(psRaf); if (!PSV || !document.getElementById('tbl')) return;
  psPaint(); beatDom();
  const now = performance.now(), B = PSV.beat;
  if ((B && beatTick(B, now) <= B.end + 1) || PSV.floats.length || PSV.strips.length || (PSV.hl && [...PSV.hl.values()].includes('target'))) psRaf = requestAnimationFrame(psLoop);
}
// Where a zone of the table lands in the window: its four corners, for its tap area.
function zoneQuad(seat, zi, trap = false) {
  const proj = R3.camera(TBL.cam), cx = TBL.zx(zi), cz = trap ? TBL.trap[seat] : TBL.row[seat], hw = trap ? 17 : 25, hd = trap ? 22 : 33;
  return [[cx - hw, 0, cz - hd], [cx + hw, 0, cz - hd], [cx + hw, 0, cz + hd], [cx - hw, 0, cz + hd]].map(p => proj(p).slice(0, 2));
}
// A tap area over a zone: a button the size of the zone's box, cut to the zone's own four corners, drawing nothing (the
// zone's marks are cut into the table itself).
const zoneTap = (q, attrs) => { const x = Math.min(...q.map(p => p[0])), y = Math.min(...q.map(p => p[1])), w = Math.max(...q.map(p => p[0])) - x, h = Math.max(...q.map(p => p[1])) - y;
  return `<button class="zh" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;clip-path:polygon(${q.map(p => `${p[0] - x}px ${p[1] - y}px`).join(',')})" ${attrs}></button>`; };
// Short words for the plaques.
const PLAY_WORDS = (x, free, aimM) => x.pos === 'a' ? (x.veiled ? 'VEILED ATK' : 'ATTACK POS') : x.pos === 'd' ? (x.veiled ? 'SET VEILED' : 'DEFENSE POS') : (free ? 'PLAY FREE' : aimM ? 'PLAY ON TARGET' : 'PLAY');
// The window that ends a duel opens over the board as the last blow left it, not over the screen that comes next.
const endShown = () => G.overlay && G.overlay.kind === 'duelEnd' && G.endFrame && !G.shown ? G.endFrame : null;
// With two frames a hand card keeps the place it was dealt to: a card played leaves its place empty, and a card drawn
// steps into the first empty place. Gives each hand card's place, 0 to 5; a hand that will not fit so is closed up.
function handSlots(hand, key) {
  const H = G.hslot && G.hslot.key === key ? G.hslot : (G.hslot = { key, s: [] }), us = hand.map(c => c.u);
  if (us.some(u => u == null) || hand.length > 6) { H.s = []; return hand.map((c, i) => i); }
  let s = H.s.map(u => us.includes(u) ? u : null);
  for (const u of us) if (!s.includes(u)) { const k = s.indexOf(null); if (k < 0) s.push(u); else s[k] = u; }
  if (s.length > 6) s = us.slice();
  H.s = s; return us.map(u => s.indexOf(u));
}
// Where a hand card stands counted from the left, 0 first, and the hand card that stands first. With one frame the
// hand is closed up, so a card's place is its number in the hand.
function handPlace(hand, n) {
  if (!DUAL || !G.hslot) return n;
  const at = handSlots(hand, G.hslot.key);
  return at.filter(k => k < at[n]).length;
}
const handFirst = hand => { const i = hand.findIndex((c, n) => !handPlace(hand, n)); return i < 0 ? 0 : i; };
function psDuel() {
  const live = G.run.duel, f = G.shown || endShown();
  const v = f ? f.view : live ? viewFor(live, db, 0) : null;
  if (!v) return frame({});
  if (DUAL) { F.view = { w: 640, h: 304 }; // the table has the top frame's whole width
    // Each turn of yours opens with the cursor on the first hand card and that card on the page, never on a plaque.
    const tk = live && !G.playing && live.active === 0 && !live.pending ? live.turn : null;
    if (tk != null && G.turnAt !== tk) { G.turnAt = tk; NAV.key = null; G.look = v.hand.length ? 'h:' + handFirst(v.hand) : null; }
    // A Trap prompt that opens in the rival's turn takes the cursor from wherever it waited: it starts on SPRING IT, so A springs the Trap and B lets the attack through.
    const pk = live && !G.playing && live.active === 1 && live.pending && live.pending.options && live.pending.options.length ? live.turn + ':' + live.pending.from + ':' + live.pending.to : null;
    if (pk !== G.promptAt) { G.promptAt = pk; if (pk != null) { NAV.key = null; G.trapSel = 0; G.look = null; } }
    if (!G.look && v.hand.length && live && !G.playing) G.look = 'h:' + handFirst(v.hand);
    if (G.attacker != null && !/^(z|g|r):/.test(G.look || '')) G.look = 'z:0:' + G.attacker; } // the page reads the monster that is about to attack
  const rv = f ? f.rival : info(G.run);
  const myTurn = !G.playing && live && !live.pending && live.active === 0;
  const pend = !G.playing && live && live.pending && live.active === 1;
  const la = myTurn ? legalActions(live, db, { maxChain: 1 }) : [];
  const canAtk = new Map(); la.filter(a => a.t === 'attack').forEach(a => { if (!canAtk.has(a.from)) canAtk.set(a.from, []); canAtk.get(a.from).push(a.to); });
  const canPos = new Set(la.filter(a => a.t === 'pos').map(a => a.zone));
  const canPlay = myTurn && !live.played && !live.attacked;
  const targets = G.attacker != null ? (canAtk.get(G.attacker) || []) : [];
  const holds = m => m.e === 'bulwark' && !m.bulwarkUsed;
  const aim = canPlay && G.sel.length === 1 && G.onto == null && live.hand[0][G.sel[0]] ? aimFor(db, live, live.hand[0][G.sel[0]].id) : null;
  const aimed = aim && G.aim != null && aim.zones.includes(G.aim) ? G.aim : null;
  const T = tips(), lesson = canPlay && G.attacker == null && G.onto == null && live.seat[0].rs.loneTurn !== live.turn && !(T.meld && T.fuel && T.single) ? lessonFor(db, live, T) : null;
  G.lesson = lesson ? lesson.kind : null;
  let bar = '', cmds = [], chosen = null, saidHand = '', saidAim = '';
  if (canPlay && G.sel.length) {
    const cards = G.sel.map(i => live.hand[0][i]); const ontoM = G.onto != null ? live.mon[0][G.onto] : null;
    const plan = planChain(db, cards, ontoM, { tinder: v.relics.includes('tinder_vow'), steady: v.relics.includes('steady_hand') && !v.rs.steady });
    const ids = (ontoM ? [ontoM.id] : []).concat(cards.map(c => c.id));
    const allKnown = plan.tried.every(t => codexKnows(db, k => G.known.has(k), t[0], t[1], t[2]));
    const vars = playVariants(live, db, 0, G.sel, G.onto);
    const loneNow = live.seat[0].rs.loneTurn === live.turn, freeNow = db.config.freeCast === 'lone' && !live.seat[0].noFree && live.seat[0].rs.freeTurn !== live.turn && G.sel.length === 1 && G.onto == null;
    const aimM = aimed != null ? v.mon[aim.side][aimed] : null, aimName = aimM ? (aimM.id ? card(aimM.id).name : 'the veiled monster') : '';
    bar = ids.map(id => esc(card(id).name)).join(' <b class="g">+</b> ') + (ids.length < 2 ? '' : ` <b class="g">=</b> ${allKnown ? esc(card(plan.final.id).name) + (plan.fizzles ? ` (${plan.fizzles} fizzle)` : '') : '? an unknown meld'}`);
    if (ids.length === 1 && DUAL) bar += '.'; // the card's own page is on the bottom frame
    else if (ids.length === 1) bar += '. ' + esc(db.isMonster(ids[0]) ? `${card(ids[0]).type}, ${card(ids[0]).attr}, Level ${card(ids[0]).level}.` : rulesText(ids[0]));
    if (!vars.length) bar = esc(loneNow && (G.sel.length > 1 || G.onto != null) ? 'You played a free support card this turn, so you cannot meld. Play one card on its own.' : 'That cannot be played right now.');
    else if (aim) bar += ' ' + esc(aimM ? 'Target: ' + aimName + '.' : `Tap ${aim.side ? 'a rival monster' : 'one of your monsters'} to aim it.`);
    // With two frames what choosing means stands on the chosen card's page, and the bar goes on telling the fight.
    if (DUAL) { // While the lit plaque is the play, A on the chosen card plays it; what A does on another hand card, or on a
      // monster the card can be aimed at, stands in words at the page's foot (the cards carry the same words as data-said).
      const canAdd = vars.length && !loneNow && live.hand[0].length > G.sel.length; saidHand = canAdd ? 'A on another card adds it' : ''; saidAim = vars.length && aim ? 'aims it' : '';
      chosen = { head: `${ids.length} CHOSEN · ${!vars.length ? 'NO PLAY' : ids.length > 1 ? 'A MELD' : aim ? 'NEEDS A TARGET' : 'PLAYS ALONE'}`,
        html: !vars.length ? bar : ids.length > 1 ? (allKnown ? `Makes ${esc(card(plan.final.id).name)}${plan.fizzles ? ` (${plan.fizzles} fizzle)` : ''}.` : 'An unknown meld.') + (canAdd ? ' A on another card adds it.' : '')
          : esc(aim ? (aimM ? `Target: ${aimName}. A on another aims it there.` : `A on ${aim.side ? 'a rival monster' : 'one of your monsters'} aims it.`) : loneNow ? 'No meld this turn: your support card was free.' : canAdd ? 'A on another card adds it to a meld, left to right.' : 'It is your last hand card.') };
      bar = esc(G.log.slice(-2).join(' ')) || 'Your turn.'; }
    cmds = vars.map((x, i) => [PLAY_WORDS(x, freeNow, aimM), `play:${x.pos || ''}:${x.veiled ? 1 : 0}`, { lit: i === 0 }]).concat([['UNDO', 'undo']]);
    if (G.sel.length === 1) cmds.push(['SCRAP CARD', 'scrap']);
    if (v.relics.includes('clean_draw') && !v.rs.cleanDraw) cmds.push(['CLEAN DRAW', 'clean']);
  } else if (G.attacker != null) {
    bar = targets.length ? 'Pick a target. The mark over each rival says how the attack ends.' : 'This monster has nothing it can attack.';
    if (targets.includes(-1)) cmds.push([`DIRECT ${v.mon[0][G.attacker].ea}`, 'hit:-1', { lit: true }]);
    if (canPos.has(G.attacker)) cmds.push(['CHANGE POS', 'pos']);
    if (DUAL) { // a pad has no second tap: the bar says what A does now, and melding onto the monster is a plaque of its own
      const X = live.mon[0][G.attacker], meld = canPlay && live.hand[0].length > 0 && live.seat[0].rs.loneTurn !== live.turn;
      bar = targets.includes(-1) ? `No rival monster stands in the way. A attacks directly for ${v.mon[0][G.attacker].ea}.` : targets.length ? 'Pick a target above. Its mark says how the attack ends.'
        : live.turn === 1 ? 'No attacks on the first turn.' : X && X.pos !== 'a' ? 'A monster in defense cannot attack.' : X && (X.att || 0) > 0 ? 'This monster has attacked this turn.' : live.attacked && !canAtk.size ? 'No more attacks this turn.' : 'This monster cannot attack now.';
      if (meld) cmds.push(['MELD ONTO IT', `onto:${G.attacker}`, { lit: !targets.length }]);
      // with no attack and no meld left, turning the monster is the one thing A can still do with it: that plaque is lit and the bar says so
      const turnIt = cmds.find(c => c[1] === 'pos'); if (turnIt && !targets.length && !cmds.some(c => c[2] && c[2].lit)) { turnIt[2] = { lit: true }; bar += ' A changes its position.'; } }
    cmds.push(['CANCEL', 'undo']);
  } else if (G.onto != null) { bar = 'Now tap hand cards to meld onto it.'; cmds.push(['CANCEL', 'undo']); }
  else if (lesson) { const [h, t] = lessonText(lesson.kind, lesson.cards.map(i => card(live.hand[0][i].id).name)); bar = `<b class="g">${esc(h)}.</b> ${esc(t)}`; cmds.push(['NO LESSONS', 'tipsoff']); }
  else if (myTurn) bar = counsel() ? `<b class="g">Counsel.</b> ${esc(counsel())}` : canPlay ? (live.seat[0].rs.loneTurn === live.turn ? 'Support turn: your support card was free. Play one card on its own. No meld this turn.' : 'Tap hand cards in order. One card plays it. Two or more meld, left to right.') : 'Tap one of your monsters to attack with it, or end your turn.';
  // two frames: once the card is played the bar never asks for an attack that no monster can make
  if (DUAL && myTurn && !canPlay && !canAtk.size && G.attacker == null && G.onto == null && !lesson && !counsel()) bar = live.turn === 1 ? 'No attacks on the first turn. X ends your turn.' : 'Nothing of yours can attack now. X ends your turn.';
  if (G.playing || !live) bar = esc(G.log.slice(-2).join(' ') || ''); // while a move plays, and once the duel is over, the bar reads out what is shown
  else if (!myTurn) bar = pend ? 'Answer the attack.' : 'The rival is thinking.';
  // The table: the hall's painting and the table in front of it as one scene, the canvas drawing the table, and a tap
  // area cut to each zone's own four corners. The zones' marks, the numbers and the forecasts are drawn into the table.
  const fl = G.run.floor + 1, hallName = rv.tier === 'secret' && CART.has('room-bare') ? 'room-bare' : rv.tier === 'boss' && CART.has('room-guardian') ? 'room-guardian' : CART.has('hall-duel-' + fl) ? 'hall-duel-' + fl : 'hall-duel'; // a guardian waits in its own hall
  const vs = viewSize(), hp = hallPic(hallName); TBL.cam = tableCam(vs.w, vs.h, hp.s);
  const off = v.mon[0].length < 5 ? 1 : 0;
  const fc = z => { const X = live.mon[0][G.attacker], Tm = v.mon[1][z]; if (z < 0 || Tm.veil) return '?'; const q = forecast(live, db, 0, X, 1, live.mon[1][z]); const kt = q.killT && !holds(live.mon[1][z]), kx = q.killX && !holds(X); return kt && kx ? 'BOTH FALL' : kt ? 'WINS' : kx ? 'LOSES' : 'NO KILL'; };
  const hl = new Map(), marks = new Map(), nums = m => `, ${m.ea} ATK, ${m.ed} DEF${m.pos === 'd' ? ', in defense' : ''}`;
  let taps = '';
  for (const seat of [1, 0]) v.mon[seat].forEach((m, z) => {
    const k = mkey(seat, z); let attrs = `data-zone="${seat}:${z}"`;
    if (DUAL && m) attrs += ` data-k="z${seat}${z}" data-g="row${seat}" data-look="z:${seat}:${z}"`;
    if (aim && aim.side === seat && m) { hl.set(k, aimed === z ? 'picked' : 'target'); attrs += ` data-a="aim:${z}"${saidAim ? ` data-said="${saidAim}"` : ''}`; }
    else if (seat === 0 && m && myTurn) { if (G.attacker === z) hl.set(k, 'picked'); else if (G.onto === z) hl.set(k, 'onto'); else if (canAtk.has(z)) hl.set(k, 'ready'); attrs += ` data-a="mine:${z}"`;
      // With a pad, A on the monster about to attack is the attack itself or one step from it: the lit plaque (DIRECT,
      // or MELD ONTO IT when it cannot attack), else the cursor goes to its first target. A does nothing on a monster
      // being melded onto, nor on any monster while hand cards are chosen.
      if (DUAL && !canPlay && !G.sel.length && G.attacker == null && G.onto == null && z === [...canAtk.keys()].sort((p, q) => p - q)[0]) attrs += ' data-n1'; // once the hand cannot be played the cursor waits on the first monster that can still attack
      if (DUAL) { const first = targets.filter(t => t >= 0).sort((p, q) => Math.abs(p - z) - Math.abs(q - z) || p - q)[0]; if (G.attacker === z) attrs += ` data-act="${targets.includes(-1) || cmds.some(c => c[2] && c[2].lit) ? 'plaque' : first != null ? 'to:z1' + first : ''}"`; else if (G.onto === z || G.sel.length) attrs += ' data-act=""'; } }
    else if (seat === 1 && m && targets.includes(z)) { hl.set(k, 'target'); attrs += ` data-a="hit:${z}"`; marks.set(z, fc(z)); }
    else if (m) attrs += ` data-a="inspectz:${seat}:${z}"`;
    const said = !m ? 'Empty zone' : m.id && !(seat === 1 && m.veil) ? card(m.id).name + nums(m) + (marks.has(z) ? `, ${marks.get(z).toLowerCase()}` : '') : 'Veiled monster';
    taps += zoneTap(zoneQuad(seat, z + off), `${attrs}${hl.has(k) ? ` data-hl="${hl.get(k)}"` : ''} aria-label="${esc(said)}"`);
  });
  v.traps[0].forEach((t, z) => { if (t) taps += zoneTap(zoneQuad(0, z, true), `data-zone="t0:${z}" data-a="inspect:${t.id}"${DUAL ? ` data-k="t0${z}" data-g="row0" data-look="t0:${z}"` : ''} aria-label="${esc(card(t.id).name)}, set"`); });
  const pk = v.pending && v.pending.kind === 'trap' ? { seat: v.active, from: v.pending.from, to: v.pending.to } : null; // an attack held while it is answered stands poised
  PSV = { v, beat: PSV && PSV.beat && PSV.beat.f === f && f ? PSV.beat : null, hl: hl.size ? hl : null, marks: marks.size ? marks : null, pend: pk, s: hp.s, floats: PSV ? PSV.floats : [], strips: PSV ? PSV.strips : [] };
  const view = `<div class="tvw" style="width:${vs.w}px;height:${vs.h}px"><img class="ab" data-pic="hall" src="${hp.src}" style="left:${hp.ox}px;top:${hp.oy}px" width="${hp.pw}" height="${hp.ph}" alt="">${hp.edge}<canvas id="tbl" width="${vs.w}" height="${vs.h}"></canvas>${taps}</div>`;
  // With two frames a card drawn comes out from under the deck pile, whole all the way, and the hand's box cuts nothing.
  // The hand. A card drawn in this step slides in from the ledge's empty right end, stepped, when the beat comes to it (timed from
  // the beat's own clock, so a screen drawn again part-way picks it up where it is).
  // Its slot shows empty until it lands, and it slides over the empty slots to its right, never under their outlines.
  const B = PSV.beat, was = B && B.P && B.hand >= 0 ? new Set(B.P.hand.map(c => c.u)) : null; let dealt = '', nd = 0;
  const hw = DUAL ? 308 : ledgeW(), hx = DUAL ? 8 : (hw - 296) >> 1, hy = DUAL ? 10 : 0, empty = x => `<i class="ab" style="left:${x}px;top:${hy}px;width:44px;height:60px;border:1px solid var(--dark)"></i>`; // with two frames: six places that never move, on the bottom frame
  const slot = DUAL ? handSlots(v.hand, `${G.run.floor}:${G.run.chamber}:${rv.name}`) : null, at6 = slot ? [0, 1, 2, 3, 4, 5].map(k => slot.indexOf(k)) : [0, 1, 2, 3, 4, 5];
  const first = at6.findIndex(i => i >= 0);
  const hand = at6.map((i, place) => { const c = v.hand[i], k = G.sel.indexOf(i), lp = lesson ? lesson.cards.indexOf(i) : -1, x = hx + place * 50;
    if (!c) return empty(x);
    const el = psCard(c, x, DUAL ? hy : k >= 0 ? -4 : 0, { cls: 'hs ' + (canPlay ? 'can ' : '') + (k >= 0 ? 'sel' : ''), attrs: G.playing ? '' : `data-a="hand:${i}"` + (DUAL ? ` data-k="h${i}" data-g="hand" data-look="h:${i}"${canPlay ? '' : ' data-act=""'}${k < 0 && saidHand ? ` data-said="${saidHand}"` : ''}${place === first && myTurn && (canPlay || !canAtk.size) && !G.sel.length && G.attacker == null && G.onto == null ? ' data-n1' : ''}` : ''), badge: k >= 0 ? k + 1 : '', pip: lp >= 0 ? lp + 1 : '' });
    if (!was || c.u == null || was.has(c.u)) return el;
    const at = B.t0 + (B.hand + 3 * nd++) * TICK / B.speed - performance.now();
    dealt += `<div class="ab dealt" style="--dx:${Math.ceil(((DUAL ? 314 : hw) - x) / 6) * 6}px;animation-duration:${Math.round(6 * TICK / B.speed)}ms;animation-delay:${Math.round(at)}ms">${el}</div>`;
    return empty(x); }).join('') + dealt;
  // the Forger's Power, on your pillar
  let power = '';
  if (myTurn && v.forger && !v.rs.power) { const Fg = FORGERS[v.forger], pa = powerActions(live, db, 0); const ok = Fg.needs === 'hand' ? G.sel.length === 1 && pa.some(p => p.hand === G.sel[0]) : Fg.needs === 'zone' ? G.attacker != null && pa.some(p => p.zone === G.attacker) : pa.length > 0 && !G.sel.length;
    power = pq(4, yb(176), 88, shortName(Fg.power), `power:${Fg.needs || ''}`, { off: !ok, title: Fg.powerText, cls: ok ? 'on' : '' }); }
  else if (v.forger && v.rs.power) power = lb(8, yb(180), 'POWER USED', 'd');
  // the rival, on the other pillar
  const rf = rv.tier === 'secret' ? 'face-last-one' : 'face-' + String(rv.name || '').toLowerCase().replace(/^the /, '').replace(/[^a-z]+/g, '-').replace(/^-|-$/g, ''); // a named rival's own face, when there is one
  const endOk = myTurn && !G.sel.length && G.attacker == null && G.onto == null;
  if (DUAL) { let pw = null;
    if (myTurn && v.forger && !v.rs.power) { const Fg = FORGERS[v.forger], pa = powerActions(live, db, 0), ok = Fg.needs === 'hand' ? G.sel.length === 1 && pa.some(p => p.hand === G.sel[0]) : Fg.needs === 'zone' ? G.attacker != null && pa.some(p => p.zone === G.attacker) : pa.length > 0 && !G.sel.length;
      pw = { t: shortName(Fg.power), a: `power:${Fg.needs || ''}`, off: !ok, title: Fg.powerText, cls: ok ? 'on' : '' }; }
    G.barText = bar = padWords(bar);
    return duelDual({ live, v, rv, rf, myTurn, pend, cmds, endOk, bar, view, hand, power: pw, chosen }); }
  // The commands stand in the pillar's column of plaques: four over END TURN, five when it is not there. More than that
  // and the last place turns the page (MORE 1/2), so no plaque ever leaves the pillar.
  const room = endOk ? 4 : 5, per = cmds.length > room ? room - 1 : room, pages = Math.max(1, Math.ceil(cmds.length / per)), sig = cmds.map(c => c[1]).join();
  if (!G.cmdPage || G.cmdPage.sig !== sig) G.cmdPage = { sig, n: 0 };
  const pg = G.cmdPage.n % pages, plaques = cmds.slice(pg * per, pg * per + per).map(([t, a, o], i) => pq(4, yb(138 + i * 20), 88, t, a, o || {})).join('') + (pages > 1 ? pq(4, yb(138 + per * 20), 88, `MORE ${pg + 1}/${pages}`, 'cmdpage') : '');
  const L1 = lpNow(v, 1), lifeAt = (id, L) => `<b id="${id}" class="ab lb" style="left:${88 - String(L.n).length * 6}px;top:92px${L.hot == null ? '' : `;color:${L.hot < 0 ? '#f08a72' : '#9fd0c0'}`}">${L.n}</b>`;
  const right = psPort(rf, 14, 6, false, 'face1') + lb(8, 79, fitName(shortName(rv.name), 13), 'g') + lb(8, 92, 'LIFE', 'g') + lifeAt('rivalLp', L1) + gauge(8, 101, 80, L1.g / 8000).replace('<i class="ga', '<i id="rivalGa" class="ga')
    + lb(8, 114, 'HAND', 'g') + `<span class="backs" style="left:40px;top:112px">${'<u></u>'.repeat(Math.min(v.rivalHand, 5))}</span>` + lb(8, 125, 'DECK', 'g') + lbr(88, 125, v.deckCount[1])
    + plaques + (endOk ? pq(4, yb(220), 88, 'END TURN', 'end', { lit: !cmds.some(c => c[2] && c[2].lit) }) : '');
  // the terrain, under your numbers: its name in whole words on up to two lines of the pillar's 80 pixels (every terrain's
  // name sets whole so), clear of the plaque under it, and how long it holds or that it is locked
  G.achTerr = !!v.terrain;
  const ter = v.terrain, terr = ter ? lb(8, 149, 'TERRAIN', 'g') + (ter.lock ? lbr(88, 149, 'LOCKED', 'd') : ter.temp != null ? lbr(88, 149, ter.temp, 'd') : '') + nameLines(card(ter.id).name, 80, 2).map((t, i) => `<b class="ab lb" data-name="${esc(card(ter.id).name)}" style="left:8px;top:${158 + 9 * i}px">${esc(t)}</b>`).join('') : '';
  const left = psYou(G.run, v, terr + power + pq(4, yb(198), 88, 'THIS DUEL', 'tab:duel'), lifeAt);
  const prompt = pend && !G.tab && !G.inspect && !G.overlay ? psTrap(live) : ''; // another window opened over the question takes its place until it is closed
  G.barText = bar;
  return frame({ left, right, view, ledge: `<div class="hand">${hand}</div>`, bar, barMore: bar.replace(/<[^>]+>/g, '').length > 74, extra: prompt });
}
// The attack that waits on an answer, in one sentence.
function trapHead(live) {
  const pv = viewFor(live, db, 0), pX = pv.mon[1][live.pending.from], pT = live.pending.to >= 0 ? pv.mon[0][live.pending.to] : null;
  return `${pX && !pX.veil ? esc(card(pX.id).name) + ' (' + pX.ea + ')' : 'A veiled monster'} attacks ${pT ? esc(card(pT.id).name) + ' (' + (pT.pos === 'd' ? pT.ed + ' DEF' : pT.ea + ' ATK') + ')' : 'you directly'}.`;
}
function psTrap(live) {
  const head = trapHead(live);
  const n = live.pending.options.length, hl = Math.min(3, Math.ceil(head.replace(/&[a-z]+;/g, '&').length / 36)), top = 28 + hl * 16; // the attack in its lines, then the Traps
  const H = Math.min(F.H - 16, top + 32 + n * 66), more = top + 32 + n * 66 > H; // a list that scrolls when the frame cannot hold every Trap, and says so
  // The answers' plaques are all one width, as wide as LET IT THROUGH and the hammer need, and stand in one column, their
  // right edges at 302 in the window (each Trap's row is 296 wide from 8, its plaque under its words at the row's end).
  const pw = Math.max(88, pqW('LET IT THROUGH'), pqW('SPRING IT'));
  const opts = live.pending.options.map((i, k) => { const t = live.traps[0][i]; return `<div class="ab" style="left:8px;top:${k * 66}px;width:296px;height:62px">${psCard(t, 0, 0)}<div class="ab" style="left:50px;top:0;width:250px;height:44px;line-height:16px;overflow:hidden"><b class="lb g" style="display:block;height:10px;line-height:8px">${esc(card(t.id).name)}</b>${esc(shortText(t.id))}</div>${pq(294 - pw, 46, pw, 'SPRING IT', 'respond:' + i, { lit: k === 0 })}</div>`; }).join(''); // the words take two lines across the row, the plaque sits under them
  return win(96, 8 - cy0(), 320, H, `<h2>Spring a Trap?</h2><p style="height:${hl * 16}px">${head}</p><div class="ab sc" style="left:0;top:${top}px;width:320px;height:${H - top - 30}px">${opts}</div>${more ? lb(8, H - 20, 'MORE BELOW, SCROLL', 'g') : ''}${pq(302 - pw, H - 26, pw, 'LET IT THROUGH', 'respond:-1')}`);
}

// ---- offerings: a card, a Gift, a charm, a Guardian Reward, a treasure, the Sanctum, a starter kit
// The choices stand on plinths in the view. A cursor rests on one; the ledge names it, the text bar reads it out, and a
// second tap on it (or TAKE) takes it. Each choice: { pic, name, facts, text, a, off, card }.
// A word set in the label face is as wide as its letters' advances (labelW, ps.mjs); the last letter's spacing column is
// blank, so a word may reach one pixel past its room.
const fits = (s, px) => labelW(s) <= px + 1;
// A name in the label face set on lines px wide, never cut inside a word: whole words go on each line as long as they fit,
// a word wider than the line stands whole on its own (the layout gives the widest word room). When the name needs more
// than max lines, the last line ends after its whole words with two dots, and the ledge or the bar gives it whole.
function nameLines(name, px, max = 9) {
  const w = String(name).toUpperCase().split(/\s+/).filter(Boolean), out = [];
  for (const x of w) { const l = out.length ? out[out.length - 1] + ' ' + x : null; if (l && fits(l, px)) out[out.length - 1] = l; else out.push(x); }
  if (out.length <= max) return out;
  const keep = out.slice(0, max), last = keep[max - 1].split(' ');
  while (last.length > 1 && !fits(last.join(' ') + '..', px)) last.pop();
  keep[max - 1] = last.join(' ') + (fits(last.join(' ') + '..', px) ? '..' : ''); return keep;
}
// A name on one line of n characters' room (6 pixels each, measured with the face's own advances), never cut inside a
// word: whole if it fits; else without a note in brackets; else its first word as an initial, the rest whole (STONE
// SENTINEL, S. SENTINEL); else its first whole words and two dots, the ledge or the bar giving it whole. A single word
// too wide for the room stands whole: the layout must give it room (nameLines sets a name on more lines).
function fitName(name, n) {
  const px = n * 6, s = String(name).toUpperCase().replace(/\s+/g, ' ').trim(); if (fits(s, px)) return s;
  const head = s.replace(/\s*\(.*$/, '') || s; if (fits(head, px)) return head;
  const w = head.split(' ');
  if (w.length > 1 && /^[A-Z]+$/.test(w[0])) { const t = [w[0][0] + '.', ...w.slice(1)].join(' '); if (fits(t, px)) return t; }
  return nameLines(head, px, 1)[0];
}
// What the plinths leave clear in a room, in the 440 x 248 picture: the Omen's circle of light, where its bowl stands, the
// vault's chest when the room is a treasure, and the Sanctum's lit niche with the shrine under it (from x to x, and the
// offer it is kept clear for). The plinths stand beside it, or on both sides of it when it is in the middle.
const CLEAR = { 'room-omen': [172, 268], 'room-vault': [70, 124, 'treasure'], 'room-sanctum': [192, 248] };
function psOffer({ title, items, bar0 = '', right = '', room = 'doors', key, sel = null, selA = null, left = null, pillar = null, kind = null }) {
  if (!items.length) items = [{ name: 'NOTHING HERE', a: 'skip', take: 'GO ON', pic: () => '', facts: [], text: 'Nothing is offered here.' }]; // never a blank screen
  const r = G.run, n = items.length, vs = viewSize(), lw = ledgeW();
  if (sel == null) { if (!G.offSel || G.offSel.at !== key || !items[G.offSel.i]) G.offSel = { at: key, i: Math.max(0, items.findIndex(x => !x.off)) }; sel = G.offSel.i; }
  const it = items[sel], fl = r ? r.floor + 1 : 1;
  if (room.startsWith('room-') && !CART.has(room)) room = { 'room-guardian': 'duel', 'room-vault': 'duel' }[room] || 'doors'; // its painting is not there: a hall stands in
  const hall = room.startsWith('room-') ? room : room === 'duel' ? (CART.has('hall-duel-' + fl) ? 'hall-duel-' + fl : 'hall-duel') : (CART.has('hall-doors-' + fl) ? 'hall-doors-' + fl : 'hall-doors');
  const rp = roomPic(hall, room === 'duel' ? 70 : NICHE_Y + 34, room !== 'duel');
  // The plinths stand below the carved title, with room between for the cursor over them; they leave clear the spot of a
  // model that is what the room is about (the Omen's bowl in its circle of light) when the view has room beside it, the
  // plinths a little narrower for it if need be, never narrower than what they hold needs.
  const tc = carve(title, 12, render), tb = 3 + (tc ? tc.h : 10), ph = Math.min(124, Math.max(vs.h - tb - 14, 106)); // 106: a card and its name
  const clear = CLEAR[rp.name] && (!CLEAR[rp.name][2] || CLEAR[rp.name][2] === kind) ? CLEAR[rp.name] : null, cl = clear && [rp.ox + Math.round(clear[0] * rp.k), rp.ox + Math.round(clear[1] * rp.k)];
  // Each plinth has a share sw wide and stands 2 pixels inside it; at(i) is where share i begins, for m plinths in a row
  // that each need that much.
  const y0 = Math.min(vs.h - 2 - ph, Math.max(tb + 10, ((vs.h - ph) >> 1) + 4));
  const lay = (m, need) => {
    const sw0 = Math.min(104, Math.floor((vs.w - 8) / m)), nl = m >> 1;
    const split = cl && nl ? Math.min(sw0, Math.floor((cl[0] - 1) / nl), Math.floor((vs.w - 1 - cl[1]) / (m - nl))) : 0; // half the choices each side
    const side = cl ? Math.min(sw0, Math.max(Math.floor((vs.w - 1 - cl[1]) / m), Math.floor((cl[0] - 1) / m))) : 0; // all on one side
    const sw = split >= need ? split : side >= need ? side : sw0, wide = sw * m;
    return { sw, at: split >= need ? i => i < nl ? cl[0] - 2 - (nl - i) * sw : cl[1] + 2 + (i - nl) * sw
      : side >= need ? i => (cl[1] + 2 + wide <= vs.w + 1 ? cl[1] + 2 : cl[0] - 2 - wide) + i * sw : i => ((vs.w - wide) >> 1) + i * sw };
  };
  // What stands on a plinth keeps the plinth's ring whole on all four sides: inside the plinth's 1-pixel border lie the
  // ring (gold on the chosen one) and a pixel of plinth, and only then what stands there, its own 1-pixel outline
  // included (RIM); the name plate stands as far inside, at the foot. So a plinth's share must be what stands on it
  // (wide, its outline included), twice RIM, its border and the 2 pixels each side of it wider; and the widest word of
  // each name must stand whole on the plate (the share less 10). Of the rows of plates the pictures leave room for (a
  // card may stand with its foot behind its plate, down to its numbers: foot), every name must take no more, so no name
  // loses a word. The plinths take the pictures each choice shows at its own size when they can; when the view is too
  // low for that, a choice that has a smaller picture (a card at its table size) shows that one, so every name stands
  // whole. A plan: the pictures, how many plinths the view shows (k), their share and the rows their plates may take.
  const words = x => String(x.name).toUpperCase().split(/\s+/).filter(Boolean);
  const plan = small => {
    const its = items.map(x => small && x.small ? { ...x, ...x.small } : x);
    const need = Math.max(...its.map(x => Math.max((x.wide || 0) + 2 * RIM + 6, ...words(x).map(w => labelW(w) + 2 * RIM + 5))));
    let k = n; while (k > 1 && lay(k, need).sw < need) k--;
    const sw = lay(k, need).sw, deep = Math.max(...its.map(x => (x.tall || 0) - (x.foot || 0)));
    const most = Math.max(1, Math.min(3, Math.floor((ph - 2 - 2 * RIM - 2 - deep) / 9)));
    return { its, need, k, sw, most, whole: its.every(x => !nameLines(x.name, sw - 6 - 2 * RIM, most).some(l => l.endsWith('..'))) };
  };
  const big = plan(false), pl = big.whole || !items.some(x => x.small) ? big : plan(true), shown = pl.its;
  // More choices than the view holds at that width stand in a row that turns with the cursor, as a console's row of
  // choices did: k of them show, and a marker at the row's end points to those beyond.
  const { k, sw, most } = pl, { at } = lay(k, pl.need), w0 = G.offWin && G.offWin.at === key ? G.offWin.first : 0, first = Math.max(0, Math.min(n - k, sel < w0 ? sel : sel >= w0 + k ? sel - k + 1 : w0));
  G.offWin = { at: key, first };
  // A name keeps 2 pixels clear at each end of its plate when that costs it no line it has; a name that needs the plate's
  // whole width to show its words on the lines there are is set across all of it. The plates take as many lines as the
  // longest name shown needs, up to the rows the pictures leave room for.
  const plate = sw - 6 - 2 * RIM, rows = Math.min(most, Math.max(...shown.slice(first, first + k).map(x => nameLines(x.name, plate - 4).length)));
  const plateLines = name => { const loose = nameLines(name, plate - 4); return loose.length <= rows ? loose : nameLines(name, plate, rows); };
  // Each plinth's dots lie on the frame's grid in step with the dimming's, so the room shows through every plinth alike
  // (the dots start inside its 1-pixel border); the shadow on a plinth not chosen lies on the pixels between. What stands
  // on a plinth is centred inside its border, where the plinth lays it out: pic is given that middle, the height over the
  // name plate less a 2-pixel gap and RIM at the top, and the row that height starts on. Each line of a plate is a box
  // of its own, so each is centred on whole pixels (gridLines).
  const plinths = shown.slice(first, first + k).map((x, j) => { const i = first + j, L = at(j) + 2, lines = plateLines(x.name), pt = ph - 2 - RIM - 9 * rows;
    return `<button class="pln${i === sel ? ' on' : ''}${x.off ? ' off' : ''}" style="left:${L}px;top:${y0}px;width:${sw - 4}px;height:${ph}px;--mesh:${(L + 1) & 1}px ${(y0 + 1) & 1}px;--mesh2:${L & 1}px ${(y0 + 1) & 1}px" ${i === sel ? (x.off ? `aria-disabled="true"${DUAL ? ' data-a="nop"' : ''}` : `data-a="${x.a}"`) : `data-a="${selA ? selA(i) : 'osel:' + i}"`}${DUAL ? ` data-k="p${i}" data-f${i === sel ? ' data-n0' : ''}` : ''} aria-label="${esc(x.name)}">${x.pic((sw - 6) >> 1, pt - 2 - RIM, RIM)}<b class="pnm" data-name="${esc(x.name)}" style="top:${pt}px;height:${9 * rows}px;padding-top:${(rows - lines.length) * 9 >> 1}px">${lines.map(l => `<span>${esc(l)}</span>`).join('')}</b></button>`; }).join('')
    + (first > 0 ? `<i class="mrl" style="left:${Math.max(1, at(0) - 3)}px;top:${y0 + (ph >> 1) - 4}px"></i>` : '') + (first + k < n ? `<i class="mrr" style="left:${Math.min(vs.w - 5, at(k - 1) + sw - 1)}px;top:${y0 + (ph >> 1) - 4}px"></i>` : '');
  const head = tc ? `<img class="ab" src="${tc.url}" width="${tc.w}" height="${tc.h}" style="left:${(vs.w - tc.w) >> 1}px;top:3px" alt="${esc(title)}">` : `<b class="ab lb g" style="left:${(vs.w - title.length * 6) >> 1}px;top:5px">${esc(title)}</b>`;
  // The room's models stand under its dimming, dimmed with it; the one the room is about (kept clear of the plinths)
  // stands out of the dim, so what the room is about reads at a glance.
  const props = propSpot(rp, kind);
  const view = `${roomImg(rp)}${rp.edge}${clear ? '' : props}<i class="dim0"></i>${clear ? props : ''}${head}${plinths}${y0 - 8 >= tb ? `<i class="cur" style="left:${at(sel - first) + (sw >> 1) - 4}px;top:${y0 - 8}px"></i>` : ''}`; // a view too short for the cursor between the title and the plinths marks the choice by its plinth alone
  // The ledge's plaques stand in a column at its right, as wide as the widest of them needs for its words with the hammer
  // beside them (64 at the least, and even, so the two arrows split it), the reading taking the rest. The column is laid
  // out for every choice in the row, so it stays put as the cursor moves along it.
  const cw = Math.max(64, ...items.map(x => Math.max(x.card ? pqW('CARD PAGE') : 0, pqW(x.take || 'TAKE')))) + 1 & ~1, colX = lw - 8 - cw, aw = (cw - 4) >> 1;
  const ledge = `<div class="dt" style="width:${colX - 10}px"><b data-name="${esc(it.name)}">${nameLines(it.name, colX - 20, 2).map(esc).join('<br>')}</b>${(it.facts || []).map(f => `<p>${f}</p>`).join('')}</div>`
    + (n > 1 ? pq(colX, 4, aw, '<', selA ? selA((sel + n - 1) % n) : `osel:${(sel + n - 1) % n}`, { title: 'Choice to the left' }) + pq(colX + aw + 4, 4, aw, '>', selA ? selA((sel + 1) % n) : `osel:${(sel + 1) % n}`, { title: 'Choice to the right' }) : '')
    + (it.card ? pq(colX, 22, cw, 'CARD PAGE', `inspect:${it.card}`) : '') + pq(colX, 40, cw, it.take || 'TAKE', it.a, { lit: !it.off, off: it.off });
  const bar = [it.text, bar0].map(t => String(t || '').trim()).filter(Boolean).map(t => /[.!?:)]$/.test(t) ? t : t + '.').join(' '); // each part a whole sentence
  G.barText = bar;
  if (DUAL) return offerDual({ r, items, it, sel, n, selA, view, left, right, pillar, bar0, kind, key });
  return frame({ left: left ?? psYou(r), right: pillar ?? psRight(r, right), view, ledge, bar });
}
// The right pillar off the duel: floor, relics, and the plaques a screen adds above DECK and RELICS.
// o (two frames): note, what the pillar says under the belt; bare, the pillar without the belt (the bottom frame names
// every relic then).
function psRight(r, extra = '', o = {}) {
  const fl = r.floor + 1, rel = relicList(r);
  const pips = Array.from({ length: 6 }, (_, i) => `<i class="pip${i < r.chamber ? ' on' : i === r.chamber ? ' at' : ''}" style="left:${8 + i * 11}px;top:20px"></i>`).join('') + `<i class="seal${r.seals >= 2 ? ' on' : ''}" style="left:76px;top:19px"></i>`;
  const belt = Array.from({ length: 9 }, (_, i) => { const id = rel[i]; return `<button class="sl" style="left:${8 + (i % 3) * 28}px;top:${54 + Math.floor(i / 3) * 28}px" data-a="tab:relics" aria-label="${id ? esc(RELICS[id].name) : 'Empty relic slot'}">${id ? medal(id, 24) : ''}</button>`; }).join('');
  if (DUAL) return lb(8, 8, `FLOOR ${fl}`, 'g') + pips + (o.bare ? '' : lb(8, 40, 'RELICS', 'g') + (rel.length > 9 ? lbr(88, 40, '+' + (rel.length - 9)) : '') + belt.replace(/data-a="tab:relics" aria-label="Empty/g, 'data-a="tab:relics" data-nonav aria-label="Empty') + lb(8, 142, `CHARMS ${r.charms.length}/${db.config.charmSlots}`, 'g')) + (o.note || '');
  return lb(8, 8, `FLOOR ${fl}`, 'g') + pips + lb(8, 40, 'RELICS', 'g') + (rel.length > 9 ? lbr(88, 40, '+' + (rel.length - 9)) : '') + belt
    + lb(8, 142, `CHARMS ${r.charms.length}/${db.config.charmSlots}`, 'g') + extra + pq(4, yb(200), 88, 'DECK', 'tab:deck') + pq(4, yb(220), 88, 'RELICS', 'tab:relics');
}
const kindWord = id => ({ C: 'CHARM', G: 'GIFT', M: 'MASTERWORK' })[RELICS[id].kind];
const plain = h => String(h).replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
// What stands on a plinth: pic(cx, h, y) draws it centred on cx, in the room h rows high from row y; wide and tall are its
// size with its outline, foot the rows of it that may stand behind the plate. A card shows at its table size (small) on a
// plinth too low for it.
const cardItem = (e, a, extra = {}) => { const c = card(e.id), mon = db.isMonster(e.id); convertSheets(64);
  return { pic: (cx, h, y) => psCardL(e, cx - 34, y + 1 + Math.max(0, (h - 94) >> 1)), wide: 70, tall: 94, foot: CARD_FOOT + 1, name: c.name, card: e.id, a, text: plain(pickNote(e.id, G.run).replace(/^<b>[^<]*<\/b>(<br>)?/, '')),
    small: { pic: (cx, h, y) => psCardL(e, cx - 22, y + 1 + Math.max(0, (h - 62) >> 1), { small: 1 }), wide: 46, tall: 62, foot: 0 },
    facts: [mon ? esc(`${c.attr} · LEVEL ${c.level} · ${c.type}`.toUpperCase()) : esc(roleOf(db, e.id).toUpperCase()), `WEIGHT ${weightOf(db, e.id)}`], ...extra }; };
const relicItem = (id, a, extra = {}) => ({ pic: (cx, h, y) => `<i class="ab" style="left:${cx - 32}px;top:${y + Math.max(0, (h - 64) >> 1)}px">${medal(id, 64)}</i>`, wide: 64, tall: 64, name: RELICS[id].name, relic: id, a, text: RELICS[id].text, facts: [kindWord(id)], ...extra });
// A card face down (sealed, or not yet seen), at its table size.
const backItem = { pic: (cx, h, y) => `<i class="cd back" style="left:${cx - 22}px;top:${y + 1 + Math.max(0, (h - 62) >> 1)}px"><i class="art"></i></i>`, wide: 46, tall: 62 };
// A few medals offered as one, at 32 in a row 2 pixels apart, centred inside the plinth's ring; when the row is wider
// than the room there, a pile: two over one, each row centred.
const pileRow = (ids, room) => ids.length * 34 - 2 <= room ? ids.length : Math.ceil(ids.length / 2);
const medalPile = ids => ({ wide: Math.min(ids.length, 2) * 34 - 2, tall: Math.ceil(ids.length / 2) * 34 - 2, pic: (cx, h, y) => { const per = pileRow(ids, 2 * (cx - RIM)), w = per * 34 - 2, hh = Math.ceil(ids.length / per) * 34 - 2;
  return `<i class="ab" style="left:${cx - (w >> 1)}px;top:${y + Math.max(0, (h - hh) >> 1)}px;width:${w}px;display:flex;flex-wrap:wrap;justify-content:center;gap:2px">${ids.map(id => medal(id, 32)).join('')}</i>`; } });
function psReward() {
  const r = G.run, o = r.offer, key = `${r.floor}.${r.chamber}.${o.kind}.${JSON.stringify(o.options || o.kind)}`;
  const skip = pq(4, yb(180), 88, 'TAKE NOTHING', 'skip');
  if (o.kind === 'card') return psOffer({ title: 'PICK A CARD', key, room: 'room-vault', items: o.options.map((e, i) => cardItem(e, `pick:${i}`)), bar0: 'It goes to your trunk.', right: skip });
  if (o.kind === 'gift') {
    const held = new Set(relicList(r).map(id => RELICS[id].family).filter(f => BUILD_FAMILIES.includes(f)));
    const facts = id => [kindWord(id) + (o.fresh === id ? ' · NEW' : ''), RELICS[id].link && (held.has(RELICS[id].family) || held.has(RELICS[id].link)) ? esc(`LINKS ${FAMILY_NAME[RELICS[id].family]} TO ${FAMILY_NAME[RELICS[id].link]}`.toUpperCase()) : held.has(RELICS[id].family) ? esc(`FITS YOUR ${FAMILY_NAME[RELICS[id].family]} PIECES`.toUpperCase()) : ''].filter(Boolean);
    return psOffer({ title: 'FORGE LEVEL UP', key, room: 'room-vault', items: o.options.map((id, i) => relicItem(id, `pick:${i}`, { facts: facts(id), text: RELICS[id].text + plain(linkLine(id, r)).replace(/^Set/, ' Set') + (o.fresh === id ? ` You unlocked this with ${(featList(true).find(f => f.gift === id) || {}).name || 'a feat'}.` : '') })),
      bar0: 'A Gift lasts the whole run.', right: r.rerolls ? pq(4, yb(180), 88, `DEAL AGAIN ${r.rerolls}`, 'reroll') : '' });
  }
  if (o.kind === 'charm') return psOffer({ title: 'PICK A CHARM', key, room: 'room-vault', items: o.options.map((id, i) => relicItem(id, `pick:${i}`)), bar0: `Charm slots ${r.charms.length}/${db.config.charmSlots}.`, right: skip });
  // The engine's charm pick: taking it opens PICK A CHARM with these charms, as many as the engine found (three, or fewer
  // when the run already holds the rest), so the plinth and the bar count them as they are.
  const charms = ids => ids.length === 1 ? ['ONE CHARM', 'a charm'] : [`ONE OF ${ids.length} CHARMS`, `one of ${['', '', 'two', 'three'][ids.length] || ids.length} charms`];
  if (o.kind === 'guardian') return psOffer({ title: 'GUARDIAN REWARD', key, room: 'room-guardian', bar0: 'The weight cap rises by 20.', items: o.options.map((g, i) => g.kind === 'card' ? cardItem(g.entry, `pick:${i}`, { text: g.text }) : g.kind === 'masterwork' ? relicItem(g.id, `pick:${i}`, { text: `${g.text}: ${RELICS[g.id].text}` }) : { name: charms(g.ids)[0], a: `pick:${i}`, text: `Pyramid relic: ${charms(g.ids)[1]}, picked on the next screen. ` + g.ids.map(id => RELICS[id].name + ': ' + RELICS[id].text).join(' '), facts: g.ids.map(id => esc(RELICS[id].name.toUpperCase())), ...medalPile(g.ids) }) });
  if (o.kind === 'treasure') return psOffer({ title: 'TREASURE', key, room: 'room-vault', kind: 'treasure', bar0: 'Take one. The rest stay in the vault.', items: o.options.map((g, i) => g.kind === 'card' ? cardItem(g.entry, `pick:${i}`) : relicItem(g.id, `pick:${i}`)) });
  if (o.kind === 'sanctum') { const full = r.sparks >= db.config.sparks, cap = weightCap(db, r), add = db.config.prices.sanctumCap;
    // a big number over a line of words, 34 rows from the number's top to the words' foot, inside the ring
    const big = (t, sub) => ({ tall: 34, pic: (cx, h, y) => { const at = y + Math.max(0, (h - 34) >> 1), w = 2 * (cx - RIM);
      return `<b class="ab big2" style="left:${RIM}px;width:${w}px;top:${at}px">${t}</b><b class="ab lb d" style="left:${RIM}px;width:${w}px;text-align:center;top:${at + 26}px">${sub}</b>`; } });
    return psOffer({ title: 'SANCTUM', key, room: 'room-sanctum', bar0: 'A quiet room and one candle. Take one blessing, then go on.', items: [
      { name: 'A SPARK BACK', a: 'pick:0', off: full, ...big(full ? 'FULL' : String(r.sparks + 1), full ? 'SPARKS' : `SPARKS, NOW ${r.sparks}`), facts: [full ? 'YOUR SPARKS ARE FULL' : `SPARKS ${r.sparks} TO ${r.sparks + 1}`], text: full ? 'Your Sparks are full.' : `One Spark comes back to you: ${r.sparks} becomes ${r.sparks + 1}.` },
      { name: `CAP UP ${add}`, a: 'pick:1', ...big(String(cap + add), `CAP, NOW ${cap}`), facts: [`CAP ${cap} TO ${cap + add}`, `YOUR DECK WEIGHS ${deckWeight(db, r.deck)}`], text: `Your weight cap rises from ${cap} to ${cap + add}. Your deck weighs ${deckWeight(db, r.deck)}.` }] }); }
  return null;
}
// ---- rooms with work in them: the Anvil, the Bazaar, the Omen
// The deck lies in the view as a grid (it scrolls when it is longer than the view); the workings are plaques on the ledge.
// Its rows stand in the middle at a whole pixel: as many 44-pixel cards with 4 between as the view takes.
const deckGrid = (list, verb, picked, picked2 = null, weakFirst = false) => { const vs = viewSize(), cols = Math.max(1, Math.floor((vs.w - 4) / 48)), pad = (vs.w - cols * 48 + 4) >> 1; return `<div class="ab sc dgrid" style="left:0;top:0;width:${vs.w}px;height:${vs.h}px;padding:4px ${pad}px"><div class="row2">${list.map((e, i) => [e, i]).sort((a, b) => (weakFirst ? -1 : 1) * (cardValue(db, b[0]) - cardValue(db, a[0]))).map(([e, i]) => psCard(e, null, null, { cls: picked === i ? 'sel' : picked2 === i ? 'sel2' : '', attrs: `data-a="${verb}:${i}"` })).join('')}</div></div>`; };
// A room with work in it shows its painting behind the deck, half hidden by the mesh so the cards read over it.
const roomBack = name => { if (!CART.has(name)) return ''; const rp = roomPic(name, NICHE_Y + 34, true); return `${roomImg(rp)}${rp.edge}<i class="dim0"></i>`; };
const roomRight = (r, extra = '') => psRight(r, extra + pq(4, yb(180), 88, 'LEAVE', 'leave'));
function psAnvil() {
  const r = G.run, o = r.offer, Pr = db.config.prices, e = G.pickDeck != null ? r.deck[G.pickDeck] : null, e2 = G.pickTrunk != null ? r.deck[G.pickTrunk] : null, lw = ledgeW(), cw = (lw - 16) / 3 | 0;
  const works = o.masterworks.map(id => [`FORGE ${shortName(RELICS[id].name)} ${Pr.masterwork}`.toUpperCase(), `mw:${id}`, r.embers < Pr.masterwork, `${RELICS[id].name}: ${RELICS[id].text}`])
    .concat([[`TEMPER ${Pr.temper}`, 'temper', !e || !db.isMonster(e.id) || e.t || r.embers < Pr.temper, 'Temper: the chosen monster gains 300 ATK and DEF for the rest of the run.']])
    .concat(o.enchants.map(x => [`${x} ${Pr.enchant}`.toUpperCase(), `enchant:${x}`, !e || !db.isMonster(e.id) || e.e || r.embers < Pr.enchant, `${cap(x)}: ${ENCHANT_TEXT[x]}`]))
    .concat([[`BIND ${Pr.bind}`, 'bind', !e || !e2 || r.embers < Pr.bind, 'Bind: the two chosen cards become one meld card in your deck.']]);
  // Every working the engine offers stands on the ledge, in three rows. Three columns of plaques, as long as the nine places
  // hold them: a working whose words and the hammer need more than a column takes two, and each plaque goes in the first
  // place on the rows that holds it, so a short one fills the gap a long one left. When they need more than nine places
  // (three Masterworks on a narrow frame), the rows are laid by the plaques' own widths instead: the workings, in their
  // order, split into three rows, each no wider than the columns, the split whose widest row is narrowest (then whose
  // next widest is, so the rows come out even), and each row's plaques widened to fill it: all alike when the widest
  // leaves room for that, or else the long ones as wide as their words and the hammer need and the others alike in what
  // they leave.
  const lit = i => !works[i][2] && i === works.findIndex(w => !w[2]), gw = 3 * cw + 8, need = works.map(w => pqW(w[0]));
  const used = [[], [], []], at = span => { for (let y = 0; y < 3; y++) for (let x = 0; x + span <= 3; x++) if (!used[y].slice(x, x + span).some(Boolean)) { for (let j = x; j < x + span; j++) used[y][j] = 1; return [x, y]; } return null; };
  const cells = works.map((w, i) => { const span = need[i] <= cw ? 1 : need[i] <= 2 * cw + 4 ? 2 : 4, p = span < 4 && at(span); return p && [p[0], p[1], span]; });
  let ledge;
  if (cells.every(Boolean)) ledge = works.map(([t, a, off], i) => { const [x, y, span] = cells[i]; return pq(4 + x * (cw + 4), 4 + y * 19, span * cw + (span - 1) * 4, t, a, { off, lit: lit(i) }); }).join('');
  else {
    const n = works.length, rowW = (i, j) => need.slice(i, j).reduce((s, v) => s + v, 0) + 4 * (j - i - 1);
    const narrower = (p, q) => { for (let y = 0; y < 3; y++) if (p[y] !== q[y]) return p[y] < q[y]; return false; };
    let best = null;
    for (let a = 1; a <= n; a++) for (let b = a; b <= n; b++) {
      const cut = [0, a, b, n], wide = [0, 1, 2].map(y => cut[y + 1] > cut[y] ? rowW(cut[y], cut[y + 1]) : 0).sort((p, q) => q - p);
      if (!best || narrower(wide, best[0])) best = [wide, cut];
    }
    const fill = (ns, room) => { let left = room, pool = ns.map((v, i) => i);
      for (;;) { const big = pool.filter(i => ns[i] * pool.length > left); if (!big.length) break; for (const i of big) left -= ns[i]; pool = pool.filter(i => !big.includes(i)); if (!pool.length) break; }
      const ws = ns.slice(); pool.forEach((i, m) => { ws[i] = (left / pool.length | 0) + (m < left % pool.length ? 1 : 0); }); return ws; };
    ledge = [0, 1, 2].map(y => { const [i, j] = [best[1][y], best[1][y + 1]]; if (j === i) return '';
      const ws = fill(need.slice(i, j), gw - 4 * (j - i - 1)); let x = 4;
      return works.slice(i, j).map(([t, a, off], m) => { const h = pq(x, 4 + y * 19, ws[m], t, a, { off, lit: lit(i + m) }); x += ws[m] + 4; return h; }).join(''); }).join('');
  }
  const bar = e ? `${card(e.id).name}${e.t ? ', tempered' : ''}${e.e ? ', enchanted' : ''}${e2 ? ' and ' + card(e2.id).name : ''}. ${works.filter(w => !w[2]).map(w => w[3]).join(' ') || 'Nothing here can be done to it with your Embers.'}` : `One working, then you move on. Tap a deck card (a second one for a Bind). ${works.map(w => w[3]).join(' ')}`;
  G.barText = bar;
  if (DUAL) { // The window reads one working whole: the one under the hammer, else the lit one, with what it would make of
    // the chosen card and of your Embers; before a card is chosen, how the Anvil works. No working gives its place away:
    // the window's last line says what A does on a card.
    const cur = /^w:/.test(G.look || '') ? works.find(w => w[1] === G.look.slice(2) && !w[2]) : null, w = cur || (e ? works.find(x => !x[2]) : null), c = e ? card(e.id) : null, up = e && e.t ? 300 : 0;
    const [verbW, x] = w ? w[1].split(':') : [], price = w ? +w[0].split(' ').pop() : 0, keep = `You hold ${r.embers} Embers and keep ${r.embers - price}.`;
    const what = !w ? '' : verbW === 'mw' ? `${RELICS[x].text}` : verbW === 'temper' ? `The chosen monster gains 300 ATK and DEF for the rest of the run. ${c.atk + up} / ${c.def + up} becomes ${c.atk + up + 300} / ${c.def + up + 300}.`
      : verbW === 'enchant' ? `${ENCHANT_TEXT[x]} ${c.name} carries no Enchant now.` : `${c.name} and ${card(e2.id).name} become one meld card. Your deck of ${r.deck.length} becomes ${r.deck.length - 1}.`;
    const head = w ? (verbW === 'mw' ? 'FORGE ' + RELICS[x].name : verbW === 'enchant' ? cap(x) : cap(verbW)) : e ? card(e.id).name : 'THE ANVIL';
    const sub = w ? `${price} EMBERS` + (verbW !== 'mw' && e ? ' · ' + esc(card(e.id).name.toUpperCase()) + (e2 ? ' + ' + esc(card(e2.id).name.toUpperCase()) : '') : '') : e ? 'NO WORKING' : `${r.embers} EMBERS`;
    const text = w ? `${what} ${keep}` : e ? 'Nothing here can be done to it with your Embers.' : `Choose a deck card: a monster to Temper or Enchant, and a second card to Bind the two.${o.masterworks.length ? ' Or forge a Masterwork below.' : ''}`;
    const more = e ? `A does it. A on another card ${e2 ? 'changes the second' : 'adds it for a Bind'}.` : 'A chooses a card. One working, then you move on.';
    return workDual({ r, room: 'room-forge', head, sub, text: esc(text), more, said: i => i === G.pickDeck || i === G.pickTrunk ? '' : e ? 'A on another card' : 'A chooses a card', picked: [e, e2], verb: i => `anvilpick:${i}`,
      cells: works.map(([t, a, off, title], i) => ({ t, a, off, lit: lit(i), title, look: 'w:' + a })), gridHead: 'YOUR DECK, STRONGEST FIRST', gridR: `${r.deck.length} CARDS`, cols: 4 }); }
  return frame({ left: psYou(r), right: roomRight(r), view: roomBack('room-forge') + deckGrid(r.deck, 'anvilpick', G.pickDeck, G.pickTrunk), ledge, bar });
}
// ---- the forge beat: after a working the card lies on the anvil and the hammer falls on it, in time with the working's
// sound (its blows land at 0 and 320 ms for a temper, 0 for an enchant, 0 for a bind with the chains locking at 550,
// and 0, 380 and 760 for a Masterwork; the sound starts 60 ms after the tap). Drawn at 30 frames a second, as the
// console drew such a moment. A tap ends it early. The run has already moved on underneath; this only shows it.
const FORGE_BEAT = { temper: { hits: [60, 380], ms: 1500 }, enchant: { hits: [60], ms: 1900 }, bind: { hits: [60], lock: 610, ms: 2000 }, masterwork: { hits: [60, 440, 820], roar: 1160, ms: 2600 } };
function forgeWork(kind, idx, a, extra = {}) { // carry out the working; if the engine took it, show the beat
  const r = G.run, ids = idx.map(i => r && r.deck[i] ? r.deck[i].id : null), inst = r && idx.length ? r.deck[idx[0]] : null; // the entry itself: a temper or an enchant changes it in place
  act(a);
  if (!r || G.run !== r || r.phase === 'anvil' || look === 'old' || !pmodel('anvil') || !pmodel('hammer')) return; // refused, or nothing to show it with
  const made = kind === 'bind' && r.deck.length ? r.deck[r.deck.length - 1].id : null;
  const nm = id => id != null ? card(id).name : 'the card';
  const text = kind === 'temper' ? `${nm(ids[0])} is tempered: 300 more ATK and DEF for the rest of the run.`
    : kind === 'enchant' ? `${nm(ids[0])} takes the ${cap(extra.enchant)} Enchant. ${ENCHANT_TEXT[extra.enchant] || ''}`
    : kind === 'bind' ? `${nm(ids[0])} and ${nm(ids[1])} are bound into ${nm(made)}.`
    : `${RELICS[extra.mw].name} is forged. ${RELICS[extra.mw].text}`;
  G.forge = { kind, ids, made, inst: kind === 'bind' ? r.deck[r.deck.length - 1] : inst, mw: extra.mw || null, t0: performance.now(), text, word: { temper: 'TEMPERED', enchant: 'ENCHANTED: ' + String(extra.enchant || '').toUpperCase(), bind: 'BOUND', masterwork: 'FORGED' }[kind], cam: null };
  render();
}
// The anvil stands on its spot of the forge's painted floor (index.json 'spots'), in the picture's own pixels: one canvas
// the size of the picture laid on it, so the anvil keeps its place and size in the forge on every screen and the view
// crops the beat with the painting. Without the forge's painting the anvil stands in the middle of an empty view.
const forgeSpot = rp => { const s = spotsOf('room-forge').find(x => x[0] === 'anvil') || ['anvil', 220, 204, 128, 0, null]; return spotAt(rp, s); };
function psForge() {
  const fb = G.forge, vs = viewSize(), r = G.run;
  const rp = CART.has('room-forge') ? roomPic('room-forge', NICHE_Y + 34, true) : { name: '', ox: 0, oy: 0, pw: vs.w, ph: vs.h, s: 1, k: Math.min(vs.w / 440, vs.h / 248), edge: '' }; // the forge undimmed: the fire is lit for the working
  const view = (rp.src ? roomImg(rp) + rp.edge : '') + (rp.src ? modelCanvas(rp, [forgeSpot(rp)], false, 'forge', false) :`<canvas id="forge" class="ab" style="left:0;top:0;pointer-events:none" width="${vs.w}" height="${vs.h}" data-items='${JSON.stringify([forgeSpot(rp)])}'></canvas>`) + `<button class="ab" style="left:0;top:0;width:${vs.w}px;height:${vs.h}px;background:none;border:0" data-a="forgeskip" aria-label="Continue"></button>`;
  // The card's name on the ledge beside it in whole words, on a second line when it is long, the working's word under it.
  const nl = fb.kind !== 'masterwork' && fb.inst ? nameLines(card(fb.inst.id).name, ledgeW() - 68, 2) : [];
  const what = fb.kind === 'masterwork' ? `<i class="ab" style="left:8px;top:16px">${medal(fb.mw, 32)}</i>` + lb(48, 20, shortName(RELICS[fb.mw].name).toUpperCase(), 'g') : fb.inst ? psCard(fb.inst, 8, 2) + nl.map((t, i) => `<b class="ab lb g" data-name="${esc(card(fb.inst.id).name)}" style="left:60px;top:${8 + 9 * i}px">${esc(t)}</b>`).join('') : '';
  if (DUAL) return forgeDual(fb, view, r);
  return frame({ left: psYou(r), right: pq(4, yb(220), 88, 'CONTINUE', 'forgeskip', { lit: true }), view, ledge: what + lb(fb.kind === 'masterwork' ? 48 : 60, fb.kind === 'masterwork' ? 32 : 13 + 9 * Math.max(1, nl.length), fb.word, 'd'), bar: esc(fb.text) });
}
let forgeRaf = 0;
function forgePaint() {
  cancelAnimationFrame(forgeRaf);
  const fb = G.forge, cv = document.getElementById('forge'); if (!fb || !cv) return;
  if (!skinsIn('anvil', 'hammer')) { fb.t0 = performance.now(); propTextures(); forgeRaf = requestAnimationFrame(forgePaint); return; } // the beat waits for its skins: no blow falls on a bare card
  const B = FORGE_BEAT[fb.kind], t = performance.now() - fb.t0;
  if (t >= B.ms) { G.forge = null; render(); return; }
  forgeRaf = requestAnimationFrame(forgePaint);
  const tf = Math.floor(t * .03) / .03; // whole thirtieths of a second
  if (cv.dataset.tf === String(tf)) return; cv.dataset.tf = tf;
  const A = pmodel('anvil'), Hm = pmodel('hammer'), w = cv.width, h = cv.height;
  let spot; try { spot = JSON.parse(cv.dataset.items)[0]; } catch { spot = ['anvil', 0, w >> 1, h - 6, Math.round(h * .8), null]; }
  const [, , sx0, foot, tall, tint] = spot;
  // the scene in metres, z up: the anvil at the middle turned a little toward you, the card on its face, the hammer
  // held by its grip over the far end and swung about it
  const yaw = -18 * Math.PI / 180, cy = Math.cos(yaw), sy = Math.sin(yaw);
  const top = Math.max(...A.faces.flatMap(f => f.p.map(p => p[2]))) + .004, grip = .03;
  const W = q => { const x = q[0] * cy - q[1] * sy, y = q[0] * sy + q[1] * cy; return [x * TS, q[2] * TS, -y * TS]; };
  const G0 = [.6, 0, top + .225]; // the grip, so that at rest on the card the head's lower face meets it
  const swingAt = tt => { const H = B.hits, i = H.findIndex(x => x >= tt);
    if (i < 0) { const s = Math.min(1, (tt - H[H.length - 1] - 80) / 300); return s <= 0 ? 0 : 38 * s; } // after the last blow it is lifted away
    if (tt >= H[i] - 60) return 60 * (H[i] - tt) / 60; // falling: 60 degrees in 60 ms
    return i === 0 ? 60 : 60 * Math.min(1, Math.max(0, (tt - H[i - 1] - 40) / 160)); };
  const hammerAt = deg => { const a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    const rot = v => { const X = -v[2], Y = -v[1], Z = -v[0]; return [X * ca + Z * sa, Y, -X * sa + Z * ca]; }; // grip axis to the left, the head's long axis down; then the swing
    return { pt: p => { const q = rot([p[0], p[1], p[2] - grip]); return [G0[0] + q[0], G0[1] + q[1], G0[2] + q[2]]; }, n: rot }; };
  const cardW = .12, cardD = .17, cardAt = [0, 0, top];
  const cardCorners = (turn = 0) => [[-cardW, cardD], [cardW, cardD], [cardW, -cardD], [-cardW, -cardD]].map(([x, y]) => { const c = Math.cos(turn), s = Math.sin(turn); return [cardAt[0] + x * c - y * s, cardAt[1] + x * s + y * c, top]; });
  const camKey = [w, h, sx0, foot, tall].join();
  if (!fb.cam || fb.cam.key !== camKey) { // one camera for the beat, fitted to the anvil and the hammer at both ends of its swing: the whole swing as tall as the spot says, the anvil's foot on its spot. Fitted again if the frame changes size.
    const anvilPts = A.faces.flatMap(f => f.p).map(W), pts = [...anvilPts, ...[0, 60].flatMap(d => { const hm = hammerAt(d); return Hm.faces.flatMap(f => f.p.map(hm.pt)); }).map(W)];
    const cam = { y: 720, z: 900, pitch: Math.atan2(620, 900), f: 300, cx: 0, cy: 0 }; // looking down on the anvil's face, so the card on it reads
    const box = (c, ps) => { const P = R3.camera(c), s = ps.map(P).filter(Boolean), xs = s.map(p => p[0]), ys = s.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
    let b = box(cam, pts); cam.f = Math.round(cam.f * tall / Math.max(1, b[3] - b[1]));
    b = box(cam, anvilPts); cam.cx = Math.round(sx0 - (b[0] + b[2]) / 2); cam.cy = Math.round(foot - b[3]); fb.cam = { ...cam, key: camKey };
  }
  const proj = R3.camera(fb.cam), view = R3.makeView(cv, w, h); view.px.fill(0);
  const L = [-.35, .8, .5], ln = Math.hypot(...L), lit = n => { const q = W(n); return .45 + .55 * Math.max(0, (q[0] * L[0] + q[1] * L[1] + q[2] * L[2]) / TS / ln); };
  const model = (M, name, pt, nr, bias) => modelFaces(view, M, name, p => W(pt(p)), nr, lit, { tint, bias });
  model(A, 'anvil', p => p, n => n, 0);
  const ang = swingAt(tf), hm = hammerAt(ang); model(Hm, 'hammer', hm.pt, hm.n, -900);
  const hit = B.hits.some(x => tf >= x && tf - x < 70), flash = hit ? 1.5 : 1;
  const lay = (id, turn, bias) => { const t = id != null ? cardTex(id) : null, p = cardCorners(turn).map(W);
    if (t) R3.quad(view, { p, uv: [[0, 0], [39, 0], [39, 39], [0, 39]], tex: t, shade: flash, bias });
    else R3.quad(view, { p, uv: [[0, 0], [0, 0], [0, 0], [0, 0]], col: [168, 126, 79], shade: flash, bias }); };
  if (fb.kind === 'masterwork') { const n = relicFile(fb.mw) + '-64', k = 'mw-' + fb.mw;
    if (TEX[k] === undefined && CART.has(n)) { TEX[k] = null; const im = new Image(); im.onload = () => { TEX[k] = R3.texFrom(im, 64, 64); }; im.src = cimg(n); }
    const p = cardCorners().map(W), s = TEX[k]; if (s) R3.quad(view, { p, uv: [[0, 0], [63, 0], [63, 63], [0, 63]], tex: s, shade: flash, bias: -400 }); }
  else if (fb.kind === 'bind' && tf >= B.lock) lay(fb.made, 0, -400); // the chains lock: one card where two lay
  else { lay(fb.ids[0], 0, -400); if (fb.kind === 'bind') lay(fb.ids[1], Math.PI / 2, -450); }
  R3.draw(view, proj);
  // sparks off each blow, and what follows the last: steam for a temper, violet motes for an enchant, a ring of gold
  // where a bind locks, the furnace's breath for a Masterwork. Single pixels in 15-bit colour, as the console drew them.
  const at = proj(W([cardAt[0], cardAt[1], top])); if (!at) { R3.present(view); return; }
  const dot = (x, y, rgb) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= w || y >= h) return; view.px[y * w + x] = 0xff000000 | ((rgb[2] & 0xf8) << 16) | ((rgb[1] & 0xf8) << 8) | (rgb[0] & 0xf8); };
  const rnd = i => { const s = Math.sin(i * 12.9898) * 43758.5453; return s - Math.floor(s); };
  B.hits.forEach((x, j) => { const age = tf - x; if (age < 0 || age > 330) return;
    for (let i = 0; i < 20; i++) { const a = Math.PI * (1.05 + .9 * rnd(j * 31 + i)), v = .12 + .16 * rnd(j * 17 + i * 3), g = .0004;
      const sx = at[0] + Math.cos(a) * v * age, syy = at[1] + Math.sin(a) * v * age * .6 + g * age * age, c = age < 110 ? [255, 240, 170] : age < 220 ? [250, 170, 60] : [200, 80, 40];
      dot(sx, syy, c); if (age < 200) { dot(sx + 1, syy, c); dot(sx - Math.cos(a) * 2, syy - Math.sin(a) * 1.2, [250, 170, 60]); } } });
  const last = B.hits[B.hits.length - 1], after = tf - last;
  if (fb.kind === 'temper' && after > 100) for (let i = 0; i < 18; i++) { const age = after - 100 - i * 30; if (age < 0 || age > 700) continue; const k = age / 700; dot(at[0] + (rnd(i) - .5) * 26 + Math.sin(age * .01 + i) * 3, at[1] - 4 - age * .05, k < .5 ? [215, 210, 200] : [140, 135, 130]); }
  if (fb.kind === 'enchant' && after > 60) for (let i = 0; i < 22; i++) { const age = after - 60 - i * 40; if (age < 0 || age > 900) continue; dot(at[0] + (rnd(i * 7) - .5) * 30 + Math.sin(age * .012 + i) * 4, at[1] + 2 - age * .045, age < 450 ? [200, 150, 255] : [130, 80, 200]); }
  if (fb.kind === 'bind' && tf >= B.lock && tf - B.lock < 450) { const k = (tf - B.lock) / 450, R = 6 + 26 * k; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; dot(at[0] + Math.cos(a) * R, at[1] + Math.sin(a) * R * .45, k < .5 ? [255, 230, 140] : [220, 160, 70]); } }
  if (fb.kind === 'masterwork' && tf >= B.roar) for (let i = 0; i < 40; i++) { const age = tf - B.roar - i * 18; if (age < 0 || age > 900) continue; dot(at[0] + (rnd(i * 5) - .5) * tall * 1.4, foot - age * (.08 + .05 * rnd(i)), age < 300 ? [255, 200, 90] : age < 600 ? [240, 120, 40] : [170, 60, 30]); } // the furnace's breath rises from the floor round the anvil
  R3.present(view);
}
function psBazaar() {
  const r = G.run, o = r.offer, slots = r.charms.length >= db.config.charmSlots;
  const cantBuy = it => it.sold || r.embers < it.price || (it.kind === 'charm' && slots) || (it.kind === 'scrap' && (G.pickDeck == null || !r.deck[G.pickDeck] || r.deck[G.pickDeck].b || r.deck.length <= MIN_DECK));
  if (o.merchant === 'scrapper') { // the Winnower: pick a deck card to cut
    const it = o.items[0], i0 = o.items.indexOf(it), d = G.pickDeck != null ? r.deck[G.pickDeck] : null, lw = ledgeW();
    const ledge = `<div class="dt" style="width:${lw - 82}px"><b>THE WINNOWER</b><p>${it.uses} CUT${it.uses === 1 ? '' : 'S'} LEFT · ${it.price} EMBERS</p><p>DECK ${r.deck.length}, NEVER BELOW ${MIN_DECK}</p>${d ? `<p>${esc(card(d.id).name.toUpperCase())}</p>` : ''}</div>` + pq(lw - 72, 40, 64, 'CUT IT', `buy:${i0}`, { lit: !cantBuy(it), off: cantBuy(it) });
    const bar = d ? (d.b ? 'A bound meld cannot be cut.' : `Cut ${card(d.id).name} out of your deck for the rest of the run.`) : 'The Winnower cuts one card out of your deck for the rest of the run, so the cards you want come round sooner. Tap a deck card, weakest first.';
    G.barText = bar;
    if (DUAL) return workDual({ r, room: 'room-bazaar', head: 'THE WINNOWER', sub: `${it.uses} CUT${it.uses === 1 ? '' : 'S'} LEFT · ${it.price} EMBERS`, text: esc(bar), more: d ? 'A cuts it. A on another card chooses that one.' : 'A chooses a card.', said: i => i === G.pickDeck ? '' : d ? 'A on another card' : 'A chooses a card', picked: [d], verb: i => `deckpick:${i}`, weakFirst: true,
      cells: [{ t: 'CUT IT', a: `buy:${i0}`, lit: !cantBuy(it), off: cantBuy(it) }], gridHead: 'YOUR DECK, WEAKEST FIRST', gridR: `NEVER BELOW ${MIN_DECK}`, cols: 3 });
    return frame({ left: psYou(r), right: roomRight(r), view: roomBack('room-bazaar') + deckGrid(r.deck, 'deckpick', G.pickDeck, null, true), ledge, bar });
  }
  const key = `bazaar.${r.floor}.${r.chamber}.${o.items.map(x => (x.id || (x.entry && x.entry.id) || x.kind) + (x.sold ? 's' : '')).join()}`;
  const items = o.items.map((it, i) => { const base = it.kind === 'card' ? (it.sealed ? { name: 'SEALED CARD', ...backItem, facts: ['SEALED'], text: 'A card you see only once it is yours.' } : cardItem(it.entry, '')) : relicItem(it.id, '');
    const why = it.sold ? 'SOLD' : it.kind === 'charm' && slots ? 'CHARM SLOTS FULL' : r.embers < it.price ? 'NOT ENOUGH EMBERS' : '';
    return { ...base, price: it.price, a: `buy:${i}`, off: cantBuy(it), take: it.sold ? 'SOLD' : `BUY ${it.price}`, facts: [...(base.facts || []), `${it.price} EMBERS${why ? ' · ' + why : ''}`], text: base.text + (it.kind === 'gift' ? ' From outside this descent: it does not count toward your Gifts.' : '') }; });
  return psOffer({ title: 'BAZAAR', key, room: 'room-bazaar', items, right: pq(4, yb(180), 88, 'LEAVE', 'leave'), bar0: `You have ${r.embers} Embers.` });
}
function psOmen() {
  const r = G.run, o = r.offer;
  const item = o.seen ? cardItem(o.card, 'pick:0') : { name: 'UNSEEN CARD', a: 'pick:0', ...backItem, facts: ['ONE STRONGER CARD, UNSEEN'], text: '' };
  return psOffer({ title: 'OMEN', key: 'omen', room: 'room-omen', items: [{ ...item, take: 'GIVE TWO', off: r.trunk.length < 2, facts: [...item.facts, `TRUNK CARDS: ${r.trunk.length}`], text: `${o.text} Your two weakest trunk cards are taken.` }],
    right: pq(4, yb(160), 88, 'SEE IT FOR 30', 'pick:1', { off: o.seen || r.embers < 30 }) + pq(4, yb(180), 88, 'LEAVE', 'skip') });
}

// ---- the books: the run's end, the Codex, Feats, the Memory Vault
// The book stands in the reading room: the room is shown whole and undimmed, and the book's window, 416 pixels wide at
// the most, stands in its middle, so the near shelves frame it on both sides (at 512 pixels wide only their inner edge
// shows). Its heading is carved, its pages scroll in a box, its plaques lie along its foot.
function psBook(title, body, foot, extra = '') {
  // The painting has black bands of its own above and below the room, so a frame taller than 360 rows takes the cut of the
  // room without them (720 x 480, console-art.py), and no band shows above or below the shelves.
  const { W, H } = F, bw = Math.min(W - 16, 416), bx = (W - bw) >> 1, bgPic = H > 360 && CART.has('room-archive-book-x') ? 'room-archive-book-x' : CART.has('room-archive-book') ? 'room-archive-book' : 'key-title';
  const bg = CART.has(bgPic) && D.cart && D.cart.title === 720 ? `<img class="bg" src="${cimg(bgPic)}" width="720" height="480" style="position:absolute;left:${(W - 720) >> 1}px;top:${(H - 480) >> 1}px" alt="">` : box(0, 0, W, H, 'st dk');
  const c = carve(title, 16, render), head = c ? `<img class="ab" src="${c.url}" width="${c.w}" height="${c.h}" style="left:${(bw - c.w) >> 1}px;top:4px" alt="${esc(title)}">` : `<b class="ab lb g" style="left:8px;top:8px">${esc(title)}</b>`; // placed from its own width, so it starts on a whole pixel
  return `<div class="ti">${bg}<div class="wn book" style="left:${bx}px;top:6px;width:${bw}px;height:${H - 12}px">${head}
    <div class="ab sc" style="left:8px;top:26px;width:${bw - 16}px;height:${H - 66}px">${body}</div><div class="ab" style="left:8px;top:${H - 32}px;width:${bw - 16}px;height:16px">${foot}</div></div>${extra}</div>`;
}
const row = (pic, head, text, side = '') => `<div class="brow">${pic ? `<div class="bp">${pic}</div>` : ''}<div class="bt"><b class="lb g">${head}</b><p>${text}</p></div>${side ? `<div class="bs">${side}</div>` : ''}</div>`;
const inl = (label, a, o = {}) => `<button class="pq in${o.lit ? ' lit' : ''}${o.on ? ' on' : ''}" ${a ? `data-a="${esc(a)}"` : ''}${o.off ? ' disabled' : ''}>${esc(label)}</button>`; // a plaque that sits in a line
const meter = (n, goal, gain = 0) => `<i class="ga in" style="width:120px"><i style="width:${Math.round(118 * Math.min(1, n / goal))}px"></i>${gain ? `<u style="left:${Math.round(118 * Math.min(1, (n - gain) / goal))}px;width:${Math.round(118 * Math.min(1, gain / goal))}px"></u>` : ''}</i>`;
const featPs = f => row('', `${esc(f.name.toUpperCase())} <span class="d">${esc(f.build.toUpperCase())}</span>`, `${esc(f.text)}`, `${meter(f.after, f.goal, f.after - f.before)}<b class="lb">${f.done ? 'COMPLETE' : `${f.after} / ${f.goal}`}${f.gain && !f.done ? ` (+${f.gain})` : ''}</b>`);
// The rows this run earned (each one keeps the number of the run it was earned in), and the counting row it brought
// nearest, from how far each had come when the run began (kept on the run as uiAch0 by the page).
const achRunRows = () => achView(db, P, null).filter(r => r.earned && r.at === P.runs && !G.achOff.has(r.id));
function achCloser() {
  const r = G.run, at0 = r && r.uiAch0; if (!at0) return null; let best = null;
  for (const x of achProgress(db, P, null)) { if (x.done || !(x.id in at0)) continue; const gain = x.have - at0[x.id]; if (gain > 0 && (!best || gain / x.goal > best.gain / best.goal)) best = { name: ACH_BY_ID[x.id].name, have: x.have, goal: x.goal, gain }; }
  return best;
}
function psOver() {
  const r = G.run, S = r.stats, R = G.results, won = r.result.won;
  const head = won ? 'THE PYRAMID IS CLEARED' : r.result.reason === 'abandoned' ? 'YOU LEFT THE PYRAMID' : 'THE RUN ENDS';
  const unl = R ? R.unlocks.filter(u => u.kind !== 'heat' || u.id <= heatTop()).map(u => u.kind === 'heat' && labs.heat ? { ...u, name: `Heat ${u.id}, ${HEAT_RULES[u.id - 1].name}`, text: HEAT_RULES[u.id - 1].text + ' It pays more Memories.' } : u)
    .map(u => u.kind === 'gift' ? row(medal(u.id, 32), `NEW GIFT: ${esc(u.name.toUpperCase())}`, `${esc(RELICS[u.id].text)} ${esc(u.why)} It will be in the first Gift offer of your next run.`) : row('', `${u.kind === 'record' ? 'NEW RECORD' : 'UNLOCKED'}: ${esc(String(u.name).toUpperCase())}`, esc(u.text))).join('') : '';
  const tally = `<p>Floor ${r.floor + 1}, chamber ${Math.min(6, r.chamber + 1)}. ${esc(r.forger ? FORGERS[r.forger].name : 'No Forger')}. Duels won ${S.wins} of ${S.duels}. Guardians beaten ${S.bossWins}. Melds ${S.melds}.${Object.keys(S.ranks).length ? ' Ranks ' + Object.entries(S.ranks).map(([k, v]) => k + ' x' + v).join(', ') + '.' : ''}</p>`;
  const mem = R ? `${R.lines.length ? `<p>${R.lines.map(l => `${esc(l[0])} +${l[1]}`).join('. ')}.</p>` : ''}<p><b class="lb g">+${R.total} MEMORIES</b></p>` : '<p class="d">Already banked.</p>';
  const feats = R && R.feats.length ? `<p><b class="lb g">FEATS</b></p>${R.feats.map(featPs).join('')}<p class="d">Feats count across runs, win or lose.</p>` : '';
  const ach = achRunRows();
  if (DUAL) return overDual({ head, unl, tally, mem, ach });
  return psBook(head, unl + tally + mem + AC.runEndOne(ach, achCloser()) + feats, inl('NEW RUN', 'new', { lit: true }) + inl('CODEX', 'screen:codex') + inl('FEATS', 'screen:feats') + inl(`VAULT ${P.memories}`, 'screen:vault') + inl('TITLE', 'home'));
}
function psFeats() {
  if (DUAL) return featsDual();
  const rows = featList(!!labs.long).map(f => { const done = (P.featsDone || []).includes(f.id), n = done ? f.goal : (P.feats || {})[f.id] || 0;
    return featPs({ ...f, before: n, after: n, gain: 0, done }) + row(medal(f.gift, 32), `${esc(RELICS[f.gift].name.toUpperCase())} <span class="d">${done ? 'UNLOCKED GIFT' : 'GIFT, LOCKED'}</span>`, esc(RELICS[f.gift].text)); }).join('');
  const forg = FORGER_IDS.concat(HIDDEN_FORGERS.filter(id => P.forgers.includes(id))).filter(id => id !== 'tarn').map(id => row('', `${esc(FORGERS[id].name.toUpperCase())} <span class="d">${P.forgers.includes(id) ? 'UNLOCKED' : 'LOCKED'}</span>`, esc(FORGER_FEATS[id].text))).join('');
  return psBook('FEATS', `<p>Each feat follows a way of playing and adds one Gift to what the forge can offer. Progress counts across runs, win or lose.</p>${rows}<p><b class="lb g">FORGERS</b></p>${forg}${labs.long ? `<p><b class="lb g">STARTER KITS</b></p>${plainKits()}` : ''}`, inl('BACK', 'home', { lit: true }) + inl('ACHIEVEMENTS', 'screen:ach'));
}
// The achievements: pages of the Feats book, one group of rows at a time (L1 and R1, or the < and > plaques, turn the
// groups; a tap chooses the row LOOK CLOSER opens). The Rumours switch (db.config.secretLast) decides which rows are open.
const achBook = () => G.achB || (G.achB = { g: 0, pg: 0, sel: null, look: false, pages: 1 });
const achAll = () => achView(db, P, null);
function psAch() {
  if (DUAL) return achDual();
  const B = achBook(), all = achAll(), { W, H } = F, bw = 416, bx = (W - bw) >> 1, h = H - 18, open = !!db.config.secretLast;
  let bk = AC.bookOne(all, B.g, B.pg, B.sel, h, open); B.pg = bk.page; B.pages = bk.pages;
  if (!bk.ids.includes(B.sel)) { B.sel = bk.ids[0] || null; bk = AC.bookOne(all, B.g, B.pg, B.sel, h, open); }
  const bgPic = H > 360 && CART.has('room-archive-book-x') ? 'room-archive-book-x' : CART.has('room-archive-book') ? 'room-archive-book' : 'key-title';
  const bg = CART.has(bgPic) && D.cart && D.cart.title === 720 ? `<img class="bg" src="${cimg(bgPic)}" width="720" height="480" style="position:absolute;left:${(W - 720) >> 1}px;top:${(H - 480) >> 1}px" alt="">` : box(0, 0, W, H, 'st dk');
  const c = carve('FEATS', 16, render), head = c ? `<img class="ab" src="${c.url}" width="${c.w}" height="${c.h}" style="left:${(bw - c.w) >> 1}px;top:4px" alt="FEATS">` : lb(8, 8, 'FEATS', 'g');
  let s = `<div class="ti">${bg}<div class="wn book" style="left:${bx}px;top:9px;width:${bw}px;height:${h}px">${head}${bk.html}</div>`;
  const r = B.look && all.find(x => x.id === B.sel);
  if (r) { const L = AC.lookOne(r, all), lw = 368, lx = (W - lw) >> 1, ly = Math.max(4, Math.min(56, (H - L.h) >> 1)); s += `<div class="dim"></div><div class="wn mw" style="left:${lx}px;top:${ly}px;width:${lw}px;height:${L.h}px;padding:0">${L.html}</div>`; }
  return s + '</div>';
}
function achDual() {
  const B = achBook(), all = achAll(), gi = B.g, rows = AC.groupRows(all, gi), m = /^a:(\d+)$/.exec(G.look || ''), at = m ? Math.min(rows.length - 1, +m[1]) : 0, r = rows[at];
  // the keys on the game's four columns (4, 106, 208, 310), as every two-frame foot: a plaque too wide for its column
  // says its shorter words instead. The Y place stays empty while the window is open, and each key keeps its x.
  const keys = [B.look ? { k: 'B', t: 'CLOSE', a: 'achclose', lit: true } : { k: 'B', t: 'BACK', a: 'screen:feats' }, { k: 'L1', t: ['LAST GROUP', 'LAST'], a: 'achg:-1' }, { k: 'R1', t: ['NEXT GROUP', 'NEXT'], a: 'achg:1' }, B.look ? null : { k: 'Y', t: ['LOOK CLOSER', 'LOOK'], a: 'achlook' }];
  const y0 = 360 - (2 * 21 + 11), ft = { y0, html: foot(y0, [keys, TBOOKS.map(b => ({ t: b[1], a: 'screen:' + b[0], cls: b[0] === 'feats' ? 'on' : '' }))], 4) };
  return two(lectern('', '', B.look ? AC.lookTop(all, gi, r) : AC.lecternTop(all, gi, r)), AC.listBottom(all, gi, at, ft.y0, !!db.config.secretLast, B.look) + ft.html);
}
const plainKits = () => FORGER_IDS.concat(HIDDEN_FORGERS).filter(id => P.forgers.includes(id)).map(id => FORGERS[id].kits.map((k, i) => { if (!i) return ''; const w = forgerStats(P, id).wins, g = KIT_GOALS[i], n = Math.min(w, g); return row('', `${esc(k.name.toUpperCase())} <span class="d">${esc(FORGERS[id].name.toUpperCase())}</span>`, `Win ${g} duels as ${esc(FORGERS[id].name)}.`, `${meter(n, g)}<b class="lb">${w >= g ? 'OPEN' : n + ' / ' + g}</b>`); }).join('')).join('');
function psVault() {
  if (DUAL) return vaultDual();
  const tiles = VAULT.map(v => { const own = P.bought.includes(v.id), rr = RELICS[v.id]; return row(medal(v.id, 32), `${esc(rr.name.toUpperCase())} <span class="d">${rr.kind === 'M' ? 'MASTERWORK' : 'CHARM'}</span>`, esc(rr.text), inl(own ? 'OWNED' : `${v.price} MEMORIES`, `vbuy:${v.id}`, { off: own || P.memories < v.price })); }).join('');
  const ench = labs.long ? `<p><b class="lb g">ENCHANTS</b></p><p class="d">An Anvil offers three Enchants from the ones you hold. Six are yours from the start: ${START6}.</p>${VAULT_ENCHANTS.map(v => { const own = P.bought.includes(v.key); return row('', esc(v.id.toUpperCase()), esc(ENCHANT_TEXT[v.id]), inl(own ? 'OWNED' : `${v.price} MEMORIES`, `vbuy:${v.key}`, { off: own || P.memories < v.price })); }).join('')}` : '';
  return psBook(`MEMORY VAULT  ${P.memories}`, `<p>Spend Memories to widen what a run can offer. Nothing here makes you stronger at the start.</p>${tiles}${ench}`, inl('BACK', 'home', { lit: true }));
}
function psCodex() {
  if (DUAL) return codexDual();
  const X = codexIndex(), found = codexFound(), v = G.cx; convertSheets(40);
  let list = X.list.filter(R => (v.view === 'all' || found.has(R.id)) && (!v.type || card(R.id).type === v.type));
  const total = list.length; list = list.slice(0, 120);
  const byType = t => X.list.filter(R => card(R.id).type === t);
  const tiles = list.map(R => found.has(R.id) ? psCard({ id: R.id }, null, null, { attrs: `data-a="cxopen:${R.id}"`, badge: found.get(R.id).length }) : `<button class="cd unk" style="position:relative" data-a="cxopen:${R.id}" aria-label="Not found yet"><i class="n1">?</i></button>`).join('');
  const filt = inl('FOUND', 'cxview:found', { on: v.view === 'found' }) + inl('ALL', 'cxview:all', { on: v.view === 'all' }) + X.types.map(t => inl(`${t} ${byType(t).filter(R => found.has(R.id)).length}/${byType(t).length}`, `cxtype:${t}`, { on: v.type === t })).join('');
  const heard = BOSSES.flat().filter(b => P.seen.includes('memory:' + b.id));
  const rum = rumours() ? `<p><b class="lb g">RUMOURS · ${heard.length} OF ${BOSSES.flat().length} MEMORIES HEARD</b></p>${heard.map(b => `<p><b class="lb">${esc(b.name.toUpperCase())}</b> ${esc(SCENES['memory:' + b.id].lines[0])}</p>`).join('') || '<p class="d">Nothing yet. A guardian remembers something as it falls.</p>'}` : '';
  // Its pages mix three steps: lines of 16 pixels, the filter plaques on rows of 24 and the cards on rows of 64. A give
  // before the cards (scrollPlan) opens as far as the box needs to come to rest on whole lines, rows and cards together,
  // so it opens at its count and every line of it can be read. The plaques keep 4 pixels under the words over them, the
  // same in every view: a give before them opened by a different count in each view and could leave them on the words.
  const give = most => `<i class="scgive" data-step="8" data-most="${most}"></i>`;
  const body = `<p>${found.size} of ${X.list.length} results found, ${G.known.size} recipes written. A page you have found shows why the meld works, so you can make it again from other cards.</p>${rum}<div class="row2" style="margin:4px 0">${filt}</div>${give(56)}<div class="row2" style="margin:0 0 4px">${tiles || '<p class="d">Nothing here yet. Meld two monsters in a duel to write the first page.</p>'}</div>${total > 120 ? `<p class="d">Showing 120 of ${total}. Pick a Type to narrow it.</p>` : ''}<p><b class="lb g">RECORD</b></p><p>Runs ${P.runs}. Clears ${P.clears}. Duels won ${P.duelWins}. Guardians beaten ${P.bossWins}. Memories earned ${P.earned}.</p>`;
  let page = '';
  if (G.cx.open != null) { const R = X.res.get(G.cx.open); if (R) { const c = card(R.id), recs = found.get(R.id) || [], known = recs.length > 0; if (known) convertSheets(96);
    const hint = R.kind === 'printed' ? `A printed fusion of ${R.mats.map(m => 'a ' + card(m).type).join(' and ')}.` : `A ${c.attr} ${c.type}. Some ${c.type} melded with some ${c.attr} monster makes it. Which ones is for you to find.`;
    page = `<div class="dim" data-a="cxclose"></div><div class="wn mw" data-a="cxclose" style="left:${72 + cx0()}px;top:${16 + cy0()}px;width:368px;height:208px">${known ? `<div class="big" style="left:8px;top:8px"><i class="art" style="${cpic(R.id, 96)}"></i><b class="n1">${c.atk} / ${c.def}</b><b class="n2">${esc(`${c.attr} · LV ${c.level}`)}</b></div>` : '<div class="big unk" style="left:8px;top:8px"><b class="n1">?</b></div>'}
      <div class="ab sc" style="left:122px;top:8px;width:238px;height:170px"><h2>${known ? esc(c.name) : 'Not found yet'}</h2><p>${known ? esc(`${c.type}. ${whyLine(R)}`) : esc(hint)}</p>${known ? `<p class="d">Recipes you have found (${recs.length}):</p><p>${recs.slice(0, 8).map(ids => ids.map(x => esc(card(x).name)).join(' + ')).join('<br>')}</p>${recs.length > 8 ? `<p class="d">and ${recs.length - 8} more</p>` : ''}` : ''}</div>${lb(250, 190, 'TAP TO CLOSE', 'd')}</div>`; } }
  return psBook('CODEX', body, inl('BACK', 'home', { lit: true }), page);
}

// ---- choosing a Forger, before a descent
function psForger() {
  const ids = FORGER_IDS.concat(P.forgers.includes('last') || labs.secret ? ['last'] : []), heatMax = heatOpen(), h = G.pickHeat, hr = labs.heat ? HEAT_RULES.filter(x => x.n <= h) : [];
  // Each face at 64 in its frame (68, and its outline: 70), or at 48 (54) on a plinth too low for that, inside the
  // plinth's ring (psOffer sizes the row for it).
  const faceOn = (id, own, fs) => ({ wide: fs + 6, tall: fs + 6, pic: (cx, hh, y) => { const fc = faceName(id) + (fs === 48 ? '-48' : ''), at = `left:${cx - fs / 2 - 2}px;top:${y + 1 + Math.max(0, (hh - fs - 6) >> 1)}px`;
    return CART.has(fc) ? `<i class="ab pf${fs === 48 ? ' s48' : ''}${own ? '' : ' pflk'}" style="${at}"><img src="${cimg(fc)}" width="${fs}" height="${fs}" alt=""></i>` : `<i class="ab pf none${fs === 48 ? ' s48' : ''}" style="${at}"></i>`; } });
  const items = ids.map(id => { const f = FORGERS[id], own = P.forgers.includes(id);
    return { fid: id, name: own ? shortName(f.name) : id === 'last' && !own ? 'HIDDEN' : shortName(f.name), a: 'descend', take: 'DESCEND', off: !own, ...faceOn(id, own, 64), small: faceOn(id, own, 48),
      facts: own ? [esc(f.tag.toUpperCase()), esc(`POWER: ${f.power}`.toUpperCase())] : ['LOCKED'],
      text: own ? `${ruleText(f.rule)} ${f.power}: ${f.powerText}` + (labs.long ? ' ' + plain(roadLine(id)) : '') : id === 'last' && !P.forgers.includes('last') ? 'Nobody says how. The guardians remember things as they fall, and the Codex keeps what they say.' : `To unlock: ${FORGER_FEATS[id].text}` }; });
  const sel = Math.max(0, ids.indexOf(G.pickForger)), pick = ids[sel], F0 = FORGERS[pick];
  // The pillars' words in whole words, on as many lines of 80 pixels as they take (a Forger's way of playing, the last
  // heat rule's name), each plaque under them moved down for them.
  const words = (t, x, y, cls) => nameLines(t, 80, 3).map((s, i) => `<b class="ab lb ${cls}" data-name="${esc(t)}" style="left:${x}px;top:${y + 9 * i}px">${esc(s)}</b>`).join('');
  const left = psPort(P.forgers.includes(pick) ? faceName(pick) : '', 14, 6, !P.forgers.includes(pick)) + lb(8, 79, shortName(F0.name), 'g') + words(F0.tag, 8, 92, 'd') + pq(4, yb(220), 88, 'BACK', 'home');
  const rule = hr.length ? hr[hr.length - 1].name : '', rl = rule ? nameLines(rule, 80, 3).length : 0;
  const right = lb(8, 8, 'HEAT', 'g') + `<b class="ab big2" style="left:8px;top:20px;width:80px;text-align:center">${h}</b>`
    + pq(4, 40, 42, '<', `heat:${Math.max(0, h - 1)}`, { off: h <= 0 }) + pq(50, 40, 42, '>', `heat:${Math.min(heatMax, h + 1)}`, { off: h >= heatMax })
    + (rule ? words(rule, 8, 62, 'd') + pq(4, 65 + 9 * rl, 88, 'HEAT RULES', `heatinfo:${h}`) : heatMax ? '' : lb(8, 62, 'CLEAR TO OPEN', 'd'))
    + pq(4, yb(200), 88, 'HOW TO PLAY', 'tab:help') + pq(4, yb(220), 88, 'OPTIONS', 'tab:options');
  const bar0 = h ? `Heat ${h}: Memories +${h * 20}%.` + (hr.length ? ` ${hr[hr.length - 1].name}: ${hr[hr.length - 1].text}` : ' Rivals are stronger.') : '';
  return psOffer({ title: 'CHOOSE YOUR FORGER', items, key: 'forger', room: 'room-forgers', sel, selA: i => `forger:${ids[i]}`, left, pillar: right, bar0 });
}
function psKit() {
  const r = G.run, key = 'kit.' + r.offer.map(k => k.kit + k.deck.length).join();
  return psOffer({ title: 'PICK A STARTER KIT', key, room: 'room-forgers', bar0: r.builds ? `This descent carries ${r.builds.map(f => FAMILY_NAME[f]).join(' and ')} Gifts.` : '', right: r.redeal ? pq(4, yb(180), 88, 'DEAL AGAIN', 'redeal') : '',
    items: r.offer.map((k, i) => { const best = k.deck.slice().sort((a, b) => cardValue(db, b) - cardValue(db, a))[0]; convertSheets(64);
      return { ...cardItem(best, `kit:${i}`), name: k.name, deck: k.deck, take: 'TAKE KIT', facts: [`${k.deck.length} CARDS · WEIGHT ${deckWeight(db, k.deck)}`, esc(`BEST: ${card(best.id).name}`.toUpperCase())], text: plain(summary(k.deck)) }; }) });
}
function psCharm() {
  const r = G.run, key = 'charm.' + r.offer.options.join();
  return psOffer({ title: 'PICK ONE CHARM', key, room: 'room-forgers', bar0: 'A charm changes a rule for the whole run.', items: r.offer.options.map((id, i) => relicItem(id, `pick:${i}`)) });
}

// ---------- the two-screen layout: the pieces the screens share (dual.mjs, DUAL.md) ----------
// With two frames a screen gives back its two halves, { top, bottom }, laid out from the same parts it lays out for one
// frame. The top frame is the place: the room and its painting with one tall window of words, or the hall and the whole
// table. The bottom frame is what the player holds and decides: the hand or the deck, the relics, what a choice costs and
// gives, and every plaque with its pad key. No fact stands on both; a window never lies over either frame, it takes
// the frame's place instead (a question takes the bottom frame, a book takes both).
const two = (top, bottom) => ({ top, bottom });
// Words written for a finger, said for a pad: with two frames a card is chosen, not tapped.
const padWords = t => String(t).replace(/\bTap to\b/g, 'Press A to').replace(/\bTap\b/g, 'Choose').replace(/\btap\b/g, 'choose');
const txb = (x, y, w, h, html, cls = '') => `<div class="ab txw ${cls}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">${html}</div>`;
const noPq = html => String(html || '').replace(/<button class="pq[^>]*>[^<]*<\/button>/g, ''); // a pillar without its plaques: they stand in the foot of the bottom frame
const withAttr = (html, attrs) => html.replace('<button ', `<button ${attrs} `);
// What the cursor rests on or was asked to read (G.look): a card of the deck (d:i), of the trunk (t:i) or by its number
// (c:id), a relic (r:id). In a duel also a hand card (h:i), a monster (z:seat:zone), a set Trap (t0:zone), a graveyard
// (g:seat) and the deck pile (p:0), which the duel's own page reads.
function lookOf(L = G.look) {
  if (!L) return null; const [k, x] = String(L).split(':'), r = G.run;
  const inst = k === 'd' ? r && r.deck[+x] : k === 't' ? r && r.trunk[+x] : k === 'c' ? { id: +x } : null;
  if (inst && card(inst.id)) return readCard(inst);
  if (k === 'r' && RELICS[x]) return { relic: x, name: RELICS[x].name, sub: kindWord(x) + (FAMILY_NAME[RELICS[x].family] ? ' · ' + FAMILY_NAME[RELICS[x].family].toUpperCase() : ''), lines: [RELICS[x].text] };
  return null;
}
function readCard(inst) {
  const c = card(inst.id), mon = db.isMonster(inst.id);
  return { inst, name: c.name, sub: esc((mon ? `${c.attr} · LV ${c.level} · ${c.type}` : roleOf(db, inst.id)).toUpperCase()) + ` · WEIGHT ${weightOf(db, inst.id)}`,
    lines: [mon ? `${c.type}. Printed ${c.atk} / ${c.def}.` : '', inst.e ? `Enchant ${cap(inst.e)}: ${ENCHANT_TEXT[inst.e]}` : rulesText(inst.id), inst.t ? 'Tempered: 300 more ATK and DEF.' : ''].filter(Boolean) };
}
// The top frame of a room: the pillars, the view, and one window of words that reads the chosen thing whole: its name
// and kind on the first line, then its words, then what else the room says, dimmer. Words longer than the window are
// paged (L2, R2 or a tap). A card or relic the player asked to read takes the window until B puts it away.
function roomTop({ left, right, view, head, sub = '', text = '', more = '', extra = '' }) {
  if (!text && more) { text = more; more = ''; }
  text = padWords(text); more = padWords(more);
  const L = lookOf(); if (L) { head = L.name; sub = L.sub; text = esc(L.lines.join(' ')); more = G.lookCur ? '' : 'B puts it away.'; G.lookB = !G.lookCur; } // what the cursor rests on needs no key to put away
  return frame({ left, right, view, extra, tall: `<b class="lb g th" data-name="${esc(head)}">${esc(String(head).toUpperCase())}${sub ? ` <span class="d">· ${sub}</span>` : ''}</b><div class="pgw" data-pager><p>${text}${more ? `<br><span class="d">${more}</span>` : ''}</p></div>` });
}
// A note on the right pillar: a gold heading and lines of whole words under it, from row y; gives back the row after it.
function pnote(y, head, paras) {
  let s = lb(8, y, head, 'g'); y += 12;
  for (const t of [].concat(paras).filter(Boolean)) { for (const l of nameLines(t, 80, 8)) { s += lb(8, y, l); y += 10; } y += 4; }
  return [s, y + 4];
}
// The relic belt along the bottom frame: nine places, the ninth counting the rest when more are held. The cursor on one
// reads it (in a duel, on the page above); A opens the book of relics. inert: true, only shown (on a sheet of words);
// 'pass', the cursor walks past it and a finger still opens the book (in a duel while a card is chosen for play).
function stripB(y, r, inert = false) {
  const rel = relicList(r), more = rel.length > 9 ? rel.length - 8 : 0;
  return box(0, y, 413, 30, 'st dk') + lb(6, y + 11, 'RELICS', 'g') + Array.from({ length: 9 }, (_, i) => { const id = more && i === 8 ? null : rel[i];
    return `<button class="sl" style="left:${48 + i * 26}px;top:${y + 3}px" data-a="${inert === true ? 'nop' : 'tab:relics'}" data-k="rs${i}"${id ? ` data-rid="${id}"` : more && i === 8 ? ' data-rid="+"' : ''}${inert ? ' data-nonav' : id ? ` data-look="r:${id}"` : more && i === 8 ? '' : ' data-nonav'} aria-label="${id ? esc(RELICS[id].name) : more && i === 8 ? 'More relics' : 'Empty relic slot'}">${id ? medal(id, 24) : more && i === 8 ? `<b>+${more}</b>` : ''}</button>`; }).join('') + lb(292, y + 11, `CHARMS ${r.charms.length}/${db.config.charmSlots}`, 'g');
}
// A strip of the eight strongest cards of a list, whole, along the bottom frame. A on one reads it in the window above
// (key: how it is named there); with no key the cards are only shown.
function deckStripB(y, head, list, key = 'd') {
  const ord = list.map((e, i) => [e, i]).sort((a, b) => cardValue(db, b[0]) - cardValue(db, a[0])).slice(0, 8); convertSheets(40);
  return box(0, y, 413, 76, 'lg') + lb(6, y + 5, head, 'g') + ord.map(([e, i], k) => psCard(e, 8 + k * 50, y + 14, { attrs: key ? `data-a="read:${key}:${key === 'c' ? e.id : i}"` : 'tabindex="-1"' })).join('') + (ord.length ? '' : lb(8, y + 34, 'NO CARDS YET', 'd'));
}
// The run in three lines across the bottom frame: Sparks, Embers and seals, the deck's weight and the Forge level.
function descentWide(y, r, gain = '', sparks = true) {
  const cap = weightCap(db, r), w = deckWeight(db, r.deck);
  return box(0, y, 413, 76, 'st') + lb(8, y + 8, 'YOUR DESCENT', 'g') + (sparks ? lb(8, y + 24, 'SPARKS', 'g') + sparkRow(r, 52, y + 22) : lb(8, y + 24, 'DECK', 'g') + lb(52, y + 24, r.deck.length)) + lb(8, y + 40, 'EMBERS', 'g') + lb(52, y + 40, r.embers) + (gain ? `<b class="ab lb" style="left:${58 + String(r.embers).length * 6}px;top:${y + 40}px;color:#9fd0c0">${gain}</b>` : '')
    + lb(8, y + 56, 'SEALS', 'g') + [0, 1].map(i => `<i class="seal${i < Math.min(2, r.seals) ? ' on' : ''}" style="left:${52 + i * 13}px;top:${y + 54}px"></i>`).join('') + lb(104, y + 8, `FLOOR ${r.floor + 1} · CHAMBER ${Math.min(6, r.chamber + 1)}`)
    + lb(210, y + 24, 'WEIGHT', 'g') + lbr(404, y + 24, `${w}/${cap}`) + gauge(210, y + 34, 194, w / cap, 'w' + (w > cap ? ' over' : '')) + lb(210, y + 48, 'FORGE LV ' + r.level, 'g') + gauge(210, y + 58, 194, forgeFrac(r), 'x');
}
// The run as a tall panel: the Forger's face, where the run stands, its weight and Forge level, its relics as medals.
function descentB(x, y, w, h, run, head, text = '', note = '') {
  const cap = weightCap(db, run), wt = deckWeight(db, run.deck), rel = relicList(run), f = run.forger, gw = w - 17;
  let s = box(x, y, w, h, 'wn') + lb(x + 8, y + 8, head, 'g') + psPort(f ? faceName(f) : '', x + 8, y + 22) + lb(x + 84, y + 26, f ? fitName(shortName(FORGERS[f].name), 18) : 'NO FORGER', 'g') + lb(x + 84, y + 40, `FLOOR ${run.floor + 1}`) + lb(x + 84, y + 52, `CHAMBER ${Math.min(6, run.chamber + 1)}`)
    + lb(x + 84, y + 66, 'SPARKS', 'g') + sparkRow(run, x + 124, y + 64) + lb(x + 84, y + 80, 'EMBERS', 'g') + lb(x + 128, y + 80, run.embers);
  s += lb(x + 8, y + 102, 'WEIGHT', 'g') + lbr(x + w - 9, y + 102, `${wt}/${cap}`) + gauge(x + 8, y + 112, gw, wt / cap, 'w' + (wt > cap ? ' over' : '')) + lb(x + 8, y + 128, `FORGE LV ${run.level}`, 'g') + gauge(x + 8, y + 138, gw, forgeFrac(run), 'x');
  s += lb(x + 8, y + 156, `RELICS ${rel.length}`, 'g') + lbr(x + w - 9, y + 156, `CHARMS ${run.charms.length}/${db.config.charmSlots}`, 'g') + rel.slice(0, rel.length > 10 ? 9 : 10).map((id, i) => `<i class="ab" style="left:${x + 10 + (i % 5) * 38}px;top:${y + 170 + Math.floor(i / 5) * 38}px">${medal(id, 32)}</i>`).join('')
    + (rel.length > 10 ? `<i class="ab" style="left:${x + 162}px;top:${y + 208}px;width:30px;height:30px;border:1px solid var(--sm);background:var(--sh)"></i>` + lb(x + 162 + ((32 - labelW('+' + (rel.length - 9))) >> 1), y + 220, '+' + (rel.length - 9), 'g') : ''); // the tenth place counts the relics not drawn
  return s + (text ? txb(x + 8, y + 252, w - 16, 64, `<p>${esc(text)}</p>`) : '') + (note ? lb(x + 8, y + h - 18, note, 'd') : '');
}
// A list of choices down the left of the bottom frame with a panel beside it: the title's menu, and the run's own.
// items: [words, verb, pad key]. The cursor on a choice shows what it opens in the panel.
function menuB(items, panel) {
  const n = items.length, pitch = n > 7 ? 36 : 44, y0 = n > 7 ? 14 : 30;
  return box(0, 0, 196, 360, 'st') + box(196, 0, 217, 360, 'st dk') + items.map(([t, a, k], i) => kc(6, y0 + i * pitch + 3, k || '', 22) + withAttr(pq(34, y0 + i * pitch, 150, t, a, { lit: i === 0 }), `data-look="m:${esc(a)}"${i === 0 ? ' data-n1' : ''}`)).join('') + panel;
}
// The panel beside a list of choices: a heading, what the choice under the hammer opens, and at its foot where the
// player stands (the descent's own counts in a run, the record before one), unless the panel is that record itself.
// end: the row at which a short body ends; the descent's counts then stand in full under it, spread down to the panel's
// foot, so a choice with few words leaves no bare stone.
const panelB = (head, body, tail = true, end = 0) => { const r = G.run, S = r && r.stats, full = !!(end && r);
  const rows = !tail ? [] : full ? [['DUELS WON', S.wins], ['DUELS LOST', S.losses], ['GUARDIANS BEATEN', S.bossWins], ['BOUNTIES MET', S.bounties], ['MELDS MADE', S.melds], ['FIZZLES', S.fizzles], ['TURNS PLAYED', S.turns], ['MEMORIES SO FAR', worth(r).total], ['CARDS CARRIED', r.deck.length + r.trunk.length], ['RELICS HELD', relicList(r).length]].map(q => [q[0], q[1] || 0])
    : r ? [['DUELS WON', r.stats.wins], ['MEMORIES SO FAR', worth(r).total], ['CARDS CARRIED', r.deck.length + r.trunk.length], ['RELICS HELD', relicList(r).length]] : [['RUNS', P.runs], ['CLEARS', P.clears], ['DUELS WON', P.duelWins], ['MEMORIES', P.memories]];
  const y0 = full ? end + 8 : 270, pitch = full ? Math.max(12, Math.min(20, Math.floor((344 - y0 - 22) / rows.length))) : 12;
  return box(202, 6, 205, 348, 'wn') + lb(210, 14, head, 'g') + body + (rows.length ? `<i class="ab" style="left:210px;top:${y0}px;width:189px;height:1px;background:var(--dark)"></i>` + lb(210, y0 + 8, r ? 'THIS DESCENT' : 'YOUR RECORD', 'd') + rows.map(([k, v], i) => lb(210, y0 + 22 + i * pitch, k, 'g') + lbr(398, y0 + 22 + i * pitch, v)).join('') : ''); };
// The deck as a grid on the bottom frame: eight cards a row, every card whole, rows 63 apart (a card and the 3 pixels
// over it, so a row moved up out of the grid leaves nothing of itself behind). A deck with more rows than
// the grid shows moves up one whole row at a time, so a card is never cut. o: verb and look (what a card's tap does and
// what the cursor on it reads, from its place in the list), sel and sel2 (the picked ones), gold (a set of places
// marked with a gold line), weakFirst, h (the grid's height), sk (the name its place is kept under).
function gridB(list, o = {}) {
  const h = o.h || 320, nc = o.cols || 8, w = o.w || (nc === 8 ? 413 : 13 + nc * 50), ord = list.map((e, i) => [e, i]).sort((a, b) => (o.weakFirst ? -1 : 1) * (cardValue(db, b[0]) - cardValue(db, a[0]))), rows = Math.ceil(ord.length / nc), vis = Math.floor((h - 5) / 63); convertSheets(40);
  if (!o.verb && (rows > vis || o.walk)) o = { ...o, verb: () => 'nop' }; // rows out of sight: the cursor can walk in to bring them up, though A does nothing there
  return `<div class="ab gsc" data-sk="${o.sk || 'grid'}" data-row="63" style="left:${o.x || 0}px;top:${o.y || 0}px;width:${w}px;height:${h}px"><div class="gin" style="height:${Math.max(h - 2, rows * 63 + h - 2 - vis * 63)}px">${ord.map(([e, i], k) => psCard(e, 9 + (k % nc) * 50, 3 + Math.floor(k / nc) * 63, { cls: (o.sel === i ? 'sel ' : o.sel2 === i ? 'sel2 ' : '') + (o.gold && o.gold.has(i) ? 'fam' : ''), attrs: (o.verb ? `data-a="${o.verb(i, e)}"${o.look ? ` data-look="${o.look(i, e)}"` : ''} data-k="${o.kp || 'g'}${i}"${o.said ? ` data-said="${esc(o.said(i))}"` : ''}` : 'tabindex="-1"') + (k === 0 && o.n1 ? ' data-n1' : '') })).join('')}${ord.length ? '' : `<b class="ab lb d" style="left:8px;top:8px">${o.none || 'NO CARDS'}</b>`}</div></div>`;
}
// The place in a list of its strongest card, where a grid's cursor starts.
const firstOf = (list, weakFirst = false) => list.length ? list.map((e, i) => [e, i]).sort((a, b) => (weakFirst ? -1 : 1) * (cardValue(db, b[0]) - cardValue(db, a[0])))[0][1] : -1;
// Named rows on the bottom frame, two columns of rows 26 apart in a window: a medal or a tag, a name, a line under it.
// A row with a verb is a control the cursor rests on. rows: { pic, name, sub, a, look, gold, on, k, f }.
function rowsB(y, h, head, headR, rows, o = {}) {
  const per = Math.floor((h - 20) / 26), hh = per * 26, n = Math.ceil(rows.length / 2) + (o.tailRows || 0), walk = n > per || !!o.walk; // rows out of sight: every row is a place for the cursor
  const body = rows.map((x, i) => { const tag = x.a || x.look || walk ? 'button' : 'i', a = x.a || (walk ? 'nop' : ''), k = x.k || (walk ? 'rw' + i : '');
    return `<${tag} class="rw${x.gold ? ' fam' : ''}${x.on ? ' on' : ''}" style="left:${4 + (i % 2) * 203}px;top:${Math.floor(i / 2) * 26}px"${a ? ` data-a="${esc(a)}"` : ''}${x.look ? ` data-look="${esc(x.look)}"` : ''}${k ? ` data-k="${k}"` : ''}${i === 0 && o.n1 ? ' data-n1' : ''}${x.n0 ? ' data-n0' : ''}${x.f ? ' data-f' : ''}>${x.pic ? `<i class="ab rwp">${x.pic}</i>` : ''}${x.seal ? AC.seal(4, 7, true) : ''}<b class="ab lb${x.gold || x.on ? ' g' : ''}" data-name="${esc(x.name)}" style="left:${x.pic ? 30 : x.seal ? 19 : 4}px;top:4px">${esc(fitName(x.name, x.pic ? 27 : x.seal ? 29 : 31))}</b><b class="ab lb d" style="left:${x.pic ? 30 : x.seal ? 19 : 4}px;top:14px">${x.sub || ''}</b></${tag}>`; }).join('') + (o.tail || '');
  return box(0, y, 413, h, 'wn') + lb(8, y + 6, head, 'g') + (headR ? lbr(405, y + 6, headR, 'd') : '') + `<div class="ab gsc bare" data-sk="${o.sk || 'rows'}" data-row="26" data-mx="${8 + labelW(head) + 6}" style="left:1px;top:${y + 17}px;width:411px;height:${hh}px"><div class="gin" style="height:${Math.max(hh, n * 26)}px">${body}${rows.length ? '' : `<b class="ab lb d" style="left:8px;top:6px">${o.none || 'NONE YET'}</b>`}</div></div>`;
}
// What the player holds, as rows: every charm, Gift and Masterwork by name, kind and family, a gold line on those of one
// family (the family of the Gift being weighed).
const heldRows = (r, fam = null, look = false, read = true) => relicList(r).map(id => ({ pic: medal(id, 24), name: RELICS[id].name, sub: kindWord(id) + (FAMILY_NAME[RELICS[id].family] ? ' · ' + esc(FAMILY_NAME[RELICS[id].family].toUpperCase()) : ''), gold: !!fam && RELICS[id].family === fam, ...(!read ? {} : look ? { look: 'r:' + id, a: 'nop' } : { a: 'read:r:' + id }) }));
// A run that carries no card yet, from row ya to row yb of the bottom frame: the player's record, and under it the Forger
// who goes down, with the rule and the power at the left and the starter kits, open or still to earn, at the right.
function beforeB(ya, yb, r) {
  const id = r && r.forger, f = id ? FORGERS[id] : null, y2 = ya + 96, H = yb - y2, h = H - 22, w = id && P.forgers.includes(id) ? forgerStats(P, id).wins : 0;
  const rec = [['RUNS', P.runs], ['CLEARS', P.clears], ['DUELS WON', P.duelWins], ['GUARDIANS BEATEN', P.bossWins], ['FORGERS', `${P.forgers.length} OF ${FORGER_IDS.length}`], ['MEMORIES', P.memories]];
  const kits = f ? (f.kits || []).slice(0, Math.max(0, Math.floor((H - 22) / 24))) : [];
  return box(0, ya, 413, 96, 'st') + lb(8, ya + 8, 'YOUR RECORD', 'g') + rec.map(([k, v], i) => lb(8 + (i % 2) * 206, ya + 26 + (i >> 1) * 22, k, 'g') + lbr(198 + (i % 2) * 206, ya + 26 + (i >> 1) * 22, v)).join('')
    + (H > 0 ? box(0, y2, 206, H, 'wn') + box(206, y2, 207, H, 'wn') : '')
    + (f && h >= 32 ? lb(8, y2 + 6, 'WHO GOES DOWN', 'g') + pagerB(2, y2 + 16, 202, h - h % 16 + 4, `<p class="d">${esc(f.name)}.</p><p>${esc(ruleText(f.rule))}</p><p class="d">${esc(f.power)}: ${esc(f.powerText)}</p>`, 'bar')
      + lb(214, y2 + 6, 'STARTER KITS', 'g') + lbr(405, y2 + 6, `${w} DUEL${w === 1 ? '' : 'S'} WON`, 'd') + kits.map((k, i) => { const ok = !i || w >= KIT_GOALS[i]; return lb(214, y2 + 22 + i * 24, fitName(k.name, 22), ok ? '' : 'd') + lbr(405, y2 + 22 + i * 24, ok ? 'OPEN' : `${Math.min(w, KIT_GOALS[i])}/${KIT_GOALS[i]}`, 'd') + gauge(214, y2 + 33 + i * 24, 191, ok ? 1 : w / KIT_GOALS[i], 'x'); }).join('')
      + (() => { let y = y2 + 28 + kits.length * 24, t = ''; // under the kits, where there is room: how they open, and the heat this descent carries
        if (yb - y >= 66) { t += lb(214, y, 'HOW THE KITS OPEN', 'g') + txb(214, y + 12, 190, 48, '<p class="d">Each duel this Forger wins counts toward the next kit.</p>'); y += 68; }
        const heat = HEAT_RULES.filter(x => x.n <= (r.heat || 0)).slice(-Math.max(0, Math.floor((yb - y - 18) / 12)));
        if (yb - y >= 30) t += lb(214, y, `HEAT ${r.heat || 0}`, 'g') + (heat.length ? (heat.length < (r.heat || 0) ? lbr(405, y, `THE LAST ${heat.length} OF ${r.heat}`, 'd') : '') + heat.map((x, i) => lb(214, y + 14 + i * 12, `${x.n}. ${fitName(x.name, 26)}`)).join('') : lb(214, y + 14, 'NONE: THE PYRAMID AS IT IS', 'd'));
        return t; })() : '');
}
// What the player holds and carries, from row y0 to row y1 of the bottom frame, with no part of it left bare: the relics
// as named rows, as many rows as are held (seven at the most, fourteen names; more are moved through, and say so), and under them the deck as a grid
// of whole cards in the rows that are left. o: fam (the family marked), look (the cursor reads a relic on the page),
// read (a card or relic can be asked into the window above), head, headR.
function holdDeckB(y0, y1, r, o = {}) {
  const held = relicList(r), list = o.rows || heldRows(r, o.fam || null, !!o.look, o.read !== false), n = Math.max(1, Math.ceil(list.length / 2)), H = y1 - y0, want = 20 + 26 * Math.min(n, 7);
  // Before the first kit there is no card to show: the rows keep their place and the record stands under them.
  if (!r.deck.length) { const rh = Math.min(H - 150, 20 + 26 * n); return rowsB(y0, rh, o.head || `YOU HOLD ${held.length}`, o.headR || '', list, { none: o.none || 'NO CHARM OR GIFT YET', sk: o.sk, walk: o.walk }) + beforeB(y0 + rh, y1, r); }
  // Nothing held yet: two lines say so, and the deck has the rows a list would have taken.
  if (!list.length) { let v0 = 4; while (v0 > 1 && H - 23 - 63 * v0 < 29) v0--; const g0 = 5 + 63 * v0, r0 = H - 18 - g0;
    return box(0, y0, 413, r0, 'wn') + lb(8, y0 + 6, o.head || 'YOU HOLD 0', 'g') + (o.headR ? lbr(405, y0 + 6, o.headR, 'd') : '') + lb(8, y0 + 17, o.none || 'NO CHARM OR GIFT YET', 'd')
      // in the rows a list would have taken: what the deck it would join is made of, by kind and by the monsters' Types
      + (() => { const per = Math.floor((r0 - 46) / 12); if (per < 1) return ''; const kinds = {}, types = {};
        for (const e of r.deck) { if (db.isMonster(e.id)) types[card(e.id).type] = (types[card(e.id).type] || 0) + 1; else { const k = String(roleOf(db, e.id)).toUpperCase(); kinds[k] = (kinds[k] || 0) + 1; } }
        const rows = [['MONSTERS', r.deck.filter(e => db.isMonster(e.id)).length], ...Object.entries(kinds).sort((p, q) => q[1] - p[1]), ...Object.entries(types).sort((p, q) => q[1] - p[1]).map(([k, n]) => [String(k).toUpperCase(), n])].slice(0, per * 3);
        return lb(8, y0 + 32, 'WHAT YOUR DECK IS MADE OF', 'g') + rows.map(([k, n], i) => lb(8 + (i % 3) * 134, y0 + 44 + (i / 3 | 0) * 12, k, i ? 'd' : '') + lbr(130 + (i % 3) * 134, y0 + 44 + (i / 3 | 0) * 12, n)).join(''); })()
      + box(0, y0 + r0, 413, 18, 'st dk') + lb(6, y0 + r0 + 5, o.deckHead || 'YOUR DECK, STRONGEST FIRST', 'g') + lbr(407, y0 + r0 + 5, `${r.deck.length} CARDS`)
      + gridB(r.deck, { y: y0 + r0 + 18, h: g0, verb: o.read === false || o.grid === false ? null : i => `read:d:${i}`, sk: 'held', walk: o.walk, n1: o.walk }); }
  let v = 4; while (v > 1 && H - 23 - 63 * v < want) v--;
  const gh = 5 + 63 * v, rh = H - 18 - gh, per = Math.floor((rh - 20) / 26), spare = per > n;
  return rowsB(y0, rh, o.head || `YOU HOLD ${held.length}`, o.headR || '', list, { none: o.none || 'NO CHARM OR GIFT YET', sk: o.sk, walk: o.walk })
    + (spare && !o.rows && o.read !== false && held.length ? lb(8, y0 + rh - 14, 'THE CURSOR ON ONE READS IT ABOVE', 'd') : '')
    + box(0, y0 + rh, 413, 18, 'st dk') + lb(6, y0 + rh + 5, o.deckHead || 'YOUR DECK, STRONGEST FIRST', 'g') + lbr(407, y0 + rh + 5, `${r.deck.length} CARDS`)
    + gridB(r.deck, { y: y0 + rh + 18, h: gh, verb: o.read === false || o.grid === false ? null : i => `read:d:${i}`, sk: 'held', walk: o.walk, n1: o.walk });
}
// A card at the size of its page, 104 x 152: its picture at 96, its numbers, its Attribute and Level.
function bigCard(inst, x, y, ea, ed) {
  const c = card(inst.id), mon = db.isMonster(c.id), up = inst.t ? 300 : 0; convertSheets(96);
  return `<div class="big" style="left:${x}px;top:${y}px"><i class="art" style="${cpic(c.id, 96)}"></i>${mon ? `<b class="n1">${ea ?? c.atk + up} / ${ed ?? c.def + up}</b>` : ''}<b class="n2">${mon ? esc(`${c.attr} · LV ${c.level}`) : esc(roleOf(db, c.id).toUpperCase())}</b></div>`;
}
// The open book on the top frame: the reading room behind it, its name at the left of its head and where it stands among
// the books at the right.
function bookTop(title, right, inner) {
  const bg = CART.has('room-archive-book-x') && D.cart && D.cart.title === 720 ? `<img class="ab" src="${cimg('room-archive-book-x')}" width="720" height="480" style="left:-40px;top:-60px" alt="">` : box(0, 0, 640, 360, 'st dk');
  return `<div class="ti">${bg}<div class="wn ab bk2" style="left:4px;top:4px;width:632px;height:352px">${lb(10, 8, title, 'g')}${right ? lbr(622, 8, right, 'd') : ''}${inner}</div></div>`;
}
// A short page of a book: the reading room shows, and the page is a window across its foot, as a room's words are. h: the
// window's height. A page that fills the frame (the deck, the rules, the options, a run's last page) uses bookTop.
function lectern(title, right, inner, h = 152) {
  const bg = CART.has('room-archive-book-x') && D.cart && D.cart.title === 720 ? `<img class="ab" src="${cimg('room-archive-book-x')}" width="720" height="480" style="left:-40px;top:${h > 160 ? -136 : -112}px" alt="">` : box(0, 0, 640, 360, 'st dk');
  return `<div class="ti">${bg}<div class="wn ab bk2" style="left:4px;top:${356 - h}px;width:632px;height:${h}px">${title ? lb(10, 8, title, 'g') : ''}${right ? lbr(622, 8, right, 'd') : ''}${inner}</div></div>`;
}
// The books a run carries (the deck, the relics, the rules, the options), turned with L1 and R1, their names along the
// foot of the bottom frame. Without a run there are the rules and the options.
const BOOKS = { deck: 'DECK', relics: 'RELICS', help: 'RULES', options: 'OPTIONS' };
const bookRing = () => G.run ? ['deck', 'relics', 'help', 'options'] : ['help', 'options'];
const bookOf = t => { const ring = bookRing(), i = ring.indexOf(t); return i < 0 ? '' : `BOOK ${i + 1} OF ${ring.length}`; };
function bookFoot(t, first = [], held = false) {
  const ring = bookRing(), i = ring.indexOf(t), turn = d => 'tab:' + ring[(i + d + ring.length) % ring.length];
  const cells = [...first, held ? { k: 'B', t: 'PUT BACK', a: 'unpick' } : { k: 'B', t: 'CLOSE', a: 'tab:' }, ...(i >= 0 && ring.length > 1 ? [{ k: 'L1', t: 'LAST BOOK', a: turn(-1) }, { k: 'R1', t: 'NEXT BOOK', a: turn(1) }] : [])];
  { const at = cells.findIndex(c => c && c.k === 'L1'); if (at % 4 === 3) cells.splice(at, 0, null); } // the one before and the next one share a row
  while (cells.length % 4) cells.push(null);
  return [...cells, ...ring.map(b => ({ t: BOOKS[b], a: 'tab:' + b, cls: b === t ? 'on' : '' }))];
}

// ---- windows over a console screen
// The story paintings: the opening scene has one for each of its three lines; a guardian's memory and beating The Last One
// use theirs once they are in the art folder. A scene with a painting shows it above the words in place of the portrait.
const STORY_PIC = { intro: ['story-city', 'story-vessa', 'story-oren'], cleared: 'story-forge', fell: 'story-lamp', left: 'story-lamp', 'secret:won': 'story-last' };
const storyPic = (id, i) => { const p = STORY_PIC[id] || (id.startsWith('memory:') ? 'story-memory-' + id.slice(7).replace(/_/g, '-') : null), n = Array.isArray(p) ? p[Math.min(i, p.length - 1)] : p; return n && CART.has(n) ? n : null; };
// The end of a duel, over the board it ended on: what happened is read in a list that scrolls (and says so when it
// holds more than it shows), CONTINUE under it.
function endWindow(o) {
  const s = o.sum, head = `${o.rival ? o.rival.name : ''}, ${s.turns} turns${s.reason === 'deckout' ? ', a deck ran out' : ''}.`;
  const paras = s.won ? [head, `Embers +${s.embers}${s.bountyMet ? '. Bounty met.' : '.'}`] : [head, `You lose a Spark. ${G.run.sparks} left.`, ...(o.why || []).slice(0, 2)];
  // rows earned in this duel that a frame this short had no room to pop up: a gold line each, under RANK (or after the words)
  const ach = (o.ach || []).filter(id => ACH_BY_ID[id]).map(id => `<b class="lb g">${esc(`${AC.toastHead(ACH_BY_ID[id])} · ${ACH_BY_ID[id].name} · +${AC.PTS(ACH_BY_ID[id].tier)}`)}</b>`);
  // the window keeps the size it has without them (its list scrolls, and says so), so it never grows onto the text bar
  const base = paras.reduce((n, t) => n + Math.ceil(t.length / 36), s.won ? 1 : 0) * 16 + (paras.length - (s.won ? 0 : 1)) * 16, more = base + ach.length * 16 > (ach.length ? Math.min(142, base) : 142); // the text face is 8 pixels a letter: some 36 to a line here, a blank line between paragraphs
  const body = s.won ? `<p>${esc(head)}</p><p><b class="lb g">RANK ${esc(s.rank.rank)} · ${s.rank.points} POINTS · ${s.rank.style === 'craft' ? 'CRAFT' : 'FURY'}</b>${ach.map(t => '<br>' + t).join('')}</p><p>${esc(paras[1])}</p>` : paras.map((t, i) => `<p${i > 1 ? ' class="d"' : ''}>${esc(t)}</p>`).join('') + (ach.length ? `<p>${ach.join('<br>')}</p>` : '');
  return win(96, 8, 320, 224, `<div style="display:flex;justify-content:center;margin:0 0 4px${endPad(s.won ? 'VICTORY' : 'DEFEAT')}">${carveImg(s.won ? 'VICTORY' : 'DEFEAT', 24, render)}</div><div class="sc" style="height:${ach.length ? Math.min(142, base) : 142}px">${body}</div>${more ? lb(8, 202, 'MORE BELOW, SCROLL', 'g') : ''}${pq(216, 198, 88, 'CONTINUE', 'closeov', { lit: true })}`);
}
// How a duel works, a page at a time: each page's name (the two-screen layout lists them) and its words.
const helpPages = () => [['THE TURN', `Each turn: draw toward five cards (two a turn at most), play one card or one meld, then attack.`], ['MELDING', `Meld: tap two or more hand cards in order. They combine left to right into one monster. Tap one of your table monsters first to meld onto it.`], ['PRINTED NUMBERS', `Monsters fight with their printed ATK and DEF. Effects printed on a card are not used in Lost Memories.`], ['POSITIONS', `Attack position fights with ATK. Defense uses DEF and protects your Life Points. Veiled is face down in defense.`], ['THE WHEEL', `WATER beats FIRE beats WIND beats EARTH beats WATER. LIGHT and DARK beat each other when attacking. The edge is +500 for that battle.`], ['SUPPORT CARDS', `Field Spells set the terrain (+500 for its Types). ${db.config.equipKinds ? 'Equips made for a Type or Attribute give +800 to that kind and +300 to any other.' : 'Equips give +500.'} Traps wait face down for an attack. Other cards are fuel: +300 in a meld.`], ['ORDER OF PLAY', `Play comes before attacks. A monster that attacked or just arrived cannot change position.`], ['SPARKS AND SEALS', `Lose a duel and you lose a Spark. The guardian's door needs two seals, one from each duel you win on the floor.`]];
function psWindows() {
  const r = G.run;
  if (G.story && !G.playing && !G.overlay) { const st = G.story, sc = SCENES[st.id], sp = storyPic(st.id, st.i), fc = !sp && sc.face && CART.has(sc.face + '-96') ? sc.face + '-96' : null;
    const big = sp && F.W - 192 >= 398 && F.H - 104 >= 168 && CART.has(sp + '-l'), pw = big ? 390 : 312, ph = big ? 160 : 128;
    const pic = sp ? `<img class="ab spic" src="${cimg(big ? sp + '-l' : sp)}" style="left:${(F.W - pw) >> 1}px;top:${Math.max(4, (F.H - 104 - ph) >> 1)}px" width="${pw}" height="${ph}" alt="">` : '';
    // Without a painting the screen stays under the words, dimmed, between black bars inside the view's border; a face stands
    // on the lower bar, just over its words, on the side away from the door just opened.
    const r0 = G.run, ds = r0 && r0.phase === 'chamber' && G.doorSel && r0.doors[G.doorSel.i] ? G.doorSel.i : -1, way = ds < 0 ? -1 : r0.doors.length === 1 ? 1 : r0.doors.length === 2 ? ds * 2 : ds;
    const face = fc ? `<div class="pf s96" style="left:${way === 0 ? F.W - 204 : 104}px;top:${Math.max(4, F.H - 208)}px"><img src="${cimg(fc)}" width="96" height="96" alt=""></div>` : '';
    return `<div class="story${sp ? ' sblk' : ''}" data-a="storynext"><div class="dim"></div>${sp ? pic : `<i class="bars" style="top:4px;width:${F.W - 200}px"></i><i class="bars" style="top:${F.H - 128}px;width:${F.W - 200}px"></i>`}${face}
      <div class="wn ab" style="left:96px;top:${F.H - 104}px;width:${F.W - 192}px;height:104px;padding:6px 8px">${sc.who ? `<h2>${esc(sc.who)}</h2>` : ''}<p>${esc(sc.lines[st.i])}</p>${lb(8, 90, 'TAP TO GO ON', 'd')}${pq(F.W - 192 - 72, 82, 64, 'SKIP', 'storyskip')}</div></div>`; } // SKIP sits in the window, clear of the pillar's own plaques
  // A new floor gets its card once, when a move took this run down to it (act arms it; a reload does not show it again).
  const fc = G.floorCard; if (fc && r && fc.u === uidOf(r) && fc.n === r.floor + 1 && r.phase === 'chamber' && !G.playing && !G.overlay) { const big = F.W - 192 >= 398 && F.H >= 300 && CART.has('story-stair-l'), pw = big ? 390 : 312, ph = big ? 160 : 128, y = Math.max(28, (F.H - ph - 40) >> 1);
    const name = ['', 'FLOOR ONE', 'FLOOR TWO', 'FLOOR THREE'][fc.n] || 'FLOOR ' + fc.n, ct = carve(name, 24, render); // the carved name at a whole pixel, centred
    const title = ct ? `<img class="ab" src="${ct.url}" width="${ct.w}" height="${ct.h}" style="left:${(F.W - ct.w) >> 1}px;top:${y - 28}px" alt="${esc(name)}">` : `<div class="ab" style="left:0;top:${y - 28}px;width:${F.W}px;text-align:center">${carveImg(name, 24, render)}</div>`;
    return `<div class="story sblk" data-a="floorok"><div class="dim"></div>${title}${CART.has('story-stair') ? `<img class="ab spic" src="${cimg(big ? 'story-stair-l' : 'story-stair')}" style="left:${(F.W - pw) >> 1}px;top:${y}px" width="${pw}" height="${ph}" alt="">` : ''}${lb((F.W >> 1) - 36, y + ph + 8, 'TAP TO GO ON', 'd')}</div>`; }
  const o = G.overlay;
  if (o && !G.playing) {
    if (o.kind === 'duelEnd') return endWindow(o);
    if (o.kind === 'leave') { const run = o.saved || G.run, w = worth(run), S = run.stats;
      return win(96, 24, 320, 192, `<h2>${o.saved ? 'You have a run in progress' : 'Leave the pyramid?'}</h2><p>${o.saved ? `${esc(run.forger ? FORGERS[run.forger].name : 'No Forger')}, Floor ${run.floor + 1}, Chamber ${Math.min(6, run.chamber + 1)}. Starting a new run ends that one.` : 'Leaving ends this run as a loss.'}</p><p>You keep ${w.total} Memories, ${S.wins} duel${S.wins === 1 ? '' : 's'} won and your feat progress.</p>${o.saved ? pq(8, 166, 96, 'CONTINUE IT', 'resume', { lit: true }) + pq(110, 166, 96, 'BANK IT, NEW', 'bankold') + pq(212, 166, 96, 'BACK', 'closeov') : pq(8, 166, 140, 'KEEP PLAYING', 'closeov', { lit: true }) + pq(160, 166, 148, 'LEAVE AND BANK IT', 'abandon')}`); }
    if (o.kind === 'heat') return win(96, 8, 320, 224, `<h2>Heat ${o.n}</h2><div class="sc" style="height:168px">${HEAT_RULES.filter(x => x.n <= o.n).map(x => `<p><b class="lb g">${x.n}. ${esc(x.name)}</b><br>${esc(x.text)}</p>`).join('')}</div>${pq(220, 196, 88, 'CLOSE', 'closeov', { lit: true })}`);
    if (o.kind === 'moved') return win(96, 40, 320, 160, `<h2>This run moved on</h2><p>The run was ended or carried on in another tab or window. Nothing was changed from here.</p>${pq(160, 130, 148, 'BACK TO THE START', 'leavetab', { lit: true })}`);
  }
  if (G.inspect) { const c = card(G.inspect.id), mon = db.isMonster(c.id); convertSheets(96);
    return `<div class="dim" data-a="closeinspect"></div><div class="wn mw" data-a="closeinspect" style="left:${72 + cx0()}px;top:${16 + cy0()}px;width:368px;height:208px"><div class="big" style="left:8px;top:8px"><i class="art" style="${cpic(c.id, 96)}"></i>${mon ? `<b class="n1">${G.inspect.ea ?? c.atk} / ${G.inspect.ed ?? c.def}</b>` : ''}<b class="n2">${mon ? esc(`${c.attr} · LV ${c.level}`) : esc(roleOf(db, c.id).toUpperCase())}</b></div>
      <div class="ab sc" style="left:122px;top:8px;width:238px;height:170px"><h2>${esc(c.name)}</h2>${mon ? `<p class="d">${esc(c.type)}. Printed ${c.atk} / ${c.def}.</p>` : ''}<p>${esc(rulesText(c.id))}</p>${G.inspect.e ? `<p>${CART.has('enchant-' + G.inspect.e + '-32') ? `<img src="${cimg('enchant-' + G.inspect.e + '-32')}" width="32" height="32" alt="" style="float:left;margin:0 4px 0 0">` : ''}<b class="lb g">ENCHANT ${esc(G.inspect.e.toUpperCase())}</b><br>${esc(ENCHANT_TEXT[G.inspect.e])}</p>` : ''}<p class="d">Weight ${weightOf(db, c.id)}.</p></div>${lb(250, 190, 'TAP TO CLOSE', 'd')}</div>`; }
  const t = G.tab; if (!t) return '';
  if (t === 'bar') return win(56, 40, 400, 160, `<div class="sc" style="height:116px"><p>${G.barText || ''}</p></div>${pq(304, 132, 88, 'CLOSE', 'tab:', { lit: true })}`);
  // A tall window (How to Play, Options, the relics, the doors, this duel): 480 wide in the middle, and as tall as the frame
  // less eight pixels above and below, so a taller frame shows more lines. Its pages scroll in a box that ends at least
  // eight pixels above the plaques along its foot (fitScroll trims it to whole lines and marks when more lies below).
  const tall = (title, body, foot = '') => { const h = F.H - 16; return `<div class="dim"></div><div class="wn mw" style="left:${16 + cx0()}px;top:8px;width:480px;height:${h}px"><h2>${title}</h2><div class="sc" style="height:${h - 56}px">${body}</div>${foot}${pq(384, h - 28, 88, 'CLOSE', 'tab:', { lit: true })}</div>`; };
  if (t === 'menu') { const duel = r && (r.phase === 'duel' || G.shown); const items = [['DECK', 'tab:deck'], ['RELICS', 'tab:relics'], duel && ['THIS DUEL', 'tab:duel'], duel && [G.fast ? 'SPEED: FAST' : 'SPEED: NORMAL', 'speed'], !duel && r && ['ALL DOORS', 'tab:doors'], ['HOW TO PLAY', 'tab:help'], ['OPTIONS', 'tab:options'], r && ['LEAVE THE RUN', 'quit']].filter(Boolean);
    return win(176, 16, 160, 28 + items.length * 20 + 24, `<h2>Menu</h2>${items.map(([l, a], i) => pq(8, 22 + i * 20, 144, l, a)).join('')}${pq(8, 26 + items.length * 20, 144, 'CLOSE', 'tab:', { lit: true })}`); }
  if (t === 'help') return tall('How a duel works', helpPages().map(x => `<p>${x[1]}</p>`).join(''), pq(8, F.H - 44, 160, 'SHOW FIRST LESSONS', 'relearn'));
  if (t === 'sound') return win(96, 24, 320, 192, `<h2>Sound</h2><div id="soundslot" class="soundslot sc" style="height:132px"></div>${pq(224, 164, 88, 'CLOSE', 'tab:', { lit: true })}`); // CLOSE inside this narrower window, at its right
  if (t === 'options') return tall('Options', `<h3>SOUND</h3><div id="soundslot" class="soundslot"></div><h3>LOOK</h3><button class="lab" data-a="look"><i>NEW</i><span>The console look. Tap for the old look, to compare.</span></button><h3>LAB SWITCHES <small class="d">EXPERIMENTS. A RUN IN PROGRESS KEEPS THE RULES IT STARTED WITH.</small></h3>${labKeys().map(k => { const held = pref.depth && DEPTH_SET.includes(k); return `<button class="lab ${pref[k] || held ? 'on' : ''}" data-a="lab:${k}"><i>${pref[k] || held ? 'ON' : 'OFF'}</i><span>${esc(LABS[k])}${held && !pref[k] ? ' (On through the depth set.)' : ''}</span></button>`; }).join('')}`);
  if (!r) return '';
  if (t === 'relics') return tall('Your relics', `${relicList(r).map(id => `<div class="rl">${CART.has(relicFile(id)) ? `<img src="${cimg(relicFile(id))}" alt="">` : `<i class="gem">${esc(RELICS[id].name.replace(/^The /, '')[0])}</i>`}<div><b>${esc(RELICS[id].name)}</b>${esc(RELICS[id].text)}</div></div>`).join('') || '<p>None yet.</p>'}${possibleMasterworks(r).map(id => `<p class="d">Masterwork ready at an Anvil: ${esc(RELICS[id].name)}.</p>`).join('')}`);
  if (t === 'doors' && r.doors) return tall('The doors', `${r.doors.map((d, i) => `<p><b class="lb g">${i + 1}. ${esc(doorName(d))}</b> <small class="d">${d.know === 'known' ? 'KNOWN' : d.know === 'partial' ? 'PARTLY HIDDEN' : 'IN FOG'}</small><br>Cost: ${esc(stop(d.cost))} Reward: ${esc(stop(d.reward))}${d.law ? ' Law: ' + esc(lawShown(d.law)) : ''}${d.tell ? ` ${esc(d.style)}: ${esc(d.tell)}` : ''}${(d.tags || []).length ? ' ' + esc(d.tags.join(', ')) + '.' : ''}</p>`).join('')}`);
  if (t === 'duel') { const rv = G.shown ? G.shown.rival : info(r), v = r.duel ? viewFor(r.duel, db, 0) : null;
    return tall('This duel', `${rv.styleText ? `<p>${esc(rv.styleText)}</p>` : ''}${rv.lawText ? `<p><b class="lb g">LAW</b> ${esc(lawShown(rv.lawText))}</p>` : ''}${rv.twist ? `<p>${{ fog: 'Fog: monsters arrive veiled.', narrow: 'Narrow Pass: three zones.', storm: 'Storm Front: terrain shifts every third turn.', locked: 'Locked terrain.' }[rv.twist]}</p>` : ''}<p><b class="lb g">BOUNTY</b> ${esc(rv.bountyText || '')}</p>${v && v.forger ? `<p><b class="lb g">${esc(FORGERS[v.forger].name)}</b> ${esc(ruleText(FORGERS[v.forger].rule))}</p><p><b class="lb g">${esc(FORGERS[v.forger].power)}</b> ${v.rs.power ? 'Used this duel.' : esc(FORGERS[v.forger].powerText)}</p>` : ''}<p><b class="lb g">LOG</b><br>${G.log.slice(-8).map(esc).join('<br>')}</p>`); }
  // The deck and the trunk: rows of cards 64 pixels apart, the trunk's row led by a tile that names it, so every row of the
  // box is a whole row of cards wherever it rests (fitScroll closes the window up under the rows it shows).
  if (t === 'deck') { const list = (l, key, picked, k2) => l.map((e, i) => [e, i]).sort((a, b) => cardValue(db, b[0]) - cardValue(db, a[0])).map(([e, i]) => psCard(e, null, null, { cls: picked === i ? 'sel' : '', attrs: `data-a="${key}:${i}"` })).join('');
    const h = F.H - 8; return `<div class="dim"></div><div class="wn mw" style="left:${8 + cx0()}px;top:4px;width:496px;height:${h}px"><h2>Deck ${r.deck.length} · weight ${deckWeight(db, r.deck)}/${weightCap(db, r)}</h2><p class="d">${r.phase === 'chamber' ? 'Tap a deck card, then a trunk card, to swap them.' : 'You can swap cards in a chamber.'}</p><div class="sc" style="height:${h - 72}px"><div class="row2">${list(r.deck, 'deckpick', G.pickDeck)}</div><div class="row2" style="margin-top:4px"><i class="cd trk" style="position:relative"><b class="n1">TRUNK</b><b class="n3">${r.trunk.length || 'NONE'}</b></i>${list(r.trunk, 'trunkpick', G.pickTrunk)}</div></div>${pq(400, h - 24, 88, 'CLOSE', 'tab:', { lit: true })}</div>`; }
  return '';
}
// ---------- the two-screen layout: drawing, the cursor and the pad ----------
// Both frames are drawn again together: the screen's halves, or what a window puts in a half's place. Then the words
// that page are fitted, the grids are put back where they stood, and the cursor is shown.
function drawDual(screen) {
  app.classList.add('ps', 'dual'); app.classList.remove('phone', 'era'); document.body.classList.add('ps'); fitFrame(); setMats(); F.view = null;
  if (scrT.parentElement !== app || scrB.parentElement !== app) { app.innerHTML = ''; app.append(scrT, scrB); }
  const r = G.run, phase = r ? (G.shown || endShown() ? 'duel' : r.phase) : 'home';
  const sig = [G.screen || '', phase, G.tab || '', G.overlay && !G.playing ? G.overlay.kind : '', G.story && !G.playing && !G.overlay ? 'story' : '', G.forge ? 'forge' : ''].join('|');
  if (sig !== NAV.sig) { // another screen, or a window opened or shut: the cursor starts at that screen's own place, or goes back to where it was under the window
    const under = NAV.stack[NAV.stack.length - 1], win = !!(G.tab || (G.overlay && !G.playing) || G.story);
    if (under && under.sig === sig) { NAV.key = under.key; NAV.stack.pop(); } else { if (win) NAV.stack.push({ sig: NAV.sig, key: NAV.key }); else NAV.stack = []; NAV.key = null; }
    NAV.sig = sig; G.look = null; G.lookCur = false;
  }
  if (G.lookNext) { G.look = G.lookNext; G.lookNext = null; } // a place a screen was opened on (back from the achievements)
  if (G.inspect) { if (G.inspect.id != null) G.look = G.look && /^(h|z|t0|d|t):/.test(G.look) ? G.look : 'c:' + G.inspect.id; G.inspect = null; } // a card asked for is read where this layout reads cards, never in a window over a frame
  G.lookB = false;
  // Under a book or a sheet the screen is drawn as it stands by itself: what the book's cursor reads is the book's own.
  const lk = G.look, under = !!(G.tab || (G.overlay && !G.playing && G.overlay.kind !== 'duelEnd')); if (under) G.look = null;
  let s = screen(); if (under) { G.look = lk; G.lookB = false; } if (typeof s === 'string') s = two(s, box(0, 0, 413, 360, 'st dk')); // a screen not yet shared out between the frames stands on the top one
  const w = dualWindows(s) || {};
  const save = store.failed.size ? `<div class="savebar" style="left:0;width:640px"><b>NOT SAVED.</b> This device would not store your progress. <button class="pq" style="position:relative;display:inline-block" data-a="resave" data-nonav>TRY AGAIN</button></div>` : '';
  scrT.innerHTML = (w.top ?? s.top) + (w.over || '') + save + `<div id="toast" class="toast">${esc(G.toast)}</div>`;
  scrB.innerHTML = w.bottom ?? s.bottom;
  scrT.classList.toggle('held', !!(w.bottom && !w.top)); // a window on the bottom frame holds the top one still: nothing on it can be pressed until the window is shut
  app.dataset.phase = phase; app.dataset.room = '';
  const st = app.querySelector('.story'); app.classList.toggle('stup', !!st); app.classList.toggle('stblk', !!(st && st.classList.contains('sblk')));
  for (const a of app.getAnimations({ subtree: true })) if (a.playState === 'running' && a.effect && a.effect.getTiming().iterations === Infinity) a.startTime = 0;
  if (document.getElementById('prop')) { propTextures(); propPaint(); }
  if (document.getElementById('forge')) { propTextures(); convertSheets(40); forgePaint(); }
  if (document.getElementById('tbl')) { psTextures(); convertSheets(40); psPaint(true); psLoop(); } else convertSheets(40);
  { const slot = $('#soundslot'); if (slot && window.LMAudio && window.LMAudio.panel) { try { slot.appendChild(window.LMAudio.panel()); } catch (e) { slot.textContent = 'Sound is not available in this browser.'; } } }
  // the short message lies on the top frame's window of words, wherever this screen has it
  { const t = document.getElementById('toast'), b = scrT.querySelector('.bar'); if (t) Object.assign(t.style, b ? { left: b.offsetLeft + 'px', top: b.offsetTop + 'px', width: b.offsetWidth + 'px', height: b.offsetHeight + 'px' } : { left: '96px', top: '304px', width: '448px', height: '56px' }); }
  for (const b of app.querySelectorAll('.scr .pq.lit')) b.dataset.l0 = '1'; // the plaque each screen lights by itself: what A presses when the cursor says nothing else
  for (const g of app.querySelectorAll('.gsc')) { const at = NAV.sk[NAV.sig + g.dataset.sk]; if (at) g.scrollTop = at; }
  dualPagers(); navShow(); gridLines();
  // What the page reads goes where the cursor is: when the cursor's control went away (a card played, a plaque gone)
  // and the cursor waits on the screen's own place, or a move was undone, the page never stays on what the cursor left.
  // A card asked onto the page by a key (B puts it away) and a monster about to attack keep the page.
  if (!G.lookB && G.attacker == null && !drawDual.again) { const f = navEl(); if (f && f.dataset.look != null && f.dataset.look !== G.look) { G.look = f.dataset.look; drawDual.again = true; try { drawDual(screen); } finally { drawDual.again = false; } return; } }
  if (!drawDual.fonts && document.fonts) { drawDual.fonts = 1; const again = () => { if (app.classList.contains('ps')) { dualPagers(); gridLines(); } }; pixelText(); document.fonts.ready.then(again); if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', again); }
  achPaint(); fit();
}
// Words that page: a box of whole lines, as many as its window has room for under what stands above it. While more lies
// below, the window shows its marker and a tap pages on; L2 and R2 (or the right stick) page both ways.
function dualPagers() {
  [...app.querySelectorAll('.scr [data-pager]')].forEach((p, i) => { const par = p.parentElement;
    const fitH = () => { const room = par.clientHeight - p.offsetTop - (parseInt(p.dataset.foot) || 4); p.style.height = Math.max(16, room - room % 16) + 'px'; };
    par.classList.remove('more'); fitH();
    const over = p.scrollHeight > p.clientHeight + 8; if (over) { par.classList.add('more'); fitH(); par.dataset.a = 'pagetext'; }
    const m = NAV.pg[i]; if (m && m.sig === p.textContent) p.scrollTop = m.top; else NAV.pg[i] = { sig: p.textContent, top: 0 };
    par.classList.toggle('more', over && p.scrollTop + p.clientHeight < p.scrollHeight - 8); });
}
// Whether some window of words has a page more that way.
const textPages = d => [...app.querySelectorAll('.scr [data-pager]')].some(p => p.scrollHeight > p.clientHeight + 8 && (d > 0 ? p.scrollTop + p.clientHeight < p.scrollHeight - 8 : p.scrollTop > 0));
function pageText(d, wrap = false, from = null) {
  const ps = [...app.querySelectorAll('.scr [data-pager]')], more = p => p.scrollHeight > p.clientHeight + 8;
  const p = (from && ps.find(x => x.parentElement === from)) || ps.find(x => more(x) && x.closest('.scrB')) || ps.find(more) || ps[0]; if (!p) return;
  const step = Math.max(16, p.clientHeight - 16), max = Math.max(0, Math.ceil((p.scrollHeight - 8 - p.clientHeight) / 16) * 16); // the face's letters hang a few pixels under their last line: that is not a line more
  let t = p.scrollTop + d * step; if (wrap && p.scrollTop >= max - 2) t = 0;
  t = Math.max(0, Math.min(max, t)); t -= t % 16; p.scrollTop = t;
  NAV.pg[ps.indexOf(p)] = { sig: p.textContent, top: t }; p.parentElement.classList.toggle('more', t + p.clientHeight < p.scrollHeight - 8);
}
// ---- the cursor: one cursor walks every control of both frames (DUAL.md). On a plaque it is the hammer; on a card, a
// monster, a relic or a row it is the marker over it. NAV.key names the control it is on; a screen drawn again finds the
// control by that name, and while it is not there (a move playing out) the cursor waits on the screen's own plaque.
const NAV = { key: null, sig: '', stack: [], sk: {}, pg: [] };
const navList = () => { const items = navItems(app), keys = navKeys(items); return { items, keys }; };
function navEl() {
  const { items, keys } = navList(); let i = keys.indexOf(NAV.key); NAV.fell = false;
  // a choice the screen itself holds chosen (a door, a plinth, a row) wins over an older place among the choices
  const own = items.find(e => e.hasAttribute('data-n0'));
  if (own && (i < 0 || (items[i].hasAttribute('data-f') && items[i] !== own))) { if (i >= 0 || NAV.key == null) NAV.key = keys[items.indexOf(own)]; return own; }
  if (i >= 0) return items[i];
  NAV.fell = true;
  // Nowhere yet: the place the screen names (data-n1), else its own lit plaque unless that one goes back or ends something
  // (a plaque with a key of its own), else the first card or row, so a stray A never leaves a room or ends a turn.
  const keyed = e => { const c = e.previousElementSibling; return !!(c && c.classList.contains('kc') && c.dataset.key); };
  return items.find(e => e.hasAttribute('data-n1')) || items.find(e => e.dataset.l0 && !keyed(e)) || items.find(e => !e.classList.contains('pq') && !e.classList.contains('sl') && e.type !== 'range' && e.closest('.scrB')) || items.find(e => !e.classList.contains('pq') && !e.classList.contains('sl'))
    || items.find(e => e.classList.contains('pq') && !keyed(e)) || items.find(e => e.dataset.l0) || items[0] || null;
}
// What A presses: the control under the cursor; on a card already chosen, the plaque the screen lights (so A chooses a
// card and A again plays it).
function aTarget(f) {
  const d = app.querySelector('.scr .pq[data-l0]:not(:disabled)');
  if (!f) return d;
  // a control that says itself what A does on it (data-act): nothing, the lit plaque, or a step of the cursor
  if (f.dataset.act != null) return f.dataset.act === 'plaque' ? d : f.dataset.act ? f : null;
  if (f.classList.contains('cd') && (f.classList.contains('sel') || f.classList.contains('sel2')) && d) return d;
  return f;
}
// The plaque that stands for what A does now: the plaque itself, or the one with the same verb as the control under the
// cursor (ENTER for the chosen door, TAKE for the chosen plinth), or the one that says it acts on such a control.
function aPlaque(t) {
  if (!t) return null; if (t.classList.contains('pq')) return t;
  const a = t.dataset.a || ''; if (!a || t.getAttribute('aria-disabled') === 'true') return null;
  return [...app.querySelectorAll('.scr .pq:not(:disabled)')].find(p => p.dataset.a === a || (p.dataset.for && p.dataset.for.split(' ').some(v => a.startsWith(v + ':')))) || null;
}
// What A does to the control under the cursor when no plaque stands for it, in a plaque's words (longest first). A card
// that is only read where the cursor already reads it, and a row that only marks a place, give nothing: A does nothing
// new there, and no plaque may say otherwise.
function aWords(f) {
  if (f.getAttribute('aria-disabled') === 'true') return null;
  if (f.dataset.act != null) return /^to:/.test(f.dataset.act) ? ['PICK TARGET', 'TARGET'] : null;
  if (f.dataset.said || (f.dataset.look == null && lookAt(f) != null && lookAt(f) === G.look)) return null; // the window says it, or already reads the thing
  const a = (f.dataset.a || '').split(':')[0], sel = !!app.querySelector('.scr .hand .cd.sel, .scr [data-hl="onto"]');
  if (a === 'hand' && f.classList.contains('sel')) return ['PUT IT BACK', 'PUT BACK'];
  return { hand: sel ? ['ADD TO MELD', 'ADD'] : ['CHOOSE CARD', 'CHOOSE'], mine: ['CHOOSE MONSTER', 'CHOOSE'], hit: ['ATTACK IT', 'ATTACK'], aim: ['AIM AT IT', 'AIM'], read: ['READ IT ABOVE', 'READ IT', 'READ'], tab: ['OPEN THE BOOK', 'OPEN'],
    deckpick: ['CHOOSE CARD', 'CHOOSE'], trunkpick: ['CHOOSE CARD', 'CHOOSE'], anvilpick: ['CHOOSE CARD', 'CHOOSE'], lab: ['SWITCH IT', 'SWITCH'], cxopen: ['OPEN THE PAGE', 'OPEN PAGE', 'OPEN'] }[a] || null;
}
// The plaque that says it: the screen's own place for it (the first place of a duel's foot, of the Codex, of the
// options), else (for a pad; a finger has pressed the thing itself) a dark plaque with room for the A chip at its left.
// A plaque that can be pressed now never gives its place: no command is ever hidden by these words. The dark one is
// given back its own words as soon as the cursor moves on.
function aPress(f) {
  const t = aTarget(f); if (!t || t.getAttribute('aria-disabled') === 'true' || t.disabled) return;
  if (t === f && /^to:/.test(f.dataset.act || '')) { const e = navList().items.find(x => x.dataset.k === f.dataset.act.slice(3)); if (e) navTo(e); return; }
  t.click();
}
function aSlot() {
  const free = p => { const c = p.previousElementSibling; return !!(c && c.classList.contains('kc') && !c.dataset.key); };
  return app.querySelector('.scr:not(.held) .pq.aslot') || (NAV.pad === false ? null : [...app.querySelectorAll('.scr:not(.held) .pq:disabled')].find(free) || null);
}
// The cursor is shown: the lit plaque with the hammer, and the A chip on whatever plaque A presses now (beside it where
// it has a chip's room, else at its right end inside it); on a card the card's own frame turns light, on a relic or a
// row its border does; and the marker stands over a card only where the marker's nine by six pixels cover nothing.
function navShow() {
  for (const e of app.querySelectorAll('.scr .kin')) e.remove();
  for (const e of app.querySelectorAll('.scr .pq[data-t0]')) { e.textContent = e.dataset.t0; e.dataset.a = e.dataset.a0; e.disabled = e.dataset.d0 === '1'; delete e.dataset.t0; delete e.dataset.a0; delete e.dataset.d0; }
  const f = navEl(); let p = aPlaque(aTarget(f));
  if (!p && f && !f.classList.contains('pq')) { const ws = aWords(f), slot = ws && aSlot(), t = slot && ws.find(w => pqW(w) <= slot.offsetWidth);
    if (t) { slot.dataset.t0 = slot.textContent; slot.dataset.a0 = slot.dataset.a || ''; slot.dataset.d0 = slot.disabled ? '1' : ''; slot.textContent = t; slot.dataset.a = 'acur'; slot.disabled = false; p = slot; } }
  for (const e of app.querySelectorAll('.scr .pq.ah')) e.classList.remove('ah');
  for (const e of app.querySelectorAll('.scr .pq.lit')) if (e !== p) e.classList.remove('lit', 'nh');
  if (p) p.classList.add('lit');
  for (const e of app.querySelectorAll('.scr .kc.ka')) { e.classList.remove('ka'); e.classList.add('kce'); e.classList.toggle('kco', !!e.dataset.o); e.textContent = ''; }
  if (p) { const c = p.previousElementSibling;
    if (c && c.classList.contains('kc') && !c.dataset.key) { if (c.classList.contains('kco')) c.dataset.o = '1'; c.textContent = 'A'; c.classList.add('ka'); c.classList.remove('kce', 'kco'); }
    else if (!(c && c.classList.contains('kc'))) { const wide = p.offsetWidth >= labelW(p.textContent) + 34; p.classList.toggle('ah', !wide); p.insertAdjacentHTML('beforeend', `<i class="kc ka kin${wide ? '' : ' kl'}">A</i>`); } } // a plaque with no room for the chip at its right end shows it where the hammer stands
  for (const e of app.querySelectorAll('.nvf')) e.classList.remove('nvf'); for (const e of app.querySelectorAll('.dcur')) e.remove();
  listMarks();
  if (!f || f.classList.contains('pq')) return;
  const g = f.closest('.gsc'); if (g) { const row = +g.dataset.row, top = f.offsetTop - f.offsetTop % row, vis = Math.floor(g.clientHeight / row); if (top < g.scrollTop) g.scrollTop = top; else if (top + row > g.scrollTop + g.clientHeight) g.scrollTop = top - (vis - 1) * row; listMarks(); }
  f.classList.add('nvf');
  if (f.hasAttribute('data-f') || f.classList.contains('rw') || g) return; // a choice draws its own cursor; a row is ringed; a card of a grid has no room over it
  const m = document.createElement('i'); m.className = 'cur dcur'; m.style.left = (f.offsetLeft + (f.offsetWidth >> 1) - 4) + 'px'; m.style.top = (f.offsetTop - 9) + 'px'; (f.offsetParent || f.parentElement).appendChild(m);
  // the marker stays only where it lies on nothing: no card, plaque, chip, relic, picture or line of words under it
  const q = m.getBoundingClientRect(), hit = r => r.width > 0 && r.height > 0 && r.left < q.right - .5 && r.right > q.left + .5 && r.top < q.bottom - .5 && r.bottom > q.top + .5;
  const scr = f.closest('.scr'), solid = [...scr.querySelectorAll('.cd, .pq, .kc, .sl, .rw, .lb, .pf, .big, .ga, img:not([data-pic="hall"])')].some(e => e !== m && !e.contains(m) && getComputedStyle(e).visibility !== 'hidden' && hit(e.getBoundingClientRect()));
  const words = () => { const w = document.createTreeWalker(scr, NodeFilter.SHOW_TEXT), rg = document.createRange(); for (let n = w.nextNode(); n; n = w.nextNode()) { if (!n.nodeValue.trim()) continue; rg.selectNodeContents(n); if ([...rg.getClientRects()].some(hit)) return true; } return false; };
  const sb = scr.getBoundingClientRect(), inside = q.left >= sb.left - .5 && q.top >= sb.top - .5 && q.right <= sb.right + .5 && q.bottom <= sb.bottom + .5; // and only whole, inside its frame
  if (!inside || solid || words()) m.remove();
}
// A list that holds more rows than it shows says so: a small gold marker pointing down while rows lie below, and one
// pointing up while rows lie above. On a grid of cards the markers stand in the margin at its left, where no card
// reaches; on a list of named rows, after its heading. The d-pad walks the list, L2 and R2 page it, a finger drags it.
function listMarks() {
  for (const e of app.querySelectorAll('.scr .lmk')) e.remove();
  for (const g of app.querySelectorAll('.scr .gsc')) { const max = g.scrollHeight - g.clientHeight; if (max < 8) continue;
    const up = g.scrollTop > 2, dn = g.scrollTop < max - 2, bare = g.classList.contains('bare'), par = g.parentElement;
    const mk = (cls, x, y) => { const m = document.createElement('i'); m.className = 'lmk' + cls; m.style.left = x + 'px'; m.style.top = y + 'px'; par.appendChild(m); };
    if (bare) { const x = +g.dataset.mx || 8; if (dn) mk('', x, g.offsetTop - 9); if (up) mk(' lmu', x + 8, g.offsetTop - 9); }
    else { if (dn) mk('', g.offsetLeft + 3, g.offsetTop + g.offsetHeight - 6); if (up) mk(' lmu', g.offsetLeft + 3, g.offsetTop + 3); } }
}
// L2 and R2 on a list: a page of whole rows up or down. The list the cursor is in takes the cursor with it, to the
// control as many rows on in the same column; another list only moves. Gives back whether a list moved.
function pageList(d) {
  const f = navEl(), over = g => g.scrollHeight - g.clientHeight >= 8, can = g => over(g) && (d > 0 ? g.scrollTop < g.scrollHeight - g.clientHeight - 2 : g.scrollTop > 2);
  const own = f && f.closest('.gsc'), gs = [...app.querySelectorAll('.scr:not(.held) .gsc')], g = own && can(own) ? own : (d > 0 ? gs : gs.reverse()).find(can); if (!g) return false;
  const row = +g.dataset.row, vis = Math.max(1, Math.floor(g.clientHeight / row)), top = Math.max(0, Math.min(g.scrollHeight - g.clientHeight, g.scrollTop + d * vis * row));
  g.scrollTop = top - top % row; NAV.sk[NAV.sig + g.dataset.sk] = g.scrollTop;
  if (g === own) { const { items } = navList(), col = items.filter(e => e.closest('.gsc') === g && e.offsetLeft === f.offsetLeft), want = f.offsetTop + d * vis * row;
    const nx = col.reduce((b, e) => !b || Math.abs(e.offsetTop - want) < Math.abs(b.offsetTop - want) ? e : b, null); if (nx && nx !== f) { navTo(nx); return true; } }
  listMarks(); return true;
}
// From the hand to your row to the rival's row and round again (L1 and R1 in a duel).
function rowJump(d) {
  const f = navEl(), { items } = navList(), gs = ['hand', 'row0', 'row1'].filter(g => items.some(e => e.dataset.g === g)); if (!gs.length || (gs.length < 2 && f && f.dataset.g)) return;
  const at = f ? gs.indexOf(f.dataset.g) : -1, g = gs[(at + d + gs.length * 2 + (at < 0 && d < 0 ? 1 : 0)) % gs.length], e = items.find(x => x.dataset.g === g); if (e && e !== f) navTo(e);
}
// What a control gives the window to read while the cursor rests on it: its own (data-look), or, for a card, a relic or
// a row that a finger taps to read (read:...), that same thing. So in a room the window above reads whatever the cursor
// is on and goes back to the room's own words when the cursor leaves, and no plaque has to give its place to READ IT.
const lookAt = e => e.dataset.look != null ? e.dataset.look : !e.classList.contains('pq') && /^read:/.test(e.dataset.a || '') ? e.dataset.a.slice(5) : null;
function navTo(e) {
  const { items, keys } = navList(), i = items.indexOf(e); if (i < 0) return;
  NAV.key = keys[i]; cue('ui:move', {}, e);
  if (e.hasAttribute('data-f') && !e.hasAttribute('data-n0')) { G.look = null; e.click(); return; } // the cursor on a choice chooses it
  const lk = lookAt(e);
  if (lk != null && lk !== G.look) { G.look = lk; G.lookCur = e.dataset.look == null || e.classList.contains('pq'); render(); return; }
  if (lk == null && G.lookCur && G.look) { G.look = null; G.lookCur = false; render(); return; } // the cursor left what it was reading
  navShow();
}
// Every control against every other, by the d-pad's own steps: which controls cannot be reached from where the cursor
// stands, and from which the cursor could not come back (DUAL.md; the checks ask this of every screen).
function navWalk() {
  const { items, keys } = navList(), at = items.indexOf(navEl()); if (at < 0) return { n: items.length, at: null, lost: keys, trapped: [] };
  // every list is measured at its top: a row moved out of sight is reached through its list, which the cursor moves
  const lists = [...app.querySelectorAll('.scr .gsc')].map(g => [g, g.scrollTop]); for (const [g] of lists) g.scrollTop = 0;
  const next = items.map(e => ['up', 'down', 'left', 'right'].map(d => items.indexOf(navStep(app, items, e, d))).filter(i => i >= 0));
  for (const [g, t] of lists) g.scrollTop = t;
  const reach = (from, edges) => { const seen = new Set([from]), q = [from]; while (q.length) for (const j of edges[q.pop()]) if (!seen.has(j)) { seen.add(j); q.push(j); } return seen; };
  const back = items.map(() => []); next.forEach((l, i) => l.forEach(j => back[j].push(i)));
  const out = reach(at, next), home = reach(at, back);
  return { n: items.length, at: keys[at], lost: keys.filter((k, i) => !out.has(i)), trapped: keys.filter((k, i) => out.has(i) && !home.has(i)) };
}
// A pad key, by its name: up, down, left, right, A, B, X, Y, L1, R1, L2, R2, START. The keys other than A and the
// directions press the plaque whose chip shows them, so a key does only what a plaque on the screen says it does.
function padPress(k) {
  if (!DUAL || !app.classList.contains('ps') || booting || G.opening) return;
  const was = NAV.pad; NAV.pad = true; NAV.inPad = true;
  try {
    if (was === false) navShow();
    const f = navEl();
    if (/^(up|down|left|right)$/.test(k)) { NAV.sure = null;
      if (f && f.type === 'range' && (k === 'left' || k === 'right')) { f.value = String(Math.max(+f.min, Math.min(+f.max, +f.value + (k === 'left' ? -1 : 1) * (+f.step || .05)))); f.dispatchEvent(new Event('input', { bubbles: true })); return; }
      if (!f) return; const { items } = navList(), nx = navStep(app, items, f, k); if (nx) navTo(nx); return;
    }
    if (k === 'A') { aPress(f); return; }
    if (k === 'L2' || k === 'R2') { const d = k === 'R2' ? 1 : -1, own = f && f.closest('.gsc'); // the list the cursor is in first, then the words, then any other list
      if (own && own.scrollHeight - own.clientHeight >= 8 && pageList(d)) return;
      if (textPages(d)) pageText(d); else if (!pageList(d)) pageText(d);
      return; }
    if (k === 'B' && G.lookB) { G.look = null; G.lookCur = false; render(); return; }
    const chip = [...app.querySelectorAll('.scr .kc')].find(c => c.dataset.key === k), b = chip && chip.nextElementSibling;
    // B that would walk away from a room and what it offers is asked for twice; any other key forgets the first press.
    if (k === 'B' && b && !b.disabled && /^(skip|leave)$/.test(b.dataset.a || '') && NAV.sure !== NAV.sig + b.dataset.a) { NAV.sure = NAV.sig + b.dataset.a; toast(/NOTHING/.test(b.textContent) ? 'B again to take nothing.' : 'B again to leave.'); render(); return; } // by the plaque's own words: the Omen's way out is LEAVE
    if (k !== 'B') NAV.sure = null;
    if (k === 'START' && !chip && G.tab) { G.tab = null; G.pickDeck = G.pickTrunk = null; render(); return; } // Start shuts the menu or the book it opened
    if (b && !b.disabled) { NAV.hold = true; try { b.click(); } finally { NAV.hold = false; } return; } // the key presses its plaque; the cursor stays where it is
    if ((k === 'L1' || k === 'R1') && f) rowJump(k === 'R1' ? 1 : -1); // in a duel, also while the plaques that say so have given their places to a card's commands
  } catch (e) { recover(e, false); } finally { NAV.inPad = false; }
}
if (DUAL) {
  padLoop(padPress);
  app.addEventListener('scroll', ev => { const g = ev.target; if (g && g.classList && g.classList.contains('gsc')) { NAV.sk[NAV.sig + g.dataset.sk] = g.scrollTop; listMarks(); } }, true);
}

// ---------- the two-screen layout: the screens ----------
const faceOfName = name => 'face-' + String(name || '').toLowerCase().replace(/^the /, '').replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
const lbc = (x, y, t, col) => `<b class="ab lb" style="left:${x}px;top:${y}px;color:${col}">${esc(t)}</b>`;
const sentences = t => String(t || '').split(/(?<=[.!?])\s+/).filter(Boolean);
// The title's panel beside its menu: what the choice under the hammer opens.
function titlePanel(a, saved) {
  const rows = (y, list) => list.map(([k, v], i) => lb(210, y + i * 12, k, 'g') + lbr(398, y + i * 12, v)).join('');
  if (a === 'resume' && saved) { const at = { chamber: 'the chamber of doors', duel: 'your duel', reward: 'a reward waiting', anvil: 'the Anvil', bazaar: 'the Bazaar', kit: 'the starter kits', charm: 'your first charm' }[saved.phase] || 'where you left it';
    return descentB(202, 6, 205, 348, saved, 'THE DESCENT YOU LEFT', `Continue it from ${at} on floor ${saved.floor + 1}.`, 'SAVED ON THIS DEVICE'); }
  if (a === 'new') return panelB('A NEW DESCENT', rows(32, [['RUNS', P.runs], ['CLEARS', P.clears], ['DUELS WON', P.duelWins], ['GUARDIANS BEATEN', P.bossWins], ['FORGERS', `${P.forgers.length} OF ${FORGER_IDS.length}`], ['HEAT OPEN', heatOpen()]])
    + txb(210, 116, 190, 112, `<p>Choose a Forger and go down the three floors of the pyramid.</p>${saved ? '<p class="d">A descent is waiting. You are asked before it is ended.</p>' : ''}`) + lb(210, 236, 'MEMORIES', 'g') + lbr(398, 236, P.memories) + lb(210, 248, 'RECIPES WRITTEN', 'g') + lbr(398, 248, G.known.size), false);
  if (a === 'screen:codex') { const X = codexIndex(), found = codexFound();
    return panelB('THE CODEX', rows(32, [['RESULTS FOUND', `${found.size} OF ${X.list.length}`], ['RECIPES WRITTEN', G.known.size]]) + txb(210, 68, 190, 128, '<p>Every monster a meld can make has a page here. A page you have found shows why the meld works.</p>')); }
  if (a === 'screen:feats') { const fs = featList(!!labs.long);
    return panelB('FEATS', (fs.length > 8 ? lbr(398, 14, `8 OF ${fs.length} · THE BOOK HAS ALL`, 'd') : '') + fs.slice(0, 8).map((f, i) => { const done = (P.featsDone || []).includes(f.id), n = done ? f.goal : (P.feats || {})[f.id] || 0, y = 32 + i * 36;
      return lb(210, y, fitName(f.name, 20), done ? 'g' : '') + lbr(398, y, done ? 'DONE' : `${n}/${f.goal}`) + gauge(210, y + 11, 188, n / f.goal, 'x') + lb(210, y + 22, fitName(RELICS[f.gift].name, 30), 'd'); }).join('')); }
  if (a === 'screen:vault') return panelB('THE MEMORY VAULT', rows(32, [['MEMORIES', P.memories], ['BOUGHT', `${VAULT.filter(v => P.bought.includes(v.id)).length} OF ${VAULT.length}`]]) + txb(210, 68, 190, 128, '<p>Spend Memories to widen what a run can offer. Nothing here makes you stronger at the start.</p>'));
  if (a === 'tab:help') return panelB('HOW TO PLAY', lb(210, 32, `${helpPages().length} PAGES OF RULES`) + txb(210, 48, 190, 96, `<p>${padWords(helpPages()[0][1])}</p>`) + helpPages().map((q, i) => lb(210, 152 + i * 13, `${i + 1}. ${q[0]}`, 'd')).join(''));
  return panelB('OPTIONS', rows(32, [['SWITCHES ON', labKeys().filter(k => pref[k]).length], ['SWITCHES', labKeys().length]]) + txb(210, 68, 190, 96, '<p>Sound, the look of the game and the lab switches.</p>'));
}
// The chamber of doors on two frames. Top: the hall and its doors, your run and relics on the pillars with the floor's
// Guardian, and the window that says what the chosen door is and what it carries. Bottom: what each door costs and gives,
// in three columns that stand as the doors do, each with the rival's face and the monster kinds that rival plays; under
// them the eight strongest cards you would carry in, and the plaques.
function chamberDual({ r, sel, d, n, at, view, said, secret, boss, locked, pips }) {
  const KNOW = { known: 'KNOWN', partial: 'PARTLY HIDDEN', mystery: 'IN FOG' };
  const col = (x, i) => { const on = i === sel, lk = x.type === 'boss' && r.seals < 2, th = x.theme != null && ['duel', 'cursed', 'champion', 'guardian'].includes(x.type) && x.know === 'known' ? THEMES[x.theme] : null;
    const who = th ? th.name : x.type === 'boss' ? x.name : x.tier === 'secret' ? 'The Last One' : null, fc = who ? (x.tier === 'secret' ? 'face-last-one' : faceOfName(who)) : '';
    const [c0, ...cr] = sentences(x.cost), kinds = th ? th.types.reduce((ls, t) => { const l = ls.length ? ls[ls.length - 1] + ' · ' + t : null; if (l && labelW(l) <= 122) ls[ls.length - 1] = l; else ls.push(t); return ls; }, []) : nameLines((cr.join(' ') || (x.know === 'mystery' ? 'Fog hides it' : '')).replace(/\.$/, ''), 121, 2);
    const inner = lb(5, 5, 'DOOR ' + (i + 1), 'g') + (on ? '<i class="cur" style="left:49px;top:4px"></i>' : '')
      + (who && CART.has(fc) ? psPort(fc, 5, 17) : `<i class="ab nof" style="left:5px;top:17px;width:68px;height:68px"></i>` + lb(11, 47, x.know === 'mystery' ? 'UNSEEN' : who ? fitName(shortName(who), 9) : 'NO RIVAL', 'd'))
      + lbc(81, 21, 'COST', '#f08a72') + nameLines(String(c0 || 'Unknown').replace(/\.$/, ''), 48, 5).map((t, k) => lb(81, 33 + k * 10, t)).join('')
      + lb(5, 95, th ? 'PLAYS' : kinds.length ? 'ALSO' : '', 'd') + kinds.slice(0, 2).map((t, k) => lb(5, 106 + k * 10, t.toUpperCase())).join('')
      + lbc(5, 133, 'GAIN', '#9fd0c0') + nameLines(String(x.reward || '').replace(/\.$/, ''), 121, 3).map((t, k) => lb(5, 144 + k * 10, t)).join('');
    return `<button class="dcol${on ? ' on' : ''}" data-nonav style="left:${4 + at[i] * 136}px;top:18px" data-a="${on && !lk ? 'door' : 'dsel'}:${i}" aria-label="Door ${i + 1}">${inner}</button>`; };
  const duelDoor = d.theme != null && ['duel', 'cursed', 'champion', 'guardian'].includes(d.type), cr = sentences(d.cost).slice(1).join(' '), cut = nameLines(String(d.reward || '').replace(/\.$/, ''), 121, 3).some(l => l.endsWith('..')) || (!duelDoor && nameLines(cr, 121, 2).some(l => l.endsWith('..')));
  const guard = `Guardian of this floor: ${boss.name}. ${r.chamber >= 2 ? bossLaw(db, r) : 'Its Law shows from chamber 3.'}`;
  const text = [r.lastNote, duelDoor ? cr : '', said, locked ? 'It needs two seals.' : '', secret && !said ? 'A door that was not there before.' : '', cut ? `${!duelDoor && cr ? cr + ' ' : ''}Reward: ${stop(d.reward)}` : ''].filter(Boolean).map(esc).join(' ');
  const bf = faceOfName(boss.name), note = (db.config.heatRules && r.heat ? pq(4, 160, 88, `HEAT ${r.heat}`, `heatinfo:${r.heat}`) : '') + lb(8, 262, 'GUARDIAN', 'g') + psPort(bf, 14, 276);
  const top = roomTop({ left: psYou(r), right: psRight(r, '', { note }), view, head: `${sel + 1} · ${doorName(d)}`, sub: KNOW[d.know || 'known'], text: text || esc(guard), more: text ? esc(guard) : '' });
  const turn = k => ({ a: `dsel:${(sel + k + n) % n}`, off: n < 2 });
  const bottom = box(0, 0, 413, 200, 'wn') + lb(8, 6, 'WHAT EACH DOOR COSTS AND GIVES', 'g') + lbr(405, 6, `CHAMBER ${Math.min(6, r.chamber + 1)} OF 6`, 'd') + r.doors.map(col).join('')
    + [0, 1, 2].filter(c => !at.slice(0, n).includes(c)).map((c, j) => { const [h, t] = [['THE SEALS', "Each duel you win on this floor breaks a seal. Two seals open the Guardian's door."], ['IF YOU LOSE', 'A lost duel costs one Spark. With none left the descent ends.']][n === 2 ? 1 : j] || ['', ''];
      return `<i class="ab nof" style="left:${4 + c * 136}px;top:18px;width:133px;height:178px"></i>` + lb(10 + c * 136, 24, h, 'g') + nameLines(t, 121, 12).map((l, k) => lb(10 + c * 136, 40 + k * 10, l, 'd')).join(''); }).join('')
    + deckStripB(200, 'YOUR STRONGEST CARDS', r.deck)
    + foot(276, [[{ t: locked ? 'SEALED' : 'ENTER', a: `door:${sel}`, lit: !locked, off: locked }, { k: 'X', t: 'DECK', a: 'tab:deck' }, { k: 'Y', t: 'RELICS', a: 'tab:relics' }],
      [{ k: 'L1', t: 'DOOR BEFORE', ...turn(-1) }, { k: 'R1', t: 'NEXT DOOR', ...turn(1) }, { k: 'START', t: 'MENU', a: 'tab:menu' }]]);
  return two(top, bottom);
}
// ---- the duel on two frames. Top: the hall and the whole table, 640 x 304, and under it the two duelists' plates with
// the bar of words between them (the terrain named at its right end). Bottom: the hand in six fixed places with the deck
// and the graveyard beside it, the page of whatever the cursor rests on, the relic belt and the plaques. The table and
// the hand never move or change size; an attack that waits on an answer, and the duel's end, take the bottom frame's
// page, never the table.
// What the page reads in a duel (G.look): a hand card, a monster, a set Trap, a graveyard, the deck, a relic.
function duelLook(v, look = G.look) {
  const L = look ? String(look).split(':') : [], k = L[0], n = +L[1];
  if (k === 'h' && v.hand[n]) return { ...readCard(v.hand[n]), where: `HAND CARD ${handPlace(v.hand, n) + 1} OF ${v.hand.length}` };
  if (k === 'z') { const m = v.mon[n] && v.mon[n][+L[2]]; if (!m) return null;
    if (!m.id) return { name: 'A veiled monster', where: 'RIVAL MONSTER', sub: 'FACE DOWN', lines: ['It lies face down in defense. You see it when it is attacked or when it turns.'] };
    const c = readCard(m); return { ...c, ea: m.ea, ed: m.ed, where: n ? 'RIVAL MONSTER' : 'YOUR MONSTER', lines: [...c.lines, `${m.pos === 'd' ? 'In defense' : 'In attack position'}, at ${m.ea} / ${m.ed} now.`] }; }
  if (k === 't0' && v.traps[0][n]) return { ...readCard(v.traps[0][n]), where: 'YOUR SET TRAP' };
  if (k === 'c' && card(n)) return { ...readCard({ id: n }), where: 'CARD' };
  if (k === 'r' && RELICS[L[1]]) return { ...lookOf(look), where: 'RELIC' };
  if (k === 'g' && v.gy[n]) { const ids = v.gy[n].map(x => x && x.id != null ? x.id : x).filter(id => card(id)); return { name: n ? "The rival's graveyard" : 'Your graveyard', where: `${ids.length} CARD${ids.length === 1 ? '' : 'S'}`, list: ids }; }
  if (k === 'p') return { name: 'Your deck', where: `${v.deckCount[0]} CARDS LEFT`, lines: ['You draw toward five cards at the start of your turn, two at the most.', `The rival has ${v.deckCount[1]} cards left. A duelist who cannot draw loses the duel.`] };
  return null;
}
// chosen: the hand card (or the meld) picked for play, { head, html }. While one is chosen the page stays on a card: the
// one under the cursor on the hand or the table, else the card chosen last, so the walk down to the plaques through the
// relic belt never takes the card being played off its page. What choosing means stands at the page's foot.
function duelPage(y, h, v, rv, chosen = null) {
  const look = chosen && !/^(h|z|t0):/.test(G.look || '') ? 'h:' + G.sel[G.sel.length - 1] : G.look;
  const L = duelLook(v, look), s = box(0, y, 413, h, 'wn');
  if (!L) { // nothing under the cursor: what this duel is fought over, in two columns
    const tw = { fog: 'Fog: monsters arrive veiled.', narrow: 'Narrow Pass: three zones.', storm: 'Storm Front: terrain shifts every third turn.', locked: 'Locked terrain.' }[rv.twist] || '';
    const law = [rv.lawText ? lawShown(rv.lawText) : '', tw].filter(Boolean).join(' '), Fg = v.forger ? FORGERS[v.forger] : null, hh = h - 24 - (h - 24) % 16;
    return s + lb(8, y + 8, 'HOW THIS RIVAL PLAYS', 'g') + txb(8, y + 20, 194, hh, `<p>${esc(rv.styleText || 'Nothing is known of this one.')}</p>${law ? `<p class="d">${esc(law)}</p>` : ''}`)
      + lb(212, y + 8, 'BOUNTY THIS DUEL', 'g') + txb(212, y + 20, 194, hh, `<p>${esc(rv.bountyText || 'None.')}</p>${Fg ? `<p class="d">${esc(Fg.power)}: ${v.rs.power ? 'used this duel.' : esc(Fg.powerText)}</p>` : ''}`); }
  const pic = L.inst ? bigCard(L.inst, 4, y + 3, L.ea, L.ed) : L.relic ? `<i class="ab" style="left:24px;top:${y + 46}px">${medal(L.relic, 64)}</i>` : '', x0 = pic ? 118 : 8, w = 405 - x0;
  const nl = nameLines(L.name, w, 2), ty = y + 20 + nl.length * 10 + (L.sub ? 12 : 0) + 4;
  // a graveyard: its cards whole, the newest first, more than sixteen in a list that the cursor walks and L2 and R2 page;
  // a short one also by name, so the page is never half bare
  const gl = L.list ? L.list.slice().reverse() : [], long = gl.length > 16, body = L.list ? (gl.length ? (long ? `<div class="ab gsc bare" data-sk="gy${/1$/.test(look) ? 1 : 0}" data-row="62" data-mx="390" style="left:0;top:${ty - 3}px;width:413px;height:127px"><div class="gin" style="height:${Math.ceil(gl.length / 8) * 62 + 3}px">${gl.map((id, i) => psCard({ id }, 8 + (i % 8) * 50, 3 + (i >> 3) * 62, { attrs: `data-a="nop" data-k="gy${i}"` })).join('')}</div></div>`
      : gl.map((id, i) => psCard({ id }, 8 + (i % 8) * 50, ty + (i >> 3) * 62, { attrs: 'tabindex="-1"' })).join(''))
      + (gl.length <= 8 ? gl.map((id, i) => `<b class="ab lb" data-name="${esc(card(id).name)}" style="left:${8 + (i & 1) * 200}px;top:${ty + 66 + (i >> 1) * 10}px">${esc(fitName(card(id).name, 31))}</b>`).join('') : '')
      + (long ? lbr(405, y + 8, 'NEWEST FIRST', 'd') : gl.length <= 4 ? txb(216, ty, 189, 48, '<p class="d">What falls in battle or is spent lies here.</p>') : '') : lb(x0, ty, 'NOTHING IN IT YET', 'd') + txb(x0, ty + 14, 397, 32, '<p class="d">What falls in battle or is spent lies here.</p>'))
    : chosen ? pagerB(x0 - 6, ty - 4, w + 8, y + h - 50 - ty + 4, L.lines.filter(t => !/ Printed \d+ \/ \d+\.$/.test(t)).map(t => `<p>${esc(t)}</p>`).join(''), 'bar') // the printed numbers stand under the picture
      + `<i class="ab" style="left:${x0}px;top:${y + h - 50}px;width:${w}px;height:1px;background:var(--dark)"></i>` + lb(x0, y + h - 46, chosen.head, 'g') + txb(x0, y + h - 36, w, 32, `<p class="d">${chosen.html}</p>`)
    : txb(x0, ty, w, y + h - 4 - ty - (y + h - 4 - ty) % 16, L.lines.map(t => `<p>${esc(t)}</p>`).join(''));
  return s.replace('<div ', `<div data-page="${esc(look || '')}" `) + pic + lb(x0, y + 8, L.where, 'g') + nl.map((t, i) => `<b class="ab lb" data-name="${esc(L.name)}" style="left:${x0}px;top:${y + 20 + i * 10}px">${esc(t)}</b>`).join('') + (L.sub ? `<b class="ab lb d" style="left:${x0}px;top:${y + 20 + nl.length * 10 + 2}px">${L.sub}</b>` : '') + body;
}
// An attack waiting on your answer, on the bottom frame: the attack, one of your Traps that can answer it (R1 turns to
// the next), and how the attack ends if nothing is sprung.
function trapB(y, h, live, v) {
  const pd = live.pending, n = pd.options.length, k = (G.trapSel || 0) % n, i = pd.options[k], t = live.traps[0][i], X = live.mon[1][pd.from], T = pd.to >= 0 ? live.mon[0][pd.to] : null;
  let fore = '';
  try { if (T) { const q = forecast(live, db, 1, X, 0, T); fore = q.killT && q.killX ? 'Both monsters fall.' : q.killT ? 'Your defender falls.' : q.killX ? 'The attacker falls.' : 'Neither monster falls.'; } else fore = `The blow lands on your Life Points${v.mon[1][pd.from] && v.mon[1][pd.from].ea != null ? ': ' + v.mon[1][pd.from].ea : ''}.`; } catch { fore = ''; }
  const bounty = (G.shown ? G.shown.rival : info(G.run)).bountyText || '', two2 = shortText(t.id).length <= 48 && fore.length <= 60 && bounty && bounty.length <= 96 && nameLines(card(t.id).name, 142, 2).every(l => !l.endsWith('..')); // each box holds its words whole, or the plainer layout is used
  // Two boxes side by side, as the approved frame has them: your Trap in a gold box, what happens without it in a dim
  // one, eight pixels of the window between them. Words too long for the pair stand in two boxes one over the other.
  const name = w => nameLines(card(t.id).name, w, 2).map((s, j) => `<b class="ab lb g" data-name="${esc(card(t.id).name)}" style="left:58px;top:${6 + j * 10}px">${esc(s)}</b>`).join('');
  const trap = (x, w, hh, lines) => box(x, y + 70, w, hh, 'tbx', psCard(t, 5, 6, { attrs: `data-a="respond:${i}" data-k="trap"` }) + name(w - 64) + txb(58, 28, w - 64, lines * 16, `<p>${esc(shortText(t.id))}</p>`));
  return box(0, y, 413, h, 'wn') + lb(8, y + 8, 'SPRING A TRAP?', 'g') + lbr(405, y + 8, `TRAP ${k + 1} OF ${n}`, 'd') + txb(8, y + 22, 397, 48, `<p>${trapHead(live)}</p>`)
    + (two2 ? trap(6, 206, 80, 3) + box(220, y + 70, 187, 80, 'tbx dm', lb(6, 6, 'IF YOU LET IT THROUGH', 'd') + txb(6, 28, 174, 48, `<p>${esc(fore)}</p>`))
        + lb(8, y + 154, 'BOUNTY THIS DUEL', 'd') + txb(8, y + 164, 397, 32, `<p class="d">${esc(bounty)}</p>`)
      : trap(6, 401, 74, 2) + box(6, y + 148, 401, 48, 'tbx dm', lb(6, 4, 'IF YOU LET IT THROUGH', 'd') + txb(6, 14, 388, 32, `<p>${esc(fore)}</p>`)));
}
// The end of a duel, on the bottom frame: the run as it now stands, what the duel paid, the deck and the relics.
function endB(o) {
  const s = o.sum, r = G.run, rv = o.rival || {};
  // What waits now: the reward this door promised, or what the loss costs.
  const d = r.doors && G.doorSel && r.doors[G.doorSel.i], next = s.won ? (r.offer && r.offer.kind ? { card: 'A card to pick for your deck.', gift: 'A Gift of the forge.', charm: 'A charm to pick.', guardian: "The Guardian's reward.", treasure: 'A treasure.', sanctum: 'The Sanctum.', omen: 'An Omen.' }[r.offer.kind] : '') || (d && d.reward ? stop(d.reward) : 'The way on.')
    : r.sparks > 0 ? `You lose a Spark. ${r.sparks} left.` : 'That was your last Spark. The descent ends here.';
  const why = s.won ? '' : (o.why || []).slice(0, 2).map(t => `<p class="d">${esc(t)}</p>`).join('');
  return descentWide(0, r, s.won && s.embers ? `+${s.embers}` : '', false) + box(0, 76, 413, 142, 'wn')
    + lb(8, 84, s.won ? `RANK ${s.rank.rank} · ${s.rank.points} POINTS · ${s.rank.style === 'craft' ? 'CRAFT' : 'FURY'}` : 'THE DUEL IS LOST', 'g')
    + (s.won ? lb(8, 100, `BOUNTY · ${s.bountyMet ? 'MET' : 'NOT MET'}`, 'g') + txb(8, 112, 397, 32, `<p${s.bountyMet ? '' : ' class="d"'}>${esc(rv.bountyText || 'None.')}</p>`)
      + lb(8, 152, 'BEHIND THIS DOOR', 'g') + txb(8, 164, 397, 48, `<p>${esc(next)}${s.reason === 'deckout' ? ' A deck ran out.' : ''}</p>`)
      : lb(8, 100, 'WHAT IT COSTS, AND WHY', 'g') + `<div class="ab bar" style="left:2px;top:108px;width:409px;height:108px"><div class="pgw" data-pager><p>${esc(next)}</p>${why}</div></div>`)
    + deckStripB(218, s.won && r.offer && r.offer.kind === 'card' ? 'THE DECK YOUR PICK WILL JOIN' : 'YOUR STRONGEST CARDS', r.deck, null) + stripB(294, r)
    + foot(324, [[{ t: 'CONTINUE', a: 'closeov', lit: true }, { k: 'Y', t: 'THIS DUEL', a: 'tab:duel' }, { k: 'START', t: 'MENU', a: 'tab:menu' }]]);
}
function duelDual({ live, v, rv, rf, myTurn, pend, cmds, endOk, bar, view, hand, power, chosen }) {
  const r = G.run, endO = G.overlay && G.overlay.kind === 'duelEnd' && !G.playing ? G.overlay : null;
  const lifeAt = (id, L, R, y) => `<b id="${id}" class="ab lb" data-r="${R}" style="left:${R - String(L.n).length * 6}px;top:${y}px${L.hot == null ? '' : `;color:${L.hot < 0 ? '#f08a72' : '#9fd0c0'}`}">${L.n}</b>`;
  const port = (n, x, pic) => { const fc = n && CART.has(n + '-48') ? n + '-48' : ''; return `<div class="pf s48${fc ? '' : ' none'}" data-face="${pic}" style="left:${x}px;top:2px">${fc ? `<img data-pic="${pic}" src="${cimg(fc)}" width="48" height="48" alt="">` : ''}</div>`; };
  const L0 = lpNow(v, 0), L1 = lpNow(v, 1), f = r.forger, sm = sparksMax(r);
  const you = port(f ? faceName(f) : '', 2, 'face0') + lb(60, 3, f ? fitName(shortName(FORGERS[f].name), 14) : 'YOU', 'g') + lb(60, 14, 'LIFE', 'g') + lifeAt('myLp', L0, 148, 14) + gauge(60, 23, 88, L0.g / 8000).replace('<i class="ga', '<i id="myGa" class="ga')
    + lb(60, 34, 'TURN', 'g') + lbr(148, 34, v.turn) + lb(60, 44, 'SPARKS', 'g') + sparkRow(r, 149 - sm * 12, 42);
  const rival = port(rf, 98, 'face1') + lb(4, 3, fitName(shortName(rv.name), 15), 'g') + lb(4, 14, 'LIFE', 'g') + lifeAt('rivalLp', L1, 92, 14) + gauge(4, 23, 88, L1.g / 8000).replace('<i class="ga', '<i id="rivalGa" class="ga')
    + lb(4, 34, 'HAND', 'g') + `<span class="backs" style="left:36px;top:32px">${'<u></u>'.repeat(Math.min(v.rivalHand, 5))}</span>` + lb(4, 44, 'DECK', 'g') + lb(34, 44, v.deckCount[1]) + `<button class="rw" style="left:49px;top:41px;width:47px;height:14px" data-a="nop" data-k="grave1" data-look="g:1" aria-label="The rival's graveyard, ${v.gy[1].length} cards"><b class="ab lb g" style="left:2px;top:2px">GRAVE</b><b class="ab lb" style="left:36px;top:2px">${v.gy[1].length}</b></button>`;
  // the terrain at the bar's right end: its name in whole words on up to two lines, and how long it holds or that it is locked
  const ter = v.terrain, terr = lb(238, 5, 'TERRAIN', 'g') + (ter ? (ter.lock ? lbr(328, 5, 'LOCKED', 'd') : ter.temp != null ? lbr(328, 5, ter.temp, 'd') : '') + nameLines(card(ter.id).name, 90, 3).map((t, i) => `<b class="ab lb" data-name="${esc(card(ter.id).name)}" style="left:238px;top:${16 + 9 * i}px">${esc(t)}</b>`).join('') : lb(238, 16, 'NONE', 'd'));
  const word = endO ? carve(endO.sum.won ? 'VICTORY' : 'DEFEAT', 24, render) : null;
  const barIn = endO ? (word ? `<img class="ab" src="${word.url}" width="${word.w}" height="${word.h}" style="left:${(334 - word.w) >> 1}px;top:${(54 - word.h) >> 1}px" alt="${endO.sum.won ? 'VICTORY' : 'DEFEAT'}">` : lb(140, 22, endO.sum.won ? 'VICTORY' : 'DEFEAT', 'g')) : `<div class="pgw" data-pager data-foot="1" style="width:226px"><p>${bar}</p></div>${terr}`;
  const top = `<div class="fr">${box(0, 0, 640, 304, 'vw', view)}${box(0, 304, 152, 56, 'st pl')}${box(488, 304, 152, 56, 'st pl')}${box(152, 304, 336, 56, 'wn bar', barIn)}<div class="ab" style="left:0;top:304px;width:152px;height:56px">${you}</div><div class="ab" style="left:488px;top:304px;width:152px;height:56px">${endO ? rival.replace(/<button class="rw"/, '<button data-nonav class="rw"') : rival}</div></div>`;
  G.achStrip = false;
  if (endO) return two(top, endB(endO));
  const ledge = box(0, 0, 413, 76, 'lg ledge', `<div class="hand" style="width:308px">${hand}</div><button class="cd back pile" style="left:314px;top:6px" data-a="nop" data-k="pile" data-look="p:0" aria-label="Your deck, ${v.deckCount[0]} cards"><i class="art"></i></button>${lb(364, 8, 'DECK', 'g')}${lb(364, 18, v.deckCount[0])}<button class="rw" style="left:360px;top:36px;width:46px;height:28px" data-a="nop" data-k="grave" data-look="g:0" aria-label="Your graveyard, ${v.gy[0].length} cards"><b class="ab lb g" style="left:3px;top:4px">GRAVE</b><b class="ab lb" style="left:3px;top:14px">${v.gy[0].length}</b></button>`);
  if (pend && live && live.pending && live.pending.options && live.pending.options.length) {
    const pd = live.pending, n = pd.options.length, k = (G.trapSel || 0) % n, lookOn = G.look && /^z:1:/.test(G.look);
    G.lookB = !!lookOn;
    return two(top, ledge + (lookOn ? duelPage(76, 198, v, rv) : trapB(76, 198, live, v)) + stripB(274, r, 'pass')
      + foot(304, [[{ t: 'SPRING IT', a: `respond:${pd.options[k]}`, lit: true }, { k: 'B', t: lookOn ? 'BACK' : 'LET IT THROUGH', a: lookOn ? 'unlook' : 'respond:-1' }, { k: 'Y', t: 'THIS DUEL', a: 'tab:duel' }],
        [{ k: 'X', t: 'READ ATTACKER', a: `read:z:1:${pd.from}`, off: !!lookOn }, { k: 'R1', t: 'NEXT TRAP', a: 'trapnext', off: n < 2 }, { k: 'START', t: 'MENU', a: 'tab:menu' }]]));
  }
  const undo = cmds.find(c => c[1] === 'undo'), mains = cmds.filter(c => c !== undo).map(([t, a, o]) => ({ t, a, lit: !!(o && o.lit) })); if (power) mains.push(power);
  // The first place is A's on every page of the commands: the command the screen lights (the play, DIRECT), else the
  // place that says what A does to what the cursor is on (navShow writes it; dark while A does nothing there). No
  // command ever gives its own place to those words. With nothing chosen the two places under END TURN's neighbours
  // hold the keys that jump from row to row.
  const firstC = mains.find(c => c.lit) || { t: 'CHOOSE CARD', a: 'acur', off: true, cls: 'aslot' }, rest = mains.filter(c => c !== firstC);
  const sig = rest.map(c => c.a).join(); if (!G.cmdPage || G.cmdPage.sig !== sig) G.cmdPage = { sig, n: 0 };
  const per = rest.length > 4 ? 3 : 4, pages = Math.max(1, Math.ceil(rest.length / per)), pg = G.cmdPage.n % pages, s = [firstC, ...rest.slice(pg * per, pg * per + per)];
  while (s.length < per + 1) s.push(null); if (pages > 1) s.push({ t: `MORE ${pg + 1}/${pages}`, a: 'cmdpage' });
  const jump = !rest.filter(c => c !== power).length;
  const rows = [[s[0], { k: 'B', t: undo ? undo[0] : 'UNDO', a: 'undo', off: !undo }, { k: 'X', t: 'END TURN', a: 'end', off: !endOk }],
    jump ? [{ k: 'L1', t: 'ROW BEFORE', a: 'rowjump:-1' }, { k: 'R1', t: 'NEXT ROW', a: 'rowjump:1' }, { k: 'Y', t: 'THIS DUEL', a: 'tab:duel' }] : [s[1], s[3], { k: 'Y', t: 'THIS DUEL', a: 'tab:duel' }],
    jump ? [s[1], null, { k: 'START', t: 'MENU', a: 'tab:menu' }] : [s[2], s[4], { k: 'START', t: 'MENU', a: 'tab:menu' }]];
  // While a card is chosen the d-pad goes from the hand straight down to the card's commands, not through the relics.
  G.achStrip = !rows[2][1]; // the third row's middle place is free: an achievement may stand there
  return two(top, ledge + duelPage(76, 158, v, rv, chosen) + stripB(234, r, chosen ? 'pass' : false) + foot(264, rows));
}
// ---- rooms on two frames
// Words that page, in a window of their own on either frame (L2 and R2, or a tap, page them).
const pagerB = (x, y, w, h, html, cls = 'wn bar') => box(x, y, w, h, cls, `<div class="pgw" data-pager>${html}</div>`);
// A bottom frame that is a grid of cards: the grid in whole rows and the plaques under it. The plaques stand in four
// columns when two rows of four hold them (each plaque by its shorter words, t4), and then the grid shows five rows,
// forty cards whole, as the approved frames do; else in three columns under as many rows as they leave. A line that
// says what the grid is stands over it only where the rows leave it room; gives back the frame and whether it did.
function gridScreen(head, headR, list, o, cells) {
  cells = cells.filter(Boolean); const c4 = cells.map((c, i) => ({ ...c, t: c.t4 || c.t, ka: i === 0 && !c.k }));
  let cols = 4, rows = rowsOf(c4, 4); if (rows.length > 2) { const r3 = rowsOf(cells, 3); if (r3.length * 28 + 8 <= rows.length * 21 + 3) { cols = 3; rows = r3; } }
  const fh = cols === 3 ? rows.length * 28 + 8 : rows.length * 21 - 2, vis = Math.max(1, Math.floor((360 - fh - 5) / 63)), gh = 5 + vis * 63, hd = 360 - fh - gh >= 18 ? 18 : 0;
  return { head: !!hd, html: (hd ? box(0, 0, 413, 18, 'st dk') + lb(6, 5, head, 'g') + (headR ? lbr(407, 5, headR) : '') : '') + gridB(list, { ...o, y: hd, h: gh }) + foot(hd + gh, rows, cols) };
}
// The plaques of a bottom frame from row y down: three columns, or four when there are more than nine.
const footOf = (y, cells) => { cells = cells.filter(Boolean); return cells.length > 9 ? foot(y, rowsOf(cells.map((c, i) => i || c.k ? c : { ...c, ka: true }), 4), 4) : foot(y, rowsOf(cells, 3)); };
// The row at which such a foot starts when it is only as tall as its rows of plaques.
const footTop = cells => { cells = cells.filter(Boolean); return 360 - (cells.length > 9 ? rowsOf(cells.map((c, i) => i || c.k ? c : { ...c, ka: true }), 4).length * 21 + 12 : rowsOf(cells, 3).length * 28 + 8); };
// A Forger's record, beside the heat's rules, under the choice of Forgers.
function forgerB(id, h) {
  const f = FORGERS[id], own = P.forgers.includes(id), w = own ? forgerStats(P, id).wins : 0, heat = G.pickHeat, open = heatOpen();
  const line = (y, k, v) => lb(8, y, k, 'g') + lbr(196, y, v);
  let s = box(0, 0, 206, h, 'wn') + box(206, 0, 207, h, 'wn') + lb(8, 8, own ? `${shortName(f.name)}'S RECORD` : 'LOCKED', 'g');
  if (own) { const kits = (f.kits || []).slice(0, 5), y1 = 86 + kits.length * 24;
    s += line(24, 'DUELS WON', w) + line(36, 'RUNS, ALL FORGERS', P.runs) + line(48, 'CLEARS', P.clears) + lb(8, 68, 'STARTER KITS', 'g')
      + kits.map((k, i) => { const ok = !i || w >= KIT_GOALS[i]; return lb(8, 82 + i * 24, fitName(k.name, 22), ok ? '' : 'd') + lbr(196, 82 + i * 24, ok ? 'OPEN' : `${Math.min(w, KIT_GOALS[i])}/${KIT_GOALS[i]}`, 'd') + gauge(8, 93 + i * 24, 188, ok ? 1 : w / KIT_GOALS[i], 'x'); }).join('')
      + (h - y1 >= 60 ? lb(8, y1 + 6, 'HOW THE KITS OPEN', 'g') + txb(8, y1 + 18, 190, Math.min(64, h - y1 - 22 - (h - y1 - 22) % 16), '<p class="d">Each duel this Forger wins counts toward the next kit.</p>') : ''); }
  else s += txb(8, 24, 190, 96, `<p>${esc(id === 'last' ? 'Nobody says how.' : 'To unlock: ' + FORGER_FEATS[id].text)}</p>`) + lb(8, 132, 'UNTIL THEN', 'g') + txb(8, 144, 190, 64, '<p class="d">Its kits and its Power wait with it.</p>');
  // every rule the heat can add, the ones this descent would carry bright, the rest dim
  const per = Math.max(1, Math.floor((h - 42) / 12)), rules = labs.heat ? HEAT_RULES.slice(Math.max(0, Math.min(heat - per + 2, HEAT_RULES.length - per)), Math.max(0, Math.min(heat - per + 2, HEAT_RULES.length - per)) + per) : [];
  s += lb(214, 8, 'WHAT THE HEAT ADDS', 'g') + (rules.length && rules.length < HEAT_RULES.length ? lbr(405, 8, `${rules[0].n} TO ${rules[rules.length - 1].n} OF ${HEAT_RULES.length}`, 'd') : '') + (rules.length ? rules.map((x, i) => lb(214, 24 + i * 12, `${x.n}. ${fitName(x.name, 26)}`, x.n <= heat ? '' : 'd')).join('') + lb(214, h - 14, open ? 'BRIGHT: THE ONES YOU WOULD CARRY' : 'CLEAR THE PYRAMID TO OPEN IT', 'd')
    // under the list, the newest rule this heat would add, read whole, in the rows the list leaves
    + (() => { const yT = 24 + rules.length * 12 + 8, hh = h - 18 - (yT + 12) - (h - 18 - (yT + 12)) % 16; return hh < 32 ? '' : lb(214, yT, heat ? `AT HEAT ${heat} · MEMORIES +${heat * 20}%` : 'NO HEAT CHOSEN', 'g') + txb(214, yT + 12, 190, Math.min(hh, 64), `<p class="d">${esc(heat ? HEAT_RULES[heat - 1].text : 'The pyramid as it is. Each level of heat adds one rule and pays more Memories.')}</p>`); })() : txb(214, 24, 190, 64, '<p class="d">No heat: the pyramid as it is.</p>'));
  return s;
}
// A room that offers choices on plinths. Top: the room, the plinths, and the chosen thing read whole in the window.
// Bottom: what the choice would join. A card: your deck, with a line on the cards it repeats or shares a Type with. A
// relic: everything you hold by name, with a line on its family, and your strongest cards. A kit: its cards. The Omen:
// your trunk, weakest first, the two it takes marked. Anything else: the run, its cards and its relics.
function offerDual({ r, items, it, sel, n, selA, view, left, right, pillar, bar0, kind, key }) {
  const turn = d => selA ? selA((sel + d + n) % n) : `osel:${(sel + d + n) % n}`;
  const extra = plaques((right || '') + (pillar || '') + (left || '')), back = extra.find(c => /^(skip|leave|home)$/.test(c.a));
  const others = extra.filter(c => c !== back && !/^tab:(deck|relics|menu)$/.test(c.a)).map(c => c.t === '<' ? { ...c, t: 'LESS HEAT', pair: true } : c.t === '>' ? { ...c, t: 'MORE HEAT' } : c), main2 = others.find(c => /^(reroll|redeal|pick:1)/.test(c.a));
  const noun = it.fid ? 'FORGER' : it.deck ? 'KIT' : it.relic ? kindWord(it.relic) : it.card ? 'CARD' : 'CHOICE';
  const t4 = t => String(t).replace(/^TAKE NOTHING$/, 'NOTHING').replace(/^DEAL AGAIN/, 'REDEAL');
  const cells = [{ t: it.take || 'TAKE', a: it.a, lit: !it.off, off: it.off }, back && { k: 'B', ...back, t4: t4(back.t), lit: false }, main2 && { k: 'X', ...main2, t4: t4(main2.t) }, r && { k: 'Y', t: it.relic ? 'RELICS' : 'DECK', a: it.relic ? 'tab:relics' : 'tab:deck' },
    n > 1 && { k: 'L1', t: `${noun} BEFORE`, t4: 'BEFORE', a: turn(-1) }, n > 1 && { k: 'R1', t: `NEXT ${noun}`, t4: 'NEXT', a: turn(1) }, ...others.filter(c => c !== main2), r && { k: 'START', t: 'MENU', a: 'tab:menu' }].filter(Boolean);
  const emb = it.price != null && r ? (r.embers >= it.price ? `${r.embers - it.price} LEFT AFTER BUYING` : `${it.price - r.embers} SHORT`) : '', facts = (it.facts || []).filter(Boolean);
  let bottom, bare = false, gridSaid = true, said = '';
  const grid = (...a) => { const g = gridScreen(...a); gridSaid = g.head; return g.html; };
  if (it.fid) { const y0 = footTop(cells); bottom = forgerB(it.fid, y0) + footOf(y0, cells); }
  else if (it.deck) bottom = grid(`${String(it.name).toUpperCase()} · ${it.deck.length} CARDS`, `WEIGHT ${deckWeight(db, it.deck)}`, it.deck, { verb: (i, e) => `read:c:${e.id}`, sk: 'kit' + sel }, cells);
  else if (key === 'omen' && r) { const weak = r.trunk.map((e, i) => [e, i]).sort((a, b) => cardValue(db, a[0]) - cardValue(db, b[0])).slice(0, 2).map(x => x[1]);
    const tr = Math.max(1, Math.ceil(r.trunk.length / 8)), to = { verb: i => `read:t:${i}`, weakFirst: true, gold: new Set(r.trunk.length >= 2 ? weak : []), sk: 'omen', kp: 't', none: 'YOUR TRUNK IS EMPTY' }, hr = r.trunk.length >= 2 ? 'THE TWO MARKED ARE TAKEN' : 'IT NEEDS TWO CARDS';
    // A short trunk leaves the deck its place under it, in every row the foot leaves free, so the frame is never half empty.
    const c4 = cells.filter(Boolean).map((c, i) => ({ ...c, t: c.t4 || c.t, ka: i === 0 && !c.k })), fr = rowsOf(c4, 4), tot = Math.floor((360 - (fr.length * 21 - 2) - 46) / 63);
    if (tr < tot) { const y1 = 18 + 5 + tr * 63, dh = 5 + (tot - tr) * 63, few = r.trunk.length <= 4, gw = 13 + 50 * Math.max(1, r.trunk.length);
      // a trunk of four cards or fewer leaves the row's right half to their names and what the altar does with them
      const names = few ? box(gw, 18, 413 - gw, 68, 'wn', lb(8, 6, r.trunk.length >= 2 ? 'THE ALTAR TAKES' : 'IN THE TRUNK', 'g') + (r.trunk.length ? weak.map(i => r.trunk[i]).concat(r.trunk.filter((e, i) => !weak.includes(i))).slice(0, 4).map((e, i) => `<b class="ab lb${r.trunk.length >= 2 && i < 2 ? '' : ' d'}" data-name="${esc(card(e.id).name)}" style="left:8px;top:${20 + i * 11}px">${esc(fitName(card(e.id).name, Math.min(30, (413 - gw - 16) / 6 | 0)))}</b>`).join('') : lb(8, 20, 'NOTHING YET', 'd'))
        + (r.trunk.length < 2 && 413 - gw >= 300 ? txb(150, 18, 413 - gw - 158, 48, '<p class="d">The altar asks for two trunk cards.</p>') : '')) : '';
      bottom = box(0, 0, 413, 18, 'st dk') + lb(6, 5, 'YOUR TRUNK, WEAKEST FIRST', 'g') + lbr(407, 5, hr) + gridB(r.trunk, { ...to, y: 18, h: 5 + tr * 63, ...(few ? { cols: Math.max(1, r.trunk.length) } : {}) }) + names
        + box(0, y1, 413, 18, 'st dk') + lb(6, y1 + 5, 'YOUR DECK, STRONGEST FIRST', 'g') + gridB(r.deck, { y: y1 + 18, h: dh, verb: i => `read:d:${i}`, sk: 'omendeck' }) + foot(y1 + 18 + dh, fr, 4); }
    else bottom = grid('YOUR TRUNK, WEAKEST FIRST', hr, r.trunk, to, cells); }
  else if (it.card && r) { const c = card(it.card), mon = db.isMonster(it.card), gold = new Set(r.deck.map((e, i) => e.id === it.card || (mon && db.isMonster(e.id) && card(e.id).type === c.type) ? i : -1).filter(i => i >= 0));
    said = emb ? cap(emb.toLowerCase()) + '.' : gold.size ? `Marked below: ${mon ? 'the same card or Type' : 'the same card'} in your deck.` : '';
    bottom = grid('YOUR DECK, STRONGEST FIRST', emb || (mon ? 'MARKED: THE SAME CARD OR TYPE' : 'MARKED: THE SAME CARD'), r.deck, { verb: i => `read:d:${i}`, gold, sk: 'pick' }, cells); }
  else if (r) { bare = true; const fam = it.relic ? RELICS[it.relic].family : null, held = relicList(r).length;
    const marked = fam && FAMILY_NAME[fam] && relicList(r).some(id => RELICS[id].family === fam);
    const fy = footTop(cells); bottom = holdDeckB(0, fy, r, { fam, head: `YOU HOLD ${held}${emb ? ' · ' + emb : ''}`, headR: marked ? 'MARKED: ITS FAMILY' : '' }) + footOf(fy, cells); }
  else bottom = box(0, 0, 413, 276, 'st dk') + footOf(276, cells);
  const note = bare && (facts.length > 1 || bar0) ? pnote(44, it.relic ? 'THIS ' + noun : 'HERE', [...facts.slice(1).map(t => String(t).replace(/&amp;/g, '&')), ...sentences(bar0).map(t => t.replace(/\.$/, ''))])[0] : '';
  const top = roomTop({ left: left != null ? noPq(left) : psYou(r), right: pillar != null ? noPq(pillar) : psRight(r, '', { bare, note }), view, head: it.name,
    sub: [n > 1 ? `${sel + 1} OF ${n}` : '', ...(note ? facts.slice(0, 1) : facts)].filter(Boolean).join(' · '), text: esc(it.text || (it.card ? readCard({ id: it.card }).lines.join(' ') : '')).replace(/ (Sets off:|Set off by:)/g, '<br>$1'), more: [gridSaid ? '' : esc(said), note || emb ? '' : esc(bar0)].filter(Boolean).join(' ') });
  return two(top, bottom);
}
// The Anvil and the Winnower: the room on the top frame with the card (or the two) chosen for the working shown large and
// the working's words in the window; the whole deck on the bottom frame, and the workings as plaques under it.
function workDual({ r, room, head, sub, text, more, said, picked, verb, weakFirst, cells, gridHead, gridR, cols }) {
  const es = picked.filter(e => e), x0 = es.length > 1 ? 106 : 168;
  const view = roomBack(room) + es.map((e, i) => bigCard(e, x0 + i * 124, 48)).join('') + (es.length > 1 ? `<b class="ab big2" style="left:214px;top:116px;width:12px">+</b>` : '');
  const one = picked[0] || picked[1];
  // B puts a chosen card back, and leaves once nothing is chosen; the cursor starts on the first card, never on LEAVE.
  const all = [...cells, { k: 'B', t: one ? 'PUT BACK' : 'LEAVE', a: one ? 'unpick' : 'leave' }, { k: 'Y', t: 'RELICS', a: 'tab:relics' }, { k: 'START', t: 'MENU', a: 'tab:menu' }];
  return two(roomTop({ left: psYou(r), right: psRight(r), view, head, sub, text, more }), gridScreen(gridHead, gridR, r.deck, { verb, weakFirst, sel: G.pickDeck, sel2: G.pickTrunk, sk: room, n1: true, said }, all).html);
}
// The forge beat: the hammer falls in the forge on the top frame; the bottom frame shows what was worked, whole.
function forgeDual(fb, view, r) {
  const what = fb.kind === 'masterwork' ? `<i class="ab" style="left:28px;top:52px">${medal(fb.mw, 64)}</i>` : fb.inst ? bigCard(fb.inst, 8, 24) : '', name = fb.kind === 'masterwork' ? RELICS[fb.mw].name : fb.inst ? card(fb.inst.id).name : '';
  const words = fb.kind === 'masterwork' ? [RELICS[fb.mw].text] : fb.inst ? readCard(fb.inst).lines : [];
  return two(roomTop({ left: psYou(r), right: psRight(r), view: view.replace('data-a="forgeskip"', 'data-a="forgeskip" data-nonav'), head: fb.word, text: esc(fb.text) }),
    box(0, 0, 413, 200, 'wn') + what + lb(124, 24, fb.word, 'g') + nameLines(name, 280, 3).map((t, i) => `<b class="ab lb" data-name="${esc(name)}" style="left:124px;top:${38 + i * 10}px">${esc(t)}</b>`).join('') + txb(124, 74, 280, 112, words.map(t => `<p>${esc(t)}</p>`).join(''))
    + deckStripB(200, 'YOUR STRONGEST CARDS', r.deck) + foot(276, [[{ t: 'CONTINUE', a: 'forgeskip', lit: true }]]));
}
// ---- the books of the title on two frames (the Codex, the Feats, the Memory Vault) and the run's last page. The top
// frame is the open page; the bottom frame is the list the cursor walks, and the books' names along its foot.
const TBOOKS = [['codex', 'CODEX'], ['feats', 'FEATS'], ['vault', 'VAULT']];
function tbookFoot(at, first = []) {
  const i = TBOOKS.findIndex(b => b[0] === at), turn = d => 'screen:' + TBOOKS[(i + d + 3) % 3][0];
  const cells = [...first, { k: 'B', t: 'BACK', a: 'home' }, { k: 'L1', t: 'LAST BOOK', a: turn(-1) }, { k: 'R1', t: 'NEXT BOOK', a: turn(1) }];
  while (cells.length % 4) cells.push(null);
  return [...cells, ...TBOOKS.map(b => ({ t: b[1], a: 'screen:' + b[0], cls: b[0] === at ? 'on' : '' }))];
}
const footRows4 = cells => { const rows = []; for (let i = 0; i < cells.length; i += 4) rows.push(cells.slice(i, i + 4)); return rows; };
const foot4 = cells => { const rows = footRows4(cells), y0 = 360 - (rows.length * 21 + 11); return { y0, html: foot(y0, rows, 4) }; };
const lookRow = n => { const m = /^b:(\d+)$/.exec(G.look || ''); return m ? Math.min(n - 1, +m[1]) : 0; };
// A page of the top frame's book: a picture at its left, a gold name, a dim line, and words that page; side: what
// stands at its right, from 404 across.
const pageTop = (title, right, pic, name, sub, html, side = '') => lectern(title, right, (pic ? `<i class="ab" style="left:16px;top:26px">${pic}</i>` : '') + `<b class="ab lb g" data-name="${esc(name)}" style="left:${pic ? 96 : 16}px;top:26px">${esc(String(name).toUpperCase())}</b>` + (sub ? `<b class="ab lb d" style="left:${pic ? 96 : 16}px;top:38px">${sub}</b>` : '') + pagerB(pic ? 90 : 10, 50, (side ? 396 : 620) - (pic ? 90 : 10), 94, html, 'bar') + side);
// A count by kind, as rows with a bar each: [name, how many], the longest bar the largest count.
const tally = (x, y, w, rows) => { const max = Math.max(1, ...rows.map(q => q[1])); return rows.map(([k, n], i) => lb(x, y + i * 14, k) + lbr(x + 112, y + i * 14, n) + gauge(x + 120, y + i * 14 - 1, w - 120, n / max, 'x')).join(''); };
// The same page with a column at its right (from 330 across): the words keep the left, what they are counted among the right.
const pageSide = (title, right, pic, name, sub, html, side) => bookTop(title, right, (pic ? `<i class="ab" style="left:16px;top:32px">${pic}</i>` : '') + `<b class="ab lb g" data-name="${esc(name)}" style="left:${pic ? 96 : 16}px;top:32px">${esc(String(name).toUpperCase())}</b>` + (sub ? `<b class="ab lb d" style="left:${pic ? 96 : 16}px;top:44px">${sub}</b>` : '') + pagerB(pic ? 90 : 10, 60, pic ? 228 : 308, 284, html, 'bar') + `<i class="ab" style="left:322px;top:28px;width:1px;height:316px;background:var(--dark)"></i>` + side);
// A list of rows over the player's record, from the top of the bottom frame down to row y1: the list as tall as its rows
// (seven at the most; more are moved through), the record in two columns under it, so a short list leaves nothing bare.
function listRecordB(y1, head, headR, rows, o = {}) {
  const n = Math.max(1, Math.ceil(rows.length / 2) + (o.tailRows || 0)), rh = Math.max(20 + 26 * Math.min(n, 7), y1 - 124), fs = featList(!!labs.long);
  const rec = [['RUNS', P.runs], ['CLEARS', P.clears], ['DUELS WON', P.duelWins], ['GUARDIANS BEATEN', P.bossWins], ['MEMORIES EARNED', P.earned], ['FORGERS', `${P.forgers.length} OF ${FORGER_IDS.length}`], ['RECIPES WRITTEN', G.known.size], ['FEATS DONE', `${(P.featsDone || []).length} OF ${fs.length}`], ['VAULT BOUGHT', `${VAULT.filter(v => P.bought.includes(v.id)).length} OF ${VAULT.length}`], ['HEAT OPEN', heatOpen()]];
  const per = Math.max(1, Math.floor((y1 - rh - 24) / 14)), show = rec.slice(0, per * 2);
  return rowsB(0, rh, head, headR, rows, o) + (y1 - rh >= 38 ? box(0, rh, 413, y1 - rh, 'wn') + lb(8, rh + 6, 'YOUR RECORD', 'd') + show.map(([k, v], i) => lb(8 + (i % 2) * 206, rh + 20 + (i >> 1) * 14, k, 'g') + lbr(198 + (i % 2) * 206, rh + 20 + (i >> 1) * 14, v)).join('') : '');
}
// the Feats page's rows on two frames: the feats, then the Forgers (the achievements' row comes after them)
const featForgers = () => FORGER_IDS.concat(HIDDEN_FORGERS.filter(id => P.forgers.includes(id))).filter(id => id !== 'tarn');
const featRows = () => [...featList(!!labs.long), ...featForgers()];
// back from the achievements to the Feats page: the cursor stands on the achievements' row it left from
// (the screen's change sets the cursor afresh, so the place is kept for the first drawing after it)
const achBack = () => { G.lookNext = 'b:' + featRows().length; };
function featsDual() {
  const fs = featList(!!labs.long), forg = featForgers();
  const list = fs.map(f => { const done = (P.featsDone || []).includes(f.id), n = done ? f.goal : (P.feats || {})[f.id] || 0;
    return { pic: medal(f.gift, 24), name: f.name, sub: done ? 'DONE' : `${n} / ${f.goal}`, gold: done, page: [medal(f.gift, 64), f.name, esc(String(f.build).toUpperCase()) + (done ? ' · COMPLETE' : ` · ${n} OF ${f.goal}`), `<p>${esc(f.text)}</p><p class="gp">${done ? 'Unlocked Gift' : 'Gift, locked'}: ${esc(RELICS[f.gift].name)}. ${esc(RELICS[f.gift].text)}</p>`] }; })
    .concat(forg.map(id => ({ name: FORGERS[id].name, sub: P.forgers.includes(id) ? 'FORGER · UNLOCKED' : 'FORGER · LOCKED', gold: P.forgers.includes(id), page: ['', FORGERS[id].name, P.forgers.includes(id) ? 'UNLOCKED' : 'LOCKED', `<p>${esc(FORGER_FEATS[id].text)}</p>`] })));
  // one more place under the rows: the achievements, a row across the list that A opens
  const at = lookRow(list.length + 1), onA = at === list.length, pg = onA ? null : list[at].page, ft = foot4(tbookFoot('feats')), tt = AC.totals(achAll()), words = `${tt.got} OF ${tt.n} EARNED · ${tt.gotPts} OF ${tt.pts} POINTS`;
  const tail = `<button class="rw fam" style="left:4px;top:${Math.ceil(list.length / 2) * 26 + 1}px;width:403px;height:25px" data-a="screen:ach" data-look="b:${list.length}" data-k="b${list.length}"${onA ? ' data-n0' : ''} aria-label="Achievements">${AC.seal(5, 6, true)}${lb(21, 3, 'ACHIEVEMENTS', 'g')}${lb(21, 13, words, 'd')}${AC.lbR(396, 8, 'A OPENS', 'd')}</button>`;
  const top = onA ? pageTop('FEATS', `${(P.featsDone || []).length} OF ${fs.length} DONE`, '', 'Achievements', words, `<p>Rows earned in play, across every descent, in ${ACH_GROUPS.length} groups. A pack for every five earned.</p><p class="gp"><span class="d">Open them to read each group, how far a counting row has come, and what each one pays.</span></p>`)
    : pageTop('FEATS', `${(P.featsDone || []).length} OF ${fs.length} DONE`, pg[0], pg[1], pg[2], pg[3] + '<p class="gp"><span class="d">Each feat follows a way of playing and adds one Gift to what the forge can offer. Progress counts across runs, win or lose.</span></p>');
  return two(top, listRecordB(ft.y0, 'FEATS AND FORGERS', `${at + 1} OF ${list.length + 1}`, list.map((x, i) => ({ ...x, a: 'nop', look: 'b:' + i, k: 'b' + i, n0: i === at })), { sk: 'feats', tail, tailRows: 1 }) + ft.html);
}
function vaultDual() {
  const list = VAULT.map(v => ({ id: v.id, key: v.id, price: v.price, name: RELICS[v.id].name, kind: RELICS[v.id].kind === 'M' ? 'MASTERWORK' : 'CHARM', text: RELICS[v.id].text, pic: medal(v.id, 24), big: medal(v.id, 64) }))
    .concat(labs.long ? VAULT_ENCHANTS.map(v => ({ key: v.key, price: v.price, name: cap(v.id), kind: 'ENCHANT', text: ENCHANT_TEXT[v.id], pic: '', big: '' })) : []);
  const at = lookRow(list.length), x = list[at], own = k => P.bought.includes(k), can = !own(x.key) && P.memories >= x.price;
  const ft = foot4(tbookFoot('vault', [{ t: own(x.key) ? 'OWNED' : `BUY FOR ${x.price}`, a: `vbuy:${x.key}`, off: !can, lit: can }]));
  return two(pageTop('THE MEMORY VAULT', `${P.memories} MEMORIES`, x.big, x.name, `${x.kind} · ${own(x.key) ? 'OWNED' : x.price + ' MEMORIES'}`, `<p>${esc(x.text)}</p><p class="gp"><span class="d">Spend Memories to widen what a run can offer. Nothing here makes you stronger at the start.${labs.long ? ` An Anvil offers three Enchants from the ones you hold. Six are yours from the start: ${START6}.` : ''}</span></p>`),
    listRecordB(ft.y0, 'WHAT THE VAULT SELLS', `${list.filter(v => own(v.key)).length} OF ${list.length} OWNED`, list.map((v, i) => ({ pic: v.pic, name: v.name, sub: own(v.key) ? 'OWNED' : `${v.price} MEMORIES`, gold: own(v.key), a: i === at && can ? `vbuy:${v.key}` : 'nop', look: 'b:' + i, k: 'b' + i, n0: i === at })), { sk: 'vault' }) + ft.html);
}
function codexDual() {
  const X = codexIndex(), found = codexFound(), v = G.cx; convertSheets(40);
  let list = X.list.filter(R => (v.view === 'all' || found.has(R.id)) && (!v.type || card(R.id).type === v.type)); const none = !list.length;
  if (none) list = X.list.filter(R => !v.type || card(R.id).type === v.type); // nothing found here yet: the pages still to find stand in their places
  const total = list.length; list = list.slice(0, 120);
  const byType = t => X.list.filter(R => card(R.id).type === t), heard = BOSSES.flat().filter(b => P.seen.includes('memory:' + b.id));
  let top;
  const R = G.cx.open != null ? X.res.get(G.cx.open) : null;
  if (R) { const c = card(R.id), recs = found.get(R.id) || [], known = recs.length > 0; if (known) convertSheets(96);
    const hint = R.kind === 'printed' ? `A printed fusion of ${R.mats.map(m => 'a ' + card(m).type).join(' and ')}.` : `A ${c.attr} ${c.type}. Some ${c.type} melded with some ${c.attr} monster makes it. Which ones is for you to find.`;
    top = lectern('CODEX', known ? `${recs.length} RECIPE${recs.length === 1 ? '' : 'S'} FOUND` : 'NOT FOUND YET', (known ? bigCard({ id: R.id }, 12, 24) : '<div class="big unk" style="left:12px;top:24px"><b class="n1">?</b></div>')
      + `<b class="ab lb g" style="left:128px;top:26px">${esc((known ? c.name : 'Not found yet').toUpperCase())}</b>` + pagerB(122, 40, 274, 138, known ? `<p>${esc(`${c.type}. ${whyLine(R)}`)}</p><p class="gp"><span class="d">Recipes you have found:</span></p><p>${recs.map(ids => ids.map(x => esc(card(x).name)).join(' + ')).join('<br>')}</p>` : `<p>${esc(hint)}</p>`, 'bar')
      + lb(404, 26, 'PAGES FOUND', 'g') + lbr(620, 26, `${found.size} OF ${X.list.length}`) + tally(404, 40, 216, X.types.map(t => [String(t).toUpperCase(), byType(t).filter(Rr => found.has(Rr.id)).length]).slice(0, 9)), 188); }
  else { const tiles = list.map((Rr, k) => found.has(Rr.id) ? psCard({ id: Rr.id }, 9 + (k % 12) * 50, 3 + Math.floor(k / 12) * 63, { attrs: `data-a="cxopen:${Rr.id}" data-k="cx${Rr.id}"`, badge: found.get(Rr.id).length }) : `<button class="cd unk" style="left:${9 + (k % 12) * 50}px;top:${3 + Math.floor(k / 12) * 63}px" data-a="cxopen:${Rr.id}" data-k="cx${Rr.id}" aria-label="Not found yet"><i class="n1">?</i></button>`).join(''), rows = Math.ceil(list.length / 12);
    top = bookTop('CODEX', `${none ? 'NONE FOUND YET · ' : ''}${found.size} OF ${X.list.length} RESULTS FOUND${total > 120 ? ` · SHOWING 120 OF ${total}` : ''}`, `<div class="ab gsc" data-sk="codex" data-row="63" style="left:8px;top:24px;width:614px;height:320px"><div class="gin" style="height:${Math.max(318, rows * 63 + 3)}px">${tiles || `<b class="ab lb d" style="left:8px;top:8px">NOTHING HERE YET. MELD TWO MONSTERS IN A DUEL TO WRITE THE FIRST PAGE.</b>`}</div></div>`); }
  const cells = [R ? { k: 'B', t: 'CLOSE THE PAGE', a: 'cxclose', lit: true } : null, { t: 'FOUND', a: 'cxview:found', cls: v.view === 'found' ? 'on' : '' }, { t: 'ALL', a: 'cxview:all', cls: v.view === 'all' ? 'on' : '' }].filter(Boolean);
  const kinds = X.types.map(t => ({ t: `${t} ${byType(t).filter(Rr => found.has(Rr.id)).length}/${byType(t).length}`, a: `cxtype:${t}`, cls: v.type === t ? 'on' : '' }));
  const rows = [...rowsOf(cells, 4), ...rowsOf(kinds, 4), ...footRows4(R ? tbookFoot('codex', [null]).map((c, i) => i === 1 ? null : c) : tbookFoot('codex', [{ t: 'OPEN PAGE', a: 'acur', off: true, cls: 'aslot', ka: true }]))], ft = { y0: 360 - (rows.length * 21 + 11), html: foot(360 - (rows.length * 21 + 11), rows, 4) };
  const words = `<p>${G.known.size} recipes written. A page you have found shows why the meld works, so you can make it again from other cards.</p><p class="gp">Runs ${P.runs}. Clears ${P.clears}. Duels won ${P.duelWins}. Guardians beaten ${P.bossWins}. Memories earned ${P.earned}.</p>`
    + (rumours() ? `<p class="gp"><span class="d">Rumours: ${heard.length} of ${BOSSES.flat().length} memories heard.</span></p>${heard.map(b => `<p>${esc(b.name)}: ${esc(SCENES['memory:' + b.id].lines[0])}</p>`).join('')}` : '');
  return two(top, pagerB(0, 0, 413, ft.y0, words) + ft.html);
}
function overDual({ head, unl, tally, mem, ach = [] }) {
  const r = G.run, R = G.results, fs = R ? R.feats : [], pts = ach.reduce((n, x) => n + AC.PTS(x.tier), 0), cells = AC.runEndCells(ach, fs), hid = cells.slice(6);
  const kind = hid.every(c => c.seal) ? 'ACHIEVEMENTS' : hid.every(c => !c.seal) ? 'FEATS' : 'ROWS', below = hid.length && ach.length ? lb(8, 176, `${AC.numWord(hid.length)} MORE ${hid.length === 1 ? kind.replace(/S$/, '') : kind} BELOW`, 'd') : ''; // the list's own marker, after its heading, points to them
  const plq = [{ t: 'NEW RUN', a: 'new', lit: true }, { k: 'X', t: 'CODEX', a: 'screen:codex' }, { k: 'Y', t: 'FEATS', a: 'screen:feats' }, { t: `VAULT ${P.memories}`, a: 'screen:vault' }, { k: 'B', t: 'TITLE', a: 'home' }];
  return two(bookTop(head, R ? `+${R.total} MEMORIES` : 'ALREADY BANKED', pagerB(10, 24, 610, 320, tally + mem + (ach.length ? AC.runEndTop(ach) : '') + unl, 'bar')),
    descentWide(0, r) + (ach.length ? holdDeckB(76, 276, r, { read: false, head: 'EARNED THIS RUN', headR: `${ach.length} ACHIEVEMENT${ach.length === 1 ? '' : 'S'} · +${pts} POINTS`, rows: cells, sk: 'over', deckHead: 'THE DECK YOU CARRIED', walk: true }) + below
      : holdDeckB(76, 276, r, { read: false, head: 'FEATS THIS RUN', headR: fs.length ? 'THEY COUNT ACROSS RUNS' : '', rows: fs.map(f => ({ name: f.name, sub: f.done ? 'COMPLETE' : `${f.after} / ${f.goal}${f.gain ? ` (+${f.gain})` : ''}`, gold: f.done })), none: 'NO FEAT MOVED THIS RUN', sk: 'over', deckHead: 'THE DECK YOU CARRIED', walk: true })) + footOf(276, plq));
}
// ---- windows on two frames. Nothing lies over a frame: a question or a short list takes the bottom frame and leaves
// the top one as it stands (the table is never covered); a book takes both, its open page on the top frame and its list
// on the bottom one; a story scene shows its painting on the top frame and its words on the bottom one.
// A scene with no painting, only a speaker's face, sets your own face against it so the dark view is not left bare.
// Gives back { top, bottom, over } for what is open, each one only when it takes that frame's place, or nothing.
// A sheet of words on the bottom frame: its name, the words in a window, the plaques. A sheet with few words (lines:
// how many rows of text its window is given) leaves the rest of the frame to the run it is asked about.
const sheetB = (title, html, cells, right = '', lines = 0) => { const rows = rowsOf(cells.filter(Boolean), 3), y0 = 360 - (rows.length * 28 + 8), r = G.run && G.run.deck.length ? G.run : null, bf = lines && G.run && !r;
  const v = lines && r ? Math.max(1, Math.floor((y0 - 22 - lines * 16 - 12 - 23) / 63)) : 0, th = v ? y0 - 22 - 23 - 63 * v : bf ? lines * 16 + 12 : y0 - 22; // the deck under the words, in whole rows; the words take what is left
  return box(0, 0, 413, 22, 'st dk') + lb(8, 7, title, 'g') + (right ? lbr(405, 7, right, 'd') : '') + pagerB(0, 22, 413, th, html) + (bf ? beforeB(22 + th, y0, G.run) : '')
    + (v ? box(0, 22 + th, 413, 18, 'st dk') + lb(6, 27 + th, 'YOUR DECK, STRONGEST FIRST', 'g') + lbr(407, 27 + th, `${r.deck.length} CARDS`) + gridB(r.deck, { y: 40 + th, h: 5 + 63 * v, verb: null, sk: 'sheet' }) : '') + foot(y0, rows); };
// A scene told on two frames: the top frame is a room's frame with the painting (or the speaker's face) in its window on
// black and the words in the window under it, where the letters are largest; the pillars keep the run. The bottom frame
// shows what is carried into what comes next: the relics by name and the deck, or, before a run, the record so far.
function tellTop(r, inner, head, sub, text, verb) {
  const inert = h => noPq(h).replace(/ data-a="[^"]*"/g, ' tabindex="-1"');
  return `<div data-a="${verb}">${frame({ left: r ? inert(psYou(r)) : '', right: r ? inert(psRight(r, '', { bare: !!r.deck.length, note: (() => { const b = BOSSES[r.floor] && BOSSES[r.floor][r.bossOrder[r.floor]]; return !b ? '' : r.deck.length ? lb(8, 144, 'GUARDIAN', 'g') + psPort(faceOfName(b.name), 14, 156) + nameLines(b.name, 84, 2).map((x, i) => lb(8, 234 + i * 10, esc(x))).join('') : lb(8, 262, 'GUARDIAN', 'g') + psPort(faceOfName(b.name), 14, 276); })() })) : '', view: `<i class="ab" style="left:0;top:0;width:440px;height:248px;background:#000"></i>${inner}`,
    tall: `<b class="lb g th">${esc(String(head).toUpperCase())}${sub ? ` <span class="d">· ${sub}</span>` : ''}</b><div class="pgw" data-pager><p>${text}</p></div>` })}</div>`;
}
function tellBottom(r, cells, told = []) {
  const rows = rowsOf(cells.filter(Boolean), 3), fy = 360 - (rows.length * 28 + 8);
  if (r && r.deck.length) return holdDeckB(0, fy, r, { read: false }) + foot(fy, rows);
  const f = r && r.forger ? FORGERS[r.forger] : null, y2 = f ? 232 : fy; // before the first card: the record, what was told, and the Forger going down
  if (f && !told.length) return beforeB(0, fy, r) + foot(fy, rows); // nothing told yet: the Forger's words and kits have the room
  const rec = [['RUNS', P.runs], ['CLEARS', P.clears], ['DUELS WON', P.duelWins], ['GUARDIANS BEATEN', P.bossWins], ['FORGERS', `${P.forgers.length} OF ${FORGER_IDS.length}`], ['MEMORIES', P.memories]];
  return box(0, 0, 413, 96, 'st') + lb(8, 8, 'YOUR RECORD', 'g') + rec.map(([k, v], i) => lb(8 + (i % 2) * 206, 26 + (i >> 1) * 22, k, 'g') + lbr(198 + (i % 2) * 206, 26 + (i >> 1) * 22, v)).join('')
    + (box(0, 96, 413, y2 - 96, 'wn') + lb(8, 104, 'TOLD SO FAR', 'g') + txb(8, 118, 397, y2 - 126 - (y2 - 126) % 16, told.length ? told.slice(-6).map(t => `<p class="d">${esc(t)}</p>`).join('') : '<p class="d">Nothing yet. This is where it begins.</p>')
      + (f ? box(0, y2, 413, fy - y2, 'wn') + lb(8, y2 + 6, 'WHO GOES DOWN', 'g') + txb(8, y2 + 18, 397, fy - y2 - 22 - (fy - y2 - 22) % 16, `<p>${esc(ruleText(f.rule))}</p><p class="d">${esc(f.power)}: ${esc(f.powerText)}</p>`) : ''))
    + foot(fy, rows);
}
function menuPanel(a, r) {
  const rows = (y, list) => list.map(([k, v], i) => lb(210, y + i * 12, k, 'g') + lbr(398, y + i * 12, v)).join(''), words = (y, t) => txb(210, y, 190, 160, `<p>${esc(t)}</p>`);
  if (a === 'tab:deck' && r) { const mons = r.deck.filter(e => db.isMonster(e.id)).length, kinds = {}; for (const e of r.deck) if (db.isMonster(e.id)) kinds[card(e.id).type] = (kinds[card(e.id).type] || 0) + 1;
    return panelB('THE DECK', rows(32, [['MONSTERS', mons], ['OTHER CARDS', r.deck.length - mons], ...Object.entries(kinds).sort((p, q) => q[1] - p[1]).slice(0, 8).map(([k, n]) => [String(k).toUpperCase(), n])]) + words(168, r.phase === 'chamber' ? 'Every card you carry. Here you can swap a deck card for one in the trunk.' : 'Every card you carry.')); }
  if (a === 'tab:relics' && r) { const rel = relicList(r), n = k => rel.filter(id => RELICS[id].kind === k).length;
    return panelB('THE RELICS', rows(32, [['GIFTS', n('G')], ['MASTERWORKS', n('M')], ['READY AT AN ANVIL', possibleMasterworks(r).length]]) + words(80, 'Every charm, Gift and Masterwork you hold, each read whole.')); }
  if (a === 'tab:duel' && r) { const rv = G.shown ? G.shown.rival : info(r); return panelB('THIS DUEL', txb(210, 32, 190, 112, `<p>${esc(rv.styleText || '')} The rival's Law, the bounty, your Forger's Power and the last moves.</p>`) + lb(210, 152, G.log.length ? 'THE LAST MOVES' : 'NO MOVES YET', 'g') + txb(210, 164, 190, 96, G.log.slice(-3).map(t => `<p class="d">${esc(t)}</p>`).join('') || '<p class="d">The moves of the duel are told there as they are made.</p>')); }
  if (a === 'speed') return panelB('SPEED', rows(32, [['NOW', G.fast ? 'FAST' : 'NORMAL']]) + words(52, 'How fast a move plays out on the table. Fast plays every beat at twice the pace. Nothing else changes.'), true, 124);
  if (a === 'quit' && r) { const w = worth(r); return panelB('LEAVE THE RUN', rows(32, [['MEMORIES KEPT', w.total], ['DUELS WON', r.stats.wins]]) + words(64, 'Leaving ends this run as a loss. You are asked once more before it ends.'), false); }
  if (a === 'tab:') return panelB('CLOSE', words(32, 'Back to where you were.'), true, 56);
  return titlePanel(a, null);
}
function dualWindows(s) {
  const r = G.run;
  if (G.story && !G.playing && !G.overlay) { const st = G.story, sc = SCENES[st.id], sp = storyPic(st.id, st.i), big = sp && CART.has(sp + '-l'), pw = big ? 390 : 312, ph = big ? 160 : 128, fc = !sp && sc.face && CART.has(sc.face + '-96') ? sc.face + '-96' : null;
    const pic = sp ? `<img class="ab spic" src="${cimg(big ? sp + '-l' : sp)}" style="left:${(440 - pw) >> 1}px;top:${(248 - ph) >> 1}px" width="${pw}" height="${ph}" alt="">` : fc ? (() => { const me = r && r.forger && CART.has(faceName(r.forger) + '-96') ? faceName(r.forger) + '-96' : null, at = (n, x) => `<div class="pf s96" style="left:${x}px;top:74px"><img src="${cimg(n)}" width="96" height="96" alt=""></div>`; return me ? at(me, 60) + at(fc, 280) : at(fc, 170); })() : '';
    return { top: tellTop(r, pic, sc.who || 'The pyramid', `${st.i + 1} OF ${sc.lines.length}`, esc(sc.lines[st.i]), 'storynext'), bottom: tellBottom(r, [{ t: 'GO ON', a: 'storynext', lit: true }, { k: 'B', t: 'SKIP', a: 'storyskip' }], sc.lines.slice(0, st.i)) }; }
  const fc = G.floorCard; if (fc && r && fc.u === uidOf(r) && fc.n === r.floor + 1 && r.phase === 'chamber' && !G.playing && !G.overlay) { const big = CART.has('story-stair-l'), pw = big ? 390 : 312, ph = big ? 160 : 128, y = 44 + ((160 - ph) >> 1);
    const name = ['', 'FLOOR ONE', 'FLOOR TWO', 'FLOOR THREE'][fc.n] || 'FLOOR ' + fc.n, ct = carve(name, 24, render), boss = BOSSES[r.floor] && BOSSES[r.floor][r.bossOrder[r.floor]];
    return { top: tellTop(r, `${ct ? `<img class="ab" src="${ct.url}" width="${ct.w}" height="${ct.h}" style="left:${(440 - ct.w) >> 1}px;top:${y - 30}px" alt="${esc(name)}">` : ''}${CART.has('story-stair') ? `<img class="ab spic" src="${cimg(big ? 'story-stair-l' : 'story-stair')}" style="left:${(440 - pw) >> 1}px;top:${y + 4}px" width="${pw}" height="${ph}" alt="">` : ''}`,
      ct ? 'The stair down' : name, `SIX CHAMBERS`, esc(`The stair goes down to ${name.toLowerCase()}.${boss ? ` Its Guardian: ${boss.name}.` : ''} Two seals open the Guardian's door, one from each duel you win here.`), 'floorok'),
      bottom: tellBottom(r, [{ t: 'GO ON', a: 'floorok', lit: true }]) }; }
  const o = G.overlay;
  if (o && !G.playing) {
    if (o.kind === 'leave') { const run = o.saved || r, w = worth(run), S = run.stats, cells = o.saved ? [{ t: 'CONTINUE IT', a: 'resume', lit: true }, { k: 'X', t: 'BANK IT, NEW', a: 'bankold' }, { k: 'B', t: 'BACK', a: 'closeov' }] : [{ k: 'B', t: 'KEEP PLAYING', a: 'closeov', lit: true }, { k: 'X', t: 'LEAVE AND BANK IT', a: 'abandon' }];
      const rows = rowsOf(cells, 3), y0 = 360 - (rows.length * 28 + 8);
      if (!o.saved) return { bottom: sheetB('LEAVE THE PYRAMID?', `<p>Leaving ends this run as a loss.</p><p class="gp">You keep ${w.total} Memories, ${S.wins} duel${S.wins === 1 ? '' : 's'} won and your feat progress.</p>`, cells, '', 3) };
      return { bottom: descentB(0, 0, 205, y0, run, o.saved ? 'A RUN IN PROGRESS' : 'THIS DESCENT') + box(205, 0, 208, y0, 'wn') + lb(213, 8, o.saved ? 'START A NEW RUN?' : 'LEAVE THE PYRAMID?', 'g')
        + txb(213, 24, 190, y0 - 40, `<p>${o.saved ? 'Starting a new run ends this one.' : 'Leaving ends this run as a loss.'}</p><p class="gp">You keep ${w.total} Memories, ${S.wins} duel${S.wins === 1 ? '' : 's'} won and your feat progress.</p>`) + foot(y0, rows) }; }
    if (o.kind === 'heat') return { bottom: sheetB(`HEAT ${o.n}`, HEAT_RULES.filter(x => x.n <= o.n).map(x => `<p><b class="lb g">${x.n}. ${esc(x.name)}</b><br>${esc(x.text)}</p>`).join(''), [{ k: 'B', t: 'CLOSE', a: 'closeov', lit: true }], `MEMORIES +${o.n * 20}%`, 5) };
    if (o.kind === 'moved') return { bottom: sheetB('THIS RUN MOVED ON', '<p>The run was ended or carried on in another tab or window. Nothing was changed from here.</p>', [{ t: 'BACK TO THE START', a: 'leavetab', lit: true }], '', 3) };
    if (o.kind !== 'duelEnd') return null; // over the end of a duel its sheet and the menu still open
  }
  const t = G.tab; if (!t) return null;
  if (t === 'menu') { const duel = r && (r.phase === 'duel' || G.shown);
    const items = [r && ['DECK', 'tab:deck', 'X'], r && ['RELICS', 'tab:relics', 'Y'], duel && ['THIS DUEL', 'tab:duel'], duel && [G.fast ? 'SPEED: FAST' : 'SPEED: NORMAL', 'speed'], ['HOW TO PLAY', 'tab:help'], ['OPTIONS', 'tab:options'], r && ['LEAVE THE RUN', 'quit'], ['CLOSE', 'tab:', 'B']].filter(Boolean);
    const at = G.look && G.look.startsWith('m:') && items.some(x => x[1] === G.look.slice(2)) ? G.look.slice(2) : items[0][1];
    return { bottom: menuB(items, menuPanel(at, r)) }; }
  if (t === 'help') { const pages = helpPages(), at = lookRow(pages.length), ft = foot4(bookFoot('help', [{ t: 'SHOW FIRST LESSONS', a: 'relearn' }, null]));
    const keys = [['D-PAD', 'Moves the cursor, on both screens'], ['A', 'Presses what the cursor is on'], ['B', 'Back, undo, put away'], ['X', "The screen's other main action"], ['Y', 'Look closer: a book or a sheet'], ['L1 R1', 'The one before, the next one'], ['L2 R2', 'Page long words'], ['START', 'The menu, and out of a book']];
    const side = lb(332, 32, 'THE PAD', 'g') + keys.map(([k, t], i) => lb(332, 49 + i * 22, k, 'g') + lb(380, 49 + i * 22, t.toUpperCase())).join('') + lb(332, 232, 'ON A PLAQUE', 'g') + txb(332, 244, 288, 96, '<p class="d">A key shown beside a plaque presses that plaque. The lit plaque is the one A presses.</p>');
    return { top: pageSide('HOW TO PLAY', bookOf('help'), '', pages[at][0], `PAGE ${at + 1} OF ${pages.length}`, `<p>${padWords(pages[at][1])}</p>` + pages.slice(at + 1).map(q => `<p class="gp"><span class="d">${esc(q[0][0] + q[0].slice(1).toLowerCase())}. ${padWords(q[1])}</span></p>`).join(''), side),
      bottom: listRecordB(ft.y0, 'THE RULES, A PAGE AT A TIME', '', pages.map((p, i) => ({ name: p[0], sub: `PAGE ${i + 1}`, a: 'nop', look: 'b:' + i, k: 'b' + i, n0: i === at })), { sk: 'help' }) + ft.html }; }
  if (t === 'options' || t === 'sound') { const keys = labKeys(), at = lookRow(keys.length), k = keys[at], isOn = x => !!(pref[x] || (pref.depth && DEPTH_SET.includes(x))), ft = foot4(bookFoot('options', [{ t: 'SWITCH IT', a: 'acur', off: true, cls: 'aslot', ka: true }]));
    return { top: bookTop('OPTIONS', bookOf('options'), lb(16, 32, 'SOUND', 'g') + `<div id="soundslot" class="soundslot ab" style="left:16px;top:46px;width:264px"></div>` + lb(300, 32, `LAB SWITCH ${at + 1} OF ${keys.length}`, 'g') + txb(300, 46, 320, 80, '<p class="d">Experiments, each one a change to the rules. The list below holds them all.</p>')
        // the switch under the cursor read whole at the left; at the right the pad's keys and their stand-ins on a keyboard
        + pagerB(10, 136, 306, 208, `<p>${esc(LABS[k])}${pref.depth && DEPTH_SET.includes(k) && !pref[k] ? ' (On through the depth set.)' : ''}</p><p class="gp"><span class="d">A run in progress keeps the rules it started with.</span></p>`, 'bar')
        + `<i class="ab" style="left:322px;top:140px;width:1px;height:200px;background:var(--dark)"></i>` + lb(332, 142, 'THE PAD', 'g') + lbr(620, 142, 'ON A KEYBOARD', 'd')
        + [['D-PAD', 'MOVE THE CURSOR', 'ARROWS'], ['A', 'PRESS THE LIT PLAQUE', 'ENTER'], ['B', 'BACK, UNDO', 'ESC'], ['X', "THE SCREEN'S OTHER ACTION", 'X'], ['Y', 'LOOK CLOSER', 'Y'], ['L1 R1', 'BEFORE, NEXT', 'Q E'], ['L2 R2', 'PAGE UP, DOWN', '[ ]'], ['START', 'THE MENU', 'M']]
          .map(([key, does, kb], i) => lb(332, 160 + i * 22, key, 'g') + lb(376, 160 + i * 22, does) + lbr(620, 160 + i * 22, kb, 'd')).join('')),
      bottom: rowsB(0, ft.y0, 'LAB SWITCHES', `${keys.filter(isOn).length} OF ${keys.length} ON`, keys.map((x, i) => ({ name: String(LABS[x]).split(/[.:,(]/)[0], sub: isOn(x) ? 'ON' : 'OFF', on: isOn(x), a: `lab:${x}`, look: 'b:' + i, k: 'b' + i, n0: i === at })), { sk: 'options' }) + ft.html }; }
  if (!r) return null;
  if (t === 'relics') { const list = relicList(r), at = lookRow(list.length), id = list[at], rows = footRows4(bookFoot('relics')), fy = 360 - (rows.length * 21 + 11), ready = possibleMasterworks(r);
    const fams = {}; for (const x of list) { const f = FAMILY_NAME[RELICS[x].family]; if (f) fams[f.toUpperCase()] = (fams[f.toUpperCase()] || 0) + 1; }
    const kinds = k => list.filter(x => RELICS[x].kind === k).length, fr = Object.entries(fams).sort((p, q) => q[1] - p[1]).slice(0, 8);
    const side = lb(404, 26, 'WHAT YOU HOLD', 'g') + lbr(620, 26, `${list.length} IN ALL`) + tally(404, 40, 216, [['CHARMS', r.charms.length], ['CHARM PLACES', db.config.charmSlots], ['GIFTS', kinds('G')], ['MASTERWORKS', kinds('M')], ...fr.slice(0, 3)]);
    const sub = id ? kindWord(id) + (FAMILY_NAME[RELICS[id].family] ? ' · ' + esc(FAMILY_NAME[RELICS[id].family].toUpperCase()) : '') : '', anvil = `<p class="d">${ready.length ? 'Ready to forge at an Anvil: ' + ready.map(x => esc(RELICS[x].name)).join(', ') + '.' : 'No Masterwork is ready at an Anvil yet.'}</p>`;
    return { top: id ? pageTop('YOUR RELICS', bookOf('relics'), medal(id, 64), RELICS[id].name, sub, `<p>${esc(RELICS[id].text)}</p>${anvil}`, side) : pageTop('YOUR RELICS', bookOf('relics'), '', 'None yet', '', `<p>Gifts come with Forge levels, charms from the pyramid.</p>${anvil}`, side),
      bottom: holdDeckB(0, fy, r, { look: true, grid: false, headR: `${at + 1} OF ${Math.max(1, list.length)}` }).replace(/data-look="r:([a-z0-9_]+)"/g, (m, x) => { const i = list.indexOf(x); return `data-look="b:${i}" data-k="b${i}"${i === at ? ' data-n0' : ''}`; }) + foot(fy, rows, 4) }; }
  if (t === 'deck') { if (!/^[dt]:/.test(G.look || '') || !lookOf()) G.look = r.deck.length ? 'd:' + firstOf(r.deck) : null; // the page opens on the card the cursor starts on
    const L = lookOf(), one = G.pickDeck != null || G.pickTrunk != null, kinds = {}, wt = deckWeight(db, r.deck), cap = weightCap(db, r);
    for (const e of r.deck) { const k = db.isMonster(e.id) ? 'MONSTERS' : String(roleOf(db, e.id)).toUpperCase(); kinds[k] = (kinds[k] || 0) + 1; }
    const hint = r.phase === 'chamber' ? (one ? 'Now choose the card to swap it with. B puts it back.' : 'Cards you take go to your trunk. Choose a deck card, then a trunk card, to swap them.') : 'You can swap cards with the trunk in a chamber.';
    const copies = L && L.inst ? r.deck.filter(e => e.id === L.inst.id).length : 0, inTrunk = /^t:/.test(G.look || '');
    const heavy = [...r.deck].sort((p, q) => weightOf(db, q.id) - weightOf(db, p.id)).slice(0, 8); // a short trunk leaves room beside it for the cards that weigh most
    const page = !r.deck.length ? psPort(r.forger ? faceName(r.forger) : '', 12, 32) + lb(92, 36, 'NO CARDS YET', 'g') + txb(92, 50, 220, 48, '<p class="d">The kit you choose is your first deck.</p>') + lb(12, 112, 'THE KITS', 'g') + ((r.forger && FORGERS[r.forger].kits) || []).slice(0, 4).map((k, i) => lb(12, 126 + i * 22, fitName(k.name, 30)) + lb(172, 126 + i * 22, fitName((k.types || []).join(' · '), 28), 'd')).join('') : L ? bigCard(L.inst, 12, 30) + `<b class="ab lb g" data-name="${esc(L.name)}" style="left:128px;top:32px;width:190px;white-space:normal">${nameLines(L.name, 186, 2).map(esc).join('<br>')}</b>` + pagerB(122, 56, 196, 128, L.lines.map(x => `<p>${esc(x)}</p>`).join('') + `<p class="d">${inTrunk ? 'In the trunk.' : copies > 1 ? `${copies} copies in the deck.` : 'One copy in the deck.'} Weight ${weightOf(db, L.inst.id)}.</p>`, 'bar') : '';
    const act1 = r.phase === 'chamber' ? { t: one ? 'SWAP' : 'PICK UP', a: 'pickcur', for: 'deckpick trunkpick' } : { t: 'PICK UP', a: 'nop', off: true };
    return { top: bookTop('YOUR DECK', bookOf('deck'), page + lb(12, r.deck.length ? 192 : 216, `TRUNK · ${r.trunk.length} CARD${r.trunk.length === 1 ? '' : 'S'}`, 'g')
        + (r.trunk.length > 6 ? gridB(r.trunk, { x: 8, y: 204, cols: 6, h: 131, verb: i => r.phase === 'chamber' ? `trunkpick:${i}` : 'nop', look: i => `t:${i}`, sel: G.pickTrunk, kp: 't', sk: 'trunk' })
          : (r.trunk.length ? gridB(r.trunk, { x: 8, y: 204, cols: 3, h: 131, verb: i => r.phase === 'chamber' ? `trunkpick:${i}` : 'nop', look: i => `t:${i}`, sel: G.pickTrunk, kp: 't', sk: 'trunk' }) : txb(12, r.deck.length ? 204 : 228, heavy.length ? 150 : 300, 64, '<p class="d">The trunk is empty. Cards you take go to your trunk.</p>'))
            + (heavy.length ? lb(180, 192, 'HEAVIEST CARDS', 'g') : '') + heavy.map((e, i) => lb(180, 208 + i * 14, esc(fitName(card(e.id).name, 18))) + lbr(314, 208 + i * 14, weightOf(db, e.id))).join(''))
        + `<i class="ab" style="left:322px;top:28px;width:1px;height:316px;background:var(--dark)"></i>` + lb(332, 32, 'WEIGHT', 'g') + lbr(620, 32, `${wt}/${cap}`) + gauge(332, 42, 288, wt / cap, 'w' + (wt > cap ? ' over' : ''))
        + txb(332, 54, 288, 32, `<p class="d">Every card has a weight. This deck may carry ${cap}.</p>`) + lb(332, 96, 'WHAT IS IN IT', 'g') + lbr(620, 96, `${r.deck.length} CARDS`)
        + tally(332, 110, 288, Object.entries(kinds).sort((p, q) => (q[0] === 'MONSTERS') - (p[0] === 'MONSTERS') || q[1] - p[1]).slice(0, 8).concat(r.deck.length ? [] : ['MONSTERS', 'EQUIP', 'FIELD', 'TRAP', 'SPELL', 'FUEL'].map(k => [k, 0]))) + lb(332, 232, 'SWAPPING', 'g') + txb(332, 244, 288, 96, `<p>${hint}</p>`)),
      bottom: (r.deck.length ? gridB(r.deck, { y: 0, h: 320, verb: i => r.phase === 'chamber' ? `deckpick:${i}` : 'nop', look: i => `d:${i}`, sel: G.pickDeck, sk: 'deck', n1: true }) : beforeB(0, 320, r))
        + foot(320, footRows4([...bookFoot('deck', [{ ...act1, ka: true }], one)]), 4) }; }
  if (t === 'duel') { const rv = G.shown ? G.shown.rival : G.overlay && G.overlay.rival ? G.overlay.rival : info(r), v = r.duel ? viewFor(r.duel, db, 0) : null, log = G.log.slice(-8);
    const words = `${rv.styleText ? `<p>${esc(rv.styleText)}</p>` : ''}${rv.lawText ? `<p><b class="lb g">LAW</b> ${esc(lawShown(rv.lawText))}</p>` : ''}${rv.twist ? `<p>${{ fog: 'Fog: monsters arrive veiled.', narrow: 'Narrow Pass: three zones.', storm: 'Storm Front: terrain shifts every third turn.', locked: 'Locked terrain.' }[rv.twist]}</p>` : ''}<p><b class="lb g">BOUNTY</b> ${esc(rv.bountyText || '')}</p>${v && v.forger ? `<p><b class="lb g">${esc(FORGERS[v.forger].name)}</b> ${esc(ruleText(FORGERS[v.forger].rule))}</p><p><b class="lb g">${esc(FORGERS[v.forger].power)}</b> ${v.rs.power ? 'Used this duel.' : esc(FORGERS[v.forger].powerText)}</p>` : ''}`, moves = `<p><b class="lb g">${log.length ? 'THE LAST MOVES' : 'NO MOVES YET'}</b>${log.length ? '' : ' <span class="d">The last eight moves of the duel are told here as they are made.</span>'}</p>${log.length ? `<p>${log.map(esc).join(' ')}</p>` : ''}`; // the moves run on as one paragraph: short lines one under another would leave half the window bare
    // the words in a window of twelve lines, and under it what you carry into the fight: the relics and the strongest cards
    // Few words (nine lines or fewer) leave the window seven lines and the deck two whole rows, so no part of the frame stands bare.
    const few = (words + moves).split('</p>').reduce((n, x) => n + Math.ceil(x.replace(/<[^>]+>/g, '').length / 44), 0) <= 9; // up to nine lines: the seven-line window pages the last ones
    return { bottom: box(0, 0, 413, 22, 'st dk') + lb(8, 7, 'THIS DUEL', 'g') + (few ? pagerB(0, 22, 413, 116, words + moves) + stripB(138, r, true) + box(0, 168, 413, 18, 'st dk') + lb(6, 173, 'YOUR DECK, STRONGEST FIRST', 'g') + gridB(r.deck, { y: 186, h: 131, sk: 'duelsheet' })
        : pagerB(0, 22, 413, 196, words + moves) + stripB(218, r, true) + deckStripB(248, 'YOUR STRONGEST CARDS', r.deck, null))
      + foot(few ? 317 : 324, [[{ k: 'B', t: 'CLOSE', a: 'tab:' }, { k: 'X', t: G.fast ? 'SPEED: FAST' : 'SPEED: NORMAL', a: 'speed' }, { k: 'START', t: 'MENU', a: 'tab:menu' }]]) }; }
  return null;
}

// Which screens are drawn the console way. Everything else keeps the old look for now.
function psScreen() {
  if (look === 'old' || lostStore) return null;
  const r = G.run;
  if (G.screen === 'forger') return psForger;
  if (G.screen) return { codex: psCodex, feats: psFeats, vault: psVault, ach: psAch }[G.screen] || null;
  if (!r) return psHome;
  if (G.forge) return psForge; // the hammer is still falling on the last working
  if (G.shown || r.phase === 'duel' || endShown()) return psDuel;
  if (r.phase === 'chamber') return psChamber;
  if (r.phase === 'kit') return psKit;
  if (r.phase === 'charm') return psCharm;
  if (r.phase === 'reward' && r.offer && ['card', 'gift', 'charm', 'guardian', 'treasure', 'sanctum'].includes(r.offer.kind)) return psReward;
  if (r.phase === 'reward' && r.offer && r.offer.kind === 'omen') return psOmen;
  if (r.phase === 'anvil') return psAnvil;
  if (r.phase === 'over') return psOver;
  if (r.phase === 'bazaar') return psBazaar;
  return null;
}
// Randall's materials (tools/crucible/console-art.py cuts them from his sheet): the pillars, the window surround, the ledge,
// every window and every plaque take them once the pictures are in. Until then, or without them, the dotted colours stand.
const MATS = ['st', 'dk', 'wn', 'lg', 'pq', 'lit', 'lit2', 'off', 'on'];
let matsOn = false;
function setMats() {
  if (matsOn || !packDone || !MATS.every(n => CART.has('mat-' + n))) return;
  matsOn = true; for (const n of MATS) app.style.setProperty('--m-' + n, `url("${cimg('mat-' + n)}")`);
  app.classList.add('mats');
}
function drawConsole(screen) {
  if (DUAL) { drawDual(screen); return; }
  app.classList.add('ps'); app.classList.remove('phone', 'era'); document.body.classList.add('ps'); fitConsole(app); setMats(); // the frame's size first: the screen is laid out for it
  const r = G.run, keep = scrollKeep();
  // the save bar and a short message take the text bar's place and width in this frame (the bar: 40 pixels at its foot, between the pillars)
  app.innerHTML = `${screen()}${psWindows()}${store.failed.size ? `<div class="savebar" style="width:${F.W - 192}px"><b>NOT SAVED.</b> This device would not store your progress. <button class="pq" style="position:relative;display:inline-block" data-a="resave">TRY AGAIN</button></div>` : ''}<div id="toast" class="toast" style="top:${F.H - 40}px;width:${F.W - 192}px">${esc(G.toast)}</div>`;
  app.dataset.phase = r ? (G.shown || endShown() ? 'duel' : r.phase) : 'home'; app.dataset.room = '';
  // While words are told over a screen, the screen holds still; under a painting it goes dark, so nothing of it shows round it.
  const st = app.querySelector('.story'); app.classList.toggle('stup', !!st); app.classList.toggle('stblk', !!(st && st.classList.contains('sblk')));
  // Every endless loop (a cursor's bob, a lit plaque, the fog) keeps time with the clock, not with the drawing: a screen
  // drawn again, as when the cursor moves, carries each loop on from where it was instead of starting it over.
  for (const a of app.getAnimations({ subtree: true })) if (a.playState === 'running' && a.effect && a.effect.getTiming().iterations === Infinity) a.startTime = 0;
  if (document.getElementById('prop')) { propTextures(); propPaint(); }
  if (document.getElementById('forge')) { propTextures(); convertSheets(40); forgePaint(); }
  if (document.getElementById('coin')) coinLoop();
  if (document.getElementById('tbl')) { psTextures(); convertSheets(40); psPaint(true); psLoop(); }
  else convertSheets(40);
  { const slot = $('#soundslot'); if (slot && window.LMAudio && window.LMAudio.panel) { try { slot.appendChild(window.LMAudio.panel()); } catch (e) { slot.textContent = 'Sound is not available in this browser.'; } } }
  barFits(); fitScrolls(keep); gridLines();
  if (!drawConsole.fonts && document.fonts) { // a text face may arrive after the drawing that first asks for it (the body face only with the first page of words): measure again
    drawConsole.fonts = 1; const again = () => { if (app.classList.contains('ps')) { barFits(); fitScrolls(); gridLines(); } }; pixelText();
    document.fonts.ready.then(again); if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', again); }
  achPaint(); fit();
}
// A box of pages that scrolls, in a window or a book, shows whole lines and only whole lines, and its window closes up
// under it, so no empty band is left in it. When the screen is drawn, the box's height is cut from the one the screen gave
// it (data-max) to the foot of the last line, card or row it can show whole; the plaques along the window's foot move up
// to eight pixels under it, and the window is that much shorter and stands in the middle of the room it had. The box keeps
// that height while it is read: a scroll comes to rest only where a whole line stands at its top and a whole line ends at
// its foot (its rests). The lists are laid on lines of 16 pixels (cards on rows of 64), so a rest comes every line or two,
// and of the heights near the largest the box takes one at which every line can be read whole at some rest. While more
// lies below, a marker bobs under its right end, as under the text bar.
function scrollAtoms(sc) {
  const out = [], yOf = e => { let y = 0; for (let q = e; q && q !== sc; q = q.offsetParent) y += q.offsetTop; return y; };
  // A button of a line or two is kept whole; a switch with a paragraph beside it (.lab) may be cut between its lines.
  const whole = c => /^(IMG|CANVAS|INPUT)$/.test(c.tagName) || (c.tagName === 'BUTTON' && c.offsetHeight <= 40 && !c.classList.contains('lab')) || c.classList.contains('cd') || c.classList.contains('coin') || c.classList.contains('ga') || c.classList.contains('big');
  // Each line of words is found where the browser set it, from the middle of its box on the screen, and taken as the line
  // of its block it stands in (the block's lines are its line height apart from the top of its content), so a name in the
  // label face, which sits low in a line of the text face, or small words inside a line, take their line's real place.
  // The frame may be scaled and turned.
  const box = sc.getBoundingClientRect(), up = app.style.transform.includes('rotate'), k = app.getBoundingClientRect().width / (up ? app.offsetHeight : app.offsetWidth) || 1, base = sc.scrollTop - sc.clientTop;
  const mid = r => (up ? box.right - (r.left + r.right) / 2 : (r.top + r.bottom) / 2 - box.top) / k + base;
  const lines = (n, e) => {
    let b = e; while (b !== sc && getComputedStyle(b).display === 'inline') b = b.parentElement;
    const cs = getComputedStyle(b), lh = parseFloat(cs.lineHeight) || 16, rg = document.createRange(); rg.selectNodeContents(n);
    const top = (b === sc ? 0 : yOf(b) + (parseFloat(cs.borderTopWidth) || 0)) + (parseFloat(cs.paddingTop) || 0);
    for (const r of rg.getClientRects()) if (r.width && r.height) { const t = top + Math.round((mid(r) - top - lh / 2) / lh) * lh; out.push([t, t + lh]); }
  };
  const walk = e => { for (const n of e.childNodes) {
    if (n.nodeType === 3) { if (n.textContent.trim()) lines(n, e); continue; }
    if (n.nodeType !== 1 || n.classList.contains('scm') || !n.offsetHeight) continue;
    const t = yOf(n), h = n.offsetHeight;
    if (whole(n)) { out.push([t, t + h]); continue; }
    if (n.tagName === 'BUTTON') out.push([t, t], [t + h, t + h]);
    walk(n);
  } };
  walk(sc); return out;
}
const FOOT_GAP = 8; // from a box's foot to the plaques under it
// The box's rests at a height h: blk marks every row of the box's pages that lies inside a line, a card or a row (a cut
// there would split it); a rest is a scroll whose top and foot both lie on rows that are not marked. The last rest shows
// the last line whole, with blank under it if need be (pad: the blank the pages need below them to scroll that far).
// The box always opens at its top: a height is taken only if the scroll 0 is a rest (its foot, at the top, falls between
// two lines), so its first lines can always be read.
// Pages that mix steps (lines of 16 pixels, plaques on rows of 24, cards on rows of 64) may hold gives (.scgive): blanks
// between their parts that may open by a few steps (data-step, 16 pixels unless it says, up to data-most, 48 unless it
// says), so the parts come to rest whole together. Of the ways
// to open them and the heights near the largest, the plan takes the one that leaves the least blank, in the box and
// under it, at which every line can be read whole at some rest and a rest comes at least every half a box.
function scrollPlan(sc, max) {
  for (const e of sc.querySelectorAll(':scope > .scend')) e.remove();
  const gv = [...sc.querySelectorAll('.scgive')]; for (const g of gv) g.style.height = '0px';
  const atoms = scrollAtoms(sc), end0 = Math.ceil(atoms.reduce((m, [, b]) => Math.max(m, b), 0));
  const L0 = Math.max(end0, sc.scrollHeight > sc.clientHeight + .5 ? sc.scrollHeight : 0);
  const gy = gv.map(g => { let y = 0; for (let q = g; q && q !== sc; q = q.offsetParent) y += q.offsetTop; return y; });
  const sum = o => o.reduce((s, v) => s + v, 0);
  let opens = [[]];
  for (const g of gv) { const st = +g.dataset.step || 16, most = +g.dataset.most || 48, vs = []; for (let v = 0; v <= most; v += st) vs.push(v); opens = opens.flatMap(o => vs.map(v => o.concat(v))); }
  opens.sort((p, q) => sum(p) - sum(q));
  // the pages with the gives opened by o: their marks, their foot and how well each height reads with them
  const lay = o => {
    const sh = a => o.reduce((s, v, i) => s + (gy[i] <= a + .5 ? v : 0), 0), tot = sum(o), L = L0 + tot, end = end0 + tot, blk = new Uint8Array(L + max + 2);
    const parts = atoms.filter(([a, b]) => b > a).map(([a, b]) => [a + sh(a), b + sh(a)]).sort((p, q) => p[0] - q[0]);
    for (const [a, b] of parts) for (let y = Math.max(0, Math.floor(a) + 1); y < Math.ceil(b); y++) blk[y] = 1;
    return { o, tot, L, end, blk, parts };
  };
  const at = (Y, h) => {
    const { blk, end, L } = Y; if (end <= h) return { h, R: [0], pad: 0, Y };
    let last = end - h; while (blk[last]) last++;
    const R = []; for (let s = 0; s < last; s++) if (!blk[s] && !blk[s + h]) R.push(s);
    R.push(last); return { h, R, pad: Math.max(0, last + h - L), Y };
  };
  // how well a height reads: the lines never seen whole at any rest, and the longest step from one rest to the next
  const score = P => { let unseen = 0, j = 0, step = 0; const { h, R } = P;
    for (const [a, b] of P.Y.parts) { if (b - a > h) continue; while (j + 1 < R.length && R[j + 1] <= a + .5) j++; if (!(R[j] <= a + .5 && b <= R[j] + h + .5)) unseen++; }
    for (let i = 1; i < R.length; i++) step = Math.max(step, R[i] - R[i - 1]);
    return Object.assign(P, { unseen, step }); };
  const done = P => Object.assign(P, { end: P.Y.end, o: P.Y.o });
  const lays = opens.map(lay);
  if (end0 <= max) return done(score(at(lays[0], Math.max(1, end0))));
  const good = P => P.R[0] === 0 && !P.unseen && P.step <= Math.max(16, P.h >> 1);
  // a box whose foot, at the top, falls in the blank under a line or a row closes up to that line when it reads as well
  const tighten = P => { const t = P.Y.parts.reduce((m, [, b]) => b <= P.h + .5 && b > m ? Math.round(b) : m, 0); if (t > 0 && t < P.h) { const Q = score(at(P.Y, t)); if (good(Q)) return Q; } return P; };
  // the blank a plan leaves: the height the box gives up, twice what its gives open (a blank inside the pages shows more
  // than a window a little shorter), and the blank over the box's foot as it opens, under the last line it shows whole
  const band = P => P.h - P.Y.parts.reduce((m, [, b]) => b <= P.h + .5 && b > m ? b : m, 0);
  const cost = P => Math.floor(max) - P.h + 2 * P.Y.tot + band(P);
  let best = null, fall = null;
  for (const Y of lays) {
    if (best && 2 * Y.tot >= cost(best)) break;
    for (let h = Math.floor(max); h >= Math.max(16, Math.floor(max) - 80); h--) {
      if (best && Math.floor(max) - h + 2 * Y.tot >= cost(best)) break;
      const P = score(at(Y, h)); if (P.R[0] !== 0) continue;
      if (good(P)) { const Q = tighten(P); if (!best || cost(Q) < cost(best)) best = Q; continue; }
      if (!fall || P.unseen < fall.unseen || (P.unseen === fall.unseen && P.step < fall.step)) fall = P;
    }
  }
  // none reads well: the one that reads best, still opening at its top (a shorter box if no height near the largest can)
  best = best || fall;
  for (let h = Math.floor(max) - 81; !best && h >= 16; h--) { const P = score(at(lays[0], h)); if (P.R[0] === 0) best = P; }
  return done(best || score(at(lays[0], Math.floor(max))));
}
// The box's window and the plaques under the box, as the screen drew them (kept, so a box fitted again starts from them).
function scrollHome(sc) {
  const win = sc.closest('.mw, .book'), max = +sc.dataset.max;
  if (!win.dataset.h0) {
    win.dataset.h0 = win.offsetHeight; win.dataset.t0 = win.offsetTop;
    const foot = sc.offsetTop + max - 1;
    for (const e of win.children) if (e !== sc && !e.classList.contains('scm') && !e.classList.contains('scl') && getComputedStyle(e).position === 'absolute' && e.offsetTop >= foot) e.dataset.t0 = e.offsetTop;
  }
  win.style.height = win.dataset.h0 + 'px'; win.style.top = win.dataset.t0 + 'px';
  for (const e of win.querySelectorAll(':scope > [data-t0]')) e.style.top = e.dataset.t0 + 'px';
  return win;
}
function fitScroll(sc, want) {
  if (!sc.dataset.max) sc.dataset.max = parseFloat(sc.style.height) || sc.offsetHeight;
  const max = +sc.dataset.max, t = want ?? sc.scrollTop;
  const win = scrollHome(sc); sc.style.height = max + 'px';
  for (const e of win.querySelectorAll(':scope > .scl')) e.remove();
  const P = scrollPlan(sc, max);
  sc.querySelectorAll('.scgive').forEach((g, i) => { g.style.height = (P.o[i] || 0) + 'px'; });
  sc.style.height = P.h + 'px';
  // The blank starts where the pages' flow ends, which can lie a few pixels above the foot the browser gave the pages
  // before (a line's letters reach under the line), so it is made as deep again as the last rest still needs.
  if (P.pad) { const e = document.createElement('i'); e.className = 'scend'; e.style.height = P.pad + 'px'; sc.appendChild(e);
    const short = P.R[P.R.length - 1] - (sc.scrollHeight - sc.clientHeight); if (short > 0) e.style.height = P.pad + short + 'px'; }
  // the window closes up: what lies under the box moves up to FOOT_GAP under its foot, never over anything left above
  const movers = [...win.querySelectorAll(':scope > [data-t0]')], rest = [...win.children].filter(e => e !== sc && !e.dataset.t0 && !e.classList.contains('scm') && !e.classList.contains('scl') && getComputedStyle(e).position === 'absolute');
  if (movers.length) {
    const m0 = Math.min(...movers.map(e => +e.dataset.t0)), floor = Math.max(sc.offsetTop + P.h, ...rest.map(e => e.offsetTop + e.offsetHeight));
    const shift = Math.max(0, m0 - FOOT_GAP - floor);
    if (shift) { win.style.height = +win.dataset.h0 - shift + 'px'; win.style.top = +win.dataset.t0 + (shift >> 1) + 'px'; for (const e of movers) e.style.top = +e.dataset.t0 - shift + 'px'; }
  }
  sc._plan = P; scrollLips(sc, win); restAt(sc, t);
}
// A box that scrolls is drawn by the browser as a layer of its own, and at some scales (three device pixels to a frame
// pixel at a ratio of 2.625) the layer's edge lands a fraction of a device pixel outside the box, so one device row of
// what the box cuts off showed under its foot (and, scrolled, over its top). A strip of the window's own ground, one frame
// pixel tall and laid at the window's pattern, covers the frame row above and the row under the box; each strip is a
// layer of its own (ps.css), so it is drawn over the box's layer. A strip covers only the window's ground, inside its gold
// line and the dark line within it (two pixels at each side), so a box as wide as its window leaves the gold line whole.
function scrollLips(sc, win) {
  const cs = getComputedStyle(win), x = Math.max(2, sc.offsetLeft), w = Math.min(win.clientWidth - 2, sc.offsetLeft + sc.offsetWidth) - x;
  if (w <= 0) return;
  for (const y of [sc.offsetTop - 1, sc.offsetTop + sc.offsetHeight]) {
    if (y < 2 || y > win.clientHeight - 3) continue;
    const e = document.createElement('i'); e.className = 'scl';
    Object.assign(e.style, { left: x + 'px', top: y + 'px', width: w + 'px', backgroundImage: cs.backgroundImage, backgroundSize: cs.backgroundSize, backgroundRepeat: cs.backgroundRepeat, backgroundColor: cs.backgroundColor, backgroundPosition: `${-x}px ${-y}px` });
    win.appendChild(e);
  }
}
// Brings the box to a rest, and shows or hides its marker. Given a scroll t (the box drawn again), it goes to the rest
// nearest to t. Otherwise it goes to the rest nearest to where its reader has moved it: the scrolls the reader makes add
// up (sc._want, kept by the scroll listener below), so a slow drag, or a short wheel step that came back to the rest it
// left, still counts toward the next rest, and the box never goes further than the reader moved it, give or take half
// a step between two rests.
function restAt(sc, t = null) {
  const P = sc._plan; if (!P) return;
  const R = P.R, jump = t != null, w = Math.max(R[0], Math.min(R[R.length - 1], jump ? t : sc._want ?? sc.scrollTop));
  let i = 0; for (let j = 1; j < R.length; j++) if (Math.abs(R[j] - w) < Math.abs(R[i] - w)) i = j;
  sc._want = jump ? R[i] : w; // the reader's own place is kept, so the half steps the rests round off do not add up
  sc._rest = R[i]; sc._seen = R[i]; if (Math.abs(sc.scrollTop - R[i]) > .5) sc.scrollTop = R[i];
  scrollMark(sc);
}
// The marker stands a pixel under the box's foot and bobs two pixels down, so it keeps a pixel clear of the box's last
// row over it and of a plaque FOOT_GAP under the box.
function scrollMark(sc) {
  const P = sc._plan; if (!P) return;
  let m = sc.nextElementSibling; if (!m || !m.classList.contains('scm')) { m = document.createElement('i'); m.className = 'scm'; sc.after(m); }
  m.hidden = !(P.end > sc.scrollTop + P.h + .5); // a margin under the last line is not more to read
  m.style.left = sc.offsetLeft + sc.offsetWidth - 8 + 'px'; m.style.top = sc.offsetTop + P.h + 1 + 'px';
}
// The hammer moved onto a plaque in a box: the box rests where that plaque shows whole, as near as it can to where it is.
function restOn(sc, e) {
  const P = sc._plan; if (!P) return;
  let y = 0; for (let q = e; q && q !== sc; q = q.offsetParent) y += q.offsetTop;
  const z = y + e.offsetHeight, t = sc.scrollTop; if (y >= t && z <= t + P.h) return;
  let best = null; for (const s of P.R) if (s <= y && z <= s + P.h && (best == null || Math.abs(s - t) < Math.abs(best - t))) best = s;
  if (best != null) { sc._rest = sc._want = sc._seen = best; sc.scrollTop = best; scrollMark(sc); }
}
// A screen drawn again keeps each box where it was read, while it is the same window or book.
const scrollKey = i => [G.screen, G.tab, G.overlay && G.overlay.kind, !!G.inspect, G.cx && G.cx.open, i].join('|');
const scrollBoxes = () => app.querySelectorAll('.mw .sc, .book .sc');
const scrollKeep = () => { const m = new Map(); scrollBoxes().forEach((sc, i) => m.set(scrollKey(i), sc._rest ?? sc.scrollTop)); return m; };
const fitScrolls = (keep = null) => scrollBoxes().forEach((sc, i) => fitScroll(sc, keep ? keep.get(scrollKey(i)) : undefined));
// Each scroll the reader makes is added to where the box is wanted (one the box makes itself, coming to a rest, is not:
// restAt marks it as seen). What the rests left over is kept only while the reader goes on the same way: a scroll the
// other way starts from the rest the box stands on, and a scroll to the very top wants the top. That is for the wheel
// and the keys, whose steps the box draws itself. A finger carries the pages with it, and what it left on the screen is
// where they are wanted: from a touch until the next wheel step or key, the box comes to rest at the stop nearest to
// where the pages are when they stop, and a drag never carries what an earlier drag left over. The box comes to rest
// 160 ms after the last scroll, and not while a finger still holds it.
{ let raf = 0, rest = 0, held = 0, finger = 0; const live = t => t && t.classList && t.classList.contains('sc') && app.classList.contains('ps') && t.closest('.mw, .book');
  const settle = t => { clearTimeout(rest); rest = setTimeout(() => { if (held) settle(t); else restAt(t); }, 160); };
  for (const k of ['touchstart', 'touchend', 'touchcancel']) app.addEventListener(k, ev => { held = ev.touches.length; if (held) finger = 1; }, { capture: true, passive: true });
  for (const k of ['wheel', 'keydown']) window.addEventListener(k, () => { finger = 0; }, { capture: true, passive: true });
  app.addEventListener('scroll', ev => { const t = ev.target; if (!live(t)) return;
    const now = t.scrollTop, d = now - (t._seen ?? now); let w = t._want ?? now;
    if (d * (t._way || 0) < 0) w = t._rest ?? now;
    if (d) t._way = Math.sign(d);
    t._want = finger ? now : d < 0 && now < .5 ? 0 : w + d; t._seen = now;
    cancelAnimationFrame(raf); raf = requestAnimationFrame(() => scrollMark(t)); settle(t); }, true); }
// Every line of words starts on a whole frame pixel. A line the browser centres in its box (text-align: center: a name
// plate's line, a door's number, a card's badge, a number on a plinth) lands half a pixel off the grid when its width and
// the room it is centred in differ by an odd number of pixels, and the face's one-pixel strokes are then drawn soft, two
// pixels at half strength. Such a box is given one pixel of indent, which moves its line half a pixel right, onto the
// grid. Its words then stand in the middle to within a pixel, and their ink (the face leaves the last column of a word's
// last letter blank) exactly in it. A box of centred words holds one line: a plate of several sets each line as a box
// of its own. Measured after the screen is drawn and again once the faces are in.
// The end window's carved title is a picture centred in an even-width row; an odd-width picture would land half a pixel off, so the row gives it one pixel on the left.
function endPad(word) { const c = carve(word, 24, render); return c && c.w & 1 ? ';padding-left:1px' : ''; }
function gridLines() {
  if (!app.classList.contains('ps')) return;
  const A = app.getBoundingClientRect(), k = (DUAL ? A.width : Math.max(A.width, A.height)) / (app.offsetWidth || 1), up = F.up, boxes = []; // two frames stand one over the other, so the page is taller than wide without being turned
  for (const e of app.querySelectorAll('*')) {
    let t = null; for (const n of e.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { t = n; break; }
    if (t && getComputedStyle(e).textAlign === 'center') boxes.push([e, t]);
  }
  for (const [e] of boxes) e.style.textIndent = '';
  const half = boxes.filter(([, t]) => { const rg = document.createRange(); rg.selectNodeContents(t); const q = rg.getClientRects()[0]; if (!q) return false;
    const x = (up ? q.top - A.top : q.left - A.left) / k; return Math.abs(x - Math.round(x)) > .25; });
  for (const [e] of half) e.style.textIndent = '1px';
}
// The text bar holds two lines. When what it says is longer, a marker shows and a tap opens the whole of it.
function barFits() {
  if (DUAL) return; // two frames: the window of words pages (dualPagers)
  const b = app.querySelector('.fr > .bar'), p = b && b.firstElementChild; if (!p) return;
  const over = p.scrollHeight > p.clientHeight + 4; b.classList.toggle('more', over);
  if (over) b.dataset.a = 'barmore'; else delete b.dataset.a;
}
function screenCue(era = false) {
  const r = G.run;
  const scr = G.screen || app.dataset.phase; if (scr !== render.scr) { if (era && !RM && render.scr !== undefined) app.animate([{ filter: 'brightness(0)' }, { filter: 'brightness(1)' }], { duration: 260, easing: 'ease-out' }); render.scr = scr; cue('screen:' + scr, r ? { floor: r.floor, chamber: r.chamber, rival: r.rival ? r.rival.name : null, tier: r.rival ? r.rival.tier : null, heat: r.heat || 0, sparks: r.sparks ?? 0, sparksMax: sparksMax(r), fog: +((fogK(r) - .7) / .6).toFixed(2) } : {}); } // heat, Sparks and the fog (0 to 1) let the sound follow the danger of the run
}

// ---------- input ----------
// The rules box and the line above the duel buttons say so when they hold more text than they can show, until scrolled to the end.
function moreBelow(el) { el.classList.toggle('more', el.scrollTop + el.clientHeight < el.scrollHeight - 2); }
app.addEventListener('scroll', ev => { const t = ev.target; if (t && t.classList && (t.classList.contains('rules') || t.classList.contains('trayline'))) moreBelow(t); }, true);
app.addEventListener('click', ev => { try { tapped(ev); } catch (e) { recover(e, false); } });
// The hammer: one lit plaque on a console screen, and one in the window over it. A mouse moves it to the plaque it points
// at (a finger does not: a tap simply takes the plaque), the arrow keys move it along the plaques in reading order, and
// Enter or Space takes the one it is on. On the title the turning crest goes with it.
function litLayer() { const ws = app.querySelectorAll('.mw'); return ws.length ? ws[ws.length - 1] : app.querySelector('.story') || app; }
const litPlaques = layer => [...layer.querySelectorAll('.pq')].filter(b => !b.disabled && b.offsetWidth && (layer !== app || !b.closest('.mw, .story')));
// The choice is always shown the same way: the hammer stands at the left of the lit plaque, beside its words. Moving it
// never moves a plaque: a plaque placed on its own keeps its width (the words step right into room the plaque has for
// them), and one in a line of words (.in) always keeps the hammer's room at its left, lit or not. A plaque made too
// narrow for the hammer beside its words is a fault the console checks report; until it is widened it is lit without
// the hammer (.nh), so its words are never cut.
function litMove(b) {
  const layer = b.closest('.mw') || b.closest('.story') || app;
  for (const e of layer.querySelectorAll('.pq.lit')) if (e !== b && (layer !== app || !e.closest('.mw, .story'))) e.classList.remove('lit', 'nh');
  b.classList.add('lit');
  if (b.scrollWidth > b.clientWidth + 1) b.classList.add('nh');
  if (b.classList.contains('tm')) { G.tcur = [...app.querySelectorAll('.pq.tm')].indexOf(b); const c = document.getElementById('coin'); if (c) c.style.top = b.style.top; }
  const sc = b.closest('.sc'); if (sc) restOn(sc, b);
}
app.addEventListener('pointerover', ev => {
  if (DUAL || ev.pointerType !== 'mouse' || !app.classList.contains('ps')) return; // with two frames the one cursor moves by the pad's keys and by a tap
  const b = ev.target.closest && ev.target.closest('.pq'); if (!b || b.disabled || b.classList.contains('lit') || !litPlaques(litLayer()).includes(b)) return;
  litMove(b); if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#app button')) b.focus({ preventScroll: true }); // the keys then take this one
});
addEventListener('keydown', ev => {
  if (DUAL) { const k = KEYS[ev.key] || KEYS[String(ev.key).toLowerCase()]; if (k && app.classList.contains('ps') && !booting && !ev.altKey && !ev.ctrlKey && !ev.metaKey) { ev.preventDefault(); padPress(k); } return; } // the pad's keys on a keyboard (DUAL.md)
  if (!app.classList.contains('ps') || booting || ev.altKey || ev.ctrlKey || ev.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test((ev.target || {}).tagName || '')) return;
  const k = ev.key, list = litPlaques(litLayer()); if (!list.length) return;
  const at = list.findIndex(b => b.classList.contains('lit'));
  if (/^Arrow(Up|Down|Left|Right)$/.test(k)) { ev.preventDefault(); const d = k === 'ArrowUp' || k === 'ArrowLeft' ? -1 : 1, b = list[at < 0 ? 0 : (at + d + list.length) % list.length]; litMove(b); b.focus({ preventScroll: true }); }
  else if ((k === 'Enter' || k === ' ') && at >= 0 && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('#app button'))) { ev.preventDefault(); list[at].click(); } // a focused plaque takes the key itself
});
function tapped(ev) {
  const el = ev.target.closest('[data-a]'); if (!el || el.disabled || G.opening) return; // nothing is taken while a door swings open
  G.toast = ''; // a tap puts away the last message, so it cannot lie over the screen the tap opens
  if (DUAL && !NAV.inPad) NAV.pad = false;
  if (DUAL && el.dataset.a === 'acur') { const f = navEl(); if (f && f !== el && !f.classList.contains('pq')) aPress(f); return; } // the plaque that says what A does presses what the cursor is on
  if (DUAL && !NAV.hold) { const it = el.closest('button, input'), { items, keys } = navList(), i = items.indexOf(it); if (i >= 0) { NAV.key = keys[i]; if (it.dataset.look != null) { G.look = it.dataset.look; G.lookCur = false; } else if (G.lookCur && lookAt(it) == null) { G.look = null; G.lookCur = false; } } } // the cursor goes where the finger went
  syncP();
  const [verb, x, y] = el.dataset.a.split(':'); const r = G.run, n = x === undefined || x === '' ? null : +x;
  cue('ui:' + verb, { x, y }, el);
  const duel = a => act({ t: 'duel', action: a });
  switch (verb) {
    case 'new': { const s = !r || r.phase === 'over' ? liveSave() : null; if (s) { G.overlay = { kind: 'leave', saved: nameRun(s), at: storedAt() }; render(); break; } }
      // falls through to the Forger screen when no run is waiting
      G.overlay = null; G.screen = 'forger'; if (!P.forgers.includes(G.pickForger)) G.pickForger = 'tarn'; G.pickHeat = Math.min(G.pickHeat, heatOpen()); render(); break;
    case 'loadagain': location.reload(); break;
    // two frames: read a card or a relic in the window above, page its words on, put a picked card back, and a control that only holds the cursor
    case 'read': G.look = el.dataset.a.slice(5); G.lookCur = !el.classList.contains('pq') && navEl() === el; render(); break;
    case 'unlook': G.look = null; G.lookCur = false; render(); break;
    case 'rowjump': rowJump(n); break;
    case 'pagetext': pageText(1, true, el.closest('.bar')); break;
    case 'unpick': G.pickDeck = G.pickTrunk = null; render(); break;
    case 'pickcur': { const m = /^([dt]):(\d+)$/.exec(G.look || ''); if (!m) break; if (m[1] === 'd') G.pickDeck = +m[2]; else G.pickTrunk = +m[2]; trySwap(); break; }
    case 'trapnext': G.trapSel = (G.trapSel || 0) + 1; render(); break;
    case 'nop': render(); break;
    case 'startempty': lostStore = false; try { sessionStorage.removeItem(HAD); } catch { /* nothing to forget */ } render(); break;
    case 'leavetab': Object.assign(G, { run: null, overlay: null, screen: null, shown: null, frames: [], results: null, banked: false, story: null }); setLabs(pref); render(); break;
    case 'home': G.screen = null; if (r && r.phase === 'over') { G.run = null; G.results = null; G.banked = false; setLabs(pref); } render(); break;
    case 'screen': if (DUAL && G.cx) G.cx.open = null; if (x === 'ach') achBook().look = false; if (DUAL && x === 'feats' && G.screen === 'ach') achBack(); G.screen = x; render(); break; // two frames: a book turned to opens on its list, never on a page left open
    case 'achg': { const B = achBook(); B.g = (B.g + n + ACH_GROUPS.length) % ACH_GROUPS.length; B.pg = 0; B.sel = null; if (DUAL) { G.look = null; NAV.key = null; } render(); break; } // the group before or after
    case 'achpg': { const B = achBook(); B.pg = (B.pg + 1) % Math.max(1, B.pages); B.sel = null; render(); break; }
    case 'achsel': { const rw = AC.groupRows(achAll(), n)[+y]; if (rw) achBook().sel = rw.id; render(); break; } // a row by its group and place: a hidden row's id would spell its name
    case 'achlook': achBook().look = true; render(); break;
    case 'achclose': achBook().look = false; render(); break;
    case 'lab': pref = { ...pref, [x]: !pref[x] }; store.set(LABKEY, pref); setLabs(pref); render(); break;
    case 'forger': G.pickForger = x; G.pickHeat = Math.min(G.pickHeat, heatOpen()); render(); break;
    case 'heat': G.pickHeat = n; render(); break;
    case 'resave': {
      if (unsavedRun() && storedAt() !== G.at) { // another tab changed the stored run while this tab could not save
        if (r && r.phase === 'over') { store.failed.delete(SAVE); store.failed.delete(REV); } // a finished run: only its banking is still owed, below
        else { movedOn(); break; }
      }
      if (store.failed.has(PROFILE)) { const raw = rawP(); if (raw != null && raw !== pRaw) { // another tab stored the profile since: keep theirs, and bank this tab's finished run on top of it if it is not banked there
        store.failed.delete(PROFILE); syncP(); if (r && r.phase === 'over') { try { G.results = bank(r, !!labs.long) || G.results; } catch (e) { later(e); } } } }
      if (store.retry()) { if (r && r.phase === 'over' && storedIs(r)) { store.del(SAVE); store.del(REV); } else if (r && r.phase !== 'over' && G.at !== null) G.at = storedAt(); toast('Saved.'); } else toast('Still not saved. Keep this page open.'); render(); break;
    }
    case 'bankold': case 'abandon': {
      // End the run as a loss and bank it once. "bankold" does it to the run waiting on disk, "abandon" to the run being played.
      // "bankold" answers a question about one stored run as it stood when the question was shown. If another tab has
      // ended that run, carried it on, or begun a new one since, the answer is about a run that is no longer there:
      // nothing is ended and the page says so (reported 21 November 2026: it ended the newer run).
      if (verb === 'bankold') { const o = G.overlay; if (!o || o.kind !== 'leave' || !o.saved || storedAt() !== o.at) { G.overlay = { kind: 'moved', asked: true }; render(); break; } }
      const run = verb === 'bankold' ? nameRun(liveSave()) : r; G.overlay = null;
      if (!run || run.phase === 'over' || G.playing) { render(); break; }
      if (verb === 'bankold') { setLabs(store.get(RUNLABS) || pref); G.run = run; G.rev = revOf(run); G.at = storedAt(); }
      G.sel = []; G.onto = G.attacker = G.aim = G.shown = G.inspect = null; G.tab = null; G.results = null; G.banked = false; G.screen = null;
      act({ t: 'abandon' }); break;
    }
    case 'descend': if (!P.forgers.includes(G.pickForger)) { render(); break; } /* a locked Forger can be looked at, never taken */ { const s = liveSave(); if (s) { G.screen = null; G.overlay = { kind: 'leave', saved: nameRun(s), at: storedAt() }; render(); break; } } // a run is stored that this screen did not know of (another tab began it): ask, never end it unasked
      if (store.failed.has(PROFILE)) { toast('Your progress is not saved yet. Tap Try again first.'); render(); break; }
      G.banked = false; setLabs(pref); store.set(RUNLABS, pref); G.screen = null; G.results = null; G.run = newRun(db, { seed: (Date.now() % 2147483647) + Math.floor(Math.random() * 1e6), heat: G.pickHeat, forger: G.pickForger, ...runOptions(P, G.pickForger, !!labs.long), uid: Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36) }); G.run.uiAch0 = Object.fromEntries(achProgress(db, P, null).filter(x => !x.done).map(x => [x.id, x.have])); G.log = []; G.overlay = null; G.rev = 0; G.at = storedAt(); writeRun(G.run); queueStory('intro'); render(); break;
    case 'vbuy': try { const b = buy(P, y ? x + ':' + y : x); for (const id of achCheck(db, P, null)) G.achOff.add(id); saveP(); toast(b.name + (y ? ' can now be offered at an Anvil.' : ' can now appear in your runs.')); } catch (e) { toast(e.message); } render(); break;
    case 'storynext': { const st = G.story; if (!st) break; if (++st.i >= SCENES[st.id].lines.length) { G.story = null; if (st.then) { st.then(); break; } nextStory(); } render(); break; }
    case 'storyskip': { const st = G.story; G.story = null; if (st && st.then) { st.then(); break; } nextStory(); render(); break; }
    case 'power': { const a = { t: 'power' }; if (x === 'hand') a.hand = G.sel[0]; if (x === 'zone') a.zone = G.attacker; duel(a); break; }
    case 'resume': G.overlay = null; G.screen = null; G.banked = false; G.results = null; setLabs(store.get(RUNLABS) || pref); G.run = nameRun(liveSave()); G.rev = revOf(G.run); G.at = storedAt(); G.fresh = true; if (!G.run) { G.fresh = false; G.notice = 'Your run in progress could not be read and cannot be continued. A copy was kept on this device.'; render(); break; } if (G.run && G.run.codex) G.run.codex = codexUpgrade(db, G.run.codex); render(); break;
    case 'quit': G.overlay = { kind: 'leave' }; render(); break;
    case 'kit': act({ t: 'kit', i: n }); break;
    case 'redeal': act({ t: 'redeal' }); break;
    case 'pick': act({ t: 'pick', i: n }); break;
    case 'skip': act({ t: 'skip' }); break;
    case 'reroll': act({ t: 'reroll' }); break;
    case 'cxview': G.cx.view = x; G.cx.type = null; render(); break;
    case 'cxtype': G.cx.type = G.cx.type === x ? null : x; render(); break;
    case 'cxopen': G.cx.open = n; render(); break;
    case 'cxclose': G.cx.open = null; render(); break;
    case 'door': { G.log = []; const d = r.doors[n];
      // Once gone through, the door is shut behind the player, so a chamber met again shows it closed.
      const go = () => { G.doorOpen = null; act({ t: 'door', i: n }); };
      // The guardian's door and the hidden door are met with words first: the door opens and stays open behind them.
      const sid = d && d.type === 'boss' && r.seals >= 2 ? 'boss:' + BOSSES[r.floor][r.bossOrder[r.floor]].id : d && d.type === 'secret' ? 'secret:door' : null;
      doorBeat(n, !!(sid && SCENES[sid] && !P.seen.includes(sid)), () => { if (sid) { queueStory(sid, go); if (G.story) render(); } else go(); }); break; }
    case 'leave': G.pickDeck = G.pickTrunk = null; act({ t: 'leave' }); break;
    case 'look': look = look === 'old' ? 'ps' : 'old'; store.set(LOOKKEY, look); G.tab = null; if (look !== 'old' && !packDone) bootWait(); else render(); break; // the console look, or the old one to compare
    case 'barmore': G.tab = 'bar'; render(); break;
    case 'dsel': if (r && r.phase === 'chamber' && r.doors[n] && G.doorSel) { G.doorSel.i = n; render(); } break; // the cursor moves to another door
    case 'osel': if (G.offSel) { G.offSel.i = n; render(); } break; // the cursor moves to another choice
    case 'labsopen': G.labsOpen = !G.labsOpen; render(); break; // Era look: the lab switches wait behind one button on the title screen
    case 'tab': G.tab = x || null; G.pickDeck = G.pickTrunk = null; render(); break;
    case 'deckpick': G.pickDeck = n; trySwap(); break;
    case 'trunkpick': G.pickTrunk = n; trySwap(); break;
    case 'anvilpick': if (G.pickDeck == null || G.pickDeck === n) G.pickDeck = G.pickDeck === n ? null : n; else G.pickTrunk = G.pickTrunk === n ? null : n; render(); break;
    case 'temper': { const d = G.pickDeck; G.pickDeck = G.pickTrunk = null; forgeWork('temper', [d], { t: 'anvil', kind: 'temper', deck: d }); break; }
    case 'enchant': { const d = G.pickDeck; G.pickDeck = G.pickTrunk = null; forgeWork('enchant', [d], { t: 'anvil', kind: 'enchant', deck: d, enchant: x }, { enchant: x }); break; }
    case 'bind': { const a = G.pickDeck, b = G.pickTrunk; G.pickDeck = G.pickTrunk = null; forgeWork('bind', [a, b], { t: 'anvil', kind: 'bind', a, b }); break; }
    case 'mw': forgeWork('masterwork', [], { t: 'anvil', kind: 'masterwork', id: x }, { mw: x }); break;
    case 'forgeskip': G.forge = null; render(); break;
    case 'buy': { const d = G.pickDeck; G.pickDeck = G.pickTrunk = null; const it = r.offer && r.offer.items[n]; act(it && it.kind === 'scrap' ? { t: 'buy', i: n, deck: d ?? undefined } : { t: 'buy', i: n }); break; }
    case 'inspect': G.inspect = { id: n }; render(); break;
    case 'inspectz': { const v = G.shown ? G.shown.view : r && r.duel ? viewFor(r.duel, db, 0) : null; const m = v && v.mon[n] && v.mon[n][+y]; if (m && m.id) { G.inspect = m; render(); } break; } // the table as shown: while a move plays out the duel may already be over (found 22 November: tapping the rival's monster during its last attack sent the page back to the start)
    case 'closeinspect': G.inspect = null; render(); break;
    case 'closeov': G.overlay = null; G.endFrame = null; render(); break;
    case 'cmdpage': if (G.cmdPage) G.cmdPage.n++; render(); break; // the next page of the duel's commands
    case 'heatinfo': G.overlay = { kind: 'heat', n }; render(); break;
    case 'speed': G.fast = !G.fast; render(); break;
    // duel
    case 'hand': { if (G.playing || !r.duel || r.duel.active !== 0 || r.duel.pending) break; if (r.duel.played || r.duel.attacked) { G.inspect = r.duel.hand[0][n]; render(); break; } G.attacker = null; G.aim = null; const k = G.sel.indexOf(n); if (k >= 0) G.sel.splice(k, 1); else G.sel.push(n); render(); break; }
    case 'onto': G.attacker = null; G.aim = null; G.onto = n; render(); break; // two frames: the plaque MELD ONTO IT
    case 'mine': { if (G.sel.length) { toast('Finish or undo your card pick first.'); render(); break; } if (G.attacker === n) { G.attacker = null; G.onto = n; } else if (G.onto === n) { G.onto = null; if (r.duel) G.inspect = viewFor(r.duel, db, 0).mon[0][n]; } else { G.attacker = n; G.onto = null; } render(); break; }
    case 'hit': duel({ t: 'attack', from: G.attacker, to: n }); break;
    case 'pos': duel({ t: 'pos', zone: G.attacker }); break;
    case 'undo': G.sel = []; G.attacker = null; G.onto = null; G.aim = null; render(); break;
    case 'tipsoff': P.tips = learnedAll(); saveP(); render(); break;
    case 'floorok': G.floorCard = 0; render(); break;
    case 'relearn': P.tips = {}; saveP(); G.tab = null; toast('The first lessons will show again in your next duel.'); render(); break;
    case 'aim': G.aim = G.aim === n ? null : n; render(); break;
    case 'play': { if (G.lesson === 'single' && G.sel.length === 1 && G.onto == null) { tips().single = 1; saveP(); } const a = { t: 'play', hand: G.sel.slice(), onto: G.onto }; if (x) a.pos = x; if (y === '1') a.veiled = true; if (G.aim != null && G.sel.length === 1 && G.onto == null) a.target = G.aim; duel(a); break; }
    case 'scrap': duel({ t: 'discard', hand: G.sel[0] }); break;
    case 'clean': duel({ t: 'cleanDraw', hand: G.sel[0] }); break;
    case 'end': duel({ t: 'end' }); break;
    case 'respond': duel({ t: 'respond', trap: n }); break;
  }
}
// Another tab stored something: take in its profile, and stop this tab's run if the stored run is no longer the one shown here.
addEventListener('storage', ev => { try { if (ev.key !== null && ![SAVE, REV, PROFILE].includes(ev.key)) return; syncP(); if (G.playing) return; const r = G.run; if (r && r.phase !== 'over' && !holds(r)) { movedOn(); return; } render(); } catch (e) { recover(e, false); } });
function trySwap() {
  const r = G.run;
  if (r.phase === 'chamber' && G.pickDeck != null && G.pickTrunk != null) { const a = { t: 'swap', deck: G.pickDeck, trunk: G.pickTrunk }; G.pickDeck = G.pickTrunk = null; act(a); G.tab = 'deck'; render(); }
  else render();
}
const warmOld = () => { for (const f of D.art || []) { const im = new Image(); im.src = 'art/' + f + '.webp'; (window.__keep = window.__keep || []).push(im); } }; // keep the old look's pictures warm so a redraw never flashes; in the console look only once its own pack is in
for (let i = 0; D.sheets && i < Math.ceil(D.pool.cards.length / 100); i++) { const im = new Image(); im.src = D.sheets + i + '.webp'; (window.__keep = window.__keep || []).push(im); }
window.LM = { G, P, db, act, render, achAdd, achAll, achProgress: () => achProgress(db, P, null), labKeys, labWords: () => Object.keys(LABS), unsaved: () => [...store.failed.keys()] }; // for tests
if (PACK && look !== 'old') bootWait().then(warmOld); else { warmOld(); render(); loadPack(); }
