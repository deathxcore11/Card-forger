package dev.cardstashy.nativeplay.ui

import coil3.disk.DiskCache

/**
 * Lighter Collection home C1 (specs/collection-home-lighter-brief.md): "pin the home's pictures so they are never evicted".
 * The art cache drops the pictures used longest ago first. Each time Home is painted for good, and at the launch warm-up,
 * the first screen's pictures are marked as just used, so they are always the newest and the last the cache would drop.
 * Nothing is downloaded here: a picture that is not on the device yet is fetched by the page as before.
 */
internal object HomePins {
    /** The first screen's pictures, in the order they are seen: the Card of the Day, the lead deck's cover, then the shelf's covers. */
    fun pictures(m: CollectionHomeModel): List<String> = buildList {
        m.daily?.let { add(it.art); addAll(it.sources) }
        m.shelf.lead?.let { l -> l.art?.let(::add); addAll(l.sources) }
        m.shelf.decks.forEach { d -> d.art?.let(::add); addAll(d.sources) }
    }.filter { it.startsWith("http") }.distinct()

    /** Marks each of [urls] found in [cache] as just used; the number found. */
    fun touch(urls: List<String>, cache: DiskCache?): Int {
        cache ?: return 0
        return urls.count { u -> runCatching { cache.openSnapshot(u)?.also { it.close() } != null }.getOrDefault(false) }
    }

    /** Call off the main thread. */
    fun pin(m: CollectionHomeModel): Int = runCatching { touch(pictures(m), dev.cardstashy.nativeplay.art.CardArt.loader.diskCache) }.getOrDefault(0)
}
