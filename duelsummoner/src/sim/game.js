// The rules of a run. No drawing, no DOM: the view reads this state, tests and the run simulator drive it directly.
import { CFG } from '../data/config.js';
import { RUN } from '../data/waves.js';
import { SpatialGrid } from '../core/grid.js';
import { makeStreams } from './rng.js';
import { hashHex } from './hash.js';
import { CLASSIC_MAP } from '../data/maps.js';
import { loadMap, mapKey } from './terrain.js';
import { makeCaps, refillCaps } from './caps.js';
import { K } from '../data/tuning.js';
import { SCORE } from '../data/tuning.js';
import { OATH_BY_ID } from '../data/progress.js';
import { initRun, updateStages, descentTick, finalChoice, xpScale } from './stages.js';
import { quantise, decode, emptyRecord, MENU_TAKE, MENU_REDRAW, MENU_PASS, MENU_LEAVE, MENU_BANISH } from './input.js';
import { Flow } from './flow.js';
import { makePlayer, updatePlayer } from './player.js';
import { makeEnemies, updateEnemies, spawnEnemy, spawnRate, enemyCount } from './enemies.js';
import { makeShots, makePickups, makeBolts, updateShots, updateBolts, updatePickups } from './weapons.js';
import { makeTele, makeFx, tickPool, addFx, explode, damageEnemy } from './combat.js';
import { updateSpecials, damageSpecial, startBoss } from './specials.js';
import { updateSpawner } from './spawner.js';
import { updateMonsters, updateTraps, onPlayerHurt } from './monsters.js';
import { makeField, recompute, xpNeeded, openLevelOffer, openChest, chooseCard, redraw, banish, pass, leaveChest, fusionsReady } from './field.js';
import { MAP } from '../data/map.js';
import { buildWorld, emptyWorld, updateWorld, nearestProp, useProp } from './world.js';
import { SPELLS } from '../data/cards.js';
import { runResults } from './results.js';

const STEP = 1 / 60;

import { BUILD_VERSION } from './results.js';
const BUILD_VERSION_REPLAY = BUILD_VERSION;
export class Game {
  constructor(seed = 1, opts = {}) {
    this.opts = opts;
    this.en = makeEnemies(CFG.enemy.max);
    this.shots = makeShots(CFG.card.max + 64);
    this.pick = makePickups(CFG.xp.max);
    this.grid = new SpatialGrid(2, MAP.half, CFG.enemy.max);
    this.flow = new Flow();
    this.nearBuf = new Int32Array(CFG.enemy.max);
    this.nearBuf2 = new Int32Array(64);
    this.tele = makeTele(64); this.fx = makeFx(48); this.eb = makeBolts(48);
    this.btraps = []; for (let i = 0; i < 8; i++) this.btraps.push({ on: false, x: 0, y: 0, z: 0, life: 0 });
    this.evType = new Array(256).fill(''); this.evData = new Array(256).fill(null); this.evA = new Float64Array(256); this.evB = new Float64Array(256); this.evC = new Float64Array(256); this.evT = new Float64Array(256); this.evHead = 0; this.evTail = 0;
    this._cmd = {}; this._rec = emptyRecord(); this.tape = null; this.map = CLASSIC_MAP;
    this.reset(seed, opts.duelist);
  }

