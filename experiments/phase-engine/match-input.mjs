// Pure bridge from CardStashy's account/import snapshots to exact engine lists.
// Construction legality and executed-card support remain separate admissions.
const name=v=>typeof v==='string'&&v.trim().length>0&&v.length<=512?v.trim():null;
const expand=rows=>{
 if(!Array.isArray(rows)||rows.length>2500)throw Error('INVALID_DECK_ROWS');
 const names=[];for(const row of rows){if(!name(row?.name)||!Number.isSafeInteger(row.qty)||row.qty<1||row.qty>1000||names.length+row.qty>2500)throw Error('INVALID_DECK_ROW');for(let i=0;i<row.qty;i++)names.push(name(row.name));}return names;
};
export function engineDeckFromSnapshot(snapshot,format){
 if(!snapshot||!['Standard','Commander'].includes(format)||snapshot.format!==format)throw Error('FORMAT_MISMATCH');
 // CardStashy stores declared commanders inside cards AND separately. Remove
 // exactly the declared copies for the engine's separate command zone.
 const main=expand(snapshot.cards),side=expand(snapshot.side||[]);
 let commanders=[];
 if(Array.isArray(snapshot.commanders)&&snapshot.commanders.length)commanders=expand(snapshot.commanders);
 else if(name(snapshot.commander))commanders=[name(snapshot.commander)];
 if(format==='Standard'&&commanders.length)throw Error('UNEXPECTED_COMMANDER');
 if(commanders.length>2||new Set(commanders).size!==commanders.length)throw Error('INVALID_COMMANDERS');
 for(const card of commanders){const index=main.findIndex(n=>n.toLocaleLowerCase('en-US')===card.toLocaleLowerCase('en-US'));if(index<0)throw Error('COMMANDER_NOT_IN_SNAPSHOT');main.splice(index,1);}
 return {main_deck:main,sideboard:side,commander:commanders};
}
export function prepareMatchInput({player,opponent,format,difficulty,profile={},runtimeIdentity}={}){
 if(!['Easy','Medium','Hard'].includes(difficulty)||typeof runtimeIdentity!=='string'||!runtimeIdentity.length)throw Error('INVALID_MATCH_OPTIONS');
 const playerDeck=engineDeckFromSnapshot(player,format),opponentDeck=engineDeckFromSnapshot(opponent,format);
 // Preserve complete source rows/printing/finish metadata as a frozen snapshot;
 // executable name lists never replace the owner's original deck record.
 return structuredClone({schema:1,format,difficulty,runtimeIdentity,profile,
  decks:{player,opponent},engineLists:{player:playerDeck,opponent:opponentDeck}});
}
export function evaluateCardCoverage(input,{testedCardNames,coverageVersion}={}){
 if(!Array.isArray(testedCardNames)||typeof coverageVersion!=='string'||!coverageVersion)throw Error('COVERAGE_REQUIRED');
 const covered=new Set(testedCardNames.map(n=>n.toLocaleLowerCase('en-US')));
 const seats={};
 for(const seat of ['player','opponent']){
  const deck=input.engineLists[seat];
  const unsupported=[...new Set([...deck.main_deck,...deck.sideboard,...deck.commander].filter(n=>!covered.has(n.toLocaleLowerCase('en-US'))))];
  seats[seat]={unsupported,covered:unsupported.length===0};
 }
 return {coverageVersion,seats,covered:seats.player.covered&&seats.opponent.covered};
}

export function evaluateMatchAdmission(engine,input,coverage={}){
 const checked=evaluateCardCoverage(input,coverage),seats={};
 for(const seat of ['player','opponent']){
  const gate=engine.evaluateDeckFormatGate({...input.engineLists[seat],selected_format:input.format,player_count:2});
  if(typeof gate?.compatible!=='boolean'||!Array.isArray(gate.reasons))throw Error('INVALID_FORMAT_GATE');
  seats[seat]={constructionLegal:gate.compatible,reasons:[...gate.reasons],unsupported:checked.seats[seat].unsupported,admitted:gate.compatible&&checked.seats[seat].covered};
 }
 return {coverageVersion:checked.coverageVersion,seats,admitted:seats.player.admitted&&seats.opponent.admitted};
}
