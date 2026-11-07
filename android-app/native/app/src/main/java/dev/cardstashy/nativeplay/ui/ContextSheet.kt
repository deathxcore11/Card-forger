package dev.cardstashy.nativeplay.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * The hold menu, card-actions.js contextHeader + contextAction: a header with the art, its kind, name and one
 * meta line, then groups of icon rows (label, optional hint). Play and Collection each fill it with their own
 * actions (standing rule, 3 Nov 19:29Z); the web's Play opens the card view on hold, the native Play menu
 * shortcuts the same actions that card view and the deck editor already have.
 */
data class ContextAction(val icon: ImageVector, val label: String, val hint: String? = null, val danger: Boolean = false, val onClick: () -> Unit)

@Composable
fun ContextSheet(kind: String, name: String, meta: String?, art: String?, groups: List<List<ContextAction>>, onClose: () -> Unit) {
    BackHandler(onBack = onClose)
    val view = LocalView.current
    androidx.compose.runtime.LaunchedEffect(Unit) { Feel.perform(view, "tap") }
    PadScreen(remember { PadActs(b = "Close", opaque = true) })
    // The scrim and the card's tap-catcher are touch-only: the d-pad skips them (no ring, nothing to press).
    Box(Modifier.fillMaxSize().background(Color(0xB3000000)).focusProperties { canFocus = false }.clickable(remember { MutableInteractionSource() }, null, onClick = onClose), contentAlignment = Alignment.Center) {
        Column(Modifier.windowInsetsPadding(WindowInsets.safeDrawing).padding(16.dp).widthIn(max = 460.dp).fillMaxWidth()
            .clip(RoundedCornerShape(24.dp)).background(Site.Surface).border(1.dp, Site.Line, RoundedCornerShape(24.dp))
            .focusProperties { canFocus = false }.clickable(remember { MutableInteractionSource() }, null) {}.verticalScroll(rememberScrollState()).padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (art != null) heroPainter(homeArt(art))?.let { p -> androidx.compose.foundation.Image(p, null, contentScale = ContentScale.Crop,
                    modifier = Modifier.size(44.dp, 60.dp).clip(RoundedCornerShape(6.dp))) }
                if (art != null) Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text(kind.uppercase(), style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 11.sp, letterSpacing = 1.3.sp, color = Site.Muted))
                    Text(name, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Bold, fontSize = 19.sp, lineHeight = 24.sp, color = Site.Text), maxLines = 2, overflow = TextOverflow.Ellipsis)
                    if (!meta.isNullOrBlank()) Text(meta, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Medium, fontSize = 13.sp, color = Site.Muted), maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Box(Modifier.size(40.dp).clip(RoundedCornerShape(20.dp)).background(Site.Surface2).clickable(onClick = onClose), contentAlignment = Alignment.Center) { Icon(SiteIcons.Close, 18.dp, Site.Text) }
            }
            groups.filter { it.isNotEmpty() }.forEach { g ->
                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Site.Surface2).border(1.dp, Site.Line, RoundedCornerShape(18.dp)).padding(horizontal = 14.dp)) {
                    g.forEachIndexed { i, a ->
                        if (i > 0) Box(Modifier.fillMaxWidth().height(1.dp).background(Site.Line))
                        Row(Modifier.fillMaxWidth().heightIn(min = 54.dp).clickable(onClick = a.onClick).padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(a.icon, 20.dp, if (a.danger) Color(0xFFF08A7E) else Site.Text)
                            Spacer(Modifier.width(14.dp))
                            Column {
                                Text(a.label, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = if (a.danger) Color(0xFFF08A7E) else Site.Text))
                                a.hint?.let { Text(it, style = TextStyle(fontFamily = Site.Manrope, fontWeight = FontWeight.Medium, fontSize = 12.5.sp, color = Site.Muted)) }
                            }
                        }
                    }
                }
            }
        }
    }
}

/** app.js quickArtwork: "Use artwork as…" with Avatar and Profile header (Collection banner stays a Collection-mode choice). */
@Composable
fun UseArtworkAs(card: ArtPick.Card, onClose: () -> Unit) = ContextSheet("Use artwork as…", card.name, card.set, card.thumb, listOf(listOf(
    ContextAction(SiteIcons.Profile, "Avatar") { onClose(); ArtPick.open("avatar", card) },
    ContextAction(SiteIcons.Paint, "Profile header") { onClose(); ArtPick.open("header", card) })), onClose)
