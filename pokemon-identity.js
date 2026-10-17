// Some providers append the portrait's subtitle to this Trainer's name, even
// though the printed main title is still Professor's Research. This narrow
// alias is for name matching only: card IDs, sets, numbers and variants remain
// distinct. Never strip arbitrary parentheses or Pokémon ex/GX/V suffixes.
const tidy=value=>String(value??'').normalize('NFC').replace(/[‘’]/g,"'").trim().replace(/\s+/g,' ');
const research=/^(Professor's Research)\s+\((Professor [\p{L} .'-]{1,60})\)$/iu;
export const pokemonTrainerSubtitle=value=>tidy(value).match(research)?.[2]||'';
export const pokemonPrintedName=value=>tidy(value).replace(research,'$1');
export const pokemonPrintedNameKey=value=>pokemonPrintedName(value).toLocaleLowerCase();
