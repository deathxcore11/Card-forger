// Custom booster wrappers drawn for CardStashy (real card art on a foil wrapper). They come first; sets without one,
// and any wrapper that fails to load, fall back to the real booster photo.
const CODES=new Set("10e 2ed 2x2 2xm 3ed 4ed 5dn 5ed 6ed 7ed 8ed 9ed a25 acr aer afr akh ala all apc arb arn atq avr bbd blb bng bok bro chk chr clb clu cmm cmr cn2 cns con csp dbl dft dgm dis dka dmr dmu dom drk dsk dst ecl eld ema emn eoe eve exo fdn fem fin fra frf fut gpt grn gtc hml hob hou ice iko ima inr inv isd jou jud khm kld ktk lci lea leb leg lgn lrw ltr m10 m11 m12 m13 m14 m15 m19 m20 m21 mat mb2 mbc mbs mh1 mh2 mh3 mid mir mkm mm2 mm3 mma mmq mom mor mrd msh nem neo nph ody ogw one ons otj pcy plc pls rav ren rin rix rna roe rtr rvr scg shm snc soi sok som sos spm sth stx sum tdm thb ths tla tmp tmt tor tsp tsr uds ugl ulg uma unf unh usg ust vis vow war woe wth wwk xln zen znr".split(' '));
export function packWrapperUrl(game,set={}){
 const code=String(set.code||set.id||'').toLowerCase();
 return game==='mtg'&&CODES.has(code)?`./assets/packs/pack-${code}.webp`:'';
}
import {PACK_ART,PACK_ART_BASE,PTCG_PACK_ART,YGO_PACK_ART} from './pack-art-data.js';
// Real set art under the template's empty window: the art layer moves, the frame stays (parallax).
// Magic: Scryfall art crop. Pokémon: art baked into assets/packs/art (no crop endpoint exists). Yu-Gi-Oh!: YGOPRODeck's ready-made crop.
const FOCUS={ktk:[64,40]};// [x,y] percent where the default centre crop hides the subject
export function packTemplateArt(game,set={}){
 const key=String(set.code||set.id||'').toLowerCase();
 if(game==='mtg'){const e=PACK_ART[key];if(!e)return null;const [x,y]=FOCUS[key]||[50,35];return {art:PACK_ART_BASE+e.art,x,y,card:e.card};}
 if(game==='ptcg'){const e=PTCG_PACK_ART[String(set.id||set.code||'').toLowerCase()];return e?{art:`./assets/packs/art/ptcg-${encodeURIComponent(String(set.id||set.code).toLowerCase())}.webp`,x:50,y:40,card:e.card,logo:e.logo||''}:null;}
 if(game==='ygo'){const e=YGO_PACK_ART[String(set.code||'').toUpperCase()];return e?{art:`https://images.ygoprodeck.com/images/cards_cropped/${e.id}.jpg`,x:50,y:30,card:e.card,sub:String(set.code).toUpperCase()}:null;}
 return null;
}
export function packArtSources(game,set={},remote=''){return [packWrapperUrl(game,set),remote].filter(Boolean);}
