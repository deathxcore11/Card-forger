package dev.cardstashy.integration;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;

/** No native HTTP, token storage, remote reload or URL logging. App Links remain gated. */
@CapacitorPlugin(name = "CardStashyAuth")
public class CardStashyAuth extends Plugin {
    private static final boolean NETWORK_REVIEWED = true;
    private static final String CALLBACK = "https://cardstashy.com/auth/android/callback";
    private String launchCallback;
    private boolean callbackReady = false;
    private boolean isCallback(Uri u) {
        return u != null && "https".equals(u.getScheme()) && "cardstashy.com".equals(u.getHost())
            && u.getPort() == -1 && u.getUserInfo() == null && u.getFragment() == null
            && "/auth/android/callback".equals(u.getEncodedPath()) && u.toString().startsWith(CALLBACK + "?")
            && u.toString().length() <= 8192;
    }
    @Override public void load() { capture(getActivity().getIntent()); }
    private void capture(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return;
        Uri u = intent.getData();
        if (!isCallback(u)) return;
        // Clear sensitive query from the retained Activity intent even when integration is disabled.
        intent.setData(null);
        if (!NETWORK_REVIEWED) return;
        if (callbackReady) notifyListeners("authCallback", new JSObject().put("url", u.toString()));
        else launchCallback = u.toString();
    }
    @Override protected void handleOnNewIntent(Intent intent) { capture(intent); }
    @PluginMethod public void takeLaunchCallback(PluginCall call) {
        callbackReady = true;
        JSObject result = new JSObject();
        if (launchCallback != null) result.put("url", launchCallback);
        launchCallback = null;
        call.resolve(result);
    }
    @PluginMethod public void openAuth(PluginCall call) {
        if (!NETWORK_REVIEWED) { call.reject("Native account release verification is pending"); return; }
        try {
            Uri u = Uri.parse(call.getString("url", ""));
            if (!"https".equals(u.getScheme()) || !"noxfmbwuytnbvfgukpiv.supabase.co".equals(u.getHost())
                || u.getPort() != -1 || u.getUserInfo() != null || u.getFragment() != null
                || !"/auth/v1/authorize".equals(u.getEncodedPath()) || !CALLBACK.equals(u.getQueryParameter("redirect_to"))
                || !"s256".equals(u.getQueryParameter("code_challenge_method"))) { call.reject("Invalid sign-in destination"); return; }
            openSystemBrowser(u); call.resolve();
        } catch (Exception ignored) { call.reject("System browser unavailable"); }
    }
    private boolean unsafeExternalText(String value) {
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c == 92 || c <= 31 || c == 127 || c == 65533) return true;
        }
        return false;
    }
    private boolean safeExternalParameters(String raw) {
        if (raw == null) return true;
        try {
            String decoded = java.net.URLDecoder.decode(raw, "UTF-8");
            if (unsafeExternalText(decoded)) return false;
            for (String field : decoded.split("[&?;#]", -1)) {
                String key = field.split("=", 2)[0].trim();
                for (int depth = 0; key.contains("%") && depth < 4; depth++) {
                    key = java.net.URLDecoder.decode(key, "UTF-8").trim();
                }
                if (key.contains("%") || unsafeExternalText(key) || key.matches(".*[&?;#=].*")
                    || key.matches("(?i)^(access_token|refresh_token|id_token|authorization|apikey|api_key|token|code)$")) return false;
            }
            return true;
        } catch (Exception ignored) { return false; }
    }
    private boolean safeExternal(Uri u) {
        return u != null && "https".equals(u.getScheme()) && u.getHost() != null && u.getUserInfo() == null
            && (u.getPort() == -1 || u.getPort() == 443) && !"android-integration.cardstashy.invalid".equals(u.getHost())
            && safeExternalParameters(u.getEncodedQuery()) && safeExternalParameters(u.getEncodedFragment())
            && !isCallback(u) && !u.toString().matches(".*[\\\\\\s\\x00-\\x1F\\x7F].*");
    }
    private void openSystemBrowser(Uri u) {
        // CATEGORY_APP_BROWSER + selector avoids routing verified links back into this app.
        Intent browser = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_APP_BROWSER);
        Intent view = new Intent(Intent.ACTION_VIEW, u).addCategory(Intent.CATEGORY_BROWSABLE);
        view.setSelector(browser);
        getActivity().startActivity(view);
    }
    @PluginMethod public void openExternal(PluginCall call) {
        if (!NETWORK_REVIEWED) { call.reject("Online browsing is awaiting native release verification"); return; }
        try { Uri u = Uri.parse(call.getString("url", "")); if (!safeExternal(u)) { call.reject("Unsafe external destination"); return; } openSystemBrowser(u); call.resolve(); }
        catch (Exception ignored) { call.reject("System browser unavailable"); }
    }
    @Override public Boolean shouldOverrideLoad(Uri u) {
        if (u != null && "https".equals(u.getScheme()) && "android-integration.cardstashy.invalid".equals(u.getHost()) && u.getUserInfo() == null && u.getPort() == -1) return null;
        // Never reload the WebView from a remote URL. UI handlers must request explicit browser opens.
        return true;
    }
}
