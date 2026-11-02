package dev.cardstashy.integration;

import android.util.Base64;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** No network, no gallery access, and no record/capture deletion capability. */
@CapacitorPlugin(name = "CardStashyArtwork")
public class CardStashyArtwork extends Plugin {
    private ArtworkStore store;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    @Override public void load() {
        try { store = new ArtworkStore(getContext().getFilesDir()); }
        catch (IOException e) { Logger.error("Artwork storage unavailable", e); }
    }
    private interface Task { void run() throws Exception; }
    private void work(PluginCall call, Task task) {
        io.execute(() -> { try { if (store == null) throw new IOException("Artwork storage unavailable"); task.run(); }
            catch (Exception e) { call.reject(e.getMessage(), "ARTWORK_IO", e); } });
    }
    @PluginMethod public void stats(PluginCall call) { work(call, () -> call.resolve(new JSObject()
        .put("evictableBytes", store.bytes("evictable")).put("pinnedBytes", store.bytes("pinned"))
        .put("pendingBytes", store.bytes("pending")).put("availableBytes", store.availableBytes())
        .put("location", "app-private-phone-storage").put("survivesUninstall", false))); }
    @PluginMethod public void begin(PluginCall call) { work(call, () -> call.resolve(new JSObject().put("handle", store.begin(call.getString("namespace"), call.getString("sha256"), call.getData().optLong("bytes", -1L))))); }
    @PluginMethod public void append(PluginCall call) { work(call, () -> {
        String data = call.getString("data", ""); if (data.length() > 90000) throw new IOException("Artwork chunk too large");
        call.resolve(new JSObject().put("bytes", store.append(call.getString("handle"), call.getData().optLong("offset", -1L), Base64.decode(data, Base64.NO_WRAP))));
    }); }
    @PluginMethod public void commit(PluginCall call) { work(call, () -> call.resolve(new JSObject().put("bytes", store.commit(call.getString("handle"))).put("status", "stored"))); }
    @PluginMethod public void abort(PluginCall call) { work(call, () -> { store.abort(call.getString("handle")); call.resolve(); }); }
    @PluginMethod public void stat(PluginCall call) { work(call, () -> { long bytes = store.length(call.getString("namespace"), call.getString("sha256")); call.resolve(new JSObject().put("exists", bytes >= 0).put("bytes", Math.max(0, bytes))); }); }
    @PluginMethod public void read(PluginCall call) { work(call, () -> {
        String ns = call.getString("namespace"), hash = call.getString("sha256"); long offset = call.getData().optLong("offset", -1L);
        byte[] bytes = store.read(ns, hash, offset);
        call.resolve(new JSObject().put("offset", offset).put("bytes", bytes.length).put("totalBytes", store.length(ns, hash)).put("data", Base64.encodeToString(bytes, Base64.NO_WRAP)));
    }); }
    @PluginMethod public void remove(PluginCall call) { work(call, () -> call.resolve(new JSObject().put("removedBytes", store.remove(call.getString("namespace"), call.getString("sha256"))))); }
    @PluginMethod public void clear(PluginCall call) { work(call, () -> {
        String namespace = call.getString("namespace");
        if ("pinned".equals(namespace) && !Boolean.TRUE.equals(call.getBoolean("confirmPinned"))) throw new IOException("Explicit pinned artwork removal confirmation required");
        call.resolve(new JSObject().put("removedBytes", store.clear(namespace)));
    }); }
    @Override protected void handleOnDestroy() { io.shutdown(); super.handleOnDestroy(); }
}