  reset(seed = this.seed, duelist) {
    this.seed = seed; this.streams = makeStreams(seed); this.rsp = () => this.streams.spawn.next(); this.rl = () => this.streams.loot.next(); this.rc = () => this.streams.combat.next(); this.rcos = () => this.streams.cosmetic.next(); this.duelist = duelist || this.duelist || 'kael';
    this.oathList = (this.opts.oaths || []).filter(id => OATH_BY_ID[id]); this.oaths = {}; for (const id of this.oathList) this.oaths[id] = true;      // Oaths: run rules sworn before the run
    this.t = 0; this.kills = 0; this.xp = 0; this.level = 1; this.xpCur = 0; this.xpNeed = xpNeeded(1); this.pendingLevels = 0; this.coins = 0;
    this.over = false; this.ended = false; this.killedBy = null; this.damageBy = {}; this.lastSrc = null; this.won = false; this.otStep = -1; this.otAcc = 0; this.god = false; this.bossKilled = false; this.elitesKilled = 0; this.fusions = 0; this.winAt = 0;
    this.grace = 0; this.flash = 0; this.spawned = 0; this.spawnAcc = 0; this.hitsTaken = 0; this.alpha = 1; this.acc = 0;
    this.cardT = 0.3; this.flowT = 0; this.ringT = 0; this.golemT = 0; this.storm = null; this.offer = null; this.prompt = '';
    this.dmgMul = 1; this.hpMul = 1; this.speedMul = 1; this.cfgHp = CFG.player.hp;
    this.flags = { warden: false, idols: false };
    this.items = []; this.blessings = []; this.vasesBroken = 0; this.talismanCd = 0; this.coinFrac = 0;
    this.boss = { state: 'idle', early: false, phase: 1 };
    this.sp = []; this.chests = [];
    this.faceOf = {};
    this.p = makePlayer();
    this.mods = { burnDps: 0, burnDur: 0, markDur: 0, markBonus: 0, cardRate: 0, move: 0, dash: 0, maxLp: 0, pickup: 0, xp: 0, markExplode: null, monsterRate: 0 };
    const meta = this.opts.meta || null;                                    // permanent progress, handed in by the browser (pure data)
    this.metaMods = meta ? meta.mods : {};
    this.unlockedCards = meta ? new Set(meta.cards) : null; this.unlockedItems = meta ? new Set(meta.items) : null;
    this.wardenKilled = false; this.trapEver = false;
    this.field = makeField(this.duelist, this.rcos);
    this.field.redraws += this.metaMods.redraws || 0; this.field.banishes += this.metaMods.banishes || 0;
    if (this.metaMods.startLevel) this.field.monsters[0].level = Math.min(10, 1 + this.metaMods.startLevel);
    recompute(this);
    this._openingHand();
    this.map = CLASSIC_MAP; if (mapKey() !== CLASSIC_MAP.key) { loadMap(CLASSIC_MAP); this.flow.rebuild(); }
    this.world = this.opts.mode && this.opts.mode !== 'classic' ? emptyWorld() : buildWorld(this);       // stage runs: initRun builds the world on the generated map
    this.p.maxHp = this.oaths.glass ? 1 : this.cfgHp + this.mods.maxLp; this.p.hp = this.p.maxHp;
    this.en.alive.fill(0); this.shots.alive.fill(0); this.pick.alive.fill(0);
    this.tele.forEach(o => { o.on = false; }); this.fx.forEach(o => { o.on = false; }); this.eb.forEach(o => { o.on = false; }); this.btraps.forEach(o => { o.on = false; });
    this.grid.rebuild(this.en.max, this.en.x, this.en.z, this.en.alive);
    this.flow.valid = false; this.evHead = this.evTail = 0;
    this.tickN = 0; this.levelUps = 0; this.trapsFired = 0; this.trapsSet = 0; this.maxMonsters = 0; this.gateOpenedAt = -1; this.godFusions = 0; this.secretFusions = 0;
    this.fusionIds = []; this.elementsUsed = 0; this.cardsPicked = []; this.fullForms = [];
    this.shades = []; this.shadeOn = false; this.shadeAge = 0; this.merged = 0; this.caps = makeCaps(); this.tollT = K.tollEverySec; this.upgHist = []; this.roleKills = { elite: 0, bossA: 0, bossB: 0, gate: 0, other: 0 }; this.callN = 0; this.endAt = -1; this.runs = this.runs || new Int32Array(6 * 4096); this.runN = 0;
    this.srcNames = ['other']; this.curSrc = 0; this.dealtLog = {}; this.fusionGuard = null;
    this.chestsOpenedTotal = 0; this.stagesCleared = 0; this.stageFacts = []; this.swiftChips = 0; this.duelOn = false; this.stagePrompt = ''; this.bDown = false; this.gateDown = null; this.desc = null; this.circle = null; this.altar = null; this.heat = 1;
    initRun(this);                                                  // opts.mode: 'classic' (default, one 8:00 stage), 'run' (three stages) or 'quick' (Quick Duel)
  }

