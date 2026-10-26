// A release may finish installing after the old 12-second reload window.
// Offer a deliberate reload; never end an active match or clear account storage.
export function registerWebsiteUpdates({window,document,version,isPlaying=()=>false}={}){
 const service=window?.navigator?.serviceWorker;if(!service)return {refresh(){},destroy(){}};
 let notice=null,targetVersion=null,closed=false;
 const newer=value=>/^\d+\.\d+\.\d+$/.test(value||'')&&value.split('.').some((n,i,a)=>a.slice(0,i).every((v,j)=>Number(v)===Number(version.split('.')[j]))&&Number(n)>Number(version.split('.')[i]));
 function refresh(){
  if(closed)return;
  if(!targetVersion){notice?.remove();notice=null;return;}
  if(!notice){
   notice=document.createElement('section');notice.className='website-update-notice panel';notice.setAttribute('role','status');notice.setAttribute('aria-label','Website update');
   const text=document.createElement('span');text.textContent=`Website ${targetVersion} is ready. Reload to use the latest Play.`;
   const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='Reload update';
   button.addEventListener('click',()=>{if(!isPlaying())window.location.reload();});notice.append(text,button);document.body.append(notice);
  }
  notice.hidden=isPlaying();
 }
 const query=()=>service.controller?.postMessage({type:'CARDSTASHY_RELEASE_QUERY'});
 const message=event=>{if(event.source!==service.controller||event.data?.type!=='CARDSTASHY_RELEASE_READY')return;if(newer(event.data.version)){targetVersion=event.data.version;refresh();}};
 service.addEventListener('message',message);service.addEventListener('controllerchange',query);
 Promise.resolve(service.register('./sw.js',{updateViaCache:'none'})).then(()=>{if(!closed)query();}).catch(()=>{});
 return {refresh,destroy(){closed=true;notice?.remove();service.removeEventListener('message',message);service.removeEventListener('controllerchange',query);}};
}
