// Card and set facts for the Play collection and deck builder: type, colours, mana value and art
// for each card (by oracle id), and name, symbol, date and size for each set. Public Scryfall data,
// cached on this device. Not account data and never prices (Play's wall).
const KEY = 'cardstashy-play-card-facts-v2';
const SCRYFALL = 'https://api.scryfall.com';

// The few fields Play needs from a Scryfall card.
// The printing itself is kept too (slim), so Play tiles use the app's own tile, foil and holo stamp.
const CARD_KEYS = ['id', 'oracle_id', 'name', 'set', 'set_name', 'collector_number', 'rarity', 'color_identity', 'colors', 'type_line', 'mana_cost', 'cmc',
  'oracle_text', 'power', 'toughness', 'loyalty', 'finishes', 'frame', 'frame_effects', 'border_color', 'security_stamp', 'full_art', 'layout', 'promo_types', 'released_at', 'image_uris', 'card_faces', 'legalities', 'edhrec_rank'];
export function slimCard(c = {}) {
  const out = {};
  for (const k of CARD_KEYS) if (c[k] !== undefined) out[k] = c[k];
  if (out.image_uris) out.image_uris = {normal: out.image_uris.normal, art_crop: out.image_uris.art_crop};
  if (out.card_faces) out.card_faces = out.card_faces.map(f => ({name: f.name, type_line: f.type_line, mana_cost: f.mana_cost, oracle_text: f.oracle_text, oracle_id: f.oracle_id, ...(f.image_uris ? {image_uris: {normal: f.image_uris.normal, art_crop: f.image_uris.art_crop}} : {})}));
  return out;
}
export function cardFact(c = {}) {
  const face = c.card_faces?.[0] || {}, img = c.image_uris || face.image_uris || {};
  return {o: c.oracle_id || face.oracle_id || '', t: c.type_line || face.type_line || '', m: Number(c.cmc) || 0,
    k: (c.color_identity || []).join(''), i: img.normal || '', a: img.art_crop || '', mc: c.mana_cost || face.mana_cost || '', card: slimCard(c)};
}

// Deck builder groups, in the app's deck order.
export function cardGroup(fact) {
  const t = fact?.t || '';
  if (!t) return 'Cards';
  for (const [g, re] of [['Lands', /\bLand\b/], ['Creatures', /\bCreature\b/], ['Planeswalkers', /\bPlaneswalker\b/], ['Instants', /\bInstant\b/],
    ['Sorceries', /\bSorcery\b/], ['Artifacts', /\bArtifact\b/], ['Enchantments', /\bEnchantment\b/], ['Battles', /\bBattle\b/]]) if (re.test(t.split('//')[0])) return g;
  return 'Cards';
}

export function createCardFacts({fetchImpl = globalThis.fetch?.bind(globalThis), storage = globalThis.localStorage, onChange = () => {}} = {}) {
  let data = {cards: {}, sets: {}};
  try { const d = JSON.parse(storage?.getItem(KEY) || 'null'); if (d?.cards && d?.sets) data = d; } catch {}
  const tried = new Set(); // asked once per visit, so a failed fetch never loops
  const save = () => { try { storage?.setItem(KEY, JSON.stringify(data)); } catch {} onChange(); };
  const getJson = (url, init) => fetchImpl(url, {...init, headers: {Accept: 'application/json', ...(init?.body ? {'Content-Type': 'application/json'} : {})}})
    .then(r => r.ok ? r.json() : null).catch(() => null);
  return {
    card: oracle => data.cards[oracle] || null,
    set: code => data.sets[code] || null,
    // Fetch facts for Play cards not known yet (75 per request, Scryfall's limit). Each entry is an
    // oracle id, or {o, id} to fetch the exact printing that was pulled.
    async wantCards(list) {
      const need = [...new Map(list.map(x => typeof x === 'string' ? [x, {o: x}] : [x?.o, x])).values()].filter(x => x?.o && !data.cards[x.o] && !tried.has(x.o));
      if (!need.length) return;
      need.forEach(x => tried.add(x.o));
      for (let i = 0; i < need.length; i += 75) {
        const chunk = need.slice(i, i + 75);
        const body = await getJson(SCRYFALL + '/cards/collection', {method: 'POST', body: JSON.stringify({identifiers: chunk.map(x => /^[0-9a-f-]{36}$/i.test(x.id || '') ? {id: x.id} : {oracle_id: x.o})})});
        for (const c of body?.data || []) { const f = cardFact(c); if (f.o) data.cards[f.o] = f; }
      }
      save();
    },
    // Name, symbol, release date and how many different cards its packs hold.
    async wantSets(codes) {
      const need = [...new Set(codes)].filter(c => /^[a-z0-9]{2,8}$/.test(c || '') && !data.sets[c] && !tried.has('set:' + c));
      if (!need.length) return;
      need.forEach(c => tried.add('set:' + c));
      // Four sets at a time, to stay inside Scryfall's ten requests a second.
      for (let i = 0; i < need.length; i += 4) {
        await Promise.all(need.slice(i, i + 4).map(async code => {
          const find = q => getJson(SCRYFALL + '/cards/search?unique=cards&order=edhrec&q=' + encodeURIComponent(q));
          // Newer sets are not always tagged is:booster on Scryfall yet; fall back to the whole set.
          let [info, search] = await Promise.all([getJson(SCRYFALL + '/sets/' + code), find('e:' + code + ' is:booster')]);
          if (!search?.data?.length) search = await find('e:' + code);
          // The pack wrapper wears the set's most played card's art.
          const lead = (search?.data || []).map(cardFact).find(f => f.a);
          if (info?.code) data.sets[code] = {name: info.name, icon: info.icon_svg_uri || '', released: info.released_at || '',
            total: Number(search?.total_cards) || Number(info.card_count) || null, art: lead?.a || ''};
        }));
        if (i + 4 < need.length) { save(); await new Promise(r => setTimeout(r, 450)); }
      }
      save();
    },
  };
}
