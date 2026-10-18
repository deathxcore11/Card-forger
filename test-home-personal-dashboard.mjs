import {recoveryKey,appendRecoverySnapshot,createRecoverySnapshot} from './recovery-store.js';
// Pure production helpers and transactional hooks; no server, browser or provider.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { S, blank } from './store.js';
import { validateWorkspace } from './confidence.js';
import { homeDeckFingerprint, normalizeHomeDeckActivity, recordHomeDeckWork, lastWorkedDeck } from './home-deck-activity.js';
import { homeResume, homeCommunity, communityPage, attachHomeCommunity, featureArticle } from './home-ui.js';
import { communityState } from './community-feed.js';
const now = Date.now(), beforeTime = now - 86400000, iso = new Date(now).toISOString();
const games = ['mtg','ygo','ptcg'];
const makeDeck = (game, id = 'same-id') => game === 'mtg'
  ? {id,name:'An older saved deck',format:'Standard',commander:'',cards:[{name:'Test card',qty:2}],side:[]}
  : {id,name:'An older saved deck',format:game==='ygo'?'tcg':'standard',zones:{main:[{cardId:'exact-card',name:'Test card',qty:2}],extra:[],side:[]}};
const makeState = () => { const state=blank();state.tcg={ygo:{collection:[],decks:[makeDeck('ygo')],wishlist:[]},ptcg:{collection:[],decks:[makeDeck('ptcg')],wishlist:[]}};state.decks=[makeDeck('mtg')];return state; };
const decks = (state, game) => (game === 'mtg' ? state : state.tcg[game]).decks;
for (const game of games) {
  const state=makeState(); state.activeDeck='same-id';
  assert.equal(lastWorkedDeck(state,game,now),null,'legacy active/newest is not evidence');
  const creation=structuredClone(state);decks(creation,game).push(makeDeck(game,'newest'));
  recordHomeDeckWork(state,creation,now);assert.equal(lastWorkedDeck(creation,game,now),null,'creation-only has no inferred edit');
  const next=structuredClone(creation);decks(next,game)[0].name='Edited older deck';
  recordHomeDeckWork(creation,next,now);
  assert.equal(lastWorkedDeck(next,game,now).deck.id,'same-id');
  assert.equal(lastWorkedDeck(next,game,now).at,iso);
  for(const other of games.filter(g=>g!==game))assert.equal(lastWorkedDeck(next,other,now),null,'same IDs remain game-scoped');
  const restored=normalizeHomeDeckActivity(JSON.parse(JSON.stringify(next)),now);
  assert.equal(lastWorkedDeck(restored,game,now).deck.name,'Edited older deck','persisted metadata survives reload');
  const passive=structuredClone(next),d=decks(passive,game)[0];
  Object.assign(d,{createdAt:iso,source:{name:'Updated source'},art:'cached',prices:{usd:99},updatedAt:iso});
  passive.settings.game='ptcg';passive.activeDeck='newest';
  recordHomeDeckWork(next,passive,now+1000);
  assert.equal(lastWorkedDeck(passive,game,now+1000).at,iso,'navigation and enrichment metadata do not stamp work');
  const reordered=structuredClone(d); const rows=game==='mtg'?reordered.cards:reordered.zones.main;
  rows.push({...rows[0],name:'Another',qty:1});const reversed=structuredClone(reordered);
  (game==='mtg'?reversed.cards:reversed.zones.main).reverse();
  assert.equal(homeDeckFingerprint(reordered,game),homeDeckFingerprint(reversed,game),'row presentation order is ignored');
  const dirty=structuredClone(next);dirty.homeDeckActivity[game].push({id:'newest',at:'2999-01-01T00:00:00.000Z'},{id:'deleted',at:iso},{id:'<bad>',at:iso},{id:'same-id',at:iso});
  normalizeHomeDeckActivity(dirty,now);assert.equal(dirty.homeDeckActivity[game].length,1);
  decks(dirty,game).splice(0,1);normalizeHomeDeckActivity(dirty,now);assert.equal(lastWorkedDeck(dirty,game,now),null,'deleted record cannot point to a new deck');
}
const bounded=makeState();bounded.decks=Array.from({length:20},(_,i)=>makeDeck('mtg','deck-'+i));
bounded.homeDeckActivity={mtg:bounded.decks.map((d,i)=>({id:d.id,at:new Date(now-i*1000).toISOString()})),other:[{id:'deck-1',at:iso}]};
normalizeHomeDeckActivity(bounded,now);assert.equal(bounded.homeDeckActivity.mtg.length,12);assert(!bounded.homeDeckActivity.other);
const old=makeState(),newer=structuredClone(old);newer.decks[0].cards[0].qty++;
recordHomeDeckWork(old,newer,beforeTime);const after=structuredClone(newer);after.decks[0].side=[{name:'Side card',qty:1}];recordHomeDeckWork(newer,after,now);
assert.equal(lastWorkedDeck(after,'mtg',now).at,iso);
assert.equal(lastWorkedDeck(normalizeHomeDeckActivity(structuredClone(newer),now),'mtg',now).at,new Date(beforeTime).toISOString(),'undo restores the previous activity snapshot, not a new edit stamp');

