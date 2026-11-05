// Checks scripts/web-locale-prelude.js (the QuickJS bundles' en-US formatting) against Node's ICU.
// node scripts/test-web-locale.mjs
const RealNF = Intl.NumberFormat, realDate = Date.prototype.toLocaleDateString;
const RealDTF = Intl.DateTimeFormat;
const {__NumberFormat: NF, __dateString: dateString, __DateTimeFormat: DTF} = await import('./web-locale-prelude.js');
let bad = 0, n = 0;
const check = (label, got, want) => { n++; if (got !== want && bad++ < 25) console.log('MISMATCH', label, JSON.stringify(got), 'want', JSON.stringify(want)); };
const options = [undefined, {}, {minimumFractionDigits: 2, maximumFractionDigits: 2}, {minimumFractionDigits: 0, maximumFractionDigits: 0}, {maximumFractionDigits: 1},
  {minimumFractionDigits: 4}, {style: 'currency', currency: 'USD'}, {style: 'percent'}, {useGrouping: false}, {minimumFractionDigits: 1, maximumFractionDigits: 3}];
const values = [0, -0, 1, -1, 0.5, 1.005, 2.675, 1.995, 9.995, 999.995, 1234.5, 1234567.891, 0.0001234, 1e21, 123456789012345680000, 5e-7, -1234.565, 0.045, 0.125, NaN, Infinity, -Infinity];
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let i = 0; i < 4000; i++) values.push(Math.round((rnd() - 0.3) * 10 ** Math.floor(rnd() * 9) * 1000) / 10 ** Math.floor(rnd() * 6));
for (const o of options) { const a = new NF('en-US', o), b = new RealNF('en-US', o); for (const v of values) check(`${v} ${JSON.stringify(o)}`, a.format(v), b.format(v)); }
const dateOpts = [undefined, {month: 'short', day: 'numeric', year: 'numeric'}, {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'}, {month: 'long', day: 'numeric'},
  {month: 'short', year: 'numeric'}, {weekday: 'short', month: 'short', day: 'numeric'}, {year: 'numeric', month: '2-digit', day: '2-digit'}, {weekday: 'long'}];
for (let i = 0; i < 600; i++) { const d = new Date(Date.UTC(1995, 0, 1) + Math.floor(rnd() * 40 * 365 * 864e5)); for (const o of dateOpts) check(`${d.toISOString()} ${JSON.stringify(o)}`, dateString(d, o), realDate.call(d, 'en-US', o)); }
for (const s of ['2026-11-04', '2026-01-31']) { const o = {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'}; check(s, dateString(new Date(s), o), realDate.call(new Date(s), 'en-US', o)); }
// daily-clock.js: en-CA fields in America/New_York, with the zone's offsets as the app's host gives them (here from ICU, hour by hour).
const zone = 'America/New_York', rows = [], offAt = ms => { const p = Object.fromEntries(new RealDTF('en-CA', {timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'}).formatToParts(new Date(ms)).map(x => [x.type, x.value])); return Math.round((Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ms) / 60000); };
for (let ms = Date.UTC(2024, 0, 1); ms < Date.UTC(2029, 0, 1); ms += 3600e3) { const o = offAt(ms); if (!rows.length || rows.at(-1)[1] !== o) rows.push([rows.length ? ms - 3600e3 + 1 : ms, o]); }
// Pin each change to the exact minute.
for (const r of rows.slice(1)) { let lo = r[0] - 1, hi = r[0] + 3600e3; while (hi - lo > 1000) { const mid = Math.floor((lo + hi) / 2); if (offAt(mid) === r[1]) hi = mid; else lo = mid; } r[0] = Math.ceil(hi / 1000) * 1000; }
globalThis.__tz = {[zone]: rows};
const dtfOpts = [{timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit'}, {timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'}];
for (let i = 0; i < 3000; i++) { const ms = Date.UTC(2024, 1, 1) + Math.floor(rnd() * 4 * 365 * 864e5); for (const o of dtfOpts) { check(`${new Date(ms).toISOString()} ${JSON.stringify(o)}`, JSON.stringify(new DTF('en-CA', o).formatToParts(new Date(ms))), JSON.stringify(new RealDTF('en-CA', o).formatToParts(new Date(ms)))); } }
for (const r of rows.slice(1)) for (const d of [-60e3, 0, 60e3]) check(`edge ${new Date(r[0] + d).toISOString()}`, new DTF('en-CA', dtfOpts[1]).format(r[0] + d), new RealDTF('en-CA', dtfOpts[1]).format(r[0] + d));
console.log(`${n - bad}/${n} match ICU en-US`);
process.exit(bad ? 1 : 0);
