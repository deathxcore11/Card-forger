// Keyboard and mouse. Holds the camera yaw and pitch and turns keys into a movement command.
import { CFG } from '../data/config.js';
import { clamp } from './util.js';

export class Input {
  constructor(canvas) {
    this.keys = {}; this.yaw = 0; this.pitch = 0; this.dragging = false; this.canvas = canvas;
    this.enabled = false;                                      // look only while a run is live
    this.use = false;
    window.addEventListener('keydown', e => { if (!e.repeat && e.code === 'KeyE') this.use = true; this.keys[e.code] = true; if (e.code === 'Space') e.preventDefault(); });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    document.addEventListener('mousemove', e => {
      if (document.pointerLockElement === canvas || this.dragging) this.look(e.movementX, e.movementY, 'mouse');
    });
    canvas.addEventListener('mousedown', e => { this.dragging = true; if (document.pointerLockElement === canvas) { if (e.button === 0) this.mouseL = true; if (e.button === 2) this.mouseR = true; } });       // controls v2: with the mouse captured, left click flips and right click grabs
    window.addEventListener('mouseup', e => { if (e.button === 0) this.mouseL = false; if (e.button === 2) this.mouseR = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('mouseup', () => { this.dragging = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
  }
  // kind: 'mouse', 'pad' (right stick) or 'drag' (touch). this.mult scales the turn speed per kind (Settings: look speed, drag look speed, mouse look speed; 5 is 1x); this.inv inverts per kind: { x, y }
  look(dx, dy, kind) {
    if (!this.enabled) return;
    const m = (this.mult && this.mult[kind]) || 1, iv = (this.inv && this.inv[kind]) || null, k = CFG.cam.sens * m;
    this.yaw -= dx * k * (iv && iv.x ? -1 : 1);
    this.pitch = clamp(this.pitch + dy * k * (iv && iv.y ? -1 : 1), CFG.cam.pitchMin, CFG.cam.pitchMax);
  }
  // ArrowUp/Down also move. Ctrl or C slides (browsers keep Ctrl+W for themselves, so C is the safe key).
  command() {
    const k = this.keys, use = this.use, t = this.touch; this.use = false;
    const f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0), r = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    return {
      f: t && t.f ? t.f : f, r: t && t.r ? t.r : r,                                // touch stick is analogue; keys are -1, 0, 1
      yaw: this.yaw, jump: !!k.Space || !!(t && t.jump), dash: !!(k.ShiftLeft || k.ShiftRight) || !!(t && t.dash),
      slide: !!((!window.__dsRiding && (k.ControlLeft || k.ControlRight)) || k.KeyC) || !!(t && t.slide), use, hold: !!k.KeyE || !!(t && t.use),       // on the card Ctrl is the manual button, not slide
      flip: !!k.KeyJ || !!this.mouseL || !!(t && t.flip), grab: !!k.KeyK || !!this.mouseR || !!(t && t.grab), grind: !!k.KeyL || !!k.KeyF || !!(t && t.grind), spin: (k.KeyE ? 1 : 0) - (k.KeyQ ? 1 : 0), revert: !!(k.ControlLeft || k.ControlRight) || !!(t && t.revert), special: !!k.KeyX || !!(t && t.special),       // controls v2: left click or J flip, right click or K grab, F or L grind, Ctrl held manual and revert, X (or the touch button) the special kb: !(t && (t.f || t.r || t.jump || t.dash || t.slide || t.use))       // the feel pass keys
    };
  }
}


