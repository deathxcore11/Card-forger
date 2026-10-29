package cardstashy.forge;
import com.google.gson.*;
import forge.StaticData;import forge.card.CardEdition;import forge.deck.*;
import java.nio.file.*;import java.nio.charset.StandardCharsets;import java.security.*;import java.time.*;import java.util.*;
/** Trusted bundled source verdicts, not a Magic rule implementation. No network at match time. */
public final class NativeRulesData {
 public record Bundle(JsonObject manifest,JsonObject cards,Map<String,Object> receipt,LocalDate asOf){}
 private static Bundle cached;
 static String hash(byte[] bytes){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
 static byte[] boundedRead(Path path,int limit)throws Exception{try(var in=Files.newInputStream(path)){byte[] b=in.readNBytes(limit+1);if(b.length>limit)throw NativeDeckInput.fail("rules_data_file_limit");return b;}}
 static String str(JsonObject o,String k){return NativeDeckInput.string(o.get(k),"rules_data_"+k,1024);}
 public static Bundle load(Path directory,LocalDate today,String mode,String declaredVersion)throws Exception{
  if(!Set.of("current","pinned-practice").contains(mode))throw NativeDeckInput.fail("rules_data_mode_invalid");
  byte[] manifestBytes=boundedRead(directory.resolve("manifest.json"),65536);JsonObject m=JsonParser.parseString(new String(manifestBytes,StandardCharsets.UTF_8)).getAsJsonObject();
  if(!str(m,"schema").equals("cardstashy.rules-data-bundle.v1")||!str(m,"engineRevision").equals(ForgeHttpBridge.REV))throw NativeDeckInput.fail("rules_data_version_incompatible");
  String version=str(m,"version");if(declaredVersion!=null&&!declaredVersion.equals(version))throw NativeDeckInput.fail("rules_data_declared_version_mismatch");
  if(mode.equals("pinned-practice")&&(declaredVersion==null||Boolean.getBoolean("proof.requireCurrentRules")))throw NativeDeckInput.fail("pinned_rules_not_explicitly_allowed");
  LocalDate asOf=LocalDate.parse(str(m,"asOfDate")),expiry=LocalDate.parse(str(m,"validUntilExclusive"));
  if(!expiry.isAfter(asOf)||expiry.isAfter(asOf.plusDays(7)))throw NativeDeckInput.fail("rules_data_freshness_policy_invalid");
  if(today.isBefore(asOf))throw NativeDeckInput.fail("rules_data_future_bundle");
  LocalDate sourceDate=OffsetDateTime.parse(str(m,"sourceUpdatedAt")).toLocalDate();if(sourceDate.isAfter(asOf)||sourceDate.isBefore(asOf.minusDays(2)))throw NativeDeckInput.fail("rules_data_source_not_current_as_of");
  if(mode.equals("current")&&!today.isBefore(expiry))throw NativeDeckInput.fail("rules_data_stale");
  byte[] index=boundedRead(directory.resolve("cards.json"),16*1024*1024);if(!hash(index).equals(str(m,"indexSha256")))throw NativeDeckInput.fail("rules_data_index_integrity_failed");
  byte[] facts=boundedRead(directory.resolve("official-format-facts.json"),65536);if(!hash(facts).equals(str(m,"officialFactsSha256")))throw NativeDeckInput.fail("rules_data_official_facts_integrity_failed");
  JsonObject cards=JsonParser.parseString(new String(index,StandardCharsets.UTF_8)).getAsJsonObject();if(cards.size()!=ForgeHttpBridge.exactInt(m.get("indexRows"),"indexRows")||cards.size()>50000)throw NativeDeckInput.fail("rules_data_index_rows_invalid");
  Map<String,Object> receipt=NativeDeckInput.map("schema","cardstashy.rules-data-receipt.v1","version",version,"mode",mode,"asOfDate",asOf.toString(),"validUntilExclusive",expiry.toString(),"manifestSha256",hash(manifestBytes),"indexSha256",hash(index),"sourceUpdatedAt",str(m,"sourceUpdatedAt"),"sourceSha256",str(m,"sourceSha256"),"engineRevision",ForgeHttpBridge.REV,"scope","dated bundled source legality plus pinned native checks; not a forever-current certification");
  return new Bundle(m,cards,receipt,asOf);
 }
 static synchronized Bundle current(){
  if(cached==null)try{Path path=Path.of(System.getProperty("proof.rulesData",System.getProperty("proof.root")+"/rules-data/current"));cached=load(path,LocalDate.now(ZoneOffset.UTC),System.getProperty("proof.rulesMode","current"),System.getProperty("proof.rulesVersion"));}catch(Exception e){String reason=e instanceof IllegalArgumentException&&e.getMessage()!=null&&e.getMessage().startsWith("rules_data_")?e.getMessage():e.getClass().getSimpleName();throw NativeDeckInput.fail("rules_data_unavailable:"+reason);}
  // Check freshness again even if validation reuses this process after the date boundary.
  if(cached.receipt().get("mode").equals("current")&&!LocalDate.now(ZoneOffset.UTC).isBefore(LocalDate.parse((String)cached.receipt().get("validUntilExclusive"))))throw NativeDeckInput.fail("rules_data_stale");
  return cached;
 }
 static int copies(Deck deck,String name){int n=0;for(var e:deck.getAllCardsInASinglePool())if(e.getKey().getRules().getName().equals(name))n+=e.getValue();return n;}
 static void validateDeck(Bundle bundle,NativeDeckInput.Resolution resolution){
  NativeMatchFormat f=NativeMatchFormat.parse(resolution.source().get("format").getAsString());String actual=NativeDeckInput.digest(NativeDeckInput.JSON.toJsonTree(f.definition()));
  if(!Objects.equals(actual,bundle.manifest().getAsJsonObject("formatDefinitionDigests").get(f.name()).getAsString()))throw NativeDeckInput.fail("rules_data_native_format_changed");
  for(DeckSection section:List.of(DeckSection.Main,DeckSection.Commander,DeckSection.Sideboard)){
   var pool=resolution.deck().get(section);if(pool==null)continue;
   for(var entry:pool){var card=entry.getKey();String name=card.getRules().getName();JsonElement found=bundle.cards().get(name);
    if(found==null||!found.isJsonObject())throw NativeDeckInput.fail("rules_data_card_unmapped:"+name);
    JsonObject row=found.getAsJsonObject();String oracle=str(row,"oracleId");if(!oracle.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"))throw NativeDeckInput.fail("rules_data_identity_invalid");
    JsonElement verdict=row.getAsJsonObject("verdicts").get(f.name());if(verdict==null||!verdict.isJsonPrimitive()||!verdict.getAsJsonPrimitive().isString())throw NativeDeckInput.fail("rules_data_card_not_legal:"+name+":"+f.name());
    // A restricted card is legal as a single copy across the whole deck.
    boolean restricted=f==NativeMatchFormat.Vintage&&verdict.getAsString().equals("restricted");
    if(!verdict.getAsString().equals("legal")&&!restricted)throw NativeDeckInput.fail("rules_data_card_not_legal:"+name+":"+f.name());
    if(restricted&&copies(resolution.deck(),name)>1)throw NativeDeckInput.fail("rules_data_card_restricted:"+name+":"+f.name());
    // Reject unknown/unreleased selected native printings, never substitute another print.
    CardEdition edition=StaticData.instance().getCardEdition(card.getEdition());
    if(edition==null||edition==CardEdition.UNKNOWN||edition.getCode().equals(CardEdition.UNKNOWN_CODE)||edition.getDate()==null)throw NativeDeckInput.fail("rules_data_print_release_unverified:"+name);
    LocalDate released=edition.getDate().toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
    if(released.isAfter(bundle.asOf()))throw NativeDeckInput.fail("rules_data_print_unreleased_as_of:"+name);
   }
  }
 }
}
