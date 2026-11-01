package cardstashy.forge;

import com.google.gson.*;
import com.sun.net.httpserver.*;
import forge.GuiDesktop;
import forge.deck.Deck;
import forge.deck.DeckSection;
import forge.deck.io.DeckSerializer;
import forge.game.*;
import forge.game.card.CardView;
import forge.game.player.*;
import forge.game.spellability.*;
import forge.game.zone.ZoneType;
import forge.gamemodes.match.Selection;
import forge.gamemodes.net.*;
import forge.gamemodes.net.event.*;
import forge.gui.GuiBase;
import forge.gui.control.GameEventForwarder;
import forge.gui.interfaces.IGuiGame;
import forge.localinstance.properties.ForgePreferences.FPref;
import forge.model.FModel;
import forge.player.*;
import forge.trackable.TrackableObject;
import forge.util.MyRandom;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import javax.swing.SwingUtilities;

/** Local-only GPL-3.0-or-later proof adapter. Rules and decisions belong to Forge, not this transport. */
public final class ForgeHttpBridge implements IRemote {
    static final Gson JSON = new GsonBuilder().serializeNulls().create();
    static final Set<String> DECK_ALIASES=Set.of("calling-all-angels","keen-engineering","reign-of-dragons");
    String humanDeckAlias, aiDeckAlias;
    String actualAiProfile;
    NativeDeckAdmission.Admission exactAdmission;
    BoundedHeuristicPolicy cpuPolicy;
    NativeStartingPlayer startingPlayer;
    volatile Map<String,Object> pregame = Map.of();
    int humanDeckCount=100,aiDeckCount=100;
    // Deck name and size per CPU seat (native player id), so a Commander pod labels each seat.
    final Map<Integer,String> seatDeckAlias=new ConcurrentHashMap<>();
    final Map<Integer,Integer> seatDeckCount=new ConcurrentHashMap<>();
    // A friend match: the second person's seat is its own bridge over the same game, with
    // its own controller, prompts and viewer, so each player is sent only what they may see.
    volatile ForgeHttpBridge peer;
    boolean humanOpponent;
    static final String REV = "e5a0f8156da70ffc7866f923bed371c0111707cd";
    final AtomicReference<Map<String,Object>> published = new AtomicReference<>(Map.of("status","initializing"));
    final AtomicLong revision = new AtomicLong();
    final AtomicLong promptGeneration = new AtomicLong();
    Map<String,Object> board = Map.of();
    // A presentation receipt, not a client-supplied capability. Forge still omits private identities.
    List<Object> boardVisibility = List.of();
    final Map<Integer,PlayerView> exposedPlayers = new ConcurrentHashMap<>();
    final String token = UUID.randomUUID().toString();
    final Object lock = new Object();
    volatile Game game;
    volatile PlayerControllerHuman controller;
    volatile PlayerView viewer;
    volatile ProtocolGuiGame gui;
    volatile Pending pending;
    volatile Selection selection = Selection.NONE;
    volatile String message = "Starting native Forge";
    volatile Map<String,Object> buttons = Map.of();
    volatile Map<String,Object> notification = Map.of();
    volatile boolean busy, finished, commandInFlight;
    volatile String controlMode=System.getProperty("proof.controlMode","full");
    // Auto-pay is its own switch: a player can keep automatic mana payment and still
    // hold priority (Full Control). Until the autoPay action is used, it follows the
    // control mode as before (Smart pays, Full doesn't); choosing a mode resets it.
    volatile Boolean autoPayChoice;
    // The player's own phase stops, on top of Smart: "you:UPKEEP" -> true when pinned for the
    // match, false when it holds only the next time that step comes round.
    final Map<String,Boolean> phaseStops=new ConcurrentHashMap<>();
    final Set<String> reachedOnceStops=ConcurrentHashMap.newKeySet();
    // Abilities the player yields to until the end of this turn, by Forge's yield key. Forge's own
    // auto-yield passes only while that ability is on top; targets and choices still stop.
    final Set<String> turnYields=ConcurrentHashMap.newKeySet();
    boolean autoPay(){Boolean choice=autoPayChoice;return choice!=null?choice:controlMode.equals("smart");}
    volatile boolean effectiveAutoPass;
    // Bounded Smart assistance applies only to an explicit priority card/ability intention.
    // Optional/alternative native dialogs remain human decisions; autoPay off prevents any automatic payment.
    forge.gamemodes.match.input.Input smartIntentOrigin, autoPayAttemptInput;
    SpellAbility smartIntentAbility;
    volatile long nativeAutoPayments;
    volatile forge.gamemodes.match.input.Input publishedInput;
    volatile String lastActionError;
    volatile String failure;
    static final String UNSUPPORTED_PREGAME_CHOICE="unsupported_native_pregame_choice";
    static final String UNSUPPORTED_PREGAME_MESSAGE="This deck requires a setup choice before the coin toss. This version cannot handle that choice yet. Your deck was not changed.";
    volatile boolean unsupportedPregameChoice;
    volatile boolean concessionRequested, nativeOutcomeConfirmed, concessionApplied;
    volatile Thread concessionThread;
    final CompletableFuture<Void> concessionTerminal = new CompletableFuture<>();
    static final class NativeMatchEnded extends RuntimeException {
        NativeMatchEnded(){super("native_match_ended",null,false,false);}
    }
    void recordFailure(Throwable t){
        if(t instanceof NativeMatchEnded && nativeOutcomeConfirmed)return;
        failure=t.getClass().getSimpleName()+": "+t.getMessage();t.printStackTrace();
    }
    Object awaitConcession(){
        try{concessionTerminal.get();}catch(Exception e){throw new IllegalStateException("native_concession_not_confirmed",e);}
        throw new NativeMatchEnded();
    }
    /** Uses the same native out-of-band controller boundary as Forge's network server.
     * No fabricated dialog reply or winner: the future aborts only AFTER native GameOutcome. */
    boolean invokeNativeConcession(){
        // Game.setGameOver uses this same monitor. Do not overwrite its completed PlayerStatistics.
        // concessionRequested already blocks bridge graph reads/queued commands before acquiring it.
        synchronized(game){
            if(game.isGameOver())return false;controller.concede();
            // In a Commander pod the CPUs would play on without you: the match ends for you here.
            if(!game.isGameOver()&&game.getRegisteredPlayers().size()>2){game.setGameOver(forge.game.GameEndReason.AllHumansLost);controller.getInputQueue().onGameOver(true);}
            return true;
        }
    }
    void requestConcession(){
        concessionRequested=true;busy=true;selection=Selection.NONE;clearSmartIntent();promptGeneration.incrementAndGet();publish();
        concessionThread=new Thread(()->{
            try{
                concessionApplied=invokeNativeConcession();
                GameOutcome outcome=game.getOutcome();
                if(!game.isGameOver()||outcome==null)throw new IllegalStateException("native_concession_no_outcome");
                // Read terminal result fields only. Never walk the live game/card graph.
                Integer winner=winnerId();String winnerName=outcome.getWinningLobbyPlayer()==null?null:outcome.getWinningLobbyPlayer().getName();
                Pending canceled;
                synchronized(lock){
                    nativeOutcomeConfirmed=true;finished=true;busy=false;selection=Selection.NONE;
                    Map<String,Object> terminal=new LinkedHashMap<>(board);
                    terminal.putAll(obj("gameOver",true,"winner",winnerName,"winnerPlayerId",winner,"draw",outcome.isDraw(),"terminalBoardFrozen",true));board=terminal;
                    canceled=pending;pending=null;publish();
                }
                concessionTerminal.complete(null);
                if(canceled!=null)canceled.answer.completeExceptionally(new NativeMatchEnded());
                var other=peer;if(other!=null)other.endFromPeer();
                System.out.println("NATIVE_CONCESSION_CONFIRMED winner="+winner+" draw="+outcome.isDraw());
            }catch(Throwable t){recordFailure(t);concessionTerminal.completeExceptionally(t);synchronized(lock){if(pending!=null)pending.answer.completeExceptionally(t);publish();}}
        },"forge-native-concede");
        concessionThread.start();
    }
    final Map<Integer,CardView> exposedCards = new ConcurrentHashMap<>();
    final Map<Integer,StackItemView> exposedStack = new ConcurrentHashMap<>();

    static final class Pending {
        final GuiGameEvent event;
        final CompletableFuture<Object> answer = new CompletableFuture<>();
        forge.gamemodes.match.input.Input originInput;
        long generation;
        final Map<String,Object> dto;
        final List<?> options;
        final int min, max;
        Pending(GuiGameEvent event, Map<String,Object> dto, List<?> options, int min, int max) {
            this.event=event; this.dto=dto; this.options=options; this.min=min; this.max=max;
        }
    }
    static Map<String,Object> obj(Object... values) {
        Map<String,Object> m=new LinkedHashMap<>();
        for(int i=0;i<values.length;i+=2) m.put((String)values[i],values[i+1]);
        return m;
    }
    static Integer id(TrackableObject o) { return o==null?null:o.getId(); }

    public static void main(String[] args) throws Exception {
        System.setProperty("java.awt.headless","true");
        String root=System.getProperty("proof.root");
        GuiBase.setInterface(new GuiDesktop() {
            @Override public String getAssetsDir(){ return root+"/forge/forge-gui/"; }
        });
        FModel.initialize(null, prefs -> {
            prefs.setPref(FPref.USE_SENTRY,false);
            prefs.setPref(FPref.UI_ENABLE_AI_CHEATS,false);
            prefs.setPref(FPref.UI_SHOW_ACTIONABLE_HIGHLIGHTS,true);
            prefs.setPref(FPref.UI_SHOW_AUTOTAP_PREVIEW,true);
            prefs.setPref(FPref.YIELD_AUTO_PASS_RESPECTS_INTERRUPTS,false);
            prefs.setPref(FPref.PLAYER_NAME,"CardStashy");
            prefs.setPref(FPref.DECKGEN_CARDBASED,false);
            prefs.setPref(FPref.YIELD_AUTO_PASS_NO_ACTIONS,false);
            prefs.setPref(FPref.YIELD_DECLINE_SCOPE_STACK_YIELD,"NEVER");
            prefs.setPref(FPref.YIELD_DECLINE_SCOPE_NO_ACTIONS,"NEVER");
            // Scry and Surveil of 2+ then ask through choose-and-order dialogs the table can
            // answer, instead of picking cards on Forge's own library display.
            prefs.setPref(FPref.UI_SELECT_FROM_CARD_DISPLAYS,false);
            return null;
        });
        ForgeHttpBridge bridge=new ForgeHttpBridge();
        int port=Integer.parseInt(System.getProperty("proof.port","8765"));
        bridge.serve(port);
        Files.writeString(Path.of(root,"adapter","connection.json"),JSON.toJson(obj("baseUrl","http://127.0.0.1:"+port,"token",bridge.token,"forgeRevision",REV)));
        System.out.println("BRIDGE_LISTENING http://127.0.0.1:"+port+" (token in adapter/connection.json)");
        Map<String,Object> humanPriorityProof;
        try{humanPriorityProof=NativeHumanPriorityProof.verify(root);NativeCpuPolicyIntegration.install(root);}catch(Exception e){
            bridge.failure="native_ai_startup_rejected:"+e.getMessage();bridge.published.set(obj("schema","cardstashy.forge-proof.v1","status","failed","failure",bridge.failure,"initialization",obj("supported",false,"legal",false,"errors",List.of(bridge.failure))));return;
        }
        String inputPath=System.getProperty("proof.matchInput");
        if(inputPath!=null){
            try{
                bridge.exactAdmission=NativeDeckAdmission.loadBootstrap(Path.of(inputPath));
                bridge.exactAdmission.receipt().put("humanPriority",humanPriorityProof);
                if(!bridge.exactAdmission.admitted()){
                    bridge.failure="exact_deck_initialization_not_admitted";
                    bridge.published.set(obj("schema","cardstashy.forge-proof.v1","status","failed","failure",bridge.failure,"initialization",bridge.exactAdmission.receipt()));return;
                }
                bridge.cpuPolicy=NativeCpuPolicyIntegration.parse(bridge.exactAdmission.input().get("difficultyPolicyVersion").getAsString());
                bridge.controlMode="smart";
            }catch(Exception e){bridge.failure="exact_deck_initialization_rejected:"+e.getMessage();bridge.published.set(obj("schema","cardstashy.forge-proof.v1","status","failed","failure",bridge.failure,"initialization",obj("supported",false,"legal",false,"errors",List.of(e.getMessage()))));return;}
        }else if(Boolean.getBoolean("proof.requireExact")){
            bridge.failure="exact_deck_input_required";bridge.published.set(obj("schema","cardstashy.forge-proof.v1","status","failed","failure",bridge.failure));return;
        }
        try{
            if(bridge.cpuPolicy==null)bridge.cpuPolicy=NativeCpuPolicyIntegration.parse(System.getProperty("proof.cpuPolicy",""));
            bridge.start(root,Long.parseLong(System.getProperty("proof.seed","20261025")));
        }catch(Exception e){bridge.failure="native_start_rejected:"+e.getMessage();if(bridge.exactAdmission!=null){bridge.exactAdmission.receipt().put("supported",false);bridge.exactAdmission.receipt().put("errors",List.of(bridge.failure));}bridge.published.set(obj("schema","cardstashy.forge-proof.v1","status","failed","failure",bridge.failure,"initialization",bridge.exactAdmission==null?null:bridge.exactAdmission.receipt()));}
    }

