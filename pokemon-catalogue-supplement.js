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
// 30th Celebration's three RGB Rare Mew (R, G, B), in the upstream database at
// commit 2414b087 but not yet served by the TCGdex API on 2026-11-01.
// Source: https://github.com/tcgdex/cards-database/tree/2414b087bffd93c0ab7481a78dca925eab64cc57/data/Mega%20Evolution/30th%20Celebration
const rgbMew = [['R',909509,717607],['G',909510,717608],['B',909511,717609]];
function rgbMewCard(id) {
 const record=rgbMew.find(([letter])=>id==='30th-'+letter);if(!record)return null;
 const [letter,cardmarket,tcgplayer]=record;
 return {id,localId:letter,name:'Mew',category:'Pokemon',rarity:'RGB Rare',illustrator:'YOSHIROTTEN',dexId:[151],hp:60,types:['Psychic'],stage:'Basic',
  description:'So rare that it is still said to be a mirage by many experts. Only a few people have seen it worldwide.',
  attacks:[{name:'Psychic',effect:"This attack does 40 more damage for each Energy attached to your opponent's Active Pokémon.",damage:'10+',cost:['Psychic','Psychic']}],
  weaknesses:[{type:'Darkness',value:'×2'}],resistances:[{type:'Fighting',value:'-30'}],retreat:1,regulationMark:'J',
  image:`https://tcgplayer-cdn.tcgplayer.com/product/${tcgplayer}_in_1000x1000.jpg`,
  set:{id:'30th',name:'30th Celebration',cardCount:{official:128},releaseDate:'2026-09-16',abbreviation:{official:'30C'}},
  variants_detailed:[{type:'holo',thirdParty:{cardmarket,tcgplayer}}],
  catalogueProvenance:{source:'TCGdex upstream catalogue',commit:'2414b087bffd93c0ab7481a78dca925eab64cc57',observed:'2026-11-01'}
 };
}
export const pokemonSupplementIds = [...records.map(([number])=>'mee-'+number),...rgbMew.map(([letter])=>'30th-'+letter)];
export function pokemonCatalogueFallback(id) {
 if(/^30th-[RGB]$/.test(id))return rgbMewCard(id);
 const record=records.find(([number])=>id==='mee-'+number);if(!record)return null;
 const [number,name,cardmarket,tcgplayer]=record;
 return {id,localId:number,name,category:'Energy',energyType:'Normal',rarity:'Common',illustrator:'YOSHIROTTEN',image:`https://tcgplayer-cdn.tcgplayer.com/product/${tcgplayer}_in_1000x1000.jpg`,
  set:{id:'mee',name:'Mega Evolution Energy',cardCount:{official:16},releaseDate:'2025-09-25',abbreviation:{official:'MEE'}},
  variants_detailed:[{type:'holo',stamp:['30th-anniversary'],thirdParty:{cardmarket,tcgplayer}}],
  catalogueProvenance:{source:'TCGdex upstream catalogue',commit:'af57972e8f784c2507ab9e573c99bf02ae2e5e42',observed:'2026-10-18'}
 };
}

// A small identity overlay, not another price feed. Apply the caller's filters
// to the known supplemental records, then let the current provider win every
// exact-ID collision. Never match/deduplicate on a name or collector number alone.
export function pokemonCatalogueOverlay(upstream = [], matches = () => true) {
 const cards = new Map((upstream || []).filter(c => c?.id).map(c => [c.id,c]));
 for (const id of pokemonSupplementIds) {
  const card = pokemonCatalogueFallback(id);
  if (!cards.has(id) && matches(card)) cards.set(id,card);
 }
 return [...cards.values()];
}

// MEE 009–016 are verified members of this set, not eight extra copies of the
// earlier energies. Keep a newer/larger provider count, but do not advertise the
// old eight-card denominator while all sixteen identities can be browsed.
export function pokemonCatalogueSet(set) {
 if (set?.id !== 'mee') return set;
 const fallback = pokemonCatalogueFallback('mee-009').set;
 return {...fallback,...set,cardCount:{...fallback.cardCount,...set.cardCount,
  official:Math.max(16,Number(set.cardCount?.official)||0),
  total:Math.max(16,Number(set.cardCount?.total)||0,Number(set.cardCount?.official)||0)}};
}

// The UI/persisted catalogue stores normalized entries with `count`, rather
// than the provider's cardCount object. Repair only this verified set, retaining
// newer totals and every unrelated entry; a cache hit must not bypass the overlay.
export function pokemonCatalogueSetEntry(set) {
 if (set?.id !== 'mee') return set;
 const count = Math.max(16,Number(set.count)||0,Number(set.cardCount?.official)||0,Number(set.cardCount?.total)||0);
 return set.count === count ? set : {...set,count};
}

// Exact TCGplayer products for the 30th Classic Collection (TCGplayer group 24837), from the
// upstream database at commit 2414b087. On 2026-11-01 the API had none for 003, 004 and 018-022,
// and TCGplayer numbers these by their original card number, so a number match cannot find them.
const CLASSIC_30TH = [714372,716156,716157,716158,716159,716160,716161,714373,716162,716163,716191,716192,716193,716194,716195,716196,716197,716198,716199,716200,716202,716203,716204,716205,716206,716207,716208,716209,714386,716210];
export function pokemonSupplementProduct(id) {
 const m=/^30th-c-(\d{3})$/.exec(String(id||''));const productId=m&&CLASSIC_30TH[Number(m[1])-1];
 if(productId)return {productId,groupId:24837};
 const mew=rgbMew.find(([letter])=>id==='30th-'+letter);
 return mew?{productId:mew[2],groupId:24722}:null;
}
