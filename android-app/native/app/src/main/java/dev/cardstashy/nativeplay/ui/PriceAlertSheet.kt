package dev.cardstashy.nativeplay.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.collection.CollectionEngine
import kotlinx.coroutines.launch

/**
 * pricehist.js alertSheet (app.js A.priceAlert), drawn as the gap-screens preview: the card and its price now, its price line with the
 * two marks, "Tell me when it drops below" / "or rises above" (the alert's own numbers, else 15 % under and 25 % over), the site's two
 * error lines, "Price alert active" when one is set, Save alert and Remove alert. Saved in the Collection engine with the site's own
 * code (Collection.alertSave / alertClear), per account; [CollectionWrites.AlertOpen.saved] redraws the page under it.
 */
@Composable
internal fun PriceAlertSheet(a: CollectionWrites.AlertOpen, backdrop: GraphicsLayer?, onClose: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val model by produceState<JsonObject?>(null, a.id) { value = PriceAlerts.open(context, a) ?: run { onClose(); null } }
    val m = model ?: return
    var below by remember(m) { mutableStateOf(m.str("below")) }
    var above by remember(m) { mutableStateOf(m.str("above")) }
    var error by remember(m) { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    val exists = m.get("exists")?.asBoolean == true
    // Android's notification permission, asked once on the first Save alert while the daily check is on (gap audit H2 step 4).
    val ask = androidx.activity.compose.rememberLauncherForActivityResult(androidx.activity.result.contract.ActivityResultContracts.RequestPermission()) { }
    fun askOnce() {
        val p = context.getSharedPreferences("play", android.content.Context.MODE_PRIVATE)
        if (android.os.Build.VERSION.SDK_INT < 33 || p.getBoolean(dev.cardstashy.nativeplay.collection.PriceAlertDaily.ASKED, false)) return
        p.edit().putBoolean(dev.cardstashy.nativeplay.collection.PriceAlertDaily.ASKED, true).apply()
        if (context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED)
            runCatching { ask.launch(android.Manifest.permission.POST_NOTIFICATIONS) }
    }
    fun save() {
        if (busy) return
        busy = true
        scope.launch {
            val r = CollectionEngine.alertSave(a.game, a.cardId, a.name, below, above)
            busy = false
            r.get("error")?.asString?.let { error = it; return@launch }
            val daily = AppSettings.priceAlertDaily
            // The site's toast says it checks only while open; with the daily check on, the app's own words.
            (if (daily) "Alert saved. Checked once a day, with a notification when it crosses your price." else r.get("toast")?.asString)?.let { CollectionWrites.show(it) }
            if (daily) askOnce()
            dev.cardstashy.nativeplay.collection.PriceAlertDaily.sync(context, CollectionEngine.alertList().size())
            CollectionWrites.alertsChanged.value++; a.saved(); onClose()
        }
    }
    fun remove() {
        if (busy) return
        busy = true
        scope.launch {
            CollectionEngine.alertClear(a.game, a.cardId).get("toast")?.asString?.let { CollectionWrites.show(it) }
            dev.cardstashy.nativeplay.collection.PriceAlertDaily.sync(context, CollectionEngine.alertList().size())
            busy = false; CollectionWrites.alertsChanged.value++; a.saved(); onClose()
        }
    }
    SiteSheet("Price alert", backdrop, onClose = onClose) { _ ->
        PriceAlertBody(m, below, above, error, exists, onBelow = { below = it; error = "" }, onAbove = { above = it; error = "" })
        Spacer(Modifier.height(10.dp))
        // The preview's line: the daily check (the same switch as Settings › Price alert notifications).
        Row(Modifier.fillMaxWidth().clickable { AppSettings.set("priceAlertDaily", !AppSettings.priceAlertDaily) }, verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            androidx.compose.material3.Checkbox(AppSettings.priceAlertDaily, { AppSettings.set("priceAlertDaily", it) },
                colors = androidx.compose.material3.CheckboxDefaults.colors(checkedColor = Site.Gold, checkmarkColor = Color(0xFF1A1408)))
            Text("Send a phone notification, even when the app is closed", Modifier.weight(1f), style = cssType(12.5f, 400, 18f, AlertMute))
        }
        Spacer(Modifier.height(8.dp))
        FormGold("Save alert", enabled = !busy, modifier = Modifier.fillMaxWidth()) { save() }
        if (exists) { Spacer(Modifier.height(10.dp)); SiteGhost("Remove alert", Modifier.fillMaxWidth()) { remove() } }
    }
    PadScreen(PadActs(x = PadAct("Save alert") { save() }))
}

/** The sheet's body without its buttons (for the picture test too). */
@Composable
internal fun PriceAlertBody(m: JsonObject, below: String, above: String, error: String, exists: Boolean, onBelow: (String) -> Unit, onAbove: (String) -> Unit) {
    val price = m.get("price")?.takeIf { it.isJsonPrimitive }?.asDouble
    val series = m.getAsJsonArray("series")?.mapNotNull { p -> p.takeIf { it.isJsonArray }?.asJsonArray?.let { it[1].asFloat } }.orEmpty()
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color(0xFF151821)).border(1.dp, Color(0xFF2B3040), RoundedCornerShape(14.dp)).padding(12.dp)) {
        Row(Modifier.fillMaxWidth()) {
            Text(m.str("name"), Modifier.weight(1f), style = cssType(15f, 700, 21.75f))
            if (price != null) Text("$" + "%.2f".format(price), style = cssType(15f, 700, 21.75f, Site.Gold))
        }
        if (series.size >= 2) {
            Spacer(Modifier.height(6.dp))
            AlertLine(series, below.toFloatOrNull()?.takeIf { it > 0 }, above.toFloatOrNull()?.takeIf { it > 0 })
            Spacer(Modifier.height(4.dp))
            Text("Green line: your low mark. Orange line: your high mark.", style = cssType(12.5f, 400, 18f, AlertMute))
        } else {
            Spacer(Modifier.height(4.dp))
            Text("No earlier dated prices are stored for this version.", style = cssType(12.5f, 400, 18f, AlertMute))
        }
    }
    Spacer(Modifier.height(12.dp))
    FormLabeled("Tell me when it drops below", Modifier.fillMaxWidth()) {
        FormInput(below, onBelow, cssType(18f, 700, 24f), placeholder = m.str("hintBelow"), desc = "Tell me when it drops below", keyboard = KeyboardType.Decimal) }
    Spacer(Modifier.height(10.dp))
    FormLabeled("or rises above", Modifier.fillMaxWidth()) {
        FormInput(above, onAbove, cssType(18f, 700, 24f), placeholder = m.str("hintAbove"), desc = "or rises above", keyboard = KeyboardType.Decimal) }
    if (error.isNotEmpty()) { Spacer(Modifier.height(8.dp)); Text(error, style = cssType(13f, 600, 18.85f, Color(0xFFFFB86B))) }
    if (exists) {
        Spacer(Modifier.height(10.dp))
        Column(Modifier.fillMaxWidth().border(1.dp, Site.Gold, RoundedCornerShape(12.dp)).padding(horizontal = 12.dp, vertical = 10.dp)) {
            Text("Price alert active", style = cssType(14f, 700, 20f))
            Text(PriceAlerts.summary(m.str("below"), m.str("above")), style = cssType(12.5f, 400, 18f, AlertMute))
        }
    }
}

