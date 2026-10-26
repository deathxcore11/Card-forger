import test from 'node:test';import assert from 'node:assert/strict';
import {assertHumanPriorityReceipt,HUMAN_SOURCE_MANIFEST,HUMAN_CLASS_MANIFEST} from './human-priority-contract.mjs';
const valid=()=>({humanPriority:{schema:'cardstashy.human-priority-receipt.v1',sourceManifestSha256:HUMAN_SOURCE_MANIFEST,classManifestSha256:HUMAN_CLASS_MANIFEST,buildAttestationSha256:'a'.repeat(64),runtimeBytecodeVerified:true,assessment:'bounded-human-feasibility-tristate-v1',uncertaintyPreservesPriority:true}});
test('requires a bound native human affordability receipt for this descendant',()=>{assertHumanPriorityReceipt(valid());assert.throws(()=>assertHumanPriorityReceipt({}));});
for(const [key,value]of [['sourceManifestSha256','b'.repeat(64)],['classManifestSha256','b'.repeat(64)],['buildAttestationSha256','0'.repeat(64)],['runtimeBytecodeVerified',false],['assessment','AI willingness'],['uncertaintyPreservesPriority',false]]){
 test('rejects altered human priority '+key,()=>{const receipt=valid();receipt.humanPriority[key]=value;assert.throws(()=>assertHumanPriorityReceipt(receipt));});
}
