// Touch controls: a floating move stick, drag-to-look, big Jump / Slide / Dash / Use buttons, a pause button, and tap-to-use on the world.
// It feeds the same one action map as the keyboard and the pad (Input.command): f, r, jump, slide, dash, use. Nothing here touches the sim.
// Shown on a touch screen, hidden while a pad is the thing in use (the AYN Thor has a built-in pad and a screen: the pad wins, tap-to-use still works).
import { clamp } from './util.js';

const CSS = `
#tc{position:fixed;inset:0;z-index:30;pointer-events:none;touch-action:none;user-select:none;-webkit-user-select:none;font-family:monospace}
#tc.off{display:none}
#tc .tcz{position:absolute;pointer-events:auto;touch-action:none;outline:none;-webkit-tap-highlight-color:transparent}
#tc .tcStick{left:0;bottom:0;width:46%;height:62%}
#tc .tcLook{left:0;top:0;width:100%;height:100%}
#tc .stickBase{position:absolute;width:min(30vmin,150px);height:min(30vmin,150px);margin:calc(min(30vmin,150px)/-2) 0 0 calc(min(30vmin,150px)/-2);border:2px solid #f3e1b8aa;border-radius:50%;background:#0d081066;display:none}
#tc .stickKnob{position:absolute;left:50%;top:50%;width:46%;height:46%;margin:-23% 0 0 -23%;border-radius:50%;background:#f3e1b8cc}
#tc .tcb{position:absolute;pointer-events:auto;touch-action:none;border:2px solid #f3e1b8cc;border-radius:50%;background:#1a0f12b0;color:#f3e1b8;display:flex;align-items:center;justify-content:center;font-size:min(3.4vmin,15px);letter-spacing:1px;text-align:center}
#tc .tcb.down{background:#7a54d0cc}
#tc .tcb.use{border-color:#ffd23f;color:#ffd23f}
#tc .tcpause{right:max(10px,env(safe-area-inset-right));top:max(10px,env(safe-area-inset-top));width:48px;height:48px;border-radius:12px;font-size:22px}
`;

export class TouchControls {
  // host: { yawLook(dx,dy), onTap(x,y), onPause() }; get(): the live Input object whose .touch this fills
  constructor(input, hooks) {
    this.input = input; this.hooks = hooks; this.enabled = false; this.visible = false; this.lastTouch = 0; this.lastPad = 0;
    this.state = { f: 0, r: 0, jump: false, slide: false, dash: false, use: false };
    input.touch = this.state;
    this.stick = null; this.look = null; this.btns = {};
    this._build();
    window.addEventListener('touchstart', () => this._seen(), { passive: true });
    window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') this._seen(); });
    window.addEventListener('gamepadconnected', () => this._refresh());
    window.addEventListener('gamepaddisconnected', () => this._refresh());
    if (typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches) this._seen();
  }
  _padPresent() { const pads = navigator.getGamepads ? navigator.getGamepads() : []; for (const p of pads) if (p && p.connected) return true; return false; }
  _seen() { this.lastTouch = performance.now(); this.touchDevice = true; document.body.classList.add('touch'); this._refresh(); }
  // the overlay goes away on the frame a pad is used and comes back on the next touch (whichever was used last wins)
  padUsed() { this.lastPad = performance.now(); this.lastTouch = 0; this._refresh(); }
  _refresh() { const show = this.enabled && this.touchDevice && !(this._padPresent() && this.lastPad > this.lastTouch); if (show !== this.visible) { this.visible = show; this.root.classList.toggle('off', !show); } }
  setEnabled(on) { this.enabled = on; if (!on) this._release(); this._refresh(); }
  get isTouch() { return !!this.touchDevice; }

  _release() { const s = this.state; s.f = s.r = 0; s.jump = s.slide = s.dash = s.use = false; this.stick = null; this.look = null; if (this.base) this.base.style.display = 'none'; for (const k in this.btns) this.btns[k].el.classList.remove('down'); }

