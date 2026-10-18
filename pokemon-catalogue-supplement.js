// Exact upstream records missing from the deployed TCGdex API on 2026-10-18.
// Source: https://github.com/tcgdex/cards-database/tree/af57972e8f784c2507ab9e573c99bf02ae2e5e42/data/Mega%20Evolution/Mega%20Evolution%20Energy
// Keep identities, anniversary stamp and product IDs intact. No prices are inferred.
const records = [
 ['009',"Basic Grass Energy",909307,713248],
 ['010',"Basic Fire Energy",909308,713249],
 ['011',"Basic Water Energy",909310,713250],
 ['012',"Basic Lightning Energy",909312,713251],
 ['013',"Basic Psychic Energy",909313,713252],
 ['014',"Basic Fighting Energy",909314,713253],
 ['015',"Basic Darkness Energy",909315,713254],
 ['016',"Basic Metal Energy",909316,713255],
];
export const pokemonSupplementIds = records.map(([number])=>'mee-'+number);
export function pokemonCatalogueFallback(id) {
 const record=records.find(([number])=>id==='mee-'+number);if(!record)return null;
 const [number,name,cardmarket,tcgplayer]=record;
 return {id,localId:number,name,category:'Energy',energyType:'Normal',rarity:'Common',illustrator:'YOSHIROTTEN',image:`https://tcgplayer-cdn.tcgplayer.com/product/${tcgplayer}_in_1000x1000.jpg`,
  set:{id:'mee',name:'Mega Evolution Energy',cardCount:{official:16},releaseDate:'2025-09-25',abbreviation:{official:'MEE'}},
  variants_detailed:[{type:'holo',stamp:['30th-anniversary'],thirdParty:{cardmarket,tcgplayer}}],
  catalogueProvenance:{source:'TCGdex upstream catalogue',commit:'af57972e8f784c2507ab9e573c99bf02ae2e5e42',observed:'2026-10-18'}
 };
}
