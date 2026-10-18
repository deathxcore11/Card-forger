// Approved material studies, applied only after the printing resolver accepts
// the selected finish. These textures approximate light; they do not certify a card.
export function finishMaterialProfile(game,card,model){
 if(!model.layers?.length)return '';
 if(game==='mtg')return model.effect==='mtg-etched'?'etched':model.effect==='mtg-foil'?'traditional':'';
 if(game==='ygo')return model.effect==='ygo-starlight'?'starlight':model.effect;
 if(card.id==='base1-4'&&model.effect==='ptcg-holo')return 'classic-holo';
 if(['base4-20','neo1-9'].includes(card.id)&&model.effect==='ptcg-holo')return 'cosmos-holo';
 if(card.set?.id==='cel25'&&model.effect==='ptcg-holo')return 'line-holo';
 if(model.texture==='micro-ridges')return 'textured-holo';
 // The reviewed water pattern is confined to this known Sword & Shield layout.
 if(card.id==='swsh1-52'&&model.effect==='ptcg-reverse')return 'reverse-water';
 return 'standard';
}
export const hasFinishPattern=profile=>['classic-holo','cosmos-holo','line-holo','textured-holo','reverse-water','ygo-secret','starlight','etched'].includes(profile);
const titleMasks={
 '9753964':{sha:'4dcd41511873cd9fab6128b6a5a99df8aec85c5068df93bdf6ab41a406d0ca69',file:'abyss-title.svg'},
 '38814750':{sha:'aabad1d0da6e913f705f61bda15736e87f9821acbb98dda9a13b8116c9e52936',file:'gamma-title.svg'},
 '74586817':{sha:'9fcc800132cfb053df4dfc3d5b2c3d93301e53129cee1eeb6b23463574b07f8a',file:'omega-title.svg'}
};
const verified=new Map();
// Mask coordinates belong to exact source bytes. A changed image, alternate
// art, small thumbnail or CORS failure keeps the conservative title-band glint.
export function verifiedTitleMask(id,src,fetcher=fetch){
 const record=titleMasks[String(id)];if(!record||!src||!globalThis.crypto?.subtle)return Promise.resolve('');
 const key=id+'|'+src;if(verified.has(key))return verified.get(key);
 const job=(async()=>{try{
  const response=await fetcher(src,{mode:'cors',credentials:'omit',cache:'force-cache',signal:AbortSignal.timeout(8000)});
  if(!response.ok||response.type==='opaque')return '';
  const bytes=await response.arrayBuffer();if(bytes.byteLength>4000000)return '';
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
  return hash===record.sha?new URL('./assets/finishes/'+record.file,import.meta.url).href:'';
 }catch{return '';}})();
 if(verified.size>=24)verified.delete(verified.keys().next().value);
 verified.set(key,job);return job;
}
