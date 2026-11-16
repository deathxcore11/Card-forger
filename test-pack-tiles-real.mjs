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
console.log('PASS: pack tiles wear the real wrapper photo wherever the opener does.');
