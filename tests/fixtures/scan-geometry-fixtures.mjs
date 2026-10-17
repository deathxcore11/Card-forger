// Synthetic pixels only. No user photos, derived photo pixels, or downloaded art.
export const inside=(x,y,q)=>{
 let hit=false;for(let i=0,j=q.length-1;i<q.length;j=i++)if((q[i].y>y)!==(q[j].y>y)&&x<(q[j].x-q[i].x)*(y-q[i].y)/(q[j].y-q[i].y)+q[i].x)hit=!hit;
 return hit;
};
export function field(w,h,color){const data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set([...(typeof color==='function'?color(x,y):color),255],(y*w+x)*4);return data;}
export function fill(data,w,h,q,color){for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(inside(x+.5,y+.5,q))data.set([...(typeof color==='function'?color(x,y):color),255],(y*w+x)*4);}
export const rectangle=(x,y,width,height)=>[{x,y},{x:x+width,y},{x:x+width,y:y+height},{x,y:y+height}];
export function counterCard(tint=0){
 const w=224,h=300,quad=rectangle(40,50,144,200),data=field(w,h,(x,y)=>{const n=(x*73+y*29+x*y)%65-32;return tint===0?[186+n,186+n,186+n]:tint===1?[170+n,180+n,175+n]:[150+n,175+n,195+n];});
 fill(data,w,h,quad,[220,195,60]);fill(data,w,h,rectangle(48,59,128,183),[205,205,205]);
 fill(data,w,h,rectangle(49,75,126,78),(x,y)=>[32+(x*3+y)%120,50+(x+y*7)%80,90+(x*3+y*2)%100]);
 for(const top of [60,230])fill(data,w,h,rectangle(53,top,116,7),(x,y)=>x%9<5?[40,40,40]:[205,205,205]);
 return {name:'isoluminant-counter-'+tint,w,h,data,quad};
}
export function rotate90(f){
 const data=new Uint8ClampedArray(f.data.length),w=f.h,h=f.w;
 for(let y=0;y<f.h;y++)for(let x=0;x<f.w;x++)data.set(f.data.subarray((y*f.w+x)*4,(y*f.w+x)*4+4),(x*w+f.h-1-y)*4);
 return {...f,name:f.name+'-rotated90',w,h,data,quad:f.quad?.map(p=>({x:f.h-1-p.y,y:p.x}))};
}
export function boundaryFixtures(){
 const cases=[counterCard(0),counterCard(1),counterCard(2)];
 cases.push(rotate90(cases[0]));
 const w=224,h=300;
 const art=field(w,h,[192,192,192]);fill(art,w,h,rectangle(42,82,140,84),(x,y)=>[25+(x*3+y)%90,70+(x+y*7)%80,100+(x*3+y*2)%100]);cases.push({name:'art-only',w,h,data:art});
 const paper=field(w,h,[30,40,50]);fill(paper,w,h,rectangle(40,50,144,200),[225,225,220]);cases.push({name:'blank-page',w,h,data:paper});
 const two=field(w,h,[30,40,50]);for(const x of [10,123]){fill(two,w,h,rectangle(x,60,90,126),[220,195,60]);fill(two,w,h,rectangle(x+8,78,74,54),(a,b)=>[60+(a*7+b)%70,80+(a+b*5)%80,100+(a*3+b*2)%80]);}cases.push({name:'two-cards',w,h,data:two});
 const page=field(w,h,[30,40,50]);fill(page,w,h,rectangle(15,10,194,280),[225,225,220]);
 for(const y of [30,270])fill(page,w,h,rectangle(35,y,150,8),(x)=>x%9<5?[30,30,30]:[225,225,220]);
 fill(page,w,h,rectangle(67,85,90,126),[220,195,60]);fill(page,w,h,rectangle(75,107,74,54),(x,y)=>[60+(x*7+y)%70,80+(x+y*5)%80,100+(x*3+y*2)%80]);cases.push({name:'card-on-printed-page',w,h,data:page});
 const texture=field(w,h,(x,y)=>{const n=45+(x*29+y*71+x*y)%85;return[n,n,n];});cases.push({name:'counter-only',w,h,data:texture});
 const partial=field(w,h,[186,186,186]);fill(partial,w,h,rectangle(40,-25,144,200),[220,195,60]);fill(partial,w,h,rectangle(49,0,126,78),(x,y)=>[32+(x*3+y)%120,50+(x+y*7)%80,90+(x*3+y*2)%100]);cases.push({name:'clipped-card',w,h,data:partial});
 return cases;
}
