// Card database for Lost Memories (codename crucible). Everything here is derived from
// crucible-pool.json (generated from the app's Yu-Gi-Oh card source) and the hand-kept
// tag table. No stats are typed in code.
// Node-only file loading is looked up at call time so this module also bundles for the browser.
function readJson(f) {
  const fs = process.getBuiltinModule('node:fs'), path = process.getBuiltinModule('node:path'), url = process.getBuiltinModule('node:url');
  return JSON.parse(fs.readFileSync(path.join(path.dirname(url.fileURLToPath(import.meta.url)), '../data', f), 'utf8'));
}

export const WHEEL = { WATER: 'FIRE', FIRE: 'WIND', WIND: 'EARTH', EARTH: 'WATER' };
export const EFFECTS = ['burn', 'heal', 'destroy', 'destroyAll', 'bounce', 'pump', 'weaken', 'draw', 'flip', 'freeze', 'position', 'revive'];

export function buildDb(pool, tags, config) {
  const byId = new Map();
  const byName = new Map();
  for (const c of pool.cards) { byId.set(c.id, c); byName.set(c.name, c); }
  const tagOf = new Map();   // id -> {fx, n}
  const fieldOf = new Map(); // id -> {types?:Set, attr?}
  const missing = [];
  for (const [group, kind] of [['spells', 'spell'], ['traps', 'trap']]) {
    for (const [name, [fx, n]] of Object.entries(tags[group])) {
      const c = byName.get(name);
      if (!c || c.kind !== kind) { missing.push(name); continue; }
      if (!EFFECTS.includes(fx)) throw new Error('unknown effect ' + fx + ' on ' + name);
      tagOf.set(c.id, { fx, n });
    }
  }
  for (const [name, f] of Object.entries(tags.fields)) {
    const c = byName.get(name);
    if (!c || c.kind !== 'field') { missing.push(name); continue; }
    fieldOf.set(c.id, { types: f.types ? new Set(f.types) : null, attr: f.attr || null });
  }
  // Cross-meld ladders: Type|Attribute -> monsters sorted weakest first. Fusion Monsters
  // are trophies reached only by their printed recipe, so they are not on the ladders.
  const ladders = new Map();
  for (const c of pool.cards) {
    if (c.kind !== 'monster') continue;
    const k = c.type + '|' + c.attr;
    if (!ladders.has(k)) ladders.set(k, []);
    ladders.get(k).push(c);
  }
  const cmp = (a, b) => a.atk - b.atk || a.def - b.def || a.level - b.level || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  for (const l of ladders.values()) l.sort(cmp);
  // Printed fusions: sorted material ids -> Fusion Monster id (strongest wins a clash).
  const recipes = new Map();
  for (const c of pool.cards) {
    if (c.kind !== 'fusion' || !c.materials) continue;
    const k = c.materials.slice().sort((a, b) => a - b).join('+');
    const old = recipes.get(k);
    if (!old || cmp(byId.get(old), c) > 0) recipes.set(k, c.id);
  }
  const db = { config, pool, byId, byName, tagOf, fieldOf, ladders, recipes, missingTags: missing, cmp, _pair: new Map() };
  db.isMonster = id => { const k = byId.get(id).kind; return k === 'monster' || k === 'fusion'; };
  db.weight = id => weightOf(db, id);
  return db;
}

let _db = null;
export function loadDb() {
  if (!_db) { const cfg = readJson('crucible-config.json'); if (process.env.CRUCIBLE_CFG) Object.assign(cfg, JSON.parse(process.env.CRUCIBLE_CFG)); _db = buildDb(readJson('crucible-pool.json'), readJson('crucible-spell-tags.json'), cfg); }
  return _db;
}

// What a card does when played on its own.
export function roleOf(db, id) {
  const c = db.byId.get(id);
  if (c.kind === 'monster' || c.kind === 'fusion') return 'monster';
  if (c.kind === 'field') return db.fieldOf.has(id) ? 'field' : 'fuel';
  if (c.kind === 'equip') return 'equip';
  if (db.tagOf.has(id)) return c.kind; // 'spell' | 'trap'
  return 'fuel';
}

export function weightOf(db, id) {
  const c = db.byId.get(id);
  const w = db.config.weights;
  switch (roleOf(db, id)) {
    case 'monster': return c.level;
    case 'field': return w.field;
    case 'equip': return w.equip;
    case 'spell': case 'trap': return w.tagged;
    default: return w.fuel;
  }
}

function crossOne(db, type, attr, floorAtk) {
  const l = db.ladders.get(type + '|' + attr);
  if (!l) return null;
  for (const c of l) if (c.atk > floorAtk) return c;
  return null;
}

// The fixed result of melding card A with card B (ids). Returns
// { kind:'printed'|'cross'|'equip'|'fuel'|'fizzle', id? }.
// For equip and fuel the monster keeps its identity; `mon` says which side it was.
export function meldPair(db, a, b) {
  const key = a + ':' + b;
  let r = db._pair.get(key);
  if (r) return r;
  r = meldPairRaw(db, a, b);
  db._pair.set(key, r);
  return r;
}

function meldPairRaw(db, a, b) {
  const A = db.byId.get(a), B = db.byId.get(b);
  const ma = db.isMonster(a), mb = db.isMonster(b);
  if (ma && mb) {
    const k = a < b ? a + '+' + b : b + '+' + a;
    const f = db.recipes.get(k);
    if (f) return { kind: 'printed', id: f };
    const floor = Math.max(A.atk, B.atk);
    const x = crossOne(db, A.type, B.attr, floor);
    const y = crossOne(db, B.type, A.attr, floor);
    let pick = x && y ? (db.cmp(x, y) <= 0 ? x : y) : (x || y);
    if (pick) return { kind: 'cross', id: pick.id };
    return { kind: 'fizzle' };
  }
  if (ma !== mb) {
    const other = ma ? B : A;
    return { kind: other.kind === 'equip' ? 'equip' : 'fuel', mon: ma ? 0 : 1 };
  }
  return { kind: 'fizzle' };
}

// Three-material printed fusion, if a, b, c (in any order) are exactly its materials.
export function meldTriple(db, a, b, c) {
  const k = [a, b, c].sort((x, y) => x - y).join('+');
  const f = db.recipes.get(k);
  return f ? { kind: 'printed', id: f } : null;
}

export function terrainFavours(db, terrainId, cardId) {
  if (!terrainId) return false;
  const f = db.fieldOf.get(terrainId);
  if (!f) return false;
  const c = db.byId.get(cardId);
  return f.attr ? c.attr === f.attr : f.types.has(c.type);
}

// Does `a` have the Attribute edge over `d`? LIGHT and DARK only when attacking.
export function wheelEdge(attrA, attrD, attacking) {
  if (WHEEL[attrA] === attrD) return true;
  if (attacking && ((attrA === 'LIGHT' && attrD === 'DARK') || (attrA === 'DARK' && attrD === 'LIGHT'))) return true;
  return false;
}
