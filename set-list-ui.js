import {esc} from './ui.js';
// Shared structure, real game-specific art. Pack art is never replaced with an archetype logo.
export function setRowContent({name,code,image='',symbol='',detail='',count=0,owned=null}){
 const fallback=symbol||`<span class="set-art-code">${esc(code)}</span>`;
 return `<span class="set-media ${image?'':'no-art'}">${image?`<img src="${esc(image)}" alt="${esc(name)} set artwork" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true;this.parentElement.classList.add('no-art')">`:''}<span class="set-media-fallback" aria-hidden="true">${fallback}</span></span><span class="set-row-main"><b>${symbol}<span>${esc(name)}</span></b><span class="set-row-detail"><span class="set-code-mark">${esc(code)}</span><span>${esc(detail)}</span></span></span><span class="set-row-count"><b>${Number(count).toLocaleString()}</b><small>cards</small>${owned>0?`<small class="ok-text">${Number(owned).toLocaleString()} owned</small>`:''}</span>`;
}
