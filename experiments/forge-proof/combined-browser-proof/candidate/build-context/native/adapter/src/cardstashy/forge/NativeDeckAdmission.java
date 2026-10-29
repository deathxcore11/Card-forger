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
 public record Admission(JsonObject input,NativeDeckInput.Resolution human,NativeDeckInput.Resolution opponent,Map<String,Object> receipt,List<NativeDeckInput.Resolution> extras,List<BoundedHeuristicPolicy> extraPolicies){
  public Admission(JsonObject input,NativeDeckInput.Resolution human,NativeDeckInput.Resolution opponent,Map<String,Object> receipt){this(input,human,opponent,receipt,List.of(),List.of());}
  public boolean admitted(){return Boolean.TRUE.equals(receipt.get("legal"))&&Boolean.TRUE.equals(receipt.get("supported"));}
  /** Every CPU deck in seat order: the opponent, then any extra Commander pod seats. */
  public List<NativeDeckInput.Resolution> cpuSeats(){List<NativeDeckInput.Resolution> all=new ArrayList<>();all.add(opponent);all.addAll(extras);return all;}
 }
 // A Commander pod: you plus up to three CPUs. Each extra CPU brings its own deck and level.
 static final int MAX_EXTRA_OPPONENTS=2;
 static Map<String,Object> map(Object...v){return ForgeHttpBridge.obj(v);}
 // A warm engine's input is a pipe. JDK 21 readNBytes asks the channel for its
 // position and size, which a pipe cannot seek ("Illegal seek"), so read plainly.
 static byte[] readBounded(java.io.InputStream in,int limit)throws java.io.IOException{
  var out=new java.io.ByteArrayOutputStream();byte[] chunk=new byte[8192];int n;
  while(out.size()<limit&&(n=in.read(chunk,0,Math.min(chunk.length,limit-out.size())))>0)out.write(chunk,0,n);
  return out.toByteArray();
 }
 public static Admission loadBootstrap(Path path)throws Exception{
  try(var stream=Files.newInputStream(path)){
   byte[] bytes=readBounded(stream,262145);if(bytes.length>262144)throw new IllegalArgumentException("bootstrap_body_too_large");
   JsonObject envelope=JsonParser.parseString(new String(bytes,StandardCharsets.UTF_8)).getAsJsonObject();
   if(!envelope.keySet().equals(Set.of("input")))throw new IllegalArgumentException("bootstrap_requires_only_input");
   JsonObject input=envelope.getAsJsonObject("input");
   if(input==null||input.toString().getBytes(StandardCharsets.UTF_8).length>131072)throw new IllegalArgumentException("match_input_body_too_large");
   return admit(input);
  }
 }
 public static Admission admit(JsonObject input){
  List<String> errors=new ArrayList<>();NativeDeckInput.Resolution human=null,opponent=null;List<NativeDeckInput.Resolution> extras=new ArrayList<>();List<BoundedHeuristicPolicy> extraPolicies=new ArrayList<>();List<Map<String,Object>> extraReceipts=new ArrayList<>();boolean extrasResolved=true;
  BoundedHeuristicPolicy selectedPolicy=null;Map<String,Object> cpuPolicy=null;String policyVersion=null;boolean policy=false,legal=false,nativeLegal=false,dataSupported=false;Map<String,Object> rulesData=null;String humanDigest=null,opponentDigest=null,requestDigest=null;
  try{
   Set<String> keys=input==null?Set.of():new HashSet<>(input.keySet());boolean pod=keys.remove("extraOpponents");
   if(input==null||!(keys.equals(Set.of("format","humanDeck","opponentDeck","difficultyPolicyVersion"))||keys.equals(Set.of("format","humanDeck","opponentDeck","difficultyPolicyVersion","startingPlayer","playStyle"))))throw new IllegalArgumentException("invalid_match_input");
   NativeStartingPlayer.parse(input);
   NativeDeckInput.bounded(input,0,new int[]{0});
   requestDigest=NativeDeckInput.digest(input);humanDigest=NativeDeckInput.digest(input.get("humanDeck"));opponentDigest=NativeDeckInput.digest(input.get("opponentDeck"));
   policyVersion=NativeDeckInput.string(input.get("difficultyPolicyVersion"),"difficultyPolicyVersion",80);selectedPolicy=NativeCpuPolicyIntegration.parse(policyVersion);cpuPolicy=NativeCpuPolicyIntegration.receipt(selectedPolicy);policy=NativeMatchFormat.supported(NativeDeckInput.string(input.get("format"),"format",80));
   if(!policy)errors.add("format_or_policy_not_supported");
   if(pod){
    JsonElement raw=input.get("extraOpponents");
    if(raw==null||!raw.isJsonArray()||raw.getAsJsonArray().isEmpty()||raw.getAsJsonArray().size()>MAX_EXTRA_OPPONENTS)throw new IllegalArgumentException("extra_opponents_invalid");
    if(!"Commander".equals(NativeDeckInput.string(input.get("format"),"format",80)))throw new IllegalArgumentException("extra_opponents_require_commander");
    int seat=0;
    for(JsonElement e:raw.getAsJsonArray()){
     seat++;
     if(!e.isJsonObject()||!e.getAsJsonObject().keySet().equals(Set.of("deck","difficultyPolicyVersion")))throw new IllegalArgumentException("extra_opponent_invalid");
     JsonObject row=e.getAsJsonObject();BoundedHeuristicPolicy level=NativeCpuPolicyIntegration.parse(NativeDeckInput.string(row.get("difficultyPolicyVersion"),"difficultyPolicyVersion",80));
     extraPolicies.add(level);
     try{
      var r=NativeDeckInput.resolveSnapshot(row.getAsJsonObject("deck"),true);
      if(!Objects.equals(input.get("format"),r.source().get("format")))throw new IllegalArgumentException("format_mismatch");
      for(Object problem:(List<?>)r.report().get("legalityProblems"))errors.add("cpu"+(seat+1)+":"+problem);
      extras.add(r);
      extraReceipts.add(map("digest",NativeDeckInput.digest(row.get("deck")),"rosterDigest",r.report().get("nativeRosterDigest"),"cpuPolicy",NativeCpuPolicyIntegration.receipt(level),"summary",publicSummary(r)));
     }catch(RuntimeException ex){errors.add("cpu"+(seat+1)+":"+ex.getMessage());extrasResolved=false;}
    }
   }
   try{human=NativeDeckInput.resolveSnapshot(input.getAsJsonObject("humanDeck"),false);}catch(RuntimeException e){errors.add("human:"+e.getMessage());}
   try{opponent=NativeDeckInput.resolveSnapshot(input.getAsJsonObject("opponentDeck"),true);}catch(RuntimeException e){errors.add("opponent:"+e.getMessage());}
   if(human!=null&&!Objects.equals(input.get("format"),human.source().get("format")))throw new IllegalArgumentException("human_format_mismatch");
   if(opponent!=null&&!Objects.equals(input.get("format"),opponent.source().get("format")))throw new IllegalArgumentException("opponent_format_mismatch");
   if(human!=null)for(Object problem:(List<?>)human.report().get("legalityProblems"))errors.add("human:"+problem);
   if(opponent!=null)for(Object problem:(List<?>)opponent.report().get("legalityProblems"))errors.add("opponent:"+problem);
   nativeLegal=human!=null&&opponent!=null&&extrasResolved&&Boolean.TRUE.equals(human.report().get("legal"))&&Boolean.TRUE.equals(opponent.report().get("legal"))&&extras.stream().allMatch(r->Boolean.TRUE.equals(r.report().get("legal")));
   if(policy&&human!=null&&opponent!=null){
    try{
     var bundle=NativeRulesData.current();rulesData=new LinkedHashMap<>(bundle.receipt());dataSupported=true;
     boolean dataLegal=true;
     try{NativeRulesData.validateDeck(bundle,human);}catch(RuntimeException e){errors.add("human:"+e.getMessage());dataLegal=false;}
     try{NativeRulesData.validateDeck(bundle,opponent);}catch(RuntimeException e){errors.add("opponent:"+e.getMessage());dataLegal=false;}
     for(int i=0;i<extras.size();i++)try{NativeRulesData.validateDeck(bundle,extras.get(i));}catch(RuntimeException e){errors.add("cpu"+(i+2)+":"+e.getMessage());dataLegal=false;}
     rulesData.put("decksVerified",dataLegal);legal=nativeLegal&&dataLegal;
    }catch(RuntimeException e){errors.add(e.getMessage());}
   }
  }catch(RuntimeException e){errors.add(e.getMessage()==null?"malformed_input":e.getMessage());}
  Map<String,Object> receipt=map("schema","cardstashy.forge-exact-initialization.v1","engineRevision",ForgeHttpBridge.REV,"policyVersion",policyVersion,"aiProfile",selectedPolicy==null?null:selectedPolicy.profile,"cpuPolicy",cpuPolicy,"cpuPolicyRuntimeVerified",false,"controlMode","smart","supported",policy&&human!=null&&opponent!=null&&extrasResolved&&dataSupported,"nativeLegal",nativeLegal,"rulesData",rulesData,"legal",legal,"errors",errors,"requestDigest",requestDigest,"humanDigest",humanDigest,"opponentDigest",opponentDigest,"humanRosterDigest",human==null?null:human.report().get("nativeRosterDigest"),"opponentRosterDigest",opponent==null?null:opponent.report().get("nativeRosterDigest"),"registeredRosterVerified",false,"nativeRosterVerified",false,"viewerId",null,"seats",map("human",human==null?null:publicSummary(human),"opponent",opponent==null?null:publicSummary(opponent)),"extraOpponents",extraReceipts,"interactionCoverage","native-definitions-loaded; not a full interaction certification; unsupported native prompts fail closed");
  return new Admission(input==null?null:input.deepCopy(),human,opponent,receipt,List.copyOf(extras),List.copyOf(extraPolicies));
 }
 public static Map<String,Object> publicSummary(NativeDeckInput.Resolution r){
  Map<String,Object> m=new LinkedHashMap<>();
  for(String key:List.of("sourceDigest","nativeRosterDigest","format","nativeFormatRevision","nativeFormatDefinitionDigest","legalityScope","legal","legalityProblems","nativeDefinitionsLoaded","interactionCoverage","cpuWarnings","mainCount","commanderCount","sideCount"))m.put(key,r.report().get(key));
  m.put("commanders",r.deck().getCommanders().stream().map(NativeDeckInput::identity).toList());return m;
 }
 public static void verifyRegistered(Admission a,Deck human,Deck opponent,Deck...extras){
  if(!Objects.equals(a.receipt().get("humanRosterDigest"),NativeDeckInput.digest(NativeDeckInput.JSON.toJsonTree(NativeDeckInput.roster(human))))||!Objects.equals(a.receipt().get("opponentRosterDigest"),NativeDeckInput.digest(NativeDeckInput.JSON.toJsonTree(NativeDeckInput.roster(opponent)))))throw new IllegalStateException("registered_roster_changed");
  if(extras.length!=a.extras().size())throw new IllegalStateException("registered_roster_changed");
  for(int i=0;i<extras.length;i++)if(!Objects.equals(a.extras().get(i).report().get("nativeRosterDigest"),NativeDeckInput.digest(NativeDeckInput.JSON.toJsonTree(NativeDeckInput.roster(extras[i])))))throw new IllegalStateException("registered_roster_changed");
  a.receipt().put("registeredRosterVerified",true);
 }
 // Commander rules are implemented by a hidden DetachedCardEffect, not an extra deck copy.
 // Ignore only native non-paper command effects, never cards, unknown nonpaper objects, or other zones.
 static boolean nativeRulesObject(ZoneType zone,forge.game.card.Card card){return zone==ZoneType.Command&&card instanceof forge.game.ability.effects.DetachedCardEffect&&card.getPaperCard()==null;}
 /** Trusted server-side pre-deal verifier: only hashes/counts escape; never native library order/IDs. */
 public static boolean verifyInstantiatedWhenReady(Admission a,Game game){
  if(Boolean.TRUE.equals(a.receipt().get("nativeRosterVerified")))return true;
  int seats=2+a.extras().size();
  if(game.getPlayers().size()!=seats)return false;
  for(int seat=0;seat<seats;seat++){
   Player p=game.getPlayers().get(seat);Deck expected=seat==0?a.human().deck():a.cpuSeats().get(seat-1).deck();
   int actualCount=0;for(ZoneType z:List.of(ZoneType.Library,ZoneType.Hand,ZoneType.Command))for(var card:p.getCardsIn(z))if(!nativeRulesObject(z,card))actualCount++;int wantedCount=expected.getMain().countAll()+NativeMatchFormat.count(expected,DeckSection.Commander);
   if(actualCount!=wantedCount)return false;
  }
  for(int seat=0;seat<seats;seat++){
   Player p=game.getPlayers().get(seat);Deck actual=new Deck("Instantiated roster");
   for(ZoneType z:List.of(ZoneType.Library,ZoneType.Hand,ZoneType.Command,ZoneType.Sideboard))for(var card:p.getCardsIn(z)){
    if(nativeRulesObject(z,card))continue;
    if(!(card.getPaperCard() instanceof PaperCard paper))throw new IllegalStateException("nonpaper_initial_card");
    DeckSection section=z==ZoneType.Command?DeckSection.Commander:z==ZoneType.Sideboard?DeckSection.Sideboard:DeckSection.Main;
    actual.getOrCreate(section).add(paper,1);
   }
   String digest=NativeDeckInput.digest(NativeDeckInput.JSON.toJsonTree(NativeDeckInput.roster(actual)));
   Object wanted=seat==0?a.receipt().get("humanRosterDigest"):seat==1?a.receipt().get("opponentRosterDigest"):a.extras().get(seat-2).report().get("nativeRosterDigest");
   if(!Objects.equals(digest,wanted))throw new IllegalStateException("instantiated_roster_changed");
  }
  a.receipt().put("nativeRosterVerified",true);return true;
 }
}
