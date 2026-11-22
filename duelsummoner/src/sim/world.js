// The map's life: breakable vases, Witness Stones, the Relic Broker, Shrines of Tribute and Card Chests, placed each run from
// authored regions (data/encounters.js). Every spot is standable, flat, spaced out and has at least three ways off it.
import { ENCOUNTERS as E } from '../data/encounters.js';
import { ITEMS, BLESSINGS } from '../data/items.js';
import { heightAt } from './terrain.js';
import { dropPickup, addFx, PICK_COIN, PICK_XP, PICK_HEART } from './combat.js';
import { buildOffer, candidates } from './field.js';

const DEG = Math.PI / 180;

function openSides(x, z, y) {                          // directions (of 8) with ground within 0.7 m of our height 4 m away
  let n = 0;
  for (let k = 0; k < 8; k++) { const h = heightAt(x + Math.cos(k * Math.PI / 4) * 4, z + Math.sin(k * Math.PI / 4) * 4); if (h < 50 && Math.abs(h - y) < 0.7) n++; }
  return n;
}
function flatHere(x, z, y) {
  for (const [dx, dz] of [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]]) { const h = heightAt(x + dx, z + dz); if (h >= 50 || Math.abs(h - y) > 0.15) return false; }
  return true;
}
export function pickSpot(g, regions, taken, apart, tries = 300, accept) {
  for (let t = 0; t < tries; t++) {
    const R = regions[Math.floor(g.rng() * regions.length)], iv = R.deg[Math.floor(g.rng() * R.deg.length)];
    const r = R.r[0] + g.rng() * (R.r[1] - R.r[0]), a = (iv[0] + g.rng() * (iv[1] - iv[0])) * DEG, x = r * Math.cos(a), z = r * Math.sin(a), h = heightAt(x, z);
    if (h >= 50 || Math.abs(h - R.h) > 0.2 || !flatHere(x, z, h) || openSides(x, z, h) < 3) continue;
    if (taken.some(q => (q.x - x) ** 2 + (q.z - z) ** 2 < apart * apart)) continue;
    if (accept && !accept(x, z)) continue;
    return { x, z, y: h };
  }
  return null;
}

export const emptyWorld = () => ({ vases: [], stones: [], broker: null, shrines: [], cchests: [], altar: null, opened: 0, kills50: 0 });

// Placement API for a map generator: spawn one placeable object at a position. The sim owns the logic; the generator owns where.
//   placeObject(g, 'vase', { x, y, z, banded })   'stone' | 'broker' | 'shrine' | { x, y, z }   'cchest' { x, y, z, rarity }
export function placeObject(g, type, s) {
  const W = g.world;
  if (type === 'vase') { W.vases.push({ x: s.x, y: s.y, z: s.z, alive: true, banded: !!s.banded, hp: 1 }); return W.vases[W.vases.length - 1]; }
  if (type === 'stone') { W.stones.push({ x: s.x, y: s.y, z: s.z, used: false }); return W.stones[W.stones.length - 1]; }
  if (type === 'broker') { W.broker = { x: s.x, y: s.y, z: s.z, stock: pickStock(g) }; return W.broker; }
  if (type === 'shrine') { W.shrines.push({ x: s.x, y: s.y, z: s.z, charge: 0, idle: 0, done: false }); return W.shrines[W.shrines.length - 1]; }
  if (type === 'altar') { W.altar = { x: s.x, y: s.y, z: s.z, used: false }; return W.altar; }
  if (type === 'cchest') { W.cchests.push({ x: s.x, y: s.y, z: s.z, open: false, rarity: s.rarity || E.cardChests.rarityByOrder[W.cchests.length] || 'common' }); return W.cchests[W.cchests.length - 1]; }
  throw new Error('unknown placeable ' + type);
}

