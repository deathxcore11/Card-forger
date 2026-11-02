package dev.cardstashy.integration;

import android.app.Activity;
import android.content.*;
import android.content.res.Configuration;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.io.*;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;

@CapacitorPlugin(name = "CardStashyPlatform")
public class CardStashyPlatform extends Plugin implements ComponentCallbacks2 {
    private DocumentStore exports, imports;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private boolean pickerBusy = false;
    @Override public void load() {
        try { exports = new DocumentStore(new File(getContext().getFilesDir(), "document-staging")); imports = new DocumentStore(new File(getContext().getFilesDir(), "document-imports")); }
        catch (IOException e) { Logger.error("Document storage unavailable", e); }
        getContext().registerComponentCallbacks(this);
    }
    private void work(PluginCall call, Task task) {
        io.execute(() -> { try { if (exports == null || imports == null) throw new IOException("Private document storage unavailable"); task.run(); } catch (Exception e) { call.reject(e.getMessage() == null ? "Document operation failed" : e.getMessage(), "DOCUMENT_IO", e); } });
    }
    private interface Task { void run() throws Exception; }
    private JSObject result(String status) { return new JSObject().put("status", status); }
    @PluginMethod public void capabilities(PluginCall call) { call.resolve(new JSObject().put("platform", "android").put("documents", true).put("photoPicker", true).put("lifecycle", true).put("networkIntegrated", true)); }
    @PluginMethod public void beginSave(PluginCall call) { work(call, () -> call.resolve(new JSObject().put("handle", exports.create()))); }
    @PluginMethod public void appendSaveChunk(PluginCall call) {
        work(call, () -> {
            String encoded = call.getString("data", "");
            if (encoded.length() > 90000) throw new IOException("Document chunk too large");
            byte[] bytes = Base64.decode(encoded, Base64.NO_WRAP);
            long length = exports.append(call.getString("handle"), call.getData().optLong("offset", -1L), bytes);
            call.resolve(new JSObject().put("bytes", length));
        });
    }
    @PluginMethod public void discardSave(PluginCall call) { work(call, () -> { exports.discard(call.getString("handle")); call.resolve(); }); }
    @PluginMethod public void saveDocument(PluginCall call) {
        work(call, () -> {
            exports.seal(call.getString("handle"), call.getData().optLong("bytes", -1L));
            getActivity().runOnUiThread(() -> {
                if (pickerBusy) { call.reject("Another file picker is open", "PICKER_BUSY"); return; }
                pickerBusy = true;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(DocumentStore.safeMime(call.getString("mime")));
                intent.putExtra(Intent.EXTRA_TITLE, DocumentStore.safeName(call.getString("name")));
                try { startActivityForResult(call, intent, "documentCreated"); }
                catch (Exception e) { pickerBusy = false; call.reject("No document provider could save this file", "PICKER_UNAVAILABLE", e); }
            });
        });
    }
    @ActivityCallback private void documentCreated(PluginCall call, ActivityResult activityResult) {
        pickerBusy = false; if (call == null) return;
        if (activityResult.getResultCode() != Activity.RESULT_OK || activityResult.getData() == null) { call.resolve(result("cancelled")); return; }
        Uri uri = activityResult.getData().getData();
        if (uri == null || !"content".equals(uri.getScheme())) { call.reject("Document provider returned an invalid destination", "INVALID_DESTINATION"); return; }
        work(call, () -> {
            long bytes;
            try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (output == null) throw new IOException("Document provider could not open the destination");
                bytes = exports.copyTo(call.getString("handle"), output);
            } // Only a successful close permits status=saved.
            call.resolve(result("saved").put("closed", true).put("bytes", bytes));
        });
    }
    @PluginMethod public void openDocument(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (pickerBusy) { call.reject("Another file picker is open", "PICKER_BUSY"); return; }
            pickerBusy = true;
            boolean image = "image".equals(call.getString("kind"));
            Intent intent;
            if (image && Build.VERSION.SDK_INT >= 33) intent = new Intent(MediaStore.ACTION_PICK_IMAGES).setType("image/*");
            else { intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(image ? "image/*" : "*/*"); }
            try { startActivityForResult(call, intent, "documentPicked"); }
            catch (Exception e) { pickerBusy = false; call.reject("No document provider could open this file", "PICKER_UNAVAILABLE", e); }
        });
    }
    @ActivityCallback private void documentPicked(PluginCall call, ActivityResult activityResult) {
        pickerBusy = false; if (call == null) return;
        if (activityResult.getResultCode() != Activity.RESULT_OK || activityResult.getData() == null) { call.resolve(result("cancelled")); return; }
        Uri uri = activityResult.getData().getData();
        if (uri == null || !"content".equals(uri.getScheme())) { call.reject("Document provider returned an invalid file", "INVALID_SELECTION"); return; }
        work(call, () -> {
            String handle = imports.create(), name = "CardStashy_Import", mime = null; long total = 0;
            try {
                // Provider metadata is optional; a readable stream is sufficient.
                try { mime = getContext().getContentResolver().getType(uri); } catch (RuntimeException ignored) {}
                try (Cursor cursor = getContext().getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) { if (cursor != null && cursor.moveToFirst()) name = DocumentStore.safeName(cursor.getString(0)); }
                catch (RuntimeException ignored) {}
                try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
                    if (input == null) throw new IOException("Selected file is unreadable");
                    byte[] buffer = new byte[DocumentStore.CHUNK_BYTES]; int count;
                    while ((count = input.read(buffer)) != -1) { if (count == 0) continue; byte[] chunk = count == buffer.length ? buffer : java.util.Arrays.copyOf(buffer, count); total = imports.append(handle, total, chunk); }
                }
                imports.seal(handle, total);
                call.resolve(result("selected").put("handle", handle).put("name", name).put("mime", mime == null ? "application/octet-stream" : mime).put("bytes", total));
            } catch (Exception error) { try { imports.discard(handle); } catch (IOException ignored) {} throw error; }
        });
    }
    @PluginMethod public void readDocumentChunk(PluginCall call) { work(call, () -> { long offset = call.getData().optLong("offset", -1L); byte[] bytes = imports.read(call.getString("handle"), offset); call.resolve(new JSObject().put("data", Base64.encodeToString(bytes, Base64.NO_WRAP)).put("offset", offset).put("bytes", bytes.length).put("totalBytes", imports.length(call.getString("handle")))); }); }
    @PluginMethod public void releaseDocument(PluginCall call) { work(call, () -> { imports.discard(call.getString("handle")); call.resolve(); }); }
    private void lifecycle(String state) { notifyListeners("lifecycle", new JSObject().put("state", state), true); }
    @Override protected void handleOnPause() { lifecycle("background"); }
    @Override protected void handleOnResume() { lifecycle("foreground"); }
    @Override public void onTrimMemory(int level) { if (level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW) lifecycle("memory-pressure"); }
    @Override public void onLowMemory() { lifecycle("memory-pressure"); }
    @Override public void onConfigurationChanged(Configuration configuration) {}
    @Override protected void handleOnDestroy() { getContext().unregisterComponentCallbacks(this); io.shutdown(); }
}
