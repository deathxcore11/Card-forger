// DECK-002 inventory only. Reading an executable record never certifies a card.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {RULES_IDENTITY} from './runtime-assets.mjs';
import {PRACTICE_COVERAGE} from './practice-coverage.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const canonical=name=>String(name).normalize('NFKC').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
const bytes=await readFile(new URL('./runtime/a86578b23adcd26c/card-rules.bin',import.meta.url));
assert.equal(sha(bytes),RULES_IDENTITY.sha256);
const decoded=gunzipSync(bytes);assert.equal(sha(decoded),RULES_IDENTITY.decodedSha256);
const catalog=JSON.parse(decoded);assert.equal(Object.keys(catalog).length,RULES_IDENTITY.entries);
const mappings=new Map();for(const [key,record]of Object.entries(catalog))for(const name of [key,record.name]){const k=canonical(name);if(!mappings.has(k))mappings.set(k,new Set());mappings.get(k).add(key);}
const admitted=new Set(PRACTICE_COVERAGE.testedCardNames.map(canonical));
const selectedRequirements={
 'Ghalta, Primal Hunger':['Dynamic casting-cost reduction and minimum colored cost','Commander tax, zone choices and commander damage','Trample damage allocation'],
 'Beast Whisperer':['Creature-cast trigger and mandatory draw','Draw visibility and empty-library outcome'],
 'Birds of Paradise':['Mana-color choice','Summoning restriction and flying combat'],
 'Carnage Tyrant':['Cannot-be-countered resolution','Opponent targeting rejection from hexproof','Trample allocation'],
 'Pugnacious Hammerskull':['Attack trigger with and without another Dinosaur','Stun counter and untap replacement'],
 "Rishkar's Expertise":['Greatest-power draw calculation','Decline or choose optional free cast','Mana-value restriction and additional costs'],
 'Scavenging Ooze':['Select a card from either graveyard','Pay green mana at priority with an empty hand','Conditional counter/life gain and target invalidation'],
 'Scrapshooter':['Promise or decline gift and choose opponent','Gift draw and conditional enter trigger','Artifact/enchantment target and reach'],
 'Surrak and Goreclaw':['Trample grant to other creatures','Nontoken-enter trigger, counter and temporary haste','Haste expiry and token distinction'],
 'Thickest in the Thicket':['Enter-trigger target and power-dependent counters','Greatest-power end-step condition, ties and draw'],
 'Mosswort Bridge':['Private hideaway selection and random bottom order','Linked face-down exile identity','Power threshold and free-play permission','Spell versus land timing, land allowance and additional costs'],
 'Bite Down':['Own creature and opposing creature/planeswalker targets','Illegal-target resolution and damage source'],
 'Elvish Mystic':['Green mana activation','Summoning restriction and repeated activation rejection'],
 'Fyndhorn Elves':['Green mana activation','Summoning restriction and repeated activation rejection'],
 'Harmonize':['Three draws in order','Hidden identities and empty-library outcome'],
 "Kenrith's Transformation":['Aura target and attachment','Enter-trigger draw','Ability/type/color/base-stat layers and existing counters'],
 'Llanowar Elves':['Green mana activation','Summoning restriction and repeated activation rejection'],
 'Llanowar Tribe':['Three-green mana activation','Summoning restriction and repeated activation rejection'],
 'Monstrous Onslaught':['Cast-time greatest-power value','Multiple targets and damage allocation','Invalidated targets and legal allocation totals'],
 'Ram Through':['Ordered own/opponent creature targets','Wrong-color rejection and full-state atomicity','Trample excess, nontrample and deathtouch controls','Either target becoming illegal'],
 'Rishkar, Peema Renegade':['Zero, one or two distinct enter-trigger targets','Counter-dependent granted mana ability','Summoning restrictions for granted tap ability'],
 'Whisperer of the Wilds':['Choose available mana ability','Power-threshold condition and output','Summoning restriction'],
 'Sol Ring':['Mana ability through the interaction interface','Manual/automatic payment and tap-state preservation','Mana-only priority capability'],
 'Swiftfoot Boots':['Equip target and sorcery timing','Attachment legality, hexproof and haste','Reattachment without losing object identity'],
 'Forest':['Land allowance and legal play timing','Mana activation and payment']
};
const boundedEvidence={
 'Ghalta, Primal Hunger':['starter-pool-engine: cost reduction, trample and legend choice','DECK-001: Ram Through damage source; not full commander certification'],
 'Scavenging Ooze':['DECK-001: ooze-creature and ooze-noncreature'],
 'Ram Through':['DECK-001: paid case PASS; wrong-color atomicity FAIL'],
 'Sol Ring':['DECK-001: empty-hand-mana-ability'],
 'Llanowar Elves':['starter-pool-engine: mana activation and duplicate rejection'],
 'Forest':['Existing starter fixtures; no independent full-card certificate'],
 'Plains':['Existing coverage list and bounded payment fixtures'],
 'Giada, Font of Hope':['DECK-001: Angel payment and forbidden artifact payment'],
 'Righteous Valkyrie':['DECK-001: enters with Giada counter; own life-gain/lord abilities not tested']
};
function tags(value,out=new Set()){
 if(!value||typeof value!=='object')return out;
 for(const [key,v]of Object.entries(value)){if((key==='type'||key==='kind')&&typeof v==='string')out.add(v);else if(v&&typeof v==='object')tags(v,out);}
 return out;
}
function unsupportedPaths(value,path='',out=[]){
 if(value==='Unimplemented')out.push(path);
 else if(value&&typeof value==='object')for(const [k,v]of Object.entries(value))unsupportedPaths(v,path+'/'+k,out);
 return out;
}
const report={schema:1,task:'DECK-002',taskBase:'ed3175347bc86b346205f3cba102a73bd3494c6c',generatedAt:new Date().toISOString(),rulesDatabaseSha256:RULES_IDENTITY.sha256,entries:RULES_IDENTITY.entries,selectedMilestone:'deck-001:tramplesaurus-rex',milestoneStatus:'UNSUPPORTED',decks:[],limits:['Inventory and dependency triage, not new execution passes.','Missing exact records require an executable-data addition or verified mapping first; whether parser/engine work is additionally needed remains NOT TESTED.','Normalized-name matches are search hints, never automatic substitutions.','Present records, parser warnings and absent warnings do not prove human/CPU completion.','No list changes, runtime changes, coverage admission, browser match, history or recovery implementation.']};
for(const stem of ['tramplesaurus-rex','calling-all-angels']){
 const path='fixtures/deck-001/'+stem+'.json',source=await readFile(new URL(path,import.meta.url)),d=JSON.parse(source);
 assert.equal(d.cards.reduce((sum,c)=>sum+c.qty,0),100);assert.equal(d.cards.length,69);
 const rows=d.cards.map(c=>{
  const record=catalog[c.name.toLowerCase()],matches=[...(mappings.get(canonical(c.name))||[])],present=!!record;
  return {...c,compiledDefinition:present?'PRESENT':'MISSING',recordSha256:present?sha(JSON.stringify(record)):null,normalizedMappingCandidates:matches,
   remediation:present?'VALIDATE_EXISTING_DEFINITION':matches.length?'REVIEW_EXISTING_MAPPING':'ADD_EXECUTABLE_CARD_DATA_THEN_VALIDATE',
   additionalEngineChange:'NOT TESTED',mappingChangeProvenRequired:false,admittedByExistingCoverage:admitted.has(canonical(c.name)),
   explicitUnimplementedPaths:present?unsupportedPaths(record):[],parseWarnings:record?.parse_warnings||[],
   executableShape:present?{abilityCount:record.abilities.length,triggerCount:record.triggers.length,staticCount:record.static_abilities.length,replacementCount:record.replacements.length,keywords:record.keywords,operationTags:[...tags({abilities:record.abilities,triggers:record.triggers,staticAbilities:record.static_abilities,replacements:record.replacements})].sort()}:null,
   boundedEvidence:boundedEvidence[c.name]||[],fullCardHumanDecisions:'NOT TESTED',fullCardCpuDecisions:'NOT TESTED',
   nextDecisionFixtures:d.id===report.selectedMilestone?(selectedRequirements[c.name]||['Obtain and review the exact current card definition before specifying executable decision fixtures.']):['Deferred behind the selected complete-deck milestone; retain exact card and existing definition inventory.']};
 });
 const row={id:d.id,name:d.name,commander:d.commander,fixtureSha256:sha(source),exactListSha256:sha(JSON.stringify({format:d.format,commander:d.commander,cards:d.cards,side:d.side})),totalCards:100,uniqueNames:69,counts:{missing:rows.filter(r=>r.compiledDefinition==='MISSING').length,present:rows.filter(r=>r.compiledDefinition==='PRESENT').length,presentWithWarnings:rows.filter(r=>r.parseWarnings.length).length,missingWithMappingCandidate:rows.filter(r=>r.compiledDefinition==='MISSING'&&r.normalizedMappingCandidates.length).length,explicitUnimplemented:rows.filter(r=>r.explicitUnimplementedPaths.length).length},rows};
 assert.equal(row.counts.missing,44);assert.equal(row.counts.present,25);assert.equal(row.counts.missingWithMappingCandidate,0);
 if(d.id===report.selectedMilestone)assert(rows.filter(r=>r.compiledDefinition==='PRESENT').every(r=>selectedRequirements[r.name]));
 report.decks.push(row);
}
report.consistencyChecks={status:'PASS',exactDeckFilesUnmodified:true,totalRows:138,selectedPresentCardsWithNamedDecisionFixtures:25,coveragePromotion:false};
report.sourceSha256=sha(await readFile(new URL(import.meta.url)));
const out=resolve(process.env.CARDSTASHY_COVERAGE_OUTPUT||'test-results/deck-002');await mkdir(out,{recursive:true});
await writeFile(resolve(out,'inventory.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({selectedMilestone:report.selectedMilestone,decks:report.decks.map(d=>({name:d.name,...d.counts})),consistencyChecks:report.consistencyChecks}));
