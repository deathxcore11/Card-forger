// An explicit beta list, never a replacement for a saved/imported owner deck.
export const PRACTICE_STARTER_NAME='Green creatures · Starter';
export const PRACTICE_STARTER_ROWS=Object.freeze([
 Object.freeze({name:'Forest',qty:24}),
 ...['Llanowar Elves','Bear Cub','Ordinary Bear','Ghalta, Primal Hunger','Lashwhip Predator','Tarmogoyf','Tapestry Warden','Virulent Emissary','Scarecrow Guide'].map(name=>Object.freeze({name,qty:4}))
]);
// Five free starter decks, one per colour (Randall 3 Nov 23:01Z), granted at sign-up as Play decks with
// their cards in the Trunk, so Quick Play works from the first visit. Same shape as the green one:
// 24 basics and nine Standard-legal cards, four of each, every one with rules in the engine.
const starter=(key,colour,name,land,names)=>Object.freeze({key,colour,name,format:'Standard',rows:Object.freeze([Object.freeze({name:land,qty:24}),...names.map(n=>Object.freeze({name:n,qty:4}))])});
export const STARTER_DECKS=Object.freeze([
 starter('w','White','White angels · Starter','Plains',["Healer's Hawk",'Hinterland Sanctifier',"Ajani's Pridemate",'Lifecreed Duo','Helpful Hunter','Dazzling Angel','Inspiring Overseer','Angel of Vitality','Bovine Intervention']),
 starter('u','Blue','Blue fliers · Starter','Island',['Spectral Sailor','Harrier Strix','Plumecreed Escort','Floodpits Drowner','Bellowing Crier','Mocking Sprite','Geyser Drake','Essence Scatter','Unsummon']),
 starter('b','Black','Black drain · Starter','Swamp',['Greedy Freebooter','Infestation Sage','Sanguine Syphoner','Burglar Rat','Marauding Blight-Priest','Vampire Nighthawk','Vile Entomber','Murder','Feed the Swarm']),
 starter('r','Red','Red burn · Starter','Mountain',['Fanatical Firebrand','Reckless Lackey','Firebrand Archer','Sunset Strikemaster','Scytheclaw Raptor','Spitfire Lagac','Volley Veteran','Shock','Lightning Strike']),
 Object.freeze({key:'g',colour:'Green',name:PRACTICE_STARTER_NAME,format:'Standard',rows:PRACTICE_STARTER_ROWS})
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