    void start(String root,long seed) {
        MyRandom.setRandom(new Random(seed));
        humanDeckAlias=System.getProperty("proof.humanDeck","calling-all-angels");
        aiDeckAlias=System.getProperty("proof.aiDeck","keen-engineering");
        Deck keen=exactAdmission==null?loadDeck(root,humanDeckAlias):exactAdmission.human().deck();
        Deck reign=exactAdmission==null?loadDeck(root,aiDeckAlias):exactAdmission.opponent().deck();
        if(exactAdmission!=null){humanDeckAlias=keen.getName();aiDeckAlias=reign.getName();}
        NativeMatchFormat format=exactAdmission==null?NativeMatchFormat.Commander:NativeMatchFormat.parse(exactAdmission.input().get("format").getAsString());
        humanDeckCount=keen.getMain().countAll()+NativeMatchFormat.count(keen,DeckSection.Commander);
        aiDeckCount=reign.getMain().countAll()+NativeMatchFormat.count(reign,DeckSection.Commander);
        startingPlayer=exactAdmission==null?null:NativeStartingPlayer.parse(exactAdmission.input());
        humanOpponent=exactAdmission!=null&&exactAdmission.humanOpponent();
        String firstName=humanOpponent?"Player 1":"Human";
        RegisteredPlayer human=format.register(keen).setPlayer(startingPlayer==null?new LobbyPlayerHuman(firstName,0,0):startingPlayer.humanLobby(firstName));
        RegisteredPlayer ai;
        if(humanOpponent){
            ai=format.register(reign).setPlayer(startingPlayer.humanLobby("Player 2"));
            System.out.println("FRIEND_MATCH two human seats");
        }else{
            var aiLobby=cpuPolicy.createLobby("Forge AI — "+reign.getName());
            if(startingPlayer!=null)aiLobby=startingPlayer.aiLobby(aiLobby);
            aiLobby.setAvatarIndex(1);
            actualAiProfile=aiLobby.getAiProfile();
            System.out.println("AI_PROFILE "+actualAiProfile);
            ai=format.register(reign).setPlayer(aiLobby);
        }
        List<RegisteredPlayer> seats=new ArrayList<>(List.of(human,ai));
        if(exactAdmission!=null)for(int i=0;i<exactAdmission.extras().size();i++){
            Deck extra=exactAdmission.extras().get(i).deck();
            var lobby=exactAdmission.extraPolicies().get(i).createLobby("Forge AI "+(i+2)+" — "+extra.getName());
            if(startingPlayer!=null)lobby=startingPlayer.aiLobby(lobby);
            lobby.setAvatarIndex(i+2);
            seats.add(format.register(extra).setPlayer(lobby));
        }
        if(exactAdmission!=null)NativeDeckAdmission.verifyRegistered(exactAdmission,human.getDeck(),ai.getDeck(),seats.subList(2,seats.size()).stream().map(RegisteredPlayer::getDeck).toArray(Deck[]::new));
        GameRules rules=new GameRules(format.gameType);
        rules.setAppliedVariants(format.variants());
        rules.setGamesPerMatch(1);
        // AI strategy advisories are retained in exactAdmission.seats.cpuWarnings.
        // They are not rules choices and must not block the pregame toss.
        if(startingPlayer!=null)rules.setWarnAboutAICards(false);
        rules.setAllowCheatShuffle(false);
        Match match=new Match(rules,List.copyOf(seats),"CardStashy Forge proof");
        game=match.createGame();
        game.AI_FLAT_MONTE_CARLO=false;game.AI_FLAT_MONTE_CARLO_MAX=false;
        for(Player p:game.getPlayers())if(p.getController() instanceof forge.ai.PlayerControllerAi aiController){
            aiController.getAi().setFlatMonteCarloOverride(false);aiController.getAi().setFlatMonteCarloMaxOverride(false);aiController.getAi().setFlatMonteCarloAttackOverride(false);
        }
        NativeCpuPolicyIntegration.verifyRuntime(exactAdmission,cpuPolicy,game);
        for(int i=1;i<game.getPlayers().size();i++){
            Deck d=i==1?reign:exactAdmission.extras().get(i-2).deck();
            seatDeckAlias.put(game.getPlayers().get(i).getId(),d.getName());
            seatDeckCount.put(game.getPlayers().get(i).getId(),d.getMain().countAll()+NativeMatchFormat.count(d,DeckSection.Commander));
        }
        GameEventForwarder forwarder=attach((PlayerControllerHuman)game.getPlayers().get(0).getController());
        if(exactAdmission!=null)exactAdmission.receipt().put("viewerId",viewer.getId());
        if(humanOpponent){
            ForgeHttpBridge second=new ForgeHttpBridge();
            second.exactAdmission=exactAdmission;second.cpuPolicy=cpuPolicy;second.startingPlayer=startingPlayer;second.controlMode=controlMode;
            second.humanOpponent=true;second.game=game;
            second.humanDeckAlias=aiDeckAlias;second.aiDeckAlias=humanDeckAlias;second.humanDeckCount=aiDeckCount;second.aiDeckCount=humanDeckCount;
            second.attach((PlayerControllerHuman)game.getPlayers().get(1).getController());
            exactAdmission.receipt().put("guestViewerId",second.viewer.getId());
            second.peer=this;peer=second;
        }
        for(Player p:game.getPlayers())p.updateOpponentsForView();
        new Thread(()-> {
            try {
                match.startGame(game);
                if(concessionRequested)awaitConcession();
                var second=peer;
                // The other seat conceded: its own thread confirms the result and ends that seat.
                if(second!=null&&second.concessionRequested)try{second.concessionTerminal.get(30,TimeUnit.SECONDS);}catch(Exception ignored){}
                forwarder.flush();
                finished=true;
                refreshBoard(); publish();
                if(second!=null)second.endFromPeer();
                System.out.println("BRIDGE_GAME_OVER "+game.getOutcome());
            } catch(Throwable t) {
                recordFailure(t);
                publish();
                var second=peer;
                if(second!=null&&second.failure==null){second.failure=failure;second.publish();}
            }
        },"forge-native-match").start();
    }

    /** Bind this bridge to one human seat of the game: its controller, its view and its prompts. */
    GameEventForwarder attach(PlayerControllerHuman seat){
        controller=seat;
        viewer=controller.getPlayer().getView();
        // Forge's network GUI never reports a skipped phase, so the yield controller's
        // phase stops would be ignored. Read them from the controller that owns them.
        gui=new ProtocolGuiGame(this){
            @Override public boolean isUiSetToSkipPhase(PlayerView turnPlayer, forge.game.phase.PhaseType phase){
                return controller!=null&&turnPlayer!=null&&controller.getYieldController().isSkippingPhase(turnPlayer,phase);
            }
        };
        controller.setGui(gui);
        gui.setGameView(game.getView());
        gui.setOriginalGameController(viewer,controller);
        if(!Set.of("smart","full").contains(controlMode))throw new IllegalArgumentException("controlMode must be smart or full");
        applyControlMode();
        game.subscribeToEvents(this);
        GameEventForwarder forwarder=new GameEventForwarder(gui);
        gui.setForwarder(forwarder);
        game.subscribeToEvents(forwarder);
        game.subscribeToEvents(controller.getYieldController());
        controller.getInputQueue().addObserver(forwarder);
        return forwarder;
    }
    /** A friend match ended on the other seat (a win, a loss or their concession): end it here too,
     * and release any choice still open on this seat so Forge's game thread is never left waiting. */
    void endFromPeer(){
        Pending canceled;
        synchronized(lock){
            if(finished)return;
            finished=true;busy=false;selection=Selection.NONE;clearSmartIntent();promptGeneration.incrementAndGet();
            if(game!=null&&game.isGameOver()&&game.getOutcome()!=null){
                Map<String,Object> terminal=new LinkedHashMap<>(board);
                terminal.putAll(obj("gameOver",true,"winner",game.getOutcome().getWinningLobbyPlayer()==null?null:game.getOutcome().getWinningLobbyPlayer().getName(),"winnerPlayerId",winnerId(),"draw",game.getOutcome().isDraw(),"terminalBoardFrozen",true));
                board=terminal;
            }
            canceled=pending;pending=null;publish();
        }
        if(canceled!=null)canceled.answer.completeExceptionally(new NativeMatchEnded());
        try{controller.getInputQueue().onGameOver(true);}catch(RuntimeException ignored){}
    }
    @com.google.common.eventbus.Subscribe
    public void onGameStarted(forge.game.event.GameEventGameStarted event){
        if(startingPlayer==null||event.firstTurn()==null||!pregame.isEmpty())return;
        pregame=obj("schema","cardstashy.forge-pregame.v1","firstPlayerId",event.firstTurn().getId(),"selection",startingPlayer.selection(),"playStyle",startingPlayer.playStyle());
        if(exactAdmission!=null)exactAdmission.receipt().put("pregame",pregame);
        // A friend match: the seat not asked to act first gets no prompt to publish, so it would
        // keep reporting "initializing" and the host never sees the table ready. Publish it now.
        if(humanOpponent){refreshBoard();publish();}
    }