/** The card's price history as a gold line over a soft fill, the low mark dashed green and the high mark dashed orange, a dot on today. */
@Composable
private fun AlertLine(values: List<Float>, low: Float?, high: Float?) {
    val gold = Site.Gold
    Canvas(Modifier.fillMaxWidth().height(74.dp).semantics { contentDescription = "Price line with your alert marks" }) {
        val all = values + listOfNotNull(low, high)
        val lo = all.min(); val hi = all.max(); val span = (hi - lo).takeIf { it > 0f } ?: 1f
        val pad = 6.dp.toPx()
        fun y(v: Float) = pad + (1f - (v - lo) / span) * (size.height - pad * 2)
        fun x(i: Int) = i * size.width / (values.size - 1)
        val line = Path().apply { values.forEachIndexed { i, v -> if (i == 0) moveTo(x(i), y(v)) else lineTo(x(i), y(v)) } }
        val fill = Path().apply { addPath(line); lineTo(size.width, size.height); lineTo(0f, size.height); close() }
        drawPath(fill, Brush.verticalGradient(listOf(gold.copy(alpha = .22f), gold.copy(alpha = 0f))))
        drawPath(line, gold, style = Stroke(2.dp.toPx()))
        val dash = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 4.dp.toPx()))
        low?.let { drawLine(Color(0xFF6FD3A0), Offset(0f, y(it)), Offset(size.width, y(it)), 1.dp.toPx(), pathEffect = dash) }
        high?.let { drawLine(Color(0xFFFFB86B), Offset(0f, y(it)), Offset(size.width, y(it)), 1.dp.toPx(), pathEffect = dash) }
        drawCircle(Color(0xFFF2D496), 4.dp.toPx(), Offset(size.width, y(values.last())))
    }
}

private val AlertMute = Color(0xFF9AA2B1)

private fun JsonObject.str(k: String) = get(k)?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()

/** Opening the sheet, and the words the site writes for an alert (pricehist.js alertStatus). */
internal object PriceAlerts {
    suspend fun open(context: android.content.Context, a: CollectionWrites.AlertOpen): JsonObject? {
        val s = Account.session.value
        if (!ensureCollection(context.applicationContext, s?.userId, s != null, dev.cardstashy.nativeplay.account.Decks.fullRevision.value))
            return null.also { CollectionWrites.show("Your collection is still loading. Try again in a moment.") }
        return CollectionEngine.alertOpen(a.game, a.cardId, a.name)
    }
    /** alertStatus's line: "Below $5.00 · Above $20.00". */
    fun summary(below: String, above: String): String {
        val b = below.toDoubleOrNull()?.takeIf { it > 0 }; val u = above.toDoubleOrNull()?.takeIf { it > 0 }
        return listOfNotNull(b?.let { "Below $" + "%.2f".format(it) }, u?.let { "Above $" + "%.2f".format(it) }).joinToString(" · ")
    }
}
