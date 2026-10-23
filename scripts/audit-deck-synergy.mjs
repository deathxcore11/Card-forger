// Read-only diagnostic against the production modules. No provider/AI/account writes.
// Real Scryfall records test semantics; synthetic prices/fillers isolate construction gates.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {S,blank} from '../store.js';
import * as T from '../tcg.js';
import {cardKey,cardPrice} from '../core.js';
import {setMtgTags} from '../mtg-tags.js';
import {commanderTheme,tribalSupport,themeSupport} from '../planner.js';
import {scoreCard,requestedIntent,themeQuery} from '../builder.js';
import {mtgTags} from '../pairing.js';
import {engineMap} from '../engine-map.js';
import {readBuildContract,applyUserBuildIntent,validateBuildProposal} from '../ai-build-contract.js';
import {TOOLS} from '../ai-ask-route.js';
import {normalizeDeckRequest,chooseDeck,inspectDeckPlan} from '../deck-construction.js';
import {createDeckPipeline} from '../deck-pipeline.js';
import {makeAskTools} from '../ai-tools.js';
const root=new URL('../tests/fixtures/ai-synergy-audit/',import.meta.url);
const load=n=>JSON.parse(fs.readFileSync(new URL(n+'.json',root)));
const cards=Object.fromEntries(fs.readdirSync(root).filter(n=>n.endsWith('.json')&&n!=='provenance.json').map(n=>{const c=JSON.parse(fs.readFileSync(new URL(n,root)));return [c.name,c];}));
setMtgTags(JSON.parse(fs.readFileSync(new URL('../mtg-tags.json',import.meta.url))));
globalThis.fetch=async()=>{throw Error('No network is allowed in this diagnostic');};
const report={baseline:'5b98a8981f9b97e7e0c4fbc02847b0cc3f248876',scope:'Production deterministic code; real Scryfall snapshots; mocked discovery/prices/fillers. No live language-model quality or competitive strength claim.',observations:{},controls:{}};
const o=report.observations;
report.controls.catPayoffDetected=commanderTheme(cards['Arahbo, Roar of the World']).tribes.includes('Cat');
report.controls.changelingAcceptedByTribalHelper=tribalSupport(cards['Changeling Outcast'],'Cat');
assert(report.controls.catPayoffDetected&&report.controls.changelingAcceptedByTribalHelper);
const baseArgs={game:'mtg',format:'Modern',style:'artifacts',budget:700,budget_basis:'total',goal:'strongest',colors:['W'],required_cards:[],excluded_cards:[],candidate_cards:[],avoid_infinite:false};
o.intentRetention=[];
for(const [request,proposedStyle] of [['Build me a mono-white Modern Cats deck under $700','artifacts'],['Build me a mono-white Modern deck under $700 with lifelink and Angels','Angels']]){
 const contract=readBuildContract([{type:'message',role:'user',content:request}]);
 const proposed=applyUserBuildIntent({...baseArgs,style:proposedStyle},contract),checked=validateBuildProposal(proposed,contract);
 o.intentRetention.push({request,retainedThemes:contract.themes,proposedStyle:proposed.style,acceptedAfterDroppingRequestedPreference:checked.ok});
 assert(checked.ok);
}
const taint=cards['Tainted Remedy'],valk=cards['Righteous Valkyrie'];
o.lifegain={taintedRemedySupport:themeSupport(taint,{roles:['Lifegain']}),taintedRemedyThemeBonus:scoreCard(taint,['Lifegain'],[],{size:60})-scoreCard(taint,[],[],{size:60}),valkyrieProvidesLife:mtgTags(valk).provides.has('lifegain'),valkyrieTribalNeeds:[...mtgTags(valk).needs].filter(n=>n.startsWith('sub:'))};
assert(o.lifegain.taintedRemedyThemeBonus>0&&!o.lifegain.valkyrieProvidesLife);
const changeling=cards['Changeling Outcast'];
o.changeling={tribalHelper:tribalSupport(changeling,'Cat'),pairingProvidesCat:mtgTags(changeling).provides.has('sub:Cat')};
assert(o.changeling.tribalHelper&&!o.changeling.pairingProvidesCat);
const rows=['Soul Warden',"Ajani's Pridemate",'Hushbringer','Torpor Orb'].map(name=>({c:cards[name],card:cards[name],name,qty:1,zone:'main'}));
const basic={name:'Plains',type_line:'Basic Land — Plains',color_identity:['W'],colors:[],produced_mana:['W'],oracle_text:'{T}: Add {W}.',mana_cost:'',cmc:0,legalities:{modern:'legal',commander:'legal'},prices:{usd:'.10'}};
const engine=engineMap('mtg',rows);
const plan=inspectDeckPlan({game:'mtg'},[...rows,{c:basic,card:basic,name:basic.name,qty:24,zone:'main'}]);
o.selfInterference={soulWardenStillListedAsLifeProvider:engine.links.some(l=>l.payoff==="Ajani's Pridemate"&&l.providers.some(p=>p.name==='Soul Warden')),planIssues:plan.issues,unsupported:engine.unsupported,limit:'Hushbringer/Torpor Orb suppress creature-entering triggers while present; the list can sequence around them, but the recognized link carries no such condition or self-conflict warning.'};
assert(o.selfInterference.soulWardenStillListedAsLifeProvider&&!plan.issues.length);
o.matchup={buildToolFields:Object.keys(TOOLS.find(t=>t.name==='build_deck').parameters.properties),savedDeckToolFields:Object.keys(TOOLS.find(t=>t.name==='my_decks').parameters.properties)};
assert(!o.matchup.buildToolFields.some(f=>/opponent|matchup|rival/i.test(f)));
const request=normalizeDeckRequest({game:'mtg',format:'Modern',budget:700,goal:'strongest'},{mtg:[{id:'modern',name:'Modern'}]});
const candidate=(id,cost,owned,score)=>({deck:{id},check:{complete:true,legal:true},plan:{issues:[],setupBurden:0},pricing:{estimate:cost,subtotal:cost,unpriced:0,ownedCopies:owned,copies:60},power:{score}});
const expensive=chooseDeck([candidate('over-hard-cap',900,0,50)],request);
const ownership=chooseDeck([candidate('higher-assessed-power',600,0,90),candidate('more-owned',600,60,20)],request);
o.budgetGate={ok:expensive.ok,status:expensive.budgetStatus,delta:expensive.delta,allowance:request.allowance};
o.selectionPriority={defaultPreferOwned:request.preferOwned,winner:ownership.deck.id,limit:'Comparator diagnostic with controlled assessment values, not an actual 90-versus-20 competitive deck comparison.'};
assert(expensive.ok&&expensive.budgetStatus==='outside-target'&&ownership.deck.id==='more-owned');
// Complete production pipeline: one real noncommander Cat exists in a deliberately
// thin pool. Discovery is mocked to return this exact pool, never claim it is Scryfall search output.
S.state=blank();S.catalog={};
const leader={...cards['Arahbo, Roar of the World'],prices:{usd:'2'}},cat={...cards['Leonin Vanguard'],prices:{usd:'.25'}};
const forest={...basic,name:'Forest',type_line:'Basic Land — Forest',color_identity:['G'],produced_mana:['G'],oracle_text:'{T}: Add {G}.'};
const pool=[leader,cat,basic,forest,...Array.from({length:80},(_,i)=>({name:'Synthetic audit filler '+i,type_line:'Artifact',color_identity:[],colors:[],mana_cost:'{2}',cmc:2,oracle_text:i%3===0?'Draw a card.':i%3===1?'{T}: Add {C}.':'Destroy target artifact.',legalities:{commander:'legal',modern:'legal'},prices:{usd:'.25'}}))];
for(const c of pool)S.catalog[cardKey(c.name)]=c;
const queries=[];
const x={S,T,tcgCtx:{},meta:n=>S.catalog[cardKey(n)],resolve:async n=>S.catalog[cardKey(n)],cacheCard:c=>(S.catalog[cardKey(c.name)]=c),inv:()=>({available:0}),priceOf:n=>cardPrice(S.catalog[cardKey(n)]),api:async path=>{queries.push(path);return {data:pool,has_more:true,next_page:'https://audit.invalid/second-page'};}};
const pipeline=createDeckPipeline(x);
const input={game:'mtg',format:'Commander',seed:leader.name,commander:leader.name,theme:'Cats',style:'Cats',goal:'theme',budget:700,preferOwned:false,budget_basis:'total'};
const built=await pipeline.build(input);
assert(built.ok,built.message);
o.thinThemePool={ok:built.ok,total:built.rows.reduce((s,r)=>s+r.qty,0),nonCommanderCats:built.rows.filter(r=>r.name!==leader.name&&tribalSupport(r.card,'Cat')).reduce((s,r)=>s+r.qty,0),planIssues:built.plan.issues,check:built.check,budgetStatus:built.budgetStatus,queries:queries.map(p=>new URL(p,'https://audit.invalid').searchParams.get('q')),followedNextPage:queries.some(p=>p.includes('second-page'))};
assert(o.thinThemePool.nonCommanderCats===1&&!o.thinThemePool.planIssues.length&&!o.thinThemePool.followedNextPage);
// Exercise the actual Ask tool's active shared-pipeline branch with this result.
const tools=makeAskTools({...x,deckExperience:{build:async()=>({...built,budgetStatus:'outside-target',delta:200}),register:()=> 'audit-only',markup:()=>''}});
const answer=await tools.build_deck({...baseArgs,format:'Commander',seed:leader.name,commander:leader.name,colors:['W','G'],style:'Cats'});
o.toolReadySemantics={ready:answer.ready,complete:answer.complete,budgetStatus:answer.budgetStatus,hasThemeValidation:Object.hasOwn(answer,'themeVerified'),note:answer.note};
assert(answer.ready&&answer.budgetStatus==='outside-target');
const out=new URL('../docs/audits/ai-deck-synergy-observations.json',import.meta.url);
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({diagnostic:'OBSERVATIONS_REPRODUCED',controls:report.controls,observations:o},null,2));
