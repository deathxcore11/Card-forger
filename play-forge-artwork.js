// Prepare both complete selected lists before allocation. Artwork is optional;
// it never changes the exact deck sent to Forge or certifies card legality.
const key = value => String(value || '').trim().toLowerCase();
const matches = (card, name) => [card?.name, ...(card?.card_faces || []).map(f => f.name)].some(n => key(n) === key(name));
const changed = () => Object.assign(Error('ACCOUNT_CHANGED'), { code: 'ACCOUNT_CHANGED' });

export function createForgeArtworkPreparation({ resolveNames, lookup, fetchPrinting, selectionKey = key, isCurrent, timeoutMs = 20000 } = {}) {
  if ([resolveNames, lookup, fetchPrinting, isCurrent].some(f => typeof f !== 'function')) throw Error('FORGE_ARTWORK_READERS_REQUIRED');
  let frozen = new Map(), prepared = false, checkLaunch = () => true, generation = 0;
  const current = () => { if (!isCurrent() || !checkLaunch()) { frozen.clear(); prepared = false; throw changed(); } };
  const identity = (name, id) => JSON.stringify([key(name), id || null]);
  return {
    async prepare(setup, { isCurrent: launchCurrent = () => true } = {}) {
      const ticket = ++generation;
      checkLaunch = launchCurrent; current(); prepared = false; frozen = new Map();
      const requests = new Map();
      // Every seat at the table: a Commander pod's extra CPUs too, and a commander or companion
      // kept beside the list rather than in it, so no card reaches the table without its art.
      for (const deck of [setup.selected, setup.opponent, ...(Array.isArray(setup.extraOpponents) ? setup.extraOpponents.map(o => o?.deck) : [])]) {
        const named = [deck?.commander, deck?.companion].filter(n => typeof n === 'string' && n).map(name => ({ name }));
        for (const row of [...(deck?.cards || []), ...(deck?.side || []), ...(deck?.commanders || []).map(r => typeof r === 'string' ? { name: r } : r), ...named]) {
          if (typeof row?.name !== 'string' || !row.name) continue;
          const id = row.printingId || deck.referencePriceSelections?.[selectionKey(row.name)]?.printingId || null;
          requests.set(identity(row.name, id), { name: row.name, id });
        }
      }
      let active = true, timer;
      const stillCurrent = () => active && ticket === generation && isCurrent() && launchCurrent();
      const save = (name, id, card) => {
        if (stillCurrent() && card?.id && (!id || card.id === id) && matches(card, name)) frozen.set(identity(name, id), structuredClone(card));
      };
      // Cached exact printings remain available even if the provider times out.
      for (const { name, id } of requests.values()) save(name, id, lookup(name, id));
      const work = async () => {
        try { await resolveNames([...new Set([...requests.values()].map(r => r.name))], { isCurrent: stillCurrent }); } catch { /* optional artwork */ }
        if (!stillCurrent()) return;
        for (const row of requests.values()) if (!row.id) save(row.name, null, lookup(row.name, null));
        const ids = [...new Set([...requests.values()].map(r => r.id).filter(id => typeof id === 'string' && id.length <= 160))];
        let next = 0;
        // A bounded whole-deck prefetch; there are no card-provider calls from
        // the game-state/hand renderer, and no fallback for a missing printing.
        await Promise.all(Array.from({ length: Math.min(4, ids.length) }, async () => {
          while (stillCurrent() && next < ids.length) {
            const id = ids[next++]; let card = lookup(null, id);
            if (card?.id !== id) { try { card = await fetchPrinting(id); } catch { card = null; } }
            if (!stillCurrent()) return;
            for (const row of requests.values()) if (row.id === id) save(row.name, id, card);
          }
        }));
      };
      try { await Promise.race([work(), new Promise(resolve => { timer = setTimeout(resolve, timeoutMs); })]); }
      finally { active = false; clearTimeout(timer); }
      if (ticket !== generation) throw changed();
      current(); prepared = true;
      return { requested: requests.size, available: frozen.size, missing: requests.size - frozen.size };
    },
    lookup(name, id) {
      current(); if (!prepared) throw Error('FORGE_ARTWORK_NOT_PREPARED');
      const card = frozen.get(identity(name, id)); return card ? structuredClone(card) : null;
    },
  };
}
