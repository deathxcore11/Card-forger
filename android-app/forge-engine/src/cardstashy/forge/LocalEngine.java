package cardstashy.forge;

import cardstashy.forge.http.HttpServer;
import forge.gui.GuiBase;
import forge.localinstance.properties.ForgePreferences.FPref;
import forge.model.FModel;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** The Forge bridge running inside the app instead of in a server container.
 * The card database loads once per app run ({@link #init}); each match is a new
 * bridge over that database ({@link #start}), answered in memory with no open port. */
public final class LocalEngine {
    private static String root;
    private static volatile long initMs = -1;
    private static Map<String, Object> humanPriorityProof;
    private static Session current;

    private LocalEngine() {}

    public static boolean ready() { return initMs >= 0; }
    public static long initMs() { return initMs; }

    /** Load Forge's card database and check the reviewed CPU and human overlays. Slow once, then free. */
    public static synchronized long init(String rootDir) throws Exception {
        if (initMs >= 0) return initMs;
        long t0 = System.nanoTime();
        root = rootDir;
        System.setProperty("proof.root", root);
        System.setProperty("java.awt.headless", "true");
        GuiBase.setInterface(new HeadlessGui(root + "/forge/forge-gui/"));
        // The same preferences ForgeHttpBridge.main sets on the server.
        FModel.initialize(null, prefs -> {
            prefs.setPref(FPref.USE_SENTRY, false);
            prefs.setPref(FPref.UI_ENABLE_AI_CHEATS, false);
            prefs.setPref(FPref.UI_SHOW_ACTIONABLE_HIGHLIGHTS, true);
            prefs.setPref(FPref.UI_SHOW_AUTOTAP_PREVIEW, true);
            prefs.setPref(FPref.YIELD_AUTO_PASS_RESPECTS_INTERRUPTS, false);
            prefs.setPref(FPref.PLAYER_NAME, "CardStashy");
            prefs.setPref(FPref.DECKGEN_CARDBASED, false);
            prefs.setPref(FPref.YIELD_AUTO_PASS_NO_ACTIONS, false);
            prefs.setPref(FPref.YIELD_DECLINE_SCOPE_STACK_YIELD, "NEVER");
            prefs.setPref(FPref.YIELD_DECLINE_SCOPE_NO_ACTIONS, "NEVER");
            prefs.setPref(FPref.UI_SELECT_FROM_CARD_DISPLAYS, false);
            return null;
        });
        humanPriorityProof = NativeHumanPriorityProof.verify(root);
        NativeCpuPolicyIntegration.install(root);
        try { NativeRulesData.current(); } catch (RuntimeException stale) { /* each match reports it */ }
        initMs = (System.nanoTime() - t0) / 1_000_000;
        return initMs;
    }

    public static final class Session {
        final ForgeHttpBridge bridge;
        final HttpServer server;
        Session(ForgeHttpBridge bridge, HttpServer server) { this.bridge = bridge; this.server = server; }
        /** One bridge request (GET /state, POST /action) answered in memory. */
        public HttpServer.Reply call(String method, String path, String body) throws IOException {
            return server.dispatch(method, path, "Bearer " + bridge.token, body);
        }
        /** End the match: Forge records a concession so its game thread finishes. */
        public void close() {
            synchronized (bridge.lock) {
                if (bridge.game != null && bridge.controller != null && !bridge.finished && !bridge.concessionRequested && bridge.failure == null) bridge.requestConcession();
            }
        }
    }

    /** Start one match from the same {"input":{...}} the server's bootstrap stores. */
    public static synchronized Session start(String inputJson, long seed) throws Exception {
        if (initMs < 0) throw new IllegalStateException("engine_not_initialized");
        if (current != null) current.close();
        Path dir = Files.createDirectories(Paths.get(root, "matches"));
        Path input = Files.createTempFile(dir, "match-", ".json");
        Files.write(input, inputJson.getBytes(StandardCharsets.UTF_8));
        ForgeHttpBridge bridge = new ForgeHttpBridge();
        bridge.serve(0);
        Session session = new Session(bridge, HttpServer.latest());
        current = session;
        // From here on, the steps ForgeHttpBridge.main takes for an exact match input.
        try {
            bridge.exactAdmission = NativeDeckAdmission.loadBootstrap(input);
            bridge.exactAdmission.receipt().put("humanPriority", humanPriorityProof);
            if (!bridge.exactAdmission.admitted()) {
                bridge.failure = "exact_deck_initialization_not_admitted";
                bridge.published.set(ForgeHttpBridge.obj("schema", "cardstashy.forge-proof.v1", "status", "failed", "failure", bridge.failure, "initialization", bridge.exactAdmission.receipt()));
                return session;
            }
            bridge.cpuPolicy = NativeCpuPolicyIntegration.parse(bridge.exactAdmission.input().get("difficultyPolicyVersion").getAsString());
            bridge.controlMode = "smart";
        } catch (Exception e) {
            bridge.failure = "exact_deck_initialization_rejected:" + e.getMessage();
            bridge.published.set(ForgeHttpBridge.obj("schema", "cardstashy.forge-proof.v1", "status", "failed", "failure", bridge.failure, "initialization", ForgeHttpBridge.obj("supported", false, "legal", false, "errors", List.of(String.valueOf(e.getMessage())))));
            return session;
        } finally {
            try { Files.deleteIfExists(input); } catch (IOException ignored) {}
        }
        try {
            bridge.start(root, seed);
        } catch (Exception e) {
            bridge.failure = "native_start_rejected:" + e.getMessage();
            bridge.exactAdmission.receipt().put("supported", false);
            bridge.exactAdmission.receipt().put("errors", List.of(bridge.failure));
            bridge.published.set(ForgeHttpBridge.obj("schema", "cardstashy.forge-proof.v1", "status", "failed", "failure", bridge.failure, "initialization", bridge.exactAdmission.receipt()));
        }
        return session;
    }
}
