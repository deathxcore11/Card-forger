// Execute only the wrapper's pure deadline arithmetic, never Docker/browser.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from 'node:fs';import {spawnSync}from 'node:child_process';
const script=readFileSync(new URL('./run-combined.sh',import.meta.url),'utf8');
const arithmetic=script.match(/read -r deadline active_seconds < <\(node - <<'JS'\n([\s\S]*?)\nJS/)[1];
function run(cutoff){return spawnSync(process.execPath,['-e','Date.now=()=>100000;\n'+arithmetic],{env:{...process.env,FORGE_COMBINED_JOB_CUTOFF_MS:cutoff??''},encoding:'utf8'});}
test('standalone proposal reserves60s cleanup inside38min',()=>{assert.equal(run().stdout.trim(),'2320000 2220');});
test('slow setup clips proof to absolute job cleanup cutoff',()=>{assert.equal(run('1900000').stdout.trim(),'1840000 1740');});
test('expired or excessively extended job cutoff cannot start',()=>{for(const x of ['160000','9999999999','not-a-time'])assert.notEqual(run(x).status,0);});
test('every browser case has its full envelope gate before starting',()=>{assert.match(script,/stage=desktop\nrequire_budget 900\ntimeout/);assert.match(script,/stage=touch750\nrequire_budget 205\ntimeout/);assert.match(script,/NOT TESTED: insufficient bounded stage time/);assert.match(script,/kill-after=60s/);});
