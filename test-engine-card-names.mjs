// Release check: every deck the app can hand the engine uses names the engine knows.
// Root cause of "opponent:unknown_card:Wear/Tear" (4.3.34): Magic Online lists spell
// split cards "Wear/Tear", Forge only reads "Wear // Tear", and nothing checked the
// random CPU deck against Forge's card list before the table opened.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {engineCardName,engineDeck,engineUnknownCards,loadEngineCardNames,ENGINE_CARD_NAMES_FILE} from './play-engine-names.js';
import {exactForgeInput,FORGE_REVISION} from './play-forge-host-client.js';
import {normalizeMtgo,parseMtgtop8Export} from './mtgmeta.js';
import {PRACTICE_STARTER_ROWS} from './play-starter-deck.js';

const listed=readFileSync(new URL('./'+ENGINE_CARD_NAMES_FILE,import.meta.url),'utf8').split('\n').filter(Boolean);
const names=new Set(listed.map(n=>n.toLowerCase()));

// The list belongs to the engine the app and host run; a new engine needs a new list.
assert.ok(ENGINE_CARD_NAMES_FILE.includes(FORGE_REVISION.slice(0,8)),'Regenerate the engine card names for Forge '+FORGE_REVISION);
const rules=JSON.parse(readFileSync(new URL('./forge-rules/current/manifest.json',import.meta.url),'utf8'));
assert.equal(rules.engineRevision,FORGE_REVISION,'Rules data and engine card names must come from the same Forge build');
assert.ok(names.size>30000,'engine card name list is incomplete');

// Every real name already in Forge's spelling stays exactly as it is.
const changed=listed.filter(n=>engineCardName(n)!==n);
assert.deepEqual(changed,[],'engineCardName changes real card names (add any new slash name to SLASH_NAMES)');

// Spellings seen in the sources the app reads; each must reach a name Forge accepts.
for(const [input,expected] of [
 ['Wear/Tear','Wear // Tear'],['Fire/Ice','Fire // Ice'],['Fire / Ice','Fire // Ice'],['Fire//Ice','Fire // Ice'],
 ['Brazen Borrower/Petty Theft','Brazen Borrower // Petty Theft'],['Commit/Memory','Commit // Memory'],
 ['Jace’s Erasure',"Jace's Erasure"],['“Ach! Hans, Run!”','"Ach! Hans, Run!"'],['  Lightning   Bolt ','Lightning Bolt'],
 ['Summon: Choco/Mog','Summon: Choco/Mog'],['SP//dr, Piloted by Peni','SP//dr, Piloted by Peni'],['Detect Intrusion','Spider-Sense'],['Æther Vial','Aether Vial'],['Junún Efreet','Junún Efreet'],
]){
 assert.equal(engineCardName(input),expected,input);
 assert.ok(names.has(expected.toLowerCase()),expected+' is not a name Forge accepts');
}

// Magic Online feeds: the meta source behind the failed match.
const mtgo=normalizeMtgo([{event_id:1,type:'TOURNAMENT',description:'Legacy Challenge',starttime:'2026-10-28',player_count:{players:64},site_name:'legacy-challenge',final_rank:[{loginid:7,rank:1}],decklists:[{loginid:7,
 main_deck:[{qty:4,card_attributes:{card_name:'Brainstorm',card_type:'ISPEL'}},{qty:56,card_attributes:{card_name:'Island',card_type:'LAND'}}],
 sideboard_deck:[{qty:1,card_attributes:{card_name:'Wear/Tear',card_type:'ISPEL'}},{qty:2,card_attributes:{card_name:'Fire/Ice',card_type:'ISPEL'}}]}]}],{format:'Legacy',days:14});
assert.deepEqual(mtgo.decks[0].side.map(r=>r.name),['Wear // Tear','Fire // Ice']);
// MTGTop8 feeds keep real slash names and accents.
const top8=parseMtgtop8Export(['1 Summon: Choco/Mog','1 Wear/Tear','97 Mountain','Sideboard','1 Krenko, Mob Boss'].join('\n'));
assert.deepEqual(top8.main.map(r=>r.name),['Summon: Choco/Mog','Wear // Tear','Mountain']);

// The one place names are fixed before the engine: both seats, commanders and pods.
const deck=(cards,extra={})=>({format:'Legacy',cards,side:[{name:'Wear/Tear',qty:1}],...extra});
const setup={match:{mode:'cpu',format:'Legacy',difficulty:'Medium'},playStyle:'quick',selected:deck([{name:'Island',qty:60}]),opponent:deck([{name:'Fire/Ice',qty:4},{name:'Mountain',qty:56}])};
const input=exactForgeInput(setup);
assert.deepEqual(input.opponentDeck.side.map(r=>r.name),['Wear // Tear']);
assert.equal(input.opponentDeck.cards[0].name,'Fire // Ice');
assert.equal(setup.opponent.cards[0].name,'Fire/Ice','the saved deck itself is never rewritten');
assert.equal(engineDeck({format:'Commander',commander:'Wear/Tear',commanders:['Fire/Ice'],cards:[]}).commanders[0],'Fire // Ice');

// Quick Play's filter: a deck with a card Forge lacks is refused before it is offered.
assert.deepEqual(engineUnknownCards(setup.opponent,names),[]);
assert.deepEqual(engineUnknownCards(deck([{name:'Not A Real Card',qty:60}]),names),['Not A Real Card']);
assert.deepEqual(engineUnknownCards(setup.opponent,null),[],'without the list the engine itself still checks at start');
const loaded=await loadEngineCardNames({fetchImpl:async()=>new Response(listed.join('\n'))});
assert.equal(loaded.size,names.size);

// Every deck the app ships itself.
assert.deepEqual(engineUnknownCards({cards:PRACTICE_STARTER_ROWS},names),[]);

console.log('engine card names: '+names.size+' names, every source spelling reaches the engine');
