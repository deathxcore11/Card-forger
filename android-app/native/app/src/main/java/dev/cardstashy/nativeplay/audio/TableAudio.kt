package dev.cardstashy.nativeplay.audio

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import dev.cardstashy.nativeplay.engine.MatchState

/** The table sounds of play-table-audio.js, played from the same files on board changes. No music yet. */
class TableAudio(context: Context) {
    private val pool = SoundPool.Builder().setMaxStreams(8)
        .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()).build()
    private val ids = HashMap<String, Int>()
    private var lowSeen = false
    private var ended = false

    init {
        for (name in context.assets.list("sfx").orEmpty()) {
            if (!name.endsWith(".ogg")) continue
            context.assets.openFd("sfx/$name").use { ids[name.removeSuffix(".ogg")] = pool.load(it, 1) }
        }
    }

    private fun castCue(cost: String): String {
        val colours = Regex("[WUBRG]").findAll(cost.replace(Regex("\\{[^}]*\\d[^}]*\\}"), "")).map { it.value }.toSet()
        return when (colours.size) { 0 -> "CAST-C"; 1 -> "CAST-" + colours.first(); else -> "CAST-M" }
    }

    /** Silent while the app is in the background; any sound still ringing stops at once. */
    var muted = false
        set(on) { field = on; if (on) pool.autoPause() else pool.autoResume() }

    /** The match sound pass: old ids go to the 2026 cues, with its rules (draw takes, pitch variation, one big hit at a time). */
    private val router = Cues.Router({ ids.containsKey(it) }, { android.os.SystemClock.uptimeMillis() })
    private var bigStream = 0

    fun play(id: String, volume: Float = 1f, rate: Float = 1f) {
        if (muted || !dev.cardstashy.nativeplay.ui.AppSettings.sound) return
        val p = router.route(id, volume, rate) ?: return
        if (p.cuts && bigStream != 0) pool.stop(bigStream)
        val stream = ids[p.name]?.let { pool.play(it, p.volume, p.volume, if (p.name in Cues.BIG) 2 else 1, 0, p.rate) } ?: return
        if (p.name in Cues.BIG) bigStream = stream
    }

    /** While the board's effects run, they play block, clash and face-hit cues on their own frames (Battlefield.cues). */
    var fxCues = false

    fun release() = pool.release()

    /** The same triggers as play-table-audio.js update(), from the previous shown board to the next. */
    fun update(a: MatchState?, b: MatchState) {
        if (b.finished) {
            ended = true // the result plate plays QP-017/018/019 as it rises
            return
        }
        if (a == null) return
        if (b.activePlayer != a.activePlayer && b.turn > 0) play(if (b.activePlayer == b.viewer) "TT-001" else "TT-002")
        else if (b.phase != a.phase && b.turn > 0) play("TT-003", .35f)
        val was = HashMap<Int, dev.cardstashy.nativeplay.engine.Card>()
        for (p in a.players) for (c in p.hand + p.battlefield + p.graveyard + p.exile) was[c.id] = c
        val handIn = b.me.hand.count { was[it.id]?.zone != "Hand" }
        if (handIn in 1..4) play("CARD-001") // a whole new hand is dealt by the fan, one QP-012 per card
        if (b.cpu.handCount > a.cpu.handCount && b.turn > 0) play("CARD-002", .5f)
        val field = b.players.flatMap { it.battlefield }
        if (field.any { it.tapped && it.isLand && was[it.id]?.zone == "Battlefield" && was[it.id]?.tapped == false && !it.attacking }) play("CARD-006", .7f)
        val old = a.stack.map { it.id }.toSet()
        val fresh = b.stack.filter { it.id !in old }
        // A spell cast from hand sounds its colour (Randall 10 Nov, "like before but better"): one colour its own cue, two or more
        // CAST-M, none CAST-C; CARD-008 when the cue isn't there. Triggers and abilities keep CARD-014.
        // A spell that waited for targets or a hand payment left the hand a board earlier (or is the CPU's, whose hand is hidden):
        // Forge's own Hand -> Stack move says it was cast.
        val fromHand = if (fresh.isEmpty()) emptySet() else b.events.filter { it.type == "zone" && it.from == "Hand" && it.to == "Stack" }.mapNotNull { it.card?.id }.toSet()
        val cast = fresh.firstOrNull { s -> s.source?.let { was[it.id]?.zone == "Hand" || it.id in fromHand } == true }?.source
        if (cast != null) { val cue = castCue(cast.manaCost); play(if (ids.containsKey(cue)) cue else "CARD-008") }
        else if (fresh.isNotEmpty()) play("CARD-014")
        val arrived = field.filter { was[it.id]?.zone != "Battlefield" }
        if (arrived.any { it.isLand }) play("CARD-005")
        if (arrived.any { !it.isLand && !was.containsKey(it.id) }) play("CARD-025") else if (arrived.any { !it.isLand }) play("CARD-010")
        if (field.any { it.attacking && was[it.id]?.attacking == false }) play("CMB-002")
        val combat = b.phase?.contains("DAMAGE") == true || a.phase?.contains("DAMAGE") == true
        if (!fxCues && field.any { it.blockingIds.size > (was[it.id]?.blockingIds?.size ?: 0) }) play("CMB-003")
        // Damage, life loss to a burn, deaths and counters sound on their own frames on the board (director step 3) when effects run.
        if (!fxCues && field.any { it.damage > (was[it.id]?.damage ?: 0) }) play("CMB-004")
        for (p in b.players) { val q = a.players.firstOrNull { it.id == p.id } ?: continue
            if (p.life < q.life) { if (!fxCues) play(if (combat) "CMB-005" else "CMB-018", if (q.life - p.life >= 5) 1f else .8f) } else if (p.life > q.life) play("CMB-007") }
        val now = HashMap<Int, dev.cardstashy.nativeplay.engine.Card>()
        for (p in b.players) for (c in p.hand + p.battlefield + p.graveyard + p.exile) now[c.id] = c
        val left = a.players.flatMap { it.battlefield }.filter { now[it.id]?.zone != "Battlefield" }
        if (!fxCues) { if (left.any { it.isCreature && (now[it.id] == null || now[it.id]?.zone == "Graveyard") }) play("CMB-009")
        else if (left.any { now[it.id]?.zone == "Graveyard" }) play("CARD-018") }
        if (left.any { now[it.id]?.zone == "Exile" }) play("CARD-019")
        if (left.any { now[it.id]?.zone == "Hand" }) play("CARD-020")
        if (!lowSeen && b.players.any { it.life in 1..5 }) { lowSeen = true; play("CMB-019") }
    }
}
