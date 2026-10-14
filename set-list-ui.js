import {esc} from './ui.js';
// Decode provider entities as text, then escape at the HTML boundary.
export function catalogueText(value) {
 return String(value ?? '').replace(/&(?:apos|#39|#x27);/gi,"'").replace(/&quot;/gi,'"').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
}
// Shared emblem treatment. Use verified set logos/symbols; unknown sets keep their code.
export function setRowContent({name,code,image='',symbol='',detail='',count=0,owned=null}){
 name=catalogueText(name);detail=catalogueText(detail);
 const fallback=symbol||`<span class="set-art-code">${esc(code)}</span>`;
 return `<span class="set-media ${image?'':'no-art'}">${image?`<img src="${esc(image)}" alt="${esc(name)} set artwork" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true;this.parentElement.classList.add('no-art')">`:''}<span class="set-media-fallback" aria-hidden="true">${fallback}</span></span><span class="set-row-main"><b>${symbol}<span>${esc(name)}</span></b><span class="set-row-detail"><span class="set-code-mark">${esc(code)}</span><span>${esc(detail)}</span></span></span><span class="set-row-count"><b>${Number(count).toLocaleString()}</b><small>${Number(count)===1?'card':'cards'}</small>${owned>0?`<small class="ok-text">${Number(owned).toLocaleString()} owned</small>`:''}</span>`;
}