  _build() {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const root = this.root = document.createElement('div'); root.id = 'tc'; root.classList.add('off'); document.body.appendChild(root);
    const mk = (cls, parent = root) => { const d = document.createElement('div'); d.className = cls; parent.appendChild(d); return d; };
    const lookZone = mk('tcz tcLook'), stickZone = mk('tcz tcStick');
    const base = this.base = mk('stickBase', root); const knob = this.knob = mk('stickKnob', base);
    // stick: floating, appears where the thumb lands
    stickZone.addEventListener('pointerdown', e => { if (this.stick) return; stickZone.setPointerCapture(e.pointerId); this.stick = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 }; base.style.left = e.clientX + 'px'; base.style.top = e.clientY + 'px'; base.style.display = 'block'; knob.style.transform = ''; });
    stickZone.addEventListener('pointermove', e => {
      const s = this.stick; if (!s || s.id !== e.pointerId) return; const R = base.offsetWidth / 2;
      let dx = e.clientX - s.x, dy = e.clientY - s.y; const d = Math.hypot(dx, dy) || 1, m = Math.min(d, R); dx = dx / d * m; dy = dy / d * m;
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      s.moved = Math.max(s.moved, d);
      const nx = dx / R, ny = dy / R, mag = Math.hypot(nx, ny), dead = 0.12;
      this.state.r = mag < dead ? 0 : nx; this.state.f = mag < dead ? 0 : -ny;
      if (mag > dead) this.hooks.onManualMove && this.hooks.onManualMove();
    });
    const endStick = e => {                                  // a short still touch in the stick area is a tap on the world, so the whole screen can open things
      const s = this.stick; if (!s || s.id !== e.pointerId) return; this.stick = null; this.state.f = this.state.r = 0; base.style.display = 'none';
      if (e.type === 'pointerup' && s.moved < 12 && performance.now() - s.t < 300) this.hooks.onTap(e.clientX, e.clientY);
    };
    stickZone.addEventListener('pointerup', endStick); stickZone.addEventListener('pointercancel', endStick);
    // look: drag turns the camera; a short still touch is a tap on the world
    lookZone.addEventListener('pointerdown', e => { if (this.look) return; lookZone.setPointerCapture(e.pointerId); this.look = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0 }; });
    lookZone.addEventListener('pointermove', e => {
      const l = this.look; if (!l || l.id !== e.pointerId) return; const dx = e.clientX - l.x, dy = e.clientY - l.y; l.x = e.clientX; l.y = e.clientY; l.moved = Math.max(l.moved, Math.hypot(e.clientX - l.sx, e.clientY - l.sy));
      this.hooks.look(dx * 1.6, dy * 1.6);
    });
    const endLook = e => { const l = this.look; if (!l || l.id !== e.pointerId) return; this.look = null; if (e.type === 'pointerup' && l.moved < 12 && performance.now() - l.t < 300) this.hooks.onTap(e.clientX, e.clientY); };
    lookZone.addEventListener('pointerup', endLook); lookZone.addEventListener('pointercancel', endLook);
    // buttons: bottom right, thumb reach. Jump biggest. Use shows only when something can be used.
    const bt = (name, label, css, hold) => {
      const el = mk('tcb ' + (name === 'use' ? 'use' : ''), root); el.textContent = label; Object.assign(el.style, css);
      const down = e => { e.preventDefault(); el.setPointerCapture(e.pointerId); this.state[name] = true; el.classList.add('down'); if (name === 'use') { this.input.use = true; this.hooks.onManualMove && this.hooks.onManualMove(); } };   // Use is a press (edge) and a hold, like E
      const up = () => { this.state[name] = false; el.classList.remove('down'); };
      el.addEventListener('pointerdown', down); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      this.btns[name] = { el };
    };
    const u = 'min(15vmin,84px)', bg = 'min(19vmin,104px)', pad = 'max(14px,env(safe-area-inset-right))', bot = 'max(14px,env(safe-area-inset-bottom))';
    bt('jump', 'JUMP', { width: bg, height: bg, right: pad, bottom: bot });
    bt('slide', 'SLIDE', { width: u, height: u, right: 'calc(' + pad + ' + ' + bg + ' + 10px)', bottom: bot });
    bt('dash', 'DASH', { width: u, height: u, right: pad, bottom: 'calc(' + bot + ' + ' + bg + ' + 10px)' });
    bt('use', 'USE', { width: u, height: u, right: 'calc(' + pad + ' + ' + bg + ' + 10px)', bottom: 'calc(' + bot + ' + ' + bg + ' + 10px)', display: 'none' });
    const pause = mk('tcb tcpause', root); pause.textContent = '||'; pause.addEventListener('pointerdown', e => { e.preventDefault(); this.hooks.onPause(); });
  }
  // the Use button only appears when the game has something to use
  setUseVisible(v) { const b = this.btns.use; if (b && (b.el.style.display !== 'none') !== v) b.el.style.display = v ? 'flex' : 'none'; }
}
