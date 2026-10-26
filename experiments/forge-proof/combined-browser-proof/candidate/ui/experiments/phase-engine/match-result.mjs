// Endings are derived only from an engine terminal plus its accepted command.
// A timeout/error in a worker or a policy is never itself a game result.
export const MATCH_END_REASONS=Object.freeze(['engine-terminal','human-concession','idle-timeout','turn-timeout','unknown']);
export function terminalOutcome(terminal,action=null){
 if(terminal===null||terminal===undefined)return null;
 if(!terminal||typeof terminal!=='object'||![null,0,1].includes(terminal.winner))throw Error('INVALID_MATCH_RESULT');
 let reason='unknown';
 if(action?.type==='HumanConcede')reason='human-concession';
 else if(action?.type==='HumanTimeoutConcede')reason=action.reason==='inactivity'?'idle-timeout':action.reason==='turn-limit'?'turn-timeout':'unknown';
 else if(typeof action?.type==='string'&&action.type.length)reason='engine-terminal';
 return {...terminal,winner:terminal.winner,reason};
}
export function journalMatchResult(journal,{matchId,snapshotDigest,format,difficulty,now=()=>Date.now()},previous=null){
 const replies=Object.values(journal.receipts||{}).filter(r=>r?.response?.revision===journal.revision).map(r=>r.response);
 const ending=replies.find(r=>r.terminal)?.terminal;
 if(!ending){if(previous)throw Error('RESULT_CONFLICT');return null;}
 if(replies.some(r=>!r.terminal||r.terminal.winner!==ending.winner))throw Error('RESULT_CONFLICT');
 const outcome=terminalOutcome(ending,journal.history?.at(-1)?.action);
 if(previous){if(previous.matchId!==matchId||previous.snapshotDigest!==snapshotDigest||previous.revision!==journal.revision||previous.winner!==outcome.winner||previous.reason!==outcome.reason)throw Error('RESULT_CONFLICT');return structuredClone(previous);}
 const finishedAt=now();if(!Number.isSafeInteger(finishedAt)||finishedAt<0)throw Error('INVALID_RESULT_TIME');
 return {matchId,revision:journal.revision,winner:outcome.winner,reason:outcome.reason,finishedAt,snapshotDigest,format,difficulty};
}
