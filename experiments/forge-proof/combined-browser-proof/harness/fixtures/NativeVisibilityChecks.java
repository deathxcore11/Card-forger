package cardstashy.forge;
import forge.*;import forge.gui.GuiBase;import forge.model.FModel;import forge.localinstance.properties.ForgePreferences.FPref;
import forge.game.*;import forge.game.player.*;import forge.game.card.*;import forge.game.phase.*;import forge.game.zone.*;import forge.deck.*;import forge.player.*;import java.util.*;import java.nio.file.*;
/** Isolated native-state fixture. Uses actual loaded card scripts/static evaluation, never permission mutation. */
public final class NativeVisibilityChecks {
 static int checks=0;
 static void check(boolean b,String message){if(!b)throw new AssertionError(message);checks++;System.out.println("PASS "+message);}
 static Card make(String name,Player owner,ZoneType zone){Card c=Card.fromPaperCard(StaticData.instance().getCommonCards().getCard(name),owner);owner.getZone(zone).add(c);return c;}
 @SuppressWarnings("unchecked") static Map<String,Object> zone(ForgeHttpBridge b,int playerId,String name){return (Map<String,Object>)((Map<String,Object>)((List<Map<String,Object>>)b.board.get("players")).stream().filter(p->p.get("id").equals(playerId)).findFirst().orElseThrow().get("zones")).get(name);}
 @SuppressWarnings("unchecked") static List<Map<String,Object>> rows(ForgeHttpBridge b,int p,String z){return (List<Map<String,Object>>)zone(b,p,z).get("cards");}
 @SuppressWarnings("unchecked") static Map<String,Object> receipt(Map<String,Object> snapshot){return (Map<String,Object>)snapshot.get("visibility");}
 @SuppressWarnings("unchecked") static List<Map<String,Object>> grants(ForgeHttpBridge b){return (List<Map<String,Object>>)receipt(b.published.get()).get("cards");}
 static boolean granted(ForgeHttpBridge b,Card c,Player holder,ZoneType zone){return grants(b).contains(Map.of("id",c.getId(),"zone",zone.name(),"zoneHolder",holder.getId()));}
 static void save(ForgeHttpBridge b,String stage)throws Exception{
  b.refreshBoard();b.publish();check(b.failure==null,"bridge projection healthy: "+stage);
  var s=b.published.get();var e=receipt(s);
  check(e.get("schema").equals("cardstashy.forge-visibility.v1")&&e.get("forgeRevision").equals(s.get("forgeRevision"))&&e.get("viewer").equals(s.get("viewer"))&&e.get("revision").equals(s.get("revision")),"visibility receipt bound to exact native/viewer/publication: "+stage);
  Files.writeString(Path.of(System.getProperty("audit.out"),stage+".json"),ForgeHttpBridge.JSON.toJson(s));
 }
 public static void main(String[]args)throws Exception{
  String root=System.getProperty("proof.root");GuiBase.setInterface(new GuiDesktop(){@Override public String getAssetsDir(){return root+"/forge/forge-gui/";}});
  FModel.initialize(null,p->{p.setPref(FPref.USE_SENTRY,false);return null;});
  var a=new RegisteredPlayer(new Deck("visibility fixture A")).setPlayer(new LobbyPlayerHuman("Viewer",0,0));var b=new RegisteredPlayer(new Deck("visibility fixture B")).setPlayer(GamePlayerUtil.createAiPlayer("Opponent",1,"Default"));
  Game game=new Match(new GameRules(GameType.Constructed),List.of(a,b),"Native visibility fixture").createGame();Player human=game.getPlayers().get(0),opponent=game.getPlayers().get(1);
  game.getPhaseHandler().devModeSet(PhaseType.MAIN1,human,false,3);
  ForgeHttpBridge bridge=new ForgeHttpBridge();bridge.game=game;bridge.controller=(PlayerControllerHuman)human.getController();bridge.viewer=human.getView();
  Card secret=make("Silvercoat Lion",opponent,ZoneType.Hand),library=make("Island",opponent,ZoneType.Library),own=make("Plains",human,ZoneType.Hand);
  game.getAction().checkStaticAbilities(false);
  check(!secret.getView().canBeShownTo(human.getView())&&!library.getView().canBeShownTo(human.getView()),"native baseline opponent hand/library denied");
  save(bridge,"01-hidden");check(rows(bridge,opponent.getId(),"Hand").isEmpty()&&rows(bridge,opponent.getId(),"Library").isEmpty(),"hidden hand/library emit counts without identities");
  check(grants(bridge).size()==1&&granted(bridge,own,human,ZoneType.Hand),"own hand has native zone-holder evidence; hidden opponent receives none");
  Card telepathy=make("Telepathy",human,ZoneType.Battlefield);game.getAction().checkStaticAbilities(false);
  check(secret.getView().canBeShownTo(human.getView())&&secret.getView().canFaceDownBeShownTo(human.getView()),"actual Telepathy grants hand face visibility");
  check(!library.getView().canBeShownTo(human.getView()),"Telepathy does not reveal unrelated library");
  save(bridge,"02-revealed");check(rows(bridge,opponent.getId(),"Hand").size()==1&&rows(bridge,opponent.getId(),"Library").isEmpty(),"native projection includes lawful hand only");
  check(grants(bridge).size()==2&&granted(bridge,secret,opponent,ZoneType.Hand)&&!granted(bridge,library,opponent,ZoneType.Library),"grant references only actual permitted hidden-zone faces");
  check(bridge.exposedCards.containsKey(secret.getId()),"revealed card present in native action reference table");
  var old=bridge.published.get();long previous=((Number)old.get("revision")).longValue();bridge.publish();var again=bridge.published.get();
  check(((Number)again.get("revision")).longValue()>previous&&receipt(again).get("revision").equals(again.get("revision")),"prompt-only publication restamps visibility revision");
  check(receipt(old).get("revision").equals(previous)&&old.get("revision").equals(previous),"prior immutable snapshot retains its original revision evidence");
  human.getZone(ZoneType.Battlefield).remove(telepathy);human.getZone(ZoneType.Graveyard).add(telepathy);game.getAction().checkStaticAbilities(false);
  check(!secret.getView().canBeShownTo(human.getView()),"actual static-effect removal revokes hand permission");
  save(bridge,"03-revoked");check(rows(bridge,opponent.getId(),"Hand").isEmpty()&&!bridge.exposedCards.containsKey(secret.getId())&&!granted(bridge,secret,opponent,ZoneType.Hand),"revocation clears projected identity/action reference/evidence");
  check(((Integer)zone(bridge,opponent.getId(),"Hand").get("count"))==1,"revocation retains hidden count only");
  opponent.getZone(ZoneType.Hand).remove(secret);Card replacement=make("Grizzly Bears",opponent,ZoneType.Hand);game.getAction().checkStaticAbilities(false);
  save(bridge,"04-new-hidden");check(rows(bridge,opponent.getId(),"Hand").isEmpty()&&!bridge.exposedCards.containsKey(replacement.getId())&&!granted(bridge,replacement,opponent,ZoneType.Hand),"new post-revocation hand identity remains hidden");
  Card deep=make("Swamp",opponent,ZoneType.Library),ownLibrary=make("Mountain",human,ZoneType.Library),lantern=make("Lantern of Insight",human,ZoneType.Battlefield);game.getAction().checkStaticAbilities(false);
  check(library.getView().canBeShownTo(human.getView())&&ownLibrary.getView().canBeShownTo(human.getView())&&!deep.getView().canBeShownTo(human.getView()),"actual Lantern grants each top library face only");
  save(bridge,"05-library");check(rows(bridge,opponent.getId(),"Library").size()==1&&((Integer)zone(bridge,opponent.getId(),"Library").get("count"))==2,"library projects only native-visible face and full count");
  check(granted(bridge,library,opponent,ZoneType.Library)&&granted(bridge,ownLibrary,human,ZoneType.Library)&&!granted(bridge,deep,opponent,ZoneType.Library),"library evidence binds exact holder/card without inventing order");
  human.getZone(ZoneType.Battlefield).remove(lantern);human.getZone(ZoneType.Graveyard).add(lantern);game.getAction().checkStaticAbilities(false);
  Card facedown=make("Hill Giant",opponent,ZoneType.Battlefield);facedown.turnFaceDown();game.getAction().checkStaticAbilities(false);
  check(facedown.getView().canBeShownTo(human.getView())&&!facedown.getView().canFaceDownBeShownTo(human.getView()),"face-down public permanent visible as object but not face");
  save(bridge,"06-face-down");var masked=rows(bridge,opponent.getId(),"Battlefield").stream().filter(c->c.get("id").equals(facedown.getId())).findFirst().orElseThrow();
  check(Boolean.TRUE.equals(masked.get("hidden"))&&!masked.containsKey("name")&&!masked.containsKey("imageKey")&&!masked.containsKey("text"),"face-down public object carries no identity or artwork");
  check(rows(bridge,opponent.getId(),"Library").isEmpty()&&rows(bridge,human.getId(),"Library").isEmpty()&&grants(bridge).size()==1,"Lantern removal revokes both library faces and evidence");
  check(grants(bridge).stream().noneMatch(g->g.get("id").equals(facedown.getId())),"no hidden-zone face evidence for masked public object");
  // Failure-only fixture after the ordinary visibility cycle: actual Telepathy re-enables
  // a native reveal, then projection publication fails. No native permission is fabricated.
  human.getZone(ZoneType.Graveyard).remove(telepathy);human.getZone(ZoneType.Battlefield).add(telepathy);game.getAction().checkStaticAbilities(false);
  save(bridge,"07-revealed-before-failure");check(granted(bridge,replacement,opponent,ZoneType.Hand),"actual Telepathy reveal available before failure fixture");
  var preFailure=bridge.published.get();long preFailureRevision=((Number)preFailure.get("revision")).longValue();
  bridge.message="Previously revealed "+replacement.getName();bridge.lastActionError=replacement.getName();bridge.notification=ForgeHttpBridge.obj("message",replacement.getName());
  bridge.pending=bridge.makePending(new forge.gamemodes.net.event.GuiGameEvent(forge.gamemodes.net.ProtocolMethod.getChoices,"Previously revealed "+replacement.getName(),-1,-1,List.of(replacement.getView()),List.of(),null));
  var pendingBefore=bridge.pending;
  // Deliberate duplicate projection representation, not a claim that this card was cast.
  bridge.board=new LinkedHashMap<>(bridge.board);bridge.board.put("stack",List.of(ForgeHttpBridge.obj("id",999,"text",replacement.getName(),"source",bridge.card(replacement.getView()))));
  var failureIntent=new forge.gamemodes.match.input.InputPassPriority(bridge.controller);var failureAbility=new forge.game.spellability.SpellPermanent(replacement);
  bridge.controlMode="smart";bridge.effectiveAutoPass=true;bridge.smartIntentOrigin=failureIntent;bridge.smartIntentAbility=failureAbility;bridge.autoPayAttemptInput=failureIntent;
  long paymentsBeforeFailure=bridge.nativeAutoPayments;
  bridge.failure="Controlled projection failure with "+replacement.getName();
  // Any live graph access would fail: failure publication must use only immutable metadata.
  bridge.controller=null;bridge.game=null;bridge.viewer=null;bridge.publish();
  var failed=bridge.published.get();String failedJson=ForgeHttpBridge.JSON.toJson(failed),failedBoardJson=ForgeHttpBridge.JSON.toJson(bridge.board);
  check(failed.get("status").equals("failed")&&failed.get("failure").equals("native_match_failed")&&failed.get("message").equals("Native match stopped."),"failure publishes generic stopped status without native diagnostic identity");
  check(Boolean.FALSE.equals(failed.get("autoPassNoActions"))&&!bridge.effectiveAutoPass&&bridge.smartIntentOrigin==null&&bridge.smartIntentAbility==null&&bridge.autoPayAttemptInput==null,"failed publication explicitly disables bridge auto-pass and scrubs Smart intent/payment attempt");
  bridge.maybeNativeAutoPay();bridge.applyControlMode();bridge.onPhase(new forge.game.event.GameEventTurnPhase(human.getView(),PhaseType.UPKEEP,"fixture"));bridge.armSmartSpellIntent(failureIntent);
  check(!bridge.effectiveAutoPass&&bridge.smartIntentOrigin==null&&bridge.smartIntentAbility==null&&bridge.autoPayAttemptInput==null&&bridge.nativeAutoPayments==paymentsBeforeFailure&&!pendingBefore.answer.isDone(),"failed Smart entry points make no live graph read, payment increment, or native reply");
  boolean singletonStopped=false;
  try{bridge.sendAndWait(new forge.gamemodes.net.event.GuiGameEvent(forge.gamemodes.net.ProtocolMethod.getAbilityToPlay,replacement.getView(),List.of(failureAbility.getView())));}
  catch(IllegalStateException expected){singletonStopped=expected.getMessage().contains("Overlapping native dialog");}
  check(singletonStopped&&bridge.pending==pendingBefore&&!pendingBefore.answer.isDone(),"failure disables Smart singleton automatic reply without replacing native pending prompt");
  for(String name:List.of("Grizzly Bears","Plains","Telepathy","Hill Giant","Lantern of Insight","Island","Swamp","Mountain"))check(!failedJson.contains(name)&&!failedBoardJson.contains(name),"failure removes stored/publication card identity: "+name);
  check(rows(bridge,human.getId(),"Hand").isEmpty()&&rows(bridge,opponent.getId(),"Hand").isEmpty()&&rows(bridge,opponent.getId(),"Battlefield").isEmpty(),"failed board caches retain no private or public card rows");
  check(((Integer)zone(bridge,opponent.getId(),"Hand").get("count"))==1&&((Integer)zone(bridge,opponent.getId(),"Library").get("count"))==2,"failed publication preserves zone counts without identities");
  check(grants(bridge).isEmpty()&&bridge.boardVisibility.isEmpty()&&bridge.exposedCards.isEmpty()&&bridge.exposedStack.isEmpty(),"failure clears visibility grants and card/stack action reference caches");
  check(((List<?>)failed.get("stack")).isEmpty()&&failed.get("prompt")==null&&((Map<?,?>)failed.get("notification")).isEmpty()&&failed.get("lastActionError")==null&&((Map<?,?>)failed.get("selection")).values().stream().allMatch(v->v instanceof List<?> list?list.isEmpty():v.equals(0)),"failure clears duplicated stack/prompt/selection/notification identities");
  check(bridge.pending==pendingBefore&&!pendingBefore.answer.isDone(),"failure redaction does not fabricate replies or change native pending cancellation semantics");
  check(((Number)failed.get("revision")).longValue()>preFailureRevision&&receipt(failed).get("revision").equals(failed.get("revision")),"failed publication revision remains bound with zero grants");
  Files.writeString(Path.of(System.getProperty("audit.out"),"08-failed.json"),failedJson);
  bridge.publish();check(grants(bridge).isEmpty()&&!ForgeHttpBridge.JSON.toJson(bridge.published.get()).contains(replacement.getName()),"repeated failed publication cannot restamp historical reveal grants or identity");
  check(ForgeHttpBridge.JSON.toJson(preFailure).contains(replacement.getName())&&receipt(preFailure).get("revision").equals(preFailureRevision),"failure redaction never mutates an older permitted immutable publication");
  // Only a fresh local loopback test listener: no host, account, deployed bridge, or external request.
  java.net.InetAddress loopback=java.net.InetAddress.getLoopbackAddress();int port;
  try(var reservation=new java.net.ServerSocket(0,1,loopback)){port=reservation.getLocalPort();}
  bridge.serve(port);String host=loopback.getHostAddress();if(host.contains(":"))host="["+host+"]";
  var http=java.net.http.HttpClient.newBuilder().connectTimeout(java.time.Duration.ofSeconds(2)).build();
  for(String op:List.of("reply","ok","cancel","card","player","stack","controlMode","concede")){
   String body=ForgeHttpBridge.JSON.toJson(ForgeHttpBridge.obj("revision",bridge.published.get().get("revision"),"op",op,"promptId",pendingBefore.dto.get("id"),"indexes",List.of(),"value","smart","id",replacement.getId()));
   var request=java.net.http.HttpRequest.newBuilder(java.net.URI.create("http://"+host+":"+port+"/action")).timeout(java.time.Duration.ofSeconds(2)).header("Authorization","Bearer "+bridge.token).header("Content-Type","application/json").POST(java.net.http.HttpRequest.BodyPublishers.ofString(body)).build();
   var response=http.send(request,java.net.http.HttpResponse.BodyHandlers.ofString());
   check(response.statusCode()==409&&com.google.gson.JsonParser.parseString(response.body()).getAsJsonObject().get("error").getAsString().equals("native_match_unavailable"),"failed native action rejected before dispatch: "+op);
  }
  check(bridge.pending==pendingBefore&&!pendingBefore.answer.isDone()&&bridge.nativeAutoPayments==paymentsBeforeFailure&&!bridge.effectiveAutoPass,"rejected failed-state commands do not reply, pay, pass, or cancel native pending decision");
  Files.writeString(Path.of(System.getProperty("audit.out"),"summary.json"),ForgeHttpBridge.JSON.toJson(Map.of("layer","native0414 isolated visibility patch fixture","checks",checks,"realTelepathy",true,"realLanternOfInsight",true,"failurePublicationFailClosed",true,"failedActionLoopbackChecks",8,"externalRequests",0,"browserAcceptance",false)));
  System.out.println("PASS native lawful visibility: "+checks+" checks; real static effects, revocation, publication binding, library, face-down, failed-publication redaction; private fixtures only");System.exit(0);
 }
}
