import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cardActionButtons} from './card-actions.js';
// One wishlist action everywhere: the hold/right-click menu reuses the card page's toggle, says what it will do,
// and confirms with Undo. No separate "add a card you want" input or Want button.
for(const game of ['mtg','ptcg','ygo']){
 assert.match(cardActionButtons({game,wished:false}),/Add to wishlist/);
 assert.match(cardActionButtons({game,wished:true}),/Remove from wishlist/,game+': the menu reflects the current state');
}
const app=readFileSync('app.js','utf8'),views=readFileSync('views.js','utf8'),tcg=readFileSync('tcg.js','utf8');
const quick=app.slice(app.indexOf('A.quickWish = async'),app.indexOf('A.quickDeck ='));
assert.match(quick,/A\.cardWishlist\(/,'the menu uses the card page toggle');
assert.doesNotMatch(quick,/A\[game === "mtg" \? "wish" : "tWish"\]/);
const toggle=app.slice(app.indexOf('A.cardWishlist=async'),app.indexOf('A.cardDeckPicker='));
assert.match(toggle,/undo:adding\?'Added to wishlist\.':'Removed from wishlist\.'/,'brief confirmation with Undo');
assert.doesNotMatch(toggle,/collection|qty\s*[+-]=/,'marking a card never changes owned copies');
assert.doesNotMatch(views,/id="wishName"|Add a card you want/,'no separate want input');
for(const [label,src] of [['views',views],['tcg',tcg]])assert.doesNotMatch(src,/Owned \+ wanted|Copy wanted list|\(wanted, not owned\)|\}Wanted</,label+': one vocabulary (Wishlist)');
console.log('PASS: one wishlist toggle shared by card page and hold menu, state-aware label, Undo, owned copies untouched, Wishlist wording.');
