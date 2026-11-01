// Pack-art check for Story acts (story-mode-acts.md A5, G1). Runs where tcgcsv and the live site
// answer (GitHub Actions): for every set of every built act, the booster product our worker would
// pick, and what https://cardstashy.com/img/pack/mtg.jpg actually serves.
import {packArtwork} from '../../set-art.js';
import {STORY_ACTS, SET_NAMES} from '../../story-acts.js';
const rows = [];
for (const act of STORY_ACTS) for (const code of act.sets) {
  const name = SET_NAMES[code] || code;
  let product = null, err = '';
  try { product = await packArtwork('mtg', {code, name}); } catch (e) { err = e.message; }
  const live = await fetch(`https://cardstashy.com/img/pack/mtg.jpg?code=${code}&name=${encodeURIComponent(name)}`).then(async r => ({status: r.status, type: r.headers.get('content-type'), bytes: (await r.arrayBuffer()).byteLength})).catch(e => ({status: 0, type: e.message, bytes: 0}));
  rows.push({act: act.act, code, name, product: product?.name || null, image: product?.url || null, err, live});
}
for (const r of rows) console.log(`ACT ${r.act} ${r.code.padEnd(4)} ${r.live.status === 200 && r.product ? 'PASS' : 'FAIL'} live=${r.live.status} ${r.live.type} ${r.live.bytes}B product=${r.product || 'NONE'} ${r.err}`);
console.log('JSON ' + JSON.stringify(rows));
