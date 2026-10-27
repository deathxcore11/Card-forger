package cardstashy.forge;
import forge.*;import forge.gui.GuiBase;import forge.model.FModel;import forge.localinstance.properties.ForgePreferences.FPref;
import forge.game.card.*;import forge.game.phase.*;import forge.game.zone.*;import forge.game.spellability.*;import forge.gamemodes.match.input.*;import forge.gamemodes.net.ProtocolMethod;
import java.util.*;import java.nio.file.*;import java.time.*;import java.util.concurrent.*;import javax.swing.SwingUtilities;
/** Native state fixtures for the 4.2.7 review: trustworthy glow with reasons, Smart passing
 * judged by what can be paid, no stop in an empty combat, and auto-pay apart from Smart.
 * Reuses ContextualSmartChecks' isolated contexts. No CPU strategy changes. */
public final class GlowPassingChecks {
 static final List<Object> results=new ArrayList<>();
 static Card food(ContextualSmartChecks.Ctx c){
  var token=StaticData.instance().getAllTokens().getToken("c_a_food_sac");
  Card x=CardFactory.getCard(token,c.human,c.game);c.human.getZone(ZoneType.Battlefield).add(x);return x;
 }
 /** The live 4.2.7 position: Forest tapped, Gilded Goose summoning sick, its Food, Freyalise in hand. */
 static void tappedOut(ContextualSmartChecks.Ctx c){
  Card forest=ContextualSmartChecks.own(c,"Forest",ZoneType.Battlefield);forest.setTapped(true);
  Card goose=ContextualSmartChecks.own(c,"Gilded Goose",ZoneType.Battlefield);goose.setSickness(true);
  food(c);ContextualSmartChecks.own(c,"Freyalise, Llanowar's Fury",ZoneType.Hand);
 }
 static String assess(ContextualSmartChecks.Ctx c,Card card)throws Exception{
  ContextualSmartChecks.settle(c);
  for(var x:card.getSpellAbilities())x.setActivatingPlayer(c.human);
  var sa=card.getSpellAbilities().stream().filter(x->!x.isManaAbility()&&(card.isInPlay()?!x.isSpell():x.isSpell())).findFirst().orElseThrow();
  return forge.ai.HumanActionAffordability.assess(sa,c.human,System.nanoTime()+TimeUnit.SECONDS.toNanos(2)).name();
 }
 static Card named(ContextualSmartChecks.Ctx c,String name){
  for(ZoneType z:List.of(ZoneType.Battlefield,ZoneType.Hand))for(Card x:c.human.getCardsIn(z))if(x.getName().equals(name))return x;
  throw new IllegalArgumentException(name);
 }
 @SuppressWarnings("unchecked")
 static Map<String,String> reasons(String label)throws Exception{
  var s=com.google.gson.JsonParser.parseString(Files.readString(ContextualSmartChecks.out.resolve(label+"-state.json"))).getAsJsonObject();
  Map<String,String> byName=new TreeMap<>();Map<Integer,String> names=new HashMap<>();
  for(var p:s.getAsJsonArray("players"))for(var z:p.getAsJsonObject().getAsJsonObject("zones").entrySet())for(var card:z.getValue().getAsJsonObject().getAsJsonArray("cards")){
   var o=card.getAsJsonObject();if(o.has("name"))names.put(o.get("id").getAsInt(),o.get("name").getAsString());
  }
  for(var b:s.getAsJsonObject("selection").getAsJsonArray("blocked"))byName.put(names.get(b.getAsJsonObject().get("id").getAsInt()),b.getAsJsonObject().get("reason").getAsString());
  for(var a:s.getAsJsonObject("selection").getAsJsonArray("actionable"))byName.put(names.get(a.getAsJsonObject().get("id").getAsInt()),"GLOW");
  return byName;
 }
 static Map<String,Object> expect(String label,Object expected,Object actual){
  var r=ForgeHttpBridge.obj("label",label,"expected",expected,"actual",actual,"pass",Objects.equals(expected,actual));
  System.out.println((Boolean.TRUE.equals(r.get("pass"))?"PASS ":"FAIL ")+label+" "+ForgeHttpBridge.JSON.toJson(r));return r;
 }
 static void add(int id,String description,List<Map<String,Object>> obs){results.add(ForgeHttpBridge.obj("case",id,"description",description,"observations",obs,"pass",obs.stream().allMatch(r->Boolean.TRUE.equals(r.get("pass")))));}

