// Card and set facts for the Play collection and deck builder: type, colours, mana value and art
// for each card (by oracle id), and name, symbol, date and size for each set. Public Scryfall data,
// cached on this device. Not account data and never prices (Play's wall).
const KEY = 'cardstashy-play-card-facts-v1';
const SCRYFALL = 'https://api.scryfall.com';

// The few fields Play needs from a Scryfall card.
export function cardFact(c = {}) {
  const face = c.card_faces?.[0] || {}, img = c.image_uris || face.image_uris || {};
  return {o: c.oracle_id || face.oracle_id || '', t: c.type_line || face.type_line || '', m: Number(c.cmc) || 0,
    k: (c.color_identity || []).join(''), i: img.normal || '', a: img.art_crop || '', mc: c.mana_cost || face.mana_cost || ''};
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
    // Fetch facts for any of these oracle ids not known yet (75 per request, Scryfall's limit).
    async wantCards(ids) {
      const need = [...new Set(ids)].filter(id => id && !data.cards[id] && !tried.has(id));
      if (!need.length) return;
      need.forEach(id => tried.add(id));
      for (let i = 0; i < need.length; i += 75) {
        const chunk = need.slice(i, i + 75);
        const body = await getJson(SCRYFALL + '/cards/collection', {method: 'POST', body: JSON.stringify({identifiers: chunk.map(oracle_id => ({oracle_id}))})});
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
