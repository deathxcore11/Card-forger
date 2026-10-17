// One dropdown renderer for every game's existing <select> controls.
// Keep the original control and its change handler as the source of truth.
export function pickerOptions(select) {
  return Array.from(select.options, (o, index) => ({index, value:o.value, label:o.label || o.textContent || '', selected:o.selected, disabled:o.disabled || !!o.closest?.('optgroup')?.disabled, group:o.closest?.('optgroup')?.label || '', hidden:o.hidden || !!o.closest?.('optgroup')?.hidden}));
}
export function chooseOption(select, index) {
  const item=pickerOptions(select)[index];
  if(select.disabled || !item || item.disabled || item.hidden) return false;
  const changed=select.selectedIndex!==index;
  select.selectedIndex=index;
  if(changed) {select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));}
  return true;
}
// Chromium's custom native-select appearance can focus an offscreen pill without
// revealing it. Keep keyboard and restored focus visible inside this known rail
// only; scrolling the control itself would also move the page vertically.
export function revealCollectionFilter(select,doc=select?.ownerDocument) {
  const rail=select?.parentElement,content=doc?.querySelector?.('#content'),known={tCollSet:[''],tCollSort:[''],tCollKind:['kind','rarity','show']};
  if(select?.tagName!=='SELECT'||!select.isConnected||select.disabled||select.multiple||select.size>1||doc?.body?.dataset.view!=='collection'||!['ptcg','ygo'].includes(doc.body.dataset.game)||!content?.isConnected||!Object.hasOwn(known,select.dataset.change)||!known[select.dataset.change].includes(select.dataset.field||'')||!rail?.matches('.coll-tools > .filter-pills')||rail.closest('#content')!==content||!['auto','scroll'].includes(doc.defaultView?.getComputedStyle(rail).overflowX))return;
  const box=rail.getBoundingClientRect(),item=select.getBoundingClientRect(),scale=box.width/rail.offsetWidth,left=box.left+rail.clientLeft*scale,right=left+rail.clientWidth*scale;
  if(!Number.isFinite(scale)||scale<=0||!rail.clientWidth||!item.width)return;
  const delta=item.left<left?item.left-left:item.right>right?item.right-right:0;
  if(delta)rail.scrollLeft+=delta/scale;
}
export function attachGlassSelects(doc=document) {
  // This accessibility behavior also applies when the custom dialog is absent;
  // keep the ordinary native select and its default keyboard actions intact.
  doc.addEventListener?.('focusin',e=>revealCollectionFilter(e.target,doc));
  if(!doc.body?.append || !doc.createElement('dialog').showModal) return;
  let active=null,serial=0,positionFrame=0,suppressTouchClick=false;
  const schedulePosition=()=>{
    if(!active || positionFrame)return;
    positionFrame=doc.defaultView.requestAnimationFrame(()=>{positionFrame=0;active?.position?.();});
  };
  const eligible=t=>t?.tagName==='SELECT' && !t.disabled && !t.multiple && t.size<=1;
  const close=(restore=true)=>{
    if(!active)return;
    const {select,dialog,observer,expanded,controls}=active;active=null;
    observer?.disconnect();
    if(dialog.open)dialog.close();dialog.remove();
    if(expanded==null)select.removeAttribute('aria-expanded');else select.setAttribute('aria-expanded',expanded);
    if(controls==null)select.removeAttribute('aria-controls');else select.setAttribute('aria-controls',controls);
    if(restore&&select.isConnected)select.focus({preventScroll:true});
  };
  const open=initial=>{
    let select=initial;
    if(active?.select===select)return;
    close(false);
    const dialog=doc.createElement('dialog'),list=doc.createElement('div'),heading=doc.createElement('div');
    const labelNode=select.labels?.[0]?.cloneNode(true);labelNode?.querySelectorAll('select').forEach(n=>n.remove());
    const title=select.getAttribute('aria-label') || labelNode?.textContent?.trim() || select.title || 'Choose an option';
    dialog.className='glass-select-menu';dialog.setAttribute('aria-label',title);dialog.id='glass-picker-'+(++serial);
    heading.className='gp-title';heading.textContent=title;dialog.append(heading);
    list.className='glass-select-options';list.setAttribute('role','listbox');list.setAttribute('aria-label',title);
    // A background app render may replace the control without changing its choices.
    // Keep the open menu bound to the equivalent new source, preserving the gesture.
    const identity=s=>['id','name','data-change','data-field','aria-label'].map(k=>s.getAttribute(k)||'').join('\u001f');
    const identityKey=identity(select),ordinal=Array.from(doc.querySelectorAll('select')).filter(s=>identity(s)===identityKey).indexOf(select);
    const sameOptions=(a,b)=>a.length===b.length&&a.every((o,i)=>['value','label','disabled','group','hidden'].every(k=>o[k]===b[i][k]));
    const options=pickerOptions(select),buttons=[];let group='';
    for(const o of options){
      if(o.hidden)continue;
      if(o.group && o.group!==group){const label=doc.createElement('div');label.className='gp-title';label.textContent=o.group;list.append(label);}group=o.group;
      const b=doc.createElement('button');b.type='button';b.setAttribute('role','option');b.setAttribute('aria-selected',String(o.selected));b.disabled=o.disabled;b.tabIndex=-1;
      const name=doc.createElement('span'),check=doc.createElement('span');name.textContent=o.label;check.textContent=o.selected?'✓':'';check.setAttribute('aria-hidden','true');b.append(name,check);
      const choose=()=>{if(active?.dialog!==dialog)return;if(!select.isConnected){close(false);return;}close();chooseOption(select,o.index);};
      b.onclick=choose;
      // Chromium can suppress the synthetic click after a touch scroll settles,
      // even though pointerdown/up land on the same option. Complete that tap
      // directly; a drag or pointercancel must never select an option.
      let press=null;
      b.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse')press={id:e.pointerId,x:e.clientX,y:e.clientY};});
      b.addEventListener('pointercancel',()=>{press=null;});
      b.addEventListener('pointerup',e=>{const p=press;press=null;if(p&&p.id===e.pointerId&&Math.hypot(e.clientX-p.x,e.clientY-p.y)<=8){e.preventDefault();e.stopPropagation();suppressTouchClick=true;setTimeout(()=>{suppressTouchClick=false;},700);choose();}});
      list.append(b);buttons.push(b);
    }
    if(options.filter(o=>!o.hidden).length>12){
      const search=doc.createElement('input');search.type='search';search.placeholder='Filter options';search.setAttribute('aria-label','Filter '+title);search.className='glass-select-filter';
      search.oninput=()=>{for(const b of buttons)b.hidden=!b.textContent.toLocaleLowerCase().includes(search.value.toLocaleLowerCase());for(const h of list.querySelectorAll('.gp-title'))h.hidden=!!search.value;};
      search.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();buttons.find(b=>!b.disabled&&!b.hidden)?.focus();}e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close();}};
      dialog.append(search);
    }
    dialog.append(list);doc.body.append(dialog);
    active={select,dialog,expanded:select.getAttribute('aria-expanded'),controls:select.getAttribute('aria-controls')};
    select.setAttribute('aria-expanded','true');select.setAttribute('aria-controls',dialog.id);
    const accent=getComputedStyle(select).getPropertyValue('--game-color');if(accent)dialog.style.setProperty('--game-color',accent);
    dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
    // A completed outside gesture dismisses the menu. A release left over from the
    // opening tap must never be treated as an outside click.
    let outsidePress=false;
    const outside=e=>{const r=dialog.getBoundingClientRect();return e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom);};
    dialog.addEventListener('pointerdown',e=>{outsidePress=outside(e);});
    dialog.addEventListener('click',e=>{if(outsidePress&&outside(e))close();outsidePress=false;});
    let typed='',lastKey=0;
    dialog.addEventListener('keydown',e=>{
      const enabled=buttons.filter(b=>!b.disabled&&!b.hidden),i=enabled.indexOf(doc.activeElement);
      let n;
      if(e.key==='ArrowDown')n=(i+1)%enabled.length;
      if(e.key==='ArrowUp')n=(i-1+enabled.length)%enabled.length;
      if(e.key==='Home')n=0;if(e.key==='End')n=enabled.length-1;
      if(n!==undefined){e.preventDefault();enabled[n]?.focus();}
      else if(e.key==='Tab'){close();}
      else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.key!==' '){
        e.preventDefault();typed=Date.now()-lastKey>700?e.key:typed+e.key;lastKey=Date.now();enabled.find(b=>b.textContent.toLocaleLowerCase().startsWith(typed.toLocaleLowerCase()))?.focus();
      }
      e.stopPropagation();
    });
    const first=buttons.find(b=>b.getAttribute('aria-selected')==='true'&&!b.disabled)||buttons.find(b=>!b.disabled);
    if(first)first.autofocus=true;
    const position=()=>{
      if(!select.isConnected)return close(false);
      const view=doc.defaultView,viewport=view.visualViewport,r=select.getBoundingClientRect(),vw=viewport?.width||view.innerWidth,vh=viewport?.height||view.innerHeight;
      const left=viewport?.offsetLeft||0,top=viewport?.offsetTop||0,width=Math.min(Math.max(r.width,240),vw-20);
      dialog.style.width=width+'px';dialog.style.left=Math.max(left+10,Math.min(r.left,left+vw-width-10))+'px';
      const below=top+vh-r.bottom-12,above=r.top-top-12,down=below>=Math.min(dialog.scrollHeight,280)||below>=above;
      const maxHeight=Math.max(100,Math.min(vh-20,down?below:above));dialog.style.maxHeight=maxHeight+'px';
      dialog.style.top=Math.max(top+10,Math.min(top+vh-Math.min(dialog.scrollHeight||280,maxHeight)-10,down?r.bottom+6:r.top-Math.min(dialog.scrollHeight||280,maxHeight)-6))+'px';
    };
    active.position=position;
    // Anchor before showModal's autofocus, rather than initially laying the dialog
    // out at the bottom of a long page and scrolling the whole document to it.
    position();
    try{dialog.showModal();}catch{close(false);return;}
    position();
    if(first){
      first.tabIndex=0;first.focus({preventScroll:true});
      // Scroll only the menu. scrollIntoView can scroll the page and mobile viewport.
      dialog.scrollTop=Math.max(0,first.offsetTop-dialog.clientHeight/2+first.offsetHeight/2);
    }
    if(typeof MutationObserver!=='undefined'){
      active.observer=new MutationObserver(records=>{
        if(!active)return;
        if(!select.isConnected){
          const replacement=Array.from(doc.querySelectorAll('select')).filter(s=>identity(s)===identityKey)[ordinal];
          if(!replacement||!eligible(replacement)||!sameOptions(options,pickerOptions(replacement)))return close(false);
          select=replacement;active.select=select;
          active.expanded=select.getAttribute('aria-expanded');active.controls=select.getAttribute('aria-controls');
          select.setAttribute('aria-expanded','true');select.setAttribute('aria-controls',dialog.id);schedulePosition();
        }else if(records.some(r=>r.target===select||select.contains(r.target)))close(false);
      });
      active.observer.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','hidden']});
    }
  };
  // Cancel the native picker before Android can display its system dialog.
  doc.addEventListener('pointerdown',e=>{suppressTouchClick=false;if(eligible(e.target))e.preventDefault();},true);
  doc.addEventListener('mousedown',e=>{if(eligible(e.target))e.preventDefault();},true);
  doc.addEventListener('click',e=>{if(suppressTouchClick&&e.detail!==0){suppressTouchClick=false;e.preventDefault();e.stopImmediatePropagation();return;}if(eligible(e.target)){e.preventDefault();e.stopPropagation();open(e.target);}},true);
  doc.addEventListener('keydown',e=>{if(eligible(e.target)&&['Enter',' ','ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();open(e.target);}},true);
  // Mobile browser bars, keyboards and fold changes resize/scroll the viewport.
  // Reposition the open menu; these are not user dismissal gestures.
  doc.defaultView?.addEventListener('resize',schedulePosition);
  doc.defaultView?.visualViewport?.addEventListener('resize',schedulePosition);
  doc.defaultView?.visualViewport?.addEventListener('scroll',schedulePosition);
  doc.addEventListener('scroll',e=>{if(active&&!active.dialog.contains(e.target))schedulePosition();},true);
}