    @com.google.common.eventbus.Subscribe
    public void onPhase(forge.game.event.GameEventTurnPhase event){
        if(failure!=null){effectiveAutoPass=false;return;}
        boolean ownMain=event.playerTurn()!=null&&event.playerTurn().getId()==viewer.getId()
            &&(event.phase()==forge.game.phase.PhaseType.MAIN1||event.phase()==forge.game.phase.PhaseType.MAIN2);
        String here=event.playerTurn()==null||event.phase()==null?null:stopKey(event.playerTurn(),event.phase());
        // A one-time stop holds through its step and is gone once the game moves past it.
        boolean expired=false;
        for(String k:List.copyOf(reachedOnceStops))if(!k.equals(here)){reachedOnceStops.remove(k);if(Boolean.FALSE.equals(phaseStops.get(k))){phaseStops.remove(k);expired=true;}}
        if(here!=null&&Boolean.FALSE.equals(phaseStops.get(here)))reachedOnceStops.add(here);
        if(expired)applyStops();
        effectiveAutoPass=failure==null&&controlMode.equals("smart")&&!ownMain&&(here==null||!phaseStops.containsKey(here));
        controller.getYieldController().setPref(FPref.YIELD_AUTO_PASS_NO_ACTIONS,String.valueOf(effectiveAutoPass));
        if(event.phase()==forge.game.phase.PhaseType.COMBAT_BEGIN)setCombatStops(false);
    }
    // Forge appends bookkeeping such as "[Zone Changer: Gruul Turf (195)]" or "[Phase: ...]" to stack text.
    static final java.util.regex.Pattern STACK_BOOKKEEPING=java.util.regex.Pattern.compile("\\s*\\[[A-Z][A-Za-z ]*: [^\\]]*\\]");
    static String stackText(String text){return text==null?null:STACK_BOOKKEEPING.matcher(text).replaceAll("").trim();}
    static boolean smartStop(boolean ownTurn, forge.game.phase.PhaseType phase, boolean attackers){
        return switch(phase){
            case MAIN1, MAIN2 -> ownTurn;
            // Forge already skips blockers and damage when nobody attacks.
            case COMBAT_DECLARE_ATTACKERS -> attackers;
            case COMBAT_DECLARE_BLOCKERS -> true;
            default -> false;
        };
    }
    // Smart has no stop in a combat where nothing attacks: each combat starts without the
    // declare-attackers stop, and it comes back only once real attackers are declared.
    // Forge fires both events on the game thread before anyone gets priority in that step.
    volatile boolean combatHasAttackers;
    void setCombatStops(boolean attackers){
        combatHasAttackers=attackers;
        if(controller==null||game==null||failure!=null)return;
        var yc=controller.getYieldController();
        for(PlayerView p:game.getView().getPlayers())
            yc.setSkipPhase(p,forge.game.phase.PhaseType.COMBAT_DECLARE_ATTACKERS,skipsPhase(p,forge.game.phase.PhaseType.COMBAT_DECLARE_ATTACKERS));
    }
    String stopKey(PlayerView p,forge.game.phase.PhaseType phase){return (p.getId()==viewer.getId()?"you":"opponent")+":"+phase.name();}
    // Smart skips a step unless it is one of Smart's own stops or a stop the player set.
    boolean skipsPhase(PlayerView p,forge.game.phase.PhaseType phase){
        return controlMode.equals("smart")&&!smartStop(p.getId()==viewer.getId(),phase,combatHasAttackers)&&!phaseStops.containsKey(stopKey(p,phase));
    }
    void applyStops(){
        if(controller==null||game==null||failure!=null)return;
        var yc=controller.getYieldController();
        for(PlayerView p:game.getView().getPlayers())for(var phase:forge.game.phase.PhaseType.values())yc.setSkipPhase(p,phase,skipsPhase(p,phase));
    }
    @com.google.common.eventbus.Subscribe public void endTurnYields(forge.game.event.GameEventTurnBegan e){
        if(controller==null)return;var yc=controller.getYieldController();
        for(String key:List.copyOf(turnYields)){yc.setShouldAutoYield(key,false,true);turnYields.remove(key);}
    }
    @com.google.common.eventbus.Subscribe public void smartCombat(forge.game.event.GameEventAttackersDeclared e){setCombatStops(!e.attackersMap().isEmpty());}
    // A watched CPU turn shows each visible action on its own, like a person playing:
    // land, spell or ability, attackers, blockers. Triggers, the player's own turn and
    // an unwatched table are never slowed. 0 turns pacing off.
    static final long CPU_STEP_PAUSE_MS=Long.getLong("cardstashy.cpuStepPauseMs",650L);
    volatile long lastStatePollNanos=System.nanoTime();
    void paceCpu(PlayerView actor){
        if(CPU_STEP_PAUSE_MS<=0||humanOpponent||actor==null||viewer==null||actor.getId()==viewer.getId()||failure!=null||concessionRequested||finished)return;
        if(System.nanoTime()-lastStatePollNanos>3_000_000_000L)return;
        refreshBoard();publish();
        try{Thread.sleep(CPU_STEP_PAUSE_MS);}catch(InterruptedException e){Thread.currentThread().interrupt();}
    }
    @com.google.common.eventbus.Subscribe public void onCpuLand(forge.game.event.GameEventLandPlayed e){paceCpu(e.player());}
    @com.google.common.eventbus.Subscribe public void onCpuCast(forge.game.event.GameEventSpellAbilityCast e){if(e.si()!=null&&!e.si().isTrigger())paceCpu(e.si().getActivatingPlayer());}
    @com.google.common.eventbus.Subscribe public void onCpuAttack(forge.game.event.GameEventAttackersDeclared e){if(!e.attackersMap().isEmpty())paceCpu(e.player());}
    @com.google.common.eventbus.Subscribe public void onCpuBlock(forge.game.event.GameEventBlockersDeclared e){if(e.blockers().values().stream().anyMatch(m->!m.isEmpty()))paceCpu(e.defendingPlayer());}
    // What happened, in order, so the table can replay what lands between two polls:
    // draws, land plays, casts and abilities, resolutions, zone moves, attacks, blocks,
    // damage, life, counters and attachments. Viewer-safe: a card is listed only when the
    // viewer may see it where it is now, and named only when its face is visible, so a
    // CPU draw or a card going to a hidden hand carries no identity. Read-only.
    static final int EVENT_LOG_SIZE=96;
    final Object eventLock=new Object();
    final ArrayDeque<Map<String,Object>> eventLog=new ArrayDeque<>();
    long eventSeq=0;
    void logEvent(String type,Object... values){
        if(viewer==null||game==null||failure!=null||concessionRequested)return;
        var ph=game.getPhaseHandler();
        Map<String,Object> e=obj("seq",0L,"type",type,"turn",ph.getTurn(),"phase",ph.getPhase()==null?null:ph.getPhase().name());
        e.putAll(obj(values));
        synchronized(eventLock){e.put("seq",++eventSeq);eventLog.addLast(e);while(eventLog.size()>EVENT_LOG_SIZE)eventLog.removeFirst();}
    }
    Map<String,Object> eventsView(boolean withItems){
        synchronized(eventLock){return obj("schema","cardstashy.forge-events.v1","latest",eventSeq,"items",withItems?new ArrayList<>(eventLog):List.of());}
    }
    Map<String,Object> cardRef(CardView c){
        if(c==null||viewer==null||!c.canBeShownTo(viewer))return null;
        Map<String,Object> m=obj("kind","card","id",c.getId());
        if(c.canFaceDownBeShownTo(viewer)&&c.getCurrentState()!=null)m.put("name",c.getCurrentState().getName());
        return m;
    }
    Map<String,Object> entityRef(Object o){
        if(o instanceof PlayerView p)return obj("kind","player","id",p.getId());
        if(o instanceof CardView c)return cardRef(c);
        if(o instanceof StackItemView si)return obj("kind","stack","id",si.getId());
        return null;
    }
    List<Object> entityRefs(Iterable<?> values){
        List<Object> out=new ArrayList<>();
        if(values!=null)for(Object o:values){var r=entityRef(o);if(r!=null)out.add(r);}
        return out;
    }
    @com.google.common.eventbus.Subscribe public void logTurn(forge.game.event.GameEventTurnBegan e){logEvent("turn","player",id(e.turnOwner()),"number",e.turnNumber());}
    @com.google.common.eventbus.Subscribe public void logZone(forge.game.event.GameEventCardChangeZone e){
        if(e.card()==null)return;
        logEvent("zone","card",cardRef(e.card()),"from",e.from()==null?null:e.from().zoneType().name(),"to",e.to()==null?null:e.to().zoneType().name(),
            "player",e.to()!=null?id(e.to().player()):e.from()!=null?id(e.from().player()):null,"token",e.card().isToken());
    }
    @com.google.common.eventbus.Subscribe public void logLand(forge.game.event.GameEventLandPlayed e){logEvent("land","player",id(e.player()),"card",cardRef(e.land()));}
    @com.google.common.eventbus.Subscribe public void logCast(forge.game.event.GameEventSpellAbilityCast e){
        var si=e.si();if(si==null)return;
        logEvent(si.isTrigger()?"trigger":si.isAbility()?"ability":"cast","player",id(si.getActivatingPlayer()),"stackId",si.getId(),"source",cardRef(si.getSourceCard()),"targets",entityRefs(stackTargets(si)));
    }
    @com.google.common.eventbus.Subscribe public void logResolve(forge.game.event.GameEventSpellResolved e){
        logEvent("resolve","source",e.spell()==null?null:cardRef(e.spell().getHostCard()),"fizzled",e.hasFizzled());
    }
    @com.google.common.eventbus.Subscribe public void logAttack(forge.game.event.GameEventAttackersDeclared e){
        List<Object> attackers=new ArrayList<>();
        for(var entry:e.attackersMap().entries()){var a=cardRef(entry.getValue());if(a!=null){a.put("target",entityRef(entry.getKey()));attackers.add(a);}}
        if(!attackers.isEmpty())logEvent("attack","player",id(e.player()),"attackers",attackers);
    }
    @com.google.common.eventbus.Subscribe public void logBlock(forge.game.event.GameEventBlockersDeclared e){
        // Forge lists an unblocked attacker as its own blocker; only real blocks are kept.
        List<Object> blocks=new ArrayList<>();
        for(var byDefender:e.blockers().values())for(var entry:byDefender.entries()){
            if(entry.getKey()==null||entry.getValue()==null||entry.getKey().getId()==entry.getValue().getId())continue;
            var b=cardRef(entry.getValue());var a=cardRef(entry.getKey());
            if(b!=null&&a!=null){b.put("blocking",a.get("id"));blocks.add(b);}
        }
        if(!blocks.isEmpty())logEvent("block","player",id(e.defendingPlayer()),"blockers",blocks);
    }
    @com.google.common.eventbus.Subscribe public void logCardDamage(forge.game.event.GameEventCardDamaged e){
        var target=cardRef(e.card());if(target==null)return;
        logEvent("damage","target",target,"source",cardRef(e.source()),"amount",e.amount(),"kind",e.type()==null?null:e.type().name());
    }
    @com.google.common.eventbus.Subscribe public void logPlayerDamage(forge.game.event.GameEventPlayerDamaged e){
        logEvent("damage","target",entityRef(e.target()),"source",cardRef(e.source()),"amount",e.amount(),"combat",e.combat(),"infect",e.infect());
    }
    @com.google.common.eventbus.Subscribe public void logLife(forge.game.event.GameEventPlayerLivesChanged e){logEvent("life","player",id(e.player()),"from",e.oldLives(),"to",e.newLives());}
    @com.google.common.eventbus.Subscribe public void logCounters(forge.game.event.GameEventCardCounters e){
        var c=cardRef(e.card());if(c==null||e.type()==null)return;
        logEvent("counters","card",c,"counter",e.type().toString(),"from",e.oldValue(),"to",e.newValue());
    }
    @com.google.common.eventbus.Subscribe public void logAttach(forge.game.event.GameEventCardAttachment e){
        var c=cardRef(e.equipment());if(c==null)return;
        logEvent("attach","card",c,"from",entityRef(e.oldEntity()),"to",entityRef(e.newTarget()));
    }
    @com.google.common.eventbus.Subscribe public void logMulligan(forge.game.event.GameEventMulligan e){logEvent("mulligan","player",id(e.player()));}
    @com.google.common.eventbus.Subscribe public void logShuffle(forge.game.event.GameEventShuffle e){logEvent("shuffle","player",id(e.player()));}
    @com.google.common.eventbus.Subscribe public void logDayNight(forge.game.event.GameEventDayTimeChanged e){logEvent("dayNight","value",e.daytime()?"day":"night");}
    void applyControlMode(){
        if(failure!=null){effectiveAutoPass=false;clearSmartIntent();autoPayAttemptInput=null;return;}
        if(!autoPay())clearSmartIntent();
        var yc=controller.getYieldController();
        yc.setPref(FPref.YIELD_AUTO_PASS_RESPECTS_INTERRUPTS,"false");
        yc.clearActiveYieldAndDispatch();
        // Smart follows MTG Arena: with an empty stack, priority is passed for you except
        // in your main phases and in combat after attackers or blockers are declared.
        // Anything on the stack still stops you when you can respond; Full Control stops everywhere.
        for(PlayerView p:game.getView().getPlayers())for(var phase:forge.game.phase.PhaseType.values())
            yc.setSkipPhase(p,phase,skipsPhase(p,phase));
        var ph=game.getPhaseHandler();
        boolean ownMain=ph.getPlayerTurn()!=null&&ph.getPlayerTurn().getId()==viewer.getId()
            &&(ph.getPhase()==forge.game.phase.PhaseType.MAIN1||ph.getPhase()==forge.game.phase.PhaseType.MAIN2);
        effectiveAutoPass=failure==null&&controlMode.equals("smart")&&!ownMain;
        yc.setPref(FPref.YIELD_AUTO_PASS_NO_ACTIONS,String.valueOf(effectiveAutoPass));
    }
    static Deck loadDeck(String root,String alias){
        if(!DECK_ALIASES.contains(alias))throw new IllegalArgumentException("Unknown local precon alias: "+alias);
        Deck deck=DeckSerializer.fromFile(new File(root+"/decks/"+alias+".dck"));
        if(deck==null||deck.getCommanders().size()!=1||deck.getMain().countAll()+deck.getCommanders().size()!=100)
            throw new IllegalStateException("Expected intact 100-card Commander precon: "+alias);
        return deck;
    }
    @Override public void send(NetEvent event) {
        if(!(event instanceof GuiGameEvent e)) return;
        Object[] a=e.getObjects();
        if(e.getMethod()==ProtocolMethod.setGameView||e.getMethod()==ProtocolMethod.applyDelta)refreshBoard();
        // Forge skips a selection equal to the last one (often none), so the prompt's
        // buttons and message also mark a new priority input.
        if(e.getMethod()==ProtocolMethod.setSelection)noteBlocked((Selection)a[0]);
        else if(e.getMethod()==ProtocolMethod.updateButtons||e.getMethod()==ProtocolMethod.showPromptMessage)noteBlocked(selection);
        if(e.getMethod()==ProtocolMethod.setSelection||e.getMethod()==ProtocolMethod.updateButtons||e.getMethod()==ProtocolMethod.showPromptMessage)noteMustAttack();
        synchronized(lock){ switch(e.getMethod()) {
            case showPromptMessage -> message=(String)a[1];
            case updateButtons -> { buttons=obj("ok",a[1],"cancel",a[2],"okEnabled",a[3],"cancelEnabled",a[4]); busy=false; }
            case setSelection -> { selection=(Selection)a[0]; busy=false; }
            case awaitNextInput -> { busy=true; recheckBusy(); }
            case flashIncorrectAction -> { busy=false; }
            case message,showErrorDialog -> {notification=obj("method",e.getMethod().name(),"message",a[0],"title",a.length>1?a[1]:null); busy=false;}
            default -> { }
        }
        // Raw GameView, DeltaPacket, arbitrary events and private logs NEVER cross HTTP.
        // Reserve Smart payment before exposing this update to a concurrent HTTP reader.
        // Publishing an enabled Auto button first creates a second, obsolete human action.
        maybeNativeAutoPay();
        // In a friend match nothing paces the other person's plays, so a board change is published
        // as it arrives; otherwise this seat would show a stale board until its own next prompt.
        if(humanOpponent&&(e.getMethod()==ProtocolMethod.setGameView||e.getMethod()==ProtocolMethod.applyDelta))publish();
        if(e.getMethod()==ProtocolMethod.setSelection || e.getMethod()==ProtocolMethod.updateButtons || e.getMethod()==ProtocolMethod.showPromptMessage || e.getMethod()==ProtocolMethod.flashIncorrectAction || e.getMethod()==ProtocolMethod.message || e.getMethod()==ProtocolMethod.showErrorDialog) publish();
        }
    }
    // Forge's lock-UI timer can send awaitNextInput after the next priority prompt is already
    // showing, and nothing clears busy for that prompt, so the table reads "Resolving" while
    // Forge waits on the player. If the same live input is still up shortly after, it was stale.
    static final ScheduledExecutorService BUSY_RECHECK=Executors.newSingleThreadScheduledExecutor(r->{Thread t=new Thread(r,"cardstashy-busy-recheck");t.setDaemon(true);return t;});
    void recheckBusy(){
        PlayerControllerHuman c=controller;if(c==null)return;
        forge.gamemodes.match.input.Input in=c.getInputProxy().getInput();
        if(in==null||in instanceof forge.gamemodes.match.input.InputLockUI)return;
        BUSY_RECHECK.schedule(()->{
            boolean changed=false;
            synchronized(lock){
                if(busy&&!commandInFlight&&pending==null&&failure==null&&!finished&&!concessionRequested
                    &&c.getInputProxy().getInput()==in){busy=false;changed=true;}
            }
            if(changed)publish();
        },300,TimeUnit.MILLISECONDS);
    }
    void clearSmartIntent(){smartIntentOrigin=null;smartIntentAbility=null;}
    // Trustworthy glow. selection.actionable is what can be finished now (the human
    // overlay proves the cost can be paid), so only those cards glow. A card with an
    // ability that can't be used now is listed in selection.blocked with the reason,
    // so the table can say why it doesn't glow. Read only while the game thread waits
    // on this priority prompt, on the player's own cards, within a small time budget.
    static final long BLOCKED_BUDGET_MS=Long.getLong("cardstashy.blockedBudgetMs",150L);
    volatile forge.gamemodes.match.input.Input blockedInput;
    volatile List<Map<String,Object>> blocked=List.of();
    // Per glowing card: affordability ("available" when the overlay proves the cost can be paid,
    // else "unknown"), tapPreview (the sources Forge's Auto would tap, in order) and tapWarning.
    volatile Map<Integer,Map<String,Object>> affordability=Map.of();
    void noteBlocked(Selection sel){
        var input=controller==null?null:controller.getInputProxy().getInput();
        if(!(input instanceof forge.gamemodes.match.input.InputPassPriority)||failure!=null||concessionRequested||game==null){blockedInput=null;blocked=List.of();affordability=Map.of();return;}
        if(input==blockedInput)return;
        List<Map<String,Object>> out=new ArrayList<>();Map<Integer,Map<String,Object>> afford=new HashMap<>();Map<Integer,SpellAbility> plans=new HashMap<>();
        try{
            Player p=controller.getPlayer();Set<Integer> glowing=new HashSet<>();
            for(CardView c:sel.actionable())glowing.add(c.getId());
            long deadline=System.nanoTime()+BLOCKED_BUDGET_MS*1_000_000L;
            p.runWithController(()->{
                for(ZoneType zone:List.of(ZoneType.Hand,ZoneType.Battlefield,ZoneType.Command,ZoneType.Flashback))for(var c:p.getCardsIn(zone)){
                    if(glowing.contains(c.getId())&&System.nanoTime()<deadline)afford.put(c.getId(),affordability(c,p,deadline,plans));
                }
                for(ZoneType zone:List.of(ZoneType.Hand,ZoneType.Battlefield,ZoneType.Command,ZoneType.Flashback))for(var c:p.getCardsIn(zone)){
                    if(System.nanoTime()>=deadline)return;
                    if(glowing.contains(c.getId()))continue;
                    String reason=blockedReason(c,p,deadline);
                    if(reason!=null)out.add(obj("kind","card","id",c.getId(),"reason",reason));
                }
            },new forge.ai.PlayerControllerAi(game,p,p.getOriginalLobbyPlayer()));
        }catch(RuntimeException ignored){out.clear();afford.clear();plans.clear();}
        blocked=List.copyOf(out);affordability=Map.copyOf(afford);blockedInput=input;
        if(!plans.isEmpty())planTapsLater(input,plans);
    }
    /** Tap previews cost a cold planner run, so they are worked out just after the prompt is
     *  shown and added to that same publication (same revision): an action sent meanwhile stays valid. */
    void planTapsLater(forge.gamemodes.match.input.Input input,Map<Integer,SpellAbility> plans){
        forge.gui.FThreads.invokeInEdtLater(()->{
            if(input!=blockedInput||controller==null||input!=controller.getInputProxy().getInput()||failure!=null||concessionRequested)return;
            Map<Integer,Map<String,Object>> extra=new HashMap<>();
            try{
                Player p=controller.getPlayer();
                p.runWithController(()->{
                    for(var e:plans.entrySet()){Map<String,Object> m=new LinkedHashMap<>();tapPlan(e.getValue(),p,m);if(!m.isEmpty())extra.put(e.getKey(),m);}
                },new forge.ai.PlayerControllerAi(game,p,p.getOriginalLobbyPlayer()));
            }catch(RuntimeException ignored){return;}
            if(extra.isEmpty())return;
            synchronized(lock){
                if(input!=blockedInput||input!=publishedInput||busy||commandInFlight||pending!=null||failure!=null||concessionRequested)return;
                Map<Integer,Map<String,Object>> merged=new HashMap<>(affordability);
                for(var e:extra.entrySet()){Map<String,Object> m=new LinkedHashMap<>(merged.getOrDefault(e.getKey(),Map.of()));m.putAll(e.getValue());merged.put(e.getKey(),m);}
                affordability=Map.copyOf(merged);
                if(!(published.get().get("selection") instanceof Map<?,?> sel))return;
                Map<String,Object> nextSel=new LinkedHashMap<>();for(var e:sel.entrySet())nextSel.put((String)e.getKey(),e.getValue());
                nextSel.put("actionable",actionableRefs());
                Map<String,Object> next=new LinkedHashMap<>(published.get());next.put("selection",nextSel);published.set(next);
            }
        });
    }
    /** affordability: "available" when one usable ability of the card is proven payable now, otherwise "unknown". */
    static Map<String,Object> affordability(forge.game.card.Card c,Player p,long deadline,Map<Integer,SpellAbility> plans){
        SpellAbility first=null;
        for(SpellAbility sa:c.getAllPossibleAbilities(p,true)){
            if(sa.isManaAbility()||c.isInPlay()&&(sa.isSpell()||sa.isLandAbility()))continue;
            if(sa.isLandAbility())return obj("affordability","available");
            if(first==null)first=sa;
            if(forge.ai.HumanActionAffordability.assess(sa,p,deadline)==forge.ai.HumanActionAffordability.Assessment.AVAILABLE){
                plans.put(c.getId(),sa);return obj("affordability","available");
            }
        }
        if(first!=null)plans.put(c.getId(),first);
        return obj("affordability","unknown");
    }
    /** The sources Forge's own Auto would tap for this ability (Auto runs the same planner), and a
     *  warning when that plan costs life (pain lands) or sacrifices a source (Treasure). */
    static void tapPlan(SpellAbility sa,Player p,Map<String,Object> into){
        try{
            if(sa.getPayCosts()==null)return;
            var cost=forge.ai.ComputerUtilMana.calculateManaCost(sa.getPayCosts(),sa,p,true,0,false);
            if(cost==null||cost.isPaid())return;
            var sources=forge.ai.ComputerUtilMana.getManaSourcesToPayCost(cost,sa,p,false);
            if(sources==null||sources.isEmpty())return;
            List<Integer> ids=new ArrayList<>();String warning=null;
            // Life is at risk only when a coloured symbol has more copies than the planned
            // sources can make without pain (a pain land's own colourless mana is free).
            int[] need=new int[5],painless=new int[5];int painfulAny=0,sacrificed=0,lifePaid=0;
            for(var shard:sa.getPayCosts().getTotalMana())if(shard.isMonoColor())
                for(int i=0;i<5;i++)if((shard.getColorMask()&forge.card.MagicColor.WUBRG[i])!=0)need[i]++;
            for(var src:sources){
                if(ids.contains(src.getId()))continue;
                ids.add(src.getId());
                boolean allSacrifice=!src.getManaAbilities().isEmpty();int free=0;
                for(SpellAbility ma:src.getManaAbilities()){
                    boolean sac=false,pain=false;
                    if(ma.getPayCosts()!=null)for(var part:ma.getPayCosts().getCostParts()){
                        if(part instanceof forge.game.cost.CostSacrifice)sac=true;
                        if(part instanceof forge.game.cost.CostPayLife)pain=true;
                    }
                    for(var sub=ma.getSubAbility();sub!=null;sub=sub.getSubAbility())
                        if(sub.getApi()==forge.game.ability.ApiType.DealDamage||sub.getApi()==forge.game.ability.ApiType.LoseLife)pain=true;
                    if(!sac)allSacrifice=false;
                    int colors=0;var part=ma.getManaPart();
                    if(part!=null)for(byte col:forge.card.MagicColor.WUBRG)if(part.canProduce(forge.card.MagicColor.toShortString(col),ma))colors|=col;
                    if(pain)painfulAny|=colors;else free|=colors;
                }
                if(allSacrifice){warning="sacrifice";sacrificed++;}
                for(int i=0;i<5;i++)if((free&forge.card.MagicColor.WUBRG[i])!=0)painless[i]++;
            }
            // tapWarningAmount: Treasures sacrificed, or life paid (1 per painful activation, as on pain lands).
            if(warning==null)for(int i=0;i<5;i++)
                if(need[i]>painless[i]&&(painfulAny&forge.card.MagicColor.WUBRG[i])!=0){warning="life";lifePaid+=need[i]-painless[i];}
            into.put("tapPreview",ids);
            if(warning!=null){into.put("tapWarning",warning);into.put("tapWarningAmount",warning.equals("sacrifice")?sacrificed:lifePaid);}
        }catch(RuntimeException ignored){/* no preview; Auto still decides */}
    }
    // Creatures the human must attack with this combat (Forge's own attack requirements:
    // "attacks each combat if able", goad and the like), read while InputAttack waits.
    volatile Set<Integer> mustAttack=Set.of();
    void noteMustAttack(){
        var input=controller==null?null:controller.getInputProxy().getInput();
        Set<Integer> ids=new HashSet<>();
        if(input instanceof forge.gamemodes.match.input.InputAttack&&failure==null&&!concessionRequested&&game!=null){
            try{
                var combat=game.getCombat();var constraints=combat==null?null:combat.getAttackConstraints();
                if(constraints!=null)for(var entry:constraints.getRequirements().entrySet())
                    if(entry.getValue()!=null&&entry.getValue().hasRequirement()&&entry.getKey().getController()==controller.getPlayer())ids.add(entry.getKey().getId());
            }catch(RuntimeException ignored){ids.clear();}
        }
        if(!ids.equals(mustAttack)){mustAttack=Set.copyOf(ids);refreshBoard();}
    }
    /** Why none of this card's abilities can be used now, or null when one can or the reason is unclear. */
    static String blockedReason(forge.game.card.Card c,Player p,long deadline){
        String best=null;int rank=0;
        // Forge drops abilities it can't use now from its list; the card's own ones say why.
        List<SpellAbility> all=new ArrayList<>(c.getAllPossibleAbilities(p,false));
        for(SpellAbility sa:c.getSpellAbilities())if(!all.contains(sa)){sa.setActivatingPlayer(p);all.add(sa);}
        for(SpellAbility sa:all){
            if(sa.isManaAbility()||c.isInPlay()&&(sa.isSpell()||sa.isLandAbility()))continue;
            if(!c.isInPlay()&&!sa.isSpell()&&!sa.isLandAbility())continue;
            String reason;int r;
            if(!sa.canPlay()){
                boolean sorcerySpeed=sa.isSpell()||sa.isLandAbility()?!sa.withFlash(c,p):sa.getRestrictions().isSorcerySpeed();
                if(sa.isLandAbility()&&p.canCastSorcery()){reason="Land already played";r=2;}
                else if(sorcerySpeed&&!p.canCastSorcery()){reason="Wrong timing";r=1;}
                else continue;
            }else if(!forge.ai.ComputerUtilAbility.isFullyTargetable(sa)){reason="No legal target";r=3;}
            else if(forge.ai.HumanActionAffordability.assess(sa,p,deadline)==forge.ai.HumanActionAffordability.Assessment.PROVEN_UNAVAILABLE){
                int need=sa.getPayCosts()==null?0:sa.getPayCosts().getTotalMana().getCMC();
                reason=need>0?"Need "+need+" mana":"Can't pay the cost";r=4;
            }else return null; // usable now, or not provably blocked: no reason
            if(r>rank){best=reason;rank=r;}
        }
        return best;
    }
    boolean nativePaymentPending(){
        return controller!=null && controller.getInputProxy().getInput() instanceof forge.gamemodes.match.input.InputPayMana payment
            && payment.isPaymentPending();
    }
    void armSmartSpellIntent(forge.gamemodes.match.input.Input input){
        clearSmartIntent();
        if(failure==null&&autoPay()&&input instanceof forge.gamemodes.match.input.InputPassPriority priority){
            var chosen=priority.getChosenSa();
            if(chosen!=null&&chosen.size()==1&&chosen.get(0).isSpell()){
                smartIntentOrigin=input;smartIntentAbility=chosen.get(0);
            }
        }
    }
    static boolean directSpellCostMatches(SpellAbility intended,SpellAbility paid,boolean alreadyOnStack){
        return intended!=null&&intended.isSpell()&&paid==intended&&!alreadyOnStack;
    }
    /** Use the exact enabled native Auto button once for the directly selected spell's initial cost. */
    void maybeNativeAutoPay(){ synchronized(lock){
        if(failure!=null||controller==null||concessionRequested)return;
        final var input=controller.getInputProxy().getInput();
        if(input instanceof forge.gamemodes.match.input.InputPassPriority && input!=smartIntentOrigin){
            clearSmartIntent();
        }
        if(!autoPay()||smartIntentOrigin==null||pending!=null||commandInFlight
            ||!(input instanceof forge.gamemodes.match.input.InputPayManaOfCostPayment)
            ||input==autoPayAttemptInput||!Boolean.TRUE.equals(buttons.get("okEnabled")))return;
        final SpellAbility paid=controller.getPlayer().getPaidForSA();
        // Copies/alternate costs and nested or resolving effects deliberately remain manual.
        boolean alreadyOnStack=false;
        for(SpellAbilityStackInstance si:game.getStack())if(si.getSpellAbility()==paid){alreadyOnStack=true;break;}
        if(!directSpellCostMatches(smartIntentAbility,paid,alreadyOnStack)){clearSmartIntent();return;}
        final long generation=promptGeneration.get();
        clearSmartIntent(); // consume BEFORE dispatch, so no later cost can inherit this intention
        autoPayAttemptInput=input;
        busy=true;commandInFlight=true;publish();
        SwingUtilities.invokeLater(()->{
            boolean invoked=false;
            try{
                if(failure==null&&!concessionRequested&&autoPay()&&pending==null&&controller.getPlayer().getPaidForSA()==paid
                    &&input==controller.getInputProxy().getInput()&&generation==promptGeneration.get()){
                    invoked=true;
                    nativeAutoPayments++;
                    System.out.println("NATIVE_AUTO_PAYMENT "+nativeAutoPayments);
                    input.selectButtonOK();
                }
            }catch(Throwable t){recordFailure(t);}
            finally{synchronized(lock){
                // No native command ran: restoring this unchanged UI is a proven no-op, not an async completion guess.
                if(failure==null&&!invoked&&input==controller.getInputProxy().getInput()&&pending==null&&generation==promptGeneration.get())busy=false;
                commandInFlight=false;publish();
            }}
        });
    }}
    @Override public Object sendAndWait(IdentifiableNetEvent event) {
        GuiGameEvent e=(GuiGameEvent)event;
        if(concessionRequested){
            // Native onPlayerLost can reveal face-down cards: this is display-only, no choice.
            if(Thread.currentThread()==concessionThread){
                Object[] a=e.getObjects();
                if(e.getMethod()==ProtocolMethod.getChoices && Integer.valueOf(-1).equals(a[1]) && Integer.valueOf(-1).equals(a[2]))return List.of();
                throw new IllegalStateException("unsupported_dialog_during_native_concession:"+e.getMethod());
            }
            return awaitConcession();
        }
        // A real setup decision cannot be serviced before the committed toss
        // receipt. Fail explicitly instead of deadlocking readiness or inventing
        // an answer. The optional AI strategy advisory is disabled in GameRules.
        if(startingPlayer!=null&&pregame.isEmpty()){
            unsupportedPregameChoice=true;
            throw new IllegalStateException(UNSUPPORTED_PREGAME_CHOICE);
        }
        // Matches desktop CMatchUI.getAbilityToPlay with triggerEvent==null, using only native offered abilities.
        if(failure==null&&controlMode.equals("smart")&&e.getMethod()==ProtocolMethod.getAbilityToPlay){
            List<?> abilities=(List<?>)e.getObjects()[1];
            if(abilities.isEmpty())return null;
            if(abilities.size()==1){System.out.println("NATIVE_SINGLETON_ABILITY");return abilities.get(0);}
        }
        Pending p=makePending(e);
        boolean terminalWait;
        synchronized(lock){ terminalWait=concessionRequested;
            if(!terminalWait){if(pending!=null&&!pending.answer.isDone())throw new IllegalStateException("Overlapping native dialog; refusing to replace pending input"); p.originInput=controller==null?null:controller.getInputProxy().getInput();p.generation=promptGeneration.incrementAndGet(); pending=p; busy=false; publish();}
        }
        if(terminalWait)return awaitConcession();
        System.out.println("NATIVE_PROMPT "+e.getMethod()+" id="+e.getId());
        Object result=null;boolean completed=false;
        try { result=p.answer.get();completed=true;return result; }
        catch(ExecutionException ex){if(ex.getCause() instanceof NativeMatchEnded ended)throw ended;throw new IllegalStateException("Native prompt interrupted",ex);} catch(InterruptedException ex){Thread.currentThread().interrupt();throw new IllegalStateException("Native prompt interrupted",ex);}
        finally { synchronized(lock){
            if(pending==p)pending=null;
            boolean nativeCancel=completed&&((e.getMethod()==ProtocolMethod.getAbilityToPlay&&result==null)
                ||(e.getMethod()==ProtocolMethod.showConfirmDialog&&Boolean.FALSE.equals(result)
                   &&p.originInput instanceof forge.gamemodes.match.input.InputPassPriority));
            boolean sameDecision=controller!=null&&p.originInput!=null
                &&p.originInput==controller.getInputProxy().getInput()
                &&p.generation==promptGeneration.get()&&pending==null
                &&!(p.originInput instanceof forge.gamemodes.match.input.InputLockUI);
            busy=!(nativeCancel&&sameDecision);
            if(nativeCancel&&sameDecision)clearSmartIntent();
            publish();
        }}
    }

