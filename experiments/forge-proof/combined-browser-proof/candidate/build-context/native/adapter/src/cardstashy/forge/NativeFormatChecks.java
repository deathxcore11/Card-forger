package cardstashy.forge;
import com.google.gson.*;
import forge.GuiDesktop;import forge.gui.GuiBase;import forge.model.FModel;import forge.localinstance.properties.ForgePreferences.FPref;import forge.deck.*;import java.nio.file.*;import java.util.*;
public final class NativeFormatChecks {
 static void check(boolean b,String label){if(!b)throw new AssertionError(label);System.out.println("PASS "+label);}
 static JsonObject load(String p)throws Exception{return JsonParser.parseString(Files.readString(Path.of(p))).getAsJsonObject().getAsJsonObject("input");}
 static boolean legal(JsonObject deck){return Boolean.TRUE.equals(NativeDeckInput.resolveSnapshot(deck,false).report().get("legal"));}
 public static void main(String[]args)throws Exception{
  String root=System.getProperty("proof.root");GuiBase.setInterface(new GuiDesktop(){@Override public String getAssetsDir(){return root+"/forge/forge-gui/";}});FModel.initialize(null,p->{p.setPref(FPref.USE_SENTRY,false);p.setPref(FPref.DECKGEN_CARDBASED,false);return null;});
  NativeCpuPolicyIntegration.install(root);
  Map<String,Object> reports=new LinkedHashMap<>();
  for(String name:List.of("standard","modern")){
   JsonObject input=load(args[0]+"/bootstrap-"+name+".json"),before=input.deepCopy();var a=NativeDeckAdmission.admit(input);check(a.admitted(),name+" existing imported snapshot admitted "+a.receipt().get("errors"));check(input.equals(before),name+" original snapshot unchanged");
   var f=NativeMatchFormat.parse(input.get("format").getAsString());check(f.register(a.human().deck()).getStartingLife()==20&&f.register(a.human().deck()).getCommanders().isEmpty(),name+" native20life and no commander variant");
   check(a.human().deck().getMain().countAll()==60&&NativeMatchFormat.count(a.human().deck(),DeckSection.Sideboard)==1&&NativeMatchFormat.count(a.human().deck(),DeckSection.Commander)==0,name+" exact60main+1side, no synthetic commander");
   JsonObject d=input.getAsJsonObject("humanDeck").deepCopy();d.getAsJsonArray("cards").get(0).getAsJsonObject().addProperty("qty",35);check(!legal(d),name+" native rejects59card main");
   d=input.getAsJsonObject("humanDeck").deepCopy();d.getAsJsonArray("cards").get(1).getAsJsonObject().addProperty("qty",5);check(!legal(d),name+" native rejects5copies");
   d=input.getAsJsonObject("humanDeck").deepCopy();d.getAsJsonArray("side").get(0).getAsJsonObject().addProperty("qty",16);check(!legal(d),name+" native rejects16card sideboard");
   d=input.getAsJsonObject("humanDeck").deepCopy();d.getAsJsonArray("cards").get(1).getAsJsonObject().addProperty("name",name.equals("standard")?"Vivi Ornitier":"Skullclamp");check(!legal(d),name+" pinned native banned-card rejection");
   d=input.getAsJsonObject("humanDeck").deepCopy();d.getAsJsonArray("cards").get(1).getAsJsonObject().addProperty("name","Sol Ring");check(!legal(d),name+" native rejects out-of-pool card");
   d=input.getAsJsonObject("humanDeck").deepCopy();d.addProperty("commander",d.getAsJsonArray("cards").get(1).getAsJsonObject().get("name").getAsString());boolean rejected=false;try{NativeDeckInput.resolveSnapshot(d,false);}catch(IllegalArgumentException e){rejected=true;}check(rejected,name+" commander designation rejects rather than alters list");
   JsonObject mismatch=input.deepCopy();mismatch.addProperty("format",name.equals("standard")?"Modern":"Standard");check(!NativeDeckAdmission.admit(mismatch).admitted(),name+" wrapper/snapshot mismatch rejected");
   reports.put(name,a.receipt());reports.put(name+"NativeDefinition",f.definition());
  }
  var commander=NativeDeckAdmission.admit(load(args[0]+"/bootstrap-existing.json"));check(commander.admitted(),"Commander baseline still admitted");
  var digests=NativeRulesData.current().manifest().getAsJsonObject("formatDefinitionDigests");
  for(var f:NativeMatchFormat.values())check(digests.has(f.name())&&digests.get(f.name()).getAsString().equals(NativeDeckInput.digest(NativeDeckInput.JSON.toJsonTree(f.definition()))),f.name()+" native definition matches bundled digest");
  check(NativeMatchFormat.Brawl.register(commander.human().deck()).getStartingLife()==25,"Brawl native two-player 25 life");
  Files.writeString(Path.of(args[1]),NativeDeckInput.JSON.toJson(reports));System.out.println("PASS three-format native checks");System.exit(0);
 }
}
