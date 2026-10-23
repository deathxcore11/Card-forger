package dev.cardstashy.integration;

import java.io.*;
import java.security.MessageDigest;
import java.util.*;

/** Removable artwork only. Never receives collection, capture, or arbitrary caller paths. */
public final class ArtworkStore {
    public static final int CHUNK_BYTES = 64 * 1024;
    public static final long MAX_BYTES = 24L * 1024 * 1024;
    private static final long RESERVE_BYTES = 8L * 1024 * 1024;
    private final File root;
    private final Map<String, Transfer> transfers = new HashMap<>();
    private static final class Transfer {
        final String namespace, hash; final long expected;
        Transfer(String namespace, String hash, long expected) { this.namespace = namespace; this.hash = hash; this.expected = expected; }
    }
    public ArtworkStore(File filesDirectory) throws IOException {
        root = new File(filesDirectory.getCanonicalFile(), "artwork-store");
        ensureDirectory(root);
        ensureDirectory(directory("evictable")); ensureDirectory(directory("pinned")); ensureDirectory(directory("pending"));
        // A process restart invalidates unfinished handles; never expose partial artwork.
        cleanupPending();
    }
    private static void ensureDirectory(File file) throws IOException {
        if (!file.getAbsoluteFile().equals(file.getCanonicalFile())) throw new IOException("Unsafe artwork directory");
        if (!file.isDirectory() && !file.mkdirs()) throw new IOException("Artwork storage unavailable");
    }
    private File directory(String namespace) throws IOException {
        if (!Arrays.asList("evictable", "pinned", "pending").contains(namespace)) throw new IOException("Invalid artwork namespace");
        File dir = new File(root, namespace);
        if (!root.equals(root.getCanonicalFile()) || !dir.equals(dir.getCanonicalFile())) throw new IOException("Unsafe artwork directory");
        return dir;
    }
    private File blob(String namespace, String hash) throws IOException {
        if (!Arrays.asList("evictable", "pinned").contains(namespace) || hash == null || !hash.matches("[a-f0-9]{64}")) throw new IOException("Invalid artwork identity");
        return safeFile(directory(namespace), hash + ".art");
    }
    private File pending(String handle) throws IOException {
        if (handle == null || !handle.matches("[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}")) throw new IOException("Invalid artwork transfer");
        return safeFile(directory("pending"), handle + ".part");
    }
    private File safeFile(File dir, String name) throws IOException {
        File file = new File(dir, name);
        if (!file.equals(file.getCanonicalFile())) throw new IOException("Unsafe artwork path");
        return file;
    }
    public synchronized String begin(String namespace, String hash, long expected) throws IOException {
        blob(namespace, hash);
        if (expected < 1 || expected > MAX_BYTES || transfers.size() >= 4) throw new IOException("Invalid artwork size or too many transfers");
        long reserved = expected;
        for (Transfer transfer : transfers.values()) reserved += transfer.expected;
        if (root.getUsableSpace() < reserved + RESERVE_BYTES) throw new IOException("Insufficient artwork disk space");
        String handle = UUID.randomUUID().toString();
        if (!pending(handle).createNewFile()) throw new IOException("Could not stage artwork");
        transfers.put(handle, new Transfer(namespace, hash, expected)); return handle;
    }
    private Transfer transfer(String handle) throws IOException {
        pending(handle); Transfer result = transfers.get(handle);
        if (result == null) throw new IOException("Artwork transfer expired"); return result;
    }
    public synchronized long append(String handle, long offset, byte[] data) throws IOException {
        Transfer transfer = transfer(handle); File file = pending(handle);
        if (!file.isFile() || offset != file.length() || data == null || data.length < 1 || data.length > CHUNK_BYTES || offset + data.length > transfer.expected) throw new IOException("Invalid artwork chunk");
        if (root.getUsableSpace() < data.length + RESERVE_BYTES) throw new IOException("Insufficient artwork disk space");
        try (FileOutputStream out = new FileOutputStream(file, true)) { out.write(data); }
        return file.length();
    }
    public synchronized long commit(String handle) throws IOException {
        Transfer transfer = transfer(handle); File staged = pending(handle);
        if (!staged.isFile() || staged.length() != transfer.expected) throw new IOException("Incomplete artwork transfer");
        if (!digest(staged).equals(transfer.hash)) throw new IOException("Artwork checksum mismatch");
        try (RandomAccessFile file = new RandomAccessFile(staged, "rw")) { file.getFD().sync(); }
        File destination = blob(transfer.namespace, transfer.hash);
        // Same-filesystem rename is atomic on Android/Linux; no delete-then-write fallback.
        if (!staged.renameTo(destination)) throw new IOException("Could not atomically store artwork");
        transfers.remove(handle); return destination.length();
    }
    private static String digest(File file) throws IOException {
        try {
            MessageDigest hash = MessageDigest.getInstance("SHA-256");
            try (InputStream in = new FileInputStream(file)) { byte[] buffer = new byte[CHUNK_BYTES]; int count; while ((count = in.read(buffer)) != -1) hash.update(buffer, 0, count); }
            StringBuilder result = new StringBuilder(); for (byte value : hash.digest()) result.append(String.format(Locale.ROOT, "%02x", value & 255)); return result.toString();
        } catch (java.security.NoSuchAlgorithmException e) { throw new IOException(e); }
    }
    public synchronized void abort(String handle) throws IOException { File file = pending(handle); delete(file); transfers.remove(handle); }
    private static void delete(File file) throws IOException { if (file.exists() && !file.delete()) throw new IOException("Could not remove artwork"); }
    public synchronized long length(String namespace, String hash) throws IOException { File file = blob(namespace, hash); return file.isFile() ? file.length() : -1; }
    public synchronized byte[] read(String namespace, String hash, long offset) throws IOException {
        File file = blob(namespace, hash); long size = file.length();
        if (!file.isFile() || size > MAX_BYTES || offset < 0 || offset > size) throw new IOException("Artwork unavailable or invalid offset");
        byte[] data = new byte[(int)Math.min(CHUNK_BYTES, size - offset)];
        try (RandomAccessFile in = new RandomAccessFile(file, "r")) { in.seek(offset); in.readFully(data); } return data;
    }
    public synchronized long remove(String namespace, String hash) throws IOException { File file = blob(namespace, hash); long bytes = file.length(); delete(file); return bytes; }
    public synchronized long clear(String namespace) throws IOException {
        // Validate before touching anything; pending transfer cancellation is namespace-scoped.
        blob(namespace, "0000000000000000000000000000000000000000000000000000000000000000");
        for (String handle : new ArrayList<>(transfers.keySet())) if (transfers.get(handle).namespace.equals(namespace)) abort(handle);
        long removed = 0;
        for (File file : list(directory(namespace))) {
            if (!file.getName().matches("[a-f0-9]{64}\\.art")) continue;
            File safe = safeFile(directory(namespace), file.getName());
            if (!safe.isFile()) throw new IOException("Unexpected artwork entry");
            long bytes = safe.length(); delete(safe); removed += bytes;
        }
        return removed;
    }
    private static File[] list(File dir) throws IOException { File[] files = dir.listFiles(); if (files == null) throw new IOException("Could not inspect artwork storage"); return files; }
    public synchronized long bytes(String namespace) throws IOException {
        File dir = directory(namespace); long bytes = 0;
        for (File file : list(dir)) { File safe = safeFile(dir, file.getName()); if (safe.isFile()) bytes += safe.length(); }
        return bytes;
    }
    public synchronized long availableBytes() { return root.getUsableSpace(); }
    private void cleanupPending() throws IOException {
        File dir = directory("pending");
        for (File file : list(dir)) if (file.getName().matches("[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\\.part")) delete(safeFile(dir, file.getName()));
    }
}
