import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {S,blank} from './store.js';
import {tourScenes,DEMO_CARDS} from './tour-scenes.js';
import {shouldTour,STEPS,LESSONS,tourSeen,guideSeen,markGuide,resetOnboarding,previewDocument} from './tour.js';
const saved=new Map([['cards','private inventory'],['cardstashy-glass','off'],['cardstashy-tour-v1','done']]);
globalThis.localStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
assert.equal(shouldTour({seen:false}),true);assert.equal(shouldTour({cards:5,decks:2,seen:false}),true);assert.equal(shouldTour({seen:true}),false);
assert.equal(STEPS.length,2,'short introduction, optional deeper lessons');assert.match(STEPS[0].text,/swipe left or right on Home/);
const original=S.state;S.state=blank();S.state.collection=[{name:'Private card never shown',qty:77}];const before=JSON.stringify(S.state);
let requests=0;globalThis.fetch=()=>{requests++;throw Error('Tutorial called a provider');};
for(const g of ['mtg','ptcg','ygo']){
 const scenes=tourScenes(g);for(const lesson of LESSONS){const f=scenes[lesson.key];assert(f.length>=3);assert(f.every(x=>x.html.length>100&&x.caption&&x.duration>=1000));assert.equal(new Set(f.map(x=>x.html)).size,f.length,'each action visibly changes the scene');assert.doesNotMatch(f.map(x=>x.html).join(''),/Private card never shown/);}
 assert.match(scenes.find[1].html,new RegExp(DEMO_CARDS[g].name.slice(0,4)));assert.match(scenes.find[3].html,/demo-detail/);
 assert.match(scenes.save[0].html,/Near Mint/);assert.match(scenes.save[1].html,/Lightly Played/);assert.match(scenes.save[2].html,/<b>2<\/b>/);assert.match(scenes.save.at(-1).html,/Added 2 copies/);assert.match(scenes.save.at(-1).html,/example total/);
 assert.match(scenes.scan[0].html,/demo-enter/);assert.match(scenes.scan[1].html,/Review match/);
 assert.notEqual(scenes.tabletop[0].html,scenes.tabletop[1].html);assert.equal(scenes.tabletop[2].caption,'Undo reverses that player’s last change.');
}
assert.equal(requests,0);assert.equal(JSON.stringify(S.state),before);S.state=original;
markGuide('scan');assert.equal(guideSeen('scan'),true);resetOnboarding();assert.equal(tourSeen(),false);assert.equal(guideSeen('scan'),false);assert.equal(saved.get('cards'),'private inventory');assert.equal(saved.get('cardstashy-glass'),'off');
const doc=previewDocument('<button>Sample</button>',{cssUrl:'https://app.test/style.css',game:'ptcg'});assert.match(doc,/https:\/\/app.test\/style.css/);assert.doesNotMatch(doc,/<script/);
const controller=readFileSync('tour.js','utf8');assert.match(controller,/sandbox=""/);assert.doesNotMatch(controller,/allow-scripts|allow-same-origin|\.click\(\)/);assert.match(controller,/visibilitychange/);assert.match(controller,/prefers-reduced-motion/);
console.log('PASS: two-part intro, action-changing examples in every game, no private data or paid requests, isolated Reset, script-free sandbox and reduced-motion controls.');