 /** Casts Metallic Mimic through the bridge's own HTTP actions and reports how it was paid. */
 static Map<String,Object> cast(String mode,Boolean autoPay)throws Exception{
  var c=ContextualSmartChecks.context(PhaseType.MAIN1,mode);c.game.getPhaseHandler().devModeSet(PhaseType.MAIN1,c.human,false,3);c.game.getPhaseHandler().setPriority(c.human);
  ContextualSmartChecks.lands(c,"Plains",2);Card mimic=ContextualSmartChecks.own(c,"Metallic Mimic",ZoneType.Hand);ContextualSmartChecks.settle(c);
  int port;try(var socket=new java.net.ServerSocket(0)){port=socket.getLocalPort();}c.bridge.serve(port);
  var p=new NativePaymentTransitionChecks.Ctx();p.game=c.game;p.human=c.human;p.ctrl=c.ctrl;p.bridge=c.bridge;
  var task=new FutureTask<Boolean>(()->{var choices=c.ctrl.chooseSpellAbilityToPlay();return choices!=null&&choices.size()==1&&c.ctrl.playChosenSpellAbility(choices.get(0));});new Thread(task,"glow-fixture-cast").start();
  long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(8);
  while(!(c.ctrl.getInputProxy().getInput() instanceof InputPassPriority)&&System.nanoTime()<deadline)Thread.sleep(1);
  SwingUtilities.invokeAndWait(()->{});Thread.sleep(25);
  List<Object> actions=new ArrayList<>();
  if(autoPay!=null){actions.add(NativePaymentTransitionChecks.send(p,port,"autoPay",Map.of("value",autoPay)));Thread.sleep(25);}
  Object published=c.bridge.published.get().get("autoPay");
  actions.add(NativePaymentTransitionChecks.send(p,port,"card",Map.of("id",mimic.getId())));
  boolean manualWindow=false,manualOk=false;Set<Integer> answered=new HashSet<>();long payIdleSince=0;
  while(!task.isDone()&&System.nanoTime()<deadline){
   var s=c.bridge.published.get();var prompt=c.bridge.pending;boolean idle=!Boolean.TRUE.equals(s.get("busy"));
   if(prompt!=null&&!prompt.answer.isDone()&&idle&&answered.add(prompt.event.getId())){
    if(prompt.event.getMethod()!=ProtocolMethod.getAbilityToPlay)break;
    actions.add(NativePaymentTransitionChecks.send(p,port,"reply",Map.of("promptId",prompt.event.getId(),"indexes",List.of(0))));
   }else if("InputPayManaOfCostPayment".equals(s.get("inputType"))&&idle&&Boolean.TRUE.equals(((Map<?,?>)s.get("buttons")).get("okEnabled"))){
    if(payIdleSince==0)payIdleSince=System.nanoTime();
    // Left alone for 400 ms: nobody paid for the player, so this is a manual payment window.
    if(!manualOk&&System.nanoTime()-payIdleSince>TimeUnit.MILLISECONDS.toNanos(400)){manualWindow=true;manualOk=true;actions.add(NativePaymentTransitionChecks.send(p,port,"ok",Map.of()));}
   }
   Thread.sleep(2);
  }
  boolean complete=task.isDone()&&task.get();
  if(!task.isDone()){var input=c.ctrl.getInputQueue().getInput();if(input instanceof InputSyncronizedBase sync)SwingUtilities.invokeAndWait(sync::stop);}
  return ForgeHttpBridge.obj("mode",mode,"autoPayAction",autoPay,"publishedAutoPay",published,"castCompleted",complete,"stack",c.game.getStack().size(),"nativeAutoPayments",c.bridge.nativeAutoPayments,"manualPaymentWindow",manualWindow,"actions",actions);
 }

