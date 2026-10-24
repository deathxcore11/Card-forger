import assert from 'node:assert/strict';
// The actual app has already booted. No renderer mocks or duplicate deck rows.
export async function checkDeckViews(page,{root,controls=root,label='deck',screenshots=false}={}){
 try{
 const viewer=page.locator(root),group=page.locator(controls).locator('.deck-view-switch');
 assert.equal(await viewer.count(),1,label+' has one shared viewer');
 const snapshot=()=>viewer.locator('[data-deck-card]').evaluateAll(nodes=>nodes.map(n=>({
  name:n.dataset.deckName,qty:n.dataset.deckQty,zone:n.dataset.deckZone,
  actions:[...n.querySelectorAll('[data-act]')].map(a=>({...a.dataset})),
  images:[...n.querySelectorAll('img')].map(a=>a.getAttribute('src')),
  finishes:[...n.querySelectorAll('[data-finish-model]')].map(a=>({model:a.dataset.finishModel,surface:a.dataset.finishSurface})),
  selected:[...n.querySelectorAll('input[type="checkbox"]')].map(a=>a.checked)
 })));
 const before=await snapshot();assert(before.length>0,label+' contains cards');
 await viewer.evaluate(n=>{window.__deckViewNodes=[...n.querySelectorAll('[data-deck-card]')];});
 for(const mode of ['compact','stacks','gallery','symbols']){
  await group.locator(`[data-mode="${mode}"]`).click();
  await page.waitForFunction(({root,mode})=>document.querySelector(root)?.dataset.deckView===mode,{root,mode});
  assert.deepEqual(await snapshot(),before,label+' '+mode+' preserves exact ordered cards, zones, actions, images and selections');
  assert(await viewer.evaluate(n=>[...n.querySelectorAll('[data-deck-card]')].every((a,i)=>a===window.__deckViewNodes[i])),label+' '+mode+' keeps the original nodes');
  assert.equal(await group.locator('[aria-checked="true"]').getAttribute('data-mode'),mode);
  const eligibility=await viewer.evaluate(async n=>{const {finishEligible}=await import('/finish-preview.js');return [...n.querySelectorAll('[data-finish-surface="large"]')].map(finishEligible);});
  assert(eligibility.every(value=>value===['gallery','stacks'].includes(mode)),label+' reuses the established finish renderer only on full-size art');
  const layout=await viewer.evaluate(n=>({doc:document.documentElement.scrollWidth,width:innerWidth,root:n.getBoundingClientRect().toJSON(),lists:[...n.querySelectorAll('[data-deck-list]')].filter(a=>a.getClientRects().length).map(a=>({width:a.getBoundingClientRect().width,scroll:a.scrollWidth,client:a.clientWidth,overflow:getComputedStyle(a).overflowX,rows:getComputedStyle(a).gridTemplateRows})),art:[...n.querySelectorAll('[data-deck-card] .lot-art > img,[data-deck-card] .row-thumb,[data-deck-card] .mini-art,[data-deck-card] .deck-compact-art')].filter(a=>!a.closest('.tile-chrome')).map(a=>({visible:!!a.getClientRects().length,width:a.getBoundingClientRect().width,height:a.getBoundingClientRect().height}))}));
  assert(layout.doc<=layout.width+2,label+' '+mode+' stays inside viewport: '+JSON.stringify(layout));
  assert(layout.root.left>=-.5&&layout.root.right<=layout.width+.5,label+' viewer stays in viewport');
  if(mode==='symbols')assert(layout.art.every(a=>!a.visible),label+' names view hides card images');
  if(['gallery','stacks'].includes(mode))for(const art of layout.art.filter(a=>a.visible)){assert(art.width>50&&Math.abs(art.width/art.height-63/88)<.06,label+' '+mode+' retains full portrait card art '+JSON.stringify(art));}
  if(mode==='stacks'){
   assert(layout.lists.every(a=>a.overflow==='auto'),label+' stacks clip and scroll within their group');
   const stack=await viewer.locator('[data-deck-list]').first().evaluate(list=>{
    const rows=[...list.querySelectorAll(':scope > [data-deck-card]')];
    const last=rows.at(-1),button=last?.matches('button')?last:last?.querySelector('button');button?.focus();
    const box=list.getBoundingClientRect(),card=last?.getBoundingClientRect(),first=rows[0]?.getBoundingClientRect(),second=rows[1]?.getBoundingClientRect();
    return {count:rows.length,overlap:second?Math.abs(second.top-first.top)<first.height:true,focused:!!button&&document.activeElement===button,raised:last&&getComputedStyle(last).zIndex,reachable:card&&card.left>=box.left-.5&&card.right<=box.right+.5};
   });
   assert(stack.overlap&&stack.focused&&stack.raised==='4'&&stack.reachable,label+' keyboard reaches and raises cards inside overlapping stacks: '+JSON.stringify(stack));
  }
  if(screenshots){await viewer.evaluate(n=>{const body=n.closest('#sheetBody');if(body)body.scrollTop+=n.getBoundingClientRect().top-body.getBoundingClientRect().top-16;else scrollTo(0,Math.max(0,n.getBoundingClientRect().top+scrollY-100));});await page.screenshot({path:`test-results/deck-view-${label}-${mode}.png`,fullPage:false,animations:'disabled'});}
 }
 // The group has one tab stop; arrow keys change the view and keep focus there.
 const last=group.locator('[data-mode="symbols"]');await last.focus();await last.press('ArrowRight');
 await page.waitForFunction(root=>document.querySelector(root)?.dataset.deckView==='compact',root);
 assert.equal(await group.locator(':focus').getAttribute('data-mode'),'compact');
 assert.equal(await group.locator('[tabindex="0"]').count(),1);
 assert.deepEqual(await snapshot(),before);
 return before;
 }catch(error){
  const state=await page.evaluate(()=>({sheetOpen:document.querySelector('#sheet')?.open,context:window.__uiTestState?.ui?.sheetCtx,viewers:[...document.querySelectorAll('.deck-viewer')].map(n=>({mode:n.dataset.deckView,game:n.dataset.game,controls:n.querySelectorAll('.deck-view-switch').length,rect:n.getBoundingClientRect().toJSON()})),text:document.querySelector('#sheetBody')?.innerText.slice(0,1500)}));
  error.message+='\nDeck-view diagnostics: '+JSON.stringify(state);throw error;
 }
}
