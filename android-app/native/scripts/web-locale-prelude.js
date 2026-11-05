// The browser's en-US number and date formatting for the QuickJS bundles (QuickJS has no Intl): what the site's
// usd(), toLocaleString() and toLocaleDateString() print in an English browser. Checked against Node's ICU by
// scripts/test-web-locale.mjs. Only the options the bundled site code passes are supported; any other option
// throws, so a new use shows up in the export instead of printing something the site would not.
const NUMBER_KEYS = new Set(['style', 'currency', 'minimumFractionDigits', 'maximumFractionDigits', 'useGrouping']);
const SYMBOLS = {USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'CA$', AUD: 'A$'};
const DIGITS = {JPY: 0};

function decimal(n, minF, maxF, shift = 0) {
  // The shortest digits that read back as n (what ICU rounds), then half away from zero at maxF.
  let [mant, exp = '0'] = String(n).split('e'), [int, frac = ''] = mant.split('.'), digits = int + frac, point = int.length + Number(exp) + shift;
  if (point < 0) { digits = '0'.repeat(-point) + digits; point = 0; }
  if (point > digits.length) digits += '0'.repeat(point - digits.length);
  int = digits.slice(0, point) || '0'; frac = digits.slice(point);
  if (frac.length > maxF) {
    const up = frac[maxF] >= '5'; frac = frac.slice(0, maxF);
    if (up) {
      const all = (int + frac).split('').map(Number); let k = all.length - 1;
      for (; k >= 0; k--) { if (all[k] === 9) all[k] = 0; else { all[k]++; break; } }
      if (k < 0) all.unshift(1);
      const t = all.join(''); int = t.slice(0, t.length - frac.length); frac = t.slice(t.length - frac.length);
    }
  }
  frac = frac.replace(/0+$/, ''); while (frac.length < minF) frac += '0';
  return {int: int.replace(/^0+(?=\d)/, ''), frac};
}

