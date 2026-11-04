import cardstashy.forge.LocalEngine;
import com.google.gson.*;
import java.nio.file.*;
import java.util.*;

/** The host AFK clock in a friend match: seat 1 plays (land, cast, pass, no attacks), seat 2 never touches the table.
 *  Run with short clocks: -Dcardstashy.afkTurnMs=3000 -Dcardstashy.afkPromptMs=1500.
 *  Checks: seat 2's state carries its own `afk` window and seat 1's shows it as `own:false`; the clock plays the safe
 *  answers (keeps the hand, passes, declares no attackers or blockers); three missed turns concede seat 2, seat 1 wins
 *  and keeps 0 strikes. Usage: AfkClockTest <engine root> <bootstrap.json> [seed] */
public class AfkClockTest {
    static LocalEngine.Session s;
    static JsonObject state(int seat) throws Exception {return JsonParser.parseString(s.call("GET",seat==1?"/state":"/seat2/state",null).body()).getAsJsonObject();}
    static int act(int seat,JsonObject body) throws Exception {return s.call("POST",seat==1?"/action":"/seat2/action",body.toString()).status();}
    static JsonObject o(Object... kv){JsonObject j=new JsonObject();for(int i=0;i<kv.length;i+=2){Object v=kv[i+1];if(v instanceof Number n)j.addProperty((String)kv[i],n);else if(v instanceof Boolean b)j.addProperty((String)kv[i],b);else j.addProperty((String)kv[i],(String)v);}return j;}
    static int fails=0;
    static void check(boolean ok,String what){if(!ok){fails++;if(fails<20)System.out.println("FAIL "+what);}}
    public static void main(String[] a) throws Exception {
        long t0=System.currentTimeMillis();
        System.out.println("init ms "+LocalEngine.init(a[0]));
        JsonObject input=JsonParser.parseString(Files.readString(Path.of(a[1]))).getAsJsonObject().getAsJsonObject("input");
        input.addProperty("startingPlayer","random");input.addProperty("playStyle","quick");input.addProperty("opponentKind","human");
        JsonObject wrap=new JsonObject();wrap.add("input",input);s=LocalEngine.start(wrap.toString(),a.length>2?Long.parseLong(a[2]):20261104L);
        long seen1=-1;Set<Integer> clicked=new HashSet<>();int lastTurn=0;
        boolean sawOwn2=false,sawRival1=false,sawStrikes2=false;int maxStrikes2=0,maxStrikes1=0;Set<String> reasons2=new TreeSet<>();
        Map<Long,JsonObject> events=new TreeMap<>();
        long deadline=System.currentTimeMillis()+420_000;String end="TIMEOUT";JsonObject f1=null,f2=null;
        while(System.currentTimeMillis()<deadline){
            JsonObject st1=state(1),st2=state(2);
            if(!st1.has("status")||!st2.has("status")){System.out.println("NO STATUS seat1="+st1+" seat2="+st2);end="NO_STATUS";break;}
            String status1=st1.get("status").getAsString(),status2=st2.get("status").getAsString();
            if(status1.equals("failed")||status2.equals("failed")){end="FAILED "+st1.get("failure")+" / "+st2.get("failure");break;}
            if(status1.equals("finished")&&status2.equals("finished")){f1=st1;f2=st2;end="FINISHED";break;}
            if(st1.has("events"))for(var e:st1.getAsJsonObject("events").getAsJsonArray("items"))events.put(e.getAsJsonObject().get("seq").getAsLong(),e.getAsJsonObject());
            // seat 2's view of the clock
            if(status2.equals("running")&&st2.has("afk")&&st2.get("afk").isJsonObject()){
                var af=st2.getAsJsonObject("afk");
                if(af.get("own").getAsBoolean()){
                    sawOwn2=true;reasons2.add(af.get("reason").getAsString());
                    check(af.get("deadline").getAsLong()>0&&af.get("total").getAsLong()>0,"own window shape "+af);
                    int strikes=af.get("strikes").getAsInt();maxStrikes2=Math.max(maxStrikes2,strikes);
                }
            }
            // seat 1 sees seat 2's window as the other player's while seat 1 holds none
            if(status1.equals("running")&&st1.has("afk")&&st1.get("afk").isJsonObject()){
                var af=st1.getAsJsonObject("afk");
                if(!af.get("own").getAsBoolean())sawRival1=true;else maxStrikes1=Math.max(maxStrikes1,af.get("strikes").getAsInt());
            }
            if(status1.equals("running")&&!st1.get("busy").getAsBoolean()){
                long rev=st1.get("revision").getAsLong();
                int turn=st1.get("turn").getAsInt();if(turn!=lastTurn){clicked.clear();lastTurn=turn;}
                if(rev!=seen1){
                    JsonObject body=null;JsonElement pr=st1.get("prompt");
                    String input0=st1.get("inputType").isJsonNull()?null:st1.get("inputType").getAsString();
                    if(pr!=null&&pr.isJsonObject()){
                        var p=pr.getAsJsonObject();String method=p.get("method").getAsString();
                        body=o("revision",rev,"op","reply","promptId",p.get("id").getAsInt());
                        if(method.equals("confirm")||method.equals("showConfirmDialog"))body.addProperty("value",true);
                        else{JsonArray idx=new JsonArray();int want=p.get("max").getAsInt()==0?0:Math.max(1,p.get("min").getAsInt());for(int i=0;i<want&&i<p.getAsJsonArray("options").size();i++)idx.add(i);body.add("indexes",idx);}
                    }else if("InputPassPriority".equals(input0)){
                        int viewer=st1.get("viewer").getAsInt();JsonObject me=null;
                        for(var pe:st1.getAsJsonArray("players"))if(pe.getAsJsonObject().get("id").getAsInt()==viewer)me=pe.getAsJsonObject();
                        Map<Integer,String> hand=new HashMap<>();
                        for(var c:me.getAsJsonObject("zones").getAsJsonObject("Hand").getAsJsonArray("cards")){var co=c.getAsJsonObject();hand.put(co.get("id").getAsInt(),co.has("type")?String.valueOf(co.get("type")):"");}
                        Integer land=null,spell=null;
                        for(var x:st1.getAsJsonObject("selection").getAsJsonArray("actionable")){var xo=x.getAsJsonObject();int id=xo.get("id").getAsInt();if(!hand.containsKey(id))continue;
                            if(hand.get(id).contains("Land")){if(land==null)land=id;}
                            else if(xo.has("affordability")&&"available".equals(xo.get("affordability").getAsString())&&spell==null)spell=id;}
                        if(land!=null)body=o("revision",rev,"op","card","id",land);
                        else if(spell!=null)body=o("revision",rev,"op","card","id",spell);
                        else if(st1.getAsJsonObject("buttons").get("okEnabled").getAsBoolean())body=o("revision",rev,"op","ok");
                    }else if("InputAttack".equals(input0)||"InputBlock".equals(input0)){
                        body=o("revision",rev,"op","ok");
                    }else if(input0!=null){
                        var b=st1.getAsJsonObject("buttons");var pick=st1.getAsJsonObject("selection").getAsJsonArray("cards");var chosen=st1.getAsJsonObject("selection").getAsJsonArray("chosen");
                        if(b.has("okEnabled")&&b.get("okEnabled").getAsBoolean())body=o("revision",rev,"op","ok");
                        else if(pick.size()>0&&chosen.size()==0)body=o("revision",rev,"op","card","id",pick.get(0).getAsJsonObject().get("id").getAsInt());
                        else if(b.has("cancelEnabled")&&b.get("cancelEnabled").getAsBoolean())body=o("revision",rev,"op","cancel");
                    }
                    if(body!=null){act(1,body);seen1=rev;}
                }
            }
            Thread.sleep(30);
        }
        System.out.println(end+" in "+(System.currentTimeMillis()-t0)/1000+" s");
        if(f1!=null){
            int v1=f1.get("viewer").getAsInt(),v2=f2.get("viewer").getAsInt();
            System.out.println("winner seat1="+f1.get("winnerPlayerId")+" seat2="+f2.get("winnerPlayerId")+" viewers "+v1+"/"+v2);
            check(f1.get("winnerPlayerId").getAsInt()==v1&&f2.get("winnerPlayerId").getAsInt()==v1,"seat 1 wins when seat 2 is AFK");
            for(var e:events.values())if(e.get("type").getAsString().equals("attack")&&e.get("player").getAsInt()==v2)check(false,"the AFK seat attacked "+e);
            for(var e:events.values())if(e.get("type").getAsString().equals("block")&&e.get("player").getAsInt()==v2)check(false,"the AFK seat blocked "+e);
        }else check(false,"match did not finish: "+end);
        check(sawOwn2,"seat 2 never had an own afk window");
        check(sawRival1,"seat 1 never saw seat 2's window");
        check(maxStrikes2>=2,"seat 2 strikes reached "+maxStrikes2+" before the concede");
        check(maxStrikes1==0,"seat 1 was struck "+maxStrikes1);
        System.out.println("seat 2 windows "+reasons2+", max strikes seen "+maxStrikes2+", seat 1 strikes "+maxStrikes1+", events "+events.size());
        System.out.println(fails==0?"AFK_CLOCK PASS":"AFK_CLOCK FAIL "+fails);
        System.exit(fails==0?0:2);
    }
}
