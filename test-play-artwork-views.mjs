import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolvePracticeArtwork} from './play-card-surface.js';

test('art crop and full card preserve one printing and finish without changing the game object',()=>{
 const s={id:42,known:true,zone:'Hand',printing:{playArtwork:{finish:'foil',card:{id:'chosen-printing',name:'Example',image_uris:{normal:'https://example.com/full.jpg',art_crop:'https://example.com/art.jpg'},finishes:['foil'],oracle_text:'Text'}}}};
 const before=structuredClone(s),hand=resolvePracticeArtwork(s),battle=resolvePracticeArtwork({...s,zone:'Battlefield'});
 assert.equal(hand.imageUrl,'https://example.com/full.jpg');assert.equal(battle.artImageUrl,'https://example.com/art.jpg');
 assert.equal(hand.card.id,battle.card.id);assert.equal(hand.finish,battle.finish);assert.deepEqual(s,before);
 assert.equal(resolvePracticeArtwork({...s,known:false}),null);
});
test('a transformed object uses the authorized face crop, never the other face crop',()=>{
 const s={known:true,face:'Back',printing:{playArtwork:{finish:'etched',card:{id:'double',name:'Front // Back',card_faces:[{name:'Front',image_uris:{normal:'https://example.com/front.jpg',art_crop:'https://example.com/front-art.jpg'}},{name:'Back',image_uris:{normal:'https://example.com/back.jpg',art_crop:'https://example.com/back-art.jpg'}}]}}}};
 assert.equal(resolvePracticeArtwork(s).artImageUrl,'https://example.com/back-art.jpg');
 delete s.printing.playArtwork.card.card_faces[1].image_uris.art_crop;
 assert.equal(resolvePracticeArtwork(s).artImageUrl,null);assert.equal(resolvePracticeArtwork(s).finish,'etched');
});
