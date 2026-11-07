package dev.cardstashy.nativeplay.ui

import android.os.SystemClock
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.cardstashy.nativeplay.Speed
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Decks
import kotlinx.coroutines.launch

/** Sign in with the CardStashy account (the web's email and password form). Google sign-in comes later. */
@Composable
fun SignInScreen(onDone: () -> Unit, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var email by remember { mutableStateOf(Account.session.value?.email ?: "") }
    var password by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val canSend = !busy && email.contains('@') && password.isNotEmpty()
    fun send() {
        if (!canSend) return
        busy = true; error = null
        val t0 = SystemClock.elapsedRealtime()
        scope.launch {
            val e = Account.signIn(email, password)
            if (e != null) { error = e; busy = false; return@launch }
            Decks.clear(); Decks.load(context)
            Speed.record(Speed.SIGN_IN, SystemClock.elapsedRealtime() - t0)
            busy = false; onDone()
        }
    }
    val field = OutlinedTextFieldDefaults.colors(
        focusedTextColor = Palette.Ink, unfocusedTextColor = Palette.Ink, focusedBorderColor = Palette.Gold, unfocusedBorderColor = Palette.Hairline,
        focusedLabelColor = Palette.Gold, unfocusedLabelColor = Palette.InkSoft, cursorColor = Palette.Gold,
    )
    // Controller: X signs in, as the gold button does (only while it can).
    PadScreen(PadActs(x = if (canSend) PadAct("Sign in") { send() } else null, opaque = true))
    Backdrop("play/playmat-charcoal-table.webp", dim = .55f) {
        Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing).imePadding().padding(16.dp)) {
            Box(Modifier.size(44.dp).clip(CircleShape).clickable(onClick = onBack), contentAlignment = Alignment.Center) { Text("‹", style = Type.Title.copy(fontSize = 28.sp)) }
            Column(Modifier.align(Alignment.Center).widthIn(max = 420.dp).fillMaxWidth().verticalScroll(rememberScrollState()).glass().padding(22.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Sign in", style = Type.Title.copy(fontSize = 24.sp))
                Text("Use your CardStashy account. Your decks come with you.", style = Type.Body)
                OutlinedTextField(email, { email = it }, Modifier.fillMaxWidth(), label = { Text("Email") }, singleLine = true, colors = field,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next))
                OutlinedTextField(password, { password = it }, Modifier.fillMaxWidth(), label = { Text("Password") }, singleLine = true, colors = field,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Go), keyboardActions = KeyboardActions(onGo = { send() }))
                error?.let { Text(it, style = Type.Body.copy(color = Color(0xFFF0A08F))) }
                Row(Modifier.fillMaxWidth().height(48.dp).clip(RoundedCornerShape(24.dp)).background(goldButtonBrush(canSend)).alpha(if (busy) .7f else 1f)
                    .clickable(enabled = canSend) { send() }, horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                    Text(if (busy) "Signing in…" else "Sign in", style = Type.Label.copy(color = Color(0xFF1B140A), fontSize = 15.sp))
                }
                Text("New here or forgot your password? Use cardstashy.com, then sign in here.", style = Type.Body)
            }
        }
    }
}
