package dev.cardstashy.integration;

import android.content.Context;
import android.os.Build;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.HapticFeedbackConstants;
import android.view.View;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Semantic haptics for the shared web app: one event, one short system effect. Composition primitives where the
// phone supports them (they follow its haptic hardware and the user's touch-feedback setting); predefined effects
// or view feedback otherwise. Nothing here plays long vibration; a pack's best pulls get a short, richer composition.
@CapacitorPlugin(name = "CardStashyHaptics")
public class CardStashyHaptics extends Plugin {
    private Vibrator vibrator() {
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= 31) {
            VibratorManager manager = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return manager == null ? null : manager.getDefaultVibrator();
        }
        return (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
    }

    private boolean supports(Vibrator v, int... primitives) {
        return Build.VERSION.SDK_INT >= 30 && v.areAllPrimitivesSupported(primitives);
    }

    private VibrationEffect effectFor(String kind, Vibrator v) {
        if (Build.VERSION.SDK_INT >= 30) {
            int CLICK = VibrationEffect.Composition.PRIMITIVE_CLICK, TICK = VibrationEffect.Composition.PRIMITIVE_TICK, LOW = VibrationEffect.Composition.PRIMITIVE_LOW_TICK, RISE = VibrationEffect.Composition.PRIMITIVE_QUICK_RISE, SLOW = VibrationEffect.Composition.PRIMITIVE_SLOW_RISE, THUD = VibrationEffect.Composition.PRIMITIVE_THUD;
            switch (kind) {
                case "pack-tear": if (supports(v, LOW, CLICK)) return VibrationEffect.startComposition().addPrimitive(LOW, 0.5f).addPrimitive(LOW, 0.6f, 28).addPrimitive(LOW, 0.7f, 28).addPrimitive(CLICK, 0.55f, 40).compose(); break;
                case "pack-land": if (supports(v, TICK)) return VibrationEffect.startComposition().addPrimitive(TICK, 0.35f).compose(); break;
                case "pack-reveal": if (supports(v, CLICK)) return VibrationEffect.startComposition().addPrimitive(CLICK, 0.6f).compose(); break;
                case "pack-value-2": if (supports(v, CLICK)) return VibrationEffect.startComposition().addPrimitive(CLICK, 0.9f).compose(); break;
                case "pack-value-3": if (supports(v, CLICK)) return VibrationEffect.startComposition().addPrimitive(CLICK, 0.6f).addPrimitive(CLICK, 0.85f, 70).compose(); break;
                case "pack-value-4": if (supports(v, RISE, CLICK)) return VibrationEffect.startComposition().addPrimitive(RISE, 0.5f).addPrimitive(CLICK, 1f, 40).compose(); break;
                // Pack opening: a firm tap per card dealt, a low rumble for the three best, a gathering rise before a big
                // flip, and one feel per price tier, each a step richer than the last.
                case "pack-deal": if (supports(v, CLICK)) return VibrationEffect.startComposition().addPrimitive(CLICK, 0.45f).compose(); break;
                case "pack-rumble":
                    if (supports(v, LOW, THUD)) return VibrationEffect.startComposition().addPrimitive(LOW, 0.6f).addPrimitive(LOW, 0.8f, 18).addPrimitive(THUD, 0.55f, 18).compose();
                    if (supports(v, LOW)) return VibrationEffect.startComposition().addPrimitive(LOW, 0.6f).addPrimitive(LOW, 0.8f, 18).addPrimitive(LOW, 1f, 18).compose(); break;
                case "pack-charge":
                    if (supports(v, SLOW)) return VibrationEffect.startComposition().addPrimitive(SLOW, 0.55f).compose();
                    if (supports(v, TICK)) return VibrationEffect.startComposition().addPrimitive(TICK, 0.3f).addPrimitive(TICK, 0.5f, 40).addPrimitive(TICK, 0.7f, 30).compose(); break;
                case "reward-claim": if (supports(v, CLICK)) return VibrationEffect.startComposition().addPrimitive(CLICK, 0.7f).addPrimitive(CLICK, 1f, 50).compose(); break;
                case "reward-big": if (supports(v, RISE, CLICK, TICK)) return VibrationEffect.startComposition().addPrimitive(RISE, 0.6f).addPrimitive(CLICK, 1f, 30).addPrimitive(TICK, 0.7f, 70).addPrimitive(TICK, 0.5f, 60).compose(); break;
                case "reward-land": if (supports(v, TICK)) return VibrationEffect.startComposition().addPrimitive(TICK, 0.5f).compose(); break;
                case "pack-tier-1": if (supports(v, CLICK)) return VibrationEffect.startComposition().addPrimitive(CLICK, 0.7f).compose(); break;
                case "pack-tier-2": if (supports(v, CLICK)) return VibrationEffect.startComposition().addPrimitive(CLICK, 0.6f).addPrimitive(CLICK, 0.9f, 60).compose(); break;
                case "pack-tier-3": if (supports(v, TICK, CLICK)) return VibrationEffect.startComposition().addPrimitive(TICK, 0.6f).addPrimitive(CLICK, 0.75f, 40).addPrimitive(CLICK, 1f, 50).compose(); break;
                case "pack-tier-4": if (supports(v, RISE, CLICK, TICK)) return VibrationEffect.startComposition().addPrimitive(RISE, 0.6f).addPrimitive(CLICK, 1f, 30).addPrimitive(TICK, 0.8f, 80).addPrimitive(TICK, 0.55f, 60).compose(); break;
                case "pack-tier-5":
                    if (supports(v, RISE, CLICK, THUD, TICK)) return VibrationEffect.startComposition().addPrimitive(RISE, 0.75f).addPrimitive(CLICK, 1f, 20).addPrimitive(THUD, 1f, 50).addPrimitive(TICK, 0.8f, 70).addPrimitive(TICK, 0.6f, 60).addPrimitive(TICK, 0.4f, 60).compose();
                    if (supports(v, RISE, CLICK, TICK)) return VibrationEffect.startComposition().addPrimitive(RISE, 0.75f).addPrimitive(CLICK, 1f, 20).addPrimitive(CLICK, 1f, 60).addPrimitive(TICK, 0.7f, 70).addPrimitive(TICK, 0.45f, 60).compose(); break;
                default: break;
            }
        }
        if (Build.VERSION.SDK_INT >= 29) {
            switch (kind) {
                case "pack-land": case "pack-charge": case "reward-land": case "tick": return VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK);
                case "pack-value-3": case "pack-value-4": case "pack-tier-3": case "pack-tier-4": case "pack-tier-5": case "reward-claim": case "reward-big": case "success": return VibrationEffect.createPredefined(VibrationEffect.EFFECT_DOUBLE_CLICK);
                case "warn": case "error": case "pack-value-2": case "pack-tier-2": case "pack-rumble": return VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK);
                default: return VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK);
            }
        }
        return null;
    }

    private int viewFeedback(String kind) {
        switch (kind) {
            case "pack-land": case "tick": return HapticFeedbackConstants.CLOCK_TICK;
            case "pack-reveal": case "pack-deal": case "pack-tier-1": case "tap": return HapticFeedbackConstants.VIRTUAL_KEY;
            default: return HapticFeedbackConstants.LONG_PRESS;
        }
    }

    @PluginMethod public void perform(PluginCall call) {
        String kind = call.getString("effect", "tap");
        getActivity().runOnUiThread(() -> {
            try {
                Vibrator v = vibrator();
                VibrationEffect effect = v != null && v.hasVibrator() ? effectFor(kind, v) : null;
                if (effect != null) {
                    if (Build.VERSION.SDK_INT >= 33) v.vibrate(effect, VibrationAttributes.createForUsage(VibrationAttributes.USAGE_TOUCH));
                    else v.vibrate(effect);
                } else {
                    View view = getBridge().getWebView();
                    if (view != null) view.performHapticFeedback(viewFeedback(kind));
                }
            } catch (Exception ignored) { }
            call.resolve();
        });
    }

    @PluginMethod public void cancel(PluginCall call) {
        try { Vibrator v = vibrator(); if (v != null) v.cancel(); } catch (Exception ignored) { }
        call.resolve();
    }
}
