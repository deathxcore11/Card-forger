const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:800,height:600}});p.on('pageerror',e=>console.log('ERR',e.message,e.stack.split('\n').slice(1,4).join('|')));await p.goto('file://'+process.cwd()+'/lablocal.html');await p.waitForTimeout(4000);
const K=process.argv[2]?+process.argv[2]:0.8,N=+(process.argv[3]||60);
const out=await p.evaluate(({K,N})=>{if(window.__T)Object.assign(TUNE,window.__T);const B=LAB_IDS.slice(0,18),pick=a=>a[Math.random()*a.length|0],T=40,res={0:[],1:[],2:[],3:[],4:[]},mode={};
 const run=id=>{const c=simBot(id,T,'crowd'),bs=simBot(id,T,'boss'),h=simBot(id,T);return{dps:c.dps,boss:bs.dps,kills:h.kills,loops:c.loops,react:c.react}};
 for(const id of B)res[0].push({id:chiName(id),...run(id)});
 // ladder: chain adds a basic each step ('tall'); and fusion x fusion ('wide')
 const mk=(a,b)=>{if(a===b)return null;try{return fuse(a,b)}catch(e){return null}};
 for(let i=0;i<N;i++){let cur=pick(B);for(let r=1;r<=4;r++){let nx=null,tries=0;while(!nx&&tries++<5){let o=pick(B);if(r>1&&i%2){ // wide: other parent is a fusion of rank r-1 made earlier
      const pool=res[r-1].filter(x=>x.fid);if(pool.length)o=pick(pool).fid}
     nx=mk(cur,o)}if(!nx)break;cur=nx;const A=atkOf(cur);res[FX[cur].rank].push({fid:cur,id:chiName(cur),wide:i%2,d:A.d,els:A.els.join('+'),mut:A.mut,mult:A.mult,...run(cur)});if(FX[cur].rank>=4)break}}
 return res},{K,N});
const q=(a,f)=>{const s=a.map(x=>Math.sqrt(x.dps*x.boss)).sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(f*s.length))]};
let base=q(out[0],.5);console.log('K',K);for(const r in out){const a=out[r];if(!a.length)continue;const top=a.slice().sort((x,y)=>y.dps-x.dps)[0],low=a.slice().sort((x,y)=>x.dps-y.dps)[0];
 console.log('rank',r,'n',a.length,'p10',q(a,.1).toFixed(1),'med',q(a,.5).toFixed(1),'p90',q(a,.9).toFixed(1),'max',top.dps.toFixed(1),'BLEND x base',(q(a,.5)/base).toFixed(2),'p90/med',(q(a,.9)/q(a,.5)).toFixed(2),'| top',top.id,top.d,top.els||'',top.mut||'','| low',low.id,low.d,low.dps.toFixed(1))}
console.log('basics',out[0].map(x=>x.id+' '+x.dps.toFixed(1)+'/'+x.boss.toFixed(1)).join(', '));const qb=(a,f)=>{const s=a.map(x=>x.boss).sort((x,y)=>x-y);return s[Math.floor(f*s.length)]};for(const r in out)console.log('boss rank',r,'p10',qb(out[r],.1).toFixed(1),'med',qb(out[r],.5).toFixed(1),'p90',qb(out[r],.9).toFixed(1),'x',(qb(out[r],.5)/qb(out[0],.5)).toFixed(2));
for(const r of [1,2,3,4]){const a=out[r],byd={};for(const x of a){(byd[x.d]=byd[x.d]||[]).push(x.dps)}console.log('rank',r,'by delivery',Object.entries(byd).map(([k,v])=>k+':'+(v.reduce((s,x)=>s+x,0)/v.length).toFixed(0)+'('+v.length+')').join(' '));
 const m={std:[],twin:[],prism:[]};for(const x of a)m[x.mut||'std'].push(x.dps);console.log('  mut',Object.entries(m).map(([k,v])=>k+':'+(v.length?(v.reduce((s,x)=>s+x,0)/v.length).toFixed(0):'-')+'('+v.length+')').join(' '),' tall',(a.filter(x=>!x.wide).reduce((s,x)=>s+x.dps,0)/Math.max(1,a.filter(x=>!x.wide).length)).toFixed(0),'wide',(a.filter(x=>x.wide).reduce((s,x)=>s+x.dps,0)/Math.max(1,a.filter(x=>x.wide).length)).toFixed(0))}
require('fs').writeFileSync('bots-'+K+'.json',JSON.stringify(out));await b.close()})()