    Pending makePending(GuiGameEvent e) {
        Object[] a=e.getObjects();
        String kind=e.getMethod().name(), text=kind;
        List<?> options=List.of(); int min=0,max=1; boolean supported=true; Map<String,Object> amounts=null;
        switch(e.getMethod()) {
            case getChoices -> {text=(String)a[0];min=(Integer)a[1];max=(Integer)a[2];options=(List<?>)a[3];}
            case getAbilityToPlay -> {text="Choose an ability";min=0;options=(List<?>)a[1];}
            case chooseSingleEntityForEffect -> {text=(String)a[0];min=(Boolean)a[3]?0:1;options=(List<?>)a[1];}
            case chooseEntitiesForEffect -> {text=(String)a[0];options=(List<?>)a[1];min=(Integer)a[2];max=(Integer)a[3];}
            case showOptionDialog -> {text=(String)a[0];options=(List<?>)a[3];min=1;}
            case confirm -> {text=(String)a[1];options=(List<?>)a[3];}
            case showConfirmDialog -> {text=(String)a[0];options=List.of(a[2],a[3]);}
            case showInputDialog -> {text=(String)a[0];options=a[4]==null?List.of():(List<?>)a[4];}
            case order -> {
                text=a[0]+" — "+a[1];
                List<Object> combined=new ArrayList<>((List<?>)a[4]);
                if(a[5]!=null)combined.addAll((List<?>)a[5]);
                options=combined;
                // -1 means "no limit" (Scry/Surveil: put any number on the bottom or in the graveyard).
                int remainingMin=Math.max(0,(Integer)a[2]),remainingMax=(Integer)a[3]<0?combined.size():(Integer)a[3];
                supported=remainingMin>=0&&remainingMax>=remainingMin&&!Boolean.TRUE.equals(a[7]);
                min=Math.max(0,combined.size()-remainingMax);max=combined.size()-remainingMin;
                supported &= max>=min&&max<=combined.size();
            }
            case assignCombatDamage -> {
                // Current rules (no damage assignment order): damage is divided among the
                // blockers as the player chooses. Trample may assign to the player or
                // planeswalker only once every blocker has lethal damage.
                CardView attacker=(CardView)a[0];var st=attacker.getCurrentState();GameEntityView defender=(GameEntityView)a[3];
                boolean deathtouch=st.hasDeathtouch(),divide=st.hasDivideDamage()&&(Boolean)a[4];
                List<Object> combined=new ArrayList<>((List<?>)a[1]);List<Integer> lethal=new ArrayList<>();
                for(Object o:combined){int l=Math.max(0,((CardView)o).getLethalDamage());lethal.add(deathtouch?Math.min(l,1):l);}
                if(defender!=null&&(st.hasTrample()||divide)){combined.add(defender);lethal.add(null);}
                options=combined;min=0;max=combined.size();
                text="Assign "+a[2]+" combat damage from "+(attacker.canFaceDownBeShownTo(viewer)?st.getName():"a creature");
                amounts=obj("amount",a[2],"lethal",lethal,"defenderIndex",combined.size()>((List<?>)a[1]).size()?combined.size()-1:null,"freeDivision",divide,"maySkip",a[5]);
            }
            case assignGenericAmount -> {
                Map<?,?> targets=(Map<?,?>)a[1];List<Object> combined=new ArrayList<>();List<Object> maxima=new ArrayList<>();
                for(var t:targets.entrySet()){combined.add(t.getKey());maxima.add(t.getValue());}
                options=combined;min=0;max=combined.size();
                CardView src=(CardView)a[0];
                text="Divide "+a[2]+" "+a[4]+(src!=null&&src.canFaceDownBeShownTo(viewer)?" from "+src.getCurrentState().getName():"");
                amounts=obj("amount",a[2],"maxima",maxima,"atLeastOne",a[3],"label",a[4]);
            }
            default -> {supported=false;text="Native prompt not yet adapted: "+kind;}
        }
        boolean acknowledge=e.getMethod()==ProtocolMethod.getChoices&&min==-1&&max==-1;
        if(acknowledge){min=0;max=0;}
        List<Object> choices=new ArrayList<>();
        for(int i=0;i<options.size();i++) {
            Object value=options.get(i), encoded=safeChoice(value);
            if(encoded==null&&e.getMethod()==ProtocolMethod.getChoices&&a[5] instanceof forge.util.FSerializableFunction<?,?> fn){
                @SuppressWarnings("unchecked") var display=(forge.util.FSerializableFunction<Object,String>)fn;
                encoded=display.apply(value);
            }
            if(encoded==null){supported=false;encoded=obj("kind","unsupported_choice_type");}
            choices.add(obj("index",i,"value",encoded));
        }
        Map<String,Object> dto=obj("id",e.getId(),"method",kind,"message",text,"min",min,"max",max,"options",choices,"supported",supported);
        if(e.getMethod()==ProtocolMethod.order){
            int sourceCount=((List<?>)a[4]).size();
            List<Integer> src=new ArrayList<>(),dst=new ArrayList<>();
            for(int i=0;i<options.size();i++)if(i<sourceCount)src.add(i);else dst.add(i);
            dto.put("ordered",true);dto.put("topLabel",a[1]);dto.put("remainingMin",Math.max(0,(Integer)a[2]));dto.put("remainingMax",(Integer)a[3]<0?options.size():a[3]);
            dto.put("sourceIndexes",src);dto.put("destinationIndexes",dst);dto.put("rememberAllowed",a[8]);
        }
        // Amount prompts: reply {"amounts":[n per option]} that adds up to "amount".
        if(amounts!=null)dto.put("assign",amounts);
        dto.put("acknowledgeOnly",acknowledge);
        dto.put("cancelable",e.getMethod()==ProtocolMethod.getAbilityToPlay);
        if(e.getMethod()==ProtocolMethod.showInputDialog){dto.put("numeric",a[5]);dto.put("initialValue",a[3]);}
        return new Pending(e,dto,options,min,max);
    }

