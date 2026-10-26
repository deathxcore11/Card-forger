import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlaySetup} from './play-setup.js';
import {playMenuMarkup} from './play-menu.js';
import {forgeCpuPolicy} from './play-forge-cpu-policy.js';
import {readCpuOptions} from './play-cpu-options.js';

test('native setup exposes one normal CPU with no difficulty control or tier labels',()=>{
 const setup=createPlaySetup({readAccount:()=>({user:{id:'owner'},profile:{username:'Randall'}}),readDecks:()=>[],parseImport:()=>({})});
 const html=playMenuMarkup(setup.snapshot(),{engine:'forge',matchReleaseReady:true});
 assert.doesNotMatch(html,/id="playDifficulty"|data-play-option="difficulty"|Experimental beta|Medium CPU|Easy CPU|Hard CPU|CPU piloting/);
 assert.match(html,/Quick Play/);assert.match(html,/Practice/);assert.match(html,/@Randall/);
 assert.deepEqual(readCpuOptions({engine:'forge'}),['Medium']);
 assert.deepEqual(forgeCpuPolicy(),{difficulty:'Medium',difficultyPolicyVersion:'forge-heuristic-medium-beta-v1',label:'CPU'});
 assert.throws(()=>forgeCpuPolicy('Hard'),error=>error.code==='FORGE_CPU_DIFFICULTY_UNAVAILABLE');
});

test('practice starting preference is account-scoped and Quick Play always returns to random',()=>{
 let owner='one';const setup=createPlaySetup({readAccount:()=>({user:{id:owner}}),readDecks:()=>[],parseImport:()=>({})});
 assert.equal(setup.snapshot().match.startingPlayer,'random');
 setup.configure({startingPlayer:'second'});assert.equal(setup.snapshot().match.startingPlayer,'second');
 setup.setPlayStyle('quick');assert.equal(setup.snapshot().match.startingPlayer,'random');
 setup.configure({startingPlayer:'first'});assert.equal(setup.snapshot().match.startingPlayer,'random');
 setup.setPlayStyle('practice');setup.configure({startingPlayer:'first'});assert.equal(setup.snapshot().match.startingPlayer,'first');
 setup.configure({startingPlayer:'invalid'});assert.equal(setup.snapshot().match.startingPlayer,'first');
 owner='two';assert.equal(setup.snapshot().match.startingPlayer,'random');
});
