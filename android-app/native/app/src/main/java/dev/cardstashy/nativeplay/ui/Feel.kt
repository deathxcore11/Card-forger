package dev.cardstashy.nativeplay.ui

import android.content.Context
import android.os.Build
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.HapticFeedbackConstants
import android.view.View

/**
 * The app's haptics vocabulary, ported line for line from the live app's CardStashyHaptics plugin (feel.js names):
 * one event, one short system effect. Composition primitives where the phone has them (they follow its haptic
 * hardware and the touch-feedback setting), predefined effects next, view feedback last. Never a long buzz.
 */
object Feel {
    private fun vibrator(context: Context): Vibrator? =
        if (Build.VERSION.SDK_INT >= 31) (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
        else @Suppress("DEPRECATION") (context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator)

    private fun supports(v: Vibrator, vararg p: Int) = Build.VERSION.SDK_INT >= 30 && v.areAllPrimitivesSupported(*p)

    private fun effectFor(kind: String, v: Vibrator): VibrationEffect? {
        if (Build.VERSION.SDK_INT >= 30) {
            val CLICK = VibrationEffect.Composition.PRIMITIVE_CLICK; val TICK = VibrationEffect.Composition.PRIMITIVE_TICK
            val LOW = VibrationEffect.Composition.PRIMITIVE_LOW_TICK; val RISE = VibrationEffect.Composition.PRIMITIVE_QUICK_RISE
            val SLOW = VibrationEffect.Composition.PRIMITIVE_SLOW_RISE; val THUD = VibrationEffect.Composition.PRIMITIVE_THUD
            fun c() = VibrationEffect.startComposition()
            when (kind) {
                "pack-tear" -> if (supports(v, LOW, CLICK)) return c().addPrimitive(LOW, .5f).addPrimitive(LOW, .6f, 28).addPrimitive(LOW, .7f, 28).addPrimitive(CLICK, .55f, 40).compose()
                "pack-land" -> if (supports(v, TICK)) return c().addPrimitive(TICK, .35f).compose()
                "pack-reveal" -> if (supports(v, CLICK)) return c().addPrimitive(CLICK, .6f).compose()
                "pack-deal" -> if (supports(v, CLICK)) return c().addPrimitive(CLICK, .45f).compose()
                "pack-rumble" -> {
                    if (supports(v, LOW, THUD)) return c().addPrimitive(LOW, .6f).addPrimitive(LOW, .8f, 18).addPrimitive(THUD, .55f, 18).compose()
                    if (supports(v, LOW)) return c().addPrimitive(LOW, .6f).addPrimitive(LOW, .8f, 18).addPrimitive(LOW, 1f, 18).compose()
                }
                "pack-charge" -> {
                    if (supports(v, SLOW)) return c().addPrimitive(SLOW, .55f).compose()
                    if (supports(v, TICK)) return c().addPrimitive(TICK, .3f).addPrimitive(TICK, .5f, 40).addPrimitive(TICK, .7f, 30).compose()
                }
                "reward-claim" -> if (supports(v, CLICK)) return c().addPrimitive(CLICK, .7f).addPrimitive(CLICK, 1f, 50).compose()
                "reward-big" -> if (supports(v, RISE, CLICK, TICK)) return c().addPrimitive(RISE, .6f).addPrimitive(CLICK, 1f, 30).addPrimitive(TICK, .7f, 70).addPrimitive(TICK, .5f, 60).compose()
                "reward-land" -> if (supports(v, TICK)) return c().addPrimitive(TICK, .5f).compose()
                "pack-tier-1" -> if (supports(v, CLICK)) return c().addPrimitive(CLICK, .7f).compose()
                "pack-tier-2" -> if (supports(v, CLICK)) return c().addPrimitive(CLICK, .6f).addPrimitive(CLICK, .9f, 60).compose()
                "pack-tier-3" -> if (supports(v, TICK, CLICK)) return c().addPrimitive(TICK, .6f).addPrimitive(CLICK, .75f, 40).addPrimitive(CLICK, 1f, 50).compose()
                "pack-tier-4" -> if (supports(v, RISE, CLICK, TICK)) return c().addPrimitive(RISE, .6f).addPrimitive(CLICK, 1f, 30).addPrimitive(TICK, .8f, 80).addPrimitive(TICK, .55f, 60).compose()
                "pack-tier-5" -> {
                    if (supports(v, RISE, CLICK, THUD, TICK)) return c().addPrimitive(RISE, .75f).addPrimitive(CLICK, 1f, 20).addPrimitive(THUD, 1f, 50).addPrimitive(TICK, .8f, 70).addPrimitive(TICK, .6f, 60).addPrimitive(TICK, .4f, 60).compose()
                    if (supports(v, RISE, CLICK, TICK)) return c().addPrimitive(RISE, .75f).addPrimitive(CLICK, 1f, 20).addPrimitive(CLICK, 1f, 60).addPrimitive(TICK, .7f, 70).addPrimitive(TICK, .45f, 60).compose()
                }
            }
        }
        if (Build.VERSION.SDK_INT >= 29) return VibrationEffect.createPredefined(when (kind) {
            "pack-land", "pack-charge", "reward-land", "tick" -> VibrationEffect.EFFECT_TICK
            "pack-tier-3", "pack-tier-4", "pack-tier-5", "reward-claim", "reward-big", "success" -> VibrationEffect.EFFECT_DOUBLE_CLICK
            "pack-tier-2", "pack-rumble", "warn", "error" -> VibrationEffect.EFFECT_HEAVY_CLICK
            else -> VibrationEffect.EFFECT_CLICK
        })
        return null
    }

    private fun viewFeedback(kind: String) = when (kind) {
        "pack-land", "tick" -> HapticFeedbackConstants.CLOCK_TICK
        "pack-reveal", "pack-deal", "pack-tier-1", "tap" -> HapticFeedbackConstants.VIRTUAL_KEY
        else -> HapticFeedbackConstants.LONG_PRESS
    }

    fun perform(view: View, kind: String) {
        if (!AppSettings.haptics) return
        try {
            val v = vibrator(view.context)
            val effect = if (v != null && v.hasVibrator()) effectFor(kind, v) else null
            if (effect != null && v != null) {
                if (Build.VERSION.SDK_INT >= 33) v.vibrate(effect, VibrationAttributes.createForUsage(VibrationAttributes.USAGE_TOUCH)) else @Suppress("DEPRECATION") v.vibrate(effect)
            } else view.performHapticFeedback(viewFeedback(kind))
        } catch (_: Exception) { }
    }

    /** Stops anything still playing (a pack closed mid-sequence). */
    fun cancel(context: Context) { try { vibrator(context)?.cancel() } catch (_: Exception) { } }
}
