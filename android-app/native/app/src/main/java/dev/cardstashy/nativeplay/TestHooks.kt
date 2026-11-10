package dev.cardstashy.nativeplay

import android.content.Intent
import android.util.Log
import dev.cardstashy.nativeplay.match.Pick
import dev.cardstashy.nativeplay.match.TableLog
import dev.cardstashy.nativeplay.play.TableDecks
import kotlinx.coroutines.flow.MutableStateFlow

/**
 * adb hooks for test builds only (a "-testN" version name, TableLog.on); a release build ignores every extra.
 *
 *   adb shell am start --activity-single-top -n com.cardstashy.app.nativetest/dev.cardstashy.nativeplay.MainActivity --es open finder
 *   … --es match practice --es deck scd-first-flight --es cpu tdc-sultai --es seed 1311 [--es level Hard]
 *
 * open: home, decks, finder, trunk, shop, achievements, story, settings, collection, quick, practice.
 * match: practice (no rewards) or quick, between two free precons by key (data/play-starters/precons.json); with no cpu the
 * next precon in the file plays. seed: the engine's seed for that match (every test-build match logs its seed on TableStep).
 */
object TestHooks {
    data class Ask(val open: String?, val match: String?, val deck: String?, val cpu: String?, val seed: Long?, val level: String)
    val ask = MutableStateFlow<Ask?>(null)
    /** The Finder opens over Decks on the next Decks screen (DecksRoute reads it). */
    val finder = MutableStateFlow(false)
    /** The seed for the next match the engine starts; cleared once used. */
    @Volatile var nextSeed: Long? = null

    fun read(intent: Intent?) {
        if (!TableLog.on) return
        val e = intent?.extras ?: return
        fun s(k: String) = e.get(k)?.toString()?.trim()?.takeIf { it.isNotEmpty() }
        val a = Ask(s("open")?.lowercase(), s("match")?.lowercase(), s("deck"), s("cpu"), s("seed")?.toLongOrNull(), s("level") ?: "Medium")
        if (a.open == null && a.match == null) return
        Log.i(TableLog.TAG, "test hook: $a")
        ask.value = a
    }

    /** The match an [Ask] names, or null (logged) when a deck key is unknown. */
    suspend fun pick(a: Ask): Pick? {
        TableDecks.loadFree()
        val free = TableDecks.free.value.orEmpty()
        fun find(k: String?) = k?.let { key -> free.firstOrNull { it.id == "free:$key" || it.id == key || it.name.equals(key, true) } }
        val you = find(a.deck) ?: free.firstOrNull()
        val cpu = find(a.cpu) ?: you?.let { y -> free.getOrNull((free.indexOf(y) + 1) % free.size) }
        if (you == null || cpu == null) { Log.w(TableLog.TAG, "test hook: no deck for ${a.deck} / ${a.cpu}; keys: ${free.joinToString { it.id.removePrefix("free:") }}"); return null }
        Log.i(TableLog.TAG, "test hook: ${a.match} ${you.id} vs ${cpu.id} seed=${a.seed} level=${a.level}")
        val face = you.commander.takeIf { it.isNotBlank() }?.let(dev.cardstashy.nativeplay.match.EngineNames::name)
        return Pick.Table(you.raw, you.name, you.format, face, cpu.raw, a.level, quick = a.match == "quick")
    }
}