  // Sim to view only through this queue. Fixed size ring; if the view falls behind the oldest events are dropped, never the rules.
  // emit(type, a, b, c) is for numeric events (hit, kill, pickup, levelup, hurt, bossphase, sound); event(type, text) carries UI text.
  emit(type, a, b, c, d) {
    const i = this.evHead & 255; this.evHead++; if (this.evHead - this.evTail > 256) this.evTail = this.evHead - 256;
    this.evType[i] = type; this.evA[i] = a || 0; this.evB[i] = b || 0; this.evC[i] = c || 0; this.evData[i] = d === undefined ? null : d; this.evT[i] = this.t;
  }
  event(type, data) { this.emit(type, 0, 0, 0, data); }
  // calls fn(type, a, b, c, data, t) for every queued event, oldest first, then empties the queue
  drainEvents(fn) { while (this.evTail < this.evHead) { const i = this.evTail & 255; this.evTail++; fn(this.evType[i], this.evA[i], this.evB[i], this.evC[i], this.evData[i], this.evT[i]); } }
  enemyCount() { return enemyCount(this.en); }
  // Damage dealt by each source, per run minute (recording only, for before/after comparisons). curSrc is set around each attack.
  srcIndex(name) { let i = this.srcNames.indexOf(name); if (i < 0) { i = this.srcNames.length; this.srcNames.push(name); } return i; }
  logDealt(d) {
    const name = this.srcNames[this.curSrc], m = Math.floor(this.mode !== 'classic' ? (this.scTotal + this.sc) / 60 : this.t / 60);
    const a = this.dealtLog[name] || (this.dealtLog[name] = []); a[m] = (a[m] || 0) + d;
  }
  fireBolt(x, y, z, vx, vz, life, dmg, r, src) {
    for (const b of this.eb) if (!b.on) { Object.assign(b, { on: true, x, y, z, vx, vz, life, dmg, r, px: x, pz: z, src: src || 'Glass Seer bolt' }); return; }
  }
  explodeAt(x, y, z, r, pDmg, eDmg, src) { explode(this, x, y, z, r, pDmg, eDmg, undefined, src); }
  damageSpecial(sp, dmg, fx, fz, o) { return damageSpecial(this, sp, dmg, fx, fz, o); }

