package dev.cardstashy.integration;

import static org.junit.Assert.*;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.Before;
import org.junit.Test;

public class ImageCacheTest {
    private File dir;
    private final List<String> fetched = Collections.synchronizedList(new ArrayList<>());
    private final List<Long> slept = Collections.synchronizedList(new ArrayList<>());

    @Before public void setUp() throws IOException { dir = Files.createTempDirectory("card-art").toFile(); }

    private static ImageCache.Response jpeg(String s) { return new ImageCache.Response(200, "image/jpeg", s.getBytes(StandardCharsets.UTF_8)); }
    private ImageCache cache(ImageCache.Fetcher f, int max) { return new ImageCache(dir, url -> { fetched.add(url); return f.get(url); }, slept::add, max); }

    @Test public void onlyTheWebsiteImageRoutesAreServed() {
        for (String ok : new String[]{"/img/ygo/123.jpg", "/img/ygo/s/123.jpg", "/img/ygo/a/123.jpg", "/img/pack/mtg.jpg", "/img/back/ygo.jpg", "/img/mtg-set/mh3.jpg", "/img/pks/s/sv1.png", "/img/ptcg/l/dp-1?.jpg"})
            assertTrue(ok, ImageCache.allowed(ok, null));
        assertTrue(ImageCache.allowed("/img/ptcg/s/sv1-1.jpg", "v=2"));
        for (String bad : new String[]{"/img/ygo/abc.jpg", "/img/foo.jpg", "/api/daily-card", "/img/ygo/../a.jpg", "/img/ptcg/l/a/b.jpg", "/img/ygo/1.jpg/x"})
            assertFalse(bad, ImageCache.allowed(bad, null));
        assertFalse(ImageCache.allowed("/img/ygo/1.jpg", "a=<script>"));
        assertNull(cache(url -> jpeg("x"), 10).get("/api/daily-card", "/api/daily-card", null));
        assertTrue("disallowed paths never reach the network", fetched.isEmpty());
    }

    @Test public void eachPictureIsDownloadedOnceThenServedFromThePhone() {
        ImageCache c = cache(url -> jpeg("art:" + url), 10);
        ImageCache.Response a = c.get("/img/ygo/s/42.jpg", "/img/ygo/s/42.jpg", null), b = c.get("/img/ygo/s/42.jpg", "/img/ygo/s/42.jpg", null);
        assertEquals("art:https://cardstashy.com/img/ygo/s/42.jpg", new String(a.body, StandardCharsets.UTF_8));
        assertArrayEquals(a.body, b.body); assertEquals("image/jpeg", b.type);
        assertEquals(1, fetched.size());
        // A fresh cache over the same directory (next app launch) still has it.
        assertNotNull(new ImageCache(dir, url -> { throw new IOException("offline"); }, ms -> {}, 10).get("/img/ygo/s/42.jpg", "/img/ygo/s/42.jpg", null));
        // The query is part of the identity (?v=2 is a different picture).
        c.get("/img/ptcg/s/sv1-1.jpg", "/img/ptcg/s/sv1-1.jpg", "v=2"); c.get("/img/ptcg/s/sv1-1.jpg", "/img/ptcg/s/sv1-1.jpg", null);
        assertTrue(fetched.contains("https://cardstashy.com/img/ptcg/s/sv1-1.jpg?v=2")); assertTrue(fetched.contains("https://cardstashy.com/img/ptcg/s/sv1-1.jpg"));
    }

    @Test public void busyServerIsRetriedWithBackoffButNotFoundIsNot() {
        AtomicInteger calls = new AtomicInteger();
        ImageCache c = cache(url -> calls.incrementAndGet() < 3 ? new ImageCache.Response(429, null, null) : jpeg("ok"), 10);
        assertNotNull(c.get("/img/ygo/7.jpg", "/img/ygo/7.jpg", null));
        assertEquals(3, calls.get()); assertEquals(List.of(400L, 800L), slept);
        calls.set(0); slept.clear();
        assertNull(cache(url -> { calls.incrementAndGet(); return new ImageCache.Response(404, null, null); }, 10).get("/img/ygo/8.jpg", "/img/ygo/8.jpg", null));
        assertEquals(1, calls.get()); assertTrue(slept.isEmpty());
        calls.set(0);
        assertNull("gives up after four tries", cache(url -> { calls.incrementAndGet(); throw new IOException("reset"); }, 10).get("/img/ygo/9.jpg", "/img/ygo/9.jpg", null));
        assertEquals(4, calls.get());
    }

    @Test public void nonImagesAreNeverStored() {
        ImageCache c = cache(url -> new ImageCache.Response(200, "text/html", "<html>".getBytes(StandardCharsets.UTF_8)), 10);
        assertNull(c.get("/img/ygo/5.jpg", "/img/ygo/5.jpg", null));
        assertNull(c.get("/img/ygo/5.jpg", "/img/ygo/5.jpg", null));
        assertEquals("not cached, asked again", 2, fetched.size());
    }

    @Test public void leastRecentlyViewedPicturesAreTrimmed() throws Exception {
        ImageCache c = cache(url -> jpeg(url), 2);
        c.get("/img/ygo/1.jpg", "/img/ygo/1.jpg", null); Thread.sleep(20);
        c.get("/img/ygo/2.jpg", "/img/ygo/2.jpg", null); Thread.sleep(20);
        c.get("/img/ygo/1.jpg", "/img/ygo/1.jpg", null); Thread.sleep(20); // viewed again
        c.get("/img/ygo/3.jpg", "/img/ygo/3.jpg", null);
        fetched.clear();
        c.get("/img/ygo/1.jpg", "/img/ygo/1.jpg", null); c.get("/img/ygo/3.jpg", "/img/ygo/3.jpg", null);
        assertTrue("1 and 3 kept", fetched.isEmpty());
        c.get("/img/ygo/2.jpg", "/img/ygo/2.jpg", null);
        assertEquals("2 was trimmed", 1, fetched.size());
    }

    @Test public void atMostFourDownloadsRunAtOnce() throws Exception {
        AtomicInteger running = new AtomicInteger(), peak = new AtomicInteger();
        ImageCache c = cache(url -> { int n = running.incrementAndGet(); peak.accumulateAndGet(n, Math::max); try { Thread.sleep(40); } catch (InterruptedException e) { } running.decrementAndGet(); return jpeg(url); }, 100);
        CountDownLatch done = new CountDownLatch(16);
        for (int i = 0; i < 16; i++) { final int id = i; new Thread(() -> { c.get("/img/ygo/" + id + ".jpg", "/img/ygo/" + id + ".jpg", null); done.countDown(); }).start(); }
        done.await();
        assertEquals(16, fetched.size()); assertTrue("peak " + peak.get(), peak.get() <= 4);
    }
}