    Object safeChoice(Object value) {
        if(value instanceof CardView c) return card(c);
        if(value instanceof forge.item.PaperCard pc)return obj("kind","paperCard","name",pc.getName(),"setCode",pc.getEdition());
        if(value instanceof PlayerView p)return obj("kind","player","id",p.getId(),"name",p.getName());
        if(value instanceof SpellAbilityView sa)return obj("kind","ability","id",sa.getId(),"description",sa.getDescription(),"card",card(sa.getHostCard()));
        if(value instanceof forge.game.replacement.ReplacementEffectView re)return obj("kind","replacementEffect","id",re.getId(),"description",re.getDescription());
        if(value instanceof String || value instanceof Number || value instanceof Boolean || value instanceof Enum<?>)return String.valueOf(value);
        // Kicker, Buyback, Entwine and other optional costs (Forge asks with many(), so an order
        // prompt) and counter kinds: the reply hands back the original object, so a label is enough.
        String type=value==null?"":value.getClass().getSimpleName();
        if(type.equals("OptionalCostValue"))return obj("kind","optionalCost","description",String.valueOf(value));
        if(type.equals("CounterType"))return obj("kind","counterType","description",String.valueOf(value));
        return null;
    }
    Map<String,Object> card(CardView c) {
        boolean visible=viewer!=null&&c.canBeShownTo(viewer);
        boolean face=visible&&c.canFaceDownBeShownTo(viewer);
        Map<String,Object> m=obj("id",c.getId(),"zone",c.getZone()==null?null:c.getZone().name(),"owner",id(c.getOwner()),"controller",id(c.getController()),"hidden",!face);
        // Opponent hidden hand/library identities are omitted entirely by zone projection below.
        if(!visible)return m;
        exposedCards.put(c.getId(),c);
        m.put("tapped",c.isTapped()); m.put("attacking",c.isAttacking());m.put("blocking",c.isBlocking());
        if(mustAttack.contains(c.getId()))m.put("mustAttack",true);
        // Combat arrows: whom an attacker attacks, and which attackers a blocker blocks.
        var combat=game==null?null:game.getView().getCombat();
        if(combat!=null&&c.isAttacking()){
            var defender=combat.getDefender(c);
            if(defender instanceof PlayerView p)m.put("attackTarget",obj("kind","player","id",p.getId()));
            else if(defender instanceof CardView d&&d.canBeShownTo(viewer))m.put("attackTarget",obj("kind","card","id",d.getId()));
        }
        if(combat!=null&&c.isBlocking()){
            List<Integer> blocked=new ArrayList<>();
            for(CardView attacker:combat.getAttackers())if(attacker.canBeShownTo(viewer)&&combat.getBlockers(attacker).contains(c))blocked.add(attacker.getId());
            if(!blocked.isEmpty())m.put("blockingIds",blocked);
        }
        if(face){
            var state=c.getCurrentState();
            m.put("name",state.getName());m.put("setCode",state.getSetCode());m.put("imageKey",state.getImageKey(List.of(viewer)));m.put("type",state.getType().toString());m.put("manaCost",state.getManaCost().toString());
            m.put("power",state.getPower());m.put("toughness",state.getToughness());m.put("text",c.getText());
            m.put("counters",counters(c));m.put("token",c.isToken());m.put("commander",c.isCommander());m.put("damage",c.getDamage());m.put("summoningSick",c.isSick());
            // Auras and Equipment: what this card is attached to, and what is attached to it.
            // Only cards the viewer may see are named; the rest stay out of the snapshot.
            CardView host=c.getAttachedTo();
            if(host!=null&&host.canBeShownTo(viewer))m.put("attachedTo",host.getId());
            List<Integer> attached=new ArrayList<>();
            for(CardView a:c.getAttachedCards())if(a.canBeShownTo(viewer))attached.add(a.getId());
            if(!attached.isEmpty())m.put("attachments",attached);
            // Keywords the card has right now, printed or granted, as Forge titles them
            // ("Flying", "Ward {2}", "Protection from red", "Crew 3"). Always sent on a
            // visible face, [] when it has none, so the table never falls back to rules text.
            List<String> keywords=new ArrayList<>();Set<String> seenKeywords=new HashSet<>();
            var kws=state.getKeywords();
            if(kws!=null)for(var k:kws){
                if(k==null||k.keyword()==null||k.keyword()==forge.game.keyword.Keyword.UNDEFINED)continue;
                String title=k.title();if(title==null||title.isBlank()||!seenKeywords.add(title))continue;
                keywords.add(title);
                if(k.keyword()==forge.game.keyword.Keyword.CREW){var crew=java.util.regex.Pattern.compile("(\\d+)").matcher(title);if(crew.find())m.put("crew",Integer.parseInt(crew.group(1)));}
            }
            m.put("keywords",keywords);
            if(state.getType().hasSubtype("Class"))m.put("classLevel",c.getClassLevel());
            if(c.isRingBearer())m.put("ringBearer",true);
            // Commander tax: two more for each earlier cast from the command zone.
            if(c.isCommander()&&c.getOwner()!=null){int casts=c.getOwner().getCommanderCast(c);m.put("commanderCasts",casts);m.put("commanderTax",2*casts);}
        }
        return m;
    }
    // Player designations Forge tracks on the game or the player. Projection only.
    Map<String,Object> designations(PlayerView view){
        Player p=game==null?null:game.getPlayer(view);
        if(p==null)return obj();
        forge.game.card.Card bearer=p.getRingBearer();
        return obj("monarch",game.getMonarch()==p,"initiative",game.getHasInitiative()==p,"citysBlessing",p.hasBlessing(),
            "ringTemptations",p.getNumRingTemptedYou(),"ringBearer",bearer==null||!bearer.getView().canBeShownTo(viewer)?null:bearer.getId());
    }
    Map<String,Integer> counters(GameEntityView entity) {
        Map<String,Integer> result=new LinkedHashMap<>();
        if(entity.getCounters()!=null)for(var entry:entity.getCounters().entrySet())result.put(entry.getElement().toString(),entry.getCount());
        return result;
    }
    Map<String,Integer> mana(PlayerView player) {
        Map<String,Integer> result=new LinkedHashMap<>();
        byte[] colors=forge.card.mana.ManaAtom.MANATYPES;String[] names={"W","U","B","R","G","C"};
        for(int i=0;i<colors.length;i++)result.put(names[i],player.getMana(colors[i]));
        return result;
    }
    /** Every target of a stack item: cards, players and other stack items. */
    static List<TrackableObject> stackTargets(StackItemView si){
        List<TrackableObject> all=new ArrayList<>();
        if(si.getTargetCards()!=null)for(CardView c:si.getTargetCards())all.add(c);
        if(si.getTargetPlayers()!=null)for(PlayerView p:si.getTargetPlayers())all.add(p);
        if(si.getTargetStackItems()!=null)for(StackItemView t:si.getTargetStackItems())all.add(t);
        return all;
    }
    List<Object> actionableRefs(){
        List<Object> out=refs(selection.actionable());
        if(publishedInput==null||publishedInput!=blockedInput)return out;
        for(Object o:out)if(o instanceof Map<?,?> m){var a=affordability.get((Integer)m.get("id"));if(a!=null)((Map<String,Object>)m).putAll(a);}
        return out;
    }
    List<Object> blockedRefs(){
        if(publishedInput==null||publishedInput!=blockedInput)return List.of();
        List<Object> out=new ArrayList<>();
        for(var b:blocked)if(exposedCards.containsKey((Integer)b.get("id")))out.add(b);
        return out;
    }
    List<Object> refs(Iterable<? extends TrackableObject> values) {
        List<Object> out=new ArrayList<>();
        if(values!=null)for(TrackableObject o:values){
            if(o instanceof CardView c){if(exposedCards.containsKey(c.getId()))out.add(obj("kind","card","id",c.getId()));}
            else if(o instanceof PlayerView p)out.add(obj("kind","player","id",p.getId()));
            else if(o instanceof StackItemView s)out.add(obj("kind","stack","id",s.getId()));
        }
        return out;
    }
    /** Invoked only by Forge's sync state messages on its game thread or a blocked native input. */
    void refreshBoard() { synchronized(lock) {
        if(game==null||viewer==null||concessionRequested)return;
        try {
            if(exactAdmission!=null)NativeDeckAdmission.verifyInstantiatedWhenReady(exactAdmission,game);
            GameView v=game.getView();
            exposedCards.clear();exposedStack.clear();exposedPlayers.clear();
            List<Object> players=new ArrayList<>(),stack=new ArrayList<>(),visibility=new ArrayList<>();
            for(PlayerView p:v.getPlayers()) {
                exposedPlayers.put(p.getId(),p);
                Map<String,Object> zones=new LinkedHashMap<>();
                for(ZoneType zone:List.of(ZoneType.Hand,ZoneType.Library,ZoneType.Battlefield,ZoneType.Graveyard,ZoneType.Exile,ZoneType.Command)){
                    var cards=p.getCards(zone); List<Object> visible=new ArrayList<>();int count=0;
                    if(cards!=null)for(CardView c:cards){
                        count++;
                        if(c.canBeShownTo(viewer)){
                            Map<String,Object> row=card(c);visible.add(row);
                            // Zone holder is taken from native enumeration, never row owner/controller.
                            // Both predicates and exact native zone must agree before granting face visibility.
                            if((zone==ZoneType.Hand||zone==ZoneType.Library)&&c.getZone()==zone&&c.canFaceDownBeShownTo(viewer)&&Boolean.FALSE.equals(row.get("hidden")))
                                visibility.add(Map.copyOf(obj("id",c.getId(),"zone",zone.name(),"zoneHolder",p.getId())));
                        }
                    }
                    zones.put(zone.name(),obj("count",count,"cards",visible));
                }
                players.add(obj("id",p.getId(),"name",p.getName(),"deckAlias",p.equals(viewer)?humanDeckAlias:seatDeckAlias.getOrDefault(p.getId(),aiDeckAlias),"deckCount",p.equals(viewer)?humanDeckCount:seatDeckCount.getOrDefault(p.getId(),aiDeckCount),"lost",p.getHasLost(),"commanderDamage",commanderDamage(v,p),"life",p.getLife(),"isViewer",p.equals(viewer),"hasAvailableActions",p.hasAvailableActions(),"mana",mana(p),"counters",counters(p),"designations",designations(p),"zones",zones));
            }
            if(v.getStack()!=null)for(StackItemView si:v.getStack()){
                exposedStack.put(si.getId(),si);
                stack.add(obj("id",si.getId(),"text",stackText(si.getText()),"source",si.getSourceCard()==null?null:card(si.getSourceCard()),"activatingPlayer",id(si.getActivatingPlayer()),"targets",refs(stackTargets(si)),"ability",si.isAbility(),"yielded",si.isAbility()&&turnYields.contains(forge.player.AutoYieldStore.abilitySuffix(si.getKey()))));
            }
            board=obj("schema","cardstashy.forge-proof.v1","forgeRevision",REV,"viewer",viewer.getId(),"aiProfile",actualAiProfile,"match",obj("humanDeck",humanDeckAlias,"aiDeck",aiDeckAlias),"turnOrder",v.getPlayers().stream().map(PlayerView::getId).toList(),"turn",v.getTurn(),"phase",v.getPhase()==null?null:v.getPhase().name(),"activePlayer",id(v.getPlayerTurn()),"priorityPlayer",game.getPhaseHandler().getPriorityPlayer()==null?null:game.getPhaseHandler().getPriorityPlayer().getId(),"players",players,"stack",stack,"dayNight",game.isDay()?"day":game.isNight()?"night":null,"gameOver",v.isGameOver(),"winner",v.isGameOver()?v.getWinningPlayerName():null,"winnerPlayerId",winnerId(),"draw",v.isGameOver()&&game.getOutcome()!=null&&game.getOutcome().isDraw());
            boardVisibility=List.copyOf(visibility);
        }catch(RuntimeException ex){failure="Projection failed: "+ex;ex.printStackTrace();}
    }}
    /** Failed matches must not renew a last-known reveal or retain card-bearing projection caches.
     * This path reads immutable projected metadata only, never the live native game graph. */
    @SuppressWarnings("unchecked")
    void publishFailure() {
        exposedCards.clear();exposedStack.clear();boardVisibility=List.of();selection=Selection.NONE;publishedInput=null;
        message="Native match stopped.";buttons=Map.of();notification=Map.of();lastActionError=null;
        effectiveAutoPass=false;clearSmartIntent();autoPayAttemptInput=null;
        List<Object> players=new ArrayList<>();
        for(Object value:(List<?>)board.getOrDefault("players",List.of())){
            Map<String,Object> player=(Map<String,Object>)value,zones=new LinkedHashMap<>();
            for(var entry:((Map<String,Object>)player.getOrDefault("zones",Map.of())).entrySet()){
                Map<String,Object> zone=(Map<String,Object>)entry.getValue();
                zones.put(entry.getKey(),obj("count",zone.get("count"),"cards",List.of()));
            }
            players.add(obj("id",player.get("id"),"name",player.get("name"),"life",player.get("life"),"isViewer",player.get("isViewer"),"zones",zones));
        }
        board=obj("schema",board.get("schema"),"forgeRevision",board.get("forgeRevision"),"viewer",board.get("viewer"),"players",players,"stack",List.of(),"turn",board.get("turn"),"phase",board.get("phase"),"activePlayer",board.get("activePlayer"),"priorityPlayer",null,"gameOver",board.get("gameOver"));
        long publicationRevision=revision.incrementAndGet();
        Map<String,Object> snapshot=new LinkedHashMap<>(board);
        snapshot.putAll(obj("revision",publicationRevision,"status","failed","failure","native_match_failed","message","Native match stopped.","buttons",Map.of(),"inputType",null,"selection",obj("cards",List.of(),"targets",List.of(),"chosen",List.of(),"actionable",List.of(),"blocked",List.of(),"min",0,"max",0),"prompt",null,"busy",false,"lastActionError",null,"notification",Map.of(),"autoPay",false,"autoPassNoActions",false,"canConcede",false));
        snapshot.put("visibility",obj("schema","cardstashy.forge-visibility.v1","forgeRevision",board.get("forgeRevision"),"viewer",board.get("viewer"),"revision",publicationRevision,"cards",List.of()));
        snapshot.put("events",eventsView(false));
        if(unsupportedPregameChoice)snapshot.put("initialization",obj("supported",false,"failureCode",UNSUPPORTED_PREGAME_CHOICE,"errors",List.of(UNSUPPORTED_PREGAME_MESSAGE)));
        published.set(snapshot);
    }
    /** Bare asynchronous prompt/button notifications only overlay immutable projected data. */
    SpellAbility costNowFor;Map<String,Object> costNow;
    void publish() { synchronized(lock) {
        if(failure!=null){publishFailure();return;}
        if(board.isEmpty())return;
        publishedInput=controller.getInputProxy().getInput();
        String input=publishedInput==null?null:publishedInput.getClass().getSimpleName();
        Map<String,Object> select=obj("cards",refs(selection.cards()),"targets",refs(selection.targets()),"chosen",refs(selection.chosen()),"actionable",actionableRefs(),"blocked",blockedRefs(),"min",selection.min(),"max",selection.max());
        Map<String,Object> snapshot=new LinkedHashMap<>(board);
        if(exactAdmission!=null)snapshot.put("initialization",new LinkedHashMap<>(exactAdmission.receipt()));
        long publicationRevision=revision.incrementAndGet();
        // Re-stamp the immutable board evidence on every publication (including prompt-only updates).
        // Old snapshots retain their original revision and receipt; no live graph is read here.
        snapshot.put("visibility",obj("schema","cardstashy.forge-visibility.v1","forgeRevision",board.get("forgeRevision"),"viewer",board.get("viewer"),"revision",publicationRevision,"cards",boardVisibility));
        if(!pregame.isEmpty())snapshot.put("pregame",pregame);
        snapshot.put("events",eventsView(true));
        // Manual payment: what is still owed and for which card (the payable sources are
        // selection.actionable; sources Auto would tap are listed there twice).
        if(publishedInput instanceof forge.gamemodes.match.input.InputPayMana){
            try{
                SpellAbility paidFor=controller.getPlayer().getPaidForSA();
                var owed=paidFor==null?null:paidFor.getManaCostBeingPaid();
                if(owed!=null){
                    // costNow: the whole cost Forge settled on for this cast (after reductions such
                    // as a tapped target), fixed when payment starts; cmcPaid is its mana value.
                    if(paidFor!=costNowFor){costNowFor=paidFor;costNow=paidFor.getPayingMana().isEmpty()?obj("mana",owed.toString(),"cmcPaid",owed.getConvertedManaCost()):null;}
                    Map<String,Object> payment=obj("remaining",owed.toString(),"forCard",paidFor.getHostCard()==null?null:cardRef(paidFor.getHostCard().getView()));
                    if(costNow!=null)payment.put("costNow",costNow);
                    snapshot.put("payment",payment);
                }
            }catch(RuntimeException ignored){}
        }
        // Smart mode skips a priority stop when nothing can be cast or activated. Conservative:
        // any actionable card counts, including ones whose cost is only "unknown".
        if(publishedInput instanceof forge.gamemodes.match.input.InputPassPriority)snapshot.put("canRespond",!selection.actionable().isEmpty());
        if(exactAdmission!=null&&exactAdmission.opponent()!=null&&!humanOpponent){
            Object warnings=exactAdmission.opponent().report().get("cpuWarnings");
            int count=warnings instanceof Collection<?> values?values.size():0;
            if(count>0)snapshot.put("cpuWarnings",obj("count",count,"message","The CPU may play some cards in this deck imperfectly."));
        }
        snapshot.putAll(obj("revision",publicationRevision,"status",failure!=null?"failed":(finished||Boolean.TRUE.equals(board.get("gameOver"))?"finished":exactAdmission!=null&&(!Boolean.TRUE.equals(exactAdmission.receipt().get("nativeRosterVerified"))||startingPlayer!=null&&pregame.isEmpty())?"initializing":"running"),"failure",failure,"message",message,"buttons",buttons,"inputType",input,"selection",select,"prompt",concessionRequested||pending==null?null:pending.dto,"busy",!(finished||Boolean.TRUE.equals(board.get("gameOver")))&&(concessionRequested||(pending!=null?pending.answer.isDone():(busy||commandInFlight||nativePaymentPending()||publishedInput==null||publishedInput instanceof forge.gamemodes.match.input.InputLockUI))),"lastActionError",lastActionError,"notification",notification,"controlMode",controlMode,"autoPay",autoPay(),"phaseStops",Map.copyOf(phaseStops),"autoPassNoActions",effectiveAutoPass,"nativeAutoPayments",nativeAutoPayments,"canConcede",failure==null&&!finished&&!concessionRequested&&!Boolean.TRUE.equals(board.get("gameOver")),"concession",obj("requested",concessionRequested,"nativeConfirmed",nativeOutcomeConfirmed,"applied",concessionApplied)));
        published.set(snapshot);
    }}
    // Commander damage this player has taken from each opponent's commander (CR 903.10a), 0 included.
    List<Object> commanderDamage(GameView v,PlayerView p){
        List<Object> out=new ArrayList<>();
        for(PlayerView q:v.getPlayers()){
            if(q.getId()==p.getId()||q.getCommanders()==null)continue;
            for(CardView c:q.getCommanders())out.add(obj("from",q.getId(),"commander",c.getName(),"damage",p.getCommanderDamage(c)));
        }
        return out;
    }
    // Forge plays on after you lose a multiplayer game, with only CPUs left. End it for you there:
    // the CPUs' priority right after your loss is the first moment no rules step is still running.
    @com.google.common.eventbus.Subscribe
    public void onPriorityAfterViewerLoss(forge.game.event.GameEventPlayerPriority event){
        if(game==null||controller==null||game.isGameOver()||game.getRegisteredPlayers().size()<3)return;
        if(controller.getPlayer().hasLost())game.setGameOver(forge.game.GameEndReason.AllHumansLost);
    }
    Integer winnerId(){if(!game.isGameOver()||game.getOutcome()==null)return null;for(Player p:game.getRegisteredPlayers())if(game.getOutcome().isWinner(p.getRegisteredPlayer()))return p.getId();return null;}

