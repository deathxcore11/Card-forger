// Aura reads only artwork already mounted by the app. It never resolves cards,
// fetches provider data, changes a printing, or writes collection/account state.
export const AURA_CARD = '[data-act="card"], [data-act="tCard"], [data-ask-show][data-kind="card"]';
export function imageIn(node) {
  const image = node?.matches?.('img') ? node : node?.querySelector?.('img');
  return image && !image.hidden && !image.closest('[hidden]') ? image : null;
}
// A pending decode owns a generation, so superseded selections cannot paint.
export function createAuraSelection({paint,clear,active,valid = () => true,ready = () => {}}) {
  let generation = 0, source = '';
  return {
    async select(image) {
      const ticket = ++generation, url = image?.currentSrc || image?.src || '';
      if (!image || !url) { source = ''; clear(); return; }
      if (url === source) return;
      try {
        if (!image.complete || !image.naturalWidth) return;
        await image.decode?.();
        await ready();
        if (ticket !== generation || !active() || !valid(image) || (image.currentSrc || image.src) !== url) return;
        paint(image, url); source = url;
      } catch { /* Keep the last usable atmosphere when an image fails. */ }
    },
    cancel() { generation++; source = ''; },
  };
}
export function initAura({document = globalThis.document, window = globalThis.window} = {}) {
  const host = document?.querySelector('#ambient');
  if (!host || !window?.MutationObserver) return () => {};
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mouse = window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
  let layers = [], shown = 0, timer = 0, queued = false, observing = false;
  let fadeTimer = 0, fadeResolve = null, paintedAt = 0;
  let context = '', desired = null, selected = false, hoverNode = null, suspendedFocus = false;
  const enabled = () => document.documentElement.dataset.theme === 'aura';
  const active = () => enabled() && !document.hidden;
  const mount = () => {
    if (layers.length) return;
    layers = [0,1].map(() => {
      const layer = document.createElement('canvas');
      layer.className = 'aura-art'; layer.width = 256; layer.height = 192;
      host.append(layer); return layer;
    });
  };
  const clear = () => {
    for (const layer of layers) { layer.classList.remove('on'); delete layer.dataset.src; layer.getContext('2d')?.clearRect(0,0,256,192); }
  };
  const selection = createAuraSelection({active,ready: () => {
    window.clearTimeout(fadeTimer); fadeResolve?.();
    const remaining = reduced.matches ? 0 : Math.max(0,1000-(window.performance.now()-paintedAt));
    return new Promise(resolve => { fadeResolve = resolve; fadeTimer = window.setTimeout(() => { fadeResolve = null; resolve(); },remaining); });
  },valid: image => image === desired && image.isConnected,
    clear,paint(image,url) {
      mount(); paintedAt = window.performance.now();
      const next = layers[1-shown], ctx = next.getContext('2d');
      if (!ctx) return;
      const w = image.naturalWidth, h = image.naturalHeight;
      // Only the tiny background copy is cropped. Portrait frames/text dissolve
      // outside the art window; original foreground pixels and masks are untouched.
      const portrait = h/w > 1.15, sy = portrait ? h*.12 : 0, sh = portrait ? h*.48 : h;
      const scale = Math.max(256/w,192/sh), dw = w*scale, dh = sh*scale;
      ctx.fillStyle = '#858e9e'; ctx.fillRect(0,0,256,192);
      ctx.globalAlpha = .78; ctx.drawImage(image,0,sy,w,sh,(256-dw)/2,(192-dh)/2,dw,dh); ctx.globalAlpha = 1;
      // Drawing a cross-origin image is allowed: no pixel reads or serialization.
      next.dataset.src = url; next.classList.add('on'); layers[shown].classList.remove('on'); shown = 1-shown;
    }});
  const choose = (image, intentional = false) => {
    if (intentional && !image) return;
    desired = image; if (intentional && image) selected = true;
    selection.select(image);
  };
  const stopHover = () => { window.clearTimeout(timer); timer = 0; hoverNode = null; };
  const home = () => imageIn(document.querySelector('#homeHero .hh-art'));
  const pageArt = () => imageIn(document.querySelector('#content .deck-hero .hero-art')) || home();
  const modalArt = () => document.querySelector('#sheet[open][data-card-popup="true"]') ? imageIn(document.querySelector('#sheetBody .cs-banner .cs-art')) : null;
  const reset = () => {
    stopHover(); window.clearTimeout(fadeTimer); fadeResolve?.(); fadeResolve = null; selection.cancel(); selected = false; desired = null;
    // Clear old-game pixels immediately. The destination is never painted with
    // an outgoing game's card, even if its own artwork is still loading.
    clear();
  };
  const sync = () => {
    queued = false;
    if (!enabled()) return;
    host.classList.toggle('aura-fallback',document.querySelector('#ambient .amb-art')?.dataset.game === document.body.dataset.game);
    const next = [document.body.dataset.game, document.body.dataset.view, window.location.hash.split('?')[0]].join('|');
    if (context !== next) { context = next; reset(); }
    if (!active()) return;
    const modal = modalArt();
    if (modal) { choose(modal,true); return; }
    // Closing a dialog returns focus to the opener: suppress that focus event,
    // preserving the deliberately viewed card rather than its older thumbnail.
    if (document.querySelector('#sheet[open]')) return;
    if (!selected) choose(pageArt());
    else if (desired?.isConnected) selection.select(desired);
    else desired = null;
  };
  const schedule = () => { if (!queued) { queued = true; window.queueMicrotask(sync); } };
  const contentObserver = new window.MutationObserver(schedule);
  const onLoad = event => {
    if (event.target === desired) selection.select(desired);
    else if (event.target?.closest?.('#homeHero, .deck-hero, .cs-banner')) schedule();
  };
  const onOver = event => {
    if (!active() || suspendedFocus || event.pointerType !== 'mouse' || !mouse.matches || document.querySelector('dialog[open]')) return;
    const node = event.target.closest?.(AURA_CARD);
    if (!node || node === hoverNode || node.contains(event.relatedTarget)) return;
    stopHover(); hoverNode = node;
    timer = window.setTimeout(() => { timer = 0; if (node.isConnected) choose(imageIn(node),true); },280);
  };
  const onOut = event => { if (hoverNode && !hoverNode.contains(event.relatedTarget)) stopHover(); };
  const onFocus = event => {
    if (!active() || suspendedFocus || document.querySelector('dialog[open]')) return;
    const node = event.target.closest?.(AURA_CARD);
    // Touch/click focus does not emulate hover. Keyboard focus is intentional.
    if (!node?.matches(':focus-visible')) return;
    stopHover(); timer = window.setTimeout(() => { timer = 0; if (node === document.activeElement) choose(imageIn(node),true); },280);
  };
  // Dialog focus restoration can be asynchronous. Keep the guard until an
  // actual mouse movement or keyboard navigation, rather than one microtask.
  const onMove = event => { if (event.pointerType === 'mouse' && event.isTrusted) { suspendedFocus = false; onOver(event); } };
  const onKey = event => { if (['Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) suspendedFocus = false; };
  const onClose = () => { stopHover(); suspendedFocus = true; schedule(); };
  const onVisibility = () => {
    host.classList.toggle('aura-paused',document.hidden);
    if (document.hidden) { stopHover(); window.clearTimeout(fadeTimer); fadeResolve?.(); fadeResolve = null; selection.cancel(); } else schedule();
  };
  const listen = (method) => {
    for (const [name,fn,capture] of [['load',onLoad,true],['pointerover',onOver,false],['pointerout',onOut,false],['pointermove',onMove,false],['keydown',onKey,false],['focusin',onFocus,false],['close',onClose,true],['visibilitychange',onVisibility,false]]) document[method](name,fn,capture);
    window[method]('hashchange',schedule);
  };
  const themeChanged = () => {
    if (enabled() && !observing) {
      observing = true; mount(); context = ''; listen('addEventListener');
      contentObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src','hidden','data-game','data-view','open']});
      onVisibility(); schedule();
    } else if (!enabled() && observing) {
      observing = false; reset(); contentObserver.disconnect(); listen('removeEventListener');
      layers.forEach(layer => layer.remove()); layers = []; shown = 0;
    }
  };
  const themeObserver = new window.MutationObserver(themeChanged);
  themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  // CSS listens to the same media query, including changes while Aura is open.
  const onMotion = () => { if (enabled()) { stopHover(); schedule(); } };
  reduced.addEventListener('change',onMotion);
  themeChanged();
  return () => {
    reset(); contentObserver.disconnect(); themeObserver.disconnect(); listen('removeEventListener');
    reduced.removeEventListener('change',onMotion); layers.forEach(layer => layer.remove()); layers = [];
  };
}
