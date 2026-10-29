package dev.cardstashy.integration;

import cardstashy.forge.LocalEngine;
import cardstashy.forge.NativeRulesData;
import cardstashy.forge.http.HttpServer;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.zip.GZIPInputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

// The Forge rules engine inside the app. The engine pack (card scripts, rules data and the
// reviewed CPU overlay receipts) unpacks once per app version; the card database then loads
// once per app run and stays loaded, so each match only creates a new game over it.
@CapacitorPlugin(name = "CardStashyForge")
public class CardStashyForge extends Plugin {
    private static final String PACK = "forge-engine/pack.zip", VERSION = "forge-engine/pack.version";
    private static final ExecutorService WORK = Executors.newSingleThreadExecutor(r -> new Thread(null, r, "forge-engine", 16L << 20));
    private static volatile Future<?> loading;
    private static volatile String error;
    private static volatile long unpackMs = -1, loadStartedAt;
    // The rules data is dated (about a week); past it the server plays the match instead. The app
    // fetches each week's bundle from the website (updateRules), so it stays current without a new APK.
    private static volatile String rulesValidUntil, rulesVersion;
    private static final String RULES_URL = "https://cardstashy.com/forge-rules/current/";
    private static final Object RULES_LOCK = new Object();
    private static LocalEngine.Session session;

    private synchronized void beginLoading() {
        if (loading != null && (!loading.isDone() || error == null)) return;
        error = null;
        loadStartedAt = System.currentTimeMillis();
        // Forge keeps its preferences under user.home, which Android leaves empty.
        File home = new File(getContext().getFilesDir(), "forge-home");
        home.mkdirs();
        System.setProperty("user.home", home.getAbsolutePath());
        System.setProperty("java.io.tmpdir", getContext().getCacheDir().getAbsolutePath());
        loading = WORK.submit(() -> {
            try {
                File root = unpack();
                LocalEngine.init(root.getAbsolutePath());
            } catch (Throwable t) {
                error = t.getClass().getSimpleName() + ": " + t.getMessage();
                android.util.Log.e("CardStashyForge", "engine load failed", t);
            }
        });
    }

    private File unpack() throws IOException {
        long t0 = System.currentTimeMillis();
        String version;
        try (InputStream in = getContext().getAssets().open(VERSION)) { version = new String(readAll(in), "UTF-8").trim(); }
        File root = new File(getContext().getFilesDir(), "forge-engine/" + version), done = new File(root, ".unpacked");
        if (done.isFile()) { unpackMs = 0; readRulesDate(root); pickDownloadedRules(); return root; }
        File parent = root.getParentFile();
        File[] old = parent == null ? null : parent.listFiles();
        if (old != null) for (File f : old) if (!f.getName().equals(version)) deleteTree(f);
        deleteTree(root);
        byte[] buffer = new byte[1 << 16];
        try (ZipInputStream zip = new ZipInputStream(new BufferedInputStream(getContext().getAssets().open(PACK), 1 << 16))) {
            for (ZipEntry e; (e = zip.getNextEntry()) != null; ) {
                File out = new File(root, e.getName());
                if (!out.getCanonicalPath().startsWith(root.getCanonicalPath() + File.separator)) throw new IOException("pack_entry_outside_root");
                if (e.isDirectory()) { out.mkdirs(); continue; }
                out.getParentFile().mkdirs();
                try (OutputStream o = new FileOutputStream(out)) { for (int n; (n = zip.read(buffer)) > 0; ) o.write(buffer, 0, n); }
            }
        }
        if (!done.createNewFile() && !done.isFile()) throw new IOException("pack_marker_unwritable");
        unpackMs = System.currentTimeMillis() - t0;
        readRulesDate(root);
        pickDownloadedRules();
        return root;
    }