    Object reply(Pending p,JsonObject body) {
        String kind=p.event.getMethod().name();
        if(!Boolean.TRUE.equals(p.dto.get("supported")))throw new IllegalArgumentException("unsupported_native_prompt:"+kind);
        if(kind.equals("confirm")||kind.equals("showConfirmDialog"))return exactBoolean(body.get("value"),"value");
        if(kind.equals("showInputDialog")) {
            String value=exactString(body.get("value"),"value");
            if(value.length()>200)throw new IllegalArgumentException("input_too_long");
            if(Boolean.TRUE.equals(p.event.getObjects()[5])&&!value.matches("-?[0-9]+"))throw new IllegalArgumentException("numeric_input_required");
            if(!p.options.isEmpty()&&!p.options.contains(value))throw new IllegalArgumentException("input_not_offered");
            return value;
        }
        if(kind.equals("assignCombatDamage")||kind.equals("assignGenericAmount"))return assignAmounts(p,body);
        JsonArray indices=body.getAsJsonArray("indexes");
        if(indices==null||indices.size()<p.min||indices.size()>p.max)throw new IllegalArgumentException("choice_count_out_of_range");
        List<Object> values=new ArrayList<>(); Set<Integer> seen=new HashSet<>();
        for(JsonElement x:indices){int i=exactInt(x,"choice");if(i<0||i>=p.options.size()||!seen.add(i))throw new IllegalArgumentException("choice_not_offered");values.add(p.options.get(i));}
        return switch(p.event.getMethod()){
            case getAbilityToPlay,chooseSingleEntityForEffect -> values.isEmpty()?null:values.get(0);
            case showOptionDialog -> exactInt(indices.get(0),"choice");
            case order -> {
                boolean remember=body.has("remember")&&exactBoolean(body.get("remember"),"remember");
                if(remember&&!Boolean.TRUE.equals(p.dto.get("rememberAllowed")))throw new IllegalArgumentException("remember_not_offered");
                yield new IGuiGame.OrderResult<>(values,remember);
            }
            default -> values;
        };
    }

