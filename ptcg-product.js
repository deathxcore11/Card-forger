import {pokemonDetailedVariant} from './pokemon-variant-options.js';
// Which TCGplayer product (and finish within it) a Pokémon card + finish is, for the price
// history routes. TCGdex lists the product on its detailed variants for newer cards; for many
// older sets (BREAKthrough and earlier) the id is only on the per-finish price block, so both are
// read. One product and one finish, or nothing: never a blend of two versions.
const DETAIL_FINISH = { normal: "normal", holo: "holofoil", reverse: "reverse-holofoil" };
const SUBTYPE = { normal: "Normal", holofoil: "Holofoil", "reverse-holofoil": "Reverse Holofoil", "1st-edition": "1st Edition", "1st-edition-holofoil": "1st Edition Holofoil", unlimited: "Unlimited", "unlimited-holofoil": "Unlimited Holofoil" };
const REFERENCE_ORDER = ["normal", "holofoil", "unlimited-holofoil", "unlimited", "reverse-holofoil", "1st-edition-holofoil", "1st-edition"];

export function ptcgProduct(card, finish = "reference", expectedProductId = '') {
  if(finish!=='reference'){
    const detail=pokemonDetailedVariant(card,finish),root=card?.pricing?.tcgplayer?.[finish];
    if(detail){
      const productId=Number(detail.thirdParty?.tcgplayer||detail.pricing?.tcgplayer?.[finish]?.productId||(!detail.foil&&!detail.subtype&&!detail.stamp?.length&&(!detail.size||detail.size==='standard')?root?.productId:null)),physical=DETAIL_FINISH[detail.type]||detail.type,key=SUBTYPE[finish]?finish:detail.stamp?.includes('1st-edition')?(detail.type==='holo'?'1st-edition-holofoil':'1st-edition'):['unlimited','shadowless'].includes(detail.subtype)?(detail.type==='holo'?'unlimited-holofoil':'unlimited'):physical;
      if(!productId||expectedProductId&&String(expectedProductId)!==String(productId))return null;
      if(detail.foil&&detail.foil!=='cosmos')return null;
      return {productId,finishKey:key,subtype:SUBTYPE[key]||key};
    }
    if(root?.productId){
      if(expectedProductId&&String(expectedProductId)!==String(root.productId))return null;
      return {productId:Number(root.productId),finishKey:finish,subtype:SUBTYPE[finish]||finish};
    }
  }
  let detailed = (card?.variants_detailed || []).filter((v) => v.thirdParty?.tcgplayer);
  if (finish.startsWith("detail:")) detailed = detailed.filter((v) => "detail:" + v.variantId === finish);
  else if (finish !== "reference") detailed = detailed.filter((v) => (DETAIL_FINISH[v.type] || v.type) === finish);
  if(expectedProductId&&detailed.some(v=>String(v.thirdParty.tcgplayer)!==String(expectedProductId)))return null;
  const products = [...new Set(detailed.map((v) => Number(v.thirdParty.tcgplayer)))];
  if (products.length === 1) {
    const key = DETAIL_FINISH[detailed[0].type] || detailed[0].type;
    return { productId: products[0], finishKey: key, subtype: SUBTYPE[key] || key };
  }
  if (products.length > 1 && finish === "reference") {
    // The plain printing (no stamp, standard size) of the first finish, when that is one product.
    const plain = detailed.filter((v) => !v.stamp?.length && !v.subtype && (!v.size || v.size === "standard"));
    for (const key of REFERENCE_ORDER) {
      const hits = plain.filter((v) => (DETAIL_FINISH[v.type] || v.type) === key), ids = [...new Set(hits.map((v) => Number(v.thirdParty.tcgplayer)))];
      if (ids.length === 1) return { productId: ids[0], finishKey: key, subtype: SUBTYPE[key] || key };
      if (ids.length > 1) return null;
    }
  }
  if (products.length > 1 || finish.startsWith("detail:")) return null;
  const legacy = Object.entries(card?.pricing?.tcgplayer || {}).filter(([, v]) => v && typeof v === "object" && Number(v.productId) > 0);
  const pick = finish === "reference" ? REFERENCE_ORDER.map((k) => legacy.find(([key]) => key === k)).find(Boolean) || (legacy.length === 1 ? legacy[0] : null) : legacy.find(([key]) => key === finish);
  if (!pick||expectedProductId&&String(pick[1].productId)!==String(expectedProductId)) return null;
  return { productId: Number(pick[1].productId), finishKey: pick[0], subtype: SUBTYPE[pick[0]] || pick[0] };
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
// The provider's finish name matches ours ("1st Edition" also matches "1st Edition Normal").
export const sameSubtype = (provider, ours) => norm(provider) === norm(ours) || norm(provider) === norm(ours) + "normal";
