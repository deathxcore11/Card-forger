// Deterministic local-only Value fixtures. Synthetic URLs are layout identities,
// not evidence that provider artwork or prices exist. No requests or writes.
export const VALUE_NOW = Date.parse('2026-10-18T12:00:00Z');
export const valueSnapshot = (date,total,extra={}) => ({date,total,copies:4,unpriced:0,currency:'USD',basis:'exact-owned-v1',...extra});
export const VALUE_HISTORY = [
  {date:'2026-10-10',total:4.25,copies:2},
  valueSnapshot('2026-10-12',5.15),
  valueSnapshot('2026-10-14',2.50,{unpriced:1}),
  valueSnapshot('2026-10-15',0,{unpriced:4}),
  valueSnapshot('2026-10-16',12.45),
  valueSnapshot('2026-10-18',13.67),
  valueSnapshot('2099-01-01',999),
];
const art = id => `https://value-fixtures.invalid/${id}.png`;
const lot = (id,name,extra={}) => ({id,name,qty:1,condition:'Near Mint',language:'en',...extra});
const mtg = (id,name,color_identity,prices) => ({id,name,game:'mtg',set:'val',set_name:'Value fixture',collector_number:'7',color_identity,colors:[...color_identity],prices,image_uris:{normal:art(id)},finishes:['nonfoil','foil'],full:true});
const pokemon = (id,name,category,types,price) => ({id,name,game:'ptcg',category,types,set:{id:'val',name:'Value fixture',number:'8'},prices:{usd:price},image:art(id),variants:[{key:'normal',label:'Normal',usd:price,finish:'nonfoil'}]});
const ygo = (id,name,category,attribute,price) => ({id,name,game:'ygo',category,attribute,typeLine:category==='Monster'?'Effect Monster':category+' Card',prices:{usd:price},image:art(id),sets:[]});
const red=mtg('magic-red','Cinder Sprite',['R'],{usd:'2.15',usd_foil:'8.25'}),multi=mtg('magic-multi','Many-colored Sage',['W','U'],{usd:'0.65'}),zero=mtg('magic-zero','Personal Relic',[],{});
const dual=pokemon('value-dual','Steam Sprite','Pokemon',['Water','Fire'],1.23),trainer=pokemon('value-trainer','Research Notes','Trainer',[],.99),energy=pokemon('value-energy','Basic Fire Energy','Energy',['Fire'],.25),pkZero=pokemon('value-zero','Personal Pokémon','Pokemon',['Psychic'],null);
dual.variants.push({key:'holofoil',label:'Holofoil',usd:5.67,finish:'holofoil'},{key:'alternate',label:'Exact alternate image',usd:10.11,image:art('selected-alternate'),imageLarge:art('selected-alternate-large')});
const light=ygo('100001','Bright Dragon','Monster','LIGHT',1.25),spell=ygo('100002','Bright Spell','Spell','LIGHT',.51),trap=ygo('100003','Bright Trap','Trap','DARK',.49),ygZero=ygo('100004','Personal Unknown','Monster','',null);
export const VALUE_FIXTURES = {
  mtg:{cards:[red,multi,zero],collection:[lot('mtg-normal',red.name,{qty:2,printingId:red.id,printingVerified:true,finish:'nonfoil'}),lot('mtg-foil',red.name,{printingId:red.id,printingVerified:true,finish:'foil'}),lot('mtg-multi',multi.name,{printingId:multi.id,printingVerified:true,finish:'nonfoil'}),lot('mtg-zero',zero.name,{printingId:zero.id,printingVerified:true,manualValue:0,manualValueCondition:'Near Mint'}),lot('mtg-missing','Unpriced Magic',{condition:'Damaged'})]},
  ptcg:{cards:[dual,trainer,energy,pkZero],collection:[lot('ptcg-normal',dual.name,{cardId:dual.id,qty:2,variant:'normal'}),lot('ptcg-holo',dual.name,{cardId:dual.id,variant:'holofoil'}),lot('ptcg-alternate',dual.name,{cardId:dual.id,variant:'alternate'}),lot('ptcg-trainer',trainer.name,{cardId:trainer.id,qty:3,variant:'normal'}),lot('ptcg-energy',energy.name,{cardId:energy.id,variant:'normal'}),lot('ptcg-zero',pkZero.name,{cardId:pkZero.id,manualValue:0,manualValueCondition:'Near Mint'}),lot('ptcg-missing','Unpriced Pokémon',{cardId:'value-missing',condition:'Damaged'})]},
  ygo:{cards:[light,spell,trap,ygZero],collection:[lot('ygo-normal',light.name,{cardId:light.id,qty:2}),lot('ygo-personal',light.name,{cardId:light.id,manualValue:3.75,manualValueCondition:'Near Mint'}),lot('ygo-spell',spell.name,{cardId:spell.id,qty:2}),lot('ygo-trap',trap.name,{cardId:trap.id}),lot('ygo-zero',ygZero.name,{cardId:ygZero.id,manualValue:0,manualValueCondition:'Near Mint'}),lot('ygo-missing','Unpriced Yu-Gi-Oh!',{cardId:'100005',condition:'Damaged'})]},
};

// Reuse complete adapter fixtures for actual-app browser tests. All prices below
// are explicit synthetic owned-lot values, never external price requests.
export function valueBrowserFixture(game, source, today='2026-10-17') {
  const cards=structuredClone(source.cards).slice(0,4), original=structuredClone(source.collection).slice(0,4), values=[2.35,1.27,.56,0], quantities=[2,1,2,1];
  const collection=original.map((entry,i)=>({...entry,qty:quantities[i],condition:'Near Mint',manualValue:values[i],manualValueCondition:'Near Mint',manualValueCurrency:'USD'}));
  const selected={...collection[0],id:'value-selected-'+game,qty:1,manualValue:12.34};collection.splice(1,0,selected);
  const unpriced={...original[3],id:'value-unpriced-'+game,qty:1,condition:'Unknown condition'};
  for(const key of ['manualValue','manualValueCondition','manualValueCurrency','conditionQuotes'])delete unpriced[key];
  if(game==='mtg')cards.forEach((card,i)=>{card.color_identity=[['R','U'],['B'],[],['G']][i];card.colors=[...card.color_identity];if(card.card_faces?.[0])card.card_faces[0].colors=[...card.colors];});
  else if(game==='ptcg')cards.forEach((card,i)=>{card.category=['Pokemon','Trainer','Energy','Pokemon'][i];card.types=[['Fire','Water'],[],['Fire'],[]][i];});
  else cards.forEach((card,i)=>{card.category=['Monster','Spell','Trap','Monster'][i];card.attribute=['LIGHT','','',''][i];});
  const history=structuredClone(VALUE_HISTORY).map(point=>point.date==='2026-10-18'?{...point,date:today,total:19.43,copies:7,unpriced:0}:point);
  return {cards,collection,unpriced,history,expected:{total:19.43,copies:7,selectedId:selected.id,cardId:cards[0].id,name:cards[0].name,groups:game==='mtg'?['Multicolor','Black','Colorless','Green']:game==='ptcg'?['Fire / Water','Trainer','Energy','Unknown']:['LIGHT','Spell','Trap','Unknown']}};
}
