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
      if (document.pointerLockElement === canvas || this.dragging) this.look(e.movementX, e.movementY);
    });
    canvas.addEventListener('mousedown', () => { this.dragging = true; });
    window.addEventListener('mouseup', () => { this.dragging = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
  }
  look(dx, dy) {
    if (!this.enabled) return;
    this.yaw -= dx * CFG.cam.sens;
    this.pitch = clamp(this.pitch + dy * CFG.cam.sens, CFG.cam.pitchMin, CFG.cam.pitchMax);
  }
  // ArrowUp/Down also move. Ctrl or C slides (browsers keep Ctrl+W for themselves, so C is the safe key).
  command() {
    const k = this.keys, use = this.use; this.use = false;
    return {
      f: (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0),
      r: (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0),
      yaw: this.yaw, jump: !!k.Space, dash: !!(k.ShiftLeft || k.ShiftRight),
      slide: !!(k.ControlLeft || k.ControlRight || k.KeyC), use
    };
  }
}

