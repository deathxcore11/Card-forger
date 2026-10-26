import assert from 'node:assert/strict';import {realpath,lstat,readFile} from 'node:fs/promises';
async function readBounded(p,max){const s=await lstat(p);assert(s.isFile()&&!s.isSymbolicLink()&&s.size>0&&s.size<=max,'Bounded regular public fixture required');return readFile(p);}import {sha256} from '../local-oci/oci-identity.mjs';import {PINS} from './pins.mjs';
// Public exact fixture data only; never save a runtime token or probe POST body.
export async function publicMediumInput(file,expectedFileSha256){
 const bytes=await readBounded(file,512*1024);if(expectedFileSha256)assert(sha256(bytes)===expectedFileSha256,'Public fixture file changed');
 const fixtures=JSON.parse(bytes),humanDeck=fixtures.decks?.[0],opponentDeck=fixtures.decks?.[1];
 assert(sha256(JSON.stringify(humanDeck))===PINS.humanDeckSha256&&sha256(JSON.stringify(opponentDeck))===PINS.opponentDeckSha256,'Exact public browser deck digests changed');
 assert(humanDeck.format==='Commander'&&opponentDeck.format==='Commander','Unexpected exact fixture format');
 return {input:{format:'Commander',humanDeck,opponentDeck,difficultyPolicyVersion:PINS.policyVersion},reference:{path:await realpath(file),sha256:sha256(bytes)}};
}
