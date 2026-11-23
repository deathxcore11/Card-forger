// Writes the code-made animation clips of every rig to design/clips/<rig>.json as plain data, and proves each file reads back into the same clip.
import { launch } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const outDir = fileURLToPath(new URL('../design/clips/', import.meta.url)); mkdirSync(outDir, { recursive: true });
const b = await launch({ out: process.argv[2], query: '?debug&scenery=0' });
const res = JSON.parse(await b.evalIn(`(async()=>{
  const R = await import('/src/view/rig.js'), C = await import('/src/view/creature.js'), P = await import('/src/view/procclips.js'), D = await import('/src/view/clipdata.js'), out = {};
  const humanoids = { kael: 'assets/models/duelist-kael-anim.glb', mira: 'assets/models/duelist-mira-anim.glb' };
  for (const [id, url] of Object.entries(humanoids)) {
    const built = await R.buildRig(await (await fetch(url)).arrayBuffer()), map = P.boneMap(built.root), ax = P.makeAxes(built.root, map), clips = P.buildProcClips(built);
    out[id] = { rig: id, kind: 'humanoid', note: 'bone rotations in the parent bone frame; positions in model units; clip names match design/kael-motion-prompts.md', axes: { F: ax.F.toArray(), U: ax.U.toArray(), R: ax.R.toArray() }, boneMap: Object.fromEntries(Object.entries(map).map(([k, o]) => [k, o.name])), clips: [...clips.values()].map(D.clipToData) };
  }
  const creatures = { 'ember-wyvern-f1': 'assets/models/mon-ember-wyvern-f1-rig.glb', 'life-butterfly': 'assets/models/life-butterfly-rig.glb' };
  for (const [id, url] of Object.entries(creatures)) {
    const prep = await C.loadCreature(url), rig = C.makeCreature(prep, 1), p = rig.parts, names = a => (Array.isArray(a) ? a.map(o => o.name) : a ? a.name : null);
    out[id] = { rig: id, kind: 'creature', note: 'parts are found from the rest pose; clips are rotations in the parent bone frame', axes: { F: p.axes.F.toArray(), U: p.axes.U.toArray(), R: p.axes.R.toArray() }, parts: { top: p.top.name, hips: p.hips.name, chest: p.chest.name, head: names(p.head), spine: names(p.spine), neck: names(p.neck), wingL: names(p.wingL), wingR: names(p.wingR), wingL2: names(p.wingL2), wingR2: names(p.wingR2), legL: names(p.legL), legR: names(p.legR), tail: names(p.tail) }, clips: [...prep.creatureClips.values()].map(D.clipToData) };
  }
  // read every file back into clips and compare each track value to the original within 2e-5
  const check = {};
  for (const [id, d] of Object.entries(out)) { let worst = 0, n = 0; for (const c of d.clips) { const back = D.dataToClip(JSON.parse(JSON.stringify(c))); back.tracks.forEach((t, i) => { const orig = c.tracks[i].values; for (let k = 0; k < orig.length; k++) worst = Math.max(worst, Math.abs(orig[k] - t.values[k])); n += orig.length; }); } check[id] = { clips: d.clips.length, values: n, worstDiff: worst }; }
  return JSON.stringify({ out, check }); })()`));
for (const [id, d] of Object.entries(res.out)) { const text = JSON.stringify(d); writeFileSync(outDir + id + '.json', text); console.log(id, d.clips.length, 'clips', (text.length / 1024).toFixed(0) + ' KB'); }
console.log(JSON.stringify(res.check)); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
