// Small, preconditioned DATA-001 candidate. Original source fields are retained
// in provenance; a provider update is a conflict, not permission to overwrite.
export const POKEMON_CORRECTIONS = Object.freeze([{
 schemaVersion:1,correctionId:'AQ-DATA-001-SMEARGLE-109-ATTACK-1',issueGroup:'DATA-001',
 game:'ptcg',cardId:'ecard2-109',canonicalName:'Smeargle',printingScope:'English Aquapolis 109/147 reference',
 fieldPath:'attacks[1].name',expectedPrior:'Doublslap',replacement:'Doubleslap',
 sourcePin:'cbddf7e54033b1b58e44af1049c88832e55b94d0',
 evidence:{url:'https://assets.tcgdex.net/en/ecard/ecard2/109/high.png',
  sha256:'42958a98697f4bf80cd795a17666fc20b4af46810d6f5020db1769e94abbfa98',
  locator:'second attack heading, immediately above 109/147',kind:'printed-reference'},
 rationale:'The inspected front prints Doubleslap; provider metadata omits the e.',
 reviewStatus:'candidate-reviewed; owner release review pending',author:'Codex',reviewer:null,supersedes:null,
},{
 schemaVersion:1,correctionId:'RABSCA-SV08-014-COSMOS-PRODUCT',issueGroup:'DATA-001',game:'ptcg',
 cardId:'sv08-014',canonicalName:'Rabsca',printingScope:'English 014/191 Cosmos Holo, standard size, unstamped',
 fieldPath:'variants_detailed[variantId=5zs5af49g93yryvw1ftj].thirdParty.tcgplayer',expectedPrior:null,replacement:636307,
 sourcePin:'TCGplayer product response retrieved 2026-10-20',
 evidence:{url:'https://mp-search-api.tcgplayer.com/v2/product/636307/details',sha256:'3578bca2b2f1d1096ebdc7415485fbb0bc2959ac369d1cc353dbce42213432b8',locator:'productId, productName, number 014/191, Triple Draw, Counterturn, English Holofoil SKUs',kind:'marketplace-product-identity'},
 rationale:'Named Cosmos product matches the provider-described Cosmos printing; no price or exact-art claim is added.',
 reviewStatus:'candidate-reviewed; owner release review pending',author:'Codex',reviewer:null,supersedes:null,
}]);
export function applyPokemonCorrections(card) {
 let result=card;
 for(const correction of POKEMON_CORRECTIONS){
  if(card?.id!==correction.cardId||card.name!==correction.canonicalName)continue;
  if(correction.correctionId==='RABSCA-SV08-014-COSMOS-PRODUCT'){
   const matches=(card.variants_detailed||[]).filter(d=>d.variantId==='5zs5af49g93yryvw1ftj'&&d.type==='holo'&&d.foil==='cosmos'&&d.size==='standard'&&!d.stamp?.length&&!d.subtype);
   if(matches.length!==1)continue;
   const row=matches[0],prior=row.thirdParty?.tcgplayer;
   if(prior===correction.replacement)continue;
   if(prior!=null){result={...result,correctionConflicts:[...(result.correctionConflicts||[]),correction.correctionId]};continue;}
   result={...result,variants_detailed:result.variants_detailed.map(d=>d===row?{...d,thirdParty:{...d.thirdParty,tcgplayer:correction.replacement},productIdentityProvenance:correction.correctionId}:d),corrections:[...(result.corrections||[]),correction.correctionId]};continue;
  }
  const value=card.attacks?.[1]?.name;
  if(value===correction.replacement)continue;
  if(value!==correction.expectedPrior){
   result={...result,correctionConflicts:[...(result.correctionConflicts||[]),correction.correctionId]};continue;
  }
  result={...result,attacks:result.attacks.map((a,i)=>i===1?{...a,name:correction.replacement,sourceName:a.name,printedNameProvenance:correction.correctionId}:a),
   corrections:[...(result.corrections||[]),correction.correctionId]};
 }
 return result;
}
