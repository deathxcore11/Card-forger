package dev.cardstashy.integration;

import android.app.Activity;
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
// the bars again. Both follow the phone's rotation: Play and Planeswalk have upright and sideways layouts.
// The mode is re-applied on resume, since Android may restore the bars while the app is away.
@CapacitorPlugin(name = "CardStashyDisplay")
public class CardStashyDisplay extends Plugin {
    private String mode = "app";

    @PluginMethod public void setMode(PluginCall call) {
        String next = call.getString("mode", "app");
        if (!"play".equals(next) && !"app".equals(next)) { call.reject("Unknown display mode", "INVALID_MODE"); return; }
        mode = next;
        getActivity().runOnUiThread(() -> { apply(); call.resolve(); });
    }

    @Override protected void handleOnResume() { getActivity().runOnUiThread(this::apply); }

    private void apply() {
        Activity activity = getActivity();
        if (activity == null) return;
        boolean play = "play".equals(mode);
        Window window = activity.getWindow();
        if (play) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(window, window.getDecorView());
        if (play) {
            bars.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            bars.hide(WindowInsetsCompat.Type.systemBars());
        } else bars.show(WindowInsetsCompat.Type.systemBars());
    }
}
