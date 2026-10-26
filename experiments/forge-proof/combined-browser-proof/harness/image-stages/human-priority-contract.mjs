import assert from 'node:assert/strict';
export const HUMAN_SOURCE_MANIFEST='808b643d01c0c8fe63344733725c77e8c504e1f566453386c6cbfc36c95e40bc';
export const HUMAN_CLASS_MANIFEST='89975e8a8bff75923f977c28ebd8341990744205c07cc3a504509c7d7647c1ee';
export function assertHumanPriorityReceipt(receipt){
 const p=receipt?.humanPriority;
 assert(p?.schema==='cardstashy.human-priority-receipt.v1'
   && p.sourceManifestSha256===HUMAN_SOURCE_MANIFEST && p.classManifestSha256===HUMAN_CLASS_MANIFEST
   && /^[a-f0-9]{64}$/.test(p.buildAttestationSha256||'') && !/^0+$/.test(p.buildAttestationSha256)
   && p.runtimeBytecodeVerified===true && p.assessment==='bounded-human-feasibility-tristate-v1'
   && p.uncertaintyPreservesPriority===true,'Unverified human priority runtime');
 return p;
}
