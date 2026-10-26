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
},{
 schemaVersion:1,correctionId:'MACHAMP-BASE1-8-FIRST-EDITION-PRODUCT',issueGroup:'DATA-001',game:'ptcg',
 cardId:'base1-8',canonicalName:'Machamp',printingScope:'English Base Set 8/102 First Edition Shadowless Holofoil (two-player starter)',
 fieldPath:'variants_detailed[type=holo,subtype=unlimited].thirdParty.tcgplayer -> variants_detailed[type=holo,subtype=shadowless,stamp=1st-edition].thirdParty.tcgplayer',expectedPrior:42425,replacement:42425,
 sourcePin:'TCGdex base1-8 and tcgcsv TCGplayer group 1840 retrieved 2026-10-20',
 evidence:{url:'https://tcgcsv.com/tcgplayer/3/1840/products',locator:'productId 42425 "Machamp - 8/102" in Deck Exclusives; prices list only subTypeName "1st Edition Holofoil"',kind:'marketplace-product'},
 rationale:'TCGplayer prices product 42425 only as 1st Edition Holofoil, but the provider bound it to the Unlimited holo record, so no condition or market quote could ever match. Saved keys are variantId-based and unchanged; a copy saved with this product on the Unlimited version reports a product mismatch instead of borrowing a price.',
 reviewStatus:'owner-approved 2026-10-20',author:'Claude',reviewer:'owner',supersedes:null,
}]);
export const SHINY_VAULT_FINISH_CORRECTION=Object.freeze({
 correctionId:'HIDDEN-FATES-SHINY-VAULT-GENERATED-FINISH',
 source:'https://assets.pokemon.com/assets/cms2/pdf/trading-card-game/checklist/sm115_web_cardlist_en.pdf',
 scope:'English Hidden Fates Shiny Vault SV1–SV94',
 rationale:'The official checklist identifies foil Shiny Vault printings; the generated normal placeholder is not evidence of a nonfoil edition.'
});
// Restrict only a reviewed correction, never infer availability from a price.
export const pokemonFinishAllowed=(card,finish)=>!card?.finishAvailability||card.finishAvailability.finishes.includes(finish);
function correctShinyVaultFinish(card){
 const match=/^sma-SV([1-9]\d?)$/.exec(card?.id||'');
 if(!match||Number(match[1])>94||card.set?.id!=='sma'||String(card.localId)!=='SV'+match[1])return card;
 const rows=card.variants_detailed||[],flags=card.variants||{},correction=SHINY_VAULT_FINISH_CORRECTION;
 if(!flags.normal||flags.holo||flags.reverse||flags.firstEdition||flags.wPromo)return card;
 // Only replace the provider's empty, generated placeholder. Real product,
 // edition, art or price descriptors require a new review, not an overwrite.
 if(rows.length!==1||rows[0].type!=='normal'||rows[0].size!=='standard'||rows[0].variantId!=='generated'||Object.keys(rows[0]).some(k=>!['type','size','variantId'].includes(k)))
  return {...card,correctionConflicts:[...(card.correctionConflicts||[]),correction.correctionId]};
 return {...card,variants:{...flags,normal:false,holo:true},variants_detailed:[{type:'holo',size:'standard',variantId:'generated'}],
  corrections:[...(card.corrections||[]),correction.correctionId],
  finishAvailability:{finishes:['holofoil'],...correction,sourceVariants:{...flags},sourceDetails:rows.map(d=>({...d}))}};
}
export function applyPokemonCorrections(card) {
 let result=card;
 for(const correction of POKEMON_CORRECTIONS){
  if(card?.id!==correction.cardId||card.name!==correction.canonicalName)continue;
  if(correction.correctionId==='MACHAMP-BASE1-8-FIRST-EDITION-PRODUCT'){
   const rows=result.variants_detailed||[],pid=String(correction.replacement),tp=d=>String(d.thirdParty?.tcgplayer??'');
   const from=rows.filter(d=>d.type==='holo'&&d.subtype==='unlimited'&&!d.stamp?.length),to=rows.filter(d=>d.type==='holo'&&d.subtype==='shadowless'&&Array.isArray(d.stamp)&&d.stamp.length===1&&d.stamp[0]==='1st-edition');
   // Already corrected upstream: nothing to do.
   if(to.length===1&&tp(to[0])===pid&&rows.filter(d=>tp(d)===pid).length===1)continue;
   if(from.length!==1||to.length!==1||tp(from[0])!==pid||tp(to[0])||rows.filter(d=>tp(d)===pid).length!==1){result={...result,correctionConflicts:[...(result.correctionConflicts||[]),correction.correctionId]};continue;}
   const {tcgplayer,...rest}=from[0].thirdParty;
   result={...result,variants_detailed:rows.map(d=>d===from[0]?{...d,thirdParty:rest,productIdentityProvenance:correction.correctionId}:d===to[0]?{...d,thirdParty:{...d.thirdParty,tcgplayer:correction.replacement},productIdentityProvenance:correction.correctionId}:d),corrections:[...(result.corrections||[]),correction.correctionId]};
   continue;
  }
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
 return correctShinyVaultFinish(result);
}