  // Advance by dt seconds in fixed sub-steps of at most 1/60 s. Paused while an offer is open.
  // THE entry point: one fixed 1/60 s tick from one quantised input record. No variable time ever reaches the rules.
  // While an offer (level-up, chest, Altar, shop, shrine) is open the world is frozen and the tick only reads rec.menu.
  tick(rec) {
    this._record(rec);
    if (this.tape) this.tape.push([rec.mx, rec.mz, rec.yaw, rec.buttons, rec.menu]);
    if (this.offer) { this._menu(rec.menu); return; }
    if (this.over) return;
    decode(rec, this._cmd); this._tick(STEP, this._cmd);
  }
  _menu(code) {
    if (!code) return;
    if (code >= MENU_TAKE && code <= MENU_TAKE + 3) this.choose(code - MENU_TAKE);
    else if (code >= 30 && code < 50) this.choose(code - 30);
    else if (code === MENU_REDRAW) this.redraw(); else if (code === MENU_PASS) this.pass(); else if (code === MENU_LEAVE) this.leave();
    else if (code > MENU_BANISH && code <= MENU_BANISH + 4) this.banish(code - MENU_BANISH - 1);
  }
  // Every tick() call is kept as a run-length record: [count, mx, mz, yaw, buttons, menu] per run of identical input. This is the replay.
  _record(rec) {
    this.callN++;
    let r = this.runs, n = this.runN;
    if (n > 0 && r[n - 5] === rec.mx && r[n - 4] === rec.mz && r[n - 3] === rec.yaw && r[n - 2] === rec.buttons && r[n - 1] === (rec.menu | 0)) { r[n - 6]++; return; }
    if (n + 6 > r.length) { const g2 = new Int32Array(r.length * 2); g2.set(r); this.runs = r = g2; }
    r[n] = 1; r[n + 1] = rec.mx; r[n + 2] = rec.mz; r[n + 3] = rec.yaw; r[n + 4] = rec.buttons; r[n + 5] = rec.menu | 0; this.runN = n + 6;
  }
  // The verifiable record of this run: how to rebuild it, the input, and what it should end as.
  replayRaw() {
    const o = this.opts;
    return { v: 1, version: BUILD_VERSION_REPLAY, seed: this.seed, duelist: this.duelist, mode: this.mode, difficulty: this.difficulty, oaths: this.oathList.slice(), world: o.world === undefined ? null : o.world, offers: o.offers !== false, meta: o.meta || null,
      ticks: this.callN, runs: this.runs.slice(0, this.runN), ended: !!this.ended, endAt: this.ended ? this.endAt : -1, hash: hashHex(this), score: this.score() };
  }
  score() {
    const S = SCORE, R = this.roleKills;
    const sum = this.kills * S.kill + R.elite * S.elite + R.bossA * S.bossA + R.bossB * S.bossB + R.gate * S.gate + R.other * S.other + this.stagesCleared * S.stage +
      Math.floor(this.overtimeSeconds()) * S.overtimeSec + this.fusions * S.fusion + this.godFusions * S.god + this.secretFusions * S.secret;
    let pct = Math.round(this.diff.score * 100); for (const id of this.oathList) pct += OATH_BY_ID[id].scorePct;     // each Oath adds to the score multiplier
    return Math.floor(sum * pct / 100);
  }
  startTape() { this.tape = []; return this.tape; }
  // For tests, bots and tools: dt seconds as whole ticks of the same fixed step. cmd may be a record or a { f, r, yaw, jump, dash, slide, use } command.
  step(dt, cmd) {
    const n = Math.max(1, Math.round(dt / STEP)), rec = quantise(cmd, this._rec);
    for (let i = 0; i < n && !this.over && !this.offer; i++) { this.tick(rec); rec.menu = 0; }
  }
  // For the browser: whole 1/60 s ticks from real time, at most 2 catch-up ticks (a longer stall is dropped, never simulated with a bigger dt).
  // The view only blends between the previous and current snapshot using the returned alpha.
  fixed(dt, rec) {
    this.acc += dt * (this.oaths.hasty ? 1.25 : 1);                          // Hasty Oath: the game runs 1.25x
    let ticks = 0;
    while (this.acc >= STEP && !this.over && !this.offer && ticks < 2) { this.tick(rec); this.acc -= STEP; ticks++; rec.buttons &= ~8; rec.menu = 0; }   // "use" is a one-tick press
    if (this.acc > STEP) this.acc = STEP;
    if (this.offer || this.over) this.acc = 0;
    this.alpha = this.acc / STEP;
    return this.alpha;
  }

  _snap() {
    const e = this.en, p = this.p;
    p.px = p.x; p.py = p.y; p.pz = p.z; p.pface = p.face;
    e.px.set(e.x); e.py.set(e.y); e.pz.set(e.z); e.pface.set(e.face);
    for (const sp of this.sp) { sp.px = sp.x; sp.py = sp.y; sp.pz = sp.z; sp.pface = sp.face; }
    for (const s of this.shades) { s.px = s.x; s.py = s.y; s.pz = s.z; }
  }

