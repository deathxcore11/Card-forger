import assert from 'node:assert/strict';
import {printingNumberMatches,printingRows,printingFacets} from './printing-picker.js';
import {printingGroups,printingCarouselHTML} from './printing-carousel.js';
import {showcaseItem,communityPage,showcaseSections,incomingRequestCount} from './community-profile.js';
const card={game:'ptcg',id:'cel25-23',name:"Professor's Research",set:{id:'cel25',name:'Celebrations',number:'023',total:25},rarity:'Rare',variants:[{key:'normal',label:'Normal',productId:1},{key:'holofoil',label:'Holo',productId:2}]};
const rows=printingRows('ptcg',[card],{source:card});
assert.equal(rows.length,2);assert.equal(printingGroups(rows).length,1,'finishes share one artwork slide but retain separate identities');
for(const q of ['023/025','23/25','023','23'])assert(printingNumberMatches(rows[0],q),q);
for(const q of ['023/026','123','TG23'])assert(!printingNumberMatches(rows[0],q),q);
assert(printingNumberMatches({number:'088',total:100},'88'));assert(!printingNumberMatches({number:'188',total:100},'88'));
const html=printingCarouselHTML({game:'ptcg',card,rows,filters:{},loaded:true,complete:true,nextCursor:null,versions:{}},rows,printingFacets(rows));
assert.match(html,/Celebrations/);assert.match(html,/023\/25/);assert.match(html,/Choose finish/);assert.match(html,/disabled>Use this printing/,'multiple finishes require deliberate selection');assert.match(html,/data-search="true"/);
const clean=showcaseItem({key:'deck:x',kind:'deck',game:'ptcg',title:'Friends',notes:'PRIVATE',cards:[{id:'x',name:'Card',qty:2,image:'https://example.invalid/art.jpg',manualValue:100,notes:'PRIVATE',email:'PRIVATE'}]});
assert(!JSON.stringify(clean).includes('PRIVATE'));assert(!JSON.stringify(clean).includes('manualValue'));
const page=communityPage({account:{user:{id:'A'},profile:{display_name:'A'}},data:{people:[{id:'B',display_name:'Pending',relationship:'pending'},{id:'C',display_name:'Friend',relationship:'accepted'}],items:[]}});
assert.match(page,/Showcase<\/span><small>Coming soon/);assert.match(page,/Deck discussions<\/span><small>Coming soon/);assert.match(page,/data-community-person="C"/);assert.doesNotMatch(page,/data-community-person="B"/);
console.log('PASS: normalized collector fractions, exact number prefixes, grouped finish identities, explicit finish choice, private showcase fields and accepted-friend-only profiles');

const grouped=showcaseSections([clean,{...clean,key:'binder:z',kind:'binder'}],true);
assert.match(grouped,/aria-label="Binders"/);assert.match(grouped,/aria-label="Decks"/);assert.match(grouped,/data-community-source="deck:x"/);assert.match(grouped,/community-object-deck/);assert.doesNotMatch(page,/data-community-requests/);
assert.equal(incomingRequestCount({people:[{relationship:'pending',incoming:true},{relationship:'pending',incoming:false},{relationship:'accepted',incoming:true}]}),1);
const {miniPrintingMarkup,detailSetProgress}=await import('./card-detail-extras.js');
const mini=miniPrintingMarkup({game:'ptcg',card,cards:[card]});assert.equal((mini.match(/class="card-printing-mini"/g)||[]).length,1);assert.match(mini,/data-id="cel25-23"/);assert.doesNotMatch(mini,/data-act="tOwn"/);
assert.match(detailSetProgress({key:'ptcg:cel25',owned:9,total:25}),/aria-valuenow="9"/);assert.doesNotMatch(detailSetProgress({key:'ygo:unknown',owned:1,total:null}),/role="progressbar"/);assert.doesNotMatch(detailSetProgress({key:'ygo:unknown',owned:null,total:null}),/0 verified/);

