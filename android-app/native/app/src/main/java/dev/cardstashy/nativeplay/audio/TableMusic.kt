package dev.cardstashy.nativeplay.audio

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Handler
import android.os.Looper
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.AppSettings
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File

/**
 * The table's music (play-table-audio.js music() and audio.js setMusic): the same tracks the site plays, streamed from
 * cardstashy.com the first time and kept on this device after. Loops carry their loop points (audio-loops.js), so the
 * seam sits inside continuous audio. Early turns, the fuller table, then the low-life track; a Story battle plays its
 * act's own songs; the result gets its short sting and then silence. Silent with "Sound & music" off and in the background.
 */
class TableMusic(private val context: Context, private val scope: CoroutineScope, private val story: StoryMusic? = null) {
    /** A Story battle's act and its mood or kind (app.js: data-story-act, data-story-mood, data-story-kind). */
    class StoryMusic(val act: Int, val mood: String?, val kind: String?)

    private val main = Handler(Looper.getMainLooper())
    private val dir = File(context.filesDir, "music").apply { mkdirs() }
    private var player: MediaPlayer? = null
    private var key = ""
    private var job: Job? = null
    private var points: Pair<Float, Float>? = null
    private var wanted: String? = null
    private var ending = false
    private var closed = false
    @Volatile var muted = false
        set(on) { field = on; main.post { if (on) player?.runCatching { if (isPlaying) pause() } else resume() } }

    private val track: Runnable = object : Runnable {
        override fun run() {
            val p = player; val pts = points
            if (p != null && pts != null && key.endsWith("|loop")) runCatching { if (p.isPlaying && p.currentPosition >= (pts.second * 1000).toInt() - 90) p.seekTo((pts.first * 1000).toInt()) }
            if (!closed) main.postDelayed(this, 40)
        }
    }

    // Story: A the battle song, B the lighter song, C the boss song; a boss fight goes from C to A. Other matches mostly keep the table score.
    private val pool: List<String>? = story?.let { s ->
        val n = s.act.toString().padStart(2, '0')
        val first = MOOD[s.mood] ?: KIND[s.kind] ?: 'A'
        val order = mapOf('A' to "AB", 'B' to "BA", 'C' to "CA")[first].orEmpty().map { "MUS-ST-$n$it" }.filter { it in LOOPS }
        order.takeIf { it.isNotEmpty() }
    } ?: if (Math.random() < .35) LOOPS.keys.filter { it.startsWith("MUS-ST-") && !it.endsWith("C") }.shuffled().take(4) else null
    private var at = 0; private var since = 0L

    fun update(b: MatchState) {
        if (closed || ending) return
        if (b.finished) {
            ending = true
            val win = b.winnerPlayerId == b.viewer
            if (b.draw || b.winnerPlayerId == null) stop() else play(if (win) "MUS-TBL-06" else "MUS-TBL-07", loop = false)
            return
        }
        val low = b.players.any { it.life in 1..5 }
        val id = if (pool != null && !(low && story == null)) {
            val now = System.currentTimeMillis()
            val cur = pool[at % pool.size]
            val span = LOOPS[cur]?.let { ((it.second - it.first) * 1000).toLong() } ?: 240_000L
            if (since == 0L) since = now else if (now - since >= span) { at++; since = now }
            pool[at % pool.size]
        } else if (low) "MUS-TBL-05" else if (b.turn <= 8) "MUS-TBL-03" else "MUS-TBL-04"
        play(id, loop = true)
    }

    private fun play(id: String, loop: Boolean) {
        val k = "$id|${if (loop) "loop" else "once"}"
        wanted = k
        if (k == key || !AppSettings.sound) return
        key = k
        job?.cancel()
        job = scope.launch(Dispatchers.IO) {
            val f = fetch(id) ?: return@launch
            withContext(Dispatchers.Main) { if (!closed && wanted == k) start(f, id, loop, k) }
        }
    }

    private fun start(f: File, id: String, loop: Boolean, k: String) {
        val old = player
        val p = MediaPlayer()
        runCatching {
            p.setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
            p.setDataSource(f.path); p.prepare()
            val pts = if (loop) LOOPS[id]?.takeIf { it.second * 1000 <= p.duration } else null
            points = pts
            p.isLooping = loop && pts == null
            if (pts != null) p.seekTo((pts.first * 1000).toInt())
            p.setVolume(0f, 0f)
            p.setOnCompletionListener { if (!loop && player === p) { player = null; key = ""; p.release() } }
            player = p
            if (!muted) p.start()
            fade(p, 0f, VOLUME, 1200)
        }.onFailure { p.release(); if (player === p) player = null }
        old?.let { fade(it, VOLUME, 0f, 900) { runCatching { it.release() } } }
        main.removeCallbacks(track); main.post(track)
    }

    private fun fade(p: MediaPlayer, from: Float, to: Float, ms: Long, done: () -> Unit = {}) {
        val t0 = System.currentTimeMillis()
        val step = object : Runnable { override fun run() {
            val f = ((System.currentTimeMillis() - t0) / ms.toFloat()).coerceIn(0f, 1f)
            runCatching { val v = from + (to - from) * f; p.setVolume(v, v) }
            if (f < 1f) main.postDelayed(this, 40) else done()
        } }
        main.post(step)
    }

    private fun resume() { if (AppSettings.sound) player?.runCatching { start() } }

    fun stop() {
        key = ""; wanted = null; job?.cancel()
        val p = player; player = null
        if (p != null) fade(p, VOLUME, 0f, 600) { runCatching { p.release() } }
    }

    fun release() { closed = true; main.removeCallbacks(track); job?.cancel(); val p = player; player = null; runCatching { p?.release() } }

    /** Streams once, then it stays on this device (a half-written file is never kept). */
    private fun fetch(id: String): File? {
        val f = File(dir, "$id-$REV.ogg")
        if (f.length() > 0) return f
        return runCatching {
            val req = Request.Builder().url("$SITE/assets/audio/music/$id.ogg?v=$REV").build()
            CLIENT.newCall(req).execute().use { r ->
                if (!r.isSuccessful) return null
                val tmp = File(dir, "$id.part")
                r.body!!.byteStream().use { i -> tmp.outputStream().use { o -> i.copyTo(o) } }
                if (tmp.renameTo(f)) f else null
            }
        }.getOrNull()
    }

    companion object {
        private const val SITE = "https://cardstashy.com"
        private const val REV = "score1" // audio.js MUSIC_REV
        private const val VOLUME = .5f
        private val CLIENT by lazy { OkHttpClient() }
        private val MOOD = mapOf("march" to 'A', "duel" to 'A', "tension" to 'A', "lesson" to 'B', "comic" to 'B', "boss" to 'C')
        private val KIND = mapOf("Boss" to 'C', "Lesson" to 'B')
        private lateinit var loops: Map<String, Pair<Float, Float>>
        val LOOPS: Map<String, Pair<Float, Float>> get() = loops
        fun init(context: Context) {
            if (::loops.isInitialized) return
            loops = runCatching {
                context.assets.open("audio-loops.json").use { JsonParser.parseReader(it.reader()).asJsonObject.entrySet().associate { (k, v) -> k to (v.asJsonArray[0].asFloat to v.asJsonArray[1].asFloat) } }
            }.getOrDefault(emptyMap())
        }
    }
}
