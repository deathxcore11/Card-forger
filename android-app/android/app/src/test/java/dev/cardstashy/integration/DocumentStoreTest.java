package dev.cardstashy.integration;

import org.junit.Test;
import org.junit.Rule;
import org.junit.rules.TemporaryFolder;
import static org.junit.Assert.*;
import java.io.*;
import java.nio.charset.StandardCharsets;

public class DocumentStoreTest {
    @Rule public TemporaryFolder folder = new TemporaryFolder();
    @Test public void chunksRoundTripAndSeal() throws Exception {
        DocumentStore store = new DocumentStore(folder.newFolder()); String handle = store.create();
        byte[] text = "Cards 🃏 Pokémon".getBytes(StandardCharsets.UTF_8);
        assertEquals(text.length, store.append(handle, 0, text)); store.seal(handle, text.length);
        assertArrayEquals(text, store.read(handle, 0));
        ByteArrayOutputStream out = new ByteArrayOutputStream(); assertEquals(text.length, store.copyTo(handle, out)); assertArrayEquals(text, out.toByteArray());
    }
    @Test public void rejectsTraversalAndUnknownHandles() throws Exception {
        DocumentStore store = new DocumentStore(folder.newFolder());
        for (String handle : new String[]{"../cards", "/absolute", "abc", "00000000-0000-0000-0000-000000000000"}) {
            try { store.read(handle, 0); fail("accepted invalid handle"); } catch (IOException expected) {}
        }
    }
    @Test public void rejectsOutOfOrderOverflowAndAfterSeal() throws Exception {
        DocumentStore store = new DocumentStore(folder.newFolder()); String handle = store.create();
        try { store.append(handle, 1, new byte[]{1}); fail(); } catch (IOException expected) {}
        try { store.append(handle, 0, new byte[DocumentStore.CHUNK_BYTES + 1]); fail(); } catch (IOException expected) {}
        store.append(handle, 0, new byte[]{1});
        try { store.seal(handle, 2); fail(); } catch (IOException expected) {}
        store.seal(handle, 1);
        try { store.append(handle, 1, new byte[]{2}); fail(); } catch (IOException expected) {}
    }
    @Test public void restartCanReadSealedTemporaryDocument() throws Exception {
        File root = folder.newFolder(); DocumentStore store = new DocumentStore(root); String handle = store.create();
        store.append(handle, 0, new byte[]{3, 4}); store.seal(handle, 2);
        assertArrayEquals(new byte[]{3, 4}, new DocumentStore(root).read(handle, 0));
    }
    @Test public void discardTouchesOnlyRequestedTemporaryCopy() throws Exception {
        File root = folder.newFolder(); DocumentStore store = new DocumentStore(root); String one = store.create(), two = store.create();
        store.append(two, 0, new byte[]{5}); store.seal(two, 1); store.discard(one);
        assertArrayEquals(new byte[]{5}, store.read(two, 0));
    }
    @Test public void failedOutputLeavesStagedInputReadable() throws Exception {
        DocumentStore store = new DocumentStore(folder.newFolder()); String handle = store.create(); store.append(handle, 0, new byte[]{6}); store.seal(handle, 1);
        try { store.copyTo(handle, new OutputStream() { public void write(int b) throws IOException { throw new IOException("full"); } }); fail(); } catch (IOException expected) {}
        assertArrayEquals(new byte[]{6}, store.read(handle, 0));
    }
    @Test public void namesAndMimesAreBounded() {
        assertEquals(".._cards.json", DocumentStore.safeName("../cards.json"));
        assertEquals("application/octet-stream", DocumentStore.safeMime("text/html\nheader"));
        assertEquals("application/json", DocumentStore.safeMime("application/json"));
    }
    @Test public void emptyDocumentCanBeSaved() throws Exception {
        DocumentStore store = new DocumentStore(folder.newFolder()); String handle = store.create(); store.seal(handle, 0); assertEquals(0, store.read(handle, 0).length);
    }
    @Test public void readsBoundedChunksAndExactEndOfFile() throws Exception {
        DocumentStore store = new DocumentStore(folder.newFolder()); String handle = store.create();
        byte[] first = new byte[DocumentStore.CHUNK_BYTES]; java.util.Arrays.fill(first, (byte) 7);
        store.append(handle, 0, first); store.append(handle, first.length, new byte[]{8, 9});
        store.seal(handle, first.length + 2);
        assertArrayEquals(first, store.read(handle, 0));
        assertArrayEquals(new byte[]{8, 9}, store.read(handle, first.length));
        assertEquals(0, store.read(handle, first.length + 2).length);
        for (long offset : new long[]{-1, first.length + 3}) {
            try { store.read(handle, offset); fail(); } catch (IOException expected) {}
        }
    }
    @Test public void rejectsActualFileAtSizeLimitWithoutAllocatingLargeBuffer() throws Exception {
        File root = folder.newFolder(); DocumentStore store = new DocumentStore(root); String handle = store.create();
        try (RandomAccessFile data = new RandomAccessFile(new File(root, handle + ".bin"), "rw")) { data.setLength(DocumentStore.MAX_BYTES); }
        try { store.append(handle, DocumentStore.MAX_BYTES, new byte[]{1}); fail(); } catch (IOException expected) {}
        store.discard(handle); store.discard(handle);
    }
    @Test public void flushFailureDoesNotDiscardStagedDocument() throws Exception {
        DocumentStore store = new DocumentStore(folder.newFolder()); String handle = store.create();
        store.append(handle, 0, new byte[]{1}); store.seal(handle, 1);
        try { store.copyTo(handle, new ByteArrayOutputStream() { @Override public void flush() throws IOException { throw new IOException("flush failed"); } }); fail(); }
        catch (IOException expected) { assertEquals("flush failed", expected.getMessage()); }
        assertArrayEquals(new byte[]{1}, store.read(handle, 0));
    }
}