  _tick(dt, cmd) {
    const e = this.en;
    if (mapKey() !== this.map.key) { loadMap(this.map); this.flow.rebuild(); }                   // the terrain is one global: reload if another game changed it
    this._snap();
    this.t += dt; this.tickN++;
    if (this.mode !== 'classic' && this.desc) { descentTick(this, dt); return; }                 // the Descent: the world waits
    this.grid.rebuild(e.max, e.x, e.z, e.alive);
    this.flowT -= dt;
    if (this.flowT <= 0 || !this.flow.valid) { this.flow.update(this.p.x, this.p.z); this.flowT = CFG.path.refresh; }
    updatePlayer(this, dt, cmd);
    if (this.p.hp > this.p.maxHp) this.p.hp = this.p.maxHp;

    if (this.mode === 'classic') updateSpawner(this, dt); else updateStages(this, dt);
    updateEnemies(this, dt);
    updateSpecials(this, dt);
    updateMonsters(this, dt);
    updateTraps(this, dt);
    updateShots(this, dt);
    updateBolts(this, dt);
    updatePickups(this, dt);
    updateWorld(this, dt);
    { let mc = 0; for (let k = 0; k < 4; k++) if (this.field.monsters[k]) mc++; if (mc > this.maxMonsters) this.maxMonsters = mc; }
    tickPool(this.tele, dt); tickPool(this.fx, dt);
    refillCaps(this, dt);
    if (this.grace > 0) this.grace -= dt;
    if (this.flash > 0) this.flash -= dt;
    this._interact(cmd);
    if (!this.offer && this.pendingLevels > 0 && this.opts.offers !== false) openLevelOffer(this);
  }

  _interact(cmd) {
    const p = this.p; this.prompt = '';
    const prop = nearestProp(this);
    let chest = null, bd = 9;
    for (const c of this.chests) { if (c.open) continue; const dx = c.x - p.x, dz = c.z - p.z, d = dx * dx + dz * dz; if (d < bd) { bd = d; chest = c; } }
    if (chest) {
      this.prompt = 'E: open the Sealed Chest' + (fusionsReady(this).length ? ' (a Fusion is ready!)' : '');
      if (cmd && cmd.use && !this.offer) { openChest(this, chest); return; }
    }
    if (!chest && prop) {
      this.prompt = prop.text;
      if (cmd && cmd.use && !this.offer) { useProp(this, prop); return; }
    }
    if (!chest && !prop) for (const s of this.world.shrines) if (!s.done) { const dx2 = p.x - s.x, dz2 = p.z - s.z; if (dx2 * dx2 + dz2 * dz2 < 36) this.prompt = 'Hold the ring: ' + s.charge.toFixed(1) + ' / ' + 5 + ' s' + (s.charge > 0 && dx2 * dx2 + dz2 * dz2 > 20 ? ' (stay inside)' : ''); }
    if (this.mode !== 'classic') { if (!chest && !prop && this.stagePrompt) this.prompt = this.stagePrompt; return; }
    const G = RUN.gate, dx = p.x - G.x, dz = p.z - G.z;
    if (this.boss.state === 'idle' && this.t >= G.earliest && dx * dx + dz * dz < G.radius * G.radius) {
      if (!chest && !prop) this.prompt = 'E: enter the Royal Gate (early, bonus Star Chips)';
      if (cmd && cmd.use && !this.offer) startBoss(this, true);
    }
  }

  // Nearest living enemy within maxR of (x,z), or -1. Looks outward in growing rings of the grid.
  nearest(x, z, maxR) {
    const e = this.en, buf = this.nearBuf;
    for (let r = 8; ; r *= 2) {
      const reach = Math.min(r, maxR), c = this.grid.query(x, z, reach, buf);
      let best = -1, bd = reach * reach;
      for (let k = 0; k < c; k++) {
        const i = buf[k]; if (!e.alive[i]) continue;
        const dx = e.x[i] - x, dz = e.z[i] - z, d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0 || reach >= maxR) return best;
    }
  }

