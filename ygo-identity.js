export const YGO_RARITIES=['Common','Short Print','Rare','Super Rare','Ultra Rare','Secret Rare','Ultimate Rare','Ghost Rare','Gold Rare','Gold Secret Rare','Platinum Rare','Platinum Secret Rare','Prismatic Secret Rare','Starlight Rare',"Collector's Rare",'Quarter Century Secret Rare','Premium Gold Rare','10000 Secret Rare','Normal Parallel Rare','Super Parallel Rare','Ultra Parallel Rare','Secret Parallel Rare','Duel Terminal Normal Parallel Rare','Duel Terminal Rare Parallel Rare','Duel Terminal Super Parallel Rare','Duel Terminal Ultra Parallel Rare','Duel Terminal Secret Parallel Rare','Mosaic Rare','Shatterfoil Rare','Starfoil Rare','Holographic Rare','Extra Secret Rare','Ghost/Gold Rare',"Ultra Rare (Pharaoh's Rare)",'Ultra Secret Rare','Duel Terminal Normal Rare Parallel Rare'];
const names=new Map(YGO_RARITIES.map(x=>[x.toLowerCase(),x]));
// Catalogue spellings of the same rarities (short forms and one-word names).
for(const [key,value] of Object.entries({starfoil:'Starfoil Rare','extra secret':'Extra Secret Rare'}))names.set(key,value);
for(const [key,value] of Object.entries({ScR:'Secret Rare',StR:'Starlight Rare',UR:'Ultra Rare',SR:'Super Rare',R:'Rare',C:'Common',QCR:'Quarter Century Secret Rare',CR:"Collector's Rare"}))names.set(key.toLowerCase(),value);
export const ygoRarity=value=>typeof value==='string'?names.get(value.trim().toLowerCase().replace(/\s+/g,' '))||'':'';
export const YGO_EDITIONS=[['unlimited','Unlimited'],['1st-edition','1st Ed.'],['limited','Limited Edition']];
export const isYgoEdition=value=>YGO_EDITIONS.some(([key])=>key===value);
