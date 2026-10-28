package dev.cardstashy.integration;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Comparator;
import java.util.concurrent.Semaphore;
import java.util.regex.Pattern;

/**
 * Card art served at the app's own /img/ paths, as the website serves them at cardstashy.com/img/.
 * Each picture is fetched once from https://cardstashy.com and kept on the phone (the website keeps
 * its copies in a service-worker cache), so the gallery never re-downloads art on every launch and
 * same-origin pixels stay readable for foils without CORS. Only the website's own image routes are
 * served; this is not a general proxy.
 */
final class ImageCache {
    static final String ORIGIN = "https://cardstashy.com";
    // Mirrors imagePath() in runtime/native-service-policy.js (decoded path).
    static final Pattern[] ROUTES = {
        Pattern.compile("^/img/(?:pack|back)/(?:mtg|ptcg|ygo)\\.jpg$"),
        Pattern.compile("^/img/mtg-set/[a-zA-Z0-9]{2,8}\\.jpg$"),
        Pattern.compile("^/img/ygo/(?:s/|a/)?\\d{1,12}\\.jpg$"),
        Pattern.compile("^/img/pks/(?:s|r)/[a-z0-9_-]{1,80}\\.png$"),
        Pattern.compile("^/img/ptcg/(?:s|l)/[A-Za-z0-9.!?_-]{1,80}\\.jpg$"),
    };
    // Scryfall's card picture sizes, so a saved deck's art still shows with no connection.
    static final String SCRYFALL = "https://cards.scryfall.io";
    static final Pattern[] SCRYFALL_ROUTES = {
        Pattern.compile("^/(?:normal|large|small|art_crop|border_crop|png)/(?:front|back)/[0-9a-f]/[0-9a-f]/[0-9a-f-]{36}\\.(?:jpg|png)$"),
    };
    private static final Pattern QUERY = Pattern.compile("^[A-Za-z0-9=&._%-]{0,200}$");
    private static final Pattern TYPE = Pattern.compile("^image/(?:jpeg|png|webp|gif|avif)$");

    static final class Response {
        final int status; final String type; final byte[] body;
        Response(int status, String type, byte[] body) { this.status = status; this.type = type; this.body = body; }
    }
    interface Fetcher { Response get(String url) throws IOException; }
    interface Sleeper { void sleep(long ms) throws InterruptedException; }

    private final File dir; private final Fetcher fetcher; private final Sleeper sleeper; private final int maxFiles;
    private final String origin; private final Pattern[] routes;
    // A gallery asks for dozens of pictures at once; a few at a time keeps the server from refusing them.
    private final Semaphore upstream = new Semaphore(4, true);

    ImageCache(File dir, Fetcher fetcher, Sleeper sleeper, int maxFiles) { this(dir, fetcher, sleeper, maxFiles, ORIGIN, ROUTES); }

    ImageCache(File dir, Fetcher fetcher, Sleeper sleeper, int maxFiles, String origin, Pattern[] routes) {
        this.dir = dir; this.fetcher = fetcher; this.sleeper = sleeper; this.maxFiles = maxFiles;
        this.origin = origin; this.routes = routes;
    }

    static boolean allowed(String decodedPath, String encodedQuery) { return allowed(ROUTES, decodedPath, encodedQuery); }

    static boolean allowed(Pattern[] routes, String decodedPath, String encodedQuery) {
        if (decodedPath == null || (encodedQuery != null && !QUERY.matcher(encodedQuery).matches())) return false;
        for (Pattern route : routes) if (route.matcher(decodedPath).matches()) return true;
        return false;
    }

    /** Cached or freshly fetched picture, or null when it cannot be had (the page then tries its next source). */
    Response get(String decodedPath, String encodedPath, String encodedQuery) {
        if (!allowed(routes, decodedPath, encodedQuery)) return null;
        String url = origin + encodedPath + (encodedQuery == null || encodedQuery.isEmpty() ? "" : "?" + encodedQuery);
        File file = new File(dir, key(url)), type = new File(dir, key(url) + ".type");
        Response hit = read(file, type);
        if (hit != null) return hit;
        try { upstream.acquire(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); return null; }
        try {
            hit = read(file, type); // another request may have fetched it while this one waited
            if (hit != null) return hit;
            for (int attempt = 0; attempt < 4; attempt++) {
                if (attempt > 0) try { sleeper.sleep(400L << (attempt - 1)); } catch (InterruptedException e) { Thread.currentThread().interrupt(); return null; }
                Response r;
                try { r = fetcher.get(url); } catch (IOException e) { continue; }
                if (r.status == 200 && r.body != null && r.body.length > 0 && r.type != null && TYPE.matcher(r.type).matches()) { write(file, type, r); return r; }
                if (r.status != 429 && r.status < 500) return null; // a real "not found" is not retried
            }
            return null;
        } finally { upstream.release(); }
    }

    private Response read(File file, File type) {
        if (!file.isFile() || !type.isFile()) return null;
        try {
            byte[] body = readAll(file), t = readAll(type);
            file.setLastModified(System.currentTimeMillis()); // least recently viewed pictures are trimmed first
            return new Response(200, new String(t, StandardCharsets.UTF_8), body);
        } catch (IOException e) { return null; }
    }

    private synchronized void write(File file, File type, Response r) {
        if (!dir.isDirectory() && !dir.mkdirs()) return;
        File tmp = new File(dir, file.getName() + ".tmp");
        try {
            try (FileOutputStream out = new FileOutputStream(tmp)) { out.write(r.body); }
            try (FileOutputStream out = new FileOutputStream(type)) { out.write(r.type.getBytes(StandardCharsets.UTF_8)); }
            if (!tmp.renameTo(file)) { tmp.delete(); type.delete(); return; }
        } catch (IOException e) { tmp.delete(); type.delete(); return; }
        trim();
    }

    private void trim() {
        File[] pictures = dir.listFiles((d, name) -> !name.endsWith(".type") && !name.endsWith(".tmp"));
        if (pictures == null || pictures.length <= maxFiles) return;
        Arrays.sort(pictures, Comparator.comparingLong(File::lastModified));
        for (int i = 0; i < pictures.length - maxFiles; i++) { pictures[i].delete(); new File(dir, pictures[i].getName() + ".type").delete(); }
    }

    private static byte[] readAll(File f) throws IOException {
        try (InputStream in = new FileInputStream(f)) {
            byte[] out = new byte[(int) f.length()]; int n = 0, r;
            while (n < out.length && (r = in.read(out, n, out.length - n)) > 0) n += r;
            return n == out.length ? out : Arrays.copyOf(out, n);
        }
    }

    static String key(String url) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(url.getBytes(StandardCharsets.UTF_8));
            StringBuilder s = new StringBuilder();
            for (byte b : h) s.append(String.format("%02x", b));
            return s.toString();
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
}
