// Local reference for the leaderboard service in design/leaderboard-server.md. A JSON file stands in for the Supabase tables and a
// stand-in sign-in (a player id sent by the game) stands in for the Supabase token. The real checker (verifyReplay) is the same one
// the live checker will run. No keys of any kind live here.
//   runs: pending -> verified | rejected.  Only verified rows reach a board; a pending row is shown only to its owner.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { verifyReplay } from './verify.mjs';

export const LIMITS = { recordBytes: 60 * 1024, perHour: 30, nameLen: 24, top: 100 };
const clean = s => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').slice(0, LIMITS.nameLen);
export const weekOf = ms => { const d = new Date(ms); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };

export class Board {
  constructor(file) { this.file = file || null; this.db = { runs: [], profiles: {}, n: 0 }; if (file && existsSync(file)) { try { this.db = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { /* start empty */ } } }
  save() { if (this.file) writeFileSync(this.file, JSON.stringify(this.db)); }
  profile(user, name) { if (name) this.db.profiles[user] = { name: clean(name) || 'Duelist' }; return this.db.profiles[user] || { name: 'Duelist' }; }

  // submit: signed-in players only, size and rate limited. Returns the pending row id at once.
  submit(user, record, name, now = Date.now()) {
    if (!user || user === 'anon') return { error: 'sign in to post a score', code: 401 };
    if (!record || record.v !== 1 || !record.tape || typeof record.seed === 'undefined') return { error: 'not a replay record', code: 400 };
    if (JSON.stringify(record).length > LIMITS.recordBytes) return { error: 'record too large', code: 413 };
    const recent = this.db.runs.filter(r => r.user === user && now - r.created < 3600e3).length;
    if (recent >= LIMITS.perHour) return { error: 'too many submits this hour', code: 429 };
    this.profile(user, name);
    const run = { id: 'r' + (++this.db.n), user, status: 'pending', map: record.mode, difficulty: record.difficulty, mode: record.mode, duelist: record.duelist, oaths: (record.oaths || []).slice().sort(),
      seed: String(record.seed), build: record.version, score: record.score | 0, ticks: record.ticks | 0, runMs: Math.round((record.ticks | 0) * 1000 / 60), hash: record.hash, record, why: [], created: now, checked: 0, week: weekOf(now) };
    this.db.runs.push(run); this.save();
    return { id: run.id, status: 'pending' };
  }

  // checker: verify every pending row; a pass makes it verified, a fail rejected with the reasons kept. Never trusts the claimed score.
  checkPending(verify = verifyReplay, now = Date.now()) {
    let n = 0;
    for (const r of this.db.runs) {
      if (r.status !== 'pending') continue;
      let res; try { res = verify(r.record); } catch (e) { res = { ok: false, why: ['checker error: ' + e.message] }; }
      r.status = res.ok ? 'verified' : 'rejected'; r.why = res.why || []; r.checked = now; if (res.ok) r.score = res.score; n++;
    }
    if (n) this.save();
    return n;
  }

  _list(map, difficulty, period, now) {
    const wk = weekOf(now); const rows = this.db.runs.filter(r => r.status === 'verified' && r.map === map && r.difficulty === difficulty && (period !== 'week' || r.week === wk));
    const best = new Map();                                                           // one row per player: best score, ties to the shorter run then the earlier submit
    for (const r of rows) { const b = best.get(r.user); if (!b || r.score > b.score || (r.score === b.score && (r.runMs < b.runMs || (r.runMs === b.runMs && r.created < b.created)))) best.set(r.user, r); }
    return [...best.values()].sort((a, b) => b.score - a.score || a.runMs - b.runMs || a.created - b.created);
  }
  _pub(r, i) { return { rank: i + 1, name: this.profile(r.user).name, duelist: r.duelist, score: r.score, runMs: r.runMs, oaths: r.oaths, seal: r.seed, id: r.id }; }

  board(map, difficulty, period = 'all', user = null, now = Date.now()) {
    const list = this._list(map, difficulty, period, now), top = list.slice(0, LIMITS.top).map((r, i) => this._pub(r, i));
    const mine = user ? list.findIndex(r => r.user === user) : -1;
    return { map, difficulty, period, week: weekOf(now), top, me: mine >= 0 ? this._pub(list[mine], mine) : null };
  }
  status(id, user, now = Date.now()) {
    const r = this.db.runs.find(x => x.id === id); if (!r || r.user !== user) return { error: 'not found', code: 404 };
    const out = { id: r.id, status: r.status, score: r.score };
    if (r.status === 'verified') { const l = this._list(r.map, r.difficulty, 'all', now), i = l.findIndex(x => x.user === r.user); const w = this._list(r.map, r.difficulty, 'week', now), j = w.findIndex(x => x.user === r.user); out.placing = i + 1; out.weekPlacing = j >= 0 ? j + 1 : 0; }
    if (r.status === 'rejected') out.why = r.why.filter(w => !w.startsWith('note'));
    return out;
  }
  replay(id) { const r = this.db.runs.find(x => x.id === id && x.status === 'verified'); return r ? r.record : null; }
}
