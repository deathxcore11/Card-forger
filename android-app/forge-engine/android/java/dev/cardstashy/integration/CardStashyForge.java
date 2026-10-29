package dev.cardstashy.integration;

import cardstashy.forge.LocalEngine;
import cardstashy.forge.http.HttpServer;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.util.UUID;
import java.util.concurrent.*;
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
        if (done.isFile()) { unpackMs = 0; return root; }
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
        return root;
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
        r.put("sinceLoadStartMs", loadStartedAt == 0 ? -1 : System.currentTimeMillis() - loadStartedAt);
        r.put("heapMb", (Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory()) >> 20);
        r.put("maxHeapMb", Runtime.getRuntime().maxMemory() >> 20);
        return r;
    }

    // The card database starts loading as the app opens, so it is ready before Play is.
    @Override public void load() { beginLoading(); }

    @PluginMethod public void prepare(PluginCall call) { beginLoading(); call.resolve(state()); }
    @PluginMethod public void status(PluginCall call) { call.resolve(state()); }

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
