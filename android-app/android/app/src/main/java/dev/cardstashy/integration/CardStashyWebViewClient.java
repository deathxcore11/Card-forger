package dev.cardstashy.integration;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

/** Serves the website's card-art routes at the app's own origin, and keeps Scryfall card art, from {@link ImageCache}. */
public class CardStashyWebViewClient extends BridgeWebViewClient {
    static final String APP_HOST = "android-integration.cardstashy.invalid";
    private static final int MAX_BYTES = 8 * 1024 * 1024;
    private final ImageCache images, scryfall;

    public CardStashyWebViewClient(Bridge bridge) {
        super(bridge);
        images = new ImageCache(new java.io.File(bridge.getContext().getCacheDir(), "card-art"), CardStashyWebViewClient::download, Thread::sleep, 3000);
        // Scryfall art the app has shown or saved for a deck, kept so decks still look right offline.
        scryfall = new ImageCache(new java.io.File(bridge.getContext().getCacheDir(), "scryfall-art"), CardStashyWebViewClient::download, Thread::sleep, 6000, ImageCache.SCRYFALL, ImageCache.SCRYFALL_ROUTES);
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri u = request.getUrl();
        if ("GET".equals(request.getMethod()) && "https".equals(u.getScheme()) && APP_HOST.equals(u.getHost()) && u.getPort() == -1
            && u.getPath() != null && u.getPath().startsWith("/img/")) {
            ImageCache.Response r = images.get(u.getPath(), u.getEncodedPath(), u.getEncodedQuery());
            Map<String, String> headers = new HashMap<>();
            // A missing picture is never remembered; the page tries its next source (as on the web).
            headers.put("Cache-Control", r == null ? "no-store" : "private, max-age=604800");
            if (r == null) return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", headers, new ByteArrayInputStream(new byte[0]));
            return new WebResourceResponse(r.type, null, 200, "OK", headers, new ByteArrayInputStream(r.body));
        }
        if ("GET".equals(request.getMethod()) && "https".equals(u.getScheme()) && "cards.scryfall.io".equals(u.getHost()) && u.getPort() == -1
            && ImageCache.allowed(ImageCache.SCRYFALL_ROUTES, u.getPath(), u.getEncodedQuery())) {
            ImageCache.Response r = scryfall.get(u.getPath(), u.getEncodedPath(), u.getEncodedQuery());
            // Unavailable here: let the WebView try the network itself, exactly as before.
            if (r == null) return super.shouldInterceptRequest(view, request);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "public, max-age=2592000");
            headers.put("Access-Control-Allow-Origin", "*");
            return new WebResourceResponse(r.type, null, 200, "OK", headers, new ByteArrayInputStream(r.body));
        }
        return super.shouldInterceptRequest(view, request);
    }

    // Plain GET to a fixed picture origin: no cookies, credentials or app session are sent.
    static ImageCache.Response download(String url) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        try {
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(10000); c.setReadTimeout(20000);
            c.setRequestProperty("Accept", "image/avif,image/webp,image/*");
            int status = c.getResponseCode();
            if (status != 200) return new ImageCache.Response(status, null, null);
            String type = c.getContentType();
            if (type != null && type.contains(";")) type = type.substring(0, type.indexOf(';')).trim();
            try (InputStream in = c.getInputStream()) {
                ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] buf = new byte[16384]; int n;
                while ((n = in.read(buf)) > 0) { out.write(buf, 0, n); if (out.size() > MAX_BYTES) throw new IOException("Picture too large"); }
                return new ImageCache.Response(200, type, out.toByteArray());
            }
        } finally { c.disconnect(); }
    }
}
