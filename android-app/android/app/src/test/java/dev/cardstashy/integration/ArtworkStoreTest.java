package dev.cardstashy.integration;

import org.junit.Test;
import org.junit.Rule;
import org.junit.rules.TemporaryFolder;
import static org.junit.Assert.*;
import java.io.*;
import java.nio.file.Files;
import java.security.MessageDigest;

public class ArtworkStoreTest {
    @Rule public TemporaryFolder folder = new TemporaryFolder();
    private static String hash(byte[] bytes) throws Exception { StringBuilder text = new StringBuilder(); for (byte b : MessageDigest.getInstance("SHA-256").digest(bytes)) text.append(String.format("%02x", b & 255)); return text.toString(); }
    private static String write(ArtworkStore store, String ns, byte[] bytes) throws Exception {
        String hash = hash(bytes), handle = store.begin(ns, hash, bytes.length);
        for (int offset = 0; offset < bytes.length; offset += ArtworkStore.CHUNK_BYTES) store.append(handle, offset, java.util.Arrays.copyOfRange(bytes, offset, Math.min(bytes.length, offset + ArtworkStore.CHUNK_BYTES)));
        assertEquals(bytes.length, store.commit(handle)); return hash;
    }
    private interface Operation { void run() throws Exception; }
    private static void rejects(Operation operation) throws Exception { try { operation.run(); fail("Unsafe operation succeeded"); } catch (IOException expected) {} }
    @Test public void chunkedAtomicRoundTripAndRealDiskBytes() throws Exception {
        ArtworkStore store = new ArtworkStore(folder.newFolder()); byte[] bytes = new byte[ArtworkStore.CHUNK_BYTES + 7]; java.util.Arrays.fill(bytes, (byte)7);
        String hash = write(store, "evictable", bytes);
        assertEquals(bytes.length, store.bytes("evictable")); assertEquals(0, store.bytes("pending")); assertTrue(store.availableBytes() > 0);
        assertEquals(ArtworkStore.CHUNK_BYTES, store.read("evictable", hash, 0).length); assertArrayEquals(new byte[]{7,7,7,7,7,7,7}, store.read("evictable", hash, ArtworkStore.CHUNK_BYTES));
    }
    @Test public void evictionPreservesPinnedRecordsAndScanFiles() throws Exception {
        File base = folder.newFolder(); File records = new File(base, "collection.json"), scans = new File(base, "scan-captures");
        Files.write(records.toPath(), new byte[]{9}); scans.mkdir(); File scan = new File(scans, "original.jpg"); Files.write(scan.toPath(), new byte[]{8});
        ArtworkStore store = new ArtworkStore(base); String hash = write(store, "pinned", new byte[]{1}); write(store, "evictable", new byte[]{2,3});
        assertEquals(2, store.clear("evictable")); assertArrayEquals(new byte[]{1}, store.read("pinned", hash, 0));
        assertArrayEquals(new byte[]{9}, Files.readAllBytes(records.toPath())); assertArrayEquals(new byte[]{8}, Files.readAllBytes(scan.toPath()));
        assertEquals(1, store.clear("pinned")); assertTrue(records.isFile()); assertTrue(scan.isFile());
    }
    @Test public void restartPreservesCommittedArtButCleansInterruptedWrites() throws Exception {
        File base = folder.newFolder(); ArtworkStore first = new ArtworkStore(base); String hash = write(first, "pinned", new byte[]{4});
        String handle = first.begin("evictable", hash, 1); first.append(handle, 0, new byte[]{4}); assertEquals(1, first.bytes("pending"));
        ArtworkStore restarted = new ArtworkStore(base); assertEquals(0, restarted.bytes("pending")); assertArrayEquals(new byte[]{4}, restarted.read("pinned", hash, 0)); rejects(() -> restarted.commit(handle));
    }
    @Test public void mismatchAndPartialWritesNeverReplaceExistingArtwork() throws Exception {
        ArtworkStore store = new ArtworkStore(folder.newFolder()); String hash = write(store, "evictable", new byte[]{5,6});
        String handle = store.begin("evictable", hash, 2); store.append(handle, 0, new byte[]{5}); rejects(() -> store.commit(handle));
        store.append(handle, 1, new byte[]{7}); rejects(() -> store.commit(handle)); assertArrayEquals(new byte[]{5,6}, store.read("evictable", hash, 0));
        store.abort(handle); assertEquals(0, store.bytes("pending"));
    }
    @Test public void rejectsTraversalInvalidNamespacesOffsetsAndOversize() throws Exception {
        ArtworkStore store = new ArtworkStore(folder.newFolder()); String hash = hash(new byte[]{1});
        rejects(() -> store.begin("../scan-captures", hash, 1)); rejects(() -> store.begin("pending", hash, 1)); rejects(() -> store.begin("pinned", "../../collection.json", 1));
        rejects(() -> store.begin("evictable", hash, ArtworkStore.MAX_BYTES + 1)); rejects(() -> store.begin("evictable", hash, 0));
        rejects(() -> store.abort("../../collection.json")); rejects(() -> store.clear("scan-captures"));
        String handle = store.begin("evictable", hash, 1); rejects(() -> store.append(handle, 1, new byte[]{1})); rejects(() -> store.append(handle, 0, new byte[ArtworkStore.CHUNK_BYTES + 1]));
        store.append(handle, 0, new byte[]{1}); store.commit(handle); rejects(() -> store.read("evictable", hash, -1)); rejects(() -> store.read("evictable", hash, 2));
    }
    @Test public void symlinkCannotReadOrDeleteUnrelatedFiles() throws Exception {
        File base = folder.newFolder(), outside = folder.newFile(); Files.write(outside.toPath(), new byte[]{8}); ArtworkStore store = new ArtworkStore(base); String hash = hash(new byte[]{8});
        File link = new File(base, "artwork-store/evictable/" + hash + ".art"); Files.createSymbolicLink(link.toPath(), outside.toPath());
        rejects(() -> store.read("evictable", hash, 0)); rejects(() -> store.remove("evictable", hash)); rejects(() -> store.clear("evictable")); assertArrayEquals(new byte[]{8}, Files.readAllBytes(outside.toPath()));
    }
    @Test public void clearCancelsOnlyTransfersInChosenNamespace() throws Exception {
        ArtworkStore store = new ArtworkStore(folder.newFolder()); String hash = hash(new byte[]{1});
        String evictable = store.begin("evictable", hash, 1), pinned = store.begin("pinned", hash, 1);
        store.append(evictable, 0, new byte[]{1}); store.append(pinned, 0, new byte[]{1}); store.clear("evictable");
        rejects(() -> store.commit(evictable)); assertEquals(1, store.commit(pinned));
    }
    @Test public void onlyKnownArtworkFilesAreCleared() throws Exception {
        File base = folder.newFolder(); ArtworkStore store = new ArtworkStore(base);
        File unknown = new File(base, "artwork-store/evictable/keep.txt"); Files.write(unknown.toPath(), new byte[]{1});
        assertEquals(0, store.clear("evictable")); assertTrue(unknown.isFile());
    }
}
