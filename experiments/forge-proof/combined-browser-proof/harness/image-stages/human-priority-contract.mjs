import assert from 'node:assert/strict';
export const HUMAN_SOURCE_MANIFEST='23b9220fb5fe8646ab3784a2e19c6c43d968dabed719bc8c59c88f00cc26350c';
export const HUMAN_CLASS_MANIFEST='61ad2c7b314ce2d091f96f1fb89dfffc1e7c6634058a019e49978904b660570e';
export function assertHumanPriorityReceipt(receipt){
 const p=receipt?.humanPriority;
 assert(p?.schema==='cardstashy.human-priority-receipt.v1'
   && p.sourceManifestSha256===HUMAN_SOURCE_MANIFEST && p.classManifestSha256===HUMAN_CLASS_MANIFEST
   && /^[a-f0-9]{64}$/.test(p.buildAttestationSha256||'') && !/^0+$/.test(p.buildAttestationSha256)
   && p.runtimeBytecodeVerified===true && p.assessment==='bounded-human-feasibility-tristate-v1'
   && p.uncertaintyPreservesPriority===true,'Unverified human priority runtime');
 return p;
}
