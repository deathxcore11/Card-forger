package dev.cardstashy.integration;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.net.ssl.HttpsURLConnection;

// In-app updates for the sideloaded beta. The page asks for the release the server publishes; this
// downloads that one APK from cardstashy.com into the app's private cache, checks its size and SHA-256
// against the release record, checks it is this same app (package, newer versionCode, same signing key),
// and hands it to Android's package installer. The person only taps Update on the system prompt.
// Nothing installs without that prompt, and no other address or file can be fetched or opened.
@CapacitorPlugin(name = "CardStashyUpdater")
public class CardStashyUpdater extends Plugin {
    private static final Pattern RELEASE_URL = Pattern.compile("^https://cardstashy\\.com/downloads/cardstashy-android-beta-\\d+\\.\\d+\\.\\d+\\.apk$");
    private static final Pattern UPDATE_FILE = Pattern.compile("^cardstashy-(\\d+)\\.apk(\\.part)?$");
    private static final long MAX_BYTES = 512L * 1024 * 1024;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private volatile boolean busy = false, cancelled = false;

    private File dir() { return new File(getContext().getCacheDir(), "updates"); }
    private File apk(long versionCode) { return new File(dir(), "cardstashy-" + versionCode + ".apk"); }

    private long installedCode() {
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
        } catch (PackageManager.NameNotFoundException e) { return -1; }
    }

    private boolean canInstall() { return Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls(); }

    // An update that was installed (or superseded) leaves its file behind; the next start clears it.
    @Override public void load() {
        io.execute(() -> {
            File[] files = dir().listFiles(); if (files == null) return;
            long installed = installedCode();
            for (File file : files) {
                Matcher m = UPDATE_FILE.matcher(file.getName());
                if (!m.matches() || m.group(2) != null || Long.parseLong(m.group(1)) <= installed) { if (!file.delete()) Logger.debug("Old update file kept: " + file.getName()); }
            }
        });
    }

    @PluginMethod public void info(PluginCall call) {
        PackageInfo info;
        try { info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0); }
        catch (PackageManager.NameNotFoundException e) { call.reject("App version unavailable", "NO_VERSION"); return; }
        call.resolve(new JSObject().put("package", getContext().getPackageName()).put("versionName", info.versionName)
            .put("versionCode", installedCode()).put("canInstall", canInstall()).put("sdk", Build.VERSION.SDK_INT));
    }

    @PluginMethod public void cancel(PluginCall call) { cancelled = true; call.resolve(); }

    @PluginMethod public void download(PluginCall call) {
        String url = call.getString("url", ""), sha256 = call.getString("sha256", "").toLowerCase();
        // PluginCall.getLong only accepts a boxed Long; JSON numbers that fit an int arrive as Integer, so read through optLong.
        long bytes = call.getData().optLong("bytes", -1L), versionCode = call.getData().optLong("versionCode", -1L);
        String expectedPackage = call.getString("package", "");
        if (!RELEASE_URL.matcher(url).matches() || !sha256.matches("^[a-f0-9]{64}$") || bytes <= 0 || bytes > MAX_BYTES || versionCode <= 0) { call.reject("This update could not be verified.", "INVALID_RELEASE"); return; }
        if (!getContext().getPackageName().equals(expectedPackage)) { call.reject("This build updates from its own channel.", "OTHER_PACKAGE"); return; }
        if (versionCode <= installedCode()) { call.reject("This app is already up to date.", "NOT_NEWER"); return; }
        synchronized (this) { if (busy) { call.reject("An update is already downloading.", "BUSY"); return; } busy = true; cancelled = false; }
        io.execute(() -> {
            try {
                File target = apk(versionCode);
                if (target.length() == bytes && sha256.equals(hash(target)) && sameApp(target, versionCode)) { call.resolve(new JSObject().put("status", "ready").put("cached", true)); return; }
                if (!dir().isDirectory() && !dir().mkdirs()) throw new IOException("App storage is unavailable.");
                if (dir().getUsableSpace() < bytes + 16L * 1024 * 1024) { call.reject("Not enough free space on this phone for the update (" + (bytes / 1048576) + " MB).", "NO_SPACE"); return; }
                File part = new File(dir(), target.getName() + ".part");
                String digest = fetch(url, part, bytes, versionCode);
                if (part.length() != bytes) throw new IOException("The download was incomplete. Try again.");
                if (!sha256.equals(digest)) { part.delete(); call.reject("The download did not match this release, so it was not installed. Try again.", "MISMATCH"); return; }
                if (!sameApp(part, versionCode)) { part.delete(); call.reject("The download is not a CardStashy update for this app, so it was not installed.", "NOT_THIS_APP"); return; }
                if (target.exists() && !target.delete() || !part.renameTo(target)) throw new IOException("The update could not be saved.");
                call.resolve(new JSObject().put("status", "ready").put("cached", false));
            } catch (Exception e) {
                if (cancelled) call.resolve(new JSObject().put("status", "cancelled"));
                else call.reject(e.getMessage() == null ? "The download stopped. Try again." : e.getMessage(), "DOWNLOAD", e);
            } finally { busy = false; }
        });
    }

    // Streams the file, hashing as it goes, with progress about four times a second.
    private String fetch(String address, File part, long bytes, long versionCode) throws Exception {
        HttpsURLConnection connection = (HttpsURLConnection) new URL(address).openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(20000); connection.setReadTimeout(30000);
        connection.setRequestProperty("Cache-Control", "no-cache");
        connection.setRequestProperty("Accept", "application/vnd.android.package-archive");
        try {
            int status = connection.getResponseCode();
            if (status != HttpURLConnection.HTTP_OK) throw new IOException(status == 404 ? "That update is no longer published. Check again." : "The download is unavailable right now (" + status + "). Try again.");
            long length = connection.getContentLengthLong();
            if (length >= 0 && length != bytes) throw new IOException("The published file changed. Check for updates again.");
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long received = 0, last = 0;
            try (InputStream input = connection.getInputStream(); OutputStream output = new FileOutputStream(part, false)) {
                byte[] buffer = new byte[64 * 1024]; int count;
                while ((count = input.read(buffer)) != -1) {
                    if (cancelled) throw new IOException("cancelled");
                    received += count;
                    if (received > bytes) throw new IOException("The published file changed. Check for updates again.");
                    output.write(buffer, 0, count); digest.update(buffer, 0, count);
                    long now = System.currentTimeMillis();
                    if (now - last >= 250 || received == bytes) { last = now; notifyListeners("progress", new JSObject().put("versionCode", versionCode).put("received", received).put("total", bytes)); }
                }
            }
            return hex(digest.digest());
        } finally { connection.disconnect(); }
    }

    private static String hash(File file) {
        try (InputStream input = new java.io.FileInputStream(file)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256"); byte[] buffer = new byte[64 * 1024]; int count;
            while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count);
            return hex(digest.digest());
        } catch (Exception e) { return ""; }
    }
    private static String hex(byte[] bytes) { StringBuilder out = new StringBuilder(); for (byte b : bytes) out.append(String.format("%02x", b)); return out.toString(); }

    // The same package, the announced newer versionCode, and (where Android can read it) the same signing key.
    @SuppressWarnings("deprecation")
    private boolean sameApp(File file, long versionCode) {
        if (!file.isFile()) return false;
        PackageManager pm = getContext().getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo archive = pm.getPackageArchiveInfo(file.getPath(), flags);
        if (archive == null || !getContext().getPackageName().equals(archive.packageName)) return false;
        long code = Build.VERSION.SDK_INT >= 28 ? archive.getLongVersionCode() : archive.versionCode;
        if (code != versionCode || code <= installedCode()) return false;
        Signature[] incoming = signatures(archive);
        if (incoming == null || incoming.length == 0) return true; // the installer still refuses a different key
        try { Signature[] mine = signatures(pm.getPackageInfo(getContext().getPackageName(), flags)); return mine == null || sameSet(mine, incoming); }
        catch (PackageManager.NameNotFoundException e) { return false; }
    }
    @SuppressWarnings("deprecation")
    private static Signature[] signatures(PackageInfo info) {
        if (Build.VERSION.SDK_INT >= 28) return info.signingInfo == null ? null : info.signingInfo.getApkContentsSigners();
        return info.signatures;
    }
    private static boolean sameSet(Signature[] a, Signature[] b) {
        String[] x = new String[a.length], y = new String[b.length];
        for (int i = 0; i < a.length; i++) x[i] = a[i].toCharsString();
        for (int i = 0; i < b.length; i++) y[i] = b[i].toCharsString();
        Arrays.sort(x); Arrays.sort(y); return Arrays.equals(x, y);
    }

    // Opens Android's installer on the verified file. The first time, Android needs "Install unknown apps"
    // allowed for CardStashy: its settings switch opens, and coming back with it on goes straight on.
    @PluginMethod public void install(PluginCall call) {
        long versionCode = call.getData().optLong("versionCode", -1L);
        if (!apk(versionCode).isFile()) { call.reject("Download the update first.", "NOT_DOWNLOADED"); return; }
        if (canInstall()) { launch(call, versionCode); return; }
        Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
        try { startActivityForResult(call, intent, "installPermission"); }
        catch (Exception e) { call.resolve(new JSObject().put("status", "permission-needed")); }
    }
    @ActivityCallback private void installPermission(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (canInstall()) launch(call, call.getData().optLong("versionCode", -1L));
        else call.resolve(new JSObject().put("status", "permission-needed"));
    }
    private void launch(PluginCall call, long versionCode) {
        Context context = getContext(); Activity activity = getActivity();
        try {
            Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", apk(versionCode));
            Intent intent = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            (activity != null ? activity : context).startActivity(activity != null ? intent : intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            call.resolve(new JSObject().put("status", "installer-opened"));
        } catch (Exception e) { call.reject("Android's installer could not open the update.", "INSTALLER", e); }
    }

    @Override protected void handleOnDestroy() { cancelled = true; io.shutdown(); }
}
