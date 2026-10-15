// The Matchups tab, shared by all three games: how the deck does against each of the decks
// winning right now (simulated, then corrected by the games you log), and a plan for each one.
// Each game supplies its own numbers and plan; the layout, order and wording are the same.
import { esc } from "./ui.js";
import { buildOverlay } from "./build-overlay.js";

const pc = (x) => Math.round((x || 0) * 100);
// `even` is a fair share: 50% one-on-one, 25% in a four-player Commander pod.
const tone = (x, even = 0.5) => (x >= even + 0.05 ? "good" : x >= even - 0.05 ? "even" : "bad");
const verdict = (x, even = 0.5) => even < 0.5
  ? (x >= 0.35 ? "Wins well over its share of pods" : x >= 0.28 ? "Wins a bit more than its share" : x >= 0.22 ? "Wins about its share of pods" : x >= 0.12 ? "Wins less than its share" : "Outpaced by this field")
  : (x >= 0.6 ? "Favored against the field" : x >= 0.53 ? "Slightly ahead of the field" : x >= 0.47 ? "Even against the field" : x >= 0.4 ? "Slightly behind the field" : "Behind the field");
const rec = (r) => `${r.w}–${r.l}${r.d ? "–" + r.d : ""}`;

function ring(x, even = 0.5) {
  const r = 34, c = 2 * Math.PI * r;
  return `<svg class="mu-ring ${tone(x, even)}" viewBox="0 0 84 84" role="img" aria-label="${pc(x)}% expected ${even < 0.5 ? "pod wins" : "wins against the field"}"><circle cx="42" cy="42" r="${r}" class="mu-ring-track"/><circle cx="42" cy="42" r="${r}" class="mu-ring-fill" style="--c:${c.toFixed(1)};--o:${(c * (1 - x)).toFixed(1)}"/><text x="42" y="47" text-anchor="middle"><tspan data-count="${pc(x)}">${pc(x)}</tspan>%</text></svg>`;
}

// v: { prefix, gameName, state: { busy, msg, error, first }, intro, field: [{ name, share, art,
//   sim, rec, shown, plan, open }], fieldWin, record, unsupported }
export function matchupsTab(v) {
  const P = v.prefix, S = v.state || {};
  if (v.unsupported) return `<section class="panel mu-empty"><div class="mu-empty-mark" aria-hidden="true">⚔</div><h3>Matchups need a tournament field</h3><p class="muted">${esc(v.unsupported)}</p></section>`;
  if (S.busy) return buildOverlay(S.msg, { title: "Simulating matchups", note: `Loading the decks winning right now, then playing 2,000 games against each with ${v.gameName}'s own rules. The first run takes up to a minute; after that it's instant.` }) + skeleton();
  if (!v.field?.length)
    return `<section class="panel mu-empty"><div class="mu-empty-mark" aria-hidden="true">⚔</div><h3>How does this deck do against the field?</h3><p class="muted">Simulate it against the decks winning ${esc(v.fieldLabel || "right now")}, then log your own games to sharpen the numbers.</p>${S.error ? `<p class="small warn-text">${esc(S.error)}</p>` : ""}<button class="btn" data-act="${P}Run" ${S.error ? "" : `data-autorun="${esc(v.runKey || P)}"`}>Simulate matchups</button></section>`;
  const r = v.record, even = v.pod ? 0.25 : 0.5,
    best = [...v.field].sort((a, b) => b.shown - a.shown)[0],
    worst = [...v.field].sort((a, b) => a.shown - b.shown)[0];
  if (v.pod) return podTab(v, P, S, r, best, worst);
  return `<section class="panel mu-head">${ring(v.fieldWin)}<div class="mu-head-text"><p class="eyebrow">Matchups</p><h2>${verdict(v.fieldWin)}</h2><p class="small muted">Expected wins against the ${v.field.length} most-played decks, weighted by how often you'll face each.${r.n ? ` Includes your ${r.n} logged game${r.n === 1 ? "" : "s"} with this list.` : ""}${v.earlier ? ` ${v.earlier} game${v.earlier === 1 ? "" : "s"} played with an earlier version of the list ${v.earlier === 1 ? "isn't" : "aren't"} counted.` : ""}</p>
    <div class="mu-chips">${best ? `<span class="mu-chip good">Best vs ${esc(best.name)} · ${pc(best.shown)}%</span>` : ""}${worst && worst !== best ? `<span class="mu-chip bad">Worst vs ${esc(worst.name)} · ${pc(worst.shown)}%</span>` : ""}${r.n ? `<span class="mu-chip">Your record ${rec(r)}</span>` : ""}</div></div></section>
  <div class="mu-logbar"><span class="small muted">Log games as</span><div class="seg mu-seg" role="tablist">${[["first", "Went first"], ["second", "Went second"]].map(([k, l]) => `<button role="tab" class="${(S.first === false ? "second" : "first") === k ? "on" : ""}" aria-selected="${(S.first === false ? "second" : "first") === k}" data-act="${P}First" data-v="${k}">${l}</button>`).join("")}</div></div>
  <div class="mu-list ${esc(v.game || "")}">${v.field.map((m, i) => row(P, m, i)).join("")}</div>
  <details class="panel mu-other"><summary>Log a game against another deck</summary><div class="mu-other-row"><input id="${P}OtherName" placeholder="Their deck (e.g. Mono Red)" aria-label="Opponent's deck" autocomplete="off"><div class="mu-log">${logButtons(P, "")}</div></div></details>
  ${v.history?.length ? `<details class="panel mu-hist"><summary>Your games <span class="muted small">${v.history.length}</span></summary><ol class="mu-games">${v.history.slice(0, 30).map((g) => `<li class="${g.res}"><b>${g.res === "W" ? "Won" : g.res === "L" ? "Lost" : "Draw"}</b> vs ${esc(g.opp)} <small class="muted">${g.first === false ? "on the draw" : "on the play"} · ${esc(new Date(g.at).toLocaleDateString())}${g.sig !== v.sig ? " · earlier list" : ""}</small><button class="link small" data-act="${P}Undo" data-at="${esc(g.at)}" aria-label="Remove this game">✕</button></li>`).join("")}</ol></details>` : ""}
  <p class="foot">${v.footNote ? esc(v.footNote) : `Simulated with ${esc(v.gameName)}'s own rules (${esc(v.modelNote)}), 2,000 games per matchup, half on the play. It's a model of both lists, not real match data: the games you log count for more as you add them, and the simulation counts as six games.`}</p>`;
}

