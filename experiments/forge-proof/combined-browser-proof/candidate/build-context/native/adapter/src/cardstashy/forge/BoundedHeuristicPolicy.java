package cardstashy.forge;

import forge.ai.*;
import forge.game.Game;
import forge.game.GameRules;
import forge.game.player.Player;
import forge.localinstance.properties.ForgePreferences.FPref;
import forge.model.FModel;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;

/** Review candidate only. Experimental heuristic difficulties, not stock AI or guaranteed ranks. */
public enum BoundedHeuristicPolicy {
    // Easy makes honest mistakes; Hard adds Forge's flat Monte Carlo look-ahead (hidden cards re-dealt, so no peeking).
    EASY("forge-heuristic-easy-beta-v2", "CardStashyEasyBetaV2", 10, 0, false),
    MEDIUM("forge-heuristic-medium-beta-v1", "CardStashyMediumBetaV1", 50, 50, false),
    HARD("forge-heuristic-hard-beta-v2", "CardStashyHardBetaV2", 100, 100, true);

    public static final String FORGE_COMMIT = "e5a0f8156da70ffc7866f923bed371c0111707cd";
    public static final String AI_PATCHSET_VERSION = "cardstashy-forge-observation-survival-land-v2-review";
    public static final String AI_PATCHSET_SHA256 = "cd14c95185c4bfd44e90a809a6095f2027f23d102c1cf04464533ca545a0a4b1";
    public static final String DEFAULT_SHA256 = "fb32c2067f30cb8820eff33024e3597a036d476ef35fb312459d0106a0c82f7d";
    public final String version, profile;
    public final int tacticalChance, holdUnusedLandChance;
    public final boolean monteCarlo;
    private static Map<String,String> installedHashes = Map.of();

