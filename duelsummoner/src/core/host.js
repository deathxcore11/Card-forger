// The host adapter: everything the game needs from the platform, behind one object. In the browser it is localStorage, the
// keyboard/mouse/Gamepad API, vibration and the page. A native host (QuickJS inside the Android app) supplies the same shape.
//   host.input.command()   -> { f, r, yaw, jump, dash, slide, use } for this frame (the sim quantises it)
//   host.save.load()/write(obj), host.reportRun(results), host.haptic(kind), host.exit(), host.quality
import { Input } from './input.js';

export function createBrowserHost(canvas) {
  const KEY = 'duelsummoner.save';
  const storage = {
    get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
    set(text) { try { localStorage.setItem(KEY, text); return true; } catch (e) { return false; } }
  };
  const input = new Input(canvas);

  // Gamepad: left stick moves, right stick looks, A jump, B dash, right bumper slide, X use.
  const dead = v => (Math.abs(v) < 0.18 ? 0 : v);
  function padCommand(cmd) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const lx = dead(p.axes[0] || 0), ly = dead(p.axes[1] || 0), rx = dead(p.axes[2] || 0), ry = dead(p.axes[3] || 0);
      if (lx || ly) { cmd.r = lx; cmd.f = -ly; }
      if (rx || ry) input.look(rx * 14, ry * 14);
      const b = i => !!(p.buttons[i] && p.buttons[i].pressed);
      cmd.jump = cmd.jump || b(0); cmd.dash = cmd.dash || b(1); cmd.slide = cmd.slide || b(5); cmd.use = cmd.use || b(2); cmd.hold = cmd.hold || b(2);
      cmd.yaw = input.yaw;
      break;
    }
    return cmd;
  }

  return {
    input: {
      raw: input, look(dx, dy) { input.look(dx, dy); },
      command() { return padCommand(input.command()); },
      get yaw() { return input.yaw; }, set yaw(v) { input.yaw = v; },
      get pitch() { return input.pitch; }, set pitch(v) { input.pitch = v; },
      set enabled(v) { input.enabled = v; }, get keys() { return input.keys; }, set keys(v) { input.keys = v; }
    },
    save: {
      load() { const t = storage.get(); if (!t) return null; try { return JSON.parse(t); } catch (e) { return null; } },
      write(obj) { return storage.set(JSON.stringify(obj)); }
    },
    reportRun(results) { try { if (typeof window !== 'undefined' && window.dsReportRun) window.dsReportRun(results); } catch (e) { /* the host may not care */ } },
    haptic(kind) { try { if (navigator.vibrate) navigator.vibrate(kind === 'hurt' ? 40 : kind === 'levelup' ? [20, 30, 20] : 15); } catch (e) { /* optional */ } },
    exit() { try { history.back(); } catch (e) { /* optional */ } },
    quality: { renderScale: 2, maxEnemies: 300, particles: true }
  };
}


