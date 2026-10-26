// SPDX-License-Identifier: GPL-3.0-or-later
package cardstashy.forge;
import forge.*;import forge.gui.GuiBase;import forge.model.FModel;import forge.localinstance.properties.ForgePreferences.FPref;
import forge.game.*;import forge.game.player.*;import forge.game.card.*;import forge.game.phase.*;import forge.game.zone.*;import forge.game.spellability.*;import forge.deck.*;import forge.player.*;import forge.gamemodes.net.*;import forge.gamemodes.match.input.*;import forge.gui.control.GameEventForwarder;
import java.util.*;import java.nio.file.*;import java.net.*;import java.net.http.*;import java.time.Duration;import java.util.concurrent.*;import javax.swing.SwingUtilities;
import com.google.gson.*;
/** Actual native human-controller payment fixture. No browser, CPU gameplay or all-card claim. */
public final class NativePaymentTransitionChecks {
 static class Ctx {Game game;Player human,opponent;PlayerControllerHuman ctrl;ForgeHttpBridge bridge;}
 static Ctx context(PhaseType phase,String mode)throws Exception {
  Ctx c=new Ctx();var h=new RegisteredPlayer(new Deck("isolated human fixture")).setPlayer(new LobbyPlayerHuman("Human",0,0));var o=new RegisteredPlayer(new Deck("isolated opponent fixture")).setPlayer(GamePlayerUtil.createAiPlayer("CPU fixture",1,"Default"));
  c.game=new Match(new GameRules(GameType.Constructed),List.of(h,o),"Contextual Smart fixture").createGame();c.human=c.game.getPlayers().get(0);c.opponent=c.game.getPlayers().get(1);c.human.setLife(20,null);c.opponent.setLife(20,null);
  c.game.getPhaseHandler().devModeSet(phase,c.opponent,false,4);c.game.getPhaseHandler().setPriority(c.human);
  c.ctrl=(PlayerControllerHuman)c.human.getController();var b=new ForgeHttpBridge();c.bridge=b;b.game=c.game;b.controller=c.ctrl;b.viewer=c.human.getView();b.controlMode=mode;b.humanDeckAlias="isolated-human-fixture";b.aiDeckAlias="isolated-cpu-fixture";
  b.gui=new ProtocolGuiGame(b);c.ctrl.setGui(b.gui);b.gui.setGameView(c.game.getView());b.gui.setOriginalGameController(b.viewer,c.ctrl);
  var f=new GameEventForwarder(b.gui);b.gui.setForwarder(f);c.game.subscribeToEvents(b);c.game.subscribeToEvents(f);c.game.subscribeToEvents(c.ctrl.getYieldController());c.ctrl.getInputQueue().addObserver(f);
  for(Player p:c.game.getPlayers())p.updateOpponentsForView();b.applyControlMode();c.ctrl.getYieldController().setPref(FPref.YIELD_SKIP_PHASE_DELAY,"true");c.ctrl.getYieldController().setPref(FPref.YIELD_SKIP_RESOLVE_DELAY,"true");
  return c;
 }
 static Card card(Ctx c,String name,Player owner,ZoneType zone){var paper=StaticData.instance().getCommonCards().getCard(name);if(paper==null)throw new IllegalArgumentException("No native definition "+name);Card x=Card.fromPaperCard(paper,owner);if(zone==ZoneType.Stack)c.game.getStackZone().add(x);else owner.getZone(zone).add(x);return x;}
 static Card own(Ctx c,String name,ZoneType zone){return card(c,name,c.human,zone);}
 static void lands(Ctx c,String name,int n){for(int i=0;i<n;i++)own(c,name,ZoneType.Battlefield);}
 static void settle(Ctx c)throws Exception{c.game.getAction().checkStaticAbilities(false);c.bridge.refreshBoard();c.bridge.publish();SwingUtilities.invokeAndWait(()->{});}