    private static String field(String json, String key) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\"" + key + "\"\\s*:\\s*\"([^\"]{1,160})\"").matcher(json);
        return m.find() ? m.group(1) : null;
    }

    private static void readRulesDate(File root) {
        try (InputStream in = new FileInputStream(new File(root, "rules-data/current/manifest.json"))) {
            String m = new String(readAll(in), "UTF-8");
            rulesValidUntil = field(m, "validUntilExclusive");
            rulesVersion = field(m, "version");
        } catch (IOException e) { rulesValidUntil = null; }
    }

    private File rulesDir() { return new File(getContext().getFilesDir(), "forge-rules"); }

    // A bundle fetched on an earlier run, if it is newer than the one in the app and still passes
    // the engine's own checks (engine revision, dates, file hashes).
    private void pickDownloadedRules() {
        File[] dirs = rulesDir().listFiles();
        if (dirs == null) return;
        String today = LocalDate.now(ZoneOffset.UTC).toString();
        for (File dir : dirs) {
            if (!dir.isDirectory() || dir.getName().endsWith(".part")) continue;
            try (InputStream in = new FileInputStream(new File(dir, "manifest.json"))) {
                String m = new String(readAll(in), "UTF-8"), until = field(m, "validUntilExclusive");
                if (until == null || today.compareTo(until) >= 0 || rulesValidUntil != null && until.compareTo(rulesValidUntil) <= 0) continue;
                NativeRulesData.load(dir.toPath(), LocalDate.now(ZoneOffset.UTC), "current", null);
                useRules(dir, until, field(m, "version"));
            } catch (Exception skip) { /* the bundled rules stay in use */ }
        }
    }

    // Matches started from now on read this bundle; Forge's cached copy is dropped.
    private static void useRules(File dir, String until, String version) throws ReflectiveOperationException {
        synchronized (NativeRulesData.class) {
            System.setProperty("proof.rulesData", dir.getAbsolutePath());
            java.lang.reflect.Field cached = NativeRulesData.class.getDeclaredField("cached");
            cached.setAccessible(true);
            cached.set(null, null);
        }
        rulesValidUntil = until;
        rulesVersion = version;
    }

    private static byte[] fetch(String url, int limit) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setRequestProperty("Accept-Encoding", "gzip");
        try {
            if (c.getResponseCode() != 200) throw new IOException("http_" + c.getResponseCode());
            InputStream raw = new BufferedInputStream(c.getInputStream(), 1 << 16);
            try (InputStream in = "gzip".equalsIgnoreCase(c.getContentEncoding()) ? new GZIPInputStream(raw) : raw) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] b = new byte[1 << 16];
                for (int n; (n = in.read(b)) > 0; ) { out.write(b, 0, n); if (out.size() > limit) throw new IOException("too_large"); }
                return out.toByteArray();
            }
        } finally { c.disconnect(); }
    }

    private JSObject downloadRules() throws Exception {
        synchronized (RULES_LOCK) {
            JSObject r = new JSObject();
            String manifest = new String(fetch(RULES_URL + "manifest.json", 65536), "UTF-8");
            String version = field(manifest, "version"), until = field(manifest, "validUntilExclusive");
            if (version == null || until == null || !version.matches("[A-Za-z0-9._-]{1,120}")) throw new IOException("manifest_invalid");
            if (version.equals(rulesVersion) || rulesValidUntil != null && until.compareTo(rulesValidUntil) <= 0) {
                r.put("updated", false); r.put("rulesValidUntil", rulesValidUntil); return r;
            }
            File base = rulesDir(), part = new File(base, version + ".part"), dir = new File(base, version);
            deleteTree(part);
            if (!part.mkdirs()) throw new IOException("rules_dir_unwritable");
            write(new File(part, "manifest.json"), manifest.getBytes("UTF-8"));
            write(new File(part, "cards.json"), fetch(RULES_URL + "cards.json", 16 << 20));
            write(new File(part, "official-format-facts.json"), fetch(RULES_URL + "official-format-facts.json", 65536));
            // The engine's own checks: same engine revision, dates in policy, every file's hash.
            NativeRulesData.load(part.toPath(), LocalDate.now(ZoneOffset.UTC), "current", null);
            deleteTree(dir);
            if (!part.renameTo(dir)) throw new IOException("rules_dir_unwritable");
            useRules(dir, until, version);
            File[] old = base.listFiles();
            if (old != null) for (File f : old) if (!f.getName().equals(version)) deleteTree(f);
            r.put("updated", true); r.put("rulesValidUntil", until); r.put("rulesVersion", version);
            return r;
        }
    }

    private static void write(File f, byte[] data) throws IOException {
        try (OutputStream o = new FileOutputStream(f)) { o.write(data); }
    }

    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] b = new byte[8192];
        for (int n; (n = in.read(b)) > 0; ) out.write(b, 0, n);
        return out.toByteArray();
    }

    private static void deleteTree(File f) {
        File[] children = f.listFiles();
        if (children != null) for (File c : children) deleteTree(c);
        f.delete();
    }

    private JSObject state() {
        JSObject r = new JSObject();
        r.put("ready", LocalEngine.ready());
        r.put("loading", loading != null && !loading.isDone());
        r.put("error", error);
        r.put("unpackMs", unpackMs);
        r.put("loadMs", LocalEngine.initMs());
        r.put("rulesValidUntil", rulesValidUntil);
        r.put("rulesVersion", rulesVersion);
        r.put("sinceLoadStartMs", loadStartedAt == 0 ? -1 : System.currentTimeMillis() - loadStartedAt);
        r.put("heapMb", (Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory()) >> 20);
        r.put("maxHeapMb", Runtime.getRuntime().maxMemory() >> 20);
        return r;
    }

    // The card database starts loading as the app opens, so it is ready before Play is.
    @Override public void load() { beginLoading(); }

    @PluginMethod public void prepare(PluginCall call) { beginLoading(); call.resolve(state()); }
    @PluginMethod public void status(PluginCall call) { call.resolve(state()); }

    // Fetch this week's rules bundle from the website when it is newer than the one in use.
    @PluginMethod public void updateRules(PluginCall call) {
        new Thread(() -> {
            try { call.resolve(downloadRules()); }
            catch (Throwable t) { call.reject("rules_update_failed: " + t.getClass().getSimpleName() + ": " + t.getMessage()); }
        }, "forge-rules-update").start();
    }

    // Waits for the card database if it is still loading, then starts the match.
    @PluginMethod public void start(PluginCall call) {
        String input = call.getString("input");
        if (input == null || input.length() > 262144) { call.reject("input_required"); return; }
        beginLoading();
        Future<?> load = loading;
        new Thread(() -> {
            try {
                long t0 = System.currentTimeMillis();
                load.get();
                if (error != null) { call.reject("engine_unavailable: " + error); return; }
                long waited = System.currentTimeMillis() - t0;
                synchronized (CardStashyForge.class) {
                    if (session != null) session.close();
                    session = LocalEngine.start(input, new java.security.SecureRandom().nextLong() & Long.MAX_VALUE);
                }
                JSObject r = state();
                r.put("matchId", UUID.randomUUID().toString());
                r.put("waitedForLoadMs", waited);
                r.put("startMs", System.currentTimeMillis() - t0 - waited);
                call.resolve(r);
            } catch (Throwable t) {
                call.reject("engine_start_failed: " + t.getClass().getSimpleName() + ": " + t.getMessage());
            }
        }, "forge-match-start").start();
    }

    @PluginMethod public void request(PluginCall call) {
        LocalEngine.Session s;
        synchronized (CardStashyForge.class) { s = session; }
        if (s == null) { call.reject("no_match"); return; }
        try {
            HttpServer.Reply reply = s.call(call.getString("method", "GET"), call.getString("path", "/state"), call.getString("body"));
            JSObject r = new JSObject();
            r.put("status", reply.status());
            r.put("body", reply.body());
            call.resolve(r);
        } catch (Throwable t) {
            call.reject("engine_call_failed: " + t.getClass().getSimpleName());
        }
    }

    @PluginMethod public void close(PluginCall call) {
        synchronized (CardStashyForge.class) { if (session != null) session.close(); session = null; }
        call.resolve();
    }
}
