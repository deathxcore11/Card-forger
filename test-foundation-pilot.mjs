// Candidate acceptance uses real app functions and retained provider snapshots.
// No account, paid AI, provider request, phone or browser is involved.
import assert from 'node:assert/strict';
import fs from 'node:fs';import {gunzipSync} from 'node:zlib';
import {compileCatalog,lookupCatalog} from './scan-catalog.js';
import {scanLookupNames} from './scan.js';import {textVerifiedMatch} from './scancam.js';
import {normalizePtcg,pokemonVariants} from './ptcg.js';import {pokemonVariantChoices,pokemonDetailedRecords,pokemonLegacySelection} from './pokemon-variant-options.js';
import {conditionValue,lastKnownConditionQuote} from './condition-value.js';import {applyConditionQuotes} from './condition-feed.js';
import {setContextCard,tcgCardSheet,tcgAddSheet,entryPrice} from './tcg.js';import {presentationQuote,quoteIsStale,quoteTiming} from './pricing-presentation.js';
import {validateHistory} from './shared-history.js';import {playGuide,cardRules} from './guide.js';import {pokemonFallback,knownPokemonPlaceholder,artworkSources} from './artwork.js';
import {applyPokemonCorrections} from './pokemon-corrections.js';import {S,blank} from './store.js';
const raw=JSON.parse(gunzipSync(fs.readFileSync('scanidx/ptcg-catalog-v1.json.gz')));raw.signals=JSON.parse(gunzipSync(fs.readFileSync('scanidx/ptcg-signals-v1.json.gz')));
const pack=compileCatalog(raw),snapshot=JSON.parse(gunzipSync(fs.readFileSync('tests/fixtures/aquapolis-pilot-v1.json.gz'))).cards;
S.state=blank();S.state.settings.game='ptcg';S.state.tcg={ptcg:{collection:[],wishlist:[],decks:[]},ygo:{collection:[],wishlist:[],decks:[]}};
const results=[],check=(id,fn)=>{try{const actual=fn();results.push({id,status:'PASS',actual:actual??'assertions passed'});}catch(e){results.push({id,status:'FAIL',actual:e.stack});}};
check('recognition-title-and-alias',()=>{
 for(const [id,title,code] of [['base1-78','Scoop Up','78/102'],['base4-107','Scoop Up','107/130'],['base4-102','Imposter Professor Oak','102/130'],['ex6-32','Drowsee','32/112'],['ecard2-134','Super Energy Removal 2','134/147']]){
  const read={name:title,code},hits=lookupCatalog(pack,read).cands;assert(hits.some(c=>c.id===id&&c.exact&&textVerifiedMatch('ptcg',c,read)),id);
  for(const bad of [{...read,code:'999/999'},{...read,setId:'WRONG'},{...read,game:'ygo'},{name:title}])assert(!lookupCatalog(pack,bad).cands.some(c=>c.exact&&textVerifiedMatch('ptcg',c,bad)));
 }
 for(const form of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!?')assert(scanLookupNames('ptcg',{name:'Unown '+form}).includes('Unown '+form),'Unown '+form);
 for(const row of raw.rows.filter(r=>r[1].includes('Cube 01')))assert(scanLookupNames('ptcg',{name:row[1]}).includes(row[1]));
 assert(!lookupCatalog(pack,{name:'Dugtrio',code:'19/102'}).cands.some(c=>c.exact));
});
check('aquapolis-every-identity-and-record',()=>{
 assert.equal(snapshot.length,186);assert.equal(new Set(snapshot.map(c=>c.id)).size,186);assert.equal(snapshot.reduce((n,c)=>n+c.variants_detailed.length,0),348);
 let exact=0,bindings=0;const output=[];
 for(const source of snapshot){
  const c=normalizePtcg(source),read={name:c.name,code:c.set.number+'/'+c.set.total,setId:'ecard2'},hits=lookupCatalog(pack,read).cands;
  assert(hits.some(h=>h.id===c.id&&h.exact&&textVerifiedMatch('ptcg',h,read)),JSON.stringify({id:c.id,read,hits:hits.map(c=>[c.id,c.exact])}));exact++;
  for(const bad of [{...read,code:c.set.number+'/999'},{...read,setId:'not-a-real-set'},{...read,name:'Unrelated fixture card'},{...read,game:'mtg'}])assert(!lookupCatalog(pack,bad).cands.some(h=>h.exact&&textVerifiedMatch('ptcg',h,bad)),c.id);
  const choices=pokemonVariantChoices(c);for(const record of pokemonDetailedRecords(source)){
   const hits=choices.filter(v=>v.key===record.key||v.legacyKey===record.key);assert.equal(hits.length,1,c.id+' record '+record.sourceIndex);assert(hits[0].sourceRecordIndexes.includes(record.sourceIndex));bindings++;
  }
  const html=tcgCardSheet(c,{tab:'overview'});assert(!/\bundefined\b/.test(html),c.id);assert(artworkSources(c,true).length>0,c.id);assert(tcgAddSheet(c).includes(c.name.replace(/&/g,'&amp;'))||c.name.includes("'"),c.id);
  output.push({id:c.id,number:c.set.number,total:c.set.total,variantRecords:source.variants_detailed.length,choices:choices.length,matcher:'exact with explicit set evidence',renderer:'generated app markup; browser not run',art:'reference URL available; pixels not asserted',price:'snapshot reference; exact live quote not checked'});
 }
 if(process.env.PILOT_REPORT_DIR){fs.mkdirSync(process.env.PILOT_REPORT_DIR,{recursive:true});fs.writeFileSync(process.env.PILOT_REPORT_DIR+'/aquapolis-card-results.json',JSON.stringify(output,null,2));}
 return {identities:exact,sourceRecords:bindings,negativeControls:186*4};
});
check('H-fractions-and-identity-boundaries',()=>{
 for(const set of ['ecard2','ecard3'])for(let i=1;i<=32;i++){
  const id=set+'-H'+String(i).padStart(2,'0'),r=raw.rows.find(r=>r[0]===id);assert(r);
  for(const number of ['H'+i,'H'+String(i).padStart(2,'0')]){const read={name:r[1],code:number+'/H32',setId:set};assert(lookupCatalog(pack,read).cands.some(c=>c.id===id&&c.exact&&textVerifiedMatch('ptcg',c,read)),id);}
  for(const denom of [set==='ecard2'?'147':'144','999'])assert(!lookupCatalog(pack,{name:r[1],code:'H'+i+'/'+denom,setId:set}).cands.some(c=>c.exact));
 }
 for(const n of ['50a','50b','74a','74b','95a','95b','103a','103b','148','149','150'])assert(raw.rows.some(r=>r[0]==='ecard2-'+n));
});
check('image-mapping-contract',()=>{
 for(const set of ['ecard2','ecard3'])for(let i=1;i<=32;i++){
  const id=set+'-H'+String(i).padStart(2,'0');assert.equal(pokemonFallback({id}),`https://images.pokemontcg.io/${set}/H${i}_hires.png`);
  if(i<10)assert(knownPokemonPlaceholder(`https://images.pokemontcg.io/${set}/H0${i}_hires.png`));
 }
 assert(!knownPokemonPlaceholder('https://images.pokemontcg.io/other/H01_hires.png'));
 assert(!knownPokemonPlaceholder('https://images.pokemontcg.io/ecard2/H10_hires.png'));
});
check('source-fallback-keys-and-persistence-dry-run',()=>{
 const source={id:'fossil-fixture',variants_detailed:[{type:'holo',thirdParty:{tcgplayer:1}},{type:'holo',foil:'cosmos',thirdParty:{tcgplayer:1}}]};
 const c={variants:pokemonVariants(source)},swapped={variants:pokemonVariants({...source,variants_detailed:[...source.variants_detailed].reverse()})};
 assert.equal(c.variants.length,2);assert.equal(new Set(c.variants.map(v=>v.key)).size,2);for(const v of c.variants)assert.equal(swapped.variants.find(x=>x.foil===v.foil).key,v.key);
 const legacy='detail:'+JSON.stringify(['holo',undefined,undefined,undefined])+':product:1';assert.equal(pokemonLegacySelection(c,legacy).status,'ambiguous');
 const stamped={type:'holo',stamp:['set-logo','prerelease'],size:'standard'};const one=pokemonVariants({variants_detailed:[stamped]}),two=pokemonVariants({variants_detailed:[{...stamped,stamp:[...stamped.stamp].reverse()}]});assert.equal(one[0].key,two[0].key,'stamp order must not change identity');
 const twins=pokemonVariants({variants_detailed:[stamped,{...stamped,stamp:[...stamped.stamp].reverse()}]});assert.equal(twins.length,1);assert.deepEqual(twins[0].sourceRecordIndexes,[0,1]);assert.equal(twins[0].sourceLiterals.length,2);
 for(const [field,value]of [['language','en'],['edition','unlimited'],['size','standard'],['stamp',[]]]){const rows=pokemonVariants({variants_detailed:[{type:'holo'},{type:'holo',[field]:value}]});assert.equal(rows.length,2,field);assert.equal(new Set(rows.map(r=>r.key)).size,2,field);}
 const legacyUnique={variants:two};assert.equal(pokemonLegacySelection(legacyUnique,two[0].legacyKey).status,two[0].legacyKey===two[0].key?'unchanged':'unique');
 const original={id:'lot-fixture',cardId:'fossil-fixture',variant:legacy,qty:3,condition:'Moderately Played',language:'ja',manualValue:0,manualValueCondition:'Moderately Played',privateNote:'fixture only'};
 const backup=JSON.stringify(original),first=pokemonLegacySelection(c,original.variant),second=pokemonLegacySelection(c,original.variant);assert.deepEqual(first,second);assert.equal(JSON.stringify(original),backup);assert.deepEqual(JSON.parse(backup),original);
 const dup=pokemonVariants({variants_detailed:[source.variants_detailed[0],source.variants_detailed[0]]});assert.equal(dup.length,1);assert.deepEqual(dup[0].sourceRecordIndexes,[0,1]);
 return {dryRunAffectedAmbiguous:1,automaticMutations:0,idempotent:true,roundTripAndRollback:true};
});
check('quote-age-and-product-conflict',()=>{
 const source={id:'base1-4',name:'Charizard',category:'Pokemon',stage:'Stage2',set:{id:'base1',name:'Base Set',cardCount:{official:102}},pricing:{tcgplayer:{updated:'2020-01-01',holofoil:{productId:42382,marketPrice:123}}}};
 const c=normalizePtcg(source),selected=setContextCard('ptcg',c,{id:'base1',name:'Base Set'},[],{variantKey:'holofoil'}),q=presentationQuote('ptcg',JSON.parse(JSON.stringify(selected)),'holofoil');assert.equal(q.sourceUpdatedAt,'2020-01-01');assert(quoteIsStale(q));assert.equal(presentationQuote('ptcg',setContextCard('ptcg',selected,{id:'base1',name:'Base Set'},[],{variantKey:''})).sourceUpdatedAt,'2020-01-01');
 assert(!quoteIsStale({checkedAt:'2020-01-01'}));assert.match(quoteTiming({checkedAt:'2020-01-01'}),/source age unknown/);
 const e={cardId:c.id,variant:'holofoil',productId:42382,condition:'Lightly Played'},now=Date.now(),good={...e,currency:'USD',price:17,priceStatus:'current',observedAt:new Date(now-1000).toISOString(),validUntil:new Date(now+864e5).toISOString()},bad={...good,productId:999999};
 assert.equal(conditionValue(null,e,[bad]).price,null);assert.equal(conditionValue(null,e,[good]).price,17);assert.equal(entryPrice({...c,conditionQuotes:[bad]},e),null);assert.equal(applyConditionQuotes(c,e,[bad]).quotes.length,0);
 assert.equal(lastKnownConditionQuote(e,[{...bad,priceStatus:'last_known'}]),null);
 assert.throws(()=>validateHistory({game:'ptcg',cardId:c.id,finish:'holofoil',series:[{source:'fixture',currency:'USD',finish:'holofoil',productId:999999,points:[]}]},{game:'ptcg',cardId:c.id,finish:'holofoil',productId:42382}),/product/);
 assert.equal(conditionValue(null,{...e,manualValue:0,manualValueCondition:'Lightly Played'},[bad]).price,0);assert.equal(conditionValue(null,e,[]).price,null);
});
check('mechanics-and-preconditioned-correction',()=>{
 const unknown=normalizePtcg({id:'fixture-1',name:'Unknown',category:'Pokemon',abilities:[{name:{de:'Nur Deutsch'},effect:'Conditional effect'}],heldItems:[{name:'Berry',effect:'Fixture held effect'}]});assert.equal(unknown.stage,'');assert.equal(unknown.basicPokemon,false);assert(!/Basic Pokémon|undefined/.test(playGuide('ptcg',unknown).tips.join(' ')));assert(!/Bench any time/.test(cardRules('ptcg',unknown).turn.join(' ')));assert.equal(unknown.heldItems[0].name,'Berry');assert(unknown.text.includes('Held item: Berry'));
 for(const stage of ['LEVEL-UP','Baby','Restored'])assert(!playGuide('ptcg',{...unknown,stage}).tips.some(t=>t.startsWith('Basic Pokémon')));
 const conditional={...unknown,stage:'Stage1',abilities:[{type:'Poke-BODY',name:'Fixture power',effect:'If this Pokémon is your Active Pokémon and is damaged, draw a card.'}],attacks:[{name:'Fixture attack',damage:30}]};assert(!/Bench it early and use its Ability every turn/.test(JSON.stringify(playGuide('ptcg',conditional))));
 const raw=snapshot.find(c=>c.id==='ecard2-109'),fixed=normalizePtcg(raw);assert.equal(raw.attacks[1].name,'Doublslap');assert.equal(fixed.attacks[1].name,'Doubleslap');assert.equal(fixed.attacks[1].sourceName,'Doublslap');assert(raw.signals===undefined);assert.equal(pack.signals.rows[raw.id].attackNames[1],'Doubleslap');assert.equal(applyPokemonCorrections({...raw,attacks:raw.attacks.map((a,i)=>i===1?{...a,name:'Changed upstream'}:a)}).attacks[1].name,'Changed upstream');
});
const failures=results.filter(r=>r.status!=='PASS');console.log(JSON.stringify({evidenceLayer:'retained snapshots + controlled actual application functions; no browser/live/phone claim',results},null,2));
if(process.env.PILOT_REPORT_DIR)fs.writeFileSync(process.env.PILOT_REPORT_DIR+'/foundation-results.json',JSON.stringify(results,null,2));
if(failures.length)process.exitCode=1;