export function buildWorld(g) {
  const W = emptyWorld(), taken = [];
  if (g.opts && g.opts.world === 'none') return W;                          // a generator will place everything itself
  const put = s => { if (s) taken.push(s); return s; };
  for (const sp of E.cardChests.placement) for (let i = 0; i < sp.n; i++) {
    const s = put(pickSpot(g, [sp], taken, E.minSpacing)); if (s) W.cchests.push({ ...s, open: false, rarity: null });
  }
  W.cchests.forEach((c, i) => { c.rarity = E.cardChests.rarityByOrder[i] || 'common'; });
  { const s = put(pickSpot(g, E.altar.regions, taken, E.minSpacing)); if (s) W.altar = { ...s, used: false }; }
  const farFrom = (list, d) => (x, z) => list.every(q => (q.x - x) ** 2 + (q.z - z) ** 2 >= d * d);
  for (let i = 0; i < E.witnessStones.count; i++) { const s = put(pickSpot(g, E.witnessStones.regions, taken, E.minSpacing, 400, farFrom(W.stones, E.witnessStones.minApart))); if (s) W.stones.push({ ...s, used: false }); }
  { const s = put(pickSpot(g, E.broker.regions, taken, E.minSpacing)); if (s) W.broker = { ...s, stock: pickStock(g) }; }
  for (let i = 0; i < E.shrines.count; i++) { const s = put(pickSpot(g, E.shrines.regions, taken, E.minSpacing, 400, farFrom(W.shrines, E.shrines.minApart))); if (s) W.shrines.push({ ...s, charge: 0, idle: 0, done: false }); }
  const V = E.vases;
  for (let c = 0; c < V.clusters; c++) {
    const s = pickSpot(g, V.regions, taken, E.minSpacing); if (!s) continue; taken.push(s);
    const n = V.perCluster[0] + Math.floor(g.rng() * (V.perCluster[1] - V.perCluster[0] + 1));
    for (let k = 0; k < n; k++) {
      const a = g.rng() * 6.283, r = k === 0 ? 0 : 0.9 + g.rng() * 1.2, x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r, h = heightAt(x, z);
      if (h >= 50 || Math.abs(h - s.y) > 0.2) continue;
      W.vases.push({ x, y: h, z, alive: true, banded: g.rng() < V.bandedChance, hp: V.hp });
    }
  }
  return W;
}

function pickStock(g) {
  const ids = Object.keys(ITEMS), W = E.broker.rarityWeights, out = [];
  const pool = ids.slice();
  while (out.length < E.broker.stock && pool.length) {
    const tot = pool.reduce((a, id) => a + (W[ITEMS[id].rarity] || 1), 0); let r = g.rng() * tot, pick = pool[0];
    for (const id of pool) { r -= W[ITEMS[id].rarity] || 1; if (r < 0) { pick = id; break; } }
    pool.splice(pool.indexOf(pick), 1); out.push({ id: pick, price: ITEMS[pick].price, sold: false });
  }
  return out;
}
export const shopPrice = (g, base) => Math.max(1, Math.round(base * (1 - g.mods.shopDiscount)));
export function chestPrice(g) {
  const C = E.cardChests, n = g.world.opened + 1;
  if (g.mods.freeChestEvery && n % g.mods.freeChestEvery === 0) return 0;
  return Math.max(1, Math.round((C.basePrice + C.priceStep * g.world.opened) * (1 - g.mods.shopDiscount)));
}

// ---- vases ----
export function breakVase(g, v) {
  if (!v.alive) return; v.alive = false;
  const D = E.vases.drops, d = v.banded ? E.vases.banded : D;
  addFx(g, { type: 'ring', x: v.x, y: v.y, z: v.z, r: 1.2, dur: 0.3, color: v.banded ? 0xe8c56a : 0xc9965a });
  const coins = D.coins[0] + Math.floor(g.rng() * (D.coins[1] - D.coins[0] + 1));
  for (let i = 0; i < coins; i++) dropPickup(g, PICK_COIN, v.x + (g.rng() - 0.5), v.y, v.z + (g.rng() - 0.5));
  dropPickup(g, PICK_XP, v.x, v.y, v.z, v.banded ? d.xp : 1);
  if (g.rng() < (v.banded ? d.heartChance : D.heartChance)) dropPickup(g, PICK_HEART, v.x, v.y, v.z + 0.6);
  g.vasesBroken++;
}
export function breakVasesNear(g, x, z, r) {
  for (const v of g.world.vases) if (v.alive) { const dx = v.x - x, dz = v.z - z; if (dx * dx + dz * dz < r * r) breakVase(g, v); }
}

// ---- per-tick: shrines charge, regen ----
export function updateWorld(g, dt) {
  const p = g.p, S = E.shrines;
  for (const s of g.world.shrines) {
    if (s.done) continue;
    const dx = p.x - s.x, dz = p.z - s.z, inside = dx * dx + dz * dz < S.radius * S.radius && Math.abs(p.y - s.y) < 2;
    if (inside) { s.idle = 0; s.charge = Math.min(S.hold, s.charge + dt); }
    else { s.idle += dt; if (s.idle > S.leaveGrace && s.charge > 0) s.charge = Math.max(0, s.charge - S.decayPerSecond * dt); }
    if (s.charge >= S.hold) { s.done = true; g.event('banner', 'The shrine accepts your tribute.'); openBlessing(g, s); }
  }
  if (g.mods.regen > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + g.mods.regen * dt);
  if (g.talismanCd > 0) g.talismanCd -= dt;
}

