import assert from 'node:assert/strict';
import {binderGroups,binderPage,binderShelf} from './binders.js';
const rows=Array.from({length:19},(_,i)=>({game:'mtg',entry:{id:String(i),name:'Card '+i,qty:2,location:i<10?'Favorites':''},image:''}));
const groups=binderGroups(rows);
assert.equal(groups.length,2); assert.equal(groups.reduce((a,g)=>a+g.copies,0),38,'binder views never add owned copies');
const page=binderPage(rows,'Favorites',1);
assert.equal((page.match(/class="stash-pocket"/g)||[]).length,9,'only nine entries rendered per page');
assert.match(page,/Card 9/); assert.doesNotMatch(page,/data-name="Card 0"/);
assert.match(binderPage(rows,'Favorites',2),/page 3 of 3/);
assert.match(binderPage([],'Empty'),/No cards here yet/);
assert.doesNotMatch(binderShelf(rows,'mtg'),/class="stash-binder|Your first binder|Unsorted cards/);assert.match(binderShelf(rows,'mtg'),/No binders yet/);
assert.match(binderPage([{game:'mtg',entry:{name:'<unsafe>',qty:1}}],'<unsafe>'),/&lt;unsafe&gt;/);
console.log('PASS: binder grouping, ownership totals, nine-pocket pagination, empty binders and escaped labels.');

const {binderMatches, customBinderGroups, attachBinderDrag}=await import('./binders.js');
const fire={game:'ptcg',entry:{id:'fire',qty:4},card:{types:['Fire'],rarity:'Ultra Rare',set:{id:'base1'}}};
assert.equal(binderMatches(fire,{rule:'color',value:'Fire'}),true);
assert.equal(binderMatches(fire,{rule:'rare'}),true);
assert.equal(binderMatches({game:'mtg',entry:{qty:1},card:{type_line:'Basic Land — Plains'}},{rule:'type',value:'Land'}),true);
assert.equal(binderMatches({game:'ygo',entry:{printing:'LOB-EN001'},card:{sets:[{code:'SDY-006'}]}},{rule:'set',value:'LOB'}),true);
assert.equal(binderMatches({game:'ygo',entry:{printing:'SDY-006'},card:{sets:[{code:'LOB-EN001'}]}},{rule:'set',value:'LOB'}),false,'a different owned printing cannot complete a set');
assert.equal(customBinderGroups([fire],[{id:'a',game:'ptcg',rule:'all'},{id:'b',game:'ptcg',rule:'rare'},{id:'c',game:'mtg',rule:'all'}],'ptcg').length,2);
assert.equal(fire.entry.qty,4,'overlapping views do not change ownership');
const listeners=new Map(), rootListeners=new Map(), pageNode={style:{},getBoundingClientRect:()=>({width:300})};
const view={addEventListener:(t,f)=>listeners.set(t,f),removeEventListener:t=>listeners.delete(t),matchMedia:()=>({matches:false})};
const root={isConnected:true,ownerDocument:{defaultView:view},querySelector:s=>/page-edge/.test(s)?edge:pageNode,addEventListener:(t,f)=>rootListeners.set(t,f),removeEventListener:t=>rootListeners.delete(t)};
const edge={disabled:false,dataset:{pageEdge:'1'},setPointerCapture(){}};
const pointer=(type,x,target={closest:s=>/page-edge|pocket-page/.test(s)?edge:null})=>({type,clientX:x,clientY:0,pointerId:1,target,preventDefault(){}});
let turned=0;const cleanup=attachBinderDrag(root,delta=>turned+=delta);
rootListeners.get('pointerdown')(pointer('pointerdown',300));listeners.get('pointermove')(pointer('pointermove',180));
assert.match(pageNode.style.transform,/rotateY\(-68deg\)/,'page follows pointer movement continuously');
listeners.get('pointercancel')(pointer('pointercancel',180));assert.equal(pageNode.style.transform,'rotateY(0deg)','cancel snaps the page back');
rootListeners.get('pointerdown')(pointer('pointerdown',300));listeners.get('pointermove')(pointer('pointermove',100));listeners.get('pointerup')(pointer('pointerup',100));
await new Promise(resolve=>setTimeout(resolve,210));assert.equal(turned,1,'release commits a sufficiently dragged turn');cleanup();assert.equal(listeners.size,0,'closing binder releases drag listeners');
console.log('PASS: game-aware binder filters, overlapping ownership, fluid edge progress, cancel/release and cleanup.');

// Swipe anywhere on the page (not only the edge), direction from the swipe; taps still open cards.
{
  const listeners=new Map(), rootListeners=new Map(), pageNode={style:{},getBoundingClientRect:()=>({width:300})};
  const view={addEventListener:(t,f)=>listeners.set(t,f),removeEventListener:t=>listeners.delete(t),matchMedia:()=>({matches:false})};
  const edges={'1':{disabled:false},'-1':{disabled:true}};
  const root={isConnected:true,ownerDocument:{defaultView:view},querySelector:s=>{const m=s.match(/page-edge="(-?1)"/);return m?edges[m[1]]:pageNode;},addEventListener:(t,f)=>rootListeners.set(t,f),removeEventListener:t=>rootListeners.delete(t)};
  const pocket={closest:s=>/pocket-page/.test(s)?{}:null};
  const ev=(type,x,y=0)=>({type,clientX:x,clientY:y,pointerId:2,button:0,target:pocket,preventDefault(){},stopPropagation(){}});
  const turns=[];const off=attachBinderDrag(root,(d,how)=>turns.push([d,how]));
  rootListeners.get('pointerdown')(ev('pointerdown',250));listeners.get('pointermove')(ev('pointermove',120));listeners.get('pointerup')(ev('pointerup',120));
  await new Promise(r=>setTimeout(r,230));
  assert.deepEqual(turns,[[1,{dragged:true}]],'a left swipe from the middle of the page turns forward');
  let blocked=false;rootListeners.get('click')({target:pocket,preventDefault(){blocked=true;},stopPropagation(){}});
  assert.equal(blocked,true,'the click after a swipe does not open the card under the finger');
  rootListeners.get('pointerdown')(ev('pointerdown',100));listeners.get('pointermove')(ev('pointermove',260));
  assert.ok(Number(pageNode.style.transform.match(/-?[\d.]+/)[0])<=15,'swiping back on the first page only rubber-bands');
  listeners.get('pointerup')(ev('pointerup',260));assert.equal(turns.length,1,'no turn before the first page');
  rootListeners.get('pointerdown')(ev('pointerdown',100,0));listeners.get('pointermove')(ev('pointermove',104,80));listeners.get('pointerup')(ev('pointerup',104,80));
  assert.equal(turns.length,1,'vertical scrolling never turns a page');
  listeners.get('keydown')({key:'ArrowRight',target:{tagName:'DIV'},preventDefault(){}});
  assert.deepEqual(turns[1],[1,undefined],'the → key turns forward');
  off();
}
const {binderFavorites,coverImages,binderCover,MAX_FAVORITES}=await import('./binders.js');
assert.deepEqual(binderFavorites({featured:'a'}),['a'],'older single-feature binders keep their cover card');
assert.equal(binderFavorites({favorites:Array.from({length:12},(_,i)=>'f'+i)}).length,MAX_FAVORITES);
const pics=Array.from({length:12},(_,i)=>({entry:{id:'c'+i,name:'C'+i},image:'https://example.test/img'+i}));
assert.deepEqual(coverImages(pics,['c7']).map(x=>x.image),['https://example.test/img7'],'one star fills the cover');
assert.equal(coverImages(pics,['c1','c2','c3']).length,4,'two to four stars show a 2×2 window');
assert.equal(coverImages(pics,['c1','c2','c3','c4','c5','c6']).length,9,'five or more show a full 3×3 page');
assert.equal(coverImages(pics,['c9','c1','c2'])[0].image,'https://example.test/img9','starred cards come first, in star order');
assert.match(binderCover({title:'T',subtitle:'s',images:coverImages(pics,['c1','c2'])}),/stash-window w4/);
console.log('PASS: swipe anywhere with click guard, rubber band, scroll-safe, keyboard turns, and up to nine starred cover cards.');

const gx={game:'ptcg',entry:{id:'gx',cardId:'sm3.5-78',name:'Mewtwo GX',qty:1,location:'Favorites'},card:{game:'ptcg',id:'sm3.5-78',name:'Mewtwo GX',image:''}};
const shelf=binderShelf([gx],'ptcg',[{id:'explicit',game:'ptcg',title:'Favorites',rule:'location',value:'Favorites'}]);assert.match(shelf,/sm35\/78_hires.png/);assert.match(shelf,/data-binder="explicit"/);assert.match(binderPage([gx],'Favorites',0,'next',{id:'explicit'}),/sm35\/78_hires.png/);assert.match(binderPage([gx],'Favorites',0,'next',{id:'explicit'}),/Binder options/);

// Regression: saved cover references must not masquerade as visible favorites.
const {binderCoverState}=await import('./binders.js');
const {readFileSync}=await import('node:fs'),vm=await import('node:vm');
const appSource=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const coverActions=appSource.slice(appSource.indexOf('A.featureBinderCard ='),appSource.indexOf('\nA.collTab =',appSource.indexOf('A.featureBinderCard =')));
const fixtureRows=game=>Array.from({length:14},(_,i)=>({game,entry:{id:`lot-${i}`,cardId:`print-${i}`,name:i<2?'Same name':`Card ${i}`,qty:1,location:i<13?'Rare':'Other',favorite:true,notes:`Distinct lot ${i}`},card:{game,id:`print-${i}`,image:`https://example.test/${game}-${i}.png`,image_uris:{normal:`https://example.test/${game}-${i}.png`},rarity:i<13?'Rare':'Common'},image:`https://example.test/${game}-${i}.png`}));
function coverHarness(game,favorites=['missing-lot']){
 const allRows=fixtureRows(game),b={id:'binder',game,title:'Rare cards',rule:'rare',favorites:[...favorites]},S={state:{settings:{game,binders:[b],favorites:['unrelated-setting']},collection:allRows.map(r=>r.entry)},ui:{sheetCtx:{type:'binder',binder:'binder',game,page:0}}};
 const events=[],toasts=[];let revision=0,mode='',pending,queue=Promise.resolve();
 const context={A:{},S,T:{game:()=>S.state.settings.game},binderById:id=>S.state.settings.binders.find(b=>b.id===id),binderRows:()=>allRows,binderMatches,binderFavorites,binderCoverState,MAX_FAVORITES,navigationStamp:()=>revision,navigationCurrent:r=>r===revision,
  scopedCommit:()=>(fn,options)=>{const transaction=async()=>{if(mode==='cancel')return false;if(mode==='before')await new Promise(r=>pending=r);if(!options.guard(S.state))return;const before=structuredClone(S.state),result=fn(S.state);events.push({options,before});if(mode==='after')await new Promise(r=>pending=r);return result;};const result=queue.then(transaction);queue=result.catch(()=>{});return result;},render:()=>events.push('render'),showBinder:data=>{S.ui.sheetCtx=data;events.push('show');},toast:text=>toasts.push(text)};
 vm.createContext(context);vm.runInContext(coverActions,context);
 return {context,S,b,allRows,events,toasts,click:id=>context.A.featureBinderCard({dataset:{entry:id}}),clear:id=>context.A.clearUnavailableBinderFavorites({dataset:{binder:id??'binder'}}),mode:m=>mode=m,release:()=>pending(),leave:()=>{revision++;S.ui.sheetCtx=null;}};
}
for(const game of ['mtg','ptcg','ygo']){
 const all=fixtureRows(game),filtered=all.filter(r=>binderMatches(r,{rule:'rare'})),binder={id:'binder',game,title:'Rare cards',rule:'rare',favorites:['missing-lot']},before=JSON.stringify({all,binder});
 assert.equal(filtered.length,13);
 for(const at of [0,1]){
  const html=binderPage(filtered,'Rare cards',at,'next',binder);
  assert.match(html,/★ 0\/9 on cover/);assert.doesNotMatch(html,/aria-pressed="true"/);
  assert.match(html,/1 saved cover selection is unavailable in this binder/);assert.match(html,/Remove unavailable cover selections/);
 }
 assert.equal(coverImages(filtered,binder.favorites).length,4);assert(!coverImages(filtered,binder.favorites).some(c=>c.starred));
 const shelf=binderShelf(all,game,[binder]);assert.doesNotMatch(shelf,/1 on cover/);assert.match(shelf,/1 cover selection unavailable/);
 assert.equal(JSON.stringify({all,binder}),before,'render never rewrites user selections or ownership');
 // A known owned card outside the current filter is kept and recovers as soon as it matches again.
 const outside={...binder,favorites:['lot-13']};assert.deepEqual(binderCoverState(outside,filtered).unavailable,['lot-13']);assert.deepEqual(binderCoverState(outside,all).favorites,['lot-13']);
 // Names, card IDs, printing IDs and general collection stars cannot resolve a lot.
 for(const ref of ['Same name','print-0'])assert.deepEqual(binderCoverState({...binder,favorites:[ref]},filtered).favorites,[]);
 const mergeRows=structuredClone(filtered);mergeRows[10].entry.stackOrigins=[{id:'old-lot'}];
 const merged={...binder,favorites:['old-lot']};assert.deepEqual(binderCoverState(merged,mergeRows).favorites,['lot-10']);
 assert.match(binderPage(mergeRows,'Rare cards',1,'next',merged),/data-entry="lot-10" aria-label="Remove[^>]+aria-pressed="true"/);
 assert.deepEqual(coverImages(mergeRows,merged.favorites).map(x=>x.image),[`https://example.test/${game}-10.png`]);assert.deepEqual(merged.favorites,['old-lot'],'viewing proven origin never persistently rewrites it');
 mergeRows[11].entry.stackOrigins=[{id:'old-lot'}];assert.deepEqual(binderCoverState(merged,mergeRows).unavailable,['old-lot'],'ambiguous provenance never guesses');
 mergeRows[10].entry.stackOrigins=[{id:'lot-0'}];assert.deepEqual(binderCoverState({...binder,favorites:['lot-0']},mergeRows).favorites,['lot-0'],'exact surviving ID wins over an origin alias');
 const readOnly=binderPage(filtered,'Shared',0,'next',binder,{readOnly:true});assert.doesNotMatch(readOnly,/featureBinderCard|clearUnavailableBinderFavorites|saved cover selection/);
 const h=coverHarness(game),inventory=JSON.stringify(h.S.state.collection),general=JSON.stringify(h.S.state.settings.favorites);
 await h.click('lot-10');assert.deepEqual(Array.from(h.b.favorites),['missing-lot','lot-10']);assert.match(h.toasts.at(-1),/1\/9/);
 assert.match(binderPage(h.allRows.filter(r=>binderMatches(r,h.b)),'Rare cards',1,'next',h.b),/★ 1\/9 on cover/);
 const reload=JSON.parse(JSON.stringify(h.b));assert.deepEqual(binderCoverState(reload,filtered).favorites,['lot-10']);assert.deepEqual(binderCoverState(reload,filtered).unavailable,['missing-lot']);
 await h.click('lot-10');assert.deepEqual(Array.from(h.b.favorites),['missing-lot']);
 h.allRows[10].entry.stackOrigins=[{id:'old-lot'}];h.b.favorites=['old-lot'];await h.click('lot-10');assert.deepEqual(Array.from(h.b.favorites),[],'unstar resolves the same old lot as count and art');
 h.b.favorites=['old-lot','lot-10','missing-lot'];await h.click('lot-10');assert.deepEqual(Array.from(h.b.favorites),['missing-lot'],'unstar removes all proven references to that one selected lot');
 const cap=coverHarness(game,Array.from({length:9},(_,i)=>`missing-${i}`));await cap.click('lot-0');assert.equal(cap.b.favorites.length,9);assert.equal(cap.events.length,0);assert.match(cap.toasts.at(-1),/including 9 unavailable/);
 await cap.clear();assert.deepEqual(Array.from(cap.b.favorites),[]);assert.match(cap.events[0].options.undo,/collection is unchanged/);assert.equal(cap.events[0].options.observeValue,false);assert.equal(cap.events[0].options.enrich,false);
 // Undo restores the saved references and never changes owned entries.
 cap.S.state=structuredClone(cap.events[0].before);assert.equal(cap.S.state.settings.binders[0].favorites.length,9);
 for(let i=0;i<9;i++)await h.click(`lot-${i}`);
 assert.equal(binderCoverState(h.b,filtered).favorites.length,8,'the preserved unavailable slot is disclosed and still consumes one of nine');
 await h.clear();assert.equal(h.b.favorites.length,8);assert(!h.b.favorites.includes('missing-lot'));
 await h.click('lot-8');assert.equal(h.b.favorites.length,9);await h.click('lot-9');assert.equal(h.b.favorites.length,9);assert.match(h.toasts.at(-1),/Unstar one first/);
 const expectedInventory=JSON.parse(inventory);expectedInventory[10].stackOrigins=[{id:"old-lot"}];assert.deepEqual(h.S.state.collection,expectedInventory,"only explicit fixture provenance was added to ownership");
 assert.equal(JSON.stringify(h.S.state.settings.favorites),general,'unrelated favorites remain untouched');
 // The resolver must consider contradictory ancestry and exact IDs outside the filter.
 const globalRows=structuredClone(filtered),excluded=structuredClone(all[13]);
 globalRows[10].entry.stackOrigins=[{id:'ambiguous-old'}];excluded.entry.stackOrigins=[{id:'ambiguous-old'}];
 assert.deepEqual(binderCoverState({...binder,favorites:['ambiguous-old']},globalRows,[...globalRows,excluded]).favorites,[],'excluded ambiguous origin prevents a guessed cover');
 assert.equal(coverImages(globalRows,['ambiguous-old'],[...globalRows,excluded]).some(c=>c.starred),false);
 globalRows[10].entry.stackOrigins=[{id:excluded.entry.id}];assert.deepEqual(binderCoverState({...binder,favorites:[excluded.entry.id]},globalRows,[...globalRows,excluded]).favorites,[],'an exact filtered-out lot wins over a different lot claiming its origin');
 // Two genuinely serialized overlapping saves recompute the later action against committed data.
 const queued=coverHarness(game,[]);queued.mode('before');const earlier=queued.context.scopedCommit()(state=>{state.settings.binders[0].favorites=['lot-1'];return true;},{guard:()=>true});const later=queued.click('lot-0');
 await new Promise(r=>setImmediate(r));queued.mode('');queued.release();await Promise.all([earlier,later]);assert.deepEqual(Array.from(queued.b.favorites),['lot-1','lot-0'],'queued add retains an earlier selected lot');
 const fill=coverHarness(game,[]);fill.mode('before');const fillEarlier=fill.context.scopedCommit()(state=>{state.settings.binders[0].favorites=Array.from({length:9},(_,i)=>`lot-${i+1}`);return true;},{guard:()=>true});const fillLater=fill.click('lot-0');await new Promise(r=>setImmediate(r));fill.mode('');fill.release();await Promise.all([fillEarlier,fillLater]);assert.equal(fill.b.favorites.length,9);assert(!fill.b.favorites.includes('lot-0'),'cap is rechecked after queued writes');
 const recover=coverHarness(game,['lot-13']);recover.mode('before');const recoverEarlier=recover.context.scopedCommit()(state=>{state.settings.binders[0].rule='all';return true;},{guard:()=>true});const recoverLater=recover.clear();await new Promise(r=>setImmediate(r));recover.mode('');recover.release();await Promise.all([recoverEarlier,recoverLater]);assert.deepEqual(Array.from(recover.b.favorites),['lot-13'],'queued cleanup cannot delete a reference recovered by an earlier filter change');
 const move=coverHarness(game,[]);move.mode('before');const moveEarlier=move.context.scopedCommit()(()=>{move.allRows[0].card.rarity='Common';return true;},{guard:()=>true});const moveLater=move.click('lot-0');await new Promise(r=>setImmediate(r));move.mode('');move.release();await Promise.all([moveEarlier,moveLater]);assert.deepEqual(Array.from(move.b.favorites),[],'queued click must still match current binder eligibility');
 // Wrong game, wrong sheet or stale async work may never reopen an old binder.
 const wrong=coverHarness(game);wrong.S.state.settings.game=game==='mtg'?'ptcg':'mtg';await wrong.click('lot-0');await wrong.clear();assert.equal(wrong.events.length,0);
 const target=coverHarness(game);await target.clear('another-binder');assert.equal(target.events.length,0);
 for(const action of ['click','clear'])for(const mode of ['cancel','before','after']){
  const stale=coverHarness(game);stale.mode(mode);const promise=action==='click'?stale.click('lot-0'):stale.clear();
  if(mode!=='cancel'){await new Promise(r=>setImmediate(r));stale.leave();stale.release();}await promise;
  assert(!stale.events.includes('show'));assert(!stale.events.includes('render'));assert.equal(stale.toasts.length,0);
  if(mode!=='after')assert.deepEqual(Array.from(stale.b.favorites),['missing-lot']);
 }
}
console.log('PASS: all-game cover count/star/art parity, filtered and missing references, unique exact stack provenance, safe unstar, nine-slot cap, explicit undoable cleanup, reload and stale-UI guards.');
