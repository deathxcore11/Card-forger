// Deterministic real-renderer/action contracts. No browser, provider or account writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CARDS,makeFixtures} from './tests/detail-rules-fixtures.mjs';
import {S} from './store.js';
import {cardSheet} from './views.js';
import {tcgCardSheet,ui,cache,registerTcg} from './tcg.js';
import {normalizeYgoSets} from './ygo.js';
import {detailSetSummary} from './card-detail-extras.js';
import {detailOwnedGroups,adjustOwnedLot} from './quick-quantity.js';
import {sellerModels,buyContext} from './pricing-presentation.js';

const f=makeFixtures();S.state=f.state;S.catalog=f.catalog;
const requests=[];globalThis.fetch=async url=>{requests.push(String(url));return {ok:false,json:async()=>({})};};
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
ui('ptcg').sets.list=[{id:CARDS.ptcg[0].set.id,name:CARDS.ptcg[0].set.name,count:202}];
const release={...normalizeYgoSets([{set_code:'SET',set_name:'First fixture printing',tcg_date:'2002-03-08'}])[0],expectedUniqueCards:120};
ui('ygo').sets.list=[release];
for(const game of ['ptcg','ygo'])Object.assign(cache[game],f.cache[game]);
const firstCard=Object.fromEntries(['mtg','ptcg','ygo'].map(g=>[g,{...CARDS[g][0]}]));
Object.assign(firstCard.mtg,{game:'mtg',frame:'1993',flavor_text:'A fixture memory that must survive.',artist:'Fixture artist'});
Object.assign(firstCard.ptcg,{dexId:[781],evolveFrom:'Fixture ancestor',flavor:'A fixture Pokémon memory.',stats:[...firstCard.ptcg.stats,['Evolves from','Fixture ancestor']],illustrator:'Fixture illustrator'});
firstCard.ygo.text='A fixture effect that must survive.';
for(const g of ['mtg','ptcg','ygo']){
 const state=g==='mtg'?S.state:S.state.tcg[g],first=state.collection[0];
 if(g==='ygo')first.setReleaseId=release.id;
 state.collection.push({...first,id:'second-'+g,qty:3,condition:'Damaged',...(g==='ptcg'?{variant:'holofoil'}:g==='mtg'?{finish:'foil'}:{edition:'1st-edition'}),manualValue:25,manualValueCondition:'Damaged'});
}
const before=JSON.stringify(S.state),count=(s,re)=>(s.match(re)||[]).length;
const summaryOf=html=>html.slice(html.indexOf('<div class="cs-meta">'),html.indexOf('<div id="card-panel-overview"'));
const overviewOf=html=>html.slice(html.indexOf('<div id="card-panel-overview"'),html.indexOf('<div id="card-panel-meta"'));
for(const g of ['mtg','ptcg','ygo']){
 const card=firstCard[g],state=g==='mtg'?S.state:S.state.tcg[g],lot=state.collection[0];
 const ctx=g==='mtg'?{type:'card',name:card.name,print:card,prints:[card],priceFinish:'nonfoil',entryId:lot.id}:{type:'tcard',game:g,id:card.id,entryId:lot.id,priceFinish:g==='ptcg'?'normal':'reference',...(g==='ygo'?{priceEdition:'SET-001::Rare',priceYgoEdition:'unlimited'}:{})};
 const render=()=>g==='mtg'?cardSheet(card,ctx):tcgCardSheet(card,ctx),html=render(),summary=summaryOf(html),overview=overviewOf(html);
 assert.equal(count(html,/class="card-owned-summary"/g),1,g+' has one compact ownership summary');assert.match(html,/Owned · 5<\/span>/);
 const header=html.slice(html.indexOf('class="cs-banner'),html.indexOf('class="cs-tabs"'));
 assert(header.includes(card.name));assert(header.includes('type-line'));if(g==='ptcg')assert.match(header,/HP 100/);
 assert.equal(count(summary,/class="cd-set card-set-summary"/g),1,g+' has one selected-set/progress surface');
 const set=summary.match(/<button class="cd-set card-set-summary"[\s\S]*?<\/button>/)?.[0];assert(set,g+' selected set is one native control');
 assert.equal(count(set,/<button\b/g),1);assert.doesNotMatch(set,/<(?:div|section|p|a|input|select)\b/,'Native set button has non-interactive phrasing children only');
 assert.match(set,/class="card-set-identity"/);assert.match(set,/aria-label="Set collection progress"/);assert.match(set,/incomplete catalogue coverage|unique-card total is not verified/);
 assert.match(set,g==='mtg'?/data-act="set" data-code="fdn"/:new RegExp(`data-act="tSet" data-id="${g==='ptcg'?card.set.id:release.id}"`));
 if(g==='ptcg')assert.match(set,/aria-valuemax="202" aria-valuenow="1"/);if(g==='ygo')assert.match(set,/aria-valuemax="120" aria-valuenow="4"/);
 const buy=summary.match(/<a class="btn small card-buy-link"[\s\S]*?<\/a>/)?.[0];assert(buy);assert.match(buy,/TCGplayer<\/span><span>Buy<\/span>/);assert.doesNotMatch(buy,/↗/);assert.match(buy,/aria-label="Buy on TCGplayer/);
 const href=buy.match(/href="([^"]+)"/)[1].replaceAll('&amp;','&');assert.equal(href,sellerModels(g,card,buyContext(g,card,ctx,S.state)).find(r=>r.key==='tcgplayer').url,g+' selected printing/finish/condition destination unchanged');
 assert.equal(count(summary,/class="card-price-reference"/g),1);assert.match(summary,/class="card-price-reference" data-act="cardPriceJump" data-target="history" aria-label="View price history"/);
 assert.match(summary,g==='mtg'?/data-act="myPriceSet" data-finish="nonfoil"/:new RegExp(`data-act="tMyPriceSet" data-game="${g}" data-id="${card.id}"`));
 assert.match(summary,g==='mtg'?new RegExp(`data-act="own" data-name="${card.name}"`):new RegExp(`data-act="tOwn" data-id="${card.id}"`));
 assert.equal(count(summary,/Add to collection/g),1);assert.doesNotMatch(overview,/>＋ Add to collection</,'The primary Add is moved, not duplicated');
 assert(summary.indexOf('card-buy-link')<summary.indexOf('card-price-reference'));assert(summary.indexOf('card-price-reference')<summary.indexOf('personal-price-edit'));assert(summary.indexOf('personal-price-edit')<summary.indexOf('card-add-collection'));
 for(const token of ['cd-art-stack','zoomCard','finish-preview','finish-choice-rail','Use as profile photo','Other printings','Sort & filter','Interactive rules','Did you know','cardWishlist','cardDeckPicker',g==='mtg'?'compareFrom':'tCompareFrom',g==='mtg'?'buildFrom':'tBuild'])assert(overview.includes(token),g+' retains '+token);
 assert(overview.indexOf('card-profile-photo')<overview.indexOf('card-printing-preview'));assert(overview.indexOf('cs-secondary')<overview.indexOf('card-secondary-actions'));
 const lower=overview.slice(overview.indexOf('card-secondary-actions'));assert.doesNotMatch(lower,/>Owned:|owned total/,'Lower controls do not duplicate the header ownership summary');
 for(const [id,qty]of [[lot.id,2],['second-'+g,3]]){
  const row=lower.match(new RegExp(`<div class="owned-group" data-owned-group="${id}">[\\s\\S]*?<\\/div><\\/div>`))?.[0];assert(row,id+' exact saved lot still present');
  assert.match(row,new RegExp(`data-act="cardOwnedQty" data-game="${g}" data-lot="${id}" data-delta="-1"`));assert.match(row,new RegExp(`data-act="cardOwnedQty" data-game="${g}" data-lot="${id}" data-delta="1"`));assert.match(row,new RegExp(`data-act="cardOwnedDetails" data-game="${g}" data-lot="${id}"`));assert.match(row,new RegExp(`<b>${qty}</b>`));assert.doesNotMatch(row,/<b>5<\/b>/,'Summary total is never an editable lot count');
 }
 if(g==='mtg')assert.match(overview,/A fixture memory that must survive/);
 if(g==='ptcg'){assert.match(overview,/Battlecraft/);assert.match(overview,/A fixture Pokémon memory/);assert.equal(count(overview,/class="card-evolution small"/g),1);assert(overview.indexOf('Battlecraft')<overview.indexOf('class="card-evolution small"')&&overview.indexOf('class="card-evolution small"')<overview.indexOf('class="pk-attack"'),'Visible evolution sits between the Battlecraft heading and attacks');}
 if(g==='ygo')assert.match(overview,/A fixture effect that must survive/);
 assert.match(html,/id="card-panel-prices"/);assert.match(html,/data-detail-key="owned-lot"/,'Saved condition detail flow is retained');
 const saved=state.collection;state.collection=[];const empty=render();assert.match(empty,/Owned · 0<\/span>/);assert.equal(count(summaryOf(empty),/Add to collection/g),1,'Add stays available for zero copies');state.collection=saved;
}
assert.equal(JSON.stringify(S.state),before,'Layout rendering never edits any private collection or price');
const lot=S.state.collection[0],old=detailOwnedGroups('mtg',[lot],firstCard.mtg);assert.match(old,/2 owned total/);assert.match(old,/>Owned:/,'Default non-detail callers stay backward compatible');
const workspace={collection:[{id:'nm',qty:2,condition:'Near Mint',finish:'nonfoil'},{id:'damaged',qty:3,condition:'Damaged',finish:'foil'}]};assert(adjustOwnedLot(workspace,'damaged',-1));assert.deepEqual(workspace.collection.map(e=>e.qty),[2,2]);assert(adjustOwnedLot(workspace,'nm',1));assert.deepEqual(workspace.collection.map(e=>e.qty),[3,2]);assert(!adjustOwnedLot(workspace,'nm',5));
const unverified=detailSetSummary({identity:'<span>Release unverified</span>',progress:{key:'missing',owned:null}});assert.doesNotMatch(unverified,/<button|data-act|role="progressbar"/);assert.match(unverified,/Choose a verified release/);
// Wire the moved Pokémon/YGO Add buttons to their real existing selection flow.
const A={},C={},I={},opened=[];globalThis.document={body:{dataset:{}},querySelector:()=>null};registerTcg({A,C,I,commit(){},render(){},openSheet:(html,ctx)=>{opened.push(html);S.ui.sheetCtx=ctx;},closeSheet(){},toast(){},go(){},writeRecord:async()=>{}});
for(const g of ['ptcg','ygo']){
 const card=firstCard[g];S.state.settings.game=g;S.ui.sheetCtx={type:'tcard',game:g,id:card.id,...(g==='ptcg'?{priceFinish:'holofoil'}:{priceEdition:'SET-001::Rare',priceYgoEdition:'unlimited'})};
 A.tOwn({dataset:{id:card.id}});assert.match(opened.at(-1),g==='ptcg'?/value="holofoil" selected/:/value="SET-001\|Rare" selected/);if(g==='ygo')assert.match(opened.at(-1),/value="unlimited" selected/);assert.match(opened.at(-1),/id="tCond"/,'Existing exact condition picker still opens');
}
const css=readFileSync(new URL('./style.css',import.meta.url),'utf8').split('/* Card detail polish:')[1].split('/* Unified context actions:')[0];assert(css);assert.match(css,/\.cs-meta\{container:card-detail-meta \/ inline-size;/,'Responsive meta queries have a real dedicated ancestor');
assert.match(css,/grid-template-areas:"buy market manual add"/);assert.match(css,/@container card-detail-meta \(max-width:620px\)\{[\s\S]*grid-template-areas:"buy market" "manual add"/);assert.match(css,/@container card-detail-meta \(max-width:280px\)\{[\s\S]*grid-template-areas:"buy" "market" "manual" "add"/);
assert.match(css,/\.card-quick-actions>\.btn\{min-height:48px/);assert.match(css,/:focus-visible\{outline:2px/);assert.doesNotMatch(css,/text-overflow|line-clamp|overflow:hidden|display:none|!important|\.cs-tabs|\.cs-banner|\.finish-choice-rail/,'No clipping, hidden content or unrelated banner/nav/finish geometry changes');
assert.deepEqual(requests.sort(),['api/prices/history?game=mtg&id=fixture-mtg-current&finish=nonfoil&source=Scryfall%20%2F%20TCGplayer','api/prices/history?game=ygo&id=89631139&finish=reference&source=TCGplayer%20reference'],'Only existing public-card history reads reach the mock');
console.log('PASS: all-game detail order/content, one clickable exact release with honest progress, one Owned summary, always-available Add, exact saved-lot controls, selected-condition Buy links, private price isolation, native controls, Add selection flow and explicit responsive boundaries. No browser or live network used.');
