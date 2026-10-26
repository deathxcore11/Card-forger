package cardstashy.forge;
import com.google.gson.*;import forge.GuiDesktop;import forge.gui.GuiBase;import forge.model.FModel;import forge.localinstance.properties.ForgePreferences.FPref;import forge.StaticData;import forge.deck.*;import java.nio.file.*;import java.time.*;import java.util.*;
public final class NativeRulesDataChecks {
 interface Attempt{void run()throws Exception;}
 static void check(boolean b,String s){if(!b)throw new AssertionError(s);System.out.println("PASS "+s);}
 static void rejects(String code,Attempt a)throws Exception{try{a.run();throw new AssertionError("accepted "+code);}catch(IllegalArgumentException e){check(e.getMessage().contains(code),"rejects "+code+" ["+e.getMessage()+"]");}}
 public static void main(String[]args)throws Exception{
  String root=System.getProperty("proof.root");GuiBase.setInterface(new GuiDesktop(){@Override public String getAssetsDir(){return root+"/forge/forge-gui/";}});FModel.initialize(null,p->{p.setPref(FPref.USE_SENTRY,false);p.setPref(FPref.DECKGEN_CARDBASED,false);return null;});
  NativeCpuPolicyIntegration.install(root);
  Path dir=Path.of(args[0]);LocalDate day=LocalDate.of(2026,10,26);var b=NativeRulesData.load(dir,day,"current",null);String version=(String)b.receipt().get("version");check(b.receipt().get("mode").equals("current"),"dated current bundle loads and is explicitly current");
  rejects("rules_data_stale",()->NativeRulesData.load(dir,day.plusDays(7),"current",null));rejects("rules_data_future_bundle",()->NativeRulesData.load(dir,day.minusDays(1),"current",null));rejects("rules_data_declared_version_mismatch",()->NativeRulesData.load(dir,day,"current","invented-version"));rejects("pinned_rules_not_explicitly_allowed",()->NativeRulesData.load(dir,day.plusDays(10),"pinned-practice",null));
  var pinned=NativeRulesData.load(dir,day.plusDays(10),"pinned-practice",version);check(pinned.receipt().get("mode").equals("pinned-practice")&&pinned.asOf().equals(day),"offline practice requires explicit version and never claims current");
  System.setProperty("proof.requireCurrentRules","true");rejects("pinned_rules_not_explicitly_allowed",()->NativeRulesData.load(dir,day,"pinned-practice",version));System.clearProperty("proof.requireCurrentRules");
  Path temp=Files.createTempDirectory("rules-integrity-");try{for(String f:List.of("manifest.json","cards.json","official-format-facts.json"))Files.copy(dir.resolve(f),temp.resolve(f));Files.writeString(temp.resolve("cards.json"),"\n",StandardOpenOption.APPEND);rejects("rules_data_index_integrity_failed",()->NativeRulesData.load(temp,day,"current",null));}finally{for(var p:Files.list(temp).toList())Files.delete(p);Files.delete(temp);}
  for(String name:List.of("Appeal // Authority","Claim // Fame","Fast // Furious","Ratonhnhaké:ton"))check(b.cards().has(name),"verified current identity mapping "+name);
  JsonObject input=JsonParser.parseString(Files.readString(Path.of(args[1]))).getAsJsonObject().getAsJsonObject("input");var exact=NativeDeckAdmission.admit(input);check(exact.admitted()&&Boolean.TRUE.equals(exact.receipt().get("nativeLegal")),"real existing saved Angels/imported Keen pass native AND bundled legality");check(Boolean.TRUE.equals(((Map<?,?>)exact.receipt().get("rulesData")).get("decksVerified")),"receipt binds both verified decks to dated rules bundle");
  JsonObject cards=b.cards().deepCopy();cards.remove("Plains");var missing=new NativeRulesData.Bundle(b.manifest(),cards,b.receipt(),b.asOf());rejects("rules_data_card_unmapped",()->NativeRulesData.validateDeck(missing,exact.human()));
  boolean verdictChecked=false;for(var card:StaticData.instance().getCommonCards().getAllCards()){
   var mapped=b.cards().getAsJsonObject(card.getRules().getName());if(mapped!=null&&!mapped.getAsJsonObject("verdicts").get("Commander").getAsString().equals("legal")){
    Deck d=new Deck("source-verdict-regression");d.getMain().add(card,1);JsonObject snapshot=new JsonObject();snapshot.addProperty("format","Commander");var nonlegal=new NativeDeckInput.Resolution(snapshot,d,Map.of());rejects("rules_data_card_not_legal",()->NativeRulesData.validateDeck(b,nonlegal));verdictChecked=true;break;
   }
  }check(verdictChecked,"actual source nonlegal verdict rejects without guessing rules");
  boolean futureChecked=false;for(var card:StaticData.instance().getCommonCards().getAllCards()){
   var ed=StaticData.instance().getCardEdition(card.getEdition());var mapped=b.cards().getAsJsonObject(card.getRules().getName());
   if(ed!=null&&ed.getDate()!=null&&mapped!=null&&mapped.getAsJsonObject("verdicts").get("Commander").getAsString().equals("legal")&&ed.getDate().toInstant().atZone(ZoneId.systemDefault()).toLocalDate().isAfter(day)){
    Deck d=new Deck("unreleased-print-regression");d.getMain().add(card,1);JsonObject snapshot=new JsonObject();snapshot.addProperty("format","Commander");var future=new NativeDeckInput.Resolution(snapshot,d,Map.of());rejects("rules_data_print_unreleased_as_of",()->NativeRulesData.validateDeck(b,future));futureChecked=true;break;
   }
  }check(futureChecked,"real future printing exercises release guard without substitution");
  System.out.println("PASS bundled rules provenance/freshness/identity gate checks");System.exit(0);
 }
}
