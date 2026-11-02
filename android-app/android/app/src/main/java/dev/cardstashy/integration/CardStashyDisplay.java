package dev.cardstashy.integration;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Point;
import android.hardware.Sensor;
import android.hardware.SensorManager;
import android.os.Build;
import android.view.Display;
import android.view.Surface;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// How the screen behaves for what is on it. "play" (a Forge match or Planeswalk) hides the status and
// navigation bars until a swipe from the edge and keeps the screen awake. "app" (everything else) shows
// the bars again. setOrientation turns the phone sideways for a game: "landscape" holds either sideways
// way round (the phone's sensor picks which), "default" follows the phone's rotation again.
// In "play" the screen also runs at its highest refresh rate (120 Hz where the phone has it) so dragged
// cards track the finger; "app" hands the rate back to the system to save battery.
// The mode is re-applied on resume, since Android may restore the bars while the app is away.
// ready() tells MainActivity the first screen is drawn, so the launch splash can go.
@CapacitorPlugin(name = "CardStashyDisplay")
public class CardStashyDisplay extends Plugin {
    private String mode = "app";
    private String orientation = "default";
    static volatile boolean ready = false;

    @PluginMethod public void ready(PluginCall call) { ready = true; call.resolve(); }

    // The app's own orientation is right from the first frame, before the page asks for anything.
    @Override public void load() { getActivity().runOnUiThread(this::apply); }

    // What kind of screen this is right now: { foldable, folded, large, handheld }.
    @PluginMethod public void getScreen(PluginCall call) { call.resolve(screen(getActivity())); }

    @Override protected void handleOnConfigurationChanged(Configuration newConfig) {
        super.handleOnConfigurationChanged(newConfig);
        Activity activity = getActivity();
        if (activity == null) return;
        apply();
        notifyListeners("screen", screen(activity));
    }

    @PluginMethod public void setMode(PluginCall call) {
        String next = call.getString("mode", "app");
        if (!"play".equals(next) && !"app".equals(next)) { call.reject("Unknown display mode", "INVALID_MODE"); return; }
        mode = next;
        getActivity().runOnUiThread(() -> { apply(); call.resolve(); });
    }

    @PluginMethod public void setOrientation(PluginCall call) {
        String next = call.getString("orientation", "default");
        if (!"landscape".equals(next) && !"default".equals(next)) { call.reject("Unknown orientation", "INVALID_ORIENTATION"); return; }
        orientation = next;
        getActivity().runOnUiThread(() -> { apply(); call.resolve(); });
    }

    @Override protected void handleOnResume() { getActivity().runOnUiThread(this::apply); }

    private void apply() {
        Activity activity = getActivity();
        if (activity == null) return;
        boolean play = "play".equals(mode);
        int requested = "landscape".equals(orientation) || wideScreen(activity) ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE : ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT;
        if (activity.getRequestedOrientation() != requested) activity.setRequestedOrientation(requested);
        Window window = activity.getWindow();
        if (play) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(window, window.getDecorView());
        if (play) {
            bars.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            bars.hide(WindowInsetsCompat.Type.systemBars());
        } else bars.show(WindowInsetsCompat.Type.systemBars());
        WindowManager.LayoutParams lp = window.getAttributes();
        int modeId = play ? fastestMode(activity) : 0;
        if (lp.preferredDisplayModeId != modeId) { lp.preferredDisplayModeId = modeId; window.setAttributes(lp); }
    }

    // A big screen: an unfolded foldable or a tablet (600dp and up on its shorter side, whichever way it is held).
    static boolean large(Activity activity) { return activity.getResources().getConfiguration().smallestScreenWidthDp >= 600; }

    // A screen that is wide when the device sits in its natural position: handhelds, never phones.
    @SuppressWarnings("deprecation")
    static boolean handheld(Activity activity) {
        Display display = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R ? activity.getDisplay() : activity.getWindowManager().getDefaultDisplay();
        if (display == null) return false;
        Point size = new Point();
        display.getRealSize(size);
        int rotation = display.getRotation();
        boolean turned = rotation == Surface.ROTATION_90 || rotation == Surface.ROTATION_270;
        int naturalWidth = turned ? size.y : size.x, naturalHeight = turned ? size.x : size.y;
        return naturalWidth > naturalHeight;
    }

    static boolean wideScreen(Activity activity) { return large(activity) || handheld(activity); }

    // A foldable reports a hinge sensor; folded, its outer screen is phone-sized.
    static boolean foldable(Activity activity) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return false;
        if (activity.getPackageManager().hasSystemFeature(PackageManager.FEATURE_SENSOR_HINGE_ANGLE)) return true;
        SensorManager sensors = (SensorManager) activity.getSystemService(android.content.Context.SENSOR_SERVICE);
        return sensors != null && sensors.getDefaultSensor(Sensor.TYPE_HINGE_ANGLE) != null;
    }

    static JSObject screen(Activity activity) {
        JSObject out = new JSObject();
        boolean fold = activity != null && foldable(activity), big = activity != null && large(activity);
        out.put("foldable", fold);
        out.put("folded", fold && !big);
        out.put("large", big);
        out.put("handheld", activity != null && handheld(activity));
        return out;
    }

    // The highest refresh rate at the current resolution (never a resolution switch), or 0 for the system default.
    @SuppressWarnings("deprecation")
    private static int fastestMode(Activity activity) {
        Display display = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R ? activity.getDisplay() : activity.getWindowManager().getDefaultDisplay();
        if (display == null) return 0;
        Display.Mode now = display.getMode(), best = now;
        for (Display.Mode m : display.getSupportedModes())
            if (m.getPhysicalWidth() == now.getPhysicalWidth() && m.getPhysicalHeight() == now.getPhysicalHeight() && m.getRefreshRate() > best.getRefreshRate()) best = m;
        return best.getModeId();
    }
}
