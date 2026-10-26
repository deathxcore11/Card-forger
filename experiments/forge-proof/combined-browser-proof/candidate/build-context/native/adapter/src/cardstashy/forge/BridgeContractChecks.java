package cardstashy.forge;

import com.google.gson.*;
import forge.gamemodes.net.ProtocolMethod;
import forge.gamemodes.net.event.GuiGameEvent;
import forge.util.FSerializableFunction;
import java.util.*;
import org.apache.commons.lang3.tuple.Pair;

/** Tests only transport contracts; never substitutes for native game rules. */
public final class BridgeContractChecks {
    static void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}
    static JsonObject body(String text){return JsonParser.parseString(text).getAsJsonObject();}
    static void rejects(Runnable fn,String name){try{fn.run();throw new AssertionError("Accepted "+name);}catch(IllegalArgumentException expected){}}
    public static void main(String[] args){
        ForgeHttpBridge b=new ForgeHttpBridge();
        var choices=b.makePending(new GuiGameEvent(ProtocolMethod.getChoices,"Choose",1,1,List.of("a","b"),List.of(),null));
        check(b.reply(choices,body("{\"indexes\":[1]}")).equals(List.of("b")),"original offered values preserved");
        for(String bad:List.of("[0.9]","[\"0\"]","[-1]","[2]","[0,0]"))rejects(()->b.reply(choices,body("{\"indexes\":"+bad+"}")),"bad indexes "+bad);
        var reveal=b.makePending(new GuiGameEvent(ProtocolMethod.getChoices,"Revealed",-1,-1,List.of("Public item"),List.of(),null));
        check(Boolean.TRUE.equals(reveal.dto.get("acknowledgeOnly")),"native reveal acknowledged");
        check(b.reply(reveal,body("{\"indexes\":[]}")).equals(List.of()),"reveal returns no choices");
        var savedOrder=b.makePending(new GuiGameEvent(ProtocolMethod.order,"Order","Top",0,0,List.of(),List.of("trigger"),null,false,true));
        check(Boolean.TRUE.equals(savedOrder.dto.get("supported")),"saved ordering supported");
        rejects(()->b.reply(savedOrder,body("{\"indexes\":[]}")),"saved order empty-drop");
        var saved=(forge.gui.interfaces.IGuiGame.OrderResult<?>)b.reply(savedOrder,body("{\"indexes\":[0],\"remember\":true}"));
        check(saved.ordered().equals(List.of("trigger"))&&saved.rememberDecision(),"saved destination preserved");
        var subsetOrder=b.makePending(new GuiGameEvent(ProtocolMethod.order,"Order","Top",0,2,List.of("a","b"),List.of(),null,false,false));
        var subset=(forge.gui.interfaces.IGuiGame.OrderResult<?>)b.reply(subsetOrder,body("{\"indexes\":[1]}"));
        check(subset.ordered().equals(List.of("b")),"optional order subset preserved");
        var both=b.makePending(new GuiGameEvent(ProtocolMethod.order,"Order","Top",0,0,List.of("first"),List.of("second"),null,false,false));
        var reversed=(forge.gui.interfaces.IGuiGame.OrderResult<?>)b.reply(both,body("{\"indexes\":[1,0]}"));
        check(reversed.ordered().equals(List.of("second","first")),"source plus destination order preserved");
        rejects(()->b.reply(both,body("{\"indexes\":[0,0]}")),"duplicate ordered index");
        rejects(()->b.reply(both,body("{\"indexes\":[0,1],\"remember\":true}")),"remember not offered");
        FSerializableFunction<Object,String> display=o->"Native display "+((Pair<?,?>)o).getLeft();
        var pair=b.makePending(new GuiGameEvent(ProtocolMethod.getChoices,"Choose",1,1,List.of(Pair.of("choice",1)),List.of(),display));
        check(Boolean.TRUE.equals(pair.dto.get("supported"))&&pair.dto.toString().contains("Native display choice"),"native display retained");
        var unknown=b.makePending(new GuiGameEvent(ProtocolMethod.getChoices,"Choose",1,1,List.of(new Object()),List.of(),null));
        check(Boolean.FALSE.equals(unknown.dto.get("supported")),"opaque choices fail closed");
        var confirm=b.makePending(new GuiGameEvent(ProtocolMethod.showConfirmDialog,"Sure?","Confirm","Yes","No",true));
        check(Boolean.TRUE.equals(b.reply(confirm,body("{\"value\":true}"))),"real boolean accepted");
        rejects(()->b.reply(confirm,body("{\"value\":\"true\"}")),"string boolean");
        rejects(()->ForgeHttpBridge.exactInt(new JsonPrimitive(2147483648L),"id"),"int overflow");
        rejects(()->ForgeHttpBridge.exactLong(new JsonPrimitive("1"),"revision"),"string revision");
        System.out.println("PASS transport contracts: exact offered values, malformed/coerced scalars, reveal acknowledgment, native display, native source/destination/subset ordering and opaque-choice rejection");
    }
}
