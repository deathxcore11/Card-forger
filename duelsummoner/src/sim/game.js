// The rules of a run. No drawing, no DOM: the view reads this state, tests and the run simulator drive it directly.
import { CFG } from '../data/config.js';
import { RUN } from '../data/waves.js';
import { SpatialGrid } from '../core/grid.js';
import { makeRng } from '../core/util.js';
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
import { buildWorld, updateWorld, nearestProp, useProp } from './world.js';

const STEP = 1 / 60;

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
    this.events = [];
    this.reset(seed, opts.duelist);
  }

  reset(seed = this.seed, duelist) {
    this.seed = seed; this.rng = makeRng(seed); this.duelist = duelist || this.duelist || 'kael';
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
    this.field = makeField(this.duelist, this.rng);
    recompute(this);
    this.world = buildWorld(this);                                  // opts.world === 'none': empty, for a generator to fill through placeObject
    this.p.maxHp = this.cfgHp; this.p.hp = this.cfgHp;
    this.en.alive.fill(0); this.shots.alive.fill(0); this.pick.alive.fill(0);
    this.tele.forEach(o => { o.on = false; }); this.fx.forEach(o => { o.on = false; }); this.eb.forEach(o => { o.on = false; }); this.btraps.forEach(o => { o.on = false; });
    this.grid.rebuild(this.en.max, this.en.x, this.en.z, this.en.alive);
    this.flow.valid = false; this.events.length = 0;
  }

  event(type, data) { if (this.events.length < 64) this.events.push({ type, data, t: this.t }); }
  enemyCount() { return enemyCount(this.en); }
  fireBolt(x, y, z, vx, vz, life, dmg, r, src) {
    for (const b of this.eb) if (!b.on) { Object.assign(b, { on: true, x, y, z, vx, vz, life, dmg, r, px: x, pz: z, src: src || 'Glass Seer bolt' }); return; }
  }
  explodeAt(x, y, z, r, pDmg, eDmg, src) { explode(this, x, y, z, r, pDmg, eDmg, undefined, src); }
  damageSpecial(sp, dmg, fx, fz, o) { return damageSpecial(this, sp, dmg, fx, fz, o); }

  // Advance by dt seconds in fixed sub-steps of at most 1/60 s. Paused while an offer is open.
  step(dt, cmd) {
    const n = Math.max(1, Math.ceil(dt / STEP - 1e-6)), h = dt / n;
    for (let i = 0; i < n && !this.over && !this.offer; i++) this._tick(h, cmd);
  }
  // For the browser: whole 1/60 s ticks from real time. Returns the blend factor between the last two ticks.
  fixed(dt, cmd) {
    this.acc += Math.min(dt, 0.1);
    let ticks = 0;
    while (this.acc >= STEP && !this.over && !this.offer && ticks < 8) { this._tick(STEP, cmd); this.acc -= STEP; ticks++; cmd = Object.assign({}, cmd, { use: false }); }
    if (this.offer || this.over) this.acc = 0;
    this.alpha = Math.min(1, this.acc / STEP);
    return this.alpha;
  }

  _snap() {
    const e = this.en, p = this.p;
    p.px = p.x; p.py = p.y; p.pz = p.z; p.pface = p.face;
    e.px.set(e.x); e.py.set(e.y); e.pz.set(e.z); e.pface.set(e.face);
    for (const sp of this.sp) { sp.px = sp.x; sp.py = sp.y; sp.pz = sp.z; sp.pface = sp.face; }
  }

  _tick(dt, cmd) {
    const e = this.en;
    this._snap();
    this.t += dt;
    this.grid.rebuild(e.max, e.x, e.z, e.alive);
    this.flowT -= dt;
    if (this.flowT <= 0 || !this.flow.valid) { this.flow.update(this.p.x, this.p.z); this.flowT = CFG.path.refresh; }
    updatePlayer(this, dt, cmd);
    if (this.p.hp > this.p.maxHp) this.p.hp = this.p.maxHp;

    updateSpawner(this, dt);
    updateEnemies(this, dt);
    updateSpecials(this, dt);
    updateMonsters(this, dt);
    updateTraps(this, dt);
    updateShots(this, dt);
    updateBolts(this, dt);
    updatePickups(this, dt);
    updateWorld(this, dt);
    tickPool(this.tele, dt); tickPool(this.fx, dt);
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
    const v = n * (1 + this.mods.xp);
    this.xp += v; this.xpCur += v;
    while (this.xpCur >= this.xpNeed) { this.xpCur -= this.xpNeed; this.level++; this.xpNeed = xpNeeded(this.level); this.pendingLevels++; this.event('levelup', this.level); }
  }

  hurtPlayer(n, big, src) {
    if (this.god || this.p.dashT > 0 || this.over) return false;
    if (this.mods.talisman && this.talismanCd <= 0) { this.talismanCd = 20; this.event('banner', 'The Paper Talisman blocks the hit.'); return false; }
    n = Math.max(1, n - this.mods.armour);
    this.p.hp = Math.max(0, this.p.hp - n);
    src = src || 'unknown'; this.damageBy[src] = (this.damageBy[src] || 0) + n; this.lastSrc = src;
    this.hitsTaken++; this.flash = 0.25; this.grace = CFG.enemy.grace;
    onPlayerHurt(this);
    if (this.p.hp <= 0) { this.over = true; this.killedBy = src; }
    return true;
  }

  // offer actions (UI and the run simulator both use these)
  choose(i) { return chooseCard(this, i); }
  redraw() { return redraw(this); }
  banish(i) { return banish(this, i); }
  pass() { return pass(this); }
  leave() { return leaveChest(this); }

  overtimeSeconds() { return Math.max(0, this.t - RUN.overtime.from); }
  endRun() { if (!this.over) { this.over = true; this.ended = true; } }

  starChips() {
    const S = RUN.starChips;
    return Math.floor(this.kills / S.perKills) + S.perElite * (this.elitesKilled - (this.bossKilled ? 1 : 0)) + (this.bossKilled ? S.boss : 0) + (this.boss.early && this.bossKilled ? RUN.gate.earlyStarChips : 0);
  }
}



