// Some providers append the portrait's subtitle to this Trainer's name, even
// though the printed main title is still Professor's Research. This narrow
// alias is for name matching only: card IDs, sets, numbers and variants remain
// distinct. Never strip arbitrary parentheses or Pokémon ex/GX/V suffixes.
const tidy=value=>String(value??'').normalize('NFC').replace(/[‘’]/g,"'").trim().replace(/\s+/g,' ');
const research=/^(Professor's Research)\s+\((Professor [\p{L} .'-]{1,60})\)$/iu;
export const pokemonTrainerSubtitle=value=>tidy(value).match(research)?.[2]||'';
export const pokemonPrintedName=value=>tidy(value).replace(research,'$1');
export const pokemonPrintedNameKey=value=>pokemonPrintedName(value).toLocaleLowerCase();

// Printed errors belong to these releases only. The canonical source name and
// saved card ID never change. See the audit's CODE-004 printed witnesses.
export const POKEMON_PRINTED_ALIASES = Object.freeze({
  'base4-102': {canonical:'Impostor Professor Oak', printed:'Imposter Professor Oak'},
  'ex6-32': {canonical:'Drowzee', printed:'Drowsee'},
});
export function pokemonIdentityNames(card) {
  const alias=POKEMON_PRINTED_ALIASES[card?.id];
  return [card?.name, ...(alias && card.name===alias.canonical ? [alias.printed] : [])].filter(Boolean);
}

// The H subset has its own printed denominator. Never change the catalogue
// count or canonical H01 key to repair a printed H1/H32 observation.
export function pokemonPrintedIdentifier(setId,number,catalogueTotal) {
  const raw=String(number??'');
  if(['ecard2','ecard3'].includes(setId)&&/^H0*([1-9]|[12]\d|3[0-2])$/i.test(raw))
    return {number:raw.replace(/^H0+/i,'H'),total:32,namespace:'H',raw};
  return {number:raw,total:catalogueTotal,namespace:'',raw};
}
