package dev.cardstashy.integration;

import java.io.*;
import java.util.UUID;

/** App-private temporary copies only. Never opens arbitrary caller paths. */
public final class DocumentStore {
    public static final int CHUNK_BYTES = 64 * 1024;
    public static final long MAX_BYTES = 60_000_000L;
    private final File root;
    public DocumentStore(File root) throws IOException {
        this.root = root.getCanonicalFile();
        if (!this.root.isDirectory() && !this.root.mkdirs()) throw new IOException("Private document storage unavailable");
    }
    private File path(String handle, String extension) throws IOException {
        if (handle == null || !handle.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")) throw new IOException("Invalid document handle");
        File file = new File(root, handle + extension).getCanonicalFile();
        if (!root.equals(file.getParentFile())) throw new IOException("Invalid document location");
        return file;
    }
    public synchronized String create() throws IOException {
        String handle = UUID.randomUUID().toString();
        if (!path(handle, ".bin").createNewFile()) throw new IOException("Could not stage document");
        return handle;
    }
    public synchronized long append(String handle, long offset, byte[] bytes) throws IOException {
        File file = path(handle, ".bin");
        if (!file.isFile() || path(handle, ".sealed").exists()) throw new IOException("Document is missing or already sealed");
        if (offset != file.length() || bytes.length < 1 || bytes.length > CHUNK_BYTES || offset + bytes.length > MAX_BYTES) throw new IOException("Invalid document chunk or document exceeds 60 MB");
        if (root.getUsableSpace() < bytes.length + 8L * 1024 * 1024) throw new IOException("Not enough free space to stage document");
        try (FileOutputStream out = new FileOutputStream(file, true)) { out.write(bytes); }
        return file.length();
    }
    public synchronized long seal(String handle, long expectedBytes) throws IOException {
        File file = path(handle, ".bin");
        if (!file.isFile() || expectedBytes < 0 || expectedBytes > MAX_BYTES || file.length() != expectedBytes) throw new IOException("Document staging was incomplete");
        // One durable sync per completed document, not one expensive sync per 64 KiB.
        try (RandomAccessFile data = new RandomAccessFile(file, "rw")) { data.getFD().sync(); }
        File marker = path(handle, ".sealed");
        if (!marker.exists() && !marker.createNewFile()) throw new IOException("Could not seal document");
        return file.length();
    }
    public synchronized long length(String handle) throws IOException { return ready(handle).length(); }
    private File ready(String handle) throws IOException {
        File file = path(handle, ".bin");
        if (!file.isFile() || !path(handle, ".sealed").isFile()) throw new IOException("Document is not ready");
        return file;
    }
    public synchronized byte[] read(String handle, long offset) throws IOException {
        File file = ready(handle);
        if (offset < 0 || offset > file.length()) throw new IOException("Invalid document read offset");
        byte[] result = new byte[(int)Math.min(CHUNK_BYTES, file.length() - offset)];
        try (RandomAccessFile input = new RandomAccessFile(file, "r")) { input.seek(offset); input.readFully(result); }
        return result;
    }
    public synchronized long copyTo(String handle, OutputStream output) throws IOException {
        File file = ready(handle); long total = 0;
        try (FileInputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[CHUNK_BYTES]; int count;
            while ((count = input.read(buffer)) != -1) { output.write(buffer, 0, count); total += count; }
        }
        output.flush();
        return total;
    }
    public synchronized void discard(String handle) throws IOException {
        File data = path(handle, ".bin"), marker = path(handle, ".sealed");
        if (data.exists() && !data.delete()) throw new IOException("Could not remove temporary document");
        if (marker.exists() && !marker.delete()) throw new IOException("Could not remove temporary document marker");
    }
    public static String safeName(String value) {
        if (value == null) return "CardStashy_Backup.json";
        String name = value.replaceAll("[\\x00-\\x1f\\x7f/\\\\]", "_").trim();
        if (name.isEmpty() || name.equals(".") || name.equals("..")) return "CardStashy_Document.txt";
        return name.substring(0, Math.min(160, name.length()));
    }
    public static String safeMime(String value) {
        if (value != null && value.matches("(?:text/(?:plain|csv|html)|application/(?:json|octet-stream)|image/(?:jpeg|png|webp|avif))")) return value;
        return "application/octet-stream";
    }
}
