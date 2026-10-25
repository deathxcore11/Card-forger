// Exact own-deck snapshots only. Builder advice is a proposal, never legality.
export const CPU_PLAYBOOK_VERSION='green-creatures-v1';
const starter=new Set(['forest','llanowar elves','bear cub','ordinary bear','ghalta, primal hunger','lashwhip predator','tarmogoyf','tapestry warden','virulent emissary','scarecrow guide']);
const key=name=>String(name).trim().toLowerCase();
export function cpuDeckKey(deck){return JSON.stringify(['main_deck','sideboard','commander'].map(zone=>[zone,[...(deck?.[zone]||[])].map(key).sort()]));}
export function createCpuPlaybook(deck,proposal=null){
 const own=[...(deck?.main_deck||[]),...(deck?.commander||[])].map(key),deckKey=cpuDeckKey(deck);
 const compatible=own.length>0&&own.every(n=>starter.has(n));
 const proposalAccepted=!!proposal&&proposal.version===CPU_PLAYBOOK_VERSION&&proposal.deckKey===deckKey&&Array.isArray(proposal.dependencies)&&proposal.dependencies.every(n=>own.includes(key(n)));
 return Object.freeze({version:CPU_PLAYBOOK_VERSION,deckKey,kind:compatible?'green-creatures':'generic-material',proposalAccepted,
  dependencies:Object.freeze(compatible?[...new Set(own)].sort():[])});
}
export function currentCpuPlaybook(book,deck){return book?.version===CPU_PLAYBOOK_VERSION&&book.deckKey===cpuDeckKey(deck)?book:null;}