class NumberFormat {
  constructor(locales, options = {}) {
    for (const k of Object.keys(options || {})) if (!NUMBER_KEYS.has(k)) throw new RangeError(`NumberFormat option ${k} is not supported in the app`);
    const o = options || {}, style = o.style || 'decimal';
    if (!['decimal', 'currency', 'percent'].includes(style)) throw new RangeError(`NumberFormat style ${style} is not supported in the app`);
    const cur = style === 'currency' ? String(o.currency || '').toUpperCase() : '';
    if (style === 'currency' && !cur) throw new TypeError('Currency code is required with currency style.');
    const cd = cur ? (DIGITS[cur] ?? 2) : 0, mnDefault = style === 'currency' ? cd : 0, mxDefault = style === 'currency' ? cd : style === 'percent' ? 0 : 3;
    let mn = o.minimumFractionDigits, mx = o.maximumFractionDigits;
    if (mn !== undefined) mn = Math.floor(Number(mn)); if (mx !== undefined) mx = Math.floor(Number(mx));
    if (mn === undefined && mx === undefined) { mn = mnDefault; mx = mxDefault; }
    else if (mn === undefined) mn = Math.min(mnDefault, mx);
    else if (mx === undefined) mx = Math.max(mxDefault, mn);
    if (!(mn >= 0 && mn <= 100 && mx >= 0 && mx <= 100) || mn > mx) throw new RangeError('maximumFractionDigits value is out of range.');
    this.o = {style, cur, mn, mx, group: o.useGrouping !== false && o.useGrouping !== 'false'};
  }
  format(value) {
    let n = Number(value); const {style, cur, mn, mx, group} = this.o;
    const neg = n < 0 || Object.is(n, -0); n = Math.abs(n);
    let body;
    if (Number.isNaN(n)) body = 'NaN';
    else if (n === Infinity) body = '∞';
    else {
      const d = decimal(n, mn, mx, style === 'percent' ? 2 : 0);
      body = (group ? d.int.replace(/\B(?=(\d{3})+$)/g, ',') : d.int) + (d.frac ? '.' + d.frac : '');
    }
    if (style === 'percent') body += '%';
    if (style === 'currency') body = (SYMBOLS[cur] || cur + ' ') + body;
    return (neg ? '-' : '') + body;
  }
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DATE_KEYS = new Set(['weekday', 'year', 'month', 'day', 'timeZone']);
function dateString(date, options) {
  const o = options || {};
  for (const k of Object.keys(o)) if (!DATE_KEYS.has(k)) throw new RangeError(`Date option ${k} is not supported in the app`);
  if (o.timeZone !== undefined && !/^(UTC|Etc\/UTC|GMT)$/i.test(o.timeZone)) throw new RangeError(`Time zone ${o.timeZone} is not supported in the app`);
  const t = date.getTime(); if (!Number.isFinite(t)) return 'Invalid Date';
  const utc = o.timeZone !== undefined, y = utc ? date.getUTCFullYear() : date.getFullYear(), m = utc ? date.getUTCMonth() : date.getMonth(),
    d = utc ? date.getUTCDate() : date.getDate(), w = utc ? date.getUTCDay() : date.getDay();
  const none = !o.weekday && !o.year && !o.month && !o.day, year = none ? 'numeric' : o.year, month = none ? 'numeric' : o.month, day = none ? 'numeric' : o.day;
  const yy = year === '2-digit' ? String(y % 100).padStart(2, '0') : year ? String(y) : '', dd = day === '2-digit' ? String(d).padStart(2, '0') : day ? String(d) : '';
  const wd = o.weekday === 'long' ? WEEKDAYS[w] : o.weekday === 'short' ? WEEKDAYS[w].slice(0, 3) : o.weekday === 'narrow' ? WEEKDAYS[w][0] : '';
  let out;
  if (month === 'numeric' || month === '2-digit') {
    const mm = month === '2-digit' ? String(m + 1).padStart(2, '0') : String(m + 1);
    out = [mm, dd, yy].filter(Boolean).join('/');
  } else if (month) {
    const name = month === 'long' ? MONTHS[m] : month === 'narrow' ? MONTHS[m][0] : MONTHS[m].slice(0, 3);
    out = dd && yy ? `${name} ${dd}, ${yy}` : dd ? `${name} ${dd}` : yy ? `${name} ${yy}` : name;
  } else out = [dd, yy].filter(Boolean).join(', ');
  return wd ? (out ? `${wd}, ${out}` : wd) : out;
}

// Intl.DateTimeFormat as daily-clock.js uses it: en-CA numeric fields in a named time zone. A zone's UTC offsets come from
// the device's own time zone rules: the host sets globalThis.__tz = {zone: [[fromMs, offsetMinutes], …]} (CollectionEngine.kt).
const DTF_KEYS = new Set(['timeZone', 'year', 'month', 'day', 'hour', 'minute', 'second', 'hourCycle']);
class DateTimeFormat {
  constructor(locales, options = {}) {
    const o = options || {}, locale = Array.isArray(locales) ? locales[0] : locales;
    for (const k of Object.keys(o)) if (!DTF_KEYS.has(k)) throw new RangeError(`DateTimeFormat option ${k} is not supported in the app`);
    if (locale !== 'en-CA') throw new RangeError(`DateTimeFormat locale ${locale} is not supported in the app`);
    if (o.hour && o.hourCycle !== 'h23') throw new RangeError('DateTimeFormat needs hourCycle h23 in the app');
    for (const k of ['year', 'month', 'day', 'hour', 'minute', 'second']) if (o[k] && o[k] !== 'numeric' && o[k] !== '2-digit') throw new RangeError(`DateTimeFormat ${k}: ${o[k]} is not supported in the app`);
    const zone = o.timeZone;
    if (zone !== undefined && !/^(UTC|Etc\/UTC|GMT)$/i.test(zone) && !/^[A-Za-z_]+\/[A-Za-z_\/]+$/.test(zone)) throw new RangeError(`Invalid time zone specified: ${zone}`);
    this.o = {...o, zone};
  }
  offset(ms) {
    const zone = this.o.zone;
    if (zone === undefined) return -new Date(ms).getTimezoneOffset();
    if (/^(UTC|Etc\/UTC|GMT)$/i.test(zone)) return 0;
    const rows = globalThis.__tz?.[zone];
    if (!rows?.length) throw new RangeError(`Time zone ${zone} has no rules in the app`);
    let off = rows[0][1]; for (const [from, minutes] of rows) { if (from <= ms) off = minutes; else break; }
    return off;
  }
  formatToParts(date = Date.now()) {
    const ms = date instanceof Date ? date.getTime() : Number(date);
    if (!Number.isFinite(ms)) throw new RangeError('Invalid time value');
    const t = new Date(ms + this.offset(ms) * 60000), o = this.o, two = n => String(n).padStart(2, '0'), out = [];
    const field = (type, n, style) => out.push({type, value: style === '2-digit' ? two(n) : String(n)});
    const lit = v => out.push({type: 'literal', value: v});
    if (o.year) field('year', t.getUTCFullYear(), 'numeric');
    if (o.month) { if (out.length) lit('-'); field('month', t.getUTCMonth() + 1, o.month); }
    if (o.day) { if (out.length) lit('-'); field('day', t.getUTCDate(), o.day); }
    if (o.hour || o.minute || o.second) {
      if (out.length) lit(', ');
      const time = [o.hour && ['hour', t.getUTCHours(), o.hour], o.minute && ['minute', t.getUTCMinutes(), '2-digit'], o.second && ['second', t.getUTCSeconds(), '2-digit']].filter(Boolean);
      time.forEach(([type, n, style], i) => { if (i) lit(':'); field(type, n, style); });
    }
    return out;
  }
  format(date) { return this.formatToParts(date).map(p => p.value).join(''); }
}

// Intl.Collator as collection-sort.js builds it (en, numeric, sensitivity base): letters compare without case or accents,
// digit runs by their value, and æ œ ß ø read as ae oe ss o (Æther cards). As in ICU's root order, everything that is neither a letter nor a digit (spaces,
// punctuation, symbols such as the ★ on promo numbers) sorts before digits, and digits before letters; inside each of
// those groups characters keep code point order.
const COLLATOR_KEYS = new Set(['numeric', 'sensitivity']);
const LIGATURES = {'æ': 'ae', 'œ': 'oe', 'ß': 'ss', 'ø': 'o'};
const fold = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[æœßø]/g, c => LIGATURES[c]);
const isDigit = c => c >= '0' && c <= '9';
const group = c => isDigit(c) ? 1 : /\p{L}/u.test(c) ? 2 : 0;
class Collator {
  constructor(locales, options = {}) {
    for (const k of Object.keys(options || {})) if (!COLLATOR_KEYS.has(k)) throw new RangeError(`Collator option ${k} is not supported in the app`);
    if (options.sensitivity && options.sensitivity !== 'base') throw new RangeError('Collator sensitivity ' + options.sensitivity + ' is not supported in the app');
    const numeric = !!options.numeric;
    this.compare = (a, b) => {
      const x = [...fold(a)], y = [...fold(b)];
      let i = 0, j = 0;
      while (i < x.length && j < y.length) {
        const c = x[i], d = y[j];
        if (numeric && isDigit(c) && isDigit(d)) {
          let e = i, f = j;
          while (e < x.length && isDigit(x[e])) e++;
          while (f < y.length && isDigit(y[f])) f++;
          const p = x.slice(i, e).join('').replace(/^0+(?=\d)/, ''), q = y.slice(j, f).join('').replace(/^0+(?=\d)/, '');
          if (p.length !== q.length) return p.length < q.length ? -1 : 1;
          if (p !== q) return p < q ? -1 : 1;
          i = e; j = f; continue;
        }
        if (c !== d) { const g = group(c), h = group(d); return g !== h ? (g < h ? -1 : 1) : c < d ? -1 : 1; }
        i++; j++;
      }
      return i < x.length ? 1 : j < y.length ? -1 : 0;
    };
  }
  resolvedOptions() { return {locale: 'en', sensitivity: 'base', numeric: true}; }
}

