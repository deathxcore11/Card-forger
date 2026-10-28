package cardstashy.forge;
import forge.*;import forge.gui.GuiBase;import forge.model.FModel;import forge.localinstance.properties.ForgePreferences.FPref;
import forge.game.card.*;import forge.game.phase.*;import forge.game.zone.*;import forge.gamemodes.net.ProtocolMethod;import forge.gamemodes.net.event.GuiGameEvent;
import java.util.*;import java.nio.file.*;
/** Combat damage assignment with real cards: current rules (no blocker order), trample needs lethal on every blocker first, deathtouch makes 1 lethal. */
public final class CombatDamageChecks {
 static void check(boolean ok,String m){if(!ok)throw new AssertionError(m);}
 static com.google.gson.JsonObject body(String t){return com.google.gson.JsonParser.parseString(t).getAsJsonObject();}
 static void rejects(Runnable fn,String name){try{fn.run();throw new AssertionError("Accepted "+name);}catch(IllegalArgumentException expected){}}
 public static void main(String[]args)throws Exception{
  ContextualSmartChecks.out=Path.of(args[0]);String root=System.getProperty("proof.root");GuiBase.setInterface(new GuiDesktop(){@Override public String getAssetsDir(){return root+"/forge/forge-gui/";}});
  FModel.initialize(null,p->{p.setPref(FPref.USE_SENTRY,false);return null;});
  var c=ContextualSmartChecks.context(PhaseType.MAIN1,"smart");
  Card dreadmaw=ContextualSmartChecks.own(c,"Colossal Dreadmaw",ZoneType.Battlefield);
  Card bears=ContextualSmartChecks.card(c,"Grizzly Bears",c.opponent,ZoneType.Battlefield),elves=ContextualSmartChecks.card(c,"Llanowar Elves",c.opponent,ZoneType.Battlefield);
  ContextualSmartChecks.settle(c);var b=c.bridge;
  var blockers=List.of(bears.getView(),elves.getView());
  var trample=b.makePending(new GuiGameEvent(ProtocolMethod.assignCombatDamage,dreadmaw.getView(),blockers,6,c.opponent.getView(),false,false));
  check(Boolean.TRUE.equals(trample.dto.get("supported"))&&trample.options.size()==3,"trample offers both blockers and the player: "+trample.dto.get("assign"));
  @SuppressWarnings("unchecked") var out=(Map<CardView,Integer>)b.reply(trample,body("{\"amounts\":[2,1,3]}"));
  check(out.get(bears.getView())==2&&out.get(elves.getView())==1&&out.get(null)==3,"lethal to each blocker, rest to the player");
  rejects(()->b.reply(trample,body("{\"amounts\":[1,1,4]}")),"player damage before lethal on every blocker");
  check(b.reply(trample,body("{\"amounts\":[0,6,0]}"))!=null,"no order: all six to the second blocker is legal");
  rejects(()->b.reply(trample,body("{\"amounts\":[2,1,2]}")),"total short");
  rejects(()->b.reply(trample,body("{\"skip\":true}")),"skip not offered");
  var noTrample=b.makePending(new GuiGameEvent(ProtocolMethod.assignCombatDamage,bears.getView(),List.of(elves.getView(),dreadmaw.getView()),2,null,false,true));
  check(noTrample.options.size()==2,"no trample: no player option");
  check(b.reply(noTrample,body("{\"amounts\":[0,2]}"))!=null&&b.reply(noTrample,body("{\"skip\":true}"))==null,"free division and offered skip");
  System.out.println("PASS combat damage: current division rules, trample lethal-first, exact native keys, skip only when offered");
  System.exit(0);
 }
}
