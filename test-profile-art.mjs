import assert from 'node:assert/strict';
import {profileArt,profileAvatar,profileCrop} from './profile-art.js';
import {validateWorkspace} from './confidence.js';
import {blank} from './store.js';
for(const ratio of [.2,.7,1,1.5,5])for(const zoom of [1,2,4])for(const x of [-10,0,.5,1,10]){
 const c=profileCrop({ratio,zoom,x,y:1-x});
 assert(c.x*c.width>=.5&&c.y*c.height>=.5);
 assert((1-c.x)*c.width>=.5-1e-9&&(1-c.y)*c.height>=.5-1e-9,'Crop covers the circle without blank edges');
}
for(const game of ['mtg','ptcg','ygo']){
 const avatar=profileArt({game,cardId:'example',name:'<script>fake</script>',image:'https://example.test/card.jpg',x:.4,y:.3,ratio:.7,zoom:2});
 const state=blank();state.settings.cardAvatar=avatar;const next=validateWorkspace(structuredClone(state));
 assert.deepEqual(next.settings.cardAvatar,avatar,'Crop metadata survives normal workspace persistence');
 assert(!profileAvatar(avatar).includes('<script>'));
 assert.deepEqual(next.collection,state.collection);assert.deepEqual(next.decks,state.decks);
}
for(const image of ['javascript:alert(1)','data:text/html,<script>','https://user:secret@example.test/a','file:///etc/passwd'])assert.equal(profileArt({game:'ygo',cardId:'1',image}),null);
assert.equal(profileArt({game:'other',cardId:'1',image:'https://example.test/a'}),null);
assert.match(profileAvatar(null,{display_name:'Randall'}),/>R</);
console.log('PASS: circular crop geometry, bounded positions/zoom, safe source URLs, cross-game metadata persistence and unchanged inventory.');

assert.equal(profileArt({game:'ygo',cardId:'123',image:'img/ygo/123.jpg'}).image,'img/ygo/123.jpg');
for(const image of ['img/ygo/../secrets','img/ygo/123.jpg?redirect=https://other.test','//other.test/a'])assert.equal(profileArt({game:'ygo',cardId:'123',image}),null);
