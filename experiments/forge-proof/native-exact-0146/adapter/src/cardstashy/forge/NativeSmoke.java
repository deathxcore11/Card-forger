package cardstashy.forge;

import forge.GuiDesktop;
import forge.gui.GuiBase;
import forge.view.SimulateMatch;

/** Runs the official native simulator without Main's third-party crash-reporting bootstrap. */
public final class NativeSmoke {
    public static void main(String[] args) {
        System.setProperty("java.awt.headless", "true");
        GuiBase.setInterface(new GuiDesktop() {
            @Override public String getAssetsDir() { return System.getProperty("forge.assets"); }
        });
        forge.model.FModel.getPreferences().setPref(forge.localinstance.properties.ForgePreferences.FPref.USE_SENTRY, false);
        SimulateMatch.simulate(args);
        System.exit(0);
    }
}
