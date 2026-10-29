// Light daily goals, worked out from the match record alone: nothing to claim, nothing to grind.
// Two goals a day picked by the date, plus one for the week, like the missions in Snap or Pokémon Live.
import {matchHistory} from './play-match-record.js';
const DAILY=[
 {id:'win',label:'Win a match',need:1,count:r=>r.outcome==='win'},
 {id:'play3',label:'Play 3 matches',need:3,count:()=>true},
 {id:'draw-win',label:'Win on the draw',need:1,count:r=>r.outcome==='win'&&r.onPlay===false},
 {id:'fast-win',label:'Win by turn 8',need:1,count:r=>r.outcome==='win'&&Number.isSafeInteger(r.turns)&&r.turns<=8},
 {id:'healthy-win',label:'Win with 15+ life left',need:1,count:r=>r.outcome==='win'&&Number.isSafeInteger(r.life)&&r.life>=15},
 {id:'win2',label:'Win 2 matches',need:2,count:r=>r.outcome==='win'},
];
const WEEKLY={id:'decks3',label:'Win with 3 different decks this week',need:3};
const dayStart=t=>{const d=new Date(t);d.setHours(0,0,0,0);return d.getTime();};
// Weeks start on Monday, local time.
const weekStart=t=>{const d=new Date(dayStart(t));d.setDate(d.getDate()-(d.getDay()+6)%7);return d.getTime();};
const dayIndex=t=>{const d=new Date(t);return Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/864e5);};
export function todaysGoals(now=Date.now()){
 const i=dayIndex(now),a=i%DAILY.length,b=(a+1+(i>>3)%(DAILY.length-1))%DAILY.length;
 return [DAILY[a],DAILY[b===a?(a+1)%DAILY.length:b]];
}
// Progress for today's goals and the weekly one, and which of them the newest match just completed.
export function goalProgress({now=Date.now(),storage=globalThis.localStorage,rows=matchHistory({storage})}={}){
 const today=rows.filter(r=>r.at>=dayStart(now)),week=rows.filter(r=>r.at>=weekStart(now)),newest=rows.at(-1);
 const daily=todaysGoals(now).map(g=>{const all=today.filter(g.count).length,before=today.filter(r=>r!==newest).filter(g.count).length;return {id:g.id,label:g.label,need:g.need,have:Math.min(all,g.need),done:all>=g.need,justDone:all>=g.need&&before<g.need};});
 const decks=rows=>new Set(rows.filter(r=>r.outcome==='win').map(r=>r.deck?.key)).size;
 const w=decks(week),wb=decks(week.filter(r=>r!==newest));
 return [...daily,{id:WEEKLY.id,label:WEEKLY.label,need:WEEKLY.need,have:Math.min(w,WEEKLY.need),done:w>=WEEKLY.need,justDone:w>=WEEKLY.need&&wb<WEEKLY.need,weekly:true}];
}
