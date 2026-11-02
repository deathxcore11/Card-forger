package dev.cardstashy.integration;

import android.content.Context;
import android.hardware.input.InputManager;
import android.os.Handler;
import android.os.Looper;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Controllers in the app: the handheld's own buttons (Retroid Pocket, AYN Odin/Thor, Anbernic) and any
// Bluetooth or USB pad. Android hands their buttons and sticks to the activity before the WebView sees
// them; while the page's controller layer is listening (it calls start()), MainActivity passes them
// here and they go to the page as named buttons and stick values instead of the WebView's own d-pad
// focus walk. Touch is untouched. Before start(), or after stop(), everything behaves as it always did.
@CapacitorPlugin(name = "CardStashyGamepad")
public class CardStashyGamepad extends Plugin implements InputManager.InputDeviceListener {
    private static CardStashyGamepad active;
    private volatile boolean listening = false;
    private InputManager inputs;
    // Last sent stick values, so a resting stick sends nothing.
    private final float[] sent = new float[8];

    @Override public void load() {
        active = this;
        inputs = (InputManager) getContext().getSystemService(Context.INPUT_SERVICE);
        if (inputs != null) inputs.registerInputDeviceListener(this, new Handler(Looper.getMainLooper()));
    }

    @Override protected void handleOnDestroy() {
        if (inputs != null) inputs.unregisterInputDeviceListener(this);
        if (active == this) active = null;
    }

    @PluginMethod public void start(PluginCall call) {
        listening = true;
        java.util.Arrays.fill(sent, 0f);
        call.resolve(devices());
    }

    @PluginMethod public void stop(PluginCall call) {
        listening = false;
        call.resolve();
    }

    @PluginMethod public void devices(PluginCall call) { call.resolve(devices()); }

    static boolean isPad(InputDevice device) {
        if (device == null || device.isVirtual()) return false;
        int s = device.getSources();
        return (s & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD || (s & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK;
    }

    private JSObject devices() {
        JSArray names = new JSArray();
        for (int id : InputDevice.getDeviceIds()) {
            InputDevice d = InputDevice.getDevice(id);
            if (isPad(d)) names.put(d.getName());
        }
        JSObject out = new JSObject();
        out.put("count", names.length());
        out.put("names", names);
        return out;
    }

    private void announceDevices() { if (hasListeners("devices")) notifyListeners("devices", devices()); }
    @Override public void onInputDeviceAdded(int id) { announceDevices(); }
    @Override public void onInputDeviceRemoved(int id) { announceDevices(); }
    @Override public void onInputDeviceChanged(int id) { announceDevices(); }

    private static String name(int code) {
        switch (code) {
            case KeyEvent.KEYCODE_BUTTON_A: return "A";
            case KeyEvent.KEYCODE_BUTTON_B: return "B";
            case KeyEvent.KEYCODE_BUTTON_X: return "X";
            case KeyEvent.KEYCODE_BUTTON_Y: return "Y";
            case KeyEvent.KEYCODE_BUTTON_L1: return "LB";
            case KeyEvent.KEYCODE_BUTTON_R1: return "RB";
            case KeyEvent.KEYCODE_BUTTON_L2: return "LT";
            case KeyEvent.KEYCODE_BUTTON_R2: return "RT";
            case KeyEvent.KEYCODE_BUTTON_THUMBL: return "LS";
            case KeyEvent.KEYCODE_BUTTON_THUMBR: return "RS";
            case KeyEvent.KEYCODE_BUTTON_START: return "START";
            case KeyEvent.KEYCODE_MENU: return "START";
            case KeyEvent.KEYCODE_BUTTON_SELECT: return "SELECT";
            case KeyEvent.KEYCODE_BUTTON_MODE: return null; // the handheld's home/guide key stays with Android
            case KeyEvent.KEYCODE_DPAD_UP: return "UP";
            case KeyEvent.KEYCODE_DPAD_DOWN: return "DOWN";
            case KeyEvent.KEYCODE_DPAD_LEFT: return "LEFT";
            case KeyEvent.KEYCODE_DPAD_RIGHT: return "RIGHT";
            case KeyEvent.KEYCODE_DPAD_CENTER: return "A";
            default: return null;
        }
    }

    // Called by MainActivity for every key. True means the page has it and nothing else should.
    static boolean key(KeyEvent event) {
        CardStashyGamepad pad = active;
        if (pad == null || !pad.listening || !pad.hasListeners("button")) return false;
        if (!isPad(event.getDevice())) return false;
        String button = name(event.getKeyCode());
        if (button == null) return false;
        int action = event.getAction();
        if (action != KeyEvent.ACTION_DOWN && action != KeyEvent.ACTION_UP) return true;
        JSObject data = new JSObject();
        data.put("button", button);
        data.put("down", action == KeyEvent.ACTION_DOWN);
        data.put("repeat", event.getRepeatCount() > 0);
        pad.notifyListeners("button", data);
        return true;
    }

    private static float axis(MotionEvent e, InputDevice d, int axis) {
        InputDevice.MotionRange range = d == null ? null : d.getMotionRange(axis, e.getSource());
        if (range == null) return 0f;
        float v = e.getAxisValue(axis), flat = Math.max(range.getFlat(), 0.08f);
        return Math.abs(v) > flat ? v : 0f;
    }

    // Sticks, triggers and the d-pad hat (handhelds often report the d-pad as a hat, not keys).
    static boolean motion(MotionEvent event) {
        CardStashyGamepad pad = active;
        if (pad == null || !pad.listening || !pad.hasListeners("axes")) return false;
        if ((event.getSource() & InputDevice.SOURCE_JOYSTICK) != InputDevice.SOURCE_JOYSTICK || event.getAction() != MotionEvent.ACTION_MOVE) return false;
        InputDevice d = event.getDevice();
        if (!isPad(d)) return false;
        float lt = Math.max(axis(event, d, MotionEvent.AXIS_LTRIGGER), axis(event, d, MotionEvent.AXIS_BRAKE));
        float rt = Math.max(axis(event, d, MotionEvent.AXIS_RTRIGGER), axis(event, d, MotionEvent.AXIS_GAS));
        float[] now = { axis(event, d, MotionEvent.AXIS_X), axis(event, d, MotionEvent.AXIS_Y), axis(event, d, MotionEvent.AXIS_Z), axis(event, d, MotionEvent.AXIS_RZ), lt, rt,
            axis(event, d, MotionEvent.AXIS_HAT_X), axis(event, d, MotionEvent.AXIS_HAT_Y) };
        boolean changed = false;
        for (int i = 0; i < now.length; i++) if (Math.abs(now[i] - pad.sent[i]) > 0.02f || (now[i] == 0f) != (pad.sent[i] == 0f)) { changed = true; break; }
        if (!changed) return true;
        System.arraycopy(now, 0, pad.sent, 0, now.length);
        JSObject data = new JSObject();
        // Boxed, so JSObject's own put(String, Object) is used (no checked JSONException).
        String[] keys = { "lx", "ly", "rx", "ry", "lt", "rt", "hx", "hy" };
        for (int i = 0; i < keys.length; i++) data.put(keys[i], (Object) Double.valueOf(Math.round(now[i] * 1000) / 1000.0));
        pad.notifyListeners("axes", data);
        return true;
    }
}
