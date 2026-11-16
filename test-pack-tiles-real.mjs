// Randall 16 Nov: Shop > Your packs still drew the old silver template packs after the opener moved to the real wrapper photo.
// The exact input: Fourth Edition, Double Masters, Revised and Fifth Dawn tiles; each must be its real photo, and a set without
// one keeps the drawn wrapper.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {boosterMarkup} = await import('./play-econ-ui.js');
for (const code of ['4ed', '2xm', '3ed', '5dn']) {
  const html = boosterMarkup({code});
  assert.match(html, /pe-booster--real/, `${code} tile is the real wrapper`);
  assert.match(html, new RegExp(`src="\\./assets/packs/real/${code}\\.webp"`), `${code} tile shows its photo`);
  assert.ok(fs.existsSync(`assets/packs/real/${code}.webp`), `${code} photo ships`);
}
assert.doesNotMatch(boosterMarkup({code: 'zzz'}), /pe-booster--real|pe-booster-photo/, 'a set without a photo keeps the drawn wrapper');
assert.match(boosterMarkup({code: '4ed', collector: true}), /pe-booster--real[^"]*pe-booster--collector/, 'a collector tile keeps its glow class');
const {pack3dCode, realPhotoCode} = await import('./pack3d.js');
assert.match(boosterMarkup({code: 'mm2'}), /pe-booster--real/, 'Modern Masters 2015 tile is its real box photo');
assert.equal(realPhotoCode('mtg', {code: 'mm2'}), 'mm2');
assert.equal(pack3dCode('mtg', {code: 'mm2'}), '', 'the cardboard box never goes on the foil model');
assert.equal(pack3dCode('mtg', {code: 'fra'}), 'fra');
// Randall 16 Nov: the Magic home page's Card of the Day pack was the old small web photo. The exact input: today's pack in
// Ravnica: City of Guilds; its first picture must be the bundled real wrapper, then the web ones as before.
const {todayPackMarkup} = await import('./home-today.js');
const today = todayPackMarkup('mtg', {code: 'rav', name: 'Ravnica: City of Guilds', set_type: 'expansion', digital: false, released_at: '2005-10-07'});
assert.match(today, /<img data-pack-art src="\.\/assets\/packs\/real\/rav\.webp"/, "today's Ravnica pack starts with its real photo");
assert.match(today, /data-real="1"/);
assert.ok(JSON.parse(today.match(/data-sources="([^"]*)"/)[1].replace(/&quot;/g, '"')).length > 1, 'the web pictures stay as fallbacks');
const plain = todayPackMarkup('mtg', {code: 'zzz', name: 'No Photo', set_type: 'expansion', digital: false, released_at: '2024-01-01'});
assert.doesNotMatch(plain, /assets\/packs\/real/, 'a set without a photo keeps the web pictures');
console.log('PASS: pack tiles wear the real wrapper photo wherever the opener does.');
