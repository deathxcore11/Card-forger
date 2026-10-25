import test from 'node:test';
import assert from 'node:assert/strict';
import {bootAcceptance} from './acceptance-inputs.mjs';
import {compiledCardSupport} from './compiled-card-support.mjs';
import {prepareMatchInput,evaluateMatchAdmission} from './match-input.mjs';
import {RULES_IDENTITY} from './runtime-assets.mjs';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
test('shipped engine admits and initializes an ordinary Commander list outside the old test pool',async()=>{
 const {engine,catalog}=await bootAcceptance(['Mountain']);
 const raw=gunzipSync(await readFile(new URL('./runtime/a86578b23adcd26c/card-rules.bin',import.meta.url))).toString('utf8');
 assert.equal(engine.load_card_database(raw),RULES_IDENTITY.entries);
 const support=compiledCardSupport(catalog,RULES_IDENTITY.decodedSha256);
 assert(support.availableCardNames.length>5000);
 assert(support.availableCardNames.includes('Grishnákh, Brash Instigator'));
 const deck={name:'Grishnákh admission fixture',format:'Commander',commander:'Grishnákh, Brash Instigator',cards:[{name:'Grishnákh, Brash Instigator',qty:1,finish:'foil',printingId:'retained-fixture'},{name:'Mountain',qty:96},{name:'Sol Ring',qty:1},{name:'Arcane Signet',qty:1},{name:'Lightning Bolt',qty:1}],side:[]};
 const input=prepareMatchInput({player:deck,opponent:deck,format:'Commander',difficulty:'Medium',runtimeIdentity:'test'}),before=structuredClone(input);
 const admission=evaluateMatchAdmission(engine,input,support);
 assert.equal(admission.admitted,true,JSON.stringify(admission));assert.deepEqual(input,before);
 const format=engine.getFormatRegistry().find(f=>f.format==='Commander').default_config;
 const started=engine.initialize_game(input.engineLists,7331,format,null,2,0);assert(Array.isArray(started.events));
 const state=engine.get_game_state().state;assert.equal(Object.values(state.objects).filter(c=>c.name===deck.commander).length,2);
 for(const seat of ['player','opponent']){const bad=structuredClone(input);bad.engineLists[seat].sideboard.push('NOT INSTALLED');const rejected=evaluateMatchAdmission(engine,bad,support);assert.equal(rejected.admitted,false);assert(rejected.seats[seat].unsupported.includes('NOT INSTALLED'));}
 console.log(JSON.stringify({rules: RULES_IDENTITY.sha256,availableNames:support.availableCardNames.length,explicitlyUnimplemented:support.unimplementedCardNames.length,grishnakhFixture:'initialized',realUserDeck:'NOT TESTED'}));
});
