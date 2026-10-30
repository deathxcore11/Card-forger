package dev.cardstashy.integration;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.os.Build;
import android.view.Display;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
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
        int requested = "landscape".equals(orientation) ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE : ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;
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
