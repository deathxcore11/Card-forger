// Explicit beta mode: one worker owns one non-resumable match. This record
// never opens IndexedDB and never changes an earlier durable match.
import {journalMatchResult} from './match-result.mjs';
import {practiceKey,validatePracticeInput,snapshotDigest,canonical} from './practice-record.mjs';

export async function openPracticeSessionRecord({ownerId,matchId,input,now=()=>Date.now()}={}){
 practiceKey(ownerId,matchId);
 const frozen=structuredClone(validatePracticeInput(input)),digest=await snapshotDigest(frozen);
 let journal=null,result=null,presentation={},closed=false;
 const assertOpen=()=>{if(closed)throw Error('MATCH_STORE_CLOSED');};
 const storage={
  async read(){assertOpen();return journal===null?undefined:structuredClone(journal);},
  async write(next,expected){
   assertOpen();
   if((journal?.revision??null)!==expected)throw Error('WRITE_CONFLICT');
   if(!next||!Number.isSafeInteger(next.revision)||next.revision<0||next.revision>20000||!Array.isArray(next.history)||!next.receipts||typeof next.receipts!=='object'||Array.isArray(next.receipts))throw Error('INVALID_MATCH_JOURNAL');
   // Clone before acknowledging, so the authority/caller cannot later mutate
   // an accepted receipt or the saved position through a shared reference.
   const nextResult=journalMatchResult(next,{matchId,snapshotDigest:digest,format:frozen.format,difficulty:frozen.difficulty,now},result);
   journal=structuredClone(next);result=nextResult;
  }
 };
 return {input:structuredClone(frozen),digest,storage,
  getResult(){assertOpen();return structuredClone(result);},
  getPresentation(){assertOpen();return structuredClone(presentation);},
  setPresentation(value){assertOpen();if(journal!==null)throw Error('ALREADY_EXISTS');canonical(value);presentation=structuredClone(value);},
  close(){closed=true;journal=null;result=null;presentation={};}
 };
}
