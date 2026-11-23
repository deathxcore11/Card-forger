// Lost Memories playable test page (codename crucible). Runs the real engine in the browser.
// The duel is drawn only from viewFor(seat 0), so this page cannot show hidden cards.
import { buildDb, roleOf, weightOf, meldPairRaw } from '../engine/cards.mjs';
import { legalActions, playVariants, planChain, viewFor, forecast } from '../engine/duel.mjs';
import { RELICS as BASE_RELICS, LAB, TUNED_TEXT, relicText, relicLinks } from '../engine/relics.mjs';
const RELICS = { ...BASE_RELICS, ...LAB }; // the page's own copy: an item's words follow the rules in force (see setLabs)
import { newRun, runApply, MIN_DECK, deckWeight, weightCap, relicList, possibleMasterworks, cardValue, BOSSES, BUILD_FAMILIES, HEAT_RULES, bossLaw, ENCHANT_TEXT, carries } from '../engine/run.mjs';
import { codexResult, codexKnows, codexUpgrade } from '../engine/cards.mjs';
import { powerActions } from '../engine/duel.mjs';
import { FORGERS, FORGER_IDS, HIDDEN_FORGERS } from '../engine/forgers.mjs';
import { newProfile, applyRun, scoreRun, buy, maxHeat, VAULT, FORGER_FEATS, featList, runOptions, openKits, nextKit, forgerStats, VAULT_ENCHANTS, KIT_GOALS, START_ENCHANTS } from '../engine/meta.mjs';
import { SCENES, RUMOURS } from './story.mjs';
import { LAB_DEFAULTS, LAB_ORDER, DEPTH_SET, labConfig } from './labs.mjs';
import { aimFor } from './aim.mjs';
import { F, fitConsole, yb, xr, cx0, cy0, viewSize, ledgeW, pq, lb, lbr, box, gauge, frame, win, carveImg, carve, fogSprite } from './ps.mjs';
import * as R3 from './raster.mjs';
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

const G = { run: null, sel: [], onto: null, attacker: null, aim: null, frames: [], playing: false, shown: null, inspect: null, toast: '', overlay: null, known: new Set(store.get(KNOWN) || []), tab: null, screen: null, story: null, results: null, pickForger: 'tarn', pickHeat: 0, pickDeck: null, pickTrunk: null, log: [], fast: false, cx: { view: 'found', type: null, open: null } };
const P = Object.assign(newProfile(), (() => { const s = store.get(PROFILE); if (s == null) return {}; if (okProfile(s)) return s; store.unreadable.add(PROFILE); try { localStorage.setItem(PROFILE + '.unreadable', JSON.stringify(s)); } catch { /* the copy could not be kept */ } return {}; })());
// Switches stored before Rumours was on for everyone (22 November 2026) take it on once; a player may turn it off after.
{ const st = store.get(LABKEY); pref = st ? { heat: true, kits: true, ...st, ...(st.rumoursOn ? {} : { secret: true, rumoursOn: 1 }) } : { ...LAB_DEFAULTS, rumoursOn: 1 }; setLabs(pref); }
// Saves from before 20 November 2026 wrote a shared pair (the two Robo fusions) without its order: bring them up to date once.
{ const pc = codexUpgrade(db, P.codex), kn = codexUpgrade(db, [...G.known].concat(pc)); if (pc.join() !== P.codex.join()) { P.codex = pc; store.set(PROFILE, P); } if (kn.join() !== [...G.known].join()) store.set(KNOWN, kn); G.known = new Set(kn); }
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
  if (okProfile(o)) { setP(o); pRaw = raw; }
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
  try { res = applyRun(P, nameRun(run), { long }); } catch (e) { setP(JSON.parse(before)); throw e; } // a run that cannot be banked leaves the profile as it was
  const same = storedIs(run);
  if (saveP()) { if (same) { store.del(SAVE); store.del(REV); } } else if (same) store.set(SAVE, run);
  if (!res.already && ((res.unlocks || []).length || (res.feats || []).length)) cueShown('unlock', { big: (res.unlocks || []).length > 0 });
  return res.already ? null : res;
}
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
  try {
    rev = runApply(run, a, db, { onStep: evs => { if (run.duel) frames.push({ view: JSON.parse(JSON.stringify(viewFor(run.duel, db, 0))), evs, rival: info(run) }); } });
  } catch (e) { if (e && e.constructor !== Error) { recover(e, true); return; } cue('refused', { action: a.t }); toast(e.message); render(); return; } // the engine refuses a move with a plain Error; anything else means the run itself is damaged
  G.faulty = null;
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
    G.frames = frames; if (!run.duel && run.lastDuel) { G.overlay = { kind: 'duelEnd', sum: run.lastDuel, rival: G.lastRival, why: run.lastDuel.won ? [] : whyLost(G.note, run.lastDuel, G.lastRival || {}) }; G.note = null; } playFrames(); }
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

