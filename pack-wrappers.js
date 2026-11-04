// Custom booster wrappers drawn for CardStashy (real card art on a foil wrapper). They come first; sets without one,
// and any wrapper that fails to load, fall back to the real booster photo.
const CODES=new Set("10e 2ed 2x2 2xm 3ed 4ed 5dn 5ed 6ed 7ed 8ed 9ed a25 ala all apc arb arn atq avr bbd bok chk chr clb clu cmm cmr cn2 cns con csp dbl dgm dis dka dmr drk dst ema eve exo fem fut gpt gtc hml ice ima inr inv isd jud lea leb leg lgn lrw ltr m10 m11 m12 m13 m14 mb2 mbc mbs mir mm2 mm3 mma mmq mor mrd nem nph ody ons pcy plc pls rav ren rin roe rtr rvr scg shm sok som sth sum ths tmp tor tsp tsr uds ugl ulg uma unf unh usg ust vis wth wwk zen".split(' '));
export function packWrapperUrl(game,set={}){
 const code=String(set.code||set.id||'').toLowerCase();
 return game==='mtg'&&CODES.has(code)?`./assets/packs/pack-${code}.webp`:'';
}
export function packArtSources(game,set={},remote=''){return [packWrapperUrl(game,set),remote].filter(Boolean);}
