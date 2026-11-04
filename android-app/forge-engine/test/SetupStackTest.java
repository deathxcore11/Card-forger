import cardstashy.forge.LocalEngine;
import com.google.gson.*;
import java.nio.file.*;
import java.util.*;

/** Match setup for scripted lessons: setup.stack puts named cards on top of each library, setup.noMulligan keeps the
 *  opening seven, and startingPlayer "first" with playStyle "quick" is allowed only with a setup.
 *  Usage: SetupStackTest <engine root> <bootstrap.json> [seed] */
public class SetupStackTest {
    static int fails=0;
    static void check(boolean ok,String what){if(!ok){fails++;System.out.println("FAIL "+what);}else System.out.println("ok   "+what);}
    static JsonObject state(LocalEngine.Session s) throws Exception {return JsonParser.parseString(s.call("GET","/state",null).body()).getAsJsonObject();}
    static LocalEngine.Session start(JsonObject input,long seed) throws Exception {JsonObject w=new JsonObject();w.add("input",input);return LocalEngine.start(w.toString(),seed);}
    static List<String> names(JsonObject deck,int from,int n){List<String> out=new ArrayList<>();var c=deck.getAsJsonArray("cards");for(int i=from;i<from+n;i++)out.add(c.get(i).getAsJsonObject().get("name").getAsString());return out;}
    static boolean refused(JsonObject input,long seed) throws Exception {
        try{var t=start(input,seed);for(int i=0;i<40;i++){String st=state(t).has("status")?state(t).get("status").getAsString():"";if(st.equals("failed"))return true;if(st.equals("running"))return false;Thread.sleep(250);}return false;}
        catch(Exception e){return true;}
    }
    public static void main(String[] a) throws Exception {
        LocalEngine.init(a[0]);
        long seed=a.length>2?Long.parseLong(a[2]):20261104L;
        JsonObject base=JsonParser.parseString(Files.readString(Path.of(a[1]))).getAsJsonObject().getAsJsonObject("input");
        List<String> hero=names(base.getAsJsonObject("humanDeck"),2,4),villain=names(base.getAsJsonObject("opponentDeck"),2,3);
        JsonObject in=base.deepCopy();in.addProperty("startingPlayer","first");in.addProperty("playStyle","quick");
        JsonObject setup=new JsonObject(),stack=new JsonObject();
        stack.add("hero",new Gson().toJsonTree(hero));stack.add("villain",new Gson().toJsonTree(villain));
        setup.add("stack",stack);setup.addProperty("noMulligan",true);in.add("setup",setup);
        var s=start(in,seed);
        JsonObject st=null;String prompt="";
        for(int i=0;i<400;i++){
            st=state(s);String status=st.get("status").getAsString();
            if(status.equals("failed")){check(false,"match failed "+st.get("failure"));break;}
            if(status.equals("running")&&!st.get("busy").getAsBoolean())break;
            Thread.sleep(250);
        }
        check(st!=null&&"running".equals(st.get("status").getAsString()),"match reaches running");
        JsonElement pr=st.get("prompt");
        check(pr==null||pr.isJsonNull()||!pr.toString().toLowerCase().contains("mulligan"),"no mulligan prompt: "+(pr==null?null:pr.toString().substring(0,Math.min(80,pr.toString().length()))));
        int viewer=st.get("viewer").getAsInt();JsonObject me=null;
        for(var pe:st.getAsJsonArray("players"))if(pe.getAsJsonObject().get("id").getAsInt()==viewer)me=pe.getAsJsonObject();
        List<String> hand=new ArrayList<>();
        for(var c:me.getAsJsonObject("zones").getAsJsonObject("Hand").getAsJsonArray("cards"))hand.add(c.getAsJsonObject().get("name").getAsString());
        check(hand.size()==7,"hero keeps seven: "+hand.size());
        check(hand.containsAll(hero),"hero hand holds the stacked cards "+hero+" in "+hand);
        JsonObject pre=st.has("pregame")?st.getAsJsonObject("pregame"):null;
        check(st.get("turn").getAsInt()==1&&st.get("activePlayer").getAsInt()==viewer,"human goes first");
        s=null;
        // refusals
        JsonObject bad=base.deepCopy();bad.addProperty("startingPlayer","first");bad.addProperty("playStyle","quick");
        check(refused(bad,seed),"quick+first without a setup is refused");
        JsonObject bad2=in.deepCopy();bad2.getAsJsonObject("setup").addProperty("extra",1);
        check(refused(bad2,seed),"unknown setup key is refused");
        JsonObject bad3=in.deepCopy();bad3.addProperty("opponentKind","human");bad3.addProperty("startingPlayer","random");
        check(refused(bad3,seed),"setup in a friend match is refused");
        System.out.println(fails==0?"PASS":"FAILURES "+fails);
        System.exit(fails==0?0:1);
    }
}
