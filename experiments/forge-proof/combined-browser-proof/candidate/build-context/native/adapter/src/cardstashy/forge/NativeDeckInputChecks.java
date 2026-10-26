package cardstashy.forge;
import com.google.gson.*;
import forge.GuiDesktop;
import forge.gui.GuiBase;
import forge.model.FModel;
import forge.localinstance.properties.ForgePreferences.FPref;
import forge.deck.*;
import java.nio.file.*;
import java.util.*;
public final class NativeDeckInputChecks {
 static void check(boolean b,String name){if(!b)throw new AssertionError(name);System.out.println("PASS "+name);}
 static void rejects(JsonObject deck,String label){try{NativeDeckInput.resolveSnapshot(deck,false);throw new AssertionError("accepted "+label);}catch(IllegalArgumentException expected){System.out.println("PASS rejects "+label+": "+expected.getMessage());}}
 public static void main(String[]args)throws Exception{
  String root=System.getProperty("proof.root");GuiBase.setInterface(new GuiDesktop(){@Override public String getAssetsDir(){return root+"/forge/forge-gui/";}});
  FModel.initialize(null,p->{p.setPref(FPref.USE_SENTRY,false);p.setPref(FPref.DECKGEN_CARDBASED,false);return null;});
  NativeCpuPolicyIntegration.install(root);
  JsonObject input=JsonParser.parseString(Files.readString(Path.of(args[0]))).getAsJsonObject().getAsJsonObject("input");
  JsonObject before=input.deepCopy();var a=NativeDeckAdmission.admit(input);
  check(a.admitted(),"existing saved/imported decks admitted: "+a.receipt().get("errors"));
  check(input.equals(before),"source snapshots byte-value/order metadata not mutated");
  check(a.human().deck().getMain().countAll()==99&&a.human().deck().get(DeckSection.Commander).countAll()==1,"100 cards remain 99+1, no duplicated commander");
  var copy=forge.game.player.RegisteredPlayer.forCommander(a.human().deck());
  NativeDeckAdmission.verifyRegistered(a,copy.getDeck(),forge.game.player.RegisteredPlayer.forCommander(a.opponent().deck()).getDeck());
  check(Boolean.TRUE.equals(a.receipt().get("registeredRosterVerified")),"native RegisteredPlayer roster exactly matches each resolved manifest");
  JsonObject unknown=input.getAsJsonObject("humanDeck").deepCopy();unknown.getAsJsonArray("cards").get(1).getAsJsonObject().addProperty("name","Not A Real Magic Card 999999");rejects(unknown,"unknown card");
  JsonObject frac=input.getAsJsonObject("humanDeck").deepCopy();frac.getAsJsonArray("cards").get(1).getAsJsonObject().addProperty("qty",0.9);rejects(frac,"fractional quantity");
  JsonObject count=input.getAsJsonObject("humanDeck").deepCopy();count.getAsJsonArray("cards").get(1).getAsJsonObject().addProperty("qty",2);check(!Boolean.TRUE.equals(NativeDeckInput.resolveSnapshot(count,false).report().get("legal")),"native format legality separate from definition support");
  JsonObject print=input.getAsJsonObject("humanDeck").deepCopy();print.getAsJsonArray("cards").get(1).getAsJsonObject().addProperty("set","NO_SUCH_SET");rejects(print,"unavailable printing; no fallback");
  JsonObject missing=input.getAsJsonObject("humanDeck").deepCopy();missing.addProperty("commander","Sai, Master Thopterist");rejects(missing,"commander not in exact source list");
  JsonObject partner=JsonParser.parseString("{\"name\":\"Existing partner shape\",\"format\":\"Commander\",\"commander\":\"Tymna the Weaver\",\"commanders\":[{\"name\":\"Tymna the Weaver\",\"qty\":1},{\"name\":\"Tana, the Bloodsower\",\"qty\":1}],\"cards\":[{\"name\":\"Plains\",\"qty\":98},{\"name\":\"Tymna the Weaver\",\"qty\":1},{\"name\":\"Tana, the Bloodsower\",\"qty\":1}],\"side\":[]}").getAsJsonObject();
  var p=NativeDeckInput.resolveSnapshot(partner,false);check(Boolean.TRUE.equals(p.report().get("legal"))&&p.deck().getMain().countAll()==98&&p.deck().getCommanders().size()==2,"native legal partner declarations preserve 98+2");
  var pairBad=partner.deepCopy();pairBad.getAsJsonArray("commanders").get(1).getAsJsonObject().addProperty("qty",2);rejects(pairBad,"duplicate commander quantity");
  JsonObject duplicate=partner.deepCopy();duplicate.getAsJsonArray("commanders").set(1,duplicate.getAsJsonArray("commanders").get(0).deepCopy());rejects(duplicate,"duplicate commander designation");
  JsonObject badPolicy=input.deepCopy();badPolicy.addProperty("difficultyPolicyVersion","pretend-hard");check(!NativeDeckAdmission.admit(badPolicy).admitted(),"unproven difficulty mapping rejected");
  Files.writeString(Path.of(args[1]),NativeDeckInput.JSON.toJson(a.receipt()));
  System.out.println("PASS complete existing-snapshot native conversion checks");System.exit(0);
 }
}
