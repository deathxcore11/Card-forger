package cardstashy.forge;

import com.google.gson.*;
import com.sun.net.httpserver.*;
import forge.GuiDesktop;
import forge.deck.Deck;
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
    static final String REV = "e5a0f8156da70ffc7866f923bed371c0111707cd";
    final AtomicReference<Map<String,Object>> published = new AtomicReference<>(Map.of("status","initializing"));
    final AtomicLong revision = new AtomicLong();
    final AtomicLong promptGeneration = new AtomicLong();
    Map<String,Object> board = Map.of();
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
    volatile boolean effectiveAutoPass;
    volatile forge.gamemodes.match.input.Input publishedInput;
    volatile String lastActionError;
    volatile String failure;
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
            prefs.setPref(FPref.YIELD_AUTO_PASS_RESPECTS_INTERRUPTS,false);
            prefs.setPref(FPref.PLAYER_NAME,"CardStashy");
            prefs.setPref(FPref.DECKGEN_CARDBASED,false);
            prefs.setPref(FPref.YIELD_AUTO_PASS_NO_ACTIONS,false);
            prefs.setPref(FPref.YIELD_DECLINE_SCOPE_STACK_YIELD,"NEVER");
            prefs.setPref(FPref.YIELD_DECLINE_SCOPE_NO_ACTIONS,"NEVER");
            return null;
        });
        ForgeHttpBridge bridge=new ForgeHttpBridge();
        int port=Integer.parseInt(System.getProperty("proof.port","8765"));
        bridge.serve(port);
        Files.writeString(Path.of(root,"adapter","connection.json"),JSON.toJson(obj("baseUrl","http://127.0.0.1:"+port,"token",bridge.token,"forgeRevision",REV)));
        System.out.println("BRIDGE_LISTENING http://127.0.0.1:"+port+" (token in adapter/connection.json)");
        bridge.start(root,Long.parseLong(System.getProperty("proof.seed","20261025")));
    }

    void start(String root,long seed) {
        MyRandom.setRandom(new Random(seed));
        humanDeckAlias=System.getProperty("proof.humanDeck","calling-all-angels");
        aiDeckAlias=System.getProperty("proof.aiDeck","keen-engineering");
        Deck keen=loadDeck(root,humanDeckAlias);
        Deck reign=loadDeck(root,aiDeckAlias);
        RegisteredPlayer human=RegisteredPlayer.forCommander(keen).setPlayer(new LobbyPlayerHuman("Human",0,0));
        var aiLobby=(forge.ai.LobbyPlayerAi)GamePlayerUtil.createAiPlayer("Forge AI — "+reign.getName(),1,"Default");
        actualAiProfile=aiLobby.getAiProfile();
        System.out.println("AI_PROFILE "+actualAiProfile);
        RegisteredPlayer ai=RegisteredPlayer.forCommander(reign).setPlayer(aiLobby);
        GameRules rules=new GameRules(GameType.Commander);
        rules.setAppliedVariants(EnumSet.of(GameType.Commander));
        rules.setGamesPerMatch(1);
        rules.setAllowCheatShuffle(false);
        Match match=new Match(rules,List.of(human,ai),"CardStashy Forge proof");
        game=match.createGame();
        game.AI_FLAT_MONTE_CARLO=false;game.AI_FLAT_MONTE_CARLO_MAX=false;
        for(Player p:game.getPlayers())if(p.getController() instanceof forge.ai.PlayerControllerAi aiController){
            aiController.getAi().setFlatMonteCarloOverride(false);aiController.getAi().setFlatMonteCarloMaxOverride(false);aiController.getAi().setFlatMonteCarloAttackOverride(false);
        }
        controller=(PlayerControllerHuman)game.getPlayers().get(0).getController();
        viewer=controller.getPlayer().getView();
        gui=new ProtocolGuiGame(this);
        controller.setGui(gui);
        gui.setGameView(game.getView());
        gui.setOriginalGameController(viewer,controller);
        if(!controlMode.equals("full"))throw new IllegalArgumentException("This frozen proof supports only full control; Smart remains separately under test");
        GameEventForwarder forwarder=new GameEventForwarder(gui);
        gui.setForwarder(forwarder);
        game.subscribeToEvents(forwarder);
        game.subscribeToEvents(controller.getYieldController());
        controller.getInputQueue().addObserver(forwarder);
        for(Player p:game.getPlayers())p.updateOpponentsForView();
        new Thread(()-> {
            try {
                match.startGame(game);
                forwarder.flush();
                finished=true;
                refreshBoard(); publish();
                System.out.println("BRIDGE_GAME_OVER "+game.getOutcome());
            } catch(Throwable t) {
                failure=t.getClass().getSimpleName()+": "+t.getMessage();
                t.printStackTrace();
                publish();
            }
        },"forge-native-match").start();
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
        synchronized(lock){ switch(e.getMethod()) {
            case showPromptMessage -> message=(String)a[1];
            case updateButtons -> { buttons=obj("ok",a[1],"cancel",a[2],"okEnabled",a[3],"cancelEnabled",a[4]); busy=false; }
            case setSelection -> { selection=(Selection)a[0]; busy=false; }
            case awaitNextInput -> { busy=true; }
            case flashIncorrectAction -> { busy=false; }
            case message,showErrorDialog -> {notification=obj("method",e.getMethod().name(),"message",a[0],"title",a.length>1?a[1]:null); busy=false;}
            default -> { }
        }
        // Raw GameView, DeltaPacket, arbitrary events and private logs NEVER cross HTTP.
        if(e.getMethod()==ProtocolMethod.setSelection || e.getMethod()==ProtocolMethod.updateButtons || e.getMethod()==ProtocolMethod.showPromptMessage || e.getMethod()==ProtocolMethod.flashIncorrectAction || e.getMethod()==ProtocolMethod.message || e.getMethod()==ProtocolMethod.showErrorDialog) publish();
        }
    }
    @Override public Object sendAndWait(IdentifiableNetEvent event) {
        GuiGameEvent e=(GuiGameEvent)event;
        Pending p=makePending(e);
        synchronized(lock){ if(pending!=null&&!pending.answer.isDone())throw new IllegalStateException("Overlapping native dialog; refusing to replace pending input"); p.originInput=controller==null?null:controller.getInputProxy().getInput();p.generation=promptGeneration.incrementAndGet(); pending=p; busy=false; publish(); }
        System.out.println("NATIVE_PROMPT "+e.getMethod()+" id="+e.getId());
        Object result=null;boolean completed=false;
        try { result=p.answer.get();completed=true;return result; }
        catch(Exception ex){ throw new IllegalStateException("Native prompt interrupted",ex); }
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
            publish();
        }}
    }

    Pending makePending(GuiGameEvent e) {
        Object[] a=e.getObjects();
        String kind=e.getMethod().name(), text=kind;
        List<?> options=List.of(); int min=0,max=1; boolean supported=true;
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
                int remainingMin=(Integer)a[2],remainingMax=(Integer)a[3];
                supported=remainingMin>=0&&remainingMax>=remainingMin&&!Boolean.TRUE.equals(a[7]);
                min=Math.max(0,combined.size()-remainingMax);max=combined.size()-remainingMin;
                supported &= max>=min&&max<=combined.size();
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
            dto.put("ordered",true);dto.put("topLabel",a[1]);dto.put("remainingMin",a[2]);dto.put("remainingMax",a[3]);
            dto.put("sourceIndexes",src);dto.put("destinationIndexes",dst);dto.put("rememberAllowed",a[8]);
        }
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
        if(value instanceof String || value instanceof Number || value instanceof Boolean || value instanceof Enum<?>)return String.valueOf(value);
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
        if(face){
            var state=c.getCurrentState();
            m.put("name",state.getName());m.put("setCode",state.getSetCode());m.put("imageKey",state.getImageKey(List.of(viewer)));m.put("type",state.getType().toString());m.put("manaCost",state.getManaCost().toString());
            m.put("power",state.getPower());m.put("toughness",state.getToughness());m.put("text",c.getText());
            m.put("counters",counters(c));m.put("token",c.isToken());m.put("commander",c.isCommander());m.put("damage",c.getDamage());m.put("summoningSick",c.isSick());
        }
        return m;
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
        if(game==null||viewer==null)return;
        try {
            GameView v=game.getView();
            exposedCards.clear();exposedStack.clear();exposedPlayers.clear();
            List<Object> players=new ArrayList<>(),stack=new ArrayList<>();
            for(PlayerView p:v.getPlayers()) {
                exposedPlayers.put(p.getId(),p);
                Map<String,Object> zones=new LinkedHashMap<>();
                for(ZoneType zone:List.of(ZoneType.Hand,ZoneType.Library,ZoneType.Battlefield,ZoneType.Graveyard,ZoneType.Exile,ZoneType.Command)){
                    var cards=p.getCards(zone); List<Object> visible=new ArrayList<>();int count=0;
                    if(cards!=null)for(CardView c:cards){count++;if(c.canBeShownTo(viewer))visible.add(card(c));}
                    zones.put(zone.name(),obj("count",count,"cards",visible));
                }
                players.add(obj("id",p.getId(),"name",p.getName(),"deckAlias",p.equals(viewer)?humanDeckAlias:aiDeckAlias,"deckCount",100,"life",p.getLife(),"isViewer",p.equals(viewer),"hasAvailableActions",p.hasAvailableActions(),"mana",mana(p),"counters",counters(p),"zones",zones));
            }
            if(v.getStack()!=null)for(StackItemView si:v.getStack()){
                exposedStack.put(si.getId(),si);
                stack.add(obj("id",si.getId(),"text",si.getText(),"source",si.getSourceCard()==null?null:card(si.getSourceCard()),"activatingPlayer",id(si.getActivatingPlayer()),"targets",refs(si.getTargetCards())));
            }
            board=obj("schema","cardstashy.forge-proof.v1","forgeRevision",REV,"viewer",viewer.getId(),"aiProfile",actualAiProfile,"match",obj("humanDeck",humanDeckAlias,"aiDeck",aiDeckAlias),"turn",v.getTurn(),"phase",v.getPhase()==null?null:v.getPhase().name(),"activePlayer",id(v.getPlayerTurn()),"priorityPlayer",game.getPhaseHandler().getPriorityPlayer()==null?null:game.getPhaseHandler().getPriorityPlayer().getId(),"players",players,"stack",stack,"gameOver",v.isGameOver(),"winner",v.isGameOver()?v.getWinningPlayerName():null,"winnerPlayerId",winnerId(),"draw",v.isGameOver()&&game.getOutcome()!=null&&game.getOutcome().isDraw());
        }catch(RuntimeException ex){failure="Projection failed: "+ex;ex.printStackTrace();}
    }}
    /** Bare asynchronous prompt/button notifications only overlay immutable projected data. */
    void publish() { synchronized(lock) {
        if(board.isEmpty())return;
        publishedInput=controller.getInputProxy().getInput();
        String input=publishedInput==null?null:publishedInput.getClass().getSimpleName();
        Map<String,Object> select=obj("cards",refs(selection.cards()),"targets",refs(selection.targets()),"chosen",refs(selection.chosen()),"actionable",refs(selection.actionable()),"min",selection.min(),"max",selection.max());
        Map<String,Object> snapshot=new LinkedHashMap<>(board);
        snapshot.putAll(obj("revision",revision.incrementAndGet(),"status",failure!=null?"failed":(finished||Boolean.TRUE.equals(board.get("gameOver"))?"finished":"running"),"failure",failure,"message",message,"buttons",buttons,"inputType",input,"selection",select,"prompt",pending==null?null:pending.dto,"busy",pending!=null?pending.answer.isDone():(busy||commandInFlight),"lastActionError",lastActionError,"notification",notification,"controlMode",controlMode,"autoPassNoActions",effectiveAutoPass));
        published.set(snapshot);
    }}
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
        server.createContext("/state",x->{if(auth(x))respond(x,200,published.get());});
        server.createContext("/action",x->{
            if(!auth(x))return;
            if(!x.getRequestMethod().equals("POST")){respond(x,405,obj("error","POST_required"));return;}
            try {
                byte[] bytes=x.getRequestBody().readNBytes(16385);if(bytes.length>16384)throw new IllegalArgumentException("body_too_large");
                JsonObject body=JsonParser.parseString(new String(bytes,StandardCharsets.UTF_8)).getAsJsonObject();
                synchronized(lock){
                    if(exactLong(body.get("revision"),"revision")!=((Number)published.get().get("revision")).longValue()){respond(x,409,obj("error","stale_revision"));return;}
                    String op=exactString(body.get("op"),"op");
                    if(op.equals("reply")){
                        Pending p=pending;
                        if(p==null||p.answer.isDone()||exactInt(body.get("promptId"),"promptId")!=p.event.getId()){respond(x,409,obj("error","stale_prompt"));return;}
                        Object answer=reply(p,body);busy=true;p.answer.complete(answer);
                    }else{
                        if(pending!=null){respond(x,409,obj("error","native_dialog_requires_reply"));return;}
                        if(busy||commandInFlight){respond(x,409,obj("error","native_engine_busy"));return;}
                        final var capturedInput=publishedInput;
                        final long capturedPromptGeneration=promptGeneration.get();
                        if(capturedInput==null||capturedInput!=controller.getInputProxy().getInput()||capturedInput instanceof forge.gamemodes.match.input.InputLockUI){respond(x,409,obj("error","native_input_changed"));return;}
                        Runnable action;
                        switch(op){
                            case "ok" -> {if(!Boolean.TRUE.equals(buttons.get("okEnabled")))throw new IllegalArgumentException("ok_disabled");action=capturedInput::selectButtonOK;}
                            case "cancel" -> {if(!Boolean.TRUE.equals(buttons.get("cancelEnabled")))throw new IllegalArgumentException("cancel_disabled");action=capturedInput::selectButtonCancel;}
                            case "card" -> {int i=exactInt(body.get("id"),"id");CardView c=exposedCards.get(i);if(c==null)throw new IllegalArgumentException("card_not_visible");action=()->{if(!capturedInput.selectCard(controller.getCard(c),null,null)){synchronized(lock){busy=false;}}};}
                            case "player" -> {int i=exactInt(body.get("id"),"id");PlayerView p=exposedPlayers.get(i);if(p==null)throw new IllegalArgumentException("player_not_offered");action=()->capturedInput.selectPlayer(game.getPlayer(p),null);}
                            case "stack" -> {StackItemView s=exposedStack.get(exactInt(body.get("id"),"id"));if(s==null)throw new IllegalArgumentException("stack_item_not_offered");action=()->{for(SpellAbilityStackInstance si:game.getStack())if(si.getId()==s.getId()){if(!capturedInput.selectAbility(si.getSpellAbility())){synchronized(lock){busy=false;}}break;}};}
                            case "concede" -> action=controller::concede;
                            default -> throw new IllegalArgumentException("unknown_operation");
                        }
                        busy=true; commandInFlight=true; lastActionError=null;
                        SwingUtilities.invokeLater(()->{
                            try{
                                if(capturedInput!=controller.getInputProxy().getInput()||capturedPromptGeneration!=promptGeneration.get()||pending!=null){lastActionError="native_decision_changed";return;}
                                action.run();
                            }catch(Throwable t){failure=t.toString();t.printStackTrace();}
                            finally{ synchronized(lock){
                                commandInFlight=false;
                                // Only native stable prompt callbacks or an explicit false selection result release busy.
                                // The same Input identity can enqueue a later native confirmation, so identity alone is not enough.
                                publish();
                            }}
                        });
                    }
                    respond(x,202,obj("accepted",true));
                }
            }catch(Exception e){respond(x,400,obj("error",e.getMessage()==null?e.getClass().getSimpleName():e.getMessage()));}
        });
        server.start();
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
