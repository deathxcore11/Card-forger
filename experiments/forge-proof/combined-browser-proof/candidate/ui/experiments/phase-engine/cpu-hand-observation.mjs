// Only own authorized hand and publicly visible own mana sources enter planning.
const list=v=>Array.isArray(v)?v:[];
const visible=o=>o?.display_visible_to_viewer===true&&!o.face_down&&o.name!=='Hidden Card';
function cost(c){return c?.type==='Cost'&&Number.isInteger(c.generic)&&c.generic>=0&&list(c.shards).every(s=>s==='Green')?{generic:c.generic,colored:c.shards.length,total:c.generic+c.shards.length}:null;}
function ownPowerDiscount(o){return list(o.static_definitions).some(d=>{const m=d.mode?.ModifyCost,c=m?.dynamic_count;return m?.mode==='Reduce'&&m.amount?.generic===1&&c?.type==='PropertyAggregate'&&c.function==='Sum'&&c.property==='Power'&&c.source?.type==='Objects'&&c.source.filter?.controller==='You'&&JSON.stringify(c.source.filter.type_filters)==='["Creature"]'&&list(c.source.filter.properties).length===0;});}
export function ownHandObservation(s,seat,actions,legal,playbook){
 const hand=list(s.players[seat].hand).map(id=>s.objects[id]).filter(o=>visible(o)&&o.zone==='Hand'&&o.controller===seat),indices=new Map(hand.map((c,i)=>[c.id,i]));
 const battlefield=list(s.battlefield).map(id=>s.objects[id]).filter(o=>visible(o)&&o.controller===seat);
 const forests=battlefield.filter(o=>!o.tapped&&list(o.card_types?.core_types).includes('Land')&&list(o.card_types?.subtypes).includes('Forest')).length;
 // Conservative mono-green budget: other mana sources/colored restrictions are
 // not guessed. Current legal cast candidates still remain usable as fallbacks.
 const floating=list(s.players[seat].mana_pool?.mana),mana=forests+floating.filter(m=>m.color==='Green'&&!m.restriction).length;
 const discard=s.waiting_for?.type==='DiscardToHandSize'&&s.waiting_for.data?.player===seat?s.waiting_for.data.count:null;
 return {plan:playbook?.kind||'generic-material',planVersion:playbook?.version||null,proposalAccepted:playbook?.proposalAccepted===true,mana,lands:battlefield.filter(o=>list(o.card_types?.core_types).includes('Land')).length,
  cards:hand.map(o=>({power:Number.isFinite(o.power)?o.power:0,toughness:Number.isFinite(o.toughness)?o.toughness:0,
   creature:list(o.card_types?.core_types).includes('Creature'),land:list(o.card_types?.core_types).includes('Land'),instant:list(o.card_types?.core_types).includes('Instant'),
   cost:cost(legal?.spellCosts?.[o.id]||o.mana_cost),powerDiscount:ownPowerDiscount(o),
   toughnessEnabler:list(o.static_definitions).some(d=>list(d.modifications).some(m=>m.type==='AssignDamageFromToughness')),
   // This is a role hint, not permission to activate an ability or produce mana.
   hasAbility:list(o.abilities).length>0,hasTriggers:list(o.trigger_definitions).length>0,
   keywords:list(o.keywords).filter(k=>typeof k==='string'&&['Flying','Reach','Deathtouch','Lifelink','Trample','Vigilance','DoubleStrike','FirstStrike'].includes(k)).sort()})),
  castIndices:actions.map(a=>a.type==='CastSpell'&&indices.has(a.data?.object_id)&&list(a.data?.targets).length===0?indices.get(a.data.object_id):null),
  discardIndices:actions.map(a=>Number.isInteger(discard)&&a.type==='SelectCards'&&Array.isArray(a.data?.cards)&&a.data.cards.length===discard&&new Set(a.data.cards).size===discard&&a.data.cards.every(id=>indices.has(id))?a.data.cards.map(id=>indices.get(id)):null)};
}