// Run the actual production commit queue, normalization boundary and replacement.
const app=fs.readFileSync('app.js','utf8'),transaction=app.slice(app.indexOf('let lastUndo ='),app.indexOf('\nconst safely ='));
const writes=[];let reject=false,hold=null;
const context={S:{state:makeState()},structuredClone,normalize:state=>normalizeHomeDeckActivity(validateWorkspace(state)),recordHomeDeckWork,
 stripCache:x=>x,blank,STORAGE:'workspace',RECOVERY:'recovery',Date,Promise,
 writeRecords:async records=>{if(hold)await hold;if(reject)throw Error('Disk full');writes.push(structuredClone(records));},
 changedConditionLots:()=>[],afterLocalSave(){},saveCatalogSoon(){},render(){},refreshSheet(){},haptic(){},flyToCollection(){},toast(){},autoEnrich(){},lastActTarget:null,setTimeout(){}};
Object.assign(context,{cloudInfo:context.cloudInfo||(()=>({configured:false})),createAccountWorkspaces:()=>({guard:null}),readRecord:context.readRecord|| (async()=>null)});
Object.assign(context,{recoveryKey,appendRecoverySnapshot,createRecoverySnapshot});vm.createContext(context);vm.runInContext(transaction,context);
let release;hold=new Promise(resolve=>release=resolve);
const saving=context.commit(state=>state.decks[0].cards[0].qty++,{undo:'Added a card.'});
await Promise.resolve();assert.equal(lastWorkedDeck(context.S.state,'mtg'),null,'candidate activity does not leak before durable write');
release();await saving;hold=null;
assert.equal(lastWorkedDeck(context.S.state,'mtg').deck.cards[0].qty,3);
const good=structuredClone(context.S.state);reject=true;
await assert.rejects(context.commit(state=>state.decks[0].name='Unsaved'),/Disk full/);
assert.deepEqual(context.S.state,good,'failed writes cannot advance work or deck state');reject=false;
await context.commit(state=>state.decks[0].cards[0].name='Canonical name',{recordDeckWork:false});
assert.equal(context.S.state.homeDeckActivity.mtg[0].at,good.homeDeckActivity.mtg[0].at,'explicit provider canonicalization remains excluded');
const undoState=vm.runInContext('lastUndo.state',context);
await context.replaceWorkspace(undoState,{kind:'undo'});
assert.equal(lastWorkedDeck(context.S.state,'mtg'),null,'real undo restores original absence of history');
assert.equal(context.S.state.decks[0].cards[0].qty,2);
assert.match(app,/recordDeckWork && !navigationWrite\) recordHomeDeckWork\(previous, valid\)/);
assert.match(app.slice(app.indexOf('async function autoEnrich('),app.indexOf('async function autoEnrich(')+6500),/recordDeckWork: false/);
assert.match(app.slice(app.indexOf('A.refreshDeck ='),app.indexOf('A.deckAdd =')),/recordDeckWork: false/);

const saved=S.state;
try {
  for(const game of games){
    S.state=makeState();assert.match(homeResume(game),/Choose a deck/);assert.doesNotMatch(homeResume(game),/Last worked on|data-resume-deck/);
    S.state.homeDeckActivity={[game]:[{id:'same-id',at:iso}]};
    const html=homeResume(game);assert.match(html,/Last worked on/);assert.match(html,/data-resume-deck="same-id"/);
    assert(html.includes(`data-to="#${game==='mtg'?'deck':'tdeck'}/same-id/cards"`));
    assert.match(html,/Edited <time/);
  }
} finally {S.state=saved;}