const {deckBoxMarkup,boxAppearance,deckBoxFields}=await import('./deck-box.js');
assert.deepEqual(boxAppearance({color:'red;position:fixed',image:'javascript:alert(1)'}),{color:'#7664a0',image:''});
for(const game of ['mtg','ptcg','ygo']){const box=deckBoxMarkup({id:'one',name:'Deck',boxAppearance:{color:'#337799'}},{game,button:true,open:true});assert.match(box,new RegExp('data-act="'+(game==='mtg'?'deckMenu':'tDeckMenu')+'"'));assert.match(box,/is-open/);assert.match(box,/#337799/);}
assert.match(deckBoxFields({boxAppearance:{}},[]),/Automatic card artwork/);

const {sharedDeckCopy,showcaseValue,showcaseDetail}=await import('./community-profile.js');
const shared={key:'deck:owner',kind:'deck',game:'ygo',title:'Friend deck',format:'tcg',deckSchema:1,cards:[{id:'1',name:'Main',qty:2,zone:'main'},{id:'2',name:'Extra',qty:1,zone:'extra'},{id:'3',name:'Side',qty:3,zone:'side'}],collection:['PRIVATE']};
const copied=sharedDeckCopy(shared,'my-new-id');assert.equal(copied.id,'my-new-id');assert.equal(copied.zones.extra[0].cardId,'2');assert.equal(copied.zones.side[0].qty,3);copied.zones.main[0].qty=9;assert.equal(shared.cards[0].qty,2);assert(!JSON.stringify(copied).includes('PRIVATE'));
assert.throws(()=>sharedDeckCopy({...shared,deckSchema:0},'id'),/update/);
const binder={...shared,kind:'binder',cards:[{id:'1',qty:2,referenceUSD:3.5},{id:'2',qty:1,manualValue:900}]};assert.deepEqual(showcaseValue(binder),{total:7,priced:2,unpriced:1});assert.match(showcaseDetail(binder),/\$7.00/);assert.doesNotMatch(showcaseDetail(binder),/data-community-(source|copy|hide)|data-act=/);assert.match(showcaseDetail(shared),/Save to my decks/);assert.doesNotMatch(showcaseDetail(shared),/data-community-source/);
console.log('PASS: independent deck copies preserve sections, legacy snapshots cannot silently lose sections, binder values exclude private amounts, and friend previews have no edit actions');

const {brandMark}=await import('./brand.js');for(const mode of ['brand-idle','brand-loading','assistant-button-mark']){const logo=brandMark(mode);assert.match(logo,/brand-breathing/);assert.match(logo,/brand-cycle-left/);assert.match(logo,/brand-cycle-right/);assert.match(logo,/aria-hidden="true"/);}

// A cached/imported row may contain only cardId; rendering must recover its name.
const {S,blank}=await import('./store.js'),{tcgDeck,cache}=await import('./tcg.js'),{CARDS}=await import('./tests/search-fixtures.mjs');
for(const game of ['ptcg','ygo']){
 S.state=blank();S.state.settings.game=game;S.state.tcg={ptcg:{collection:[],decks:[],wishlist:[]},ygo:{collection:[],decks:[],wishlist:[]}};S.state.tcg[game].decks=[{id:'nameless',name:'Recovered deck',format:game==='ptcg'?'standard':'tcg',zones:{main:CARDS[game].slice(0,3).map(c=>({cardId:c.id,qty:1})),extra:[],side:[]}}];
 for(const c of CARDS[game])cache[game][c.id]=c;
 assert.match(tcgDeck('nameless'),/deck-box-control/);assert.match(tcgDeck('nameless'),/deck-box-case.*?<img src="https:/,'Deck box uses an absolute artwork candidate even when the first source is a relative proxy');
}
console.log('PASS: production Pokémon/Yu-Gi-Oh! deck render survives cached rows without names.');