    BoundedHeuristicPolicy(String version, String profile, int chance, int hold, boolean monteCarlo) {
        this.version=version; this.profile=profile; this.tacticalChance=chance; this.holdUnusedLandChance=hold; this.monteCarlo=monteCarlo;
    }
    public static BoundedHeuristicPolicy parseVersion(String version) {
        for (var p:values()) if(p.version.equals(version)) return p;
        throw new IllegalArgumentException("Unsupported experimental native policy version");
    }
    private static String sha256(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }
    public Map<AiProps,String> settings() {
        Map<AiProps,String> m=new LinkedHashMap<>();
        m.put(AiProps.CHEAT_WITH_MANA_ON_SHUFFLE,"false");
        m.put(AiProps.FLAT_MC_ENABLED,"false"); m.put(AiProps.FLAT_MC_ATTACK,"false");
        m.put(AiProps.COMBAT_ASSAULT_ATTACK_EVASION_PREDICTION,"true");
        m.put(AiProps.COMBAT_ATTRITION_ATTACK_EVASION_PREDICTION,"false");
        m.put(AiProps.ENABLE_RANDOM_FAVORABLE_TRADES_ON_BLOCK,"true");
        for(var key:List.of(AiProps.CHANCE_TO_CHAIN_TWO_DAMAGE_SPELLS,AiProps.CHANCE_TO_COUNTER_CMC_1,
                AiProps.CHANCE_TO_COUNTER_CMC_2,AiProps.CHANCE_TO_COUNTER_CMC_3,
                AiProps.MIN_CHANCE_TO_RANDOMLY_TRADE_ON_BLOCK,AiProps.MAX_CHANCE_TO_RANDOMLY_TRADE_ON_BLOCK))
            m.put(key,Integer.toString(tacticalChance));
        m.put(AiProps.HOLD_LAND_DROP_FOR_MAIN2_IF_UNUSED,Integer.toString(holdUnusedLandChance));
        if(this==EASY) {
            // Walks into blocks, spends tricks early, misses alpha strikes and lets small threats slide.
            m.put(AiProps.COMBAT_ASSAULT_ATTACK_EVASION_PREDICTION,"false");
            m.put(AiProps.TRY_TO_AVOID_ATTACKING_INTO_CERTAIN_BLOCK,"false");
            m.put(AiProps.TRY_TO_HOLD_COMBAT_TRICKS_UNTIL_BLOCK,"false");
            m.put(AiProps.ACTIVELY_DESTROY_IMMEDIATELY_UNBLOCKABLE,"false");
            m.put(AiProps.MIN_SPELL_CMC_TO_COUNTER,"2");
            m.put(AiProps.AI_IN_DANGER_THRESHOLD,"3"); m.put(AiProps.AI_IN_DANGER_MAX_THRESHOLD,"3");
        } else if(this==HARD) {
            // Forge's own Hard.ai search budget, plus the Experimental.ai judgement settings.
            m.put(AiProps.FLAT_MC_ENABLED,"true"); m.put(AiProps.FLAT_MC_ATTACK,"true");
            m.put(AiProps.COMBAT_ATTRITION_ATTACK_EVASION_PREDICTION,"true");
            m.put(AiProps.FLAT_MC_DECISION_BUDGET_MS,"800"); m.put(AiProps.FLAT_MC_TURN_BUDGET_MS,"3500");
            m.put(AiProps.FLAT_MC_MAX_CANDIDATES,"6"); m.put(AiProps.FLAT_MC_ROLLOUTS_PER_CANDIDATE,"5");
            m.put(AiProps.FLAT_MC_EXTRA_ROUNDS,"3"); m.put(AiProps.FLAT_MC_MAX_PLAYOUT_PLAYS,"8");
            m.put(AiProps.FLAT_MC_COMBO_PLAYOUT_PLAYS,"16"); m.put(AiProps.FLAT_MC_HEURISTIC_BONUS,"70");
            m.put(AiProps.FLAT_MC_HOLD_MANA_WEIGHT,"110"); m.put(AiProps.FLAT_MC_RISK_WEIGHT,"120");
            m.put(AiProps.AI_IN_DANGER_THRESHOLD,"5"); m.put(AiProps.AI_IN_DANGER_MAX_THRESHOLD,"5");
            m.put(AiProps.CHANCE_TO_HOLD_COMBAT_TRICKS_UNTIL_BLOCK,"75");
            m.put(AiProps.FLASH_CHANCE_TO_RESPOND_TO_STACK_WITH_ETB,"15");
            m.put(AiProps.DESTROY_IMMEDIATELY_UNBLOCKABLE_ONLY_IN_DNGR,"false");
            m.put(AiProps.CHANCE_TO_TRADE_DOWN_TO_SAVE_PLANESWALKER,"40");
            m.put(AiProps.CHUMP_TO_SAVE_PLANESWALKER_ONLY_ON_LETHAL,"false");
            m.put(AiProps.TOKEN_GENERATION_ABILITY_CHANCE,"100");
            m.put(AiProps.MOVE_EQUIPMENT_TO_BETTER_CREATURES,"always");
        }
        return Collections.unmodifiableMap(m);
    }
    /** Startup only, before any games: native profile loading is global. No opponent data is read. */
    public static synchronized void installProfiles(Path pinnedDefault, Path isolatedDirectory) throws Exception {
        NativePatchsetProof.verify();
        byte[] base=Files.readAllBytes(pinnedDefault);
        if(!DEFAULT_SHA256.equals(sha256(base))) throw new IllegalStateException("Pinned Default profile mismatch");
        Files.createDirectories(isolatedDirectory);
        Files.write(isolatedDirectory.resolve("Default.ai"),base);
        Map<String,String> hashes=new LinkedHashMap<>();
        for(var p:values()) {
            StringBuilder text=new StringBuilder(new String(base,java.nio.charset.StandardCharsets.UTF_8));
            text.append("\n# CardStashy experimental policy; modified native AI patchset required.\n");
            p.settings().forEach((key,value)->text.append(key).append('=').append(value).append('\n'));
            byte[] bytes=text.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
            Files.write(isolatedDirectory.resolve(p.profile+".ai"),bytes); hashes.put(p.profile,sha256(bytes));
        }
        AiProfileUtil.loadAllProfiles(isolatedDirectory.toString());
        installedHashes=Map.copyOf(hashes);
        FModel.getPreferences().setPref(FPref.UI_ENABLE_AI_CHEATS,false);
        FModel.getPreferences().setPref(FPref.FILTERED_HANDS,false);
        FModel.getPreferences().setPref(FPref.MATCH_AI_FLAT_MONTE_CARLO,false);
    }
    public LobbyPlayerAi createLobby(String name) {
        if(!installedHashes.containsKey(profile)) throw new IllegalStateException("Install pinned profiles at startup first");
        LobbyPlayerAi lobby=new LobbyPlayerAi(name,null);lobby.setAiProfile(profile);lobby.setRotateProfileEachGame(false);return lobby;
    }
    public static void configureRules(GameRules rules) { rules.setAllowCheatShuffle(false); }
    /** After createGame and before startGame. Native rules/decks/life totals are never altered. */
    public void apply(Player player) {
        if(!(player.getController() instanceof PlayerControllerAi controller)
                || !(player.getLobbyPlayer() instanceof LobbyPlayerAi lobby) || !profile.equals(lobby.getAiProfile()))
            throw new IllegalArgumentException("Native AI controller/profile mismatch");
        Game game=player.getGame();configureRules(game.getRules());
        game.AI_FLAT_MONTE_CARLO=false;game.AI_FLAT_MONTE_CARLO_MAX=false;game.AI_TIMEOUT=5;
        AiController ai=controller.getAi();ai.setUseSimulation(null);
        // Per player only: the game-wide Monte Carlo switches stay off. Forge's circuit breaker still turns it off on a slow device.
        ai.setFlatMonteCarloOverride(monteCarlo);ai.setFlatMonteCarloMaxOverride(false);ai.setFlatMonteCarloAttackOverride(monteCarlo);
        for(var setting:settings().entrySet()) {
            String expected=setting.getValue();
            boolean ok=expected.equals("true")||expected.equals("false")
                    ? ai.getBoolProperty(setting.getKey())==Boolean.parseBoolean(expected)
                    : expected.chars().allMatch(Character::isDigit)
                    ? ai.getIntProperty(setting.getKey())==Integer.parseInt(expected)
                    : expected.equals(ai.getProperty(setting.getKey()));
            if(!ok) throw new IllegalStateException("Effective native profile mismatch: "+setting.getKey());
        }
    }
    /** Public metadata only. Bridge admission is intentionally absent and must be reviewed separately. */
    public Map<String,Object> receipt() {
        Map<String,Object> out=new LinkedHashMap<>();
        out.put("difficultyPolicyVersion",version);out.put("aiProfile",profile);out.put("controlMode","smart");
        out.put("forgeCommit",FORGE_COMMIT);out.put("aiPatchsetVersion",AI_PATCHSET_VERSION);
        out.put("aiPatchsetSha256",AI_PATCHSET_SHA256);out.put("profileSha256",installedHashes.get(profile));
        out.put("nativeAiModified",true);out.put("monteCarlo",monteCarlo);out.put("legacySimulation",false);
        out.put("opponentDeckKnowledge","secret-current-lawful-observations-only");
        out.put("calibration","experimental-bounded-tactical-corpus-not-universal-strength-ranking");
        out.put("nativePriorityTimeoutSeconds",5);out.put("strictServiceLatencyProven",false);
        out.put("admissionAllowed",false);return out;
    }
}
