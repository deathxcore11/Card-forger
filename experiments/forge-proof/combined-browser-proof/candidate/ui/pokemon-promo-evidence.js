// Bounded, public product-identity evidence reviewed 2026-10-19.
// Keys are exact card+product pairs, never a shared TCGdex variantId or name guess.
const promos=Object.freeze({
 'swshp-SWSH012':{232766:{label:'General Mills Promo',group:'Miscellaneous Cards & Products'}},
 'swshp-SWSH013':{232767:{label:'General Mills Promo',group:'Miscellaneous Cards & Products'}},
 'swshp-SWSH040':{232768:{label:'General Mills Promo',group:'Miscellaneous Cards & Products'}},
 'swshp-SWSH220':{490300:{group:'Miscellaneous Cards & Products',foil:'cosmos'}}
});
export function pokemonPromoEvidence(cardId,productId){
 const hit=promos[cardId]?.[productId];return hit?{...hit,productId:Number(productId),printing:'Holofoil',source:`https://mp-search-api.tcgplayer.com/v2/product/${productId}/details`}:null;
}
export const REVIEWED_COSMOS_PROMOS=Object.freeze(['swshp-SWSH012','swshp-SWSH013','swshp-SWSH032','swshp-SWSH034','swshp-SWSH040','swshp-SWSH060','swshp-SWSH220']);
export function reviewedCosmosPreview(card,variant){
 return card?.set?.id==='swshp'&&card.category==='Pokemon'&&REVIEWED_COSMOS_PROMOS.includes(card.id)&&variant?.finish==='holofoil'&&variant.foil==='cosmos'&&(!variant.size||variant.size==='standard')&&!variant.subtype&&!variant.stamps?.length;
}

// Published primary products pin the legacy Holofoil key across quote outages.
// These are product identities, not quote values or preference rules.
const rootProducts=Object.freeze({"swshp-SWSH012":206428,"swshp-SWSH013":206430,"swshp-SWSH032":210578,"swshp-SWSH034":220314,"swshp-SWSH040":220269,"swshp-SWSH060":227031,"swshp-SWSH220":268705});
export const pokemonPromoRootProduct=cardId=>rootProducts[cardId]||null;
// Legacy root buckets proven to be duplicates of these exact reviewed physical
// products. A shared product ID alone never proves an edition/pattern/size alias.
const aliasProducts=Object.freeze({
 'swshp-SWSH023':{productId:213144,key:'detail:555jb0efopmyclvkikic41',stamps:['set-logo']},
 'swshp-SWSH132':{productId:251088,key:'detail:1jz5lzkp5cepu3arxr74ehuwlerveb',stamps:['25th-celebration']},
 'swshp-SWSH206':{productId:273155,key:'detail:555jb0efopmyclvkikic41',stamps:['set-logo']}
});
export function pokemonPromoAliasMatches(cardId,legacy,detail){
 const e=aliasProducts[cardId];
 return !!e&&legacy.key==='holofoil'&&String(legacy.productId)===String(e.productId)&&String(detail.productId)===String(e.productId)&&detail.key===e.key&&detail.finish==='holofoil'&&!detail.foil&&!detail.subtype&&detail.size==='standard'&&JSON.stringify([...(detail.stamps||[])].sort())===JSON.stringify([...e.stamps].sort());
}
