// Price history keeps moves and weekly points only; alerts fire once a day when crossed.
import assert from "node:assert/strict";
globalThis.localStorage = { m: {}, getItem(k) { return this.m[k] ?? null; }, setItem(k, v) { this.m[k] = String(v); } };
const P = await import("./pricehist.js");
const t = (d) => Date.parse(d + "T12:00:00Z");
P.recordPrice("ptcg", "sv04-058", 3.0, "Mewtwo ex", t("2026-10-01"));
P.recordPrice("ptcg", "sv04-058", 3.02, "Mewtwo ex", t("2026-10-02")); // < 2%: skipped
P.recordPrice("ptcg", "sv04-058", 3.5, "Mewtwo ex", t("2026-10-03")); // moved
P.recordPrice("ptcg", "sv04-058", 3.5, "Mewtwo ex", t("2026-10-11")); // a week later: kept
const s = P.priceSeries("ptcg", "sv04-058");
assert.deepEqual(s.map((x) => x[0]), ["2026-10-01", "2026-10-03", "2026-10-11"]);
const ch = P.priceChange(s);
assert.equal(Math.round(ch.pct), 17);
assert.match(P.sparkline(s), /<svg class="spark up"/);
assert.equal(P.priceChange([["2026-10-01", 1]]), null);
let heard = [];
P.onAlert((f) => heard.push(P.alertText(f)));
P.setAlert("ptcg", "sv04-058", "Mewtwo ex", { below: 3.0 });
P.recordPrice("ptcg", "sv04-058", 2.9, "Mewtwo ex", t("2026-10-12"));
P.recordPrice("ptcg", "sv04-058", 2.5, "Mewtwo ex", t("2026-10-12")); // same day: no repeat
assert.equal(heard.length, 1);
assert.match(heard[0], /Mewtwo ex: now \$2\.90 \(below your \$3\)/);
P.setAlert("ptcg", "sv04-058", "", {});
assert.equal(P.alertFor("ptcg", "sv04-058"), null, "removed");
assert.deepEqual(P.recordPrice("mtg", "x", null), [], "no price, nothing recorded");
console.log("PASS: price history and alerts.");
