import {esc,options} from './ui.js';
const clean=value=>String(value ?? '').trim().slice(0,100);
const key=value=>clean(value).toLocaleLowerCase();
const entries=(state,game)=>game==='mtg'?state.collection || []:state.tcg?.[game]?.collection || [];
export function savedLocations(state,game){
 const names=[...(Array.isArray(state.settings?.savedLocations?.[game])?state.settings.savedLocations[game]:[]),...entries(state,game).map(e=>e.location),...(state.settings?.binders || []).filter(b=>b.game===game&&b.rule==='location').map(b=>b.value)],seen=new Set();
 return names.map(clean).filter(n=>{if(!n||seen.has(key(n)))return false;seen.add(key(n));return true;}).sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base',numeric:true}));
}
export function rememberLocation(state,game,value){
 let name=clean(value);name=savedLocations(state,game).find(n=>key(n)===key(name)) || name;
 state.settings ||= {};state.settings.savedLocations ||= {};state.settings.lastLocation ||= {};
 if(name){const names=savedLocations(state,game);if(!names.some(n=>key(n)===key(name)))names.push(name);state.settings.savedLocations[game]=names;}
 state.settings.lastLocation[game]=name;return name;
}
export function locationPicker(state,game,id,value=null,label='Where it lives'){
 const names=savedLocations(state,game);let selected=value===null?clean(state.settings?.lastLocation?.[game]):clean(value);
 selected=names.find(n=>key(n)===key(selected)) || selected;
 if(selected&&!names.some(n=>n===selected))names.push(selected);
 const isNew=!names.length&&!selected;
 return `<div class="location-picker span2"><label for="${esc(id)}Picker">${esc(label)}</label><select id="${esc(id)}Picker" data-change="chooseLocation" data-field="${esc(id)}">${options([['','Unsorted / no location'],...names.map(n=>['location:'+n,n]),['new','＋ Add a new location…']],isNew?'new':selected?'location:'+selected:'')}</select><input id="${esc(id)}" maxlength="100" value="${esc(selected)}" placeholder="e.g. Deck, Fire binder, Blue box…" aria-label="New location name" autocomplete="off" ${isNew?'':'hidden'}><small class="muted">Pick a saved name or add your own. New names are remembered when you save the card.</small></div>`;
}
export function chooseLocation(select,root=document){
 const input=root.querySelector('#'+select.dataset.field);if(!input)return;
 const newName=select.value==='new';input.hidden=!newName;input.value=newName?'':select.value.startsWith('location:')?select.value.slice(9):'';
 if(newName)input.focus?.();
}
