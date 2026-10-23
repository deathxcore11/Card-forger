// Refresh from the checked-in, dated official rule pack; no generated rules prose.
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {MTG_VOCABULARY} from '../mtg-vocabulary.js';
const bytes=readFileSync(new URL('../rulebooks/mtg-rules-v1.json.gz',import.meta.url));
const pack=JSON.parse(gunzipSync(bytes)),terms=[...MTG_VOCABULARY['keyword-abilities'],...MTG_VOCABULARY['keyword-actions']].filter(Boolean),out={};
for(const title of pack.entries.filter(e=>e.doc===0&&/^70[12]\.\d+$/.test(e.id))){
 const label=title.text.replace(/^70[12]\.\d+\.\s*/, '').trim(),term=terms.find(k=>k.toLowerCase()===label.toLowerCase());if(!term)continue;
 const entries=pack.entries.filter(e=>e.doc===0&&new RegExp('^'+title.id.replace('.','\\.')+'[a-z]$').test(e.id));
 const first=entries.slice(0,2).map(e=>e.text.replace(/^70[12]\.\d+[a-z]\s*/, '').replace(/\s+/g,' ').trim()).join(' ');
 // Keep complete extracted paragraphs; exact source view exposes all subsections.
 if(first)out[term.toLowerCase()]={label:term,definition:first,entryId:title.id};
}
writeFileSync(new URL('../mtg-keyword-reference.js',import.meta.url),'// Exact excerpts from the existing bundled rulebook. Regenerate with scripts/build-keyword-references.mjs.\nexport const KEYWORD_SOURCE = '+JSON.stringify({sha256:createHash('sha256').update(bytes).digest('hex'),...pack.sources[0]})+';\nexport const KEYWORD_REFERENCE = '+JSON.stringify(out,null,2)+';\n');
console.log(Object.keys(out).length+' keyword/action definitions linked to exact dated rule entries.');
