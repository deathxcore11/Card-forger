import assert from 'node:assert/strict';
export const HUMAN_SOURCE_MANIFEST='a51adddc0000ee80916fb290bb7e31514181b5373b033866bf43ad49cad64f9c';
export const HUMAN_CLASS_MANIFEST='e22e7d45a8a7f2aee5bedc168d2ca6d500a7e5894797ee7418bfcbdb93e1ab69';
export function assertHumanPriorityReceipt(receipt){
 const p=receipt?.humanPriority;
 assert(p?.schema==='cardstashy.human-priority-receipt.v1'
   && p.sourceManifestSha256===HUMAN_SOURCE_MANIFEST && p.classManifestSha256===HUMAN_CLASS_MANIFEST
   && /^[a-f0-9]{64}$/.test(p.buildAttestationSha256||'') && !/^0+$/.test(p.buildAttestationSha256)
   && p.runtimeBytecodeVerified===true && p.assessment==='bounded-human-feasibility-tristate-v1'
   && p.uncertaintyPreservesPriority===true,'Unverified human priority runtime');
 return p;
}
