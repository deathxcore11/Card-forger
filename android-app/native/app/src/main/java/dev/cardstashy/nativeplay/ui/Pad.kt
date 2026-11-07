package dev.cardstashy.nativeplay.ui

import android.content.Context
import android.hardware.input.InputManager
import android.view.InputDevice
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * Is a game controller here? A handheld's built-in pad (AYN Thor, Retroid, Odin) or one connected by
 * Bluetooth or USB. Randall 4 Nov 18:15Z: controller hints show only when one is, and never get in the way;
 * a phone with nothing connected sees nothing new.
 */
object Pad {
    private val _connected = MutableStateFlow(false); val connected: StateFlow<Boolean> = _connected

    private fun isPad(d: InputDevice?) = d != null && !d.isVirtual &&
        (d.sources and InputDevice.SOURCE_GAMEPAD == InputDevice.SOURCE_GAMEPAD || d.sources and InputDevice.SOURCE_JOYSTICK == InputDevice.SOURCE_JOYSTICK)

    fun scan() { val on = runCatching { InputDevice.getDeviceIds().any { isPad(InputDevice.getDevice(it)) } }.getOrDefault(false); if (_connected.value != on) _connected.value = on }

    /** A pad key or stick arrived: it is here, whatever the device list said. */
    fun used() { if (!_connected.value) _connected.value = true }

    fun watch(context: Context) {
        val im = context.getSystemService(InputManager::class.java) ?: return
        // Off the main thread, and once per burst: a Fold waking or folding sends a run of device changes (0.4.40's stall report caught
        // main inside scan() on a resume), each scan asking the system about every input device.
        val ht = android.os.HandlerThread("pad-watch", android.os.Process.THREAD_PRIORITY_BACKGROUND).apply { start() }
        val h = android.os.Handler(ht.looper)
        val again = Runnable { scan() }
        fun soon() { h.removeCallbacks(again); h.postDelayed(again, 250) }
        h.post(again)
        im.registerInputDeviceListener(object : InputManager.InputDeviceListener {
            override fun onInputDeviceAdded(id: Int) = soon()
            override fun onInputDeviceRemoved(id: Int) = soon()
            override fun onInputDeviceChanged(id: Int) = soon()
        }, h)
    }
}

/**
 * The only controller hint: a small glass pill, bottom right, "A Select · B Back", for a few seconds
 * when a controller appears, then gone. The gold focus ring does the rest.
 */
@Composable
fun BoxScope.PadHintHost() {
    val on by Pad.connected.collectAsState()
    var show by remember { mutableStateOf(false) }
    LaunchedEffect(on) { if (on) { show = true; delay(6000) }; show = false }
    AnimatedVisibility(show, Modifier.align(Alignment.BottomEnd).windowInsetsPadding(WindowInsets.navigationBars).padding(end = 16.dp, bottom = 16.dp),
        enter = fadeIn(), exit = fadeOut()) {
        val shape = RoundedCornerShape(999.dp)
        Row(Modifier.clip(shape).background(Color(0xD9101217)).border(1.dp, Color(0x40D6AD64), shape).padding(horizontal = 12.dp, vertical = 7.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Key("A", "Select"); Key("B", "Back")
        }
    }
}

@Composable
private fun Key(button: String, label: String) = Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
    Box(Modifier.size(20.dp).clip(CircleShape).border(1.5.dp, PadFocus.Gold, CircleShape), contentAlignment = Alignment.Center) {
        androidx.compose.material3.Text(button, style = TextStyle(fontWeight = FontWeight.Bold, fontSize = 11.sp, color = PadFocus.Gold))
    }
    androidx.compose.material3.Text(label, style = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = Color(0xFFE6E1D6)))
}

/** For the screenshot tests: the hint host called from outside the activity. */
object PadHintHostScope { @Composable fun BoxScope.hint() = PadHintHost() }