// Commander pods: same parts as the one-on-one tab, measured against a 25% share.
function podTab(v, P, S, r, best, worst) {
  const sp = v.speed || {}, seat = v.seats || [];
  return `<section class="panel mu-head">${ring(v.fieldWin, 0.25)}<div class="mu-head-text"><p class="eyebrow">Commander pods</p><h2>${verdict(v.fieldWin, 0.25)}</h2><p class="small muted">Share of four-player pods won with three decks from Commander tournaments (cEDH) at the table, picked by how often they're played. 25% is an even share.${r.n ? ` Includes your ${r.n} logged pod${r.n === 1 ? "" : "s"}.` : ""}</p>
    <div class="mu-chips"><span class="mu-chip">Ends games around turn ${Math.round(sp.turn || 0)} · bracket ${sp.bracket ?? "?"}</span>${seat.length ? `<span class="mu-chip">Seat 1 ${pc(seat[0])}% · seat 4 ${pc(seat[3])}%</span>` : ""}${best ? `<span class="mu-chip good">Best with ${esc(best.name)} · ${pc(best.shown)}%</span>` : ""}${worst && worst !== best ? `<span class="mu-chip bad">Hardest with ${esc(worst.name)} · ${pc(worst.shown)}%</span>` : ""}${r.n ? `<span class="mu-chip">Your pods ${rec(r)}</span>` : ""}</div>
    ${(sp.bracket ?? 4) < 4 ? `<p class="small warn-text">These are tournament decks that usually win by turn 4–5. A bracket ${sp.bracket} deck isn't built for that table; log your own pods to see how it does at yours.</p>` : ""}</div></section>
  <div class="mu-list mtg">${v.field.map((m, i) => row(P, m, i, true)).join("")}</div>
  <details class="panel mu-other"><summary>Log a pod against other decks</summary><div class="mu-other-row"><input id="${P}OtherName" placeholder="The deck that won (or your pod)" aria-label="Opponent's deck" autocomplete="off"><div class="mu-log">${logButtons(P, "")}</div></div></details>
  ${v.history?.length ? `<details class="panel mu-hist"><summary>Your pods <span class="muted small">${v.history.length}</span></summary><ol class="mu-games">${v.history.slice(0, 30).map((g) => `<li class="${g.res}"><b>${g.res === "W" ? "Won" : g.res === "L" ? "Lost" : "Draw"}</b> vs ${esc(g.opp)} <small class="muted">${esc(new Date(g.at).toLocaleDateString())}${g.sig !== v.sig ? " · earlier list" : ""}</small><button class="link small" data-act="${P}Undo" data-at="${esc(g.at)}" aria-label="Remove this game">✕</button></li>`).join("")}</ol></details>` : ""}
  <p class="foot">Simulated pods (${esc(v.modelNote)}), 3,000 per run, seats shuffled. Each tournament deck is calibrated to win about its share against the rest of the field. It's a model, not match data: the pods you log count for more as you add them.</p>`;
}

