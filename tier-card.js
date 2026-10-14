// One deck-version card for the Build decks sheet in every game. Each game supplies its own logic
// (format, legality, size rules, card groups); the layout, order and wording are shared.
import { esc, usd, bar } from "./ui.js";

// v: { title, format, legal: {ok, text}, cost, unknown, difficulty, power, sizeText, extraText,
//      owned (0..1), notes (html), open, groups: [{ name, rows: [{ qty, name, art, act, why, status, ok }] }],
//      toggle (attrs), save (attrs), saveLabel, evidence, warnings: [] }
export function tierCardHtml(v) {
  const total = v.groups.reduce((a, g) => a + g.rows.reduce((b, r) => b + r.qty, 0), 0);
  return `<article class="tier ${v.open ? "on" : ""}">
    <div class="row between tier-head"><b>${v.title}</b><span class="tier-chips"><span class="chip">${esc(v.format)}</span><span class="chip ${v.legal.ok ? "ok" : "warn"}">${esc(v.legal.text)}</span></span></div>
    <div class="tier-stats"><span><b>${usd(v.cost)}${v.unknown ? "+" : ""}</b> to buy</span>${v.power != null ? `<span title="${v.powerKind === "comp" ? "Competitive: how it stacks up against what's winning now" : "Deck Power"}"><b>${v.power}</b> ${v.powerKind === "comp" ? "comp." : "power"}${v.powerKind === "comp" && v.engine != null && v.engine !== v.power ? ` <small class="muted">· engine ${v.engine}</small>` : ""}</span>` : ""}${v.difficulty ? `<span><b class="diff-tag ${v.difficulty.key}">${v.difficulty.label}</b></span>` : ""}<span><b>${esc(v.sizeText)}</b></span>${v.extraText ? `<span><b>${esc(v.extraText)}</b></span>` : ""}<span><b>${Math.round((v.owned || 0) * 100)}%</b> owned</span></div>
    ${bar(v.owned || 0, "thin")}
    ${v.evidence ? `<p class="evidence small">${esc(v.evidence)}</p>` : ""}${(v.warnings || []).map((w) => `<p class="small warn-text">${esc(w)}</p>`).join("")}
    ${v.notes || ""}
    ${v.open ? v.groups.filter((g) => g.rows.length).map((g) => `<p class="list-head">${esc(g.name)} <span class="muted">${g.rows.reduce((a, r) => a + r.qty, 0)}</span></p><div class="list compact">${g.rows.map((r) => `<button class="mini-row upgrade-card-row" ${r.act}>${r.art}<span class="ellip">${r.qty}× ${esc(r.name)}${r.why ? ` <small class="muted">${esc(r.why)}</small>` : ""}</span><span class="small ${r.ok ? "ok-text" : "warn-text"}">${esc(r.status)}</span></button>`).join("")}</div>`).join("") : ""}
    <div class="actions wrap"><button class="btn ghost small" ${v.toggle}>${v.open ? "Hide list" : `See all ${total} cards`}</button><button class="btn small" ${v.save}>${esc(v.saveLabel || "Save as deck")}</button></div>
  </article>`;
}
