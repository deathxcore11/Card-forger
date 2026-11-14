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
 * seam sits inside continuous audio. Quick Play, Practice and matches with friends play the two songs of the map on the table
 * (specs/stage-music-brief.md): A, then B after one full loop, and back; B while anyone is at 5 life or less. A Story battle
 * plays its act's own songs; the result gets its short sting and then silence. Silent with "Sound & music" off and in the background.
 * As loud as Settings' Music volume says (100% is the loudness it always had), and it follows the setting while a song plays.
 */
class TableMusic(private val context: Context, private val scope: CoroutineScope, private val story: StoryMusic? = null,
    /** The id of the map drawn on this table (the same one PlaymatScene is given). */
    private val stage: String? = null) {
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
    /** Fades running now, and the loudness last given to the song that plays: the setting is followed between fades. */
    private var fades = 0
    private var loud = -1f
    @Volatile var muted = false
        set(on) { field = on; main.post { if (on) player?.runCatching { if (isPlaying) pause() } else resume() } }

    private val track: Runnable = object : Runnable {
        override fun run() {
            val p = player; val pts = points
            if (p != null && pts != null && key.endsWith("|loop")) runCatching { if (p.isPlaying && p.currentPosition >= (pts.second * 1000).toInt() - 90) p.seekTo((pts.first * 1000).toInt()) }
            // Music volume moved in Settings or the match menu: the song follows at once.
            val want = level(AppSettings.musicVolume)
            if (p != null && fades == 0 && want != loud) { loud = want; runCatching { p.setVolume(want, want) } }
            if (!closed) main.postDelayed(this, 40)
        }
    }

    // Story: A the battle song, B the lighter song, C the boss song; a boss fight goes from C to A. Any other match: its map's A and B.
    private val pool: List<String>? = if (story != null) storySongs(story, LOOPS.keys) else stageSongs(stage, LOOPS.keys)
    private var at = 0; private var since = 0L
    private var playing = ""

    fun update(b: MatchState) {
        if (closed || ending) return
        if (b.finished) {
            ending = true
            val win = b.winnerPlayerId == b.viewer
            if (b.draw || b.winnerPlayerId == null) stop() else play(if (win) "MUS-TBL-06" else "MUS-TBL-07", loop = false)
            return
        }
        val low = b.players.any { it.life in 1..5 }
        val id = if (pool != null) {
            val (i, t) = turnOver(pool, at, since, System.currentTimeMillis(), low && story == null, LOOPS)
            at = i; since = t
            pool[at % pool.size]
        // Only when a map or an act has no songs listed: the old table score.
        } else if (low) "MUS-TBL-05" else if (b.turn <= 8) "MUS-TBL-03" else "MUS-TBL-04"
        if (id != playing) { playing = id; runCatching { android.util.Log.i("TableMusic", "song $id (map ${stage ?: "-"})") } }
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
            fade(p, 0f, 1f, 1200)
        }.onFailure { p.release(); if (player === p) player = null }
        old?.let { fade(it, 1f, 0f, 900) { runCatching { it.release() } } }
        main.removeCallbacks(track); main.post(track)
    }

    /** [from] and [to] are parts of the music volume (0 silent, 1 as loud as the setting says). */
    private fun fade(p: MediaPlayer, from: Float, to: Float, ms: Long, done: () -> Unit = {}) {
        val t0 = System.currentTimeMillis()
        fades++
        val step = object : Runnable { override fun run() {
            val f = ((System.currentTimeMillis() - t0) / ms.toFloat()).coerceIn(0f, 1f)
            runCatching { val v = (from + (to - from) * f) * level(AppSettings.musicVolume); p.setVolume(v, v); if (p === player) loud = v }
            if (f < 1f) main.postDelayed(this, 40) else { fades--; done() }
        } }
        main.post(step)
    }

    private fun resume() { if (AppSettings.sound) player?.runCatching { start() } }

    fun stop() {
        key = ""; wanted = null; job?.cancel()
        val p = player; player = null
        if (p != null) fade(p, 1f, 0f, 600) { runCatching { p.release() } }
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
        /** The loudness a song is given at Settings' Music volume [percent]: 100 is the loudness the music always had. */
        internal fun level(percent: Int): Float = VOLUME * percent.coerceIn(0, 100) / 100f
        private val CLIENT by lazy { OkHttpClient() }
        private val MOOD = mapOf("march" to 'A', "duel" to 'A', "tension" to 'A', "lesson" to 'B', "comic" to 'B', "boss" to 'C')
        private val KIND = mapOf("Boss" to 'C', "Lesson" to 'B')
        /** A map's two songs: moonlit-courtyard gives MUS-MAT-MOONLIT-COURTYARD-A and -B. Null when the map has none listed. */
        fun stageSongs(stage: String?, known: Set<String>): List<String>? =
            stage?.let { id -> listOf("A", "B").map { "MUS-MAT-${id.uppercase()}-$it" }.filter { it in known } }?.takeIf { it.isNotEmpty() }
        /** A Story battle's songs, as before: its act's A and B, or C then A for a boss. */
        fun storySongs(s: StoryMusic, known: Set<String>): List<String>? {
            val n = s.act.toString().padStart(2, '0')
            val first = MOOD[s.mood] ?: KIND[s.kind] ?: 'A'
            return mapOf('A' to "AB", 'B' to "BA", 'C' to "CA")[first].orEmpty().map { "MUS-ST-$n$it" }.filter { it in known }.takeIf { it.isNotEmpty() }
        }
        /**
         * Which song of [songs] plays at [now]: the place in the list and when that song began. The first call starts the first
         * song; after one full loop of a song the next one takes over. [holdB] (a map's songs, someone at 5 life or less): B
         * comes in at once and stays while it lasts.
         */
        fun turnOver(songs: List<String>, at: Int, since: Long, now: Long, holdB: Boolean, loops: Map<String, Pair<Float, Float>>): Pair<Int, Long> {
            if (holdB && songs.size > 1) return if (at % songs.size == 1 && since != 0L) at to since else (at - at % songs.size + 1) to now
            if (since == 0L) return at to now
            val span = loops[songs[at % songs.size]]?.let { ((it.second - it.first) * 1000).toLong() } ?: 240_000L
            return if (now - since >= span) (at + 1) to now else at to since
        }
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
