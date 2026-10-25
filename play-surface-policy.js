// Integration seam for the incoming Play engine. Device class and folded state
// come from the native shell; viewport width alone does not prove a tablet.
export function playSurfacePolicy({platform='web',deviceClass='unknown',foldState='unknown',width=0,height=0}={}){
 const dimensions=Number.isFinite(width)&&Number.isFinite(height)&&width>=height&&Math.min(width,height)>=600&&Math.max(width,height)>=780;
 const allowed=platform==='web'?deviceClass==='desktop'&&dimensions||['tablet','foldable'].includes(deviceClass)&&dimensions&&(deviceClass!=='foldable'||foldState==='unfolded'):
  platform==='android'&&['tablet','foldable'].includes(deviceClass)&&dimensions&&(deviceClass!=='foldable'||foldState==='unfolded');
 const reason=deviceClass==='foldable'&&foldState!=='unfolded'?'Unfold to continue':width<height?'Rotate to landscape to continue':'Play requires a tablet or unfolded inner screen';
 return {allowed:!!allowed,showPlay:!!allowed,overlay:!allowed,message:allowed?'':reason};
}
export function createPlaySurfaceGuard({pause=()=>{},resume=()=>{},showOverlay=()=>{},hideOverlay=()=>{}}={}){
 let blocked=false;
 return {update(surface,{active=false}={}){const policy=playSurfacePolicy(surface);
  if(active&&!policy.allowed){if(!blocked){pause();blocked=true;}showOverlay({message:policy.message,logo:'app-logo',spinning:true});}
  else if(blocked){hideOverlay();blocked=false;if(active&&policy.allowed)resume();}
  return policy;
 },get blocked(){return blocked;}};
}
