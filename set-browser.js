// Display-only catalogue navigation. Never prune the source catalogue or change IDs.
import {esc,options} from './ui.js';
import {labelIcon} from './icons.js';
import {catalogueText,setYearSections} from './set-list-ui.js';
import {YGO_OFFICIAL_CATEGORIES,YGO_CATEGORY_VERIFIED_AT} from './set-release-metadata.js';
const norm=value=>catalogueText(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const officialYgo=new Map();
for(const [category,names] of Object.entries(YGO_OFFICIAL_CATEGORIES))for(const name of names){const key=norm(name),old=officialYgo.get(key);officialYgo.set(key,old&&old!==category?'Other':category);}
const pokemonMainExtras=new Set(['lc','col1','g1','det1','dv1','dc1','cel25','sm115','30th']);
const pokemonCompanion=new Set(['rc','sma','exu','cel25cc','30th-c','sve','mee','xya']);
const pokemonPromos=new Set(['bog','ex5.5','fut2020']);
export const SET_FAMILY_LABELS={main:'Main releases',companion:'Companion sets',decks:'Deck products',special:'Special & reprints',promos:'Promos & events',other:'Other & unclassified',all:'All sets'};
export function setFamily(game,set){
 const name=catalogueText(set?.name),id=String(set?.id||''),type=String(set?.set_type||'');
 if(game==='mtg'){
  if(set?.digital)return 'other';
  if(['promo'].includes(type))return 'promos';
  if(['token','memorabilia','minigame','treasure_chest','vanguard','alchemy'].includes(type))return 'other';
  if(type==='commander'||(['draft_innovation','masters','expansion'].includes(type)&&/\bcommander\b/i.test(name)))return 'companion';
  if(['expansion','core','masters','draft_innovation'].includes(type))return 'main';
  if(['starter','duel_deck','premium_deck','planechase','archenemy'].includes(type))return 'decks';
  if(['box','from_the_vault','spellbook','arsenal','masterpiece','funny'].includes(type))return 'special';
  return 'other';
 }
 if(game==='ptcg'){
  if(/promo|black star|mcdonald|\bPOP Series\b/i.test(name)||pokemonPromos.has(id))return 'promos';
  if(/^tk-/.test(id)||/trainer kit|starter|my first battle|battle academy|\bdeck\b/i.test(name))return 'decks';
  if(pokemonCompanion.has(id)||/gallery|shiny vault|classic collection/i.test(name))return 'companion';
  if(/southern islands|rumble/i.test(name))return 'special';
  // Provider-supported regular expansion families, not a catch-all for new IDs.
  if(/^(?:base[1-5]|gym[12]|neo[1-4]|ecard[1-3]|ex(?:[1-9]|1[0-6])|dp[1-7]|pl[1-4]|hgss[1-4]|bw(?:[1-9]|1[01])|xy(?:[1-9]|1[0-2])|sm\d+(?:\.5)?|swsh\d+(?:\.5)?|sv\d+(?:\.5[wb]?)?|me\d+(?:\.5)?)$/.test(id)||pokemonMainExtras.has(id))return 'main';
  return 'other';
 }
 if(game==='ygo'){
  // A named event/promo is never an ordinary booster, including Premiere rows
  // that Konami lists inside its broad Booster Packs category.
  if(/promo|tournament|championship.*(?:prize|qualifier)|prize cards?|sneak peek|premiere|participation|sweepstakes|lost art|thank you pack/i.test(name))return 'promos';
  const category=officialYgo.get(norm(name));
  if(['Booster Packs','Duelist Packs'].includes(category))return 'main';
  if(['Starter Decks','Structure Decks'].includes(category))return 'decks';
  if(['Tournaments','Promotional Cards','Magazines, Books, Comics','Video Game Bundles'].includes(category))return 'promos';
  if(['Special Edition Boxes','Tins','Others','Duel Terminal Cards'].includes(category))return 'special';
  if(category==='SPEED DUEL')return 'companion';
  if(/structure deck|starter deck|\bdecks?\b/i.test(name))return 'decks';
  if(/\btins?\b|mega.pack|collector|collection|special edition|anniversary edition|maximum gold|duel terminal/i.test(name))return 'special';
  if(/speed duel/i.test(name))return 'companion';
  return 'other';
 }
 return 'other';
}
export function setReleaseDate(set){const value=String(set?.released_at||set?.date||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return '';const date=new Date(value+'T00:00:00Z');return Number.isFinite(+date)&&date.toISOString().slice(0,10)===value?value:'';}
export function setReleaseStatus(set,today=new Date().toISOString().slice(0,10)){const date=setReleaseDate(set);return !date?'unknown':date>today?'upcoming':'released';}
export function setBrowserState(state={}){
 const searching=!!String(state.q||'').trim(),legacyAll=state.all===true;
 const family=state.family||(legacyAll?'all':searching&&!state.familyExplicit?'all':'main');
 const release=state.release||(searching||family==='all'?'all':'released');
 return {q:String(state.q||''),family:Object.hasOwn(SET_FAMILY_LABELS,family)?family:'all',release:['released','upcoming','unknown','all'].includes(release)?release:'all',year:String(state.year||''),sort:['new','old','name','count'].includes(state.sort)?state.sort:'new',limit:Number.isFinite(Number(state.limit))&&Number(state.limit)>0?Math.floor(Number(state.limit)):80,searching};
}
export function browseSets(catalogue,game,state={},today=new Date().toISOString().slice(0,10)){
 const filters=setBrowserState(state),q=catalogueText(filters.q).trim().toLowerCase(),all=Array.isArray(catalogue)?catalogue:[];
 const date=setReleaseDate,text=(a,b)=>String(a||'').localeCompare(String(b||''),undefined,{numeric:true,sensitivity:'base'}),count=x=>Number(game==='mtg'?x.card_count:game==='ygo'?x.expectedUniqueCards:x.count)||0;
 const rows=all.filter(s=>s&&(!q||[s.name,s.code,s.id,s.series,date(s)].some(v=>catalogueText(v).toLowerCase().includes(q)))&&(filters.family==='all'||setFamily(game,s)===filters.family)&&(filters.release==='all'||setReleaseStatus(s,today)===filters.release)&&(!filters.year||date(s).slice(0,4)===filters.year));
 rows.sort((a,b)=>{
  let order=0;
  if(filters.sort==='name')order=text(catalogueText(a.name),catalogueText(b.name));
  else if(filters.sort==='count')order=count(b)-count(a);
  else {const ad=date(a),bd=date(b);order=!ad&&!bd?0:!ad?1:!bd?-1:filters.sort==='old'?text(ad,bd):text(bd,ad);}
  return order||text(catalogueText(a.name),catalogueText(b.name))||text(a.id||a.code,b.id||b.code);
 });
 return {rows,visible:rows.slice(0,filters.limit),total:all.length,filters,years:[...new Set([...all.map(s=>date(s).slice(0,4)),filters.year].filter(Boolean))].sort().reverse(),today};
}
export function setCatalogueStatus(state,now=Date.now()) {
 const at=Number(state.checkedAt)||0;
 if(!at||at>now)return 'Freshness not verified · refresh to check';
 const stamp=new Date(at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
 return `Checked ${stamp}${state.error||now-at>=864e5?' · refresh needed':' · checked within 24 hours'}`;
}
export function setBrowserControls(result,{game,state,prefix,source}){
 const {filters:f,rows,total,years,visible}=result,action=key=>`${prefix}${key}`;
 const labels={...SET_FAMILY_LABELS,companion:game==='mtg'?'Commander & companion':game==='ygo'?'Speed Duel':'Companion & subsets'};
 const quick=['main','companion','promos','all'];
 return `<section class="set-browser-controls" aria-label="Set catalogue filters"><div class="searchbar"><input type="search" value="${esc(state.q||'')}" placeholder="Search every set by name or code" data-input="${action('Search')}" aria-label="Search all sets" autocomplete="off"></div>
 <div class="set-browser-quick" role="group" aria-label="Release families">${quick.map(family=>`<button class="${f.family===family?'on':''}" data-act="${action('Family')}" data-value="${family}" aria-pressed="${f.family===family}">${labelIcon({main:'sets',companion:'cardStack',promos:'pack',all:'grid'}[family])}${esc(family==='main'?'Main releases':family==='companion'?game==='mtg'?'Commander':game==='ygo'?'Speed Duel':'Companion':family==='promos'?'Promos':'All sets')}</button>`).join('')}</div>
 <div class="set-browser-facets"><label>Release type<select data-change="${action('Type')}" aria-label="Release type">${options(Object.entries(labels),f.family)}</select></label><label>Availability<select data-change="${action('Release')}" aria-label="Release availability">${options([['released','Released'],['upcoming','Upcoming'],['all','Any date'],['unknown','Date unavailable']],f.release)}</select></label><label>Year<select data-change="${action('Year')}" aria-label="Release year">${options([['','All years'],...years.map(y=>[y,y])],f.year)}</select></label><label>Order<select data-change="${action('Sort')}" aria-label="Set catalogue order">${options([['new','Newest first'],['old','Oldest first'],['name','Name A–Z'],['count','Most cards']],f.sort)}</select></label></div>
 <div class="set-browser-summary"><p role="status">${visible.length.toLocaleString()} shown · ${rows.length.toLocaleString()} matching · ${total.toLocaleString()} in catalogue</p><button class="link small" data-act="${action('Reset')}">Reset filters</button><button class="link small" data-act="${prefix==='sets'?'setsReload':'tSetsReload'}" ${state.busy?'disabled':''}>${state.busy?'Refreshing…':'Refresh'}</button></div>
 <p class="set-browser-freshness" role="status">${esc(setCatalogueStatus(state))}</p>
 <p class="set-browser-hint">${f.searching&&f.family==='all'&&f.release==='all'?'Searching across the full catalogue. Your selected year still applies.':f.family==='main'?`Regular booster releases. ${game==='mtg'?'Commander':'Companion sets'}, decks, promos and special products remain in the filters.`:`Showing ${esc(labels[f.family].toLowerCase())}. All sets keeps every supported release available.`} <span>${esc(source)}${game==='ygo'?` · categories checked ${YGO_CATEGORY_VERIFIED_AT}; unmatched releases stay in Other`:''}.</span></p></section>`;
}
export function setBrowserRows(result,renderRow){return ['new','old'].includes(result.filters.sort)?setYearSections(result.visible,renderRow,setReleaseDate):`<div class="set-list set-year-grid set-browser-flat">${result.visible.map(renderRow).join('')}</div>`;}
export function setBrowserDetail(game,set,today){const family=SET_FAMILY_LABELS[setFamily(game,set)],date=setReleaseDate(set),status=setReleaseStatus(set,today);return [family,set.digital?'Digital catalogue':set.series,status==='upcoming'?`Upcoming · ${date}`:date||'Date unavailable'].filter(Boolean).join(' · ');}
