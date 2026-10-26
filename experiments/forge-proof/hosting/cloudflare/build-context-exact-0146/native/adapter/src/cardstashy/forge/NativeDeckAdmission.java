package cardstashy.forge;
import com.google.gson.*;
import forge.deck.*;
import forge.game.Game;
import forge.game.player.Player;
import forge.game.zone.ZoneType;
import forge.item.PaperCard;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Same existing snapshot contract as HOSTv3; validates within the single provisional match JVM. */
public final class NativeDeckAdmission {
 public record Admission(JsonObject input,NativeDeckInput.Resolution human,NativeDeckInput.Resolution opponent,Map<String,Object> receipt){
  public boolean admitted(){return Boolean.TRUE.equals(receipt.get("legal"))&&Boolean.TRUE.equals(receipt.get("supported"));}
 }
 static Map<String,Object> map(Object...v){return ForgeHttpBridge.obj(v);}
 public static Admission loadBootstrap(Path path)throws Exception{
  try(var stream=Files.newInputStream(path)){
   byte[] bytes=stream.readNBytes(262145);if(bytes.length>262144)throw new IllegalArgumentException("bootstrap_body_too_large");
   JsonObject envelope=JsonParser.parseString(new String(bytes,StandardCharsets.UTF_8)).getAsJsonObject();
   if(!envelope.keySet().equals(Set.of("input")))throw new IllegalArgumentException("bootstrap_requires_only_input");
   JsonObject input=envelope.getAsJsonObject("input");
   if(input==null||input.toString().getBytes(StandardCharsets.UTF_8).length>131072)throw new IllegalArgumentException("match_input_body_too_large");
   return admit(input);
  }
 }
 public static Admission admit(JsonObject input){
  List<String> errors=new ArrayList<>();NativeDeckInput.Resolution human=null,opponent=null;
  boolean policy=false,legal=false;String humanDigest=null,opponentDigest=null,requestDigest=null;
  try{
   if(input==null||!input.keySet().equals(Set.of("format","humanDeck","opponentDeck","difficultyPolicyVersion")))throw new IllegalArgumentException("invalid_match_input");
   NativeDeckInput.bounded(input,0,new int[]{0});
   requestDigest=NativeDeckInput.digest(input);humanDigest=NativeDeckInput.digest(input.get("humanDeck"));opponentDigest=NativeDeckInput.digest(input.get("opponentDeck"));
   policy="Commander".equals(NativeDeckInput.string(input.get("format"),"format",80))&&NativeDeckInput.POLICY.equals(NativeDeckInput.string(input.get("difficultyPolicyVersion"),"difficultyPolicyVersion",80));
   if(!policy)errors.add("format_or_policy_not_supported");
   try{human=NativeDeckInput.resolveSnapshot(input.getAsJsonObject("humanDeck"),false);}catch(RuntimeException e){errors.add("human:"+e.getMessage());}
   try{opponent=NativeDeckInput.resolveSnapshot(input.getAsJsonObject("opponentDeck"),true);}catch(RuntimeException e){errors.add("opponent:"+e.getMessage());}
   if(human!=null&&!Objects.equals(input.get("format"),human.source().get("format")))throw new IllegalArgumentException("human_format_mismatch");
   if(opponent!=null&&!Objects.equals(input.get("format"),opponent.source().get("format")))throw new IllegalArgumentException("opponent_format_mismatch");
   if(human!=null)for(Object problem:(List<?>)human.report().get("legalityProblems"))errors.add("human:"+problem);
   if(opponent!=null)for(Object problem:(List<?>)opponent.report().get("legalityProblems"))errors.add("opponent:"+problem);
   legal=human!=null&&opponent!=null&&Boolean.TRUE.equals(human.report().get("legal"))&&Boolean.TRUE.equals(opponent.report().get("legal"));
  }catch(RuntimeException e){errors.add(e.getMessage()==null?"malformed_input":e.getMessage());}
  Map<String,Object> receipt=map("schema","cardstashy.forge-exact-initialization.v1","engineRevision",ForgeHttpBridge.REV,"policyVersion",NativeDeckInput.POLICY,"aiProfile","Default","controlMode","smart","supported",policy&&human!=null&&opponent!=null,"legal",legal,"errors",errors,"requestDigest",requestDigest,"humanDigest",humanDigest,"opponentDigest",opponentDigest,"humanRosterDigest",human==null?null:human.report().get("nativeRosterDigest"),"opponentRosterDigest",opponent==null?null:opponent.report().get("nativeRosterDigest"),"registeredRosterVerified",false,"nativeRosterVerified",false,"viewerId",null,"seats",map("human",human==null?null:publicSummary(human),"opponent",opponent==null?null:publicSummary(opponent)),"interactionCoverage","native-definitions-loaded; not a full interaction certification; unsupported native prompts fail closed");
  return new Admission(input==null?null:input.deepCopy(),human,opponent,receipt);
 }
 public static Map<String,Object> publicSummary(NativeDeckInput.Resolution r){
  Map<String,Object> m=new LinkedHashMap<>();
  for(String key:List.of("sourceDigest","nativeRosterDigest","format","nativeFormatRevision","legal","legalityProblems","nativeDefinitionsLoaded","interactionCoverage","cpuWarnings","mainCount","commanderCount","sideCount"))m.put(key,r.report().get(key));
  m.put("commanders",r.deck().getCommanders().stream().map(NativeDeckInput::identity).toList());return m;
 }
 public static void verifyRegistered(Admission a,Deck human,Deck opponent){
  if(!Objects.equals(a.receipt().get("humanRosterDigest"),NativeDeckInput.digest(NativeDeckInput.JSON.toJsonTree(NativeDeckInput.roster(human))))||!Objects.equals(a.receipt().get("opponentRosterDigest"),NativeDeckInput.digest(NativeDeckInput.JSON.toJsonTree(NativeDeckInput.roster(opponent)))))throw new IllegalStateException("registered_roster_changed");
  a.receipt().put("registeredRosterVerified",true);
 }
 // Commander rules are implemented by a hidden DetachedCardEffect, not an extra deck copy.
 // Ignore only native non-paper command effects, never cards, unknown nonpaper objects, or other zones.
 static boolean nativeRulesObject(ZoneType zone,forge.game.card.Card card){return zone==ZoneType.Command&&card instanceof forge.game.ability.effects.DetachedCardEffect&&card.getPaperCard()==null;}
 /** Trusted server-side pre-deal verifier: only hashes/counts escape; never native library order/IDs. */
 public static boolean verifyInstantiatedWhenReady(Admission a,Game game){
  if(Boolean.TRUE.equals(a.receipt().get("nativeRosterVerified")))return true;
  if(game.getPlayers().size()!=2)return false;
  for(int seat=0;seat<2;seat++){
   Player p=game.getPlayers().get(seat);Deck expected=seat==0?a.human().deck():a.opponent().deck();
   int actualCount=0;for(ZoneType z:List.of(ZoneType.Library,ZoneType.Hand,ZoneType.Command))for(var card:p.getCardsIn(z))if(!nativeRulesObject(z,card))actualCount++;int wantedCount=expected.getMain().countAll()+expected.get(DeckSection.Commander).countAll();
   if(actualCount!=wantedCount)return false;
  }
  for(int seat=0;seat<2;seat++){
   Player p=game.getPlayers().get(seat);Deck actual=new Deck("Instantiated roster");
   for(ZoneType z:List.of(ZoneType.Library,ZoneType.Hand,ZoneType.Command,ZoneType.Sideboard))for(var card:p.getCardsIn(z)){
    if(nativeRulesObject(z,card))continue;
    if(!(card.getPaperCard() instanceof PaperCard paper))throw new IllegalStateException("nonpaper_initial_card");
    DeckSection section=z==ZoneType.Command?DeckSection.Commander:z==ZoneType.Sideboard?DeckSection.Sideboard:DeckSection.Main;
    actual.getOrCreate(section).add(paper,1);
   }
   String digest=NativeDeckInput.digest(NativeDeckInput.JSON.toJsonTree(NativeDeckInput.roster(actual)));
   if(!Objects.equals(digest,a.receipt().get(seat==0?"humanRosterDigest":"opponentRosterDigest")))throw new IllegalStateException("instantiated_roster_changed");
  }
  a.receipt().put("nativeRosterVerified",true);return true;
 }
}
