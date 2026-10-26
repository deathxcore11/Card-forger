package cardstashy.forge;
import forge.game.card.Card;
import forge.game.spellability.SpellPermanent;
/** Native objects test only transport identity guards, not game rules. */
public final class BridgeSmartIntentChecks {
 public static void main(String[] args){
  forge.util.Localizer.getInstance().initialize("en-US",System.getProperty("proof.root",".")+"/forge/forge-gui/res/languages/");
  forge.util.Lang.createInstance("en-US");
  var card=new Card(1,null);
  var intended=new SpellPermanent(card);
  var other=new SpellPermanent(card);
  check(ForgeHttpBridge.directSpellCostMatches(intended,intended,false),"direct initial spell cost accepted");
  check(!ForgeHttpBridge.directSpellCostMatches(null,intended,false),"no intention rejected");
  check(!ForgeHttpBridge.directSpellCostMatches(intended,other,false),"same-host copied or unrelated ability rejected");
  check(!ForgeHttpBridge.directSpellCostMatches(intended,intended,true),"resolving/stacked original spell rejected");
  check(!ForgeHttpBridge.directSpellCostMatches(intended,null,false),"no native payment rejected");
  var b=new ForgeHttpBridge();b.smartIntentAbility=intended;b.smartIntentOrigin=null;b.clearSmartIntent();
  check(b.smartIntentAbility==null&&b.smartIntentOrigin==null,"clear consumes both intention fields");
  var r1=new forge.game.replacement.ReplaceDamage(java.util.Map.of("Event","DamageDone","Description","Native replacement one"),card,true).getView();
  var r2=new forge.game.replacement.ReplaceDamage(java.util.Map.of("Event","DamageDone","Description","Native replacement two"),card,true).getView();
  var order=b.makePending(new forge.gamemodes.net.event.GuiGameEvent(forge.gamemodes.net.ProtocolMethod.order,"Replacement order","Apply first",0,1,java.util.List.of(r1,r2),java.util.List.of(),null,false,true));
  check(Boolean.TRUE.equals(order.dto.get("supported"))&&order.dto.toString().contains("Native replacement one"),"native replacement labels render");
  var result=(forge.gui.interfaces.IGuiGame.OrderResult<?>)b.reply(order,com.google.gson.JsonParser.parseString("{\"indexes\":[1,0]}").getAsJsonObject());
  check(result.ordered().get(0)==r2&&result.ordered().get(1)==r1,"replacement ordering returns original native objects");
  System.out.println("PASS native replacement effect labels and exact ordered-object identity");
  System.out.println("PASS native-object Smart payment identity guard: direct spell, absent intent, different/copied same-host ability, resolving spell, absent payment, consumption");
 }
 static void check(boolean b,String message){if(!b)throw new AssertionError(message);}
}
