package dev.cardstashy.integration;

import android.os.Bundle;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean backPending = false;

    // The launch splash stays until the app's first screen is drawn, so there is no blank flash.
    // It never stays longer than this, even if the page fails to say it is ready.
    private static final long SPLASH_MAX_MS = 5000;

    @Override public void onCreate(Bundle savedInstanceState) {
        long started = SystemClock.uptimeMillis();
        SplashScreen.installSplashScreen(this).setKeepOnScreenCondition(() -> !CardStashyDisplay.ready && SystemClock.uptimeMillis() - started < SPLASH_MAX_MS);
        registerPlugin(CardStashyPlatform.class);
        registerPlugin(CardStashyArtwork.class);
        registerPlugin(CardStashyAuth.class);
        registerPlugin(CardStashyHaptics.class);
        registerPlugin(CardStashyDisplay.class);
        registerPlugin(CardStashyGamepad.class);
        // Builds that include the Forge engine (forge-engine/build-engine.sh) play CPU matches on the phone.
        try { registerPlugin(Class.forName("dev.cardstashy.integration.CardStashyForge").asSubclass(com.getcapacitor.Plugin.class)); }
        catch (ClassNotFoundException regularBuild) { /* matches run on the Forge server */ }
        super.onCreate(savedInstanceState);
        // Card art at the app's own /img/ paths, cached on the phone like the website's service worker.
        bridge.setWebViewClient(new CardStashyWebViewClient(bridge));
        // System Back (gesture or button) asks the app first: it closes the topmost layer or returns one screen.
        // Only when the app has nothing left to return to does Back fall through to Android's own behaviour.
        // A cancelled predictive gesture never reaches this callback, so it changes nothing.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                WebView web = bridge == null ? null : bridge.getWebView();
                if (web == null || backPending) { if (web == null) systemBack(this); return; }
                backPending = true;
                web.evaluateJavascript("(function(){try{return !!(globalThis.cardstashyBack&&globalThis.cardstashyBack());}catch(e){return false;}})()", result -> {
                    backPending = false;
                    if (!"true".equals(result)) systemBack(this);
                });
            }
        });
    }

    // Controller buttons and sticks go to the page's controller layer while it listens (CardStashyGamepad);
    // touch, the system Back gesture and every other key take their usual path.
    @Override public boolean dispatchKeyEvent(KeyEvent event) {
        return CardStashyGamepad.key(event) || super.dispatchKeyEvent(event);
    }

    @Override public boolean dispatchGenericMotionEvent(MotionEvent event) {
        return CardStashyGamepad.motion(event) || super.dispatchGenericMotionEvent(event);
    }

    private void systemBack(OnBackPressedCallback callback) {
        callback.setEnabled(false);
        getOnBackPressedDispatcher().onBackPressed();
        callback.setEnabled(true);
    }
}
