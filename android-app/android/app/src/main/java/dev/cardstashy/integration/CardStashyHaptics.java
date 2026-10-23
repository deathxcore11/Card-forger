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
// or view feedback otherwise. Nothing here plays long or escalating vibration.
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
            int CLICK = VibrationEffect.Composition.PRIMITIVE_CLICK, TICK = VibrationEffect.Composition.PRIMITIVE_TICK, LOW = VibrationEffect.Composition.PRIMITIVE_LOW_TICK, RISE = VibrationEffect.Composition.PRIMITIVE_QUICK_RISE;
            switch (kind) {
                case "pack-tear": if (supports(v, LOW, CLICK)) return VibrationEffect.startComposition().addPrimitive(LOW, 0.5f).addPrimitive(LOW, 0.6f, 28).addPrimitive(LOW, 0.7f, 28).addPrimitive(CLICK, 0.55f, 40).compose(); break;
                case "pack-land": if (supports(v, TICK)) return VibrationEffect.startComposition().addPrimitive(TICK, 0.35f).compose(); break;
                case "pack-reveal": if (supports(v, CLICK)) return VibrationEffect.startComposition().addPrimitive(CLICK, 0.6f).compose(); break;
                case "pack-value-2": if (supports(v, CLICK)) return VibrationEffect.startComposition().addPrimitive(CLICK, 0.9f).compose(); break;
                case "pack-value-3": if (supports(v, CLICK)) return VibrationEffect.startComposition().addPrimitive(CLICK, 0.6f).addPrimitive(CLICK, 0.85f, 70).compose(); break;
                case "pack-value-4": if (supports(v, RISE, CLICK)) return VibrationEffect.startComposition().addPrimitive(RISE, 0.5f).addPrimitive(CLICK, 1f, 40).compose(); break;
                default: break;
            }
        }
        if (Build.VERSION.SDK_INT >= 29) {
            switch (kind) {
                case "pack-land": case "tick": return VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK);
                case "pack-value-3": case "pack-value-4": case "success": return VibrationEffect.createPredefined(VibrationEffect.EFFECT_DOUBLE_CLICK);
                case "warn": case "error": case "pack-value-2": return VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK);
                default: return VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK);
            }
        }
        return null;
    }

    private int viewFeedback(String kind) {
        switch (kind) {
            case "pack-land": case "tick": return HapticFeedbackConstants.CLOCK_TICK;
            case "pack-reveal": case "tap": return HapticFeedbackConstants.VIRTUAL_KEY;
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
