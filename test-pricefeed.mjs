// Shared price history: rows keep finish/source separate, merging never mixes origins wrongly,
// and the Worker routes refuse bad input and skip recording without the secret.
import assert from "node:assert/strict";
import { mtgRows, ygoRows, watchRoute, recordDailyPrices, MTG_SOURCE } from "./pricefeed.js";
import { mergePoints } from "./sharedprices.js";
const day = "2026-10-13";
const rows = mtgRows({ id: "abc", prices: { usd: "1.234", usd_foil: "4.5", usd_etched: null } }, day);
assert.deepEqual(rows.map((r) => [r.finish, r.price, r.source]), [["nonfoil", 1.23, MTG_SOURCE], ["foil", 4.5, MTG_SOURCE]]);
assert.deepEqual(ygoRows({ id: 89631139, card_prices: [{ tcgplayer_price: "0.30" }] }, day).map((r) => [r.card_id, r.finish, r.price]), [["89631139", "reference", 0.3]]);
assert.equal(ygoRows({ id: 1, card_prices: [{ tcgplayer_price: "0.00" }] }, day).length, 0, "no zero prices");
const merged = mergePoints([{ date: "2026-10-01", value: 2 }, { date: "2026-10-02", value: 3 }], [{ date: "2026-10-02", value: 3.1 }, { date: "2026-09-30", value: 1.9 }]);
assert.deepEqual(merged.map((p) => [p.date, p.value, p.origin]), [["2026-09-30", 1.9, "daily"], ["2026-10-01", 2, "device"], ["2026-10-02", 3.1, "daily"]]);
const req = (body, method = "POST") => ({ method, json: async () => body });
assert.equal((await (await watchRoute(req({ game: "mtg", ids: ["a"] }), {})).json()).error, "not_configured");
assert.equal((await watchRoute(req({ game: "chess", ids: ["a"] }), { SUPABASE_SERVICE_KEY: "x" })).status, 400);
assert.equal((await watchRoute(req({}, "GET"), {})).status, 405);
assert.deepEqual(await recordDailyPrices({}), { skipped: "not_configured" });
console.log("PASS: shared price history rows, merge, route validation and safe skip without the secret.");