 public static void main(String[]args)throws Exception{
  ContextualSmartChecks.out=Path.of(args[0]);String root=System.getProperty("proof.root");GuiBase.setInterface(new GuiDesktop(){@Override public String getAssetsDir(){return root+"/forge/forge-gui/";}});
  FModel.initialize(null,p->{p.setPref(FPref.USE_SENTRY,false);p.setPref(FPref.DECKGEN_CARDBASED,false);p.setPref(FPref.UI_ENABLE_AI_CHEATS,false);p.setPref(FPref.UI_SHOW_ACTIONABLE_HIGHLIGHTS,true);p.setPref(FPref.UI_SHOW_AUTOTAP_PREVIEW,true);p.setPref(FPref.YIELD_AUTO_PASS_RESPECTS_INTERRUPTS,false);p.setPref(FPref.YIELD_AUTO_PASS_NO_ACTIONS,false);p.setPref(FPref.YIELD_DECLINE_SCOPE_STACK_YIELD,"NEVER");p.setPref(FPref.YIELD_DECLINE_SCOPE_NO_ACTIONS,"NEVER");return null;});
  NativeCpuPolicyIntegration.install(root);
  try{
   List<Map<String,Object>> obs=new ArrayList<>();
   var c=ContextualSmartChecks.context(PhaseType.MAIN1,"smart");tappedOut(c);
   obs.add(expect("01-food-tapped-out","PROVEN_UNAVAILABLE",assess(c,named(c,"Food Token"))));
   obs.add(expect("01-freyalise-tapped-out","PROVEN_UNAVAILABLE",assess(c,named(c,"Freyalise, Llanowar's Fury"))));
   c=ContextualSmartChecks.context(PhaseType.MAIN1,"smart");ContextualSmartChecks.lands(c,"Forest",2);food(c);
   obs.add(expect("01-food-two-forests-still-possible","UNKNOWN",assess(c,named(c,"Food Token"))));
   c=ContextualSmartChecks.context(PhaseType.MAIN1,"smart");ContextualSmartChecks.lands(c,"Forest",1);food(c);
   obs.add(expect("01-food-one-forest","PROVEN_UNAVAILABLE",assess(c,named(c,"Food Token"))));
   add(1,"Affordability: a cost with sacrifice is proven unpayable when even its mana can't be paid",obs);

   obs=new ArrayList<>();
   c=ContextualSmartChecks.context(PhaseType.MAIN1,"smart");tappedOut(c);ContextualSmartChecks.stackCreature(c);
   obs.add(ContextualSmartChecks.window(c,"02-smart-tapped-out-opponent-spell",false));
   c=ContextualSmartChecks.context(PhaseType.MAIN1,"smart");ContextualSmartChecks.lands(c,"Forest",2);food(c);ContextualSmartChecks.stackCreature(c);
   obs.add(ContextualSmartChecks.window(c,"02-smart-food-payable-opponent-spell",true));
   add(2,"Smart passing: no response window when the only ability can't be paid; still stops when it can",obs);

   obs=new ArrayList<>();
   c=ContextualSmartChecks.context(PhaseType.MAIN1,"full");tappedOut(c);ContextualSmartChecks.stackCreature(c);
   obs.add(ContextualSmartChecks.window(c,"03-full-opponent-spell",true));
   obs.add(expect("03-reasons-opponent-turn",new TreeMap<>(Map.of("Food Token","Need 2 mana","Freyalise, Llanowar's Fury","Wrong timing")),reasons("03-full-opponent-spell")));
   c=ContextualSmartChecks.context(PhaseType.MAIN1,"full");c.game.getPhaseHandler().devModeSet(PhaseType.MAIN1,c.human,false,3);c.game.getPhaseHandler().setPriority(c.human);tappedOut(c);
   obs.add(ContextualSmartChecks.window(c,"03-full-own-main",true));
   obs.add(expect("03-reasons-own-main",new TreeMap<>(Map.of("Food Token","Need 2 mana","Freyalise, Llanowar's Fury","Need 5 mana")),reasons("03-full-own-main")));
   c=ContextualSmartChecks.context(PhaseType.MAIN1,"full");c.game.getPhaseHandler().devModeSet(PhaseType.MAIN1,c.human,false,3);c.game.getPhaseHandler().setPriority(c.human);ContextualSmartChecks.lands(c,"Forest",2);food(c);ContextualSmartChecks.own(c,"Murder",ZoneType.Hand);ContextualSmartChecks.own(c,"Llanowar Elves",ZoneType.Hand);
   obs.add(ContextualSmartChecks.window(c,"03-full-own-main-mixed",true));
   obs.add(expect("03-reasons-mixed",new TreeMap<>(Map.of("Food Token","GLOW","Llanowar Elves","GLOW","Murder","No legal target")),reasons("03-full-own-main-mixed")));
   add(3,"Glow only on what can be finished; every other usable-looking card says why",obs);

   obs=new ArrayList<>();
   for(String mode:List.of("smart","full")){
    c=ContextualSmartChecks.context(PhaseType.COMBAT_BEGIN,mode);var yc=c.ctrl.getYieldController();var opp=c.opponent.getView();
    c.bridge.setCombatStops(false);boolean emptySkips=yc.isSkippingPhase(opp,PhaseType.COMBAT_DECLARE_ATTACKERS);
    c.bridge.setCombatStops(true);boolean attackStops=!yc.isSkippingPhase(opp,PhaseType.COMBAT_DECLARE_ATTACKERS);
    c.bridge.setCombatStops(false);c.bridge.applyControlMode();boolean reapplied=yc.isSkippingPhase(opp,PhaseType.COMBAT_DECLARE_ATTACKERS);
    obs.add(expect("04-"+mode+"-empty-combat-skipped",mode.equals("smart"),emptySkips));
    obs.add(expect("04-"+mode+"-declared-attack-stops",true,attackStops));
    obs.add(expect("04-"+mode+"-mode-change-keeps-empty-combat-rule",mode.equals("smart"),reapplied));
   }
   add(4,"Smart has no declare-attackers stop in a combat with no attackers; Full Control keeps every stop",obs);

   obs=new ArrayList<>();
   var smartDefault=cast("smart",null);
   obs.add(expect("05-smart-default-auto-pays",List.of(true,true,1L,false),List.of(smartDefault.get("publishedAutoPay"),smartDefault.get("castCompleted"),smartDefault.get("nativeAutoPayments"),smartDefault.get("manualPaymentWindow"))));
   var fullAuto=cast("full",true);
   obs.add(expect("05-full-control-with-auto-pay",List.of(true,true,1L,false),List.of(fullAuto.get("publishedAutoPay"),fullAuto.get("castCompleted"),fullAuto.get("nativeAutoPayments"),fullAuto.get("manualPaymentWindow"))));
   var smartManual=cast("smart",false);
   obs.add(expect("05-smart-with-manual-pay",List.of(false,true,0L,true),List.of(smartManual.get("publishedAutoPay"),smartManual.get("castCompleted"),smartManual.get("nativeAutoPayments"),smartManual.get("manualPaymentWindow"))));
   var fullDefault=cast("full",null);
   obs.add(expect("05-full-default-manual",List.of(false,true,0L,true),List.of(fullDefault.get("publishedAutoPay"),fullDefault.get("castCompleted"),fullDefault.get("nativeAutoPayments"),fullDefault.get("manualPaymentWindow"))));
   add(5,"Auto-pay is its own switch: Full Control can keep auto-pay, Smart can pay by hand",obs);
  }catch(Throwable t){t.printStackTrace();results.add(ForgeHttpBridge.obj("fatalHarnessError",t.toString()));}
  boolean all=results.size()==5&&results.stream().allMatch(x->Boolean.TRUE.equals(((Map<?,?>)x).get("pass")));
  var summary=ForgeHttpBridge.obj("schema","cardstashy.glow-passing-checks.v1","createdAt",Instant.now().toString(),"engineRevision",ForgeHttpBridge.REV,"caseCount",results.size(),"results",results,"allPass",all);
  Files.writeString(ContextualSmartChecks.out.resolve("SUMMARY.json"),ForgeHttpBridge.JSON.toJson(summary));System.out.println("GLOW_PASSING "+(all?"PASS":"FAIL"));System.exit(all?0:1);
 }
}
