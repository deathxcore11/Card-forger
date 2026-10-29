import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlaySetup} from './play-setup.js';
import {playMenuMarkup} from './play-menu.js';
import {forgeCpuPolicy,forgeMatchDifficulty} from './play-forge-cpu-policy.js';
import {readCpuOptions} from './play-cpu-options.js';

test('Practice offers Easy, Normal and Hard; Quick Play always plays the Normal CPU',()=>{
 const setup=createPlaySetup({readAccount:()=>({user:{id:'owner'},profile:{username:'Randall'}}),readDecks:()=>[],parseImport:()=>({})});
 const html=playMenuMarkup(setup.snapshot(),{engine:'forge',matchReleaseReady:true});
 assert.doesNotMatch(html,/id="playDifficulty"|Experimental beta|Medium CPU|Easy CPU|Hard CPU|CPU piloting/);
 assert.match(html,/aria-label="CPU difficulty"/);assert.match(html,/data-play-value="Medium" aria-pressed="true">Normal</);
 assert.match(html,/Practice/);assert.match(html,/@Randall/);const home=playMenuMarkup(setup.snapshot(),{engine:'forge',matchReleaseReady:true,view:'home'});assert.match(home,/Quick Play/);assert.match(home,/Practice/);assert.match(home,/Planeswalk/);
 setup.setPlayStyle('quick');assert.doesNotMatch(playMenuMarkup(setup.snapshot(),{engine:'forge',matchReleaseReady:true}),/data-play-option="difficulty"/);
 assert.deepEqual(readCpuOptions({engine:'forge'}),['Easy','Medium','Hard']);
 assert.deepEqual(forgeCpuPolicy(),{difficulty:'Medium',difficultyPolicyVersion:'forge-heuristic-medium-beta-v1',label:'CPU'});
 assert.equal(forgeCpuPolicy('Hard').difficultyPolicyVersion,'forge-heuristic-hard-beta-v2');
 assert.equal(forgeMatchDifficulty({playStyle:'quick',match:{difficulty:'Hard'}}),'Medium');
 assert.equal(forgeMatchDifficulty({playStyle:'practice',match:{difficulty:'Easy'}}),'Easy');
 assert.throws(()=>forgeCpuPolicy('Expert'),error=>error.code==='FORGE_CPU_DIFFICULTY_UNAVAILABLE');
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
