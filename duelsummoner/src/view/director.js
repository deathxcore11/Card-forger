// The big-moment budgets and the director (spectacle spec 4.2 and 4.3). Pure view logic: no THREE, no DOM, no sim reads, so the unit tests run it in node. Nothing here changes a tick or the replay hash.
//
// THE FAIRNESS RULE: hit-stop is decided from sim ticks only (StopBudget). It never reads frame time, settings or the drop ladder, so one tape gets the same (tick, stop) list at 60 fps, 120 fps, with Big moments
// Full or Off, with Reduce motion on or off. Flashes and shake budgets are real-time or screen budgets (the spec lists them in seconds) and only decide what the SCREEN shows; a dropped flash is dropped, never queued.

// ---- hit-stop: at most 250 ms in any 300 ticks, at least 24 ticks between two. Returns the stop that is allowed (seconds), 0 for none. ----
export class StopBudget {
  constructor() { this.log = []; this.last = -1e9; }
  ask(tick, sec) {
    if (!(sec > 0)) return 0;
    // two moments on the SAME tick: the longer stop wins (the Tablebreak's 120 ms must not be lost to the 40 ms of the Reach-cap burst that fired in the same tick)
    if (tick === this.last && this.log.length && this.log[this.log.length - 1][0] === tick && sec > this.log[this.log.length - 1][1]) { this.log.pop(); this.last = this.log.length ? this.log[this.log.length - 1][0] : -1e9; }
    if (tick - this.last < 24) return 0;
    this.log = this.log.filter(e => tick - e[0] < 300); let used = 0; for (const e of this.log) used += e[1];
    const ok = Math.min(sec, 0.25 - used); if (ok < 0.02) return 0;
    this.log.push([tick, ok]); this.last = tick; return ok;
  }
}

// ---- screen flashes: at most 2 in any rolling 1.0 s, at least 350 ms apart, at most 6 in 10 s and 20 in 60 s. Strength = min(0.35, 0.20 / (1 - stage luminance)). ----
export const STAGE_LUM = [0.55, 0.10, 0.12];
export class FlashGate {
  constructor() { this.t = []; }
  strength(stage) { return Math.min(0.35, 0.20 / (1 - (STAGE_LUM[Math.min(stage | 0, 2)] || 0.55))); }
  ask(nowMs, a, stage) {
    const t = this.t = this.t.filter(x => nowMs - x < 60000), n1 = t.filter(x => nowMs - x < 1000).length, n10 = t.filter(x => nowMs - x < 10000).length;
    if ((t.length && nowMs - t[t.length - 1] < 350) || n1 >= 2 || n10 >= 6 || t.length >= 20) return 0;
    t.push(nowMs); return Math.min(a, this.strength(stage));
  }
}

// ---- shake: own events add at most 0.3 trauma in any 1.0 s; trauma over 0.3 for at most 0.6 s in any 3.0 s (then clamped to 0.3); the hurt shake at most once per 350 ms. ----
export class ShakeBudget {
  constructor() { this.adds = []; this.over = []; this.lastHurt = -1e9; }
  ask(nowMs, a, hurt) {
    if (hurt) { if (nowMs - this.lastHurt < 350) return 0; this.lastHurt = nowMs; return a; }
    this.adds = this.adds.filter(e => nowMs - e[0] < 1000); let used = 0; for (const e of this.adds) used += e[1];
    const ok = Math.min(a, 0.3 - used); if (ok <= 0.005) return 0; this.adds.push([nowMs, ok]); return ok;
  }
  // called each frame with the current trauma: returns the trauma to use (over 0.3 only for 0.6 s in any 3.0 s)
  limit(nowMs, dt, trauma) {
    this.over = this.over.filter(e => nowMs - e[0] < 3000);
    if (trauma > 0.3) { let used = 0; for (const e of this.over) used += e[1]; if (used + dt > 0.6) return 0.3; this.over.push([nowMs, dt]); }
    return trauma;
  }
}

// ---- the director: one big moment owns the screen at a time ----
// request(id, cls, tick, o) -> { cls, screen, world }   cls 'A' | 'B' | 'C' (the class actually granted: a second moment of the same class inside 90 ticks drops one class)
//   screen: true if this moment may use its screen parts (flash, dim, edge, distortion, hit-stop, shake); world: true if it may draw its world parts (column, ring, marks)
//   o.once: 'run' | 'stage' (that id plays once); o.blocked: an offer, reveal or pause is open (no moment starts; class A is held for 30 ticks after the panel closes, then dropped)
const RANK = { A: 3, B: 2, C: 1 }, GAP = { A: 180, B: 90, C: 0 }, DUR = { A: 90, B: 60, C: 30 };
export class MomentDirector {
  constructor() { this.owner = null; this.lastStart = { A: -1e9, B: -1e9, C: -1e9 }; this.lastId = {}; this.once = new Set(); this.heldA = null; this.closedAt = -1e9; this.granted = []; }
  newStage() { for (const k of [...this.once]) if (k.startsWith('stage:')) this.once.delete(k); }
  newRun() { this.once.clear(); this.owner = null; this.heldA = null; this.granted.length = 0; for (const k of ['A', 'B', 'C']) this.lastStart[k] = -1e9; }
  panel(open, tick) { if (!open && this._open) { this.closedAt = tick; const h = this.heldA; this.heldA = null; this._open = false; if (h && tick - h.tick <= 30) return h; } this._open = open; return null; }
  request(id, cls, tick, o) {
    o = o || {};
    if (o.blocked) { if (cls === 'A') this.heldA = { id, cls, tick, o: Object.assign({}, o, { blocked: false }) }; return { cls, screen: false, world: false, dropped: true }; }
    if (o.once) { const key = o.once + ':' + id; if (this.once.has(key)) return { cls, screen: false, world: false, dropped: true }; this.once.add(key); }
    if (this.lastStart[cls] > -1e8 && tick - this.lastStart[cls] < GAP[cls]) { cls = cls === 'A' ? 'B' : cls === 'B' ? 'C' : 'C'; }                        // cooldown not over: one class down
    else if (this.owner && this.owner.cls === cls && tick - this.owner.tick < 90) cls = cls === 'A' ? 'B' : cls === 'B' ? 'C' : 'C';                          // a second moment of the same class within 90 ticks
    let screen = true;
    if (this.owner && tick < this.owner.end && RANK[this.owner.cls] >= RANK[cls]) screen = false;                                                            // a lower or equal class loses its screen parts while one owns the screen
    if (screen) { this.owner = { id, cls, tick, end: tick + DUR[cls] }; if (cls !== 'C') this.lastStart[cls] = tick; }
    if (cls === 'C' && screen) screen = false;                                                                                                                // class C moments keep only their local ring and column
    this.granted.push([tick, id, cls, screen]); if (this.granted.length > 400) this.granted.shift();
    return { cls, screen, world: true };
  }
}

