// Booster pack artwork selection: the set's single booster pack, never a box, bundle or sleeved pack,
// and a set whose own name contains an excluded word ("Rarity Collection") still finds its pack.
import assert from 'node:assert/strict';
import {selectPackProduct,selectPackGroup} from './set-art.js';
const img=n=>`https://tcgplayer-cdn.tcgplayer.com/product/${n}_200w.jpg`;
const ra01=[{name:'25th Anniversary Rarity Collection Booster Pack',imageUrl:img(501747)},{name:'25th Anniversary Rarity Collection Booster Box',imageUrl:img(501748)},{name:'25th Anniversary Rarity Collection Sleeved Booster Pack',imageUrl:img(527222)}];
assert.equal(selectPackProduct(ra01,'25th Anniversary Rarity Collection')?.name,'25th Anniversary Rarity Collection Booster Pack');
assert.equal(selectPackProduct([{name:'Paldea Evolved Premium Collection Booster Pack',imageUrl:img(1)}],'Paldea Evolved'),null,'A boxed collection is never a pack');
assert.equal(selectPackProduct([{name:'Bloomburrow Play Booster Pack',imageUrl:img(2)},{name:'Bloomburrow Collector Booster Pack',imageUrl:img(3)}],'Bloomburrow')?.name,'Bloomburrow Play Booster Pack');
assert.equal(selectPackProduct([{name:'Odd (Set) Booster Pack',imageUrl:img(4)}],'Odd (Set)')?.name,'Odd (Set) Booster Pack','Set names are matched literally');
assert.equal(selectPackGroup([{groupId:1,name:'25th Anniversary Rarity Collection II'},{groupId:2,name:'25th Anniversary Rarity Collection'}],{name:'25th Anniversary Rarity Collection'},'ygo')?.groupId,2);
console.log('PASS: booster pack artwork picks the set’s own pack, including sets named “Collection”, and never boxes, sleeved packs or boxed collections.');
