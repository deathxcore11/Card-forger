import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_GATES, evaluateReadiness } from '../scripts/check-release-readiness.mjs';
test('missing or superficial evidence cannot authorize a full-feature release', () => {
 assert.equal(evaluateReadiness().releaseReady, false);
 assert.equal(evaluateReadiness({gates: Object.fromEntries(REQUIRED_GATES.map(name => [name, {passed:true}]))}).releaseReady, false);
});
test('every gate requires both pass and a specific evidence reference', () => {
 const evidence={gates:Object.fromEntries(REQUIRED_GATES.map(name=>[name,{passed:true,evidence:'test-fixture-only'}]))};
 assert.equal(evaluateReadiness(evidence).releaseReady,true);
 evidence.gates.accountCallbacks.passed=false;
 assert.deepEqual(evaluateReadiness(evidence).failures,['accountCallbacks']);
});