const logButtons = (P, opp) => `<button class="btn small mu-w" data-act="${P}Log" data-opp="${esc(opp)}" data-res="W">I won</button><button class="btn ghost small mu-l" data-act="${P}Log" data-opp="${esc(opp)}" data-res="L">I lost</button><button class="btn ghost small mu-d" data-act="${P}Log" data-opp="${esc(opp)}" data-res="D">Draw</button>`;

function row(P, m, i, pod = false) {
  const w = m.shown, t = tone(w, pod ? 0.25 : 0.5);
  return `<details class="mu-row ${t}" style="--i:${i};--w:${pc(w)}%" ${m.open ? "open" : ""} data-opp="${esc(m.name)}">
    <summary>${m.art ? `<img class="mu-art" src="${esc(m.art)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'mu-art blank',textContent:'${esc(m.name.slice(0, 1))}'}))">` : `<span class="mu-art blank">${esc(m.name.slice(0, 1))}</span>`}
      <span class="mu-name"><b>${esc(m.name)}</b><small>${pc(m.share)}% of the field${m.rec.n ? ` · you <span class="mu-rec-chip">${rec(m.rec)}</span>` : ""}</small><i class="mu-bar"><span></span></i></span>
      <span class="mu-pct"><b>${pc(w)}%</b><small>${m.rec.n ? "blended" : pod ? "of pods" : "to win"}</small></span></summary>
    <div class="mu-body">
      ${m.key ? `<button class="mu-see" data-act="${P}See" data-key="${esc(m.key)}" ${m.format ? `data-format="${esc(m.format)}"` : ""}><span class="mu-see-art">${m.art ? `<img src="${esc(m.art)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}</span><span><b>See their deck</b><small>The ${esc(m.name)} list this matchup is played against</small></span><i aria-hidden="true">›</i></button>` : ""}
      ${pod ? `<div class="mu-split"><span>With them at the table<b>${pc(m.sim.win)}%</b></span><span>Even share<b>25%</b></span><span>${m.rec.n ? "Your pods" : "Field share"}<b>${m.rec.n ? rec(m.rec) : pc(m.share) + "%"}</b></span></div>` : `<div class="mu-split"><span>On the play<b>${pc(m.sim.onPlay)}%</b></span><span>On the draw<b>${pc(m.sim.onDraw)}%</b></span><span>${m.rec.n ? "Your games" : m.sim.real?.n ? "Real games" : m.sim.real ? "Estimate" : "Simulated"}<b>${m.rec.n ? rec(m.rec) : m.sim.real?.n ? `${m.sim.real.w}–${m.sim.real.n - m.sim.real.w}` : pc(m.sim.win) + "%"}</b></span></div>`}
      <ul class="mu-why">${m.sim.reasons.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      ${planHtml(m.plan, m.sim.win)}
      <div class="mu-log">${logButtons(P, m.name)}</div>
    </div></details>`;
}

function planHtml(p, sim) {
  if (!p) return "";
  if (p.kind === "prize") return `<div class="mu-plan"><p class="mu-plan-h">Prize plan</p><ul>${p.lines.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
  if (p.empty) return `<div class="mu-plan dim"><p class="mu-plan-h">Sideboard plan</p><p class="small muted">Add a sideboard to this deck to get a swap plan for each matchup.</p></div>`;
  if (!p.ins.length) return `<div class="mu-plan dim"><p class="mu-plan-h">Sideboard plan</p><p class="small muted">${p.worse ? "Siding in your targeted cards tests worse here than your main deck: keep the main deck." : "Nothing in your sideboard targets this deck: play the main deck as is."}</p></div>`;
  const chips = (xs, cls) => xs.map((x) => `<span class="mu-swap ${cls}" title="${esc(x.why)}"><b>${x.qty}×</b> ${esc(x.name)}<small>${esc(x.why)}</small></span>`).join("");
  return `<div class="mu-plan"><p class="mu-plan-h">Sideboard plan${p.after != null ? ` <span class="mu-delta ${p.after > sim + 0.005 ? "up" : p.after < sim - 0.005 ? "down" : ""}">${pc(sim)}% → ${pc(p.after)}%</span>` : ""}</p><div class="mu-io"><div><small class="ok-text">IN</small>${chips(p.ins, "in")}</div><div><small class="bad-text">OUT</small>${chips(p.outs, "out")}</div></div></div>`;
}

const skeleton = () => `<div class="mu-list">${[0, 1, 2, 3].map((i) => `<div class="mu-row skel" style="--i:${i}"><span class="mu-art blank"></span><span class="mu-name"><b></b><small></small></span></div>`).join("")}</div>`;

// A small burst from the button you tapped, for a logged win.
export function celebrate(el) {
  if (!el || typeof document === "undefined" || matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const r = el.getBoundingClientRect(), box = document.createElement("div");
  box.className = "mu-burst";
  box.style.left = r.left + r.width / 2 + "px";
  box.style.top = r.top + r.height / 2 + "px";
  for (let i = 0; i < 12; i++) {
    const s = document.createElement("i"), a = (i / 12) * Math.PI * 2;
    s.style.setProperty("--x", Math.cos(a) * (36 + (i % 3) * 12) + "px");
    s.style.setProperty("--y", Math.sin(a) * (36 + (i % 3) * 12) + "px");
    box.append(s);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 900);
}

// The field's profiles are small; keep them per field (game, format, tournament data time) so the
// tab opens instantly after the first run.
const FIELD_KEY = "cardstashy-mu-field:";
export const fieldStore = {
  get(key) {
    // Fields saved before each opponent kept its list key are re-simulated (so "See their deck" works).
    try { const v = JSON.parse(localStorage.getItem(FIELD_KEY + key) || "null"); return Array.isArray(v) && v.every((f) => f.key && f.bias != null) ? v : null; } catch { return null; }
  },
  set(key, field) {
    try {
      // One copy per game and format: drop the ones from older tournament data. Keys are "game:format|time".
      const base = FIELD_KEY + key.split("|")[0] + "|";
      for (const k of Object.keys(localStorage)) if (k.startsWith(base) && k !== FIELD_KEY + key) localStorage.removeItem(k);
      localStorage.setItem(FIELD_KEY + key, JSON.stringify(field));
    } catch {}
  },
};

// Every deck in the field is placing in real events, so none of them really loses to almost
// everything. When the model has one far below 50% against the rest of the field, that's the model
// missing how it wins (a combo kill the goldfish can't see); half of that gap is corrected.
export function calibrateField(field, simulate) {
  for (const f of field) {
    let tot = 0, w = 0;
    for (const g of field) {
      if (g === f) continue;
      const s = simulate(f.profile, g.profile, { runs: 600 });
      if (s) { tot += s.win * (g.share || 0.01); w += g.share || 0.01; }
    }
    f.bias = w ? Math.max(-0.35, Math.min(0.35, 0.5 - tot / w)) : 0;
  }
  return field;
}
// Everything the tab needs from a deck's own profile and the field, memoised per deck + field +
// list, so re-renders (logging a game) don't re-simulate. myBias: the calibration of the field
// archetype this deck is a copy of (0 when it isn't one).
const memo = new Map();
const clamp01 = (x) => Math.max(0.03, Math.min(0.97, x));
export function computeMatchups(sig, field, me, planFor, simulate, myBias = 0) {
  sig += "|" + myBias.toFixed(3);
  if (memo.has(sig)) return memo.get(sig);
  const out = field.map((f) => {
    let sim = simulate(me, f.profile);
    const shift = (myBias - (f.bias || 0)) / 2;
    if (sim && Math.abs(shift) > 0.005)
      sim = { ...sim, win: clamp01(sim.win + shift), onPlay: clamp01(sim.onPlay + shift), onDraw: clamp01(sim.onDraw + shift), reasons: [...sim.reasons, `Adjusted ${shift > 0 ? "up" : "down"} ${Math.round(Math.abs(shift) * 100)} points for how these archetypes actually do against the field (the model can't see every way a deck wins).`] };
    return { ...f, sim, plan: sim ? planFor(f.profile, sim.win) : null };
  }).filter((x) => x.sim);
  memo.set(sig, out);
  if (memo.size > 12) memo.delete(memo.keys().next().value);
  return out;
}
