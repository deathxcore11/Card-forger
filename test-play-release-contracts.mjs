import test from 'node:test';
import assert from 'node:assert/strict';
import {practiceEndingText,practiceAdmissionSummary} from './play-player-mat.js';
import {commanderDetailLines} from './experiments/phase-engine/match-table.mjs';
test('end screen distinguishes authoritative timeouts and concessions without inventing an ending',()=>{
 assert.match(practiceEndingText({reason:'idle-timeout'}),/inactivity/);
 assert.match(practiceEndingText({reason:'turn-timeout'}),/turn time/);
 assert.match(practiceEndingText({reason:'human-concession'}),/conceded/);
 assert.match(practiceEndingText({reason:'engine-terminal'}),/rules/);
 assert.match(practiceEndingText({winner:0}),/unavailable/);
});
test('commander inspector displays only supplied facts for the selected visible object',()=>{
 const view={seat:0,commander:{version:1,coverage:'visible-public-objects',commanders:[{id:5,tax:2,castCount:1},{id:6,tax:null,castCount:null}],damage:[{commanderId:5,player:1,amount:12}]}};
 assert.deepEqual(commanderDetailLines(view,5),['Commander','Command-zone tax: 2 generic mana','Cast from command zone: 1','Commander damage to CPU: 12']);
 assert.deepEqual(commanderDetailLines(view,6),['Commander']);
 assert.deepEqual(commanderDetailLines(view,7),[]);
 assert.deepEqual(commanderDetailLines({commander:{...view.commander,version:2}},5),[]);
});

test('admission recovery distinguishes missing, unfinished and format issues and collapses identical CPU failures',()=>{
 const seat={admitted:false,unsupported:['Missing','Unfinished'],reasons:['Missing: card rules are not installed.','Unfinished: a required rule is not implemented.','Forest: unknown in Standard','Missing: card rules are not installed.']};
 const summary=practiceAdmissionSummary({seats:{player:seat,opponent:structuredClone(seat)}});
 assert.match(summary.title,/isn’t supported/);assert.deepEqual(summary.lines,['Your deck: 1 missing definition · 1 card with unfinished rules · 1 format or identity issue.','CPU deck: Same issues as your deck.']);assert.equal(summary.details.length,3);
 const format=practiceAdmissionSummary({seats:{player:{admitted:false,unsupported:[],reasons:['Too few cards']},opponent:{admitted:true,unsupported:[],reasons:[]}}});assert.match(format.title,/deck format/);assert.match(format.lines[1],/checks passed/);
});
