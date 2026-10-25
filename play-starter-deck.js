// An explicit beta list, never a replacement for a saved/imported owner deck.
export const PRACTICE_STARTER_NAME='Green creatures · Beta starter';
export const PRACTICE_STARTER_ROWS=Object.freeze([
 Object.freeze({name:'Forest',qty:24}),
 ...['Llanowar Elves','Bear Cub','Ordinary Bear','Ghalta, Primal Hunger','Lashwhip Predator','Tarmogoyf','Tapestry Warden','Virulent Emissary','Scarecrow Guide'].map(name=>Object.freeze({name,qty:4}))
]);
export const PRACTICE_STARTER_TEXT='Deck\n'+PRACTICE_STARTER_ROWS.map(row=>row.qty+' '+row.name).join('\n');
export async function selectPracticeStarter(setup){
 setup.configure({format:'Standard',mode:'cpu',difficulty:'Medium'});
 await setup.importPaste(PRACTICE_STARTER_TEXT,{name:PRACTICE_STARTER_NAME,format:'Standard'});
 const review=setup.snapshot();
 if(review.importStatus!=='review'||review.reviewDeck?.name!==PRACTICE_STARTER_NAME||review.unresolved?.length)throw Error(review.error||'The starter cards could not be matched. Try again.');
 setup.reviewImport();const selected=setup.snapshot();
 if(selected.selected?.name!==PRACTICE_STARTER_NAME)throw Error('Starter selection changed. Try again.');
 setup.chooseOpponent(selected.selected);return setup.snapshot();
}