  hitEnemy(i, dmg, vx, vz) { return damageEnemy(this, i, dmg, { kx: vx, kz: vz }); }

  addXp(n) {
    const v = n * (1 + this.mods.xp) * xpScale(this);
    this.xp += v; this.xpCur += v;
    while (this.xpCur >= this.xpNeed) { this.xpCur -= this.xpNeed; this.level++; this.xpNeed = xpNeeded(this.level); this.pendingLevels++; this.levelUps++; this.emit('levelup', this.level); }
  }

  // flags (SPEC section 6): 1 SELF (the player's own cost: 1 HP floor, never kills, no grace, no dodge or Ward), 2 PIERCE, 4 TRUE (ignores Guard)
  hurtPlayer(n, big, src, flags) {
    flags = flags | 0; const SELF = (flags & 1) !== 0;
    this.emit('hurt', n, big ? 1 : 0, SELF ? 1 : 0, src || null);
    if (this.god || this.over) return false;
    if (!SELF && this.p.dashT > 0) return false;
    if (!SELF && this.mods.talisman && this.talismanCd <= 0) { this.talismanCd = 20; this.event('banner', 'The Paper Talisman blocks the hit.'); return false; }
    if (!(flags & 5)) n = Math.max(1, n - this.mods.armour);
    this.p.hp = SELF ? Math.max(Math.min(this.p.hp, 1), this.p.hp - n) : Math.max(0, this.p.hp - n);       // the 1 HP floor never raises LP already below 1
    src = src || 'unknown'; this.damageBy[src] = (this.damageBy[src] || 0) + n; this.lastSrc = src;
    if (!SELF) { this.hitsTaken++; this.flash = 0.25; this.grace = CFG.enemy.grace; }
    onPlayerHurt(this, SELF);
    if (!SELF && this.p.hp <= 0) { this.over = true; this.killedBy = src; }
    return true;
  }

  // offer actions (UI and the run simulator both use these)
  choose(i) { if (this.offer && this.offer.type === 'final') return finalChoice(this, i); return chooseCard(this, i); }
  redraw() { return redraw(this); }
  banish(i) { return banish(this, i); }
  pass() { return pass(this); }
  leave() { return leaveChest(this); }

  // Deck Box "Opening Hand": start with random unlocked Spells already set
  _openingHand() {
    const n = this.metaMods.openingHand || 0; if (!n) return;
    const ids = Object.keys(SPELLS).filter(id => !this.unlockedCards || this.unlockedCards.has(id));
    for (let k = 0; k < n && ids.length; k++) { const id = ids.splice(Math.floor(this.rl() * ids.length), 1)[0], slot = this.field.spells.findIndex(x => !x); if (slot >= 0) this.field.spells[slot] = { id, level: 1, cd: 0, rootFx: 0 }; }
    recompute(this);
  }
  runStats() { return { time: this.t, kills: this.kills, level: this.level, fusions: this.fusions, bossKilled: this.bossKilled, wardenKilled: this.wardenKilled, overtime: this.overtimeSeconds(), trapSet: this.trapEver, chests: this.world.opened, vases: this.vasesBroken }; }

  results(ctx) { return runResults(this, ctx); }
  overtimeSeconds() { return this.mode !== 'classic' ? (this.duelOn ? this.otT : 0) : Math.max(0, this.t - RUN.overtime.from); }
  endRun() { if (!this.over) { this.over = true; this.ended = true; this.endAt = this.callN; } }

  starChips() {
    const S = RUN.starChips;
    return Math.floor(this.kills / S.perKills) + S.perElite * (this.elitesKilled - (this.bossKilled ? 1 : 0)) + (this.bossKilled ? S.boss : 0) + (this.mode === 'classic' && this.boss.early && this.bossKilled ? RUN.gate.earlyStarChips : 0) + (this.swiftChips || 0);
  }
}