const story={kind:'news',game:'ygo',sourceId:'ygorganization',id:'private-fixture',source:'YGOrganization',url:'https://ygorganization.com/synthetic-ocg-story',title:'Actual publisher headline [OCG]',scope:'OCG · Japan',summary:'OCG announcements do not establish TCG release dates or legality.',publishedAt:new Date(now-86400000).toISOString().slice(0,10),fetchedAt:iso,image:'https://ygorganization.com/fake-photo.jpg'};
const html=featureArticle('ygo',story,0,4);
assert.match(html,/feature-text-only/);assert.doesNotMatch(html,/<img|community-art-theme|community-signal/);
assert.match(html,/Actual publisher headline \[OCG\]/);assert.match(html,/OCG · Japan/);assert.match(html,/community-context/);assert.match(html,/OCG announcements do not establish TCG release dates or legality/);
assert.match(html,/href="https:\/\/ygorganization.com\/synthetic-ocg-story"/);
assert.equal((html.match(/<a /g)||[]).length,1,'headline is the single direct source action');
assert.match(html,/Published <time/);assert.match(html,/Checked /);
for(const count of [0,1,2,3,4,5,6,7]){const p=communityPage('test-'+count,Array.from({length:count},(_,i)=>({id:i})));assert.equal(p.pages,Math.ceil(count/3));assert.equal(p.slides.length,Math.min(3,count));}
// Real manual pagination uses three-row pages, retains keyboard focus and cannot
// mutate the selected game. Reduced motion is automatic: news has no timer.
const oldDocument=globalThis.document, oldState=communityState('ygo').data;
const stage={innerHTML:'',contains:()=>true,querySelector:()=>({focus:()=>focused++})},position={textContent:''};let focused=0;
const node={dataset:{homeCommunity:'ygo'},isConnected:true,querySelector:s=>s==='.community-stage'?stage:position};
const target={dataset:{communityStep:'1'},closest:s=>s==='[data-home-community]'?node:s==='[data-community-step]'?target:null};
const handlers=new Map(),root={querySelector:()=>null,addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name)};
try{
 globalThis.document={body:{dataset:{view:'home',game:'ygo'}},activeElement:target};
 communityState('ygo').data={game:'ygo',status:'ready',items:[0,1,2,3].map(i=>({...story,id:'fixture-'+i,title:'Headline '+i,url:'https://ygorganization.com/synthetic-story-'+i}))};
 const initial=homeCommunity('ygo');assert.equal((initial.match(/class="community-feature /g)||[]).length,3);assert.match(initial,/1–3 \/ 5/);
 const cleanup=attachHomeCommunity(root);handlers.get('click')({target});assert.equal(position.textContent,'4–5 / 5');assert.equal(focused,1);
 assert.equal((stage.innerHTML.match(/class="community-feature /g)||[]).length,2);
 let prevented=0,stopped=0;handlers.get('keydown')({target,key:'ArrowLeft',preventDefault(){prevented++;},stopPropagation(){stopped++;}});
 assert.equal(position.textContent,'1–3 / 5');assert.equal(prevented,1);assert.equal(stopped,1);assert.equal(globalThis.document.body.dataset.game,'ygo');
 handlers.get('keydown')({target,key:'Enter',preventDefault(){throw Error('native disclosure key was stolen');}});
 cleanup();assert.equal(handlers.size,0);
} finally {globalThis.document=oldDocument;communityState('ygo').data=oldState;}
const css=fs.readFileSync('style.css','utf8');assert.match(css,/\.home-community \.community-feature \{[^}]*min-height:0;/);assert.match(css,/\.home-community \.community-feature\.feature-text-only \{ grid-template-columns:minmax\(0,1fr\)/);assert.match(css,/\.home-overview \.home-daily\.ptcg > \.hh-art\.pk-crop/);
console.log('PASS: personal-first Home, bounded successful-edit history/undo/failure/isolation, honest unknown resume, source-only compact news pages and accessible isolated manual pagination.');