async function playFrames() {
  G.playing = true;
  while (G.frames.length) {
    const f = G.frames.shift();
    const ghosts = snapshotGhosts(f.evs);
    G.shown = f; render();
    animate(f.evs, ghosts);
    if (app.classList.contains('ps') && PSV && !RM) { PSV.anim = { t0: performance.now(), ms: G.fast ? 200 : 560, evs: f.evs, frame: f, gone: f.evs.filter(e => e.e === 'destroyed' && e.zone != null).map(e => ({ seat: e.seat, zone: e.zone })) }; requestAnimationFrame(psPaint); }
    cue('duel:frame', { evs: f.evs, fast: !!G.fast }, f.view); for (const e of f.evs) { logLine(e, f.view); cue('duel:' + e.e, e, f.view); }
    const heavy = f.evs.some(e => ['battle', 'summon', 'spell', 'trap', 'terrain', 'meld', 'equip', 'set', 'destroyed'].includes(e.e));
    await new Promise(r => setTimeout(r, G.fast ? 60 : heavy ? 620 : 140));
  }
  G.playing = false; G.shown = null; for (const g of document.querySelectorAll('body > .ghost')) g.remove(); render();
  releaseCues(); // the result is on screen now
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
  if (app.classList.contains('ps')) { const c = fitConsole(app); FIT.k = c.k; FIT.phone = false; const n = document.getElementById('turn'); if (n) n.remove(); if (c.changed) render(); return; } // a new frame size: the screen is laid out again
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
    if (e.e === 'lp') { const el = $(e.seat === 0 ? '#myLp' : '#rivalLp'), ps = app.classList.contains('ps');
      if (el && ps) { // the console way: the number flashes its colour in two hard steps, the change rises beside it in whole pixels
        el.animate([{ color: e.d < 0 ? '#f08a72' : '#9fd0c0' }, { color: e.d < 0 ? '#f08a72' : '#9fd0c0', offset: .99 }, {}], { duration: 500, easing: 'steps(1)' });
        const f = document.createElement('span'); f.className = 'float ' + (e.d < 0 ? 'neg' : 'pos'); f.textContent = (e.d > 0 ? '+' : '') + e.d; f.style.left = el.offsetLeft + 'px'; f.style.top = (el.offsetTop - 10) + 'px'; el.parentElement.appendChild(f); setTimeout(() => f.remove(), 900); }
      else if (el) { el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)', color: e.d < 0 ? '#ff6b5a' : '#7be08d', offset: .3 }, { transform: 'scale(1)' }], { duration: 500 }); const f = document.createElement('span'); f.className = 'float ' + (e.d < 0 ? 'neg' : 'pos'); f.textContent = (e.d > 0 ? '+' : '') + e.d; el.appendChild(f); setTimeout(() => f.remove(), 900); }
      if (e.d <= -1500) { (document.querySelector('.duel') || document.querySelector('#app.ps .vw') || app).animate(ps ? [{ transform: 'translate(0,0)' }, { transform: 'translate(-2px,1px)' }, { transform: 'translate(2px,-1px)' }, { transform: 'none' }] : [{ transform: 'translate(0,0)' }, { transform: 'translate(-.5%,.4%)' }, { transform: 'translate(.5%,-.3%)' }, { transform: 'none' }], { duration: 240, easing: ps ? 'steps(1)' : 'linear' }); } }
    if (e.e === 'relic') { const b = $(e.seat === 0 ? '#relicFlash' : '#rivalFlash'); if (b) { b.textContent = (e.seat === 0 ? '' : 'Rival: ') + RELICS[e.id].name + bonusText(e); const cps = app.classList.contains('ps'); b.animate(cps ? [{ visibility: 'visible', transform: 'translateY(4px)' }, { visibility: 'visible', transform: 'none', offset: .15 }, { visibility: 'visible', offset: .85 }, { visibility: 'hidden' }] : [{ opacity: 0, transform: 'translateY(40%)' }, { opacity: 1, transform: 'none', offset: .2 }, { opacity: 1, offset: .8 }, { opacity: 0 }], { duration: 1100, easing: cps ? 'steps(4)' : 'linear' }); } }
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
  if (app.classList.contains('ps')) { app.classList.remove('ps'); document.body.classList.remove('ps'); app.style.marginLeft = app.style.marginTop = ''; fit(); }
  const r = G.run; let body;
  if (G.screen) body = { forger: screenForger, vault: screenVault, codex: screenCodex, feats: screenFeats }[G.screen]();
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
// The wait, drawn the way a game of the day drew its own: black, and two words. It lies over the page, outside the
// frame (the page is scaled), and over the old look's turn-your-phone note.
function bootScreen(p) {
  let b = document.getElementById('boot');
  if (!b) { b = document.createElement('div'); b.id = 'boot'; document.body.appendChild(b); app.innerHTML = '';
    const k = Math.max(1, Math.floor(Math.min(innerWidth, innerHeight) / 200)); // the coin at a whole number of screen pixels to each of its own
    b.innerHTML = `<canvas id="bootcoin" width="64" height="64" style="width:${64 * k}px;height:${64 * k}px"></canvas><b>NOW LOADING</b><i></i>`; coinLoop(); }
  b.querySelector('i').textContent = p == null ? '' : p + '%';
}
// ---- the crest as a struck coin that turns: on the loading screen, and beside the lit choice on the title as its
// cursor. A 12-sided disc with a rim, the crest on both faces, drawn by the same renderer as the table. The crest
// picture comes inside the page (D.cart.crest), so it turns before the picture pack has arrived.
const COIN = { tex: null, asked: false };
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
function paintCoin(cv, a) {
  const w = cv.width, h = cv.height, view = R3.makeView(cv, w, h); view.px.fill(0);
  const R = 100, T = 16, N = 12, ca = Math.cos(a), sa = Math.sin(a), t = coinTex();
  const P = (x, y, z) => [x * ca + z * sa, y, -x * sa + z * ca], ring = i => { const q = i / N * Math.PI * 2; return [Math.cos(q) * R, Math.sin(q) * R]; };
  const L = [-.4, .5, .77], lit = n => { const m = P(...n); return .5 + .65 * Math.max(0, m[0] * L[0] + m[1] * L[1] + m[2] * L[2]); };
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
// The models' skins load with the pack, so the first room or forge beat is drawn whole (a slow one is not waited on for
// more than three seconds).
function bootWait() { booting = true; bootScreen(); return loadPack(bootScreen).then(() => Promise.race([propTextures(), new Promise(ok => setTimeout(ok, 3000))])).then(() => { const b = document.getElementById('boot'); if (b) b.remove(); booting = false; render(); }); }
const faceName = id => 'face-' + (id === 'last' ? 'last-one' : id);
const relicFile = id => (RELICS[id].kind === 'M' ? 'masterwork' : 'relic') + '-' + id.replace(/_/g, '-');
// Card pictures at console size: each sheet of 100 shrunk to 40 (and, for the card page, 96) pixels a card and cut to
// 15-bit colour when the game loads. A page opened straight from the disk may not read its own pictures: it then shows
// the sheets as they are, shrunk without smoothing.
const CSHEET = { 40: [], 64: [], 96: [] }, CCANVAS = [];
function convertSheets(size) {
  if (!D.sheets || convertSheets[size]) return; convertSheets[size] = 1;
  const n = Math.ceil(D.pool.cards.length / 100);
  for (let i = 0; i < n; i++) {
    const im = new Image(); im.onload = () => {
      const t = R3.crunch(R3.texFrom(im, size * 10, size * 10, 0, 0, im.naturalWidth, im.naturalHeight)); if (!t) return;
      const c = document.createElement('canvas'); c.width = c.height = size * 10; const x = c.getContext('2d'); const id = x.createImageData(size * 10, size * 10); new Uint32Array(id.data.buffer).set(t.d); x.putImageData(id, 0, 0);
      if (size === 40) CCANVAS[i] = t;
      c.toBlob(b => { if (!b) return; CSHEET[size][i] = URL.createObjectURL(b); clearTimeout(convertSheets.t); convertSheets.t = setTimeout(() => { TEX.cards.clear(); if (app.classList.contains('ps')) render(); }, 60); });
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
// A card on a plinth, 68 x 92: its picture at 64.
function psCardL(inst, x, y, o = {}) {
  const c = card(inst.id), role = roleOf(db, inst.id), mon = role === 'monster';
  return `<i class="cd l ${role} ${o.cls || ''}" style="left:${x}px;top:${y}px"><i class="art" style="${cpic(inst.id, 64)}"></i>${mon ? `<i class="n1">ATK ${c.atk + (inst.t ? 300 : 0)}</i><i class="n2">DEF ${c.def + (inst.t ? 300 : 0)}</i>` : `<i class="n1">${role === 'fuel' ? 'FUEL' : role.toUpperCase()}</i>`}${inst.e ? (CART.has('enchant-' + inst.e) ? `<img class="en" src="${cimg('enchant-' + inst.e)}" width="16" height="16" alt="">` : '<i class="en"></i>') : ''}</i>`;
}
// An item's medallion; one without a picture yet is a blank medallion of its kind with its first letter struck in.
const medal = (id, size) => { const f = relicFile(id) + (size === 32 ? '' : '-' + size); if (CART.has(f)) return `<img src="${cimg(f)}" width="${size}" height="${size}" alt="">`;
  const b = 'coin-' + ({ C: 'c', M: 'm' }[RELICS[id].kind] || 'g') + (size === 32 ? '' : '-' + size), L = RELICS[id].name.replace(/^The /, '')[0].toUpperCase(), c = carve(L, Math.round(size * .5), render);
  return `<i class="coin s${size}">${CART.has(b) ? `<img src="${cimg(b)}" width="${size}" height="${size}" alt="">` : ''}${c ? `<img class="lt" src="${c.url}" style="left:${(size - c.w + 2) >> 1}px;top:${(size - c.h + 3) >> 1}px;width:${c.w}px;height:${c.h}px" alt="">` : `<b>${esc(L)}</b>`}</i>`; };
const psPort = (n, x, y, shade = false) => `<div class="pf ${n && CART.has(n) ? (shade ? 'pflk' : '') : 'none'}" style="left:${x}px;top:${y}px">${n && CART.has(n) ? `<img src="${cimg(n)}" alt="">` : CART.has('key-crest-48') ? `<img class="crest" src="${cimg('key-crest-48')}" alt="">` : ''}</div>`;
const shortName = s => String(s || '').replace(/^the /i, '');
const stop = s => { s = String(s || '').trim(); return !s || /[.!?]$/.test(s) ? s : s + '.'; }; // a sentence ends once
// The Forge level: how far toward the next Gift (the same sums as the engine's level-up).
const forgeFrac = r => { const c = db.config, at = l => l === 0 && c.giftFirstXp ? Math.min(c.giftFirstXp, c.xp.perLevel * (c.giftXpScale || 1)) : (l + 1) * c.xp.perLevel * (c.giftXpScale || 1); const lo = r.level ? at(r.level - 1) : 0, hi = at(r.level); return Math.max(0, Math.min(1, (r.xp - lo) / Math.max(1, hi - lo))); };
const sparkRow = (r, x, y) => Array.from({ length: sparksMax(r) }, (_, i) => `<i class="spk${i < r.sparks ? '' : ' out'}" style="left:${x + i * 12}px;top:${y}px"></i>`).join('');

// The left pillar: you.
function psYou(r, v = null, extra = '') {
  const f = r && r.forger;
  let s = psPort(f ? faceName(f) : '', 14, 6) + lb(8, 79, f ? shortName(FORGERS[f].name) : 'YOU', 'g');
  if (v) {
    s += lb(8, 92, 'LIFE', 'g') + `<b id="myLp" class="ab lb" style="left:${88 - String(v.lp[0]).length * 6}px;top:92px">${v.lp[0]}</b>` + gauge(8, 101, 80, v.lp[0] / 8000)
      + lb(8, 114, 'DECK', 'g') + lbr(88, 114, v.deckCount[0]) + lb(8, 125, 'TURN', 'g') + lbr(88, 125, v.turn) + lb(8, 138, 'SPARKS', 'g') + sparkRow(r, 52, 136);
  } else if (r) {
    const cap = weightCap(db, r), w = deckWeight(db, r.deck);
    s += lb(8, 92, 'SPARKS', 'g') + sparkRow(r, 52, 90) + lb(8, 106, 'EMBERS', 'g') + lbr(88, 106, r.embers)
      + lb(8, 120, 'SEALS', 'g') + [0, 1].map(i => `<i class="seal${i < Math.min(2, r.seals) ? ' on' : ''}" style="left:${64 + i * 13}px;top:118px"></i>`).join('')
      + lb(8, 134, 'WEIGHT', 'g') + lbr(88, 134, `${w}/${cap}`) + gauge(8, 143, 80, w / cap, 'w' + (w > cap ? ' over' : ''))
      + lb(8, 156, 'FORGE LV ' + r.level, 'g') + gauge(8, 165, 80, forgeFrac(r), 'x');
  }
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
function psHome() {
  const saved = liveSave(), has = saved && saved.phase !== 'over';
  const { W, H } = F, dy = cy0();
  // The title picture is 720 x 480 (the whole painting at 15/32 of its size); the frame shows its middle. The older
  // cut, 512 x 240, is the middle band at a third of the size, and gets no moving parts.
  let pic = box(0, 0, W, H, 'st dk'), life = '';
  if (CART.has('key-title') && D.cart && D.cart.title === 720) { const ox = (W - 720) >> 1, oy = (H - 480) >> 1; pic = `<img class="bg" data-pic="title" src="${cimg('key-title')}" width="720" height="480" style="left:${ox}px;top:${oy}px;width:720px;height:480px" alt="">`; life = titleLife(ox, oy); }
  else if (CART.has('key-title')) { const ox = (W - 512) >> 1, oy = (H - 240) >> 1; pic = `<img class="bg" src="${cimg('key-title')}" width="512" height="240" style="left:${ox}px;top:${oy}px;width:512px;height:240px" alt="">`; }
  const items = [has && ['CONTINUE', 'resume'], ['NEW DESCENT', 'new'], [`CODEX ${G.known.size}`, 'screen:codex'], [`FEATS ${(P.featsDone || []).length}/${featList(!!labs.long).length}`, 'screen:feats'], [`MEMORY VAULT ${P.memories}`, 'screen:vault'], ['HOW TO PLAY', 'tab:help'], ['OPTIONS', 'tab:options']].filter(Boolean);
  const mx = W - 148, menu = items.map(([t, a], i) => pq(mx, dy + 78 + i * 20, 136, t, a, { lit: i === 0 })).join('') + (coinTex() || (D.cart && D.cart.crest) ? `<canvas id="coin" class="ab" width="16" height="16" style="left:${mx - 19}px;top:${dy + 78}px;pointer-events:none"></canvas>` : ''); // the turning crest marks the lit choice
  const sy = dy + 82 + items.length * 20, low = sy + 46 <= H - 2; // the saved run under the menu, or beside it when the frame is too short
  const slot = has ? `<div class="wn runslot" style="left:${low ? W - 160 : W - 316}px;top:${low ? sy : dy + 78 + items.length * 20 - 46}px">${lb(0, 0, '', '')}<b class="lb g">${esc(saved.forger ? shortName(FORGERS[saved.forger].name) : 'NO FORGER')}</b><br><b class="lb">FLOOR ${saved.floor + 1} · CHAMBER ${Math.min(6, saved.chamber + 1)}</b><br><b class="lb">SPARKS ${saved.sparks} · EMBERS ${saved.embers}</b></div>` : '';
  return `<div class="ti">${pic}${life}
    ${CART.has('key-logo') && D.cart.logo ? `<img class="ab" src="${cimg('key-logo')}" width="${D.cart.logo[0]}" height="${D.cart.logo[1]}" style="left:${W - 152}px;top:${dy + 6}px" alt="Lost Memories">` : `<div class="ab" style="left:${W - 160}px;top:${dy + 8}px;width:160px;display:flex;flex-direction:column;align-items:center;gap:0">${carveImg('LOST', 22, render)}${carveImg('MEMORIES', 22, render)}</div>`}
    ${lb(W - 154, dy + 66, 'BENEATH ASTERHOLD', 'd')}${menu}${slot}
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
  const fade = (t, cls) => `<i class="fade${cls}" style="top:${t}px;${meshAt(0, t)}"></i>`;
  const edge = ph >= h ? '' : low ? fade(oy, ' d75') + fade(oy + 4, '') : fade(oy + ph - 8, '') + fade(oy + ph - 4, ' d75');
  return { name, src: cimg(big ? name + '-l' : name), s, k: s / 1.25, big, ox, oy, pw, ph, edge };
}
// The picture of a room, laid at its place in the view: what every part drawn on it is measured against (data-pic).
const roomImg = rp => `<img class="ab" data-pic="room" src="${rp.src}" style="left:${rp.ox}px;top:${rp.oy}px" width="${rp.pw}" height="${rp.ph}" alt="">`;
// A part laid on the room picture at a point measured in it: at, the point in the picture; pin, the point of the part that
// sits on it. tools/crucible/console-checks.cjs measures every such part against the picture as laid out.
// o: where the picture's corner is in the part's box (the room's own box in the chamber, the view elsewhere).
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
function doorFog(d, [x, y, w, h], rp, H) {
  if (!d.know || d.know === 'known') return '';
  const pw = w + Math.round(22 * rp.k), ph = h + Math.round(16 * rp.k), at = [x + (w >> 1), y + (h >> 1) + Math.round(4 * rp.k)], pin = [pw >> 1, ph >> 1];
  const st = (H && H.stone) || [150, 110, 70], mist = st.map(v => Math.min(255, Math.round(v * .8 + 70))), deep = d.know === 'mystery';
  const patch = (cls, dens, rgb) => onPic('i', 'dfog ' + cls, at, pin, `width:${pw}px;height:${ph}px;background-image:url(${fogSprite(pw, ph, dens, rgb)})`);
  return patch('fa', deep ? .9 : .55, mist) + (deep ? patch('fb', .6, mist.map(v => Math.min(255, v + 24))) : '');
}
function psChamber() {
  const r = G.run, boss = BOSSES[r.floor][r.bossOrder[r.floor]], fl = r.floor + 1;
  const hall = ART.has('hall-doors-' + fl) && CART.has('hall-doors-' + fl) ? 'hall-doors-' + fl : 'hall-doors';
  const at = r.doors.length === 1 ? [1] : r.doors.length === 2 ? [0, 2] : [0, 1, 2];
  // A cursor rests on one door, as on a pad: the ledge reads that door out, a second tap on it (or ENTER) goes in.
  const lockedAt = i => r.doors[i].type === 'boss' && r.seals < 2, key = `${r.floor}.${r.chamber}.${r.doors.map(d => d.type).join()}`;
  if (!G.doorSel || G.doorSel.at !== key || !r.doors[G.doorSel.i]) G.doorSel = { at: key, i: Math.max(0, r.doors.findIndex((d, i) => !lockedAt(i))) };
  const sel = G.doorSel.i, d = r.doors[sel], n = r.doors.length;
  const rp = roomPic(hall, NICHE_Y + 34, true), ways = doorways(hall, rp), H = hallInfo(hall), open = G.doorOpen && G.doorOpen.at === key ? G.doorOpen : null;
  const doors = r.doors.map((d, i) => { const [x, y, w, h] = ways[at[i]], locked = lockedAt(i), art = d.type === 'secret' && CART.has(leafPic(hall, 'hidden', at[i], rp)) ? 'hidden' : DOOR_ART[d.type], leaf = leafPic(hall, art, at[i], rp); // the door that is not there has its own plain leaves
    const src = open && open.i === i ? open.url : CART.has(leaf) ? cimg(leaf) : ''; // a door opened while its guardian speaks stays open
    return onPic('button', `dr k-${d.know || 'known'}${locked ? ' lock' : ''}${i === sel ? ' on' : ''}`, [x, y], [0, 0], `width:${w}px;height:${h}px;--mesh:${(rp.ox + x) & 1}px ${(rp.oy + y) & 1}px${src ? `;--lf:url(${src})` : ''}`, `data-i="${i}" data-a="${i === sel ? 'door' : 'dsel'}:${i}" ${locked && i === sel ? 'disabled' : ''} aria-label="${esc(doorName(d))}"`, src ? `<img src="${src}" width="${w}" height="${h}" style="width:${w}px;height:${h}px" alt="">` : '') + doorFog(d, [x, y, w, h], rp, H); }).join('');
  // Each door's number on the step under it, and the cursor under the chosen one, pointing up at it: clear of the carving.
  const marks = r.doors.map((d, i) => { const [x, y, w, h] = ways[at[i]], foot = [x + (w >> 1), y + h + Math.round(3 * rp.k)];
    return onPic('i', `dno${i === sel ? ' on' : ''}`, foot, [5, 0], '', '', i + 1) + (i === sel ? onPic('i', 'cur curu', [foot[0], foot[1] + 12], [4, 0]) : ''); }).join('');
  const view = `<div class="room" style="left:${rp.ox}px;top:${rp.oy}px;width:${rp.pw}px;height:${rp.ph}px"><img data-pic="room" src="${rp.src}" width="${rp.pw}" height="${rp.ph}" alt="">${doors}${keepers(r, rp, ways, H)}${marks}</div>${rp.edge}`;
  const lw = ledgeW(), ledge = `<div class="dt" style="width:${lw - 82}px"><b>${sel + 1} · ${esc(doorName(d))}</b><p><i class="lmc">COST</i> ${esc(d.cost)}</p><p><i class="lmg">GAIN</i> ${esc(d.reward)}</p></div>`
    + (n > 1 ? pq(lw - 72, 4, 30, '<', `dsel:${(sel + n - 1) % n}`, { title: 'Door to the left' }) + pq(lw - 38, 4, 30, '>', `dsel:${(sel + 1) % n}`, { title: 'Door to the right' }) : '')
    + pq(lw - 72, 40, 64, lockedAt(sel) ? 'SEALED' : 'ENTER', `door:${sel}`, { lit: !lockedAt(sel), off: lockedAt(sel) });
  const secret = r.doors.some(d => d.type === 'secret');
  const said = d.law ? 'Its Law: ' + lawShown(d.law) : d.tell ? `${d.style}: ${d.tell}` : d.hidden ? d.hidden : d.know === 'mystery' ? 'Fog hides what waits behind it.' : (d.tags || []).length ? d.tags.join('. ') + '.' : '';
  const bar = [r.lastNote, said, lockedAt(sel) ? 'It needs two seals.' : '', said || r.lastNote ? '' : secret ? 'A door that was not there before.' : `Guardian of this floor: ${boss.name}. ${r.chamber >= 2 ? bossLaw(db, r) : 'Its Law shows from chamber 3.'}`].filter(Boolean).map(esc).join(' ');
  const pips = Array.from({ length: 6 }, (_, i) => `<i class="pip${i < r.chamber ? ' on' : i === r.chamber ? ' at' : ''}" style="left:${8 + i * 11}px;top:20px"></i>`).join('') + `<i class="seal${r.seals >= 2 ? ' on' : ''}" style="left:76px;top:19px"></i>`;
  const rel = relicList(r), belt = Array.from({ length: 9 }, (_, i) => { const id = rel[i]; return `<button class="sl" style="left:${8 + (i % 3) * 28}px;top:${54 + Math.floor(i / 3) * 28}px" data-a="tab:relics" aria-label="${id ? esc(RELICS[id].name) : 'Empty relic slot'}">${id ? medal(id, 24) : ''}</button>`; }).join('');
  const right = lb(8, 8, `FLOOR ${fl}`, 'g') + pips + lb(8, 40, 'RELICS', 'g') + (rel.length > 9 ? lbr(88, 40, '+' + (rel.length - 9)) : '') + belt
    + lb(8, 142, `CHARMS ${r.charms.length}/${db.config.charmSlots}`, 'g') + (db.config.heatRules && r.heat ? pq(4, yb(160), 88, `HEAT ${r.heat} RULES`, `heatinfo:${r.heat}`) : '')
    + pq(4, yb(180), 88, 'DOORS IN FULL', 'tab:doors') + pq(4, yb(200), 88, 'DECK', 'tab:deck') + pq(4, yb(220), 88, 'RELICS', 'tab:relics');
  G.barText = bar;
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
  if (cv) { cv.width = w; cv.height = h; cv.style.cssText = `width:${w}px;height:${h}px`; img.replaceWith(cv); }
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
// The camera for a view of w x h: the table as large as the height allows while all five zones of the near row stay in
// the view, its near edge on the bottom edge.
// When the table model is there the view shows as much of its front and legs as fits under the far trap row.
const tableCam = (w, h) => { const k = Math.min(h / 128, (w / 2 - 6) / 119), legs = !!tmodel();
  return { y: 200, z: 525, pitch: .75, f: Math.round(350 * k), cx: w >> 1, cy: legs ? Math.round(Math.max(2 + 178 * k, h - 13 * k - 2)) : Math.round(h + 74 * k) + 1 }; };
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
const TEX = { cards: new Map(), table: null, back: null, loading: false };
// A Field Spell's ground (Randall's terrain sheet, cut to 128 x 64): loaded the first time its terrain is in play.
const terrainTex = id => { const n = 'terrain-' + String(card(id).name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), k = 't-' + id; if (TEX[k] !== undefined || !CART.has(n)) return; TEX[k] = null; const im = new Image(); im.onload = () => { TEX[k] = R3.texFrom(im, 128, 64); if (app.classList.contains('ps')) psPaint(); }; im.src = cimg(n); };
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
// the room, so a model is dimmed with its room. data-foot lists where each model's foot is in the picture, and the
// checks find each drawn model standing there. It takes no taps, so what lies under it is tapped as before.
const modelCanvas = (rp, items, inRoom = false, id = 'prop') => items.length ? onPic('canvas', 'ab', [0, 0], [0, 0], 'pointer-events:none', `id="${id}" width="${rp.pw}" height="${rp.ph}" data-foot="${items.map(i => i[2] + ',' + i[3]).join(' ')}" data-items='${JSON.stringify(items)}'`, '', inRoom ? [0, 0] : [rp.ox, rp.oy]) : '';
function propSpot(rp, kind) { // the models standing in an offer room, or nothing
  if (rp.name === 'room-vault' && kind !== 'treasure') return ''; // the chest stands at a treasure only, not at the other vault offers
  return modelCanvas(rp, spotsOf(rp.name).filter(s => pmodel(s[0])).map(s => spotAt(rp, s)));
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
function psTextures() {
  if (TEX.loading) return; TEX.loading = true;
  const load = (n, w, h, k) => { if (!CART.has(n)) return; const im = new Image(); im.onload = () => { TEX[k] = R3.texFrom(im, w, h); if (app.classList.contains('ps')) psPaint(); }; im.src = cimg(n); };
  load('table', 128, 128, 'table'); load('cardback', 44, 60, 'back');
  const M = tmodel(); if (M) for (const [t, [w, h]] of Object.entries(M.pics)) load('model-table-' + t, w, h, 'm-' + t);
}
const ROLE_RGB = { monster: [168, 126, 79], spell: [76, 138, 124], field: [76, 138, 124], trap: [150, 64, 52], equip: [122, 84, 60], fuel: [90, 80, 72] };
function cardTex(id) {
  if (TEX.cards.has(id)) return TEX.cards.get(id);
  const i = IDX.get(id), sh = i == null ? null : CCANVAS[Math.floor(i / 100)];
  let t = null; if (sh) { const k = i % 100, sx = (k % 10) * 40, sy = Math.floor(k / 10) * 40, d = new Uint32Array(40 * 40); for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) d[y * 40 + x] = sh.d[(sy + y) * 400 + sx + x]; t = { w: 40, h: 40, d }; }
  if (t) TEX.cards.set(id, t);
  return t;
}
let PSV = null; // what the table shows now: { v, sel, anim }
// Draw the table and every card on it into the window's canvas. Cards lie flat; a card in defense lies sideways.
function psPaint() {
  const cv = document.getElementById('tbl'); if (!cv || !PSV) return;
  const vs = viewSize(); TBL.cam = tableCam(vs.w, vs.h);
  const view = R3.makeView(cv, vs.w, vs.h), proj = R3.camera(TBL.cam), v = PSV.v, now = performance.now();
  R3.clear(view, 0); view.px.fill(0); // see-through: the hall picture behind the canvas shows where nothing is drawn
  const T = TEX.table || R3.flat(8, 8, [168, 126, 79]);
  if (!tableQuads(view)) R3.quad(view, { p: [[-190, 0, -192], [190, 0, -192], [190, 0, 192], [-190, 0, 192]], uv: [[0, 0], [T.w * 3 - 1, 0], [T.w * 3 - 1, T.h * 3 - 1], [0, T.h * 3 - 1]], tex: { w: T.w * 3, h: T.h * 3, d: tile3(T) }, shade: [.55, .55, 1, 1], bias: 2000 });
  const tg = v.terrain && TEX['t-' + v.terrain.id]; // the terrain's ground, laid inside the table's border while it holds
  if (tg) for (let j = 0; j < 4; j++) for (let i = 0; i < 2; i++) { const x0 = -170 + i * 170, z0 = -170 + j * 85;
    R3.quad(view, { p: [[x0, 0, z0], [x0 + 170, 0, z0], [x0 + 170, 0, z0 + 85], [x0, 0, z0 + 85]], uv: [[0, 0], [tg.w - 1, 0], [tg.w - 1, tg.h - 1], [0, tg.h - 1]], tex: tg, shade: .66 + .34 * (j + 1) / 4, bias: 1500 }); }
  else if (v.terrain) terrainTex(v.terrain.id);
  const narrow = v.mon[0].length < 5;
  for (const seat of [0, 1]) for (let z = 0; z < 5; z++) { // the zone outlines, cut into the stone
    const cx = TBL.zx(z), cz = TBL.row[seat], shut = narrow && (z === 0 || z === 4);
    R3.quad(view, { p: [[cx - 25, 0, cz - 33], [cx + 25, 0, cz - 33], [cx + 25, 0, cz + 33], [cx - 25, 0, cz + 33]], uv: [[0, 0], [0, 0], [0, 0], [0, 0]], col: shut ? [58, 36, 25] : [96, 66, 44], shade: .9, bias: 1000 });
    if (!shut) R3.quad(view, { p: [[cx - 23, 0, cz - 31], [cx + 23, 0, cz - 31], [cx + 23, 0, cz + 31], [cx - 23, 0, cz + 31]], uv: [[0, 0], [0, 0], [0, 0], [0, 0]], col: [140, 104, 66], shade: .9, bias: 999 });
  }
  const anim = PSV.anim && now - PSV.anim.t0 < PSV.anim.ms ? PSV.anim : null, at = anim ? (now - anim.t0) / anim.ms : 1;
  const lay = (inst, seat, zi, cz, small) => {
    if (!inst) return;
    let cx = TBL.zx(zi), lift = 0, dz = 0;
    if (anim) for (const e of anim.evs) {
      if (e.e === 'summon' && e.seat === seat && e.zone === zi - (narrow ? 1 : 0) && !small) lift = Math.max(0, 1 - at * 1.6) * 60;
      if (e.e === 'attack' && e.seat === seat && e.from === zi - (narrow ? 1 : 0) && !small) { const k = Math.sin(Math.min(1, at * 1.4) * Math.PI); const tz = e.to >= 0 ? TBL.row[1 - seat] : (seat === 0 ? -192 : 192), tx = e.to >= 0 ? TBL.zx(e.to + (narrow ? 1 : 0)) : 0; cx += (tx - cx) * k * .8; dz = (tz - cz) * k * .8; lift = k * 14; }
    }
    const def = inst.pos === 'd', hw = small ? 16 : def ? 29 : 21, hd = small ? 21 : def ? 21 : 29, y = lift, z0 = cz + dz;
    const back = inst.veil && (!inst.id || seat === 1), t = back ? TEX.back : cardTex(inst.id);
    const corners = def ? [[cx + hw, y, z0 - hd], [cx + hw, y, z0 + hd], [cx - hw, y, z0 + hd], [cx - hw, y, z0 - hd]] : [[cx - hw, y, z0 - hd], [cx + hw, y, z0 - hd], [cx + hw, y, z0 + hd], [cx - hw, y, z0 + hd]];
    if (t) R3.quad(view, { p: corners, uv: back ? [[0, 0], [43, 0], [43, 59], [0, 59]] : [[0, 0], [39, 0], [39, 39], [0, 39]], tex: t, shade: [.8, .8, 1, 1], bias: -lift * 4 });
    else R3.quad(view, { p: corners, uv: [[0, 0], [0, 0], [0, 0], [0, 0]], col: back ? [65, 27, 40] : ROLE_RGB[roleOf(db, inst.id)] || [168, 126, 79], shade: [.8, .8, 1, 1], bias: -lift * 4 });
  };
  for (const seat of [1, 0]) {
    v.mon[seat].forEach((m, z) => lay(m, seat, z + (narrow ? 1 : 0), TBL.row[seat], false));
    v.traps[seat].forEach((t, z) => lay(t ? (seat === 1 ? { veil: true } : { ...t, veil: true, id: null }) : null, seat, z, TBL.trap[seat], true));
  }
  if (anim) for (const g of anim.gone || []) { const k = Math.min(1, at * 1.5); if (k < 1) { const cx = TBL.zx(g.zone + (narrow ? 1 : 0)), cz = TBL.row[g.seat]; for (let i = 0; i < 16; i++) { const gx = cx - 21 + (i % 4) * 11, gz = cz - 29 + Math.floor(i / 4) * 15, fall = k * (20 + ((i * 7) % 5) * 8); R3.quad(view, { p: [[gx, fall, gz], [gx + 10 - k * 8, fall, gz], [gx + 10 - k * 8, fall, gz + 14 - k * 12], [gx, fall, gz + 14 - k * 12]], uv: [[0, 0], [0, 0], [0, 0], [0, 0]], col: [150, 140, 130], shade: 1 - k * .7, bias: -200 }); } } }
  R3.draw(view, proj, [420, 760]); R3.present(view);
  if (anim) requestAnimationFrame(psPaint);
}
function tile3(T) { if (T.t3) return T.t3; const w = T.w * 3, h = T.h * 3, d = new Uint32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d[y * w + x] = T.d[(y % T.h) * T.w + (x % T.w)]; T.t3 = d; return d; }
// Where a zone of the table lands in the window, for its tap area and its number.
function zoneBox(seat, zi, trap = false) {
  const proj = R3.camera(TBL.cam), cx = TBL.zx(zi), cz = trap ? TBL.trap[seat] : TBL.row[seat], hw = trap ? 17 : 25, hd = trap ? 22 : 33;
  const pts = [[cx - hw, 0, cz - hd], [cx + hw, 0, cz - hd], [cx + hw, 0, cz + hd], [cx - hw, 0, cz + hd]].map(proj);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}
// A table monster's two numbers, ATK then DEF: on one line inside your card's near edge, or stacked ATK over DEF (as on
// a hand card) over a rival's card, where the far row is too tight for one line. The number its position uses is bright
// (gold when raised above the printed number, red when lowered, sea-green for DEF in defense); the other is dim.
function tableNums(m, x, y, stack) {
  const c = m.id ? card(m.id) : null, d = m.pos === 'd', tone = (n, p) => !c ? '' : n > p ? 'g' : n < p ? 'r' : '';
  const a = `<i class="${d ? 'd' : tone(m.ea, c && c.atk)}">${m.ea}</i>`, e = `<i class="${d ? tone(m.ed, c && c.def) || 'v' : 'd'}">${m.ed}</i>`;
  return `<b class="atk${stack ? ' two' : ''}" style="left:${x}px;top:${y}px">${stack ? a + e : a + '<i class="d">/</i>' + e}</b>`;
}
// Short words for the plaques.
const PLAY_WORDS = (x, free, aimM) => x.pos === 'a' ? (x.veiled ? 'VEILED ATK' : 'ATTACK POS') : x.pos === 'd' ? (x.veiled ? 'SET VEILED' : 'DEFENSE POS') : (free ? 'PLAY FREE' : aimM ? 'PLAY ON TARGET' : 'PLAY');
function psDuel() {
  const live = G.run.duel, f = G.shown;
  const v = f ? f.view : live ? viewFor(live, db, 0) : null;
  if (!v) return frame({});
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
  let bar = '', cmds = [];
  if (canPlay && G.sel.length) {
    const cards = G.sel.map(i => live.hand[0][i]); const ontoM = G.onto != null ? live.mon[0][G.onto] : null;
    const plan = planChain(db, cards, ontoM, { tinder: v.relics.includes('tinder_vow'), steady: v.relics.includes('steady_hand') && !v.rs.steady });
    const ids = (ontoM ? [ontoM.id] : []).concat(cards.map(c => c.id));
    const allKnown = plan.tried.every(t => codexKnows(db, k => G.known.has(k), t[0], t[1], t[2]));
    const vars = playVariants(live, db, 0, G.sel, G.onto);
    const loneNow = live.seat[0].rs.loneTurn === live.turn, freeNow = db.config.freeCast === 'lone' && !live.seat[0].noFree && live.seat[0].rs.freeTurn !== live.turn && G.sel.length === 1 && G.onto == null;
    const aimM = aimed != null ? v.mon[aim.side][aimed] : null, aimName = aimM ? (aimM.id ? card(aimM.id).name : 'the veiled monster') : '';
    bar = ids.map(id => esc(card(id).name)).join(' <b class="g">+</b> ') + (ids.length < 2 ? '' : ` <b class="g">=</b> ${allKnown ? esc(card(plan.final.id).name) + (plan.fizzles ? ` (${plan.fizzles} fizzle)` : '') : '? an unknown meld'}`);
    if (ids.length === 1) bar += '. ' + esc(db.isMonster(ids[0]) ? `${card(ids[0]).type}, ${card(ids[0]).attr}, Level ${card(ids[0]).level}.` : rulesText(ids[0]));
    if (!vars.length) bar = esc(loneNow && (G.sel.length > 1 || G.onto != null) ? 'You played a free support card this turn, so you cannot meld. Play one card on its own.' : 'That cannot be played right now.');
    else if (aim) bar += ' ' + esc(aimM ? 'Target: ' + aimName + '.' : `Tap ${aim.side ? 'a rival monster' : 'one of your monsters'} to aim it.`);
    cmds = vars.map((x, i) => [PLAY_WORDS(x, freeNow, aimM), `play:${x.pos || ''}:${x.veiled ? 1 : 0}`, { lit: i === 0 }]).concat([['UNDO', 'undo']]);
    if (G.sel.length === 1) cmds.push(['SCRAP CARD', 'scrap']);
    if (v.relics.includes('clean_draw') && !v.rs.cleanDraw) cmds.push(['CLEAN DRAW', 'clean']);
  } else if (G.attacker != null) {
    bar = targets.length ? 'Pick a target. The mark over each rival says how the attack ends.' : 'This monster has nothing it can attack.';
    if (targets.includes(-1)) cmds.push([`DIRECT ${v.mon[0][G.attacker].ea}`, 'hit:-1', { lit: true }]);
    if (canPos.has(G.attacker)) cmds.push(['CHANGE POS', 'pos']);
    cmds.push(['CANCEL', 'undo']);
  } else if (G.onto != null) { bar = 'Now tap hand cards to meld onto it.'; cmds.push(['CANCEL', 'undo']); }
  else if (lesson) { const [h, t] = lessonText(lesson.kind, lesson.cards.map(i => card(live.hand[0][i].id).name)); bar = `<b class="g">${esc(h)}.</b> ${esc(t)}`; cmds.push(['NO LESSONS', 'tipsoff']); }
  else if (myTurn) bar = counsel() ? `<b class="g">Counsel.</b> ${esc(counsel())}` : canPlay ? (live.seat[0].rs.loneTurn === live.turn ? 'Support turn: your support card was free. Play one card on its own. No meld this turn.' : 'Tap hand cards in order. One card plays it. Two or more meld, left to right.') : 'Tap one of your monsters to attack with it, or end your turn.';
  if (G.playing) bar = esc(G.log.slice(-2).join(' ') || '');
  else if (!myTurn) bar = pend ? 'Answer the attack.' : 'The rival is thinking.';
  // the table: tap areas and numbers over the canvas
  const vs = viewSize(); TBL.cam = tableCam(vs.w, vs.h);
  const narrow = v.mon[0].length < 5, off = narrow ? 1 : 0;
  const fc = z => { const X = live.mon[0][G.attacker], Tm = v.mon[1][z]; if (z < 0 || Tm.veil) return '?'; const q = forecast(live, db, 0, X, 1, live.mon[1][z]); const kt = q.killT && !holds(live.mon[1][z]), kx = q.killX && !holds(X); return kt && kx ? 'BOTH FALL' : kt ? 'WINS' : kx ? 'LOSES' : 'NO KILL'; };
  let hits = '';
  for (const seat of [1, 0]) v.mon[seat].forEach((m, z) => {
    const bx = zoneBox(seat, z + off); let cls = 'zh', attrs = `data-zone="${seat}:${z}"`, mark = '';
    if (aim && aim.side === seat && m) { cls += ' target' + (aimed === z ? ' picked' : ''); attrs += ` data-a="aim:${z}"`; }
    else if (seat === 0 && m && myTurn) { if (canAtk.has(z)) cls += ' ready'; attrs += ` data-a="mine:${z}"`; if (G.attacker === z) cls += ' picked'; if (G.onto === z) cls += ' onto'; }
    else if (seat === 1 && m && targets.includes(z)) { cls += ' target'; attrs += ` data-a="hit:${z}"`; mark = fc(z); }
    else if (m) attrs += ` data-a="inspectz:${seat}:${z}"`;
    hits += `<button class="${cls}" style="left:${bx.x}px;top:${bx.y}px;width:${bx.w}px;height:${bx.h}px" ${attrs} aria-label="${m ? (m.id ? esc(card(m.id).name) : 'Veiled monster') : 'Empty zone'}"></button>`;
    // both numbers on every face-up monster (tableNums)
    if (m && seat === 0) hits += tableNums(m, bx.x + 2, bx.y + bx.h - 9);
    if (m && seat === 1 && !m.veil && m.id) hits += tableNums(m, bx.x + 1, Math.max(0, bx.y - 17), true);
    if (mark) hits += `<b class="atk ${mark === 'WINS' ? 'up' : mark === 'LOSES' ? 'down' : ''}" style="left:${bx.x}px;top:${bx.y + 2}px">${mark}</b>`;
  });
  v.traps[0].forEach((t, z) => { if (!t) return; const bx = zoneBox(0, z, true); hits += `<button class="zh" style="left:${bx.x}px;top:${bx.y}px;width:${bx.w}px;height:${bx.h}px" data-a="inspect:${t.id}" aria-label="${esc(card(t.id).name)}"></button>`; });
  const terr = v.terrain ? card(v.terrain.id).name + (v.terrain.temp != null ? ` (${v.terrain.temp})` : '') + (v.terrain.lock ? ' (locked)' : '') : '';
  const fl = G.run.floor + 1, hall = rv.tier === 'secret' && CART.has('room-bare') ? 'room-bare' : rv.tier === 'boss' && CART.has('room-guardian') ? 'room-guardian' : CART.has('hall-duel-' + fl) ? 'hall-duel-' + fl : 'hall-duel'; // a guardian waits in its own hall
  const rp = roomPic(hall, 70, !!tmodel()); // the table stands on the hall's floor
  const view = `<img class="ab" src="${rp.src}" style="left:${rp.ox}px;top:${rp.oy}px" width="${rp.pw}" height="${rp.ph}" alt="">${rp.edge}<canvas id="tbl" width="${vs.w}" height="${vs.h}"></canvas>${hits}${terr ? `<b class="atk" style="left:4px;top:4px">TERRAIN ${esc(terr)}</b>` : ''}<div id="relicFlash" class="flash"></div><div id="rivalFlash" class="flash"></div>`;
  PSV = { v, anim: PSV && PSV.anim && PSV.anim.frame === f ? PSV.anim : null };
  // the hand
  const hx = (ledgeW() - 296) >> 1, hand = [0, 1, 2, 3, 4, 5].map(i => { const c = v.hand[i], k = G.sel.indexOf(i), lp = lesson ? lesson.cards.indexOf(i) : -1, x = hx + i * 50;
    return c ? psCard(c, x, k >= 0 ? -4 : 0, { cls: 'hs ' + (canPlay ? 'can ' : '') + (k >= 0 ? 'sel' : ''), attrs: `data-a="hand:${i}"`, badge: k >= 0 ? k + 1 : '', pip: lp >= 0 ? lp + 1 : '' }) : `<i class="ab" style="left:${x}px;top:0;width:44px;height:60px;border:1px solid var(--dark)"></i>`; }).join('');
  // the Forger's Power, on your pillar
  let power = '';
  if (myTurn && v.forger && !v.rs.power) { const Fg = FORGERS[v.forger], pa = powerActions(live, db, 0); const ok = Fg.needs === 'hand' ? G.sel.length === 1 && pa.some(p => p.hand === G.sel[0]) : Fg.needs === 'zone' ? G.attacker != null && pa.some(p => p.zone === G.attacker) : pa.length > 0 && !G.sel.length;
    power = pq(4, yb(176), 88, shortName(Fg.power), `power:${Fg.needs || ''}`, { off: !ok, title: Fg.powerText, cls: ok ? 'on' : '' }); }
  else if (v.forger && v.rs.power) power = lb(8, yb(180), 'POWER USED', 'd');
  // the rival, on the other pillar
  const rf = rv.tier === 'secret' ? 'face-last-one' : 'face-' + String(rv.name || '').toLowerCase().replace(/^the /, '').replace(/[^a-z]+/g, '-').replace(/^-|-$/g, ''); // a named rival's own face, when there is one
  const endOk = myTurn && !G.sel.length && G.attacker == null && G.onto == null;
  const right = psPort(rf, 14, 6) + lb(8, 79, fitName(shortName(rv.name), 13), 'g') + lb(8, 92, 'LIFE', 'g') + `<b id="rivalLp" class="ab lb" style="left:${88 - String(v.lp[1]).length * 6}px;top:92px">${v.lp[1]}</b>` + gauge(8, 101, 80, v.lp[1] / 8000)
    + lb(8, 114, 'HAND', 'g') + `<span class="backs" style="left:40px;top:112px">${'<u></u>'.repeat(Math.min(v.rivalHand, 5))}</span>` + lb(8, 125, 'DECK', 'g') + lbr(88, 125, v.deckCount[1])
    + cmds.slice(0, 4).map(([t, a, o], i) => pq(4, yb(138 + i * 20), 88, t, a, o || {})).join('') + (endOk ? pq(4, yb(220), 88, 'END TURN', 'end', { lit: !cmds.some(c => c[2] && c[2].lit) }) : '');
  const more = cmds.length > 4 ? cmds.slice(4).map(([t, a, o], i) => pq(ledgeW() - 92 - i * 92, -18, 88, t, a, o || {})).join('') : '';
  const left = psYou(G.run, v, power + pq(4, yb(198), 88, 'THIS DUEL', 'tab:duel'));
  const prompt = pend && !G.tab && !G.inspect && !G.overlay ? psTrap(live) : ''; // another window opened over the question takes its place until it is closed
  G.barText = bar;
  return frame({ left, right, view, ledge: `<div class="hand">${hand}</div>${more ? `<div class="ab" style="left:0;top:0;width:320px">${more}</div>` : ''}`, bar, barMore: bar.replace(/<[^>]+>/g, '').length > 74, extra: prompt });
}
function psTrap(live) {
  const pv = viewFor(live, db, 0), pX = pv.mon[1][live.pending.from], pT = live.pending.to >= 0 ? pv.mon[0][live.pending.to] : null;
  const head = `${pX && !pX.veil ? esc(card(pX.id).name) + ' (' + pX.ea + ')' : 'A veiled monster'} attacks ${pT ? esc(card(pT.id).name) + ' (' + (pT.pos === 'd' ? pT.ed + ' DEF' : pT.ea + ' ATK') + ')' : 'you directly'}.`;
  const n = live.pending.options.length, hl = Math.min(3, Math.ceil(head.replace(/&[a-z]+;/g, '&').length / 36)), top = 28 + hl * 16; // the attack in its lines, then the Traps
  const H = Math.min(F.H - 16, top + 32 + n * 66), more = top + 32 + n * 66 > H; // a list that scrolls when the frame cannot hold every Trap, and says so
  const opts = live.pending.options.map((i, k) => { const t = live.traps[0][i]; return `<div class="ab" style="left:8px;top:${k * 66}px;width:296px;height:62px">${psCard(t, 0, 0)}<div class="ab" style="left:50px;top:0;width:250px;height:44px;line-height:16px;overflow:hidden"><b class="lb g" style="display:block;height:10px;line-height:8px">${esc(card(t.id).name)}</b>${esc(shortText(t.id))}</div>${pq(206, 46, 88, 'SPRING IT', 'respond:' + i, { lit: k === 0 })}</div>`; }).join(''); // the words take two lines across the row, the plaque sits under them
  return win(96, 8 - cy0(), 320, H, `<h2>Spring a Trap?</h2><p style="height:${hl * 16}px">${head}</p><div class="ab sc" style="left:0;top:${top}px;width:320px;height:${H - top - 30}px">${opts}</div>${more ? lb(8, H - 20, 'MORE BELOW, SCROLL', 'g') : ''}${pq(216, H - 26, 88, 'LET IT THROUGH', 'respond:-1')}`);
}

// ---- offerings: a card, a Gift, a charm, a Guardian Reward, a treasure, the Sanctum, a starter kit
// The choices stand on plinths in the view. A cursor rests on one; the ledge names it, the text bar reads it out, and a
// second tap on it (or TAKE) takes it. Each choice: { pic, name, facts, text, a, off, card }.
// A name on one plinth line: the first words shrink to initials until it fits, then the first word stands whole with the
// rest as initials (TARN E.), then initials alone; a word is never cut in the middle unless it is the only word, and then
// it ends in a full stop. The ledge still gives the name whole.
function fitName(name, n) {
  const w = String(name).toUpperCase().split(/\s+/).filter(Boolean), ini = x => x[0] + '.', whole = w.join(' ');
  const tries = [whole, ...w.slice(1).map((_, i) => [...w.slice(0, i + 1).map(ini), ...w.slice(i + 1)].join(' '))];
  if (w.length > 1) tries.push([w[0], ...w.slice(1).map(ini)].join(' '), w.map(ini).join(' '));
  const t = tries.find(x => x.length <= n); if (t) return t;
  return w.length > 1 ? w.map(ini).join(' ').slice(0, n) : whole.slice(0, Math.max(1, n - 1)) + '.';
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
  // plinths a little narrower for it if need be (never under 92, a card and its border).
  const tc = carve(title, 12, render), tb = 3 + (tc ? tc.h : 10), ph = Math.min(124, Math.max(vs.h - tb - 14, 106)); // 106: a card and its name
  const clear = CLEAR[rp.name] && (!CLEAR[rp.name][2] || CLEAR[rp.name][2] === kind) ? CLEAR[rp.name] : null, cl = clear && [rp.ox + Math.round(clear[0] * rp.k), rp.ox + Math.round(clear[1] * rp.k)];
  // Each plinth has a share sw wide and stands 2 pixels inside it; at(i) is where share i begins.
  const sw0 = Math.min(104, Math.floor((vs.w - 8) / n)), nl = n >> 1, y0 = Math.min(vs.h - 2 - ph, Math.max(tb + 10, ((vs.h - ph) >> 1) + 4));
  const split = cl && nl ? Math.min(sw0, Math.floor((cl[0] - 1) / nl), Math.floor((vs.w - 1 - cl[1]) / (n - nl))) : 0; // half the choices each side
  const side = cl ? Math.min(sw0, Math.max(Math.floor((vs.w - 1 - cl[1]) / n), Math.floor((cl[0] - 1) / n))) : 0; // all on one side
  const sw = split >= 92 ? split : side >= 92 ? side : sw0, wide = sw * n;
  const at = split >= 92 ? i => i < nl ? cl[0] - 2 - (nl - i) * sw : cl[1] + 2 + (i - nl) * sw
    : side >= 92 ? i => (cl[1] + 2 + wide <= vs.w + 1 ? cl[1] + 2 : cl[0] - 2 - wide) + i * sw : i => ((vs.w - wide) >> 1) + i * sw;
  // Each plinth's dots lie on the frame's grid in step with the dimming's, so the room shows through every plinth alike
  // (the dots start inside its 1-pixel border); the shadow on a plinth not chosen lies on the pixels between.
  const plinths = items.map((x, i) => { const L = at(i) + 2; return `<button class="pln${i === sel ? ' on' : ''}${x.off ? ' off' : ''}" style="left:${L}px;top:${y0}px;width:${sw - 4}px;height:${ph}px;--mesh:${(L + 1) & 1}px ${(y0 + 1) & 1}px;--mesh2:${L & 1}px ${(y0 + 1) & 1}px" ${i === sel ? (x.off ? 'aria-disabled="true"' : `data-a="${x.a}"`) : `data-a="${selA ? selA(i) : 'osel:' + i}"`} aria-label="${esc(x.name)}">${x.pic((sw - 4) >> 1, ph - 13)}<b class="pnm" style="top:${ph - 11}px">${esc(fitName(x.name, (sw - 12) / 6 | 0))}</b></button>`; }).join('');
  const head = tc ? `<img class="ab" src="${tc.url}" width="${tc.w}" height="${tc.h}" style="left:${(vs.w - tc.w) >> 1}px;top:3px" alt="${esc(title)}">` : `<b class="ab lb g" style="left:${(vs.w - title.length * 6) >> 1}px;top:5px">${esc(title)}</b>`;
  const view = `${roomImg(rp)}${rp.edge}${propSpot(rp, kind)}<i class="dim0"></i>${head}${plinths}${y0 - 8 >= tb ? `<i class="cur" style="left:${at(sel) + (sw >> 1) - 4}px;top:${y0 - 8}px"></i>` : ''}`; // a view too short for the cursor between the title and the plinths marks the choice by its plinth alone
  const ledge = `<div class="dt" style="width:${lw - 82}px"><b>${esc(it.name)}</b>${(it.facts || []).map(f => `<p>${f}</p>`).join('')}</div>`
    + (n > 1 ? pq(lw - 72, 4, 30, '<', selA ? selA((sel + n - 1) % n) : `osel:${(sel + n - 1) % n}`, { title: 'Choice to the left' }) + pq(lw - 38, 4, 30, '>', selA ? selA((sel + 1) % n) : `osel:${(sel + 1) % n}`, { title: 'Choice to the right' }) : '')
    + (it.card ? pq(lw - 72, 22, 64, 'CARD PAGE', `inspect:${it.card}`) : '') + pq(lw - 72, 40, 64, it.take || 'TAKE', it.a, { lit: !it.off, off: it.off });
  const bar = [it.text, bar0].map(t => String(t || '').trim()).filter(Boolean).map(t => /[.!?:)]$/.test(t) ? t : t + '.').join(' '); // each part a whole sentence
  G.barText = bar;
  return frame({ left: left ?? psYou(r), right: pillar ?? psRight(r, right), view, ledge, bar });
}
// The right pillar off the duel: floor, relics, and the plaques a screen adds above DECK and RELICS.
function psRight(r, extra = '') {
  const fl = r.floor + 1, rel = relicList(r);
  const pips = Array.from({ length: 6 }, (_, i) => `<i class="pip${i < r.chamber ? ' on' : i === r.chamber ? ' at' : ''}" style="left:${8 + i * 11}px;top:20px"></i>`).join('') + `<i class="seal${r.seals >= 2 ? ' on' : ''}" style="left:76px;top:19px"></i>`;
  const belt = Array.from({ length: 9 }, (_, i) => { const id = rel[i]; return `<button class="sl" style="left:${8 + (i % 3) * 28}px;top:${54 + Math.floor(i / 3) * 28}px" data-a="tab:relics" aria-label="${id ? esc(RELICS[id].name) : 'Empty relic slot'}">${id ? medal(id, 24) : ''}</button>`; }).join('');
  return lb(8, 8, `FLOOR ${fl}`, 'g') + pips + lb(8, 40, 'RELICS', 'g') + (rel.length > 9 ? lbr(88, 40, '+' + (rel.length - 9)) : '') + belt
    + lb(8, 142, `CHARMS ${r.charms.length}/${db.config.charmSlots}`, 'g') + extra + pq(4, yb(200), 88, 'DECK', 'tab:deck') + pq(4, yb(220), 88, 'RELICS', 'tab:relics');
}
const kindWord = id => ({ C: 'CHARM', G: 'GIFT', M: 'MASTERWORK' })[RELICS[id].kind];
const plain = h => String(h).replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const cardItem = (e, a, extra = {}) => { const c = card(e.id), mon = db.isMonster(e.id); convertSheets(64);
  return { pic: (cx, h) => psCardL(e, cx - 34, Math.max(0, (h - 92) >> 1)), name: c.name, card: e.id, a, text: plain(pickNote(e.id, G.run).replace(/^<b>[^<]*<\/b>(<br>)?/, '')),
    facts: [mon ? esc(`${c.attr} · LEVEL ${c.level} · ${c.type}`.toUpperCase()) : esc(roleOf(db, e.id).toUpperCase()), `WEIGHT ${weightOf(db, e.id)}`], ...extra }; };
const relicItem = (id, a, extra = {}) => ({ pic: (cx, h) => `<i class="ab" style="left:${cx - 32}px;top:${Math.max(0, (h - 64) >> 1)}px">${medal(id, 64)}</i>`, name: RELICS[id].name, a, text: RELICS[id].text, facts: [kindWord(id)], ...extra });
function psReward() {
  const r = G.run, o = r.offer, key = `${r.floor}.${r.chamber}.${o.kind}.${JSON.stringify(o.options || o.kind)}`;
  const skip = pq(4, yb(180), 88, 'TAKE NOTHING', 'skip');
  if (o.kind === 'card') return psOffer({ title: 'PICK A CARD', key, room: 'room-vault', items: o.options.map((e, i) => cardItem(e, `pick:${i}`)), bar0: 'It goes to your trunk.', right: skip });
  if (o.kind === 'gift') {
    const held = new Set(relicList(r).map(id => RELICS[id].family).filter(f => BUILD_FAMILIES.includes(f)));
    const facts = id => [kindWord(id) + (o.fresh === id ? ' · NEW' : ''), RELICS[id].link && (held.has(RELICS[id].family) || held.has(RELICS[id].link)) ? esc(`LINKS ${FAMILY_NAME[RELICS[id].family]} TO ${FAMILY_NAME[RELICS[id].link]}`.toUpperCase()) : held.has(RELICS[id].family) ? esc(`FITS YOUR ${FAMILY_NAME[RELICS[id].family]} PIECES`.toUpperCase()) : ''].filter(Boolean);
    return psOffer({ title: 'FORGE LEVEL UP', key, room: 'room-vault', items: o.options.map((id, i) => relicItem(id, `pick:${i}`, { facts: facts(id), text: RELICS[id].text + plain(linkLine(id, r)).replace(/^Sets off/, ' Sets off') + (o.fresh === id ? ` You unlocked this with ${(featList(true).find(f => f.gift === id) || {}).name || 'a feat'}.` : '') })),
      bar0: 'A Gift lasts the whole run.', right: r.rerolls ? pq(4, yb(180), 88, `DEAL AGAIN ${r.rerolls}`, 'reroll') : '' });
  }
  if (o.kind === 'charm') return psOffer({ title: 'PICK A CHARM', key, room: 'room-vault', items: o.options.map((id, i) => relicItem(id, `pick:${i}`)), bar0: `Charm slots ${r.charms.length}/${db.config.charmSlots}.`, right: skip });
  if (o.kind === 'guardian') return psOffer({ title: 'GUARDIAN REWARD', key, room: 'room-guardian', bar0: 'The weight cap rises by 20.', items: o.options.map((g, i) => g.kind === 'card' ? cardItem(g.entry, `pick:${i}`, { text: g.text }) : g.kind === 'masterwork' ? relicItem(g.id, `pick:${i}`, { text: g.text + ' ' + RELICS[g.id].text }) : { name: g.ids.length + ' GIFTS', a: `pick:${i}`, text: g.text + ' ' + g.ids.map(id => RELICS[id].name + ': ' + RELICS[id].text).join(' '), facts: g.ids.map(id => esc(RELICS[id].name.toUpperCase())), pic: (cx, h) => `<i class="ab" style="left:${cx - g.ids.length * 17}px;top:${Math.max(0, (h - 32) >> 1)}px;display:flex;gap:2px">${g.ids.map(id => medal(id, 32)).join('')}</i>` }) });
  if (o.kind === 'treasure') return psOffer({ title: 'TREASURE', key, room: 'room-vault', kind: 'treasure', bar0: 'Take one. The rest stay in the vault.', items: o.options.map((g, i) => g.kind === 'card' ? cardItem(g.entry, `pick:${i}`) : relicItem(g.id, `pick:${i}`)) });
  if (o.kind === 'sanctum') { const full = r.sparks >= db.config.sparks, cap = weightCap(db, r), add = db.config.prices.sanctumCap;
    const big = (t, sub) => (cx, h) => `<b class="ab big2" style="left:0;width:${cx * 2}px;top:${Math.max(0, (h >> 1) - 14)}px">${t}</b><b class="ab lb d" style="left:0;width:${cx * 2}px;text-align:center;top:${Math.max(0, (h >> 1) + 12)}px">${sub}</b>`;
    return psOffer({ title: 'SANCTUM', key, room: 'room-sanctum', bar0: 'A quiet room and one candle. Take one blessing, then go on.', items: [
      { name: 'A SPARK BACK', a: 'pick:0', off: full, pic: big(full ? 'FULL' : String(r.sparks + 1), full ? 'SPARKS' : `SPARKS, NOW ${r.sparks}`), facts: [full ? 'YOUR SPARKS ARE FULL' : `SPARKS ${r.sparks} TO ${r.sparks + 1}`], text: full ? 'Your Sparks are full.' : `One Spark comes back to you: ${r.sparks} becomes ${r.sparks + 1}.` },
      { name: `CAP UP ${add}`, a: 'pick:1', pic: big(String(cap + add), `CAP, NOW ${cap}`), facts: [`CAP ${cap} TO ${cap + add}`, `YOUR DECK WEIGHS ${deckWeight(db, r.deck)}`], text: `Your weight cap rises from ${cap} to ${cap + add}. Your deck weighs ${deckWeight(db, r.deck)}.` }] }); }
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
  const ledge = works.slice(0, 9).map(([t, a, off], i) => pq(4 + (i % 3) * (cw + 4), 4 + Math.floor(i / 3) * 19, cw, t, a, { off, lit: !off && i === works.findIndex(w => !w[2]) })).join('');
  const bar = e ? `${card(e.id).name}${e.t ? ', tempered' : ''}${e.e ? ', enchanted' : ''}${e2 ? ' and ' + card(e2.id).name : ''}. ${works.filter(w => !w[2]).map(w => w[3]).join(' ') || 'Nothing here can be done to it with your Embers.'}` : `One working, then you move on. Tap a deck card (a second one for a Bind). ${works.map(w => w[3]).join(' ')}`;
  G.barText = bar;
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
  const view = (rp.src ? roomImg(rp) + rp.edge : '') + (rp.src ? modelCanvas(rp, [forgeSpot(rp)], false, 'forge') : `<canvas id="forge" class="ab" style="left:0;top:0;pointer-events:none" width="${vs.w}" height="${vs.h}" data-items='${JSON.stringify([forgeSpot(rp)])}'></canvas>`) + `<button class="ab" style="left:0;top:0;width:${vs.w}px;height:${vs.h}px;background:none;border:0" data-a="forgeskip" aria-label="Continue"></button>`;
  const what = fb.kind === 'masterwork' ? `<i class="ab" style="left:8px;top:16px">${medal(fb.mw, 32)}</i>` + lb(48, 20, shortName(RELICS[fb.mw].name).toUpperCase(), 'g') : fb.inst ? psCard(fb.inst, 8, 2) + lb(60, 8, fitName(card(fb.inst.id).name.toUpperCase(), 30), 'g') : '';
  return frame({ left: psYou(r), right: pq(4, yb(220), 88, 'CONTINUE', 'forgeskip', { lit: true }), view, ledge: what + lb(fb.kind === 'masterwork' ? 48 : 60, fb.kind === 'masterwork' ? 32 : 22, fb.word, 'd'), bar: esc(fb.text) });
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
    return frame({ left: psYou(r), right: roomRight(r), view: roomBack('room-bazaar') + deckGrid(r.deck, 'deckpick', G.pickDeck, null, true), ledge, bar });
  }
  const key = `bazaar.${r.floor}.${r.chamber}.${o.items.map(x => (x.id || (x.entry && x.entry.id) || x.kind) + (x.sold ? 's' : '')).join()}`;
  const items = o.items.map((it, i) => { const base = it.kind === 'card' ? (it.sealed ? { name: 'SEALED CARD', pic: (cx, h) => `<i class="cd back" style="left:${cx - 22}px;top:${Math.max(0, (h - 60) >> 1)}px"><i class="art"></i></i>`, facts: ['SEALED'], text: 'A card you see only once it is yours.' } : cardItem(it.entry, '')) : relicItem(it.id, '');
    const why = it.sold ? 'SOLD' : it.kind === 'charm' && slots ? 'CHARM SLOTS FULL' : r.embers < it.price ? 'NOT ENOUGH EMBERS' : '';
    return { ...base, a: `buy:${i}`, off: cantBuy(it), take: it.sold ? 'SOLD' : `BUY ${it.price}`, facts: [...(base.facts || []), `${it.price} EMBERS${why ? ' · ' + why : ''}`], text: base.text + (it.kind === 'gift' ? ' From outside this descent: it does not count toward your Gifts.' : '') }; });
  return psOffer({ title: 'BAZAAR', key, room: 'room-bazaar', items, right: pq(4, yb(180), 88, 'LEAVE', 'leave'), bar0: `You have ${r.embers} Embers.` });
}
function psOmen() {
  const r = G.run, o = r.offer;
  const item = o.seen ? cardItem(o.card, 'pick:0') : { name: 'UNSEEN CARD', a: 'pick:0', pic: (cx, h) => `<i class="cd back" style="left:${cx - 22}px;top:${Math.max(0, (h - 60) >> 1)}px"><i class="art"></i></i>`, facts: ['ONE STRONGER CARD, UNSEEN'], text: '' };
  return psOffer({ title: 'OMEN', key: 'omen', room: 'room-omen', items: [{ ...item, take: 'GIVE TWO', off: r.trunk.length < 2, facts: [...item.facts, `TRUNK CARDS: ${r.trunk.length}`], text: `${o.text} Your two weakest trunk cards are taken.` }],
    right: pq(4, yb(160), 88, 'PAY 30, SEE IT', 'pick:1', { off: o.seen || r.embers < 30 }) + pq(4, yb(180), 88, 'LEAVE', 'skip') });
}

// ---- the books: the run's end, the Codex, Feats, the Memory Vault
// One window over the title picture, its heading carved, its pages in a box that scrolls, its plaques along the foot.
function psBook(title, body, foot, extra = '') {
  const { W, H } = F, bgPic = CART.has('room-archive-book') ? 'room-archive-book' : 'key-title', bg = CART.has(bgPic) && D.cart && D.cart.title === 720 ? `<img class="bg" src="${cimg(bgPic)}" style="position:absolute;left:${(W - 720) >> 1}px;top:${(H - 480) >> 1}px" alt="">` : box(0, 0, W, H, 'st dk');
  return `<div class="ti">${bg}<i class="dim0"></i><div class="wn book" style="left:8px;top:6px;width:${W - 16}px;height:${H - 12}px"><div class="ab" style="left:0;top:4px;width:${W - 16}px;display:flex;justify-content:center">${carveImg(title, 16, render)}</div>
    <div class="ab sc" style="left:8px;top:26px;width:${W - 32}px;height:${H - 62}px">${body}</div><div class="ab" style="left:8px;top:${H - 32}px;width:${W - 32}px;height:16px">${foot}</div></div>${extra}</div>`;
}
const row = (pic, head, text, side = '') => `<div class="brow">${pic ? `<div class="bp">${pic}</div>` : ''}<div class="bt"><b class="lb g">${head}</b><p>${text}</p></div>${side ? `<div class="bs">${side}</div>` : ''}</div>`;
const inl = (label, a, o = {}) => `<button class="pq in${o.lit ? ' lit' : ''}" ${a ? `data-a="${esc(a)}"` : ''}${o.off ? ' disabled' : ''}>${esc(label)}</button>`; // a plaque that sits in a line
const meter = (n, goal, gain = 0) => `<i class="ga in" style="width:120px"><i style="width:${Math.round(118 * Math.min(1, n / goal))}px"></i>${gain ? `<u style="left:${Math.round(118 * Math.min(1, (n - gain) / goal))}px;width:${Math.round(118 * Math.min(1, gain / goal))}px"></u>` : ''}</i>`;
const featPs = f => row('', `${esc(f.name.toUpperCase())} <span class="d">${esc(f.build.toUpperCase())}</span>`, `${esc(f.text)}`, `${meter(f.after, f.goal, f.after - f.before)}<b class="lb">${f.done ? 'COMPLETE' : `${f.after} / ${f.goal}`}${f.gain && !f.done ? ` (+${f.gain})` : ''}</b>`);
function psOver() {
  const r = G.run, S = r.stats, R = G.results, won = r.result.won;
  const head = won ? 'THE PYRAMID IS CLEARED' : r.result.reason === 'abandoned' ? 'YOU LEFT THE PYRAMID' : 'THE RUN ENDS';
  const unl = R ? R.unlocks.filter(u => u.kind !== 'heat' || u.id <= heatTop()).map(u => u.kind === 'heat' && labs.heat ? { ...u, name: `Heat ${u.id}, ${HEAT_RULES[u.id - 1].name}`, text: HEAT_RULES[u.id - 1].text + ' It pays more Memories.' } : u)
    .map(u => u.kind === 'gift' ? row(medal(u.id, 32), `NEW GIFT: ${esc(u.name.toUpperCase())}`, `${esc(RELICS[u.id].text)} ${esc(u.why)} It will be in the first Gift offer of your next run.`) : row('', `${u.kind === 'record' ? 'NEW RECORD' : 'UNLOCKED'}: ${esc(String(u.name).toUpperCase())}`, esc(u.text))).join('') : '';
  const tally = `<p>Floor ${r.floor + 1}, chamber ${Math.min(6, r.chamber + 1)}. ${esc(r.forger ? FORGERS[r.forger].name : 'No Forger')}. Duels won ${S.wins} of ${S.duels}. Guardians beaten ${S.bossWins}. Melds ${S.melds}.${Object.keys(S.ranks).length ? ' Ranks ' + Object.entries(S.ranks).map(([k, v]) => k + ' x' + v).join(', ') + '.' : ''}</p>`;
  const mem = R ? `<p>${R.lines.map(l => `${esc(l[0])} +${l[1]}`).join('. ')}.</p><p><b class="lb g">+${R.total} MEMORIES</b></p>` : '<p class="d">Already banked.</p>';
  const feats = R && R.feats.length ? `<p><b class="lb g">FEATS</b></p>${R.feats.map(featPs).join('')}<p class="d">Feats count across runs, win or lose.</p>` : '';
  return psBook(head, unl + tally + mem + feats, inl('NEW RUN', 'new', { lit: true }) + inl('CODEX', 'screen:codex') + inl('FEATS', 'screen:feats') + inl(`VAULT ${P.memories}`, 'screen:vault') + inl('TITLE', 'home'));
}
function psFeats() {
  const rows = featList(!!labs.long).map(f => { const done = (P.featsDone || []).includes(f.id), n = done ? f.goal : (P.feats || {})[f.id] || 0;
    return featPs({ ...f, before: n, after: n, gain: 0, done }) + row(medal(f.gift, 32), `${esc(RELICS[f.gift].name.toUpperCase())} <span class="d">${done ? 'UNLOCKED GIFT' : 'GIFT, LOCKED'}</span>`, esc(RELICS[f.gift].text)); }).join('');
  const forg = FORGER_IDS.concat(HIDDEN_FORGERS.filter(id => P.forgers.includes(id))).filter(id => id !== 'tarn').map(id => row('', `${esc(FORGERS[id].name.toUpperCase())} <span class="d">${P.forgers.includes(id) ? 'UNLOCKED' : 'LOCKED'}</span>`, esc(FORGER_FEATS[id].text))).join('');
  return psBook('FEATS', `<p>Each feat follows a way of playing and adds one Gift to what the forge can offer. Progress counts across runs, win or lose.</p>${rows}<p><b class="lb g">FORGERS</b></p>${forg}${labs.long ? `<p><b class="lb g">STARTER KITS</b></p>${plainKits()}` : ''}`, inl('BACK', 'home', { lit: true }));
}
const plainKits = () => FORGER_IDS.concat(HIDDEN_FORGERS).filter(id => P.forgers.includes(id)).map(id => FORGERS[id].kits.map((k, i) => { if (!i) return ''; const w = forgerStats(P, id).wins, g = KIT_GOALS[i], n = Math.min(w, g); return row('', `${esc(k.name.toUpperCase())} <span class="d">${esc(FORGERS[id].name.toUpperCase())}</span>`, `Win ${g} duels as ${esc(FORGERS[id].name)}.`, `${meter(n, g)}<b class="lb">${w >= g ? 'OPEN' : n + ' / ' + g}</b>`); }).join('')).join('');
function psVault() {
  const tiles = VAULT.map(v => { const own = P.bought.includes(v.id), rr = RELICS[v.id]; return row(medal(v.id, 32), `${esc(rr.name.toUpperCase())} <span class="d">${rr.kind === 'M' ? 'MASTERWORK' : 'CHARM'}</span>`, esc(rr.text), inl(own ? 'OWNED' : `${v.price} MEMORIES`, `vbuy:${v.id}`, { off: own || P.memories < v.price, lit: !own && P.memories >= v.price })); }).join('');
  const ench = labs.long ? `<p><b class="lb g">ENCHANTS</b></p><p class="d">An Anvil offers three Enchants from the ones you hold. Six are yours from the start: ${START6}.</p>${VAULT_ENCHANTS.map(v => { const own = P.bought.includes(v.key); return row('', esc(v.id.toUpperCase()), esc(ENCHANT_TEXT[v.id]), inl(own ? 'OWNED' : `${v.price} MEMORIES`, `vbuy:${v.key}`, { off: own || P.memories < v.price })); }).join('')}` : '';
  return psBook(`MEMORY VAULT  ${P.memories}`, `<p>Spend Memories to widen what a run can offer. Nothing here makes you stronger at the start.</p>${tiles}${ench}`, inl('BACK', 'home', { lit: true }));
}
function psCodex() {
  const X = codexIndex(), found = codexFound(), v = G.cx; convertSheets(40);
  let list = X.list.filter(R => (v.view === 'all' || found.has(R.id)) && (!v.type || card(R.id).type === v.type));
  const total = list.length; list = list.slice(0, 120);
  const byType = t => X.list.filter(R => card(R.id).type === t);
  const tiles = list.map(R => found.has(R.id) ? psCard({ id: R.id }, null, null, { attrs: `data-a="cxopen:${R.id}"`, badge: found.get(R.id).length }) : `<button class="cd unk" style="position:relative" data-a="cxopen:${R.id}" aria-label="Not found yet"><i class="n1">?</i></button>`).join('');
  const filt = inl('FOUND', 'cxview:found', { lit: v.view === 'found' }) + inl('ALL', 'cxview:all', { lit: v.view === 'all' }) + X.types.map(t => inl(`${t} ${byType(t).filter(R => found.has(R.id)).length}/${byType(t).length}`, `cxtype:${t}`, { lit: v.type === t })).join('');
  const heard = BOSSES.flat().filter(b => P.seen.includes('memory:' + b.id));
  const rum = rumours() ? `<p><b class="lb g">RUMOURS · ${heard.length} OF ${BOSSES.flat().length} MEMORIES HEARD</b></p>${heard.map(b => `<p><b class="lb">${esc(b.name.toUpperCase())}</b> ${esc(SCENES['memory:' + b.id].lines[0])}</p>`).join('') || '<p class="d">Nothing yet. A guardian remembers something as it falls.</p>'}` : '';
  const body = `<p>${found.size} of ${X.list.length} results found, ${G.known.size} recipes written. A page you have found shows why the meld works, so you can make it again from other cards.</p>${rum}<div class="row2" style="margin:4px 0">${filt}</div><div class="row2">${tiles || '<p class="d">Nothing here yet. Meld two monsters in a duel to write the first page.</p>'}</div>${total > 120 ? `<p class="d">Showing 120 of ${total}. Pick a Type to narrow it.</p>` : ''}<p><b class="lb g">RECORD</b></p><p>Runs ${P.runs}. Clears ${P.clears}. Duels won ${P.duelWins}. Guardians beaten ${P.bossWins}. Memories earned ${P.earned}.</p>`;
  let page = '';
  if (G.cx.open != null) { const R = X.res.get(G.cx.open); if (R) { const c = card(R.id), recs = found.get(R.id) || [], known = recs.length > 0; if (known) convertSheets(96);
    const hint = R.kind === 'printed' ? `A printed fusion of ${R.mats.map(m => 'a ' + card(m).type).join(' and ')}.` : `A ${c.attr} ${c.type}. Some ${c.type} melded with some ${c.attr} monster makes it. Which ones is for you to find.`;
    page = `<div class="dim" data-a="cxclose"></div><div class="wn mw" data-a="cxclose" style="left:${72 + cx0()}px;top:${16 + cy0()}px;width:368px;height:208px">${known ? `<div class="big" style="left:8px;top:8px"><i class="art" style="${cpic(R.id, 96)}"></i><b class="n1">${c.atk} / ${c.def}</b><b class="n2">${esc(`${c.attr} · LV ${c.level}`)}</b></div>` : '<div class="big unk" style="left:8px;top:8px"><b class="n1">?</b></div>'}
      <div class="ab sc" style="left:122px;top:8px;width:238px;height:170px"><h2>${known ? esc(c.name) : 'Not found yet'}</h2><p>${known ? esc(`${c.type}. ${whyLine(R)}`) : esc(hint)}</p>${known ? `<p class="d">Recipes you have found (${recs.length}):</p>${recs.slice(0, 8).map(ids => `<p>${ids.map(x => esc(card(x).name)).join(' + ')}</p>`).join('')}${recs.length > 8 ? `<p class="d">and ${recs.length - 8} more</p>` : ''}` : ''}</div>${lb(250, 190, 'TAP TO CLOSE', 'd')}</div>`; } }
  return psBook('CODEX', body, inl('BACK', 'home', { lit: true }), page);
}

// ---- choosing a Forger, before a descent
function psForger() {
  const ids = FORGER_IDS.concat(P.forgers.includes('last') || labs.secret ? ['last'] : []), heatMax = heatOpen(), h = G.pickHeat, hr = labs.heat ? HEAT_RULES.filter(x => x.n <= h) : [];
  const vs = viewSize(), sw = Math.min(104, Math.floor((vs.w - 8) / ids.length)), fs = sw - 4 >= 68 ? 64 : 48;
  const items = ids.map(id => { const f = FORGERS[id], own = P.forgers.includes(id), fc = faceName(id) + (fs === 48 ? '-48' : '');
    return { name: own ? shortName(f.name) : id === 'last' && !own ? 'HIDDEN' : shortName(f.name), a: 'descend', take: 'DESCEND', off: !own,
      pic: (cx, hh) => CART.has(fc) ? `<i class="ab pf${fs === 48 ? ' s48' : ''}${own ? '' : ' pflk'}" style="left:${cx - fs / 2 - 2}px;top:${Math.max(0, (hh - fs) >> 1) - 2}px"><img src="${cimg(fc)}" width="${fs}" height="${fs}" alt=""></i>` : `<i class="ab pf none${fs === 48 ? ' s48' : ''}" style="left:${cx - fs / 2 - 2}px;top:${Math.max(0, (hh - fs) >> 1) - 2}px"></i>`,
      facts: own ? [esc(f.tag.toUpperCase()), esc(`POWER: ${f.power}`.toUpperCase())] : ['LOCKED'],
      text: own ? `${ruleText(f.rule)} ${f.power}: ${f.powerText}` + (labs.long ? ' ' + plain(roadLine(id)) : '') : id === 'last' && !P.forgers.includes('last') ? 'Nobody says how. The guardians remember things as they fall, and the Codex keeps what they say.' : `To unlock: ${FORGER_FEATS[id].text}` }; });
  const sel = Math.max(0, ids.indexOf(G.pickForger)), pick = ids[sel], F0 = FORGERS[pick];
  const left = psPort(P.forgers.includes(pick) ? faceName(pick) : '', 14, 6, !P.forgers.includes(pick)) + lb(8, 79, shortName(F0.name), 'g') + lb(8, 92, F0.tag.toUpperCase().slice(0, 14), 'd') + pq(4, yb(220), 88, 'BACK', 'home');
  const right = lb(8, 8, 'HEAT', 'g') + `<b class="ab big2" style="left:8px;top:20px;width:80px;text-align:center">${h}</b>`
    + pq(4, 40, 42, '<', `heat:${Math.max(0, h - 1)}`, { off: h <= 0 }) + pq(50, 40, 42, '>', `heat:${Math.min(heatMax, h + 1)}`, { off: h >= heatMax })
    + (hr.length ? lb(8, 62, hr[hr.length - 1].name.toUpperCase().slice(0, 14), 'd') + pq(4, 74, 88, 'HEAT RULES', `heatinfo:${h}`) : heatMax ? '' : lb(8, 62, 'CLEAR TO OPEN', 'd'))
    + pq(4, yb(200), 88, 'HOW TO PLAY', 'tab:help') + pq(4, yb(220), 88, 'OPTIONS', 'tab:options');
  const bar0 = h ? `Heat ${h}: Memories +${h * 20}%.` + (hr.length ? ` ${hr[hr.length - 1].name}: ${hr[hr.length - 1].text}` : ' Rivals are stronger.') : '';
  return psOffer({ title: 'CHOOSE YOUR FORGER', items, key: 'forger', room: 'room-forgers', sel, selA: i => `forger:${ids[i]}`, left, pillar: right, bar0 });
}
function psKit() {
  const r = G.run, key = 'kit.' + r.offer.map(k => k.kit + k.deck.length).join();
  return psOffer({ title: 'PICK A STARTER KIT', key, room: 'room-forgers', bar0: r.builds ? `This descent carries ${r.builds.map(f => FAMILY_NAME[f]).join(' and ')} Gifts.` : '', right: r.redeal ? pq(4, yb(180), 88, 'DEAL AGAIN', 'redeal') : '',
    items: r.offer.map((k, i) => { const best = k.deck.slice().sort((a, b) => cardValue(db, b) - cardValue(db, a))[0]; convertSheets(64);
      return { name: k.name, a: `kit:${i}`, take: 'TAKE KIT', card: best.id, pic: (cx, h) => psCardL(best, cx - 34, Math.max(0, (h - 92) >> 1)), facts: [`${k.deck.length} CARDS · WEIGHT ${deckWeight(db, k.deck)}`, esc(`BEST: ${card(best.id).name}`.toUpperCase())], text: plain(summary(k.deck)) }; }) });
}
function psCharm() {
  const r = G.run, key = 'charm.' + r.offer.options.join();
  return psOffer({ title: 'PICK ONE CHARM', key, room: 'room-forgers', bar0: 'A charm changes a rule for the whole run.', items: r.offer.options.map((id, i) => relicItem(id, `pick:${i}`)) });
}

// ---- windows over a console screen
// The story paintings: the opening scene has one for each of its three lines; a guardian's memory and beating The Last One
// use theirs once they are in the art folder. A scene with a painting shows it above the words in place of the portrait.
const STORY_PIC = { intro: ['story-city', 'story-vessa', 'story-oren'], cleared: 'story-forge', fell: 'story-lamp', left: 'story-lamp', 'secret:won': 'story-last' };
const storyPic = (id, i) => { const p = STORY_PIC[id] || (id.startsWith('memory:') ? 'story-memory-' + id.slice(7).replace(/_/g, '-') : null), n = Array.isArray(p) ? p[Math.min(i, p.length - 1)] : p; return n && CART.has(n) ? n : null; };
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
    if (o.kind === 'duelEnd') { const s = o.sum; return win(136, 16, 240, 208, `<div style="display:flex;justify-content:center;margin:2px 0 6px">${carveImg(s.won ? 'VICTORY' : 'DEFEAT', 24, render)}</div><p>${esc(o.rival ? o.rival.name : '')}, ${s.turns} turns${s.reason === 'deckout' ? ', a deck ran out' : ''}.</p>${s.won ? `<p><b class="lb g">RANK ${esc(s.rank.rank)} · ${s.rank.points} POINTS · ${s.rank.style === 'craft' ? 'CRAFT' : 'FURY'}</b></p><p>Embers +${s.embers}${s.bountyMet ? '. Bounty met.' : '.'}</p>` : `<p>You lose a Spark. ${G.run.sparks} left.</p>${(o.why || []).slice(0, 2).map(l => `<p class="d">${esc(l)}</p>`).join('')}`}${pq(76, 184, 88, 'CONTINUE', 'closeov', { lit: true })}`); }
    if (o.kind === 'leave') { const run = o.saved || G.run, w = worth(run), S = run.stats;
      return win(96, 24, 320, 192, `<h2>${o.saved ? 'You have a run in progress' : 'Leave the pyramid?'}</h2><p>${o.saved ? `${esc(run.forger ? FORGERS[run.forger].name : 'No Forger')}, Floor ${run.floor + 1}, Chamber ${Math.min(6, run.chamber + 1)}. Starting a new run ends that one.` : 'Leaving ends this run as a loss.'}</p><p>You keep ${w.total} Memories, ${S.wins} duel${S.wins === 1 ? '' : 's'} won and your feat progress.</p>${o.saved ? pq(8, 166, 96, 'CONTINUE IT', 'resume', { lit: true }) + pq(110, 166, 96, 'BANK IT, NEW', 'bankold') + pq(212, 166, 96, 'BACK', 'closeov') : pq(8, 166, 140, 'KEEP PLAYING', 'closeov', { lit: true }) + pq(160, 166, 148, 'LEAVE AND BANK IT', 'abandon')}`); }
    if (o.kind === 'heat') return win(96, 8, 320, 224, `<h2>Heat ${o.n}</h2><div class="sc" style="height:176px">${HEAT_RULES.filter(x => x.n <= o.n).map(x => `<p><b class="lb g">${x.n}. ${esc(x.name)}</b><br>${esc(x.text)}</p>`).join('')}</div>${pq(220, 196, 88, 'CLOSE', 'closeov', { lit: true })}`);
    if (o.kind === 'moved') return win(96, 40, 320, 160, `<h2>This run moved on</h2><p>The run was ended or carried on in another tab or window. Nothing was changed from here.</p>${pq(160, 130, 148, 'BACK TO THE START', 'leavetab', { lit: true })}`);
  }
  if (G.inspect) { const c = card(G.inspect.id), mon = db.isMonster(c.id); convertSheets(96);
    return `<div class="dim" data-a="closeinspect"></div><div class="wn mw" data-a="closeinspect" style="left:${72 + cx0()}px;top:${16 + cy0()}px;width:368px;height:208px"><div class="big" style="left:8px;top:8px"><i class="art" style="${cpic(c.id, 96)}"></i>${mon ? `<b class="n1">${G.inspect.ea ?? c.atk} / ${G.inspect.ed ?? c.def}</b>` : ''}<b class="n2">${mon ? esc(`${c.attr} · LV ${c.level}`) : esc(roleOf(db, c.id).toUpperCase())}</b></div>
      <div class="ab sc" style="left:122px;top:8px;width:238px;height:170px"><h2>${esc(c.name)}</h2>${mon ? `<p class="d">${esc(c.type)}. Printed ${c.atk} / ${c.def}.</p>` : ''}<p>${esc(rulesText(c.id))}</p>${G.inspect.e ? `<p>${CART.has('enchant-' + G.inspect.e + '-32') ? `<img src="${cimg('enchant-' + G.inspect.e + '-32')}" width="32" height="32" alt="" style="float:left;margin:0 4px 0 0">` : ''}<b class="lb g">ENCHANT ${esc(G.inspect.e.toUpperCase())}</b><br>${esc(ENCHANT_TEXT[G.inspect.e])}</p>` : ''}<p class="d">Weight ${weightOf(db, c.id)}.</p></div>${lb(250, 190, 'TAP TO CLOSE', 'd')}</div>`; }
  const t = G.tab; if (!t) return '';
  if (t === 'bar') return win(56, 40, 400, 160, `<div class="sc" style="height:120px"><p>${G.barText || ''}</p></div>${pq(304, 132, 88, 'CLOSE', 'tab:', { lit: true })}`);
  const close = (y = 200) => pq(304, y, 88, 'CLOSE', 'tab:', { lit: true });
  if (t === 'menu') { const duel = r && (r.phase === 'duel' || G.shown); const items = [['DECK', 'tab:deck'], ['RELICS', 'tab:relics'], duel && ['THIS DUEL', 'tab:duel'], duel && [G.fast ? 'SPEED: FAST' : 'SPEED: NORMAL', 'speed'], !duel && r && ['DOORS IN FULL', 'tab:doors'], ['HOW TO PLAY', 'tab:help'], ['OPTIONS', 'tab:options'], r && ['LEAVE THE RUN', 'quit']].filter(Boolean);
    return win(176, 16, 160, 28 + items.length * 20 + 24, `<h2>Menu</h2>${items.map(([l, a], i) => pq(8, 22 + i * 20, 144, l, a)).join('')}${pq(8, 26 + items.length * 20, 144, 'CLOSE', 'tab:', { lit: true })}`); }
  if (t === 'help') return win(16, 8, 480, 224, `<h2>How a duel works</h2><div class="sc" style="height:180px"><p>Each turn: draw toward five cards (two a turn at most), play one card or one meld, then attack.</p><p>Meld: tap two or more hand cards in order. They combine left to right into one monster. Tap one of your table monsters first to meld onto it.</p><p>Monsters fight with their printed ATK and DEF. Effects printed on a card are not used in Lost Memories.</p><p>Attack position fights with ATK. Defense uses DEF and protects your Life Points. Veiled is face down in defense.</p><p>WATER beats FIRE beats WIND beats EARTH beats WATER. LIGHT and DARK beat each other when attacking. The edge is +500 for that battle.</p><p>Field Spells set the terrain (+500 for its Types). ${db.config.equipKinds ? 'Equips made for a Type or Attribute give +800 to that kind and +300 to any other.' : 'Equips give +500.'} Traps wait face down for an attack. Other cards are fuel: +300 in a meld.</p><p>Play comes before attacks. A monster that attacked or just arrived cannot change position.</p><p>Lose a duel and you lose a Spark. The guardian's door needs two seals, one from each duel you win on the floor.</p></div>${pq(8, 196, 160, 'SHOW FIRST LESSONS', 'relearn')}${pq(384, 196, 88, 'CLOSE', 'tab:', { lit: true })}`);
  if (t === 'sound') return win(96, 24, 320, 192, `<h2>Sound</h2><div id="soundslot" class="soundslot sc" style="height:140px"></div>${close(164 - 0)}`);
  if (t === 'options') return win(16, 8, 480, 224, `<h2>Options</h2><div class="sc" style="height:180px"><div id="soundslot" class="soundslot"></div><p><b class="lb g">LOOK</b></p><button class="lab" data-a="look"><i>NEW</i><span>The console look. Tap for the old look, to compare.</span></button><p><b class="lb g">LAB SWITCHES</b> <small class="d">EXPERIMENTS. A RUN IN PROGRESS KEEPS THE RULES IT STARTED WITH.</small></p>${labKeys().map(k => { const held = pref.depth && DEPTH_SET.includes(k); return `<button class="lab ${pref[k] || held ? 'on' : ''}" data-a="lab:${k}"><i>${pref[k] || held ? 'ON' : 'OFF'}</i><span>${esc(LABS[k])}${held && !pref[k] ? ' (On through the depth set.)' : ''}</span></button>`; }).join('')}</div>${pq(384, 196, 88, 'CLOSE', 'tab:', { lit: true })}`);
  if (!r) return '';
  if (t === 'relics') return win(16, 8, 480, 224, `<h2>Your relics</h2><div class="sc" style="height:180px">${relicList(r).map(id => `<div class="rl">${CART.has(relicFile(id)) ? `<img src="${cimg(relicFile(id))}" alt="">` : `<i class="gem">${esc(RELICS[id].name.replace(/^The /, '')[0])}</i>`}<div><b>${esc(RELICS[id].name)}</b>${esc(RELICS[id].text)}</div></div>`).join('') || '<p>None yet.</p>'}${possibleMasterworks(r).map(id => `<p class="d">Masterwork ready at an Anvil: ${esc(RELICS[id].name)}.</p>`).join('')}</div>${pq(384, 196, 88, 'CLOSE', 'tab:', { lit: true })}`);
  if (t === 'doors' && r.doors) return win(16, 8, 480, 224, `<h2>The doors</h2><div class="sc" style="height:180px">${r.doors.map((d, i) => `<p><b class="lb g">${i + 1}. ${esc(doorName(d))}</b> <small class="d">${d.know === 'known' ? 'KNOWN' : d.know === 'partial' ? 'PARTLY HIDDEN' : 'IN FOG'}</small><br>Cost: ${esc(stop(d.cost))} Reward: ${esc(stop(d.reward))}${d.law ? ' Law: ' + esc(lawShown(d.law)) : ''}${d.tell ? ` ${esc(d.style)}: ${esc(d.tell)}` : ''}${(d.tags || []).length ? ' ' + esc(d.tags.join(', ')) + '.' : ''}</p>`).join('')}</div>${pq(384, 196, 88, 'CLOSE', 'tab:', { lit: true })}`);
  if (t === 'duel') { const rv = G.shown ? G.shown.rival : info(r), v = r.duel ? viewFor(r.duel, db, 0) : null;
    return win(16, 8, 480, 224, `<h2>This duel</h2><div class="sc" style="height:180px">${rv.styleText ? `<p>${esc(rv.styleText)}</p>` : ''}${rv.lawText ? `<p><b class="lb g">LAW</b> ${esc(lawShown(rv.lawText))}</p>` : ''}${rv.twist ? `<p>${{ fog: 'Fog: monsters arrive veiled.', narrow: 'Narrow Pass: three zones.', storm: 'Storm Front: terrain shifts every third turn.', locked: 'Locked terrain.' }[rv.twist]}</p>` : ''}<p><b class="lb g">BOUNTY</b> ${esc(rv.bountyText || '')}</p>${v && v.forger ? `<p><b class="lb g">${esc(FORGERS[v.forger].name)}</b> ${esc(ruleText(FORGERS[v.forger].rule))}</p><p><b class="lb g">${esc(FORGERS[v.forger].power)}</b> ${v.rs.power ? 'Used this duel.' : esc(FORGERS[v.forger].powerText)}</p>` : ''}<p><b class="lb g">LOG</b><br>${G.log.slice(-8).map(esc).join('<br>')}</p></div>${pq(384, 196, 88, 'CLOSE', 'tab:', { lit: true })}`); }
  if (t === 'deck') { const list = (l, key, picked, k2) => l.map((e, i) => [e, i]).sort((a, b) => cardValue(db, b[0]) - cardValue(db, a[0])).map(([e, i]) => psCard(e, null, null, { cls: picked === i ? 'sel' : '', attrs: `data-a="${key}:${i}"` })).join('');
    return win(8, 4, 496, 232, `<h2>Deck ${r.deck.length} · weight ${deckWeight(db, r.deck)}/${weightCap(db, r)}</h2><p class="d">${r.phase === 'chamber' ? 'Tap a deck card, then a trunk card, to swap them.' : 'You can swap cards in a chamber.'}</p><div class="sc" style="height:168px"><div class="row2">${list(r.deck, 'deckpick', G.pickDeck)}</div><h3 style="margin-top:6px">Trunk ${r.trunk.length}</h3><div class="row2">${list(r.trunk, 'trunkpick', G.pickTrunk) || '<span class="d">Empty.</span>'}</div></div>${pq(400, 208, 88, 'CLOSE', 'tab:', { lit: true })}`); }
  return '';
}
// Which screens are drawn the console way. Everything else keeps the old look for now.
function psScreen() {
  if (look === 'old' || lostStore) return null;
  const r = G.run;
  if (G.screen === 'forger') return psForger;
  if (G.screen) return { codex: psCodex, feats: psFeats, vault: psVault }[G.screen] || null;
  if (!r) return psHome;
  if (G.forge) return psForge; // the hammer is still falling on the last working
  if (G.shown || r.phase === 'duel') return psDuel;
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
  app.classList.add('ps'); app.classList.remove('phone', 'era'); document.body.classList.add('ps'); fitConsole(app); setMats(); // the frame's size first: the screen is laid out for it
  const r = G.run;
  app.innerHTML = `${screen()}${psWindows()}${store.failed.size ? `<div class="savebar"><b>NOT SAVED.</b> This device would not store your progress. <button class="pq" style="position:relative;display:inline-block" data-a="resave">TRY AGAIN</button></div>` : ''}<div id="toast" class="toast">${esc(G.toast)}</div>`;
  app.dataset.phase = r ? (G.shown ? 'duel' : r.phase) : 'home'; app.dataset.room = '';
  // While words are told over a screen, the screen holds still; under a painting it goes dark, so nothing of it shows round it.
  const st = app.querySelector('.story'); app.classList.toggle('stup', !!st); app.classList.toggle('stblk', !!(st && st.classList.contains('sblk')));
  // Every endless loop (a cursor's bob, a lit plaque, the fog) keeps time with the clock, not with the drawing: a screen
  // drawn again, as when the cursor moves, carries each loop on from where it was instead of starting it over.
  for (const a of app.getAnimations({ subtree: true })) if (a.playState === 'running' && a.effect && a.effect.getTiming().iterations === Infinity) a.startTime = 0;
  if (document.getElementById('prop')) { propTextures(); propPaint(); }
  if (document.getElementById('forge')) { propTextures(); convertSheets(40); forgePaint(); }
  if (document.getElementById('coin')) coinLoop();
  if (document.getElementById('tbl')) { psTextures(); convertSheets(40); psPaint(); }
  else convertSheets(40);
  { const slot = $('#soundslot'); if (slot && window.LMAudio && window.LMAudio.panel) { try { slot.appendChild(window.LMAudio.panel()); } catch (e) { slot.textContent = 'Sound is not available in this browser.'; } } }
  barFits();
  if (!drawConsole.fonts && document.fonts) { drawConsole.fonts = 1; document.fonts.ready.then(barFits); } // the text face may arrive after the first drawing
  fit();
}
// The text bar holds two lines. When what it says is longer, a marker shows and a tap opens the whole of it.
function barFits() {
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
function tapped(ev) {
  const el = ev.target.closest('[data-a]'); if (!el || el.disabled || G.opening) return; // nothing is taken while a door swings open
  G.toast = ''; // a tap puts away the last message, so it cannot lie over the screen the tap opens
  syncP();
  const [verb, x, y] = el.dataset.a.split(':'); const r = G.run, n = x === undefined || x === '' ? null : +x;
  cue('ui:' + verb, { x, y }, el);
  const duel = a => act({ t: 'duel', action: a });
  switch (verb) {
    case 'new': { const s = !r || r.phase === 'over' ? liveSave() : null; if (s) { G.overlay = { kind: 'leave', saved: nameRun(s), at: storedAt() }; render(); break; } }
      // falls through to the Forger screen when no run is waiting
      G.overlay = null; G.screen = 'forger'; if (!P.forgers.includes(G.pickForger)) G.pickForger = 'tarn'; G.pickHeat = Math.min(G.pickHeat, heatOpen()); render(); break;
    case 'loadagain': location.reload(); break;
    case 'startempty': lostStore = false; try { sessionStorage.removeItem(HAD); } catch { /* nothing to forget */ } render(); break;
    case 'leavetab': Object.assign(G, { run: null, overlay: null, screen: null, shown: null, frames: [], results: null, banked: false, story: null }); setLabs(pref); render(); break;
    case 'home': G.screen = null; if (r && r.phase === 'over') { G.run = null; G.results = null; G.banked = false; setLabs(pref); } render(); break;
    case 'screen': G.screen = x; render(); break;
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
      G.banked = false; setLabs(pref); store.set(RUNLABS, pref); G.screen = null; G.results = null; G.run = newRun(db, { seed: (Date.now() % 2147483647) + Math.floor(Math.random() * 1e6), heat: G.pickHeat, forger: G.pickForger, ...runOptions(P, G.pickForger, !!labs.long), uid: Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36) }); G.log = []; G.overlay = null; G.rev = 0; G.at = storedAt(); writeRun(G.run); queueStory('intro'); render(); break;
    case 'vbuy': try { const b = buy(P, y ? x + ':' + y : x); saveP(); toast(b.name + (y ? ' can now be offered at an Anvil.' : ' can now appear in your runs.')); } catch (e) { toast(e.message); } render(); break;
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
    case 'door': { G.log = []; const d = r.doors[n]; const go = () => act({ t: 'door', i: n });
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
    case 'closeov': G.overlay = null; render(); break;
    case 'heatinfo': G.overlay = { kind: 'heat', n }; render(); break;
    case 'speed': G.fast = !G.fast; render(); break;
    // duel
    case 'hand': { if (G.playing || !r.duel || r.duel.active !== 0 || r.duel.pending) break; if (r.duel.played || r.duel.attacked) { G.inspect = r.duel.hand[0][n]; render(); break; } G.attacker = null; G.aim = null; const k = G.sel.indexOf(n); if (k >= 0) G.sel.splice(k, 1); else G.sel.push(n); render(); break; }
    case 'mine': { if (G.sel.length) { toast('Finish or undo your card pick first.'); break; } if (G.attacker === n) { G.attacker = null; G.onto = n; } else if (G.onto === n) { G.onto = null; if (r.duel) G.inspect = viewFor(r.duel, db, 0).mon[0][n]; } else { G.attacker = n; G.onto = null; } render(); break; }
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
window.LM = { G, P, db, act, render, labKeys, labWords: () => Object.keys(LABS), unsaved: () => [...store.failed.keys()] }; // for tests
if (PACK && look !== 'old') bootWait().then(warmOld); else { warmOld(); render(); loadPack(); }