// String.prototype.localeCompare(that, locales, options): QuickJS ignores both and compares code points, so the site's
// set order (set-list-ui.js filterSortSetCards, numeric) came out 1, 10, 100, 101 … 2. Options the Collator above knows run
// through it (a tie under any sensitivity but base falls back to the plain compare, as ICU's variant strength would split
// it, with leading zeros still ignored when numeric); a call without options keeps QuickJS's own compare.
const plainCompare = String.prototype.localeCompare;
function localeCompare(that, locales, options) {
  if (options && typeof options === 'object' && Object.keys(options).every(k => COLLATOR_KEYS.has(k)) && (!options.sensitivity || options.sensitivity === 'base')) {
    const c = new Collator(locales, {numeric: !!options.numeric, sensitivity: 'base'}).compare(String(this), String(that));
    if (c || options.sensitivity === 'base') return c;
    if (options.numeric) { const z = v => String(v).replace(/\d+/g, n => n.replace(/^0+(?=\d)/, '')); return plainCompare.call(z(this), z(that)); }
  }
  return plainCompare.call(this, that);
}
String.prototype.localeCompare = localeCompare;

const intl = typeof globalThis.Intl === 'object' && globalThis.Intl ? globalThis.Intl : {};
globalThis.Intl = Object.assign({}, intl, {NumberFormat, DateTimeFormat, Collator});
Number.prototype.toLocaleString = function (locales, options) { return new NumberFormat(locales, options).format(this); };
Date.prototype.toLocaleDateString = function (locales, options) { return dateString(this, options); };
export {NumberFormat as __NumberFormat, dateString as __dateString, DateTimeFormat as __DateTimeFormat, Collator as __Collator, localeCompare as __localeCompare};
