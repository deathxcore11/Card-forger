import { Game } from '../src/sim/game.js';
const seeds = process.argv.slice(2).map(Number);
for (const seed of seeds) {
  const g = new Game(seed, { mode: 'run', duelist: 'kael' }), L = g.colliders.list, sp = g.map.spawn;
  const trees = L.filter(c => c.top - c.y > 8 && c.r < 1.0), rocks = L.filter(c => !(c.top - c.y > 8 && c.r < 1.0));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  let minTrunk = 1e9; for (let i = 0; i < trees.length; i++) for (let j = i + 1; j < trees.length; j++) minTrunk = Math.min(minTrunk, dist(trees[i], trees[j]));
  const cells = new Map(); for (const t of trees) { const k = Math.floor(t.x / 10) * 4096 + Math.floor(t.z / 10); cells.set(k, (cells.get(k) || 0) + 1); }
  const hero = rocks.filter(c => c.top - c.y >= 4.5), midr = rocks.filter(c => c.top - c.y < 4.5);
  let minHero = 1e9; for (let i = 0; i < hero.length; i++) for (let j = i + 1; j < hero.length; j++) minHero = Math.min(minHero, dist(hero[i], hero[j]));
  let badGap = 0; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const gap = dist(L[i], L[j]) - L[i].r - L[j].r; if (gap > 0.9 && gap < 3.0) badGap++; }
  const h = L.map(c => c.top - c.y), forb = h.filter(v => v > 0.4 && v < 1.2).length;
  const near24 = L.filter(c => dist(c, sp) < 24).length;
  console.log(JSON.stringify({ seed, trees: trees.length, maxTreeHeight: +Math.max(...trees.map(t => t.top - t.y)).toFixed(1), minTrunkSpacing: +minTrunk.toFixed(1), maxPerCell: Math.max(...cells.values()), solidsWithin24mOfSpawn: near24, heroRocks: hero.length, minHeroSpacing: +minHero.toFixed(0), lowTallRocks: midr.length, gapsBetween09and3: badGap, solidsBetween04and12: forb }));
}