    @SuppressWarnings("unchecked")
    static Object assignAmounts(Pending p,JsonObject body){
        Map<String,Object> spec=(Map<String,Object>)p.dto.get("assign");
        boolean combat=p.event.getMethod()==ProtocolMethod.assignCombatDamage;
        if(body.has("skip")){
            if(!combat||!exactBoolean(body.get("skip"),"skip")||!Boolean.TRUE.equals(spec.get("maySkip")))throw new IllegalArgumentException("skip_not_offered");
            return null;
        }
        JsonArray raw=body.getAsJsonArray("amounts");
        if(raw==null||raw.size()!=p.options.size())throw new IllegalArgumentException("amounts_must_match_options");
        int total=0;int[] n=new int[raw.size()];
        for(int i=0;i<n.length;i++){n[i]=exactInt(raw.get(i),"amount");if(n[i]<0)throw new IllegalArgumentException("amount_negative");total+=n[i];}
        if(total!=(Integer)spec.get("amount"))throw new IllegalArgumentException("amounts_must_add_up");
        if(combat){
            List<Integer> lethal=(List<Integer>)spec.get("lethal");Integer defender=(Integer)spec.get("defenderIndex");
            if(defender!=null&&n[defender]>0&&!Boolean.TRUE.equals(spec.get("freeDivision")))
                for(int i=0;i<n.length;i++)if(i!=defender&&n[i]<lethal.get(i))throw new IllegalArgumentException("blockers_need_lethal_first");
            Map<CardView,Integer> out=new HashMap<>();
            for(int i=0;i<n.length;i++)out.put(defender!=null&&i==defender?null:(CardView)p.options.get(i),n[i]); // null key = the defender
            return out;
        }
        List<Object> maxima=(List<Object>)spec.get("maxima");boolean atLeastOne=Boolean.TRUE.equals(spec.get("atLeastOne"));
        Map<Object,Integer> out=new LinkedHashMap<>();
        for(int i=0;i<n.length;i++){
            if(n[i]>((Number)maxima.get(i)).intValue()||atLeastOne&&n[i]<1)throw new IllegalArgumentException("amount_out_of_range");
            out.put(p.options.get(i),n[i]);
        }
        return out;
    }
    static String exactString(JsonElement e,String field){if(e==null||!e.isJsonPrimitive()||!e.getAsJsonPrimitive().isString())throw new IllegalArgumentException(field+"_must_be_string");return e.getAsString();}
    static boolean exactBoolean(JsonElement e,String field){if(e==null||!e.isJsonPrimitive()||!e.getAsJsonPrimitive().isBoolean())throw new IllegalArgumentException(field+"_must_be_boolean");return e.getAsBoolean();}
    static long exactLong(JsonElement e,String field){
        if(e==null||!e.isJsonPrimitive()||!e.getAsJsonPrimitive().isNumber())throw new IllegalArgumentException(field+"_must_be_integer");
        try{return e.getAsBigDecimal().longValueExact();}catch(ArithmeticException|NumberFormatException ex){throw new IllegalArgumentException(field+"_must_be_integer");}
    }
    static int exactInt(JsonElement e,String field){long n=exactLong(e,field);if(n<Integer.MIN_VALUE||n>Integer.MAX_VALUE)throw new IllegalArgumentException(field+"_out_of_range");return (int)n;}

