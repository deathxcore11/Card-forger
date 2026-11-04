// The Chronicle on the result banner: this match's page, then the deck's earlier pages to reread.
// `node(tag,text)` is the result screen's own element helper, so the page matches the rest of the banner.
import {clock} from './play-match-record.js';
export function chronicleBlock({chronicle:c,opponent='CPU',past=[],node}){
  if(!c)return null;
  const lines=[];
  if(c.swing)lines.push(['Biggest swing',`${c.swing.dmg} damage in one turn`,c.swing.n?`${c.swing.who==='opp'?opponent:'You'} · turn ${c.swing.n}`:'']);
  if(c.longest&&c.longest.ms>=10000)lines.push(['Longest turn',clock(c.longest.ms),c.longest.n?`${c.longest.who==='opp'?opponent:'You'} · turn ${c.longest.n}`:'']);
  if(c.standout)lines.push(['Standout',c.standout.name,`Power ${c.standout.power}`]);
  if(c.kills||c.losses)lines.push(['Creatures',`${c.kills} defeated`,`${c.losses} lost`]);
  for(const m of c.moments||[])lines.push(['Remembered',`Turn ${m.turn}`,[m.life!==null?`Life ${m.life}${m.oppLife!==null?' – '+m.oppLife:''}`:'',...(m.board||[])].filter(Boolean).join(' · ')]);
  if(!lines.length&&!past.length)return null;
  const box=node('section');box.className='play-chronicle';box.setAttribute('aria-label','Chronicle');
  const ul=node('ul');for(const [k,v,n]of lines){const li=node('li');li.append(node('span',k),node('b',v));if(n)li.append(node('small',n));ul.append(li);}if(lines.length)box.append(ul);
  if(past.length){const d=node('details');d.append(node('summary',`Earlier matches with this deck (${past.length})`));const ol=node('ol');
   for(const r of past){const li=node('li');li.setAttribute('data-outcome',r.outcome);const bits=[r.chronicle.swing?`${r.chronicle.swing.dmg} damage swing`:'',r.chronicle.standout?r.chronicle.standout.name:'',r.chronicle.moments?.length?`${r.chronicle.moments.length} remembered`:''].filter(Boolean).join(' · ');
    li.append(node('b',(r.outcome==='win'?'Won':r.outcome==='loss'?'Lost':'Drew')+(r.opponent?.name?' vs '+r.opponent.name:'')),node('small',[new Date(r.at).toLocaleDateString(undefined,{month:'short',day:'numeric'}),r.turns?r.turns+' turns':'',bits].filter(Boolean).join(' · ')));ol.append(li);}
   d.append(ol);box.append(d);}
  return box;
}