 static final HttpClient HTTP=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
 static Map<String,Object> send(Ctx c,int port,String op,Map<String,Object> extra)throws Exception {
  return sendAtRevision(c,port,op,extra,c.bridge.published.get().get("revision"));
 }
 static Map<String,Object> sendAtRevision(Ctx c,int port,String op,Map<String,Object> extra,Object revision)throws Exception {
  var body=new LinkedHashMap<String,Object>(extra);body.put("op",op);body.put("revision",revision);
  var q=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/action")).timeout(Duration.ofSeconds(3)).header("Authorization","Bearer "+c.bridge.token).header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(ForgeHttpBridge.JSON.toJson(body))).build();
  var r=HTTP.send(q,HttpResponse.BodyHandlers.ofString());var json=JsonParser.parseString(r.body()).getAsJsonObject();
  String code=json.has("error")?json.get("error").getAsString():"accepted";
  if(!Set.of("accepted","stale_revision","native_engine_busy","native_input_changed","stale_prompt","native_dialog_requires_reply","ok_disabled","cancel_disabled").contains(code))code="other";
  return ForgeHttpBridge.obj("operation",op,"httpStatus",r.statusCode(),"reason",code);
 }
 static long taps(Ctx c){return c.human.getCardsIn(ZoneType.Battlefield).stream().filter(x->x.isLand()&&x.isTapped()).count();}
 /** Hold the actual UI dispatcher so duplicate HTTP submissions race a consumed decision,
  * not the next native prompt. Rejections must leave both its receipt and resources intact. */
 static Map<String,Object> submitWithDuplicateChecks(Ctx c,int port,String op,Map<String,Object> extra,List<Object> checks)throws Exception {
  CountDownLatch held=new CountDownLatch(1),release=new CountDownLatch(1);
  SwingUtilities.invokeLater(()->{held.countDown();try{if(!release.await(5,TimeUnit.SECONDS))throw new IllegalStateException("fixture_dispatch_hold_timeout");}catch(InterruptedException e){Thread.currentThread().interrupt();}});
  if(!held.await(2,TimeUnit.SECONDS))throw new IllegalStateException("fixture_dispatch_hold_unavailable");
  try{
   Object originalRevision=c.bridge.published.get().get("revision");
   long beforeTaps=taps(c);int beforeStack=c.game.getStack().size(),beforeHand=c.human.getCardsIn(ZoneType.Hand).size(),beforeLife=c.human.getLife();
   Map<String,Object> accepted=sendAtRevision(c,port,op,extra,originalRevision),consumed=c.bridge.published.get();
   Map<String,Object> duplicate=sendAtRevision(c,port,op,extra,originalRevision);
   Map<String,Object> busy=sendAtRevision(c,port,op,extra,consumed.get("revision"));
   boolean unchanged=consumed==c.bridge.published.get()&&beforeTaps==taps(c)&&beforeStack==c.game.getStack().size()&&beforeHand==c.human.getCardsIn(ZoneType.Hand).size()&&beforeLife==c.human.getLife();
   boolean pass=Integer.valueOf(202).equals(accepted.get("httpStatus"))&&Boolean.TRUE.equals(consumed.get("busy"))
    &&Integer.valueOf(409).equals(duplicate.get("httpStatus"))&&"stale_revision".equals(duplicate.get("reason"))
    &&Integer.valueOf(409).equals(busy.get("httpStatus"))&&"native_engine_busy".equals(busy.get("reason"))&&unchanged;
   checks.add(ForgeHttpBridge.obj("operation",op,"duplicate",duplicate,"consumedRevisionRequest",busy,"receiptAndResourcesUnchanged",unchanged,"busyReceipt",consumed.get("busy"),"pass",pass));
   return accepted;
  }finally{release.countDown();}
 }
 static Map<String,Object> run(String mode,String payment,int delay)throws Exception {
  Ctx c=context(PhaseType.MAIN1,mode);c.game.getPhaseHandler().devModeSet(PhaseType.MAIN1,c.human,false,3);c.game.getPhaseHandler().setPriority(c.human);
  lands(c,"Plains",2);Card mimic=own(c,"Metallic Mimic",ZoneType.Hand);settle(c);
  int port;try(var socket=new java.net.ServerSocket(0)){port=socket.getLocalPort();}c.bridge.serve(port);
  var task=new FutureTask<Boolean>(()->{var choices=c.ctrl.chooseSpellAbilityToPlay();return choices!=null&&choices.size()==1&&c.ctrl.playChosenSpellAbility(choices.get(0));});new Thread(task,"native-payment-fixture").start();
  long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(8);
  while(!(c.ctrl.getInputProxy().getInput() instanceof InputPassPriority)&&System.nanoTime()<deadline)Thread.sleep(1);
  SwingUtilities.invokeAndWait(()->{});Thread.sleep(25); // settle initial prompt before starting the measured operation
  Set<Integer> answeredPrompts=new HashSet<>();List<Object> actions=new ArrayList<>(),rejectionChecks=new ArrayList<>();actions.add(send(c,port,"card",Map.of("id",mimic.getId())));
  int obsoleteAutoWindows=0,observedPending=0,missingBusy=0,manualCommands=0;boolean paymentWindow=false;
  long lastRevision=-1,stableSince=System.nanoTime();
  // Test-only observation of Forge's pre-existing lock also permits a negative run against the unmodified baseline.
  var nativeLock=InputPayMana.class.getDeclaredField("locked");nativeLock.setAccessible(true);
  while(!task.isDone()&&System.nanoTime()<deadline){
   var snapshot=c.bridge.published.get();var input=c.ctrl.getInputProxy().getInput();
   long rev=((Number)snapshot.get("revision")).longValue();
   if(rev!=lastRevision){lastRevision=rev;stableSince=System.nanoTime();}
   boolean idle=!Boolean.TRUE.equals(snapshot.get("busy"));
   boolean pay="InputPayManaOfCostPayment".equals(snapshot.get("inputType"));
   boolean enabled=Boolean.TRUE.equals(((Map<?,?>)snapshot.get("buttons")).get("okEnabled"));
   if(input instanceof InputPayMana && nativeLock.getBoolean(input)){
    observedPending++;
    // Only assess the receipt if it still represents this exact input and revision.
    if(snapshot==c.bridge.published.get()&&input==c.bridge.publishedInput&&snapshot.get("prompt")==null&&idle)missingBusy++;
   }
   if(pay&&idle&&enabled){paymentWindow=true;if(mode.equals("smart"))obsoleteAutoWindows++;}
   var prompt=c.bridge.pending;
   if(prompt!=null&&!prompt.answer.isDone()&&idle&&!answeredPrompts.contains(prompt.event.getId())){
    if(prompt.event.getMethod()!=ProtocolMethod.getAbilityToPlay)break;
    answeredPrompts.add(prompt.event.getId());actions.add(send(c,port,"reply",Map.of("promptId",prompt.event.getId(),"indexes",List.of(0))));
   }else if(mode.equals("full")&&pay&&idle&&System.nanoTime()-stableSince>=TimeUnit.MILLISECONDS.toNanos(delay)){
    if(payment.equals("auto")&&enabled&&manualCommands==0){actions.add(submitWithDuplicateChecks(c,port,"ok",Map.of(),rejectionChecks));manualCommands++;}
    if(payment.equals("tap")&&manualCommands<2){Card land=c.human.getCardsIn(ZoneType.Battlefield).stream().filter(x->x.isLand()&&!x.isTapped()).findFirst().orElse(null);if(land!=null){actions.add(submitWithDuplicateChecks(c,port,"card",Map.of("id",land.getId()),rejectionChecks));manualCommands++;}}
   }
   Thread.sleep(1);
  }
  boolean complete=task.isDone()&&task.get();
  if(!task.isDone()){var input=c.ctrl.getInputQueue().getInput();if(input instanceof InputSyncronizedBase sync)SwingUtilities.invokeAndWait(sync::stop);}
  boolean statuses=actions.stream().allMatch(x->Integer.valueOf(202).equals(((Map<?,?>)x).get("httpStatus")));
  boolean pass=complete&&c.game.getStack().size()==1&&taps(c)==2&&statuses&&missingBusy==0
    &&rejectionChecks.size()==manualCommands&&rejectionChecks.stream().allMatch(x->Boolean.TRUE.equals(((Map<?,?>)x).get("pass")))
    &&(mode.equals("smart")?c.bridge.nativeAutoPayments==1&&obsoleteAutoWindows==0:c.bridge.nativeAutoPayments==0&&paymentWindow&&manualCommands==(payment.equals("tap")?2:1));
  return ForgeHttpBridge.obj("mode",mode,"payment",payment,"delayMilliseconds",delay,"nativeCastCompleted",complete,"stackSize",c.game.getStack().size(),"tappedLands",taps(c),"nativeAutoPayments",c.bridge.nativeAutoPayments,"manualPaymentCommands",manualCommands,"paymentWindowObserved",paymentWindow,"obsoleteAutoWindows",obsoleteAutoWindows,"pendingSamples",observedPending,"pendingWithoutBusy",missingBusy,"actions",actions,"rejectionChecks",rejectionChecks,"pass",pass);
 }
 public static void main(String[] args)throws Exception {
  String root=System.getProperty("proof.root");GuiBase.setInterface(new GuiDesktop(){@Override public String getAssetsDir(){return root+"/forge/forge-gui/";}});
  FModel.initialize(null,p->{p.setPref(FPref.USE_SENTRY,false);p.setPref(FPref.DECKGEN_CARDBASED,false);p.setPref(FPref.UI_ENABLE_AI_CHEATS,false);p.setPref(FPref.UI_SHOW_ACTIONABLE_HIGHLIGHTS,true);p.setPref(FPref.UI_SHOW_AUTOTAP_PREVIEW,true);p.setPref(FPref.YIELD_AUTO_PASS_RESPECTS_INTERRUPTS,false);p.setPref(FPref.YIELD_AUTO_PASS_NO_ACTIONS,false);p.setPref(FPref.YIELD_DECLINE_SCOPE_STACK_YIELD,"NEVER");p.setPref(FPref.YIELD_DECLINE_SCOPE_NO_ACTIONS,"NEVER");return null;});NativeCpuPolicyIntegration.install(root);
  List<Object> results=new ArrayList<>();try{for(int delay:new int[]{25,100,250}){results.add(run("smart","native",delay));results.add(run("full","auto",delay));results.add(run("full","tap",delay));}}catch(Throwable e){results.add(ForgeHttpBridge.obj("diagnosticErrorClass",e.getClass().getSimpleName()));}
  boolean pass=results.size()==9&&results.stream().allMatch(x->Boolean.TRUE.equals(((Map<?,?>)x).get("pass")));
  var summary=ForgeHttpBridge.obj("schema","cardstashy.native-payment-transition-checks.v1","layer","local native human-controller fixture; no browser or container","exactCiCauseProven",false,"allPass",pass,"results",results);
  Files.writeString(Path.of(args[0]),ForgeHttpBridge.JSON.toJson(summary));System.out.println("NATIVE_PAYMENT_TRANSITIONS "+(pass?"PASS":"FAIL"));System.exit(pass?0:1);
 }
}