    void serve(int port)throws IOException {
        HttpServer server=HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(),port),0);
        server.setExecutor(Executors.newCachedThreadPool());
        server.createContext("/health",x->respond(x,200,obj("ok",true,"engine","Forge","forgeRevision",REV)));
        server.createContext("/state",x->{if(auth(x))handleState(x);});
        server.createContext("/action",x->{if(auth(x))handleAction(x);});
        // A friend match's second seat, behind the same internal token as the first.
        server.createContext("/seat2/state",x->{if(auth(x)){var p=peer;if(p==null)respond(x,404,obj("error","seat_not_found"));else p.handleState(x);}});
        server.createContext("/seat2/action",x->{if(auth(x)){var p=peer;if(p==null)respond(x,404,obj("error","seat_not_found"));else p.handleAction(x);}});
        server.start();
    }
    void handleState(HttpExchange x)throws IOException{lastStatePollNanos=System.nanoTime();respond(x,200,published.get());}
    void handleAction(HttpExchange x)throws IOException{
            if(!x.getRequestMethod().equals("POST")){respond(x,405,obj("error","POST_required"));return;}
            try {
                byte[] bytes=x.getRequestBody().readNBytes(16385);if(bytes.length>16384)throw new IllegalArgumentException("body_too_large");
                JsonObject body=JsonParser.parseString(new String(bytes,StandardCharsets.UTF_8)).getAsJsonObject();
                synchronized(lock){
                    if(exactLong(body.get("revision"),"revision")!=((Number)published.get().get("revision")).longValue()){respond(x,409,obj("error","stale_revision"));return;}
                    if(exactAdmission!=null&&!Boolean.TRUE.equals(exactAdmission.receipt().get("nativeRosterVerified"))){respond(x,409,obj("error","exact_initialization_unverified"));return;}
                    if(failure!=null){respond(x,409,obj("error","native_match_unavailable"));return;}
                    String op=exactString(body.get("op"),"op");
                    if(concessionRequested){respond(x,409,obj("error",nativeOutcomeConfirmed?"native_game_finished":"native_concession_in_progress"));return;}
                    if(finished||Boolean.TRUE.equals(board.get("gameOver"))){respond(x,409,obj("error","native_game_finished"));return;}
                    if(op.equals("concede")){
                        if(failure!=null||controller==null){respond(x,409,obj("error","native_match_unavailable"));return;}
                        requestConcession();
                    }else if(op.equals("controlMode")){
                        String mode=exactString(body.get("value"),"value");
                        if(!Set.of("smart","full").contains(mode))throw new IllegalArgumentException("controlMode_must_be_smart_or_full");
                        if(pending!=null||busy||commandInFlight||nativePaymentPending()){respond(x,409,obj("error","native_engine_busy"));return;}
                        final var modeInput=publishedInput;
                        final long modeGeneration=promptGeneration.get();
                        if(modeInput==null||modeInput instanceof forge.gamemodes.match.input.InputLockUI
                            ||modeInput!=controller.getInputProxy().getInput()){respond(x,409,obj("error","native_input_changed"));return;}
                        commandInFlight=true;publish();
                        SwingUtilities.invokeLater(()->{
                            try{
                                if(concessionRequested||modeInput!=controller.getInputProxy().getInput()||modeGeneration!=promptGeneration.get()||pending!=null){
                                    lastActionError="native_decision_changed";clearSmartIntent();return;
                                }
                                controlMode=mode;autoPayChoice=null;applyControlMode();
                            }
                            catch(Throwable t){recordFailure(t);}
                            finally{synchronized(lock){commandInFlight=false;publish();}}
                        });
                    }else if(op.equals("phaseStop")){
                        // Only marks which steps Smart may skip; no native command runs.
                        String seat=exactString(body.get("seat"),"seat"),mode=exactString(body.get("mode"),"mode");
                        if(!Set.of("you","opponent").contains(seat)||!Set.of("off","once","pinned").contains(mode))throw new IllegalArgumentException("phaseStop_invalid");
                        String key=seat+":"+forge.game.phase.PhaseType.valueOf(exactString(body.get("phase"),"phase")).name();
                        if(mode.equals("off"))phaseStops.remove(key);else phaseStops.put(key,mode.equals("pinned"));
                        reachedOnceStops.remove(key);applyStops();publish();
                    }else if(op.equals("yieldSource")){
                        StackItemView s=exposedStack.get(exactInt(body.get("id"),"id"));
                        if(s==null||!s.isAbility())throw new IllegalArgumentException("stack_item_not_offered");
                        boolean on=exactBoolean(body.get("value"),"value");
                        if(pending!=null||busy||commandInFlight||nativePaymentPending()){respond(x,409,obj("error","native_engine_busy"));return;}
                        final String key=s.getKey(),suffix=forge.player.AutoYieldStore.abilitySuffix(key);
                        commandInFlight=true;publish();
                        // Forge's own yield: passes priority while this ability is on top, then
                        // the yield is dropped at the start of the next turn.
                        SwingUtilities.invokeLater(()->{
                            try{if(on)turnYields.add(suffix);else turnYields.remove(suffix);controller.setShouldAutoYield(key,on,true);}
                            catch(Throwable t){recordFailure(t);}
                            finally{synchronized(lock){commandInFlight=false;publish();}}
                        });
                    }else if(op.equals("autoPay")){
                        // Only decides whether a later cast's first cost is paid for you; no
                        // native command runs, so it applies at once. Turning it off drops a
                        // spell intention that has not reached its payment yet.
                        autoPayChoice=exactBoolean(body.get("value"),"value");
                        if(!autoPayChoice)clearSmartIntent();
                        publish();
                    }else if(op.equals("reply")){
                        Pending p=pending;
                        if(p==null||p.answer.isDone()||exactInt(body.get("promptId"),"promptId")!=p.event.getId()){respond(x,409,obj("error","stale_prompt"));return;}
                        Object answer=reply(p,body);busy=true;p.answer.complete(answer);publish();
                    }else{
                        if(pending!=null){respond(x,409,obj("error","native_dialog_requires_reply"));return;}
                        if(busy||commandInFlight||nativePaymentPending()){respond(x,409,obj("error","native_engine_busy"));return;}
                        final var capturedInput=publishedInput;
                        final long capturedPromptGeneration=promptGeneration.get();
                        if(capturedInput==null||capturedInput!=controller.getInputProxy().getInput()||capturedInput instanceof forge.gamemodes.match.input.InputLockUI){respond(x,409,obj("error","native_input_changed"));return;}
                        Runnable action;
                        switch(op){
                            case "ok" -> {if(!Boolean.TRUE.equals(buttons.get("okEnabled")))throw new IllegalArgumentException("ok_disabled");action=capturedInput::selectButtonOK;}
                            case "cancel" -> {if(!Boolean.TRUE.equals(buttons.get("cancelEnabled")))throw new IllegalArgumentException("cancel_disabled");action=capturedInput::selectButtonCancel;}
                            case "card" -> {int i=exactInt(body.get("id"),"id");CardView c=exposedCards.get(i);if(c==null)throw new IllegalArgumentException("card_not_visible");action=()->{
                                boolean accepted=capturedInput.selectCard(controller.getCard(c),null,null);
                                if(capturedInput instanceof forge.gamemodes.match.input.InputPassPriority){if(accepted)armSmartSpellIntent(capturedInput);else clearSmartIntent();}
                                if(!accepted){synchronized(lock){busy=false;}}
                            };}
                            case "player" -> {int i=exactInt(body.get("id"),"id");PlayerView p=exposedPlayers.get(i);if(p==null)throw new IllegalArgumentException("player_not_offered");action=()->capturedInput.selectPlayer(game.getPlayer(p),null);}
                            case "stack" -> {StackItemView s=exposedStack.get(exactInt(body.get("id"),"id"));if(s==null)throw new IllegalArgumentException("stack_item_not_offered");action=()->{for(SpellAbilityStackInstance si:game.getStack())if(si.getId()==s.getId()){
                                boolean accepted=capturedInput.selectAbility(si.getSpellAbility());
                                if(capturedInput instanceof forge.gamemodes.match.input.InputPassPriority){if(accepted)armSmartSpellIntent(capturedInput);else clearSmartIntent();}
                                if(!accepted){synchronized(lock){busy=false;}}break;}};}
                            default -> throw new IllegalArgumentException("unknown_operation");
                        }
                        if(capturedInput instanceof forge.gamemodes.match.input.InputPassPriority
                            &&(op.equals("ok")||op.equals("cancel")))clearSmartIntent();
                        busy=true; commandInFlight=true; lastActionError=null;
                        publish(); // the accepted command consumes this presentation before dispatch
                        SwingUtilities.invokeLater(()->{
                            try{
                                if(concessionRequested||capturedInput!=controller.getInputProxy().getInput()||capturedPromptGeneration!=promptGeneration.get()||pending!=null){lastActionError="native_decision_changed";clearSmartIntent();return;}
                                action.run();
                            }catch(Throwable t){recordFailure(t);}
                            finally{ synchronized(lock){
                                commandInFlight=false;
                                // Only native stable prompt callbacks or an explicit false selection result release busy.
                                // The same Input identity can enqueue a later native confirmation, so identity alone is not enough.
                                maybeNativeAutoPay();
                                publish();
                            }}
                        });
                    }
                    respond(x,202,obj("accepted",true));
                }
            }catch(Exception e){respond(x,400,obj("error",e.getMessage()==null?e.getClass().getSimpleName():e.getMessage()));}
    }
    boolean auth(HttpExchange x)throws IOException {
        String origin=x.getRequestHeaders().getFirst("Origin");
        if(origin!=null&&!origin.matches("http://(localhost|127\\.0\\.0\\.1)(:[0-9]+)?")){respond(x,403,obj("error","local_origin_required"));return false;}
        if(origin!=null){x.getResponseHeaders().set("Access-Control-Allow-Origin",origin);x.getResponseHeaders().set("Vary","Origin");}
        if(x.getRequestMethod().equals("OPTIONS")){x.getResponseHeaders().set("Access-Control-Allow-Headers","Authorization, Content-Type");x.getResponseHeaders().set("Access-Control-Allow-Methods","GET, POST, OPTIONS");x.sendResponseHeaders(204,-1);x.close();return false;}
        if(!("Bearer "+token).equals(x.getRequestHeaders().getFirst("Authorization"))){respond(x,401,obj("error","local_token_required"));return false;}
        return true;
    }
    void respond(HttpExchange x,int code,Object value)throws IOException {
        byte[] bytes=JSON.toJson(value).getBytes(StandardCharsets.UTF_8);
        x.getResponseHeaders().set("Content-Type","application/json; charset=utf-8");x.getResponseHeaders().set("Cache-Control","no-store");
        x.sendResponseHeaders(code,bytes.length);x.getResponseBody().write(bytes);x.close();
    }
}
