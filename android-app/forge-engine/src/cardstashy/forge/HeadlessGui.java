package cardstashy.forge;

import forge.gamemodes.match.HostedMatch;
import forge.gui.download.GuiDownloadService;
import forge.gui.interfaces.IGuiBase;
import forge.gui.interfaces.IGuiGame;
import forge.item.PaperCard;
import forge.localinstance.skin.FSkinProp;
import forge.localinstance.skin.ISkinImage;
import forge.sound.IAudioClip;
import forge.sound.IAudioMusic;
import forge.util.FSerializableFunction;
import forge.util.ImageFetcher;
import java.io.File;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Consumer;

/** Forge's GUI interface with no screen: the in-app engine has no Swing or libGDX.
 * One thread stands in for Swing's event thread, so the bridge and Forge's own
 * "run on the GUI thread" calls queue on the same single thread as on desktop. */
public final class HeadlessGui implements IGuiBase {
    private static volatile Thread edtThread;
    private static final ExecutorService EDT = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "forge-edt");
        t.setDaemon(true);
        edtThread = t;
        return t;
    });
    /** The bridge's SwingUtilities.invokeLater, on the in-app event thread. */
    public static void edt(Runnable r) { EDT.execute(r); }

    private final String assetsDir;
    public HeadlessGui(String assetsDir) { this.assetsDir = assetsDir; }

    @Override public boolean isRunningOnDesktop() { return false; }
    @Override public boolean isLibgdxPort() { return false; }
    @Override public String getCurrentVersion() { return ForgeHttpBridge.REV; }
    @Override public String getUserAgent() { return "Forge/" + ForgeHttpBridge.REV + " (cardstashy-android)"; }
    @Override public void invokeInEdtNow(Runnable r) { r.run(); }
    @Override public void invokeInEdtLater(Runnable r) { edt(r); }
    @Override public void invokeInEdtAndWait(Runnable r) {
        if (isGuiThread()) { r.run(); return; }
        try { EDT.submit(r).get(); }
        catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new RuntimeException(e); }
        catch (ExecutionException e) { throw new RuntimeException(e.getCause()); }
    }
    @Override public void runBackgroundTask(String message, Runnable task) { forge.gui.FThreads.invokeInBackgroundThread(task); }
    @Override public boolean isGuiThread() { return Thread.currentThread() == edtThread; }
    @Override public String getAssetsDir() { return assetsDir; }
    @Override public ImageFetcher getImageFetcher() { return null; }
    @Override public ISkinImage getSkinIcon(FSkinProp skinProp) { return null; }
    @Override public ISkinImage getUnskinnedIcon(String path) { return null; }
    @Override public ISkinImage getCardArt(PaperCard card, boolean backFace) { return null; }
    @Override public ISkinImage createLayeredImage(PaperCard card, FSkinProp background, String overlayFilename, float opacity) { return null; }
    @Override public void clearImageCache() {}
    @Override public String encodeSymbols(String str, boolean formatReminderText) { return str; }
    @Override public int getAvatarCount() { return 0; }
    @Override public int getSleevesCount() { return 0; }
    @Override public float getScreenScale() { return 1f; }
    @Override public void preventSystemSleep(boolean preventSleep) {}
    @Override public void download(GuiDownloadService service, Consumer<Boolean> callback) { if (callback != null) callback.accept(false); }
    @Override public void copyToClipboard(String text) {}
    @Override public void browseToUrl(String url) {}
    @Override public void showCardList(String title, String message, List<PaperCard> list) {}
    @Override public boolean showBoxedProduct(String title, String message, List<PaperCard> list) { return false; }
    @Override public void showBugReportDialog(String title, String text, boolean showExitAppBtn) { System.err.println("FORGE_BUG_REPORT " + title + "\n" + text); }
    @Override public void showImageDialog(ISkinImage image, String message, String title) {}
    @Override public int showOptionDialog(String message, String title, FSkinProp icon, List<String> options, int defaultOption) { return defaultOption; }
    @Override public String showInputDialog(String message, String title, FSkinProp icon, String initialInput, List<String> inputOptions, boolean isNumeric) { return initialInput; }
    @Override public String showFileDialog(String title, String defaultDir) { return null; }
    @Override public File getSaveFile(File defaultFile) { return defaultFile; }
    @Override public <T> List<T> order(String title, String top, int remainingObjectsMin, int remainingObjectsMax, List<T> sourceChoices, List<T> destChoices) { return new ArrayList<>(sourceChoices); }
    @Override public <T> List<T> getChoices(String message, int min, int max, Collection<T> choices, Collection<T> selected, FSerializableFunction<T, String> display) {
        return new ArrayList<>(selected != null && !selected.isEmpty() ? selected : List.copyOf(choices).subList(0, Math.min(min, choices.size())));
    }
    @Override public PaperCard chooseCard(String title, String message, List<PaperCard> list) { return list == null || list.isEmpty() ? null : list.get(0); }
    @Override public boolean isSupportedAudioFormat(File file) { return false; }
    @Override public IAudioClip createAudioClip(String filename) { return null; }
    @Override public IAudioMusic createAudioMusic(String filename) { return null; }
    @Override public void startAltSoundSystem(String filename, boolean isSynchronized) {}
    @Override public void showSpellShop() {}
    @Override public void showBazaar() {}
    @Override public IGuiGame getNewGuiGame() { throw new UnsupportedOperationException("in-app engine has no Forge screens"); }
    @Override public HostedMatch hostMatch() { throw new UnsupportedOperationException("in-app engine has no Forge screens"); }
    @Override public org.jupnp.UpnpServiceConfiguration getUpnpPlatformService() { return null; }
    @Override public boolean hasNetGame() { return false; }
}
