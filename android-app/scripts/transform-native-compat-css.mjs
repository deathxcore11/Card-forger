// Older Android System WebViews (Chromium before 111; the AYN Odin 2 Portal ships 109) drop every
// declaration that uses color-mix(), so panels lose their background or show an unmixed colour (the
// home search bar turned solid gold). After each rule that uses it, this adds the same rule again
// inside @supports not (color-mix), with each color-mix(in srgb, A p%, B) replaced by whichever of
// A or B carries the larger share. A current WebView fails that @supports test and never reads the
// copy, so phones like the Galaxy Fold render exactly as before. Pure text in, text out.
const SUPPORTS = '@supports not (color:color-mix(in srgb,red,red))';

// Index just past the bracket that closes the one opened at `open` (strings and comments skipped).
function closeOf(text, open) {
  const pairs = { '(': ')', '{': '}', '[': ']' }, stack = [pairs[text[open]]];
  for (let i = open + 1; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'") { i = endOfString(text, i); continue; }
    if (c === '/' && text[i + 1] === '*') { i = text.indexOf('*/', i + 2); if (i < 0) return text.length; i++; continue; }
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === stack[stack.length - 1]) { stack.pop(); if (!stack.length) return i + 1; }
  }
  return text.length;
}
function endOfString(text, at) {
  for (let i = at + 1; i < text.length; i++) { if (text[i] === '\\') { i++; continue; } if (text[i] === text[at]) return i; }
  return text.length;
}
// Split on a separator at bracket depth 0.
function splitTop(text, sep) {
  const out = []; let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'") { i = endOfString(text, i); continue; }
    if (c === '(' || c === '[') depth++; else if (c === ')' || c === ']') depth--;
    else if (c === sep && depth === 0) { out.push(text.slice(start, i)); start = i + 1; }
  }
  out.push(text.slice(start));
  return out;
}

// color-mix(in srgb, A [p%], B [q%]) -> the colour with the larger share (A on a tie), innermost first.
export function unmix(value) {
  let guard = 0;
  for (;;) {
    const at = value.lastIndexOf('color-mix(');
    if (at < 0 || guard++ > 200) return value;
    const end = closeOf(value, at + 'color-mix'.length);
    const args = splitTop(value.slice(at + 'color-mix('.length, end - 1), ',').map(s => s.trim());
    const parts = args.slice(1).map(s => { const m = s.match(/^(.*?)\s+(\d*\.?\d+)%$/s) || s.match(/^(\d*\.?\d+)%\s+(.*)$/s); return m ? (m[2] && /%$/.test(s) ? { color: m[1].trim(), p: +m[2] } : { color: m[2].trim(), p: +m[1] }) : { color: s, p: null }; });
    let pick = parts[0]?.color || 'transparent';
    if (parts.length === 2) {
      const [a, b] = parts, pa = a.p ?? (b.p == null ? 50 : 100 - b.p), pb = b.p ?? 100 - pa;
      pick = pb > pa ? b.color : a.color;
    }
    value = value.slice(0, at) + pick + value.slice(end);
  }
}

// Declarations of one rule body that use color-mix, rewritten; '' when there are none.
function fallbackBody(body) {
  const out = [];
  for (const decl of splitTop(body, ';')) {
    if (!decl.includes('color-mix(')) continue;
    const colon = decl.indexOf(':');
    if (colon < 0) continue;
    out.push(decl.slice(0, colon).trim() + ':' + unmix(decl.slice(colon + 1).trim()));
  }
  return out.join(';');
}

// Unprefixed CSS masks arrived in Chromium 120; older WebViews only read -webkit-mask*. A rule that
// sets only the standard properties (the gold edge rings cut out with mask-composite: exclude) would
// paint its whole gradient as a solid block there, so it gets the -webkit- spelling, guarded the same way.
const MASK_SUPPORTS = '@supports not (mask-composite:exclude)';
const COMPOSITE = { add: 'source-over', subtract: 'source-out', intersect: 'source-in', exclude: 'xor' };
function maskBody(body) {
  if (!/(^|[;{\s])mask(-image|-composite|-size|-position|-repeat|-origin|-clip|-mode)?\s*:/.test(body)) return '';
  const decls = splitTop(body, ';').map(d => { const c = d.indexOf(':'); return c < 0 ? null : [d.slice(0, c).trim().toLowerCase(), d.slice(c + 1).trim()]; }).filter(Boolean);
  if (decls.some(([p]) => p.startsWith('-webkit-mask'))) return '';
  const out = [];
  for (const [prop, value] of decls) {
    if (!/^mask(-image|-composite|-size|-position|-repeat|-origin|-clip)?$/.test(prop)) continue;
    if (prop === 'mask-composite') out.push('-webkit-mask-composite:' + value.replace(/\b(add|subtract|intersect|exclude)\b/g, k => COMPOSITE[k]));
    else if (prop === 'mask' && /\b(add|subtract|intersect|exclude)\b/.test(value)) continue; // per-layer compositing has no -webkit- shorthand
    else out.push('-webkit-' + prop + ':' + value);
  }
  return out.join(';');
}

// Walks a stylesheet (or the inside of an @media / @supports / @layer block).
export function compatColorMix(css) {
  if (!css.includes('color-mix(') && !/\bmask/.test(css)) return css;
  let out = '', i = 0;
  while (i < css.length) {
    const brace = nextBrace(css, i);
    if (brace < 0) { out += css.slice(i); break; }
    // A ';'-ended statement (@import, @charset) before the block passes through untouched.
    const semi = splitTop(css.slice(i, brace), ';');
    if (semi.length > 1) { const lead = semi.slice(0, -1).join(';') + ';'; out += lead; i += lead.length; }
    const prelude = css.slice(i, brace), end = closeOf(css, brace), body = css.slice(brace + 1, end - 1);
    const at = prelude.trim().match(/^@([a-z-]+)/i)?.[1]?.toLowerCase();
    if (at && ['media', 'supports', 'layer', 'container', 'document'].includes(at)) {
      out += prelude + '{' + compatColorMix(body) + '}';
    } else if (at) {
      out += css.slice(i, end); // @keyframes, @font-face and @property stay as they are
    } else {
      const fallback = body.includes('color-mix(') ? fallbackBody(body) : '', masks = maskBody(body);
      out += css.slice(i, end) + (fallback ? `${SUPPORTS}{${prelude.trim()}{${fallback}}}` : '') + (masks ? `${MASK_SUPPORTS}{${prelude.trim()}{${masks}}}` : '');
    }
    i = end;
  }
  return out;
}
// The next '{' that opens a block, skipping strings, comments and ';'-terminated at-rules like @import.
function nextBrace(css, from) {
  for (let i = from; i < css.length; i++) {
    const c = css[i];
    if (c === '"' || c === "'") { i = endOfString(css, i); continue; }
    if (c === '/' && css[i + 1] === '*') { i = css.indexOf('*/', i + 2); if (i < 0) return -1; i++; continue; }
    if (c === '(') { i = closeOf(css, i) - 1; continue; }
    if (c === '{') return i;
  }
  return -1;
}

// Planeswalk keeps its styles inline: the same treatment for each <style> block of a page.
export function compatColorMixHtml(html) {
  return html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/g, (_, open, css, close) => open + compatColorMix(css) + close);
}
