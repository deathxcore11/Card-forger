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
                // Living table F9. The winning hit: one heavy thud, then a long fade of low ticks. A piece off a loyalty shield: one soft pulse.
                "table-win" -> if (supports(v, THUD, LOW)) return c().addPrimitive(THUD, 1f).addPrimitive(LOW, .8f, 90).addPrimitive(LOW, .6f, 90).addPrimitive(LOW, .45f, 100).addPrimitive(LOW, .3f, 110).addPrimitive(LOW, .18f, 120).compose()
                "table-soft" -> { if (supports(v, LOW)) return c().addPrimitive(LOW, .35f).compose(); if (supports(v, TICK)) return c().addPrimitive(TICK, .25f).compose() }
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
        // The winning hit where the phone has no primitives: a strong pulse and four weaker ones.
        if (kind == "table-win" && v.hasAmplitudeControl()) return VibrationEffect.createWaveform(longArrayOf(0, 60, 60, 50, 80, 50, 100, 50, 120, 50), intArrayOf(0, 255, 0, 170, 0, 110, 0, 60, 0, 30), -1)
        if (Build.VERSION.SDK_INT >= 29) return VibrationEffect.createPredefined(when (kind) {
            "pack-land", "pack-charge", "reward-land", "tick", "table-soft" -> VibrationEffect.EFFECT_TICK
            "pack-tier-3", "pack-tier-4", "pack-tier-5", "reward-claim", "reward-big", "success" -> VibrationEffect.EFFECT_DOUBLE_CLICK
            "pack-tier-2", "pack-rumble", "warn", "error", "table-win" -> VibrationEffect.EFFECT_HEAVY_CLICK
            else -> VibrationEffect.EFFECT_CLICK
        })
        return null
    }

    private fun viewFeedback(kind: String) = when (kind) {
        "pack-land", "tick", "table-soft" -> HapticFeedbackConstants.CLOCK_TICK
        "pack-reveal", "pack-deal", "pack-tier-1", "tap" -> HapticFeedbackConstants.VIRTUAL_KEY
        else -> HapticFeedbackConstants.LONG_PRESS
    }

    /**
     * A controller's own rumble (Android 12 and up), for a handheld with no vibration motor of its own: one pulse on every
     * motor of every connected game controller that has any. False when there is none, so the caller can fall back.
     */
    private fun padRumble(kind: String): Boolean {
        if (Build.VERSION.SDK_INT < 31) return false
        val (ms, strength) = when (kind) { "table-win" -> 180L to 255; "pack-rumble" -> 110L to 220; "pack-reveal" -> 50L to 150; "table-soft" -> 20L to 60; else -> 25L to 90 }
        var any = false
        for (id in android.view.InputDevice.getDeviceIds()) { val d = android.view.InputDevice.getDevice(id) ?: continue
            if (d.isVirtual || d.sources and android.view.InputDevice.SOURCE_GAMEPAD != android.view.InputDevice.SOURCE_GAMEPAD) continue
            val vm = d.vibratorManager
            for (m in vm.vibratorIds) { vm.getVibrator(m).vibrate(VibrationEffect.createOneShot(ms, strength)); any = true } }
        return any
    }

    /** [own]: the caller has its own setting (the match's "Match vibration"), so "Tap vibration" does not gate it. */
    fun perform(view: View, kind: String, own: Boolean = false) {
        if (!own && !AppSettings.haptics) return
        try {
            val v = vibrator(view.context)
            // Living table F9: no motor in the device itself (a handheld): the controller's rumble where it has one.
            if (own && (v == null || !v.hasVibrator()) && padRumble(kind)) return
            val effect = if (v != null && v.hasVibrator()) effectFor(kind, v) else null
            if (effect != null && v != null) {
                if (Build.VERSION.SDK_INT >= 33) v.vibrate(effect, VibrationAttributes.createForUsage(VibrationAttributes.USAGE_TOUCH)) else @Suppress("DEPRECATION") v.vibrate(effect)
            } else view.performHapticFeedback(viewFeedback(kind))
        } catch (_: Exception) { }
    }

    /** Stops anything still playing (a pack closed mid-sequence). */
    fun cancel(context: Context) { try { vibrator(context)?.cancel() } catch (_: Exception) { } }
}
