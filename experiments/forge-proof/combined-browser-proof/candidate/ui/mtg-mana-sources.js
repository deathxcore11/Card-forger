// A conservative source comparison, not a mana-ability or game-state simulator.
// produced_mana lists possible outputs, not whether their costs/restrictions are
// satisfied. Only intrinsically available or recognized free tap outputs belong
// in an unconditional source pool. Conditional routes remain visible evidence.
const COLORS = [...'WUBRGC'];
const BASIC = {Plains:'W', Island:'U', Swamp:'B', Mountain:'R', Forest:'G'};
const unique = xs => [...new Set(xs)];
const clean = text => String(text || '').replace(/\([^()]*(?:\([^()]*\)[^()]*)*\)/g, '').trim();
const outputColors = text => {
  if (/mana of any (?:one )?(?:colou?r|type)|mana in any combination of colou?rs/i.test(text)) return /any (?:one )?type/i.test(text) ? COLORS : [...'WUBRG'];
  return unique([...text.matchAll(/\{([WUBRGC])\}/gi)].map(m => m[1].toUpperCase()));
};

export function mtgManaSourceProfile(card, {commanderIdentity=null} = {}) {
  const face = card?.card_faces?.[0] || card || {}, type = face.type_line || card?.type_line || '',
    text = clean(face.oracle_text || card?.oracle_text), colors = [], conditional = [];
  // Nonbasic typed duals also have the intrinsic abilities of their basic types.
  if (/\bLand\b/.test(type)) {
    const subtypes = (type.split('—')[1] || '') + (/\bBasic\b/.test(type) ? ' '+(card?.name || '') : '');
    for (const [name, color] of Object.entries(BASIC)) if (new RegExp('\\b'+name+'\\b').test(subtypes)) colors.push(color);
    if (/\bBasic\b/.test(type) && /\bWastes\b/.test(card?.name || '')) colors.push('C');
  }
  let recognized = false;
  for (const evidence of text.split('\n').map(s => s.trim()).filter(Boolean)) {
    const match = evidence.match(/\badd\s+([^.]*)/i);
    if (!match) continue;
    let output = outputColors(match[1]);
    const commanderColors=/commander[\x27’]s colou?r identity/i.test(evidence);
    if(commanderColors&&Array.isArray(commanderIdentity))output=output.filter(color=>commanderIdentity.includes(color));
    const before = evidence.slice(0, match.index).trim(), cost = before.replace(/:\s*$/, '').trim();
    let reason = null;
    if (!/^\{T\}$/i.test(cost)) reason = /\{(?:\d+|[WUBRGC])\}/i.test(cost)
      ? 'Requires input mana; not an independent colored source.'
      : 'Requires an additional cost or trigger not resolved by this source comparison.';
    else if (commanderColors&&!Array.isArray(commanderIdentity)) reason = 'Requires the commander color identity, which is not supplied in this comparison.';
    else if (/\bspend this mana only\b|\bspend this mana to\b|\bthis mana (?:can't|cannot) be spent\b|\bactivate only\b/i.test(evidence)) reason = 'Mana spending or activation is restricted.';
    else if (/\bif\b|\bunless\b|\bcould produce\b|\bchosen\b|\bfor each\b|\bequal to\b|\bthat colou?r\b|\bamong\b/i.test(evidence)) reason = 'Mana output depends on unresolved choices or game state.';
    if (!output.length) reason ||= 'Mana output is not recognized.';
    recognized = true;
    if (reason) conditional.push({evidence, reason, colors:output});
    else colors.push(...output);
  }
  return {colors:unique(colors), conditional, unknown:!recognized && !colors.length,
    note:!recognized && !colors.length ? 'No unconditional mana ability is verified from the cached printed text.' : null};
}
