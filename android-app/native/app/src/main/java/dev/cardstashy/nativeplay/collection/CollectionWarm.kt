package dev.cardstashy.nativeplay.collection

import android.content.Context
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Decks
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Collection made ready while the app sits on Play's Home, so its first open is the site's instant paint (the site's code is already
 * parsed in a browser tab; here the engine is started once, a moment after launch): the bundle evaluated, this device's copy of the
 * account loaded, today's Card of the Day and set fetched, and Home and My decks drawn and kept (LastSeen). Only for an account that
 * has opened Collection on this device before; nothing heavier than that, and the engine's thread runs a step behind the screen
 * ([CollectionEngine.nice]) until a Collection screen asks for it ([wanted]).
 */
object CollectionWarm {
    @Volatile private var started = false
    /** A Collection screen asked for the engine: the warm-up gives its thread back at normal priority and stops after its step. */
    @Volatile var wanted = false
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun start(context: Context, afterMs: Long = 1800) {
        if (started) return
        started = true
        val app = context.applicationContext
        scope.launch {
            delay(afterMs)
            runCatching { warm(app) }
            runCatching { CollectionEngine.nice(false) }
        }
    }

    private suspend fun warm(app: Context) {
        val user = Account.session.value?.userId ?: return
        if (!dev.cardstashy.nativeplay.ui.LastSeen.seenBefore(app, user)) return
        CollectionEngine.init(app)
        CollectionEngine.nice(true)
        if (wanted) return
        CollectionEngine.warm()
        if (wanted) return
        val ui = dev.cardstashy.nativeplay.ui.collectionWarmGame(app)
        if (!dev.cardstashy.nativeplay.ui.ensureCollection(app, user, true, Decks.fullRevision.value, warming = true)) return
        if (wanted) return
        CollectionEngine.today(ui)
        if (wanted || dev.cardstashy.nativeplay.Updater.inGame) return
        dev.cardstashy.nativeplay.ui.warmHome(user, ui)
        if (wanted || dev.cardstashy.nativeplay.Updater.inGame) return
        dev.cardstashy.nativeplay.ui.warmDecks(user, ui)
        withContext(kotlinx.coroutines.NonCancellable) { dev.cardstashy.nativeplay.ui.keepCatalog(app) }
    }
}
