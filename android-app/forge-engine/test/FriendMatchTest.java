import cardstashy.forge.LocalEngine;
import com.google.gson.*;
import java.nio.file.*;
import java.util.*;

/** Two people, one Forge game: drive both seats until turn N, check privacy, then seat 2 concedes. */
public class FriendMatchTest {
    static LocalEngine.Session s;
    static JsonObject state(int seat) throws Exception {
        var r=s.call("GET",seat==1?"/state":"/seat2/state",null);
        return JsonParser.parseString(r.body()).getAsJsonObject();
    }
    static int act(int seat,JsonObject body) throws Exception {
        var r=s.call("POST",seat==1?"/action":"/seat2/action",body.toString());
        if(r.status()!=202)System.out.println("  seat"+seat+" "+body+" -> "+r.status()+" "+r.body());
        return r.status();
    }
    static JsonObject o(Object... kv){JsonObject j=new JsonObject();for(int i=0;i<kv.length;i+=2){Object v=kv[i+1];if(v instanceof Number n)j.addProperty((String)kv[i],n);else if(v instanceof Boolean b)j.addProperty((String)kv[i],b);else if(v instanceof JsonElement e)j.add((String)kv[i],e);else j.addProperty((String)kv[i],(String)v);}return j;}
    static int privacyChecks=0,leaks=0;
    static void privacy(int seat,JsonObject st){
        int viewer=st.get("viewer").getAsInt();
        for(var pe:st.getAsJsonArray("players")){var p=pe.getAsJsonObject();if(p.get("id").getAsInt()==viewer)continue;
            for(String z:List.of("Hand","Library")){var zone=p.getAsJsonObject("zones").getAsJsonObject(z);
                for(var c:zone.getAsJsonArray("cards")){var co=c.getAsJsonObject();if(co.has("name")&&!co.get("name").isJsonNull()){leaks++;System.out.println("LEAK seat"+seat+" sees opponent "+z+" card "+co.get("name"));}}
                privacyChecks++;}}
    }
    public static void main(String[] a) throws Exception {
        long t0=System.currentTimeMillis();
        System.out.println("init ms "+LocalEngine.init(a[0]));
        JsonObject input=JsonParser.parseString(Files.readString(Path.of(a[1]))).getAsJsonObject().getAsJsonObject("input");
        input.addProperty("startingPlayer","random");input.addProperty("playStyle","quick");input.addProperty("opponentKind","human");
        s=LocalEngine.start(o("input",input).toString(),20261101L);
        int maxTurn=Integer.parseInt(a[2]);int concedeSeat=Integer.parseInt(a[3]);boolean probed=false,probeRejected=false;
        Map<Integer,Long> seen=new HashMap<>();int landsPlayed=0,casts=0,steps=0;
        long deadline=System.currentTimeMillis()+240_000;boolean conceded=false;
        while(System.currentTimeMillis()<deadline){
            boolean moved=false;
            for(int seat=1;seat<=2;seat++){
                JsonObject st=state(seat);
                String status=st.has("status")?st.get("status").getAsString():"?";
                if(status.equals("failed")){System.out.println("FAILED seat"+seat+" "+st.get("failure")+" "+st.get("initialization"));return;}
                if(status.equals("finished")){continue;}
                if(!status.equals("running"))continue;
                privacy(seat,st);
                long rev=st.get("revision").getAsLong();
                if(seen.getOrDefault(seat,-1L)==rev)continue;
                if(st.get("busy").getAsBoolean())continue;
                int turn=st.get("turn").getAsInt();
                if(turn>=maxTurn&&seat==concedeSeat&&!conceded){System.out.println("turn "+turn+": seat "+seat+" concedes");act(seat,o("revision",rev,"op","concede"));conceded=true;moved=true;break;}
                if(seat==2&&!probed&&turn>=2){
                    // Seat 2 tries to play a card from seat 1's hand: it must be refused.
                    JsonObject s1=state(1);int v1=s1.get("viewer").getAsInt();
                    for(var pe:s1.getAsJsonArray("players"))if(pe.getAsJsonObject().get("id").getAsInt()==v1){
                        var h=pe.getAsJsonObject().getAsJsonObject("zones").getAsJsonObject("Hand").getAsJsonArray("cards");
                        if(h.size()>0){int code=act(2,o("revision",rev,"op","card","id",h.get(0).getAsJsonObject().get("id").getAsInt()));System.out.println("PROBE seat2 plays seat1 hand card -> "+code);probeRejected=code!=202;probed=true;}}
                }
                JsonElement pr=st.get("prompt");
                if(pr!=null&&pr.isJsonObject()){
                    var p=pr.getAsJsonObject();String method=p.get("method").getAsString();
                    if(steps<6||!method.equals("confirm"))System.out.println("seat"+seat+" t"+turn+" prompt "+method+": "+p.get("message"));
                    JsonObject body=o("revision",rev,"op","reply","promptId",p.get("id").getAsInt());
                    if(method.equals("confirm")||method.equals("showConfirmDialog"))body.addProperty("value",true);
                    else{JsonArray idx=new JsonArray();for(int i=0;i<Math.max(1,p.get("min").getAsInt())&&i<p.getAsJsonArray("options").size();i++)idx.add(i);body.add("indexes",idx);}
                    act(seat,body);seen.put(seat,rev);moved=true;steps++;continue;
                }
                String input0=st.get("inputType").isJsonNull()?null:st.get("inputType").getAsString();
                if(input0==null)continue;
                JsonObject body=null;
                if(input0.equals("InputPassPriority")){
                    // play a land, else cast something affordable, else pass
                    int viewer=st.get("viewer").getAsInt();
                    var acts=st.getAsJsonObject("selection").getAsJsonArray("actionable");
                    JsonObject me=null;for(var pe:st.getAsJsonArray("players"))if(pe.getAsJsonObject().get("id").getAsInt()==viewer)me=pe.getAsJsonObject();
                    Set<Integer> hand=new HashSet<>();Map<Integer,String> types=new HashMap<>();
                    for(var c:me.getAsJsonObject("zones").getAsJsonObject("Hand").getAsJsonArray("cards")){var co=c.getAsJsonObject();hand.add(co.get("id").getAsInt());types.put(co.get("id").getAsInt(),co.has("type")?String.valueOf(co.get("type")):"");}
                    Integer land=null,spell=null;
                    for(var x:acts){var xo=x.getAsJsonObject();int id=xo.get("id").getAsInt();if(!hand.contains(id))continue;
                        if(types.get(id).contains("Land")){if(land==null)land=id;}
                        else if(xo.has("affordability")&&"available".equals(xo.get("affordability").getAsString())&&spell==null)spell=id;}
                    if(land!=null){body=o("revision",rev,"op","card","id",land);landsPlayed++;}
                    else if(spell!=null){body=o("revision",rev,"op","card","id",spell);casts++;}
                    else if(st.getAsJsonObject("buttons").get("okEnabled").getAsBoolean())body=o("revision",rev,"op","ok");
                }else{
                    var b=st.getAsJsonObject("buttons");
                    var pick=st.getAsJsonObject("selection").getAsJsonArray("cards");
                    var chosen=st.getAsJsonObject("selection").getAsJsonArray("chosen");
                    if(b.has("okEnabled")&&b.get("okEnabled").getAsBoolean())body=o("revision",rev,"op","ok");
                    else if(pick.size()>0&&chosen.size()==0)body=o("revision",rev,"op","card","id",pick.get(0).getAsJsonObject().get("id").getAsInt());
                    else if(b.has("cancelEnabled")&&b.get("cancelEnabled").getAsBoolean())body=o("revision",rev,"op","cancel");
                    if(steps%40==0)System.out.println("seat"+seat+" t"+turn+" "+input0+" "+st.get("message"));
                }
                if(body!=null){act(seat,body);seen.put(seat,rev);moved=true;steps++;}
            }
            JsonObject s1=state(1),s2=state(2);
            if("finished".equals(s1.get("status").getAsString())&&"finished".equals(s2.get("status").getAsString())){
                System.out.println("FINISHED both seats. seat1 winner="+s1.get("winner")+" id="+s1.get("winnerPlayerId")+" | seat2 winner="+s2.get("winner")+" id="+s2.get("winnerPlayerId"));
                System.out.println("viewers "+s1.get("viewer")+" / "+s2.get("viewer")+", lands "+landsPlayed+", casts "+casts+", steps "+steps+", privacy checks "+privacyChecks+", leaks "+leaks+", ms "+(System.currentTimeMillis()-t0));
                System.out.println("probe rejected "+probeRejected);System.exit(leaks==0&&probeRejected?0:2);
            }
            if(!moved)Thread.sleep(40);
        }
        JsonObject s1=state(1);System.out.println("TIMEOUT turn "+s1.get("turn")+" seat1 input "+s1.get("inputType")+" msg "+s1.get("message")+" busy "+s1.get("busy")+" | seat2 "+state(2).get("inputType")+" "+state(2).get("message"));
        System.exit(3);
    }
}
