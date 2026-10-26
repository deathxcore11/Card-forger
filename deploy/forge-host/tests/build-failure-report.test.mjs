import test from 'node:test';
import assert from 'node:assert/strict';
import {safeProbeFailure} from '../scripts/report-build-failure.mjs';

test('startup diagnostics allow only fixed categories and booleans, never raw native details',()=>{
  const summary={input:'PRIVATE_CANARY',state:{hand:'PRIVATE_CANARY'},startupObservation:{status:'failed',awaitingChoice:true,nativeRosterVerified:true,pregameCommitted:false,failureCategory:'native_start_failed',failure:'PRIVATE_CANARY',prompt:'PRIVATE_CANARY',token:'PRIVATE_CANARY'}};
  assert.deepEqual(safeProbeFailure(summary),{status:'failed',awaitingChoice:true,nativeRosterVerified:true,pregameCommitted:false,failureCategory:'native_start_failed'});
  assert(!JSON.stringify(safeProbeFailure(summary)).includes('PRIVATE_CANARY'));
  assert.equal(safeProbeFailure({startupObservation:{status:'PRIVATE_CANARY'}}),null);
  assert.deepEqual(safeProbeFailure({startupObservation:{status:'failed',awaitingChoice:'PRIVATE_CANARY',failureCategory:'PRIVATE_CANARY'}}),{status:'failed',awaitingChoice:false,nativeRosterVerified:false,pregameCommitted:false,failureCategory:null});
});
