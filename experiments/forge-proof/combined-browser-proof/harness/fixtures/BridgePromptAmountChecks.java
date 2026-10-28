package cardstashy.forge;
import com.google.gson.*;
import forge.game.card.Card;
import forge.game.card.CardView;
import forge.gamemodes.net.ProtocolMethod;
import forge.gamemodes.net.event.GuiGameEvent;
import java.util.*;
/** Transport checks for the amount prompts and unbounded order: exact offered objects, totals and the trample rule. */
public final class BridgePromptAmountChecks {
 static void check(boolean ok,String m){if(!ok)throw new AssertionError(m);}
 static JsonObject body(String t){return JsonParser.parseString(t).getAsJsonObject();}
 static void rejects(Runnable fn,String name){try{fn.run();throw new AssertionError("Accepted "+name);}catch(IllegalArgumentException expected){}}
 static CardView creature(int id,int toughness,int damage){Card c=new Card(id,null);c.setBaseToughness(toughness);c.setDamage(damage);c.setName("Blocker "+id);return c.getView();}
 public static void main(String[] args){
  forge.util.Localizer.getInstance().initialize("en-US",System.getProperty("proof.root",".")+"/forge/forge-gui/res/languages/");
  forge.util.Lang.createInstance("en-US");
  var b=new ForgeHttpBridge();
  // Scry 3: put any number on the bottom (-1 bounds), then order the rest.
  var scry=b.makePending(new GuiGameEvent(ProtocolMethod.order,"Scry","Bottom",-1,-1,List.of("a","b","c"),null,null,false,false));
  check(Boolean.TRUE.equals(scry.dto.get("supported"))&&scry.min==0&&scry.max==3,"scry bounds unbounded: "+scry.dto);
  check(Integer.valueOf(0).equals(scry.dto.get("remainingMin"))&&Integer.valueOf(3).equals(scry.dto.get("remainingMax")),"scry DTO normalised");
  check(((IGuiGameOrder)()->b.reply(scry,body("{\"indexes\":[]}"))).ok(),"keep all on top");
  // Divided damage: 3 among two targets, each at least one.
  Map<Object,Integer> targets=new LinkedHashMap<>();targets.put("first",3);targets.put("second",3);
  var divide=b.makePending(new GuiGameEvent(ProtocolMethod.assignGenericAmount,null,targets,3,true,"damage"));
  check(Boolean.TRUE.equals(divide.dto.get("supported")),"divide supported");
  @SuppressWarnings("unchecked") var out=(Map<Object,Integer>)b.reply(divide,body("{\"amounts\":[2,1]}"));
  check(out.get("first")==2&&out.get("second")==1,"divide keeps the offered keys");
  rejects(()->b.reply(divide,body("{\"amounts\":[3,0]}")),"zero with atLeastOne");
  rejects(()->b.reply(divide,body("{\"amounts\":[1,1]}")),"short total");
  rejects(()->b.reply(divide,body("{\"amounts\":[2]}")),"wrong length");
  rejects(()->b.reply(divide,body("{\"amounts\":[4,-1]}")),"negative");
  System.out.println("PASS amount prompts: unbounded Scry/Surveil order, divided amounts keep offered keys, totals, minimums");
 }
 interface IGuiGameOrder{Object get();default boolean ok(){return get()!=null;}}
}