// ---- offers from encounters ----
function itemCards(g, ids) { return ids.map(id => ({ id, kind: 'item', isNew: true, to: 1, rarity: ITEMS[id].rarity })); }
function openBlessing(g, shrine) {
  const ids = Object.keys(BLESSINGS), pick = [];
  while (pick.length < E.shrines.choices && ids.length) pick.push(ids.splice(Math.floor(g.rng() * ids.length), 1)[0]);
  g.offer = { type: 'blessing', cards: pick.map(id => ({ id, kind: 'blessing', isNew: true, to: 1, rarity: 'rare' })), leave: false, source: shrine };
  g.event('offer', null);
}
function openStone(g, stone) {
  const owned = new Set(g.items), ids = Object.keys(ITEMS).filter(id => !owned.has(id) && ITEMS[id].rarity === 'common'), pick = [];
  while (pick.length < E.witnessStones.choices && ids.length) pick.push(ids.splice(Math.floor(g.rng() * ids.length), 1)[0]);
  if (!pick.length) { g.event('banner', 'The stones have nothing left to offer you.'); return; }
  g.offer = { type: 'item', cards: itemCards(g, pick), leave: true, source: stone }; g.event('offer', null);
}
function openShop(g) {
  const B = g.world.broker;
  g.offer = { type: 'shop', cards: B.stock.map(s => ({ id: s.id, kind: 'item', isNew: true, to: 1, rarity: ITEMS[s.id].rarity, price: shopPrice(g, s.price), sold: s.sold, stockRef: s })), leave: true };
  g.event('offer', null);
}
// One landmark, two clearly labelled actions. Shown before committing: what is lost and what carries forward.
function openAltar(g, altar) {
  const f = g.field, cards = [];
  f.monsters.forEach((m, i) => { if (m) cards.push({ kind: 'tribute', zone: 'monster', index: i, id: m.id, level: m.level, rarity: 'rare' }); });
  f.spells.forEach((s, i) => { if (s) cards.push({ kind: 'tribute', zone: 'spell', index: i, id: s.id, level: s.level, rarity: 'rare' }); });
  const unowned = candidates(g).filter(c => c.isNew && c.kind !== 'oneshot'), pick = [];
  while (pick.length < E.altar.banishChoices && unowned.length) pick.push(unowned.splice(Math.floor(g.rng() * unowned.length), 1)[0]);
  for (const c of pick) cards.push({ kind: 'banish', id: c.id, rarity: c.rarity });
  if (!cards.length) { g.event('banner', 'The altar has nothing to take.'); return; }
  g.offer = { type: 'altar', cards, leave: true, source: altar }; g.event('offer', null);
}
function openCardChest(g, c) {
  const price = chestPrice(g);
  if (g.coins < price) { g.event('banner', 'This chest costs ' + price + ' coins.'); return; }
  const cards = buildOffer(g, c.rarity);
  if (!cards.length) { g.event('banner', 'Nothing in this chest you could use.'); return; }
  g.coins -= price; g.world.opened++;
  g.offer = { type: 'chest', cards, leave: false, chest: c, floor: c.rarity }; g.event('offer', null);
}

// nearest thing the duelist can press E on, with its prompt text
export function nearestProp(g) {
  const p = g.p, W = g.world, R = E.interactRange; let best = null, bd = R * R;
  const consider = (obj, type, text) => { const dx = obj.x - p.x, dz = obj.z - p.z, d = dx * dx + dz * dz; if (d < bd && Math.abs(obj.y - p.y) < 2.5) { bd = d; best = { obj, type, text }; } };
  for (const c of W.cchests) if (!c.open) { const pr = chestPrice(g); consider(c, 'cchest', 'E: open the ' + c.rarity + ' Card Chest (' + (pr === 0 ? 'free' : pr + ' coins' + (g.coins < pr ? ', you have ' + g.coins : '')) + ')'); }
  for (const s of W.stones) if (!s.used) consider(s, 'stone', 'E: take a free item from the Witness Stones');
  if (W.broker) consider(W.broker, 'broker', 'E: browse the Relic Broker');
  if (W.altar && !W.altar.used) consider(W.altar, 'altar', 'E: Altar of Tribute (Banish a card, or Tribute one from your field)');
  return best;
}
export function useProp(g, hit) {
  if (hit.type === 'cchest') openCardChest(g, hit.obj);
  else if (hit.type === 'stone') openStone(g, hit.obj);
  else if (hit.type === 'broker') openShop(g);
  else if (hit.type === 'altar') openAltar(g, hit.obj);
}
