// Ask a Judge without AI: a question is read into the rulebook's own terms and answered with the exact rule text.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';
import {validateServerRuleText} from './rules-retrieval.js';
import {judgeAnswer,judgeIndex,readTerms} from './judge-search.js';
import {PTCG_GLOSSARY,YGO_GLOSSARY} from './game-glossary-data.js';
const load=async g=>validateServerRuleText(gunzipSync(readFileSync(new URL(`./rulebooks/${g}-rules-v1.json.gz`,import.meta.url))).toString(),g);
const mtg=await load('mtg'),ask=(q,o)=>judgeAnswer(mtg,q,o),top=(a,n=3)=>[a.lead,...a.rules].filter(Boolean).slice(0,n);
assert.ok(judgeIndex(mtg).concepts.size>700,'the glossary and section headings become terms');
assert.deepEqual(readTerms(mtg,'does deathtouch work with trample').map(t=>t.label),['Deathtouch','Trample']);
// Player words reach the rule by its wording, never by a hard-coded number.
let a=ask('can a creature attack the turn it enters');assert.equal(a.status,'answered');assert.match(a.lead.text,/can’t attack unless it has been under its controller’s control continuously/);assert.ok(top(a).some(r=>/has haste, it can attack/.test(r.text)),'haste is shown beside it');
a=ask('do tokens have summoning sickness');assert.match(a.lead.text,/can’t attack unless/);
a=ask('how does the legend rule work');assert.ok(top(a,2).some(r=>/two or more legendary permanents with the same name/.test(r.text)));
a=ask('what happens if i have no cards in my library');assert.match(a.lead.text,/draw a card from a library with no cards in it/);
a=ask('can i respond to a land being played');assert.match(a.lead.text,/Playing a land is a special action; it doesn’t use the stack/);
a=ask('how many lands can i play each turn');assert.match(a.lead.text,/normally play one land/);
a=ask('if my commander dies can i put it in the command zone');assert.match(a.lead.text,/commander is in a graveyard or in exile.*command zone/);
a=ask('do i draw on the first turn');assert.match(a.lead.text,/plays first skips the draw step/);
a=ask('can i respond to a mana ability');assert.match(a.lead.text,/mana ability doesn’t go on the stack/);
// One keyword: its own rule. Two keywords: one rule from each, joined by the term they share.
a=ask('how does ward work');assert.match(a.lead.text,/^Ward is a triggered ability/);assert.equal(a.lead.heading,'Ward');assert.equal(a.terms[0].label,'Ward');
a=ask('does deathtouch work with trample');assert.match(a.lead.text,/source with deathtouch is considered to be lethal damage/);assert.match(a.rules[0].text,/creature with trample first assigns damage/);
a=ask('can a creature with reach block a flyer');assert.match(a.lead.text,/flying can’t be blocked except by creatures with flying and\/or reach/);
a=ask('does flying beat menace');assert.deepEqual(top(a,2).map(r=>r.heading).sort(),['Flying','Menace']);
// "Does it stack?" is about two of the same keyword, not the stack zone.
a=ask('does lifelink stack');assert.equal(a.lead.text,'Multiple instances of lifelink on the same object are redundant.');
a=ask('do two instances of prowess stack');assert.match(a.lead.text,/each triggers separately/);
a=ask('how does double strike work with lifelink');assert.doesNotMatch(a.lead.text,/redundant/,'the word double inside a keyword is not a count');
// A rule number is answered with that rule; every passage carries a reference the Rules page can open.
a=ask('what is 704.5j');assert.equal(a.lead.number,'704.5j');assert.equal(a.lead.reference.kind,'bundled-entry');
// Not a rules question: nothing is made up.
for(const q of['is blue better than red','what beats eldrazi'])assert.equal(ask(q).status,'none',q);
// Cards the caller holds: printed keywords join the question, and official rulings that speak to it are picked.
a=ask('can this block a flyer',{cards:[{name:'Giant Spider',text:'Reach',keywords:['Reach'],rulings:[{date:'2020-01-01',text:'Reach lets it block creatures with flying.'},{date:'2020-01-02',text:'Unrelated note about art.'}]}]});
assert.ok(top(a).some(r=>r.heading==='Reach'));assert.deepEqual(a.cards[0].rulings.map(r=>r.date),['2020-01-01']);
// Pokémon and Yu-Gi-Oh!: rulebook pages cut to the sentences asked about, plus the app's own term note marked as ours.
const ptcg=await load('ptcg'),ygo=await load('ygo');
a=judgeAnswer(ptcg,'what does poisoned do',{format:'Standard',glossary:PTCG_GLOSSARY});assert.match(a.lead.text,/During Pokémon Checkup, place a damage counter on your Poisoned Pokémon/);assert.ok(a.lead.text.length<600);assert.equal(a.terms[0].ours,true);
a=judgeAnswer(ygo,'can i attack on the first turn',{glossary:YGO_GLOSSARY});assert.match(a.lead.text,/goes first cannot conduct their Battle Phase on their first turn/);
console.log('judge-search: questions are answered with exact rule text, from the rulebook alone');
