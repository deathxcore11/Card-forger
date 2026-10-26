// Printed card color for Collection Value, deliberately not Commander identity.
const FACE_LAYOUTS=new Set(['transform','modal_dfc','reversible_card','double_faced_token']);
const COLORS=new Set(['W','U','B','R','G']);
export function printedCardColors(card){
 if(!card)return null;
 const source=FACE_LAYOUTS.has(card.layout)?card.card_faces?.[0]?.colors:card.colors;
 if(!Array.isArray(source)||source.some(c=>!COLORS.has(c)))return null;
 return [...new Set(source)];
}
