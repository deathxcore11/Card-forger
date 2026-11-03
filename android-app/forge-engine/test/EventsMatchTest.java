import cardstashy.forge.LocalEngine;
import com.google.gson.*;
import java.nio.file.*;
import java.util.*;

/** One real CPU match on the bundled engine: the human keeps, plays lands, casts what it can
 *  and attacks with everything, until turn N. Checks the additive priority view on every
 *  published state and collects the typed events (damage, life cause, zone cause, countered,
 *  transform, counters source). Usage: EventsMatchTest <engine root> <bootstrap.json> <turns> [seed] */
public class EventsMatchTest {
    static LocalEngine.Session s;
    static JsonObject state() throws Exception {return JsonParser.parseString(s.call("GET","/state",null).body()).getAsJsonObject();}
    static int act(JsonObject body) throws Exception {var r=s.call("POST","/action",body.toString());return r.status();}
    static JsonObject o(Object... kv){JsonObject j=new JsonObject();for(int i=0;i<kv.length;i+=2){Object v=kv[i+1];if(v instanceof Number n)j.addProperty((String)kv[i],n);else if(v instanceof Boolean b)j.addProperty((String)kv[i],b);else j.addProperty((String)kv[i],(String)v);}return j;}
    static int fails=0;
    static void check(boolean ok,String what){if(!ok){fails++;if(fails<20)System.out.println("FAIL "+what);}}
    public static void main(String[] a) throws Exception {
        System.out.println("init ms "+LocalEngine.init(a[0]));
        JsonObject input=JsonParser.parseString(Files.readString(Path.of(a[1]))).getAsJsonObject().getAsJsonObject("input");
        s=LocalEngine.start(o().toString().replace("{}","{\"input\":"+input+"}"),a.length>3?Long.parseLong(a[3]):20261102L);
        int maxTurn=Integer.parseInt(a[2]);
        TreeMap<Long,JsonObject> events=new TreeMap<>();
        Map<String,Integer> stops=new TreeMap<>();Set<String> holders=new HashSet<>();
        long seen=-1;long nextLog=0;int steps=0;Set<Integer> attackClicked=new HashSet<>();int lastTurn=0;
        long deadline=System.currentTimeMillis()+300_000;String end="TIMEOUT";
        while(System.currentTimeMillis()<deadline){
            JsonObject st=state();String status=st.get("status").getAsString();
            if(System.currentTimeMillis()>nextLog){nextLog=System.currentTimeMillis()+30000;System.out.println("DBG "+status+" turn "+st.get("turn")+" input "+st.get("inputType")+" busy "+st.get("busy")+" prompt "+(st.get("prompt")==null?null:String.valueOf(st.get("prompt")).substring(0,Math.min(200,String.valueOf(st.get("prompt")).length())))+" msg "+st.get("message")+" priority "+st.get("priority"));}
            if(st.has("events"))for(var e:st.getAsJsonObject("events").getAsJsonArray("items"))events.put(e.getAsJsonObject().get("seq").getAsLong(),e.getAsJsonObject());
            if(status.equals("failed")){end="FAILED "+st.get("failure")+" "+st.get("initialization");break;}
            if(status.equals("finished")){end="FINISHED winner="+st.get("winner");break;}
            if(!status.equals("running")){Thread.sleep(30);continue;}
            long rev=st.get("revision").getAsLong();
            // The priority view is on every running publication.
            check(st.has("priority")&&st.get("priority").isJsonObject(),"priority missing rev "+rev);
            var pv=st.getAsJsonObject("priority");
            String input0=st.get("inputType").isJsonNull()?null:st.get("inputType").getAsString();
            String stop=pv.get("stop").isJsonNull()?null:pv.get("stop").getAsString();
            if(rev!=seen){stops.merge(String.valueOf(stop),1,Integer::sum);holders.add(String.valueOf(pv.get("holder")));}
            if("InputPassPriority".equals(input0)&&!st.get("busy").getAsBoolean())check(stop!=null&&pv.get("waitingOnViewer").getAsBoolean(),"priority prompt without a stop: "+pv);
            if("InputAttack".equals(input0))check("declare_attackers".equals(stop),"attack stop "+stop);
            if("InputPassPriority".equals(input0)&&st.getAsJsonArray("stack").size()>0&&!(st.get("prompt")!=null&&st.get("prompt").isJsonObject()))check("stack".equals(stop),"stack stop "+stop);
            int turn=st.get("turn").getAsInt();
            if(turn!=lastTurn){attackClicked.clear();lastTurn=turn;}
            if(turn>maxTurn){end="TURN LIMIT";break;}
            if(rev==seen||st.get("busy").getAsBoolean()){Thread.sleep(20);continue;}
            JsonObject body=null;JsonElement pr=st.get("prompt");
            if(pr!=null&&pr.isJsonObject()){
                var p=pr.getAsJsonObject();String method=p.get("method").getAsString();
                check("choice".equals(stop),"prompt stop "+stop);
                body=o("revision",rev,"op","reply","promptId",p.get("id").getAsInt());
                if(method.equals("confirm")||method.equals("showConfirmDialog"))body.addProperty("value",true);
                else{JsonArray idx=new JsonArray();int want=p.get("max").getAsInt()==0?0:Math.max(1,p.get("min").getAsInt());for(int i=0;i<want&&i<p.getAsJsonArray("options").size();i++)idx.add(i);body.add("indexes",idx);}
            }else if(input0==null){Thread.sleep(20);continue;}
            else if(input0.equals("InputPassPriority")){
                int viewer=st.get("viewer").getAsInt();JsonObject me=null;
                for(var pe:st.getAsJsonArray("players"))if(pe.getAsJsonObject().get("id").getAsInt()==viewer)me=pe.getAsJsonObject();
                Map<Integer,String> hand=new HashMap<>();
                for(var c:me.getAsJsonObject("zones").getAsJsonObject("Hand").getAsJsonArray("cards")){var co=c.getAsJsonObject();hand.put(co.get("id").getAsInt(),co.has("type")?String.valueOf(co.get("type")):"");}
                Integer land=null,spell=null;
                for(var x:st.getAsJsonObject("selection").getAsJsonArray("actionable")){var xo=x.getAsJsonObject();int id=xo.get("id").getAsInt();if(!hand.containsKey(id))continue;
                    if(hand.get(id).contains("Land")){if(land==null)land=id;}
                    else if(xo.has("affordability")&&"available".equals(xo.get("affordability").getAsString())&&spell==null)spell=id;}
                if(land!=null)body=o("revision",rev,"op","card","id",land);
                else if(spell!=null)body=o("revision",rev,"op","card","id",spell);
                else if(st.getAsJsonObject("buttons").get("okEnabled").getAsBoolean())body=o("revision",rev,"op","ok");
            }else if(input0.equals("InputAttack")){
                Integer pick=null;
                for(var c:st.getAsJsonObject("selection").getAsJsonArray("cards")){int id=c.getAsJsonObject().get("id").getAsInt();if(attackClicked.add(id)){pick=id;break;}}
                body=pick!=null?o("revision",rev,"op","card","id",pick):o("revision",rev,"op","ok");
            }else{
                var b=st.getAsJsonObject("buttons");
                var pick=st.getAsJsonObject("selection").getAsJsonArray("cards");var chosen=st.getAsJsonObject("selection").getAsJsonArray("chosen");
                if(b.has("okEnabled")&&b.get("okEnabled").getAsBoolean())body=o("revision",rev,"op","ok");
                else if(pick.size()>0&&chosen.size()==0)body=o("revision",rev,"op","card","id",pick.get(0).getAsJsonObject().get("id").getAsInt());
                else if(b.has("cancelEnabled")&&b.get("cancelEnabled").getAsBoolean())body=o("revision",rev,"op","cancel");
            }
            if(body!=null){act(body);seen=rev;steps++;}else Thread.sleep(20);
        }
        Map<String,Integer> types=new TreeMap<>();
        for(var e:events.values()){
            String t=e.get("type").getAsString();
            String k=t+(e.has("cause")?"/"+e.get("cause").getAsString():"")+(e.has("source")&&t.equals("counters")?"/sourced":"")+(e.has("lifelink")?"/lifelink":"");
            types.merge(k,1,Integer::sum);
            if(t.equals("life")&&e.has("cause"))check(e.has("sources")||e.has("source"),"life cause without source "+e);
            if(t.equals("damage"))check(e.has("amount")&&e.has("source")&&e.has("target"),"damage shape "+e);
        }
        // Every event that carries a cause, printed once per kind so a person can read them.
        Set<String> printed=new HashSet<>();
        for(var e:events.values()){String t=e.get("type").getAsString();String k=t+(e.has("cause")?e.get("cause").getAsString():"");
            if((e.has("cause")||t.equals("countered")||t.equals("transform")||e.has("lifelink")||(t.equals("counters")&&e.has("source")))&&printed.add(k))System.out.println("  e.g. "+e);}
        System.out.println(end+" after "+steps+" steps; events seen "+events.size()+" (seq "+(events.isEmpty()?0:events.firstKey())+".."+(events.isEmpty()?0:events.lastKey())+")");
        System.out.println("event kinds "+types);
        System.out.println("priority stops by publication "+stops+" holders "+holders);
        System.out.println(fails==0?"EVENTS_MATCH PASS":"EVENTS_MATCH FAIL "+fails);
        System.exit(fails==0?0:2);
    }
}
