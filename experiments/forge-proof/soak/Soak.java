import cardstashy.forge.LocalEngine;
import com.google.gson.*;
import java.nio.file.*;
import java.util.*;
public class Soak {
  static JsonObject deck(JsonObject p, String seat){
    JsonObject d=new JsonObject(); d.addProperty("format",p.get("format").getAsString()); d.addProperty("name",seat);
    JsonArray cards=new JsonArray(), cmd=new JsonArray();
    for(JsonElement r:p.getAsJsonArray("rows")){JsonObject o=r.getAsJsonObject(); JsonObject c=new JsonObject(); c.addProperty("name",o.get("name").getAsString()); c.addProperty("qty",o.get("qty").getAsInt());
      if(o.has("commander")) {cmd.add(c); d.addProperty("commander",o.get("name").getAsString());} cards.add(c);}
    d.add("cards",cards); if(cmd.size()>0) d.add("commanders",cmd); return d; }
  static Map<String,String> samples=new TreeMap<>();
  static boolean nul(JsonObject o,String k){return !o.has(k)||o.get(k).isJsonNull();}
  public static void main(String[] a) throws Exception {
    JsonArray decks=JsonParser.parseString(Files.readString(Paths.get(a[1]))).getAsJsonObject().getAsJsonArray("decks");
    LocalEngine.init(a[0]);
    int from=Integer.parseInt(a[2]), to=Integer.parseInt(a[3]); long seed0=Long.parseLong(a[4]);
    long capMs=Long.parseLong(a[5]);
    StringBuilder report=new StringBuilder(); int played=0, stalls=0, failed=0;
    for(int hi=from;hi<to;hi++){
      JsonObject h=decks.get(hi).getAsJsonObject(); String fmt=h.get("format").getAsString();
      List<Integer> same=new ArrayList<>(); for(int i=0;i<decks.size();i++) if(i!=hi&&decks.get(i).getAsJsonObject().get("format").getAsString().equals(fmt)) same.add(i);
      Random rnd=new Random(seed0+hi); JsonObject c=decks.get(same.get(rnd.nextInt(same.size()))).getAsJsonObject();
      JsonObject in=new JsonObject(); in.addProperty("format",fmt); in.add("humanDeck",deck(h,"You")); in.add("opponentDeck",deck(c,"CPU"));
      in.addProperty("difficultyPolicyVersion","forge-heuristic-medium-beta-v1"); in.addProperty("startingPlayer","random"); in.addProperty("playStyle","quick");
      JsonObject w=new JsonObject(); w.add("input",in);
      long t0=System.currentTimeMillis();
      LocalEngine.Session s=LocalEngine.start(w.toString(),seed0+hi);
      int rev=-1, turn=0, actions=0, turnActions=0, loopTurn=-1, rejected=0, sameRev=0; long lastChange=t0, lastAct=0; String outcome="cap"; String stallInfo="";
      Map<String,Integer> ev=new TreeMap<>(); int lastSeq=0; Set<String> errs=new LinkedHashSet<>(); long maxCpuWait=0, waitStart=t0; 
      List<long[]> cpuBursts=new ArrayList<>(); int maxEventsPerRev=0;
      while(true){
        Thread.sleep(15);
        long now=System.currentTimeMillis();
        if(now-t0>capMs){break;}
        JsonObject st; try{ st=JsonParser.parseString(s.call("GET","/state",null).body()).getAsJsonObject(); }catch(Exception e){errs.add("state:"+e); continue;}
        if(nul(st,"revision")) { if(!nul(st,"failure")){outcome="FAILED "+st.get("failure").getAsString()+" "+st.getAsJsonObject("initialization").get("errors"); break;} continue; }
        int r=st.get("revision").getAsInt();
        if(!nul(st,"turn")) turn=st.get("turn").getAsInt();
        if(!nul(st,"failure")){outcome="FAILED "+st.get("failure").getAsString(); break;}
        if(r!=rev){ rev=r; lastChange=now; sameRev=0;
          int n=0; if(st.has("events")) for(JsonElement e:st.getAsJsonObject("events").getAsJsonArray("items")){JsonObject o=e.getAsJsonObject(); int q=o.get("seq").getAsInt(); if(q>lastSeq){ n++; ev.merge(o.get("type").getAsString(),1,Integer::sum); samples.putIfAbsent("event:"+o.get("type").getAsString(), o.toString()); }}
          if(st.has("events")) lastSeq=Math.max(lastSeq, st.getAsJsonObject("events").get("latest").getAsInt());
          maxEventsPerRev=Math.max(maxEventsPerRev,n);
        }
        if(st.get("status").getAsString().equals("finished")||(!nul(st,"gameOver")&&st.get("gameOver").getAsBoolean())){ outcome="finished winner="+st.get("winnerPlayerId")+" draw="+st.get("draw"); break; }
        if(!nul(st,"lastActionError")) errs.add("actionError:"+st.get("lastActionError"));
        boolean busy=!nul(st,"busy")&&st.get("busy").getAsBoolean();
        String it=nul(st,"inputType")?null:st.get("inputType").getAsString();
        JsonObject p=nul(st,"prompt")?null:st.getAsJsonObject("prompt");
        boolean mine=!busy&&(p!=null||(it!=null&&!it.equals("InputLockUI")));
        if(!mine){ if(now-lastChange>25000){ outcome="STALL"; String probe=""; try{ JsonObject pb=new JsonObject(); pb.addProperty("revision",r); pb.addProperty("op","ok"); var pr=s.call("POST","/action",pb.toString()); Thread.sleep(3000); JsonObject st2=JsonParser.parseString(s.call("GET","/state",null).body()).getAsJsonObject(); probe=" PROBE ok-> "+pr.status()+" "+pr.body()+" then rev "+st2.get("revision")+" busy "+st2.get("busy")+" input "+st2.get("inputType"); }catch(Exception e){probe=" PROBE err "+e;} System.out.println("STALLPROBE "+probe); StringBuilder sb=new StringBuilder(); for(var te:Thread.getAllStackTraces().entrySet()){ String n=te.getKey().getName(); if(n.contains("main")||n.contains("Reference")||n.contains("Signal")||n.contains("Finalizer")||n.contains("Common-Cleaner")) continue; sb.append("\nTHREAD "+n+" "+te.getKey().getState()); int k=0; for(var fr:te.getValue()){ if(k++>14)break; sb.append("\n   "+fr);} } try{ Files.writeString(Paths.get("stall-"+(seed0+hi)+"-"+System.currentTimeMillis()+".txt"), st.toString()+"\n"+sb);}catch(Exception e){} stallInfo="turn "+turn+" phase "+st.get("phase")+" input "+it+" busy "+busy+" prio "+st.get("priorityPlayer")+" msg "+st.get("message"); break;} continue; }
        if(now-lastAct<5) continue;
        // The bot repeating an answer Forge keeps refusing (for example OK on blocks that break a
        // blocking requirement) is the bot's limit, not an engine stall: stop the match there.
        if(turn!=loopTurn){loopTurn=turn;turnActions=0;}
        if(++turnActions>2000){ outcome="BOT_LOOP"; stallInfo="turn "+turn+" input "+it+" msg "+st.get("message")+" notification "+st.get("notification"); break; }
        if(sameRev>40){ outcome="STUCK_DECISION"; stallInfo="turn "+turn+" input "+it+" msg "+st.get("message")+" prompt "+(p==null?"":p.toString().substring(0,Math.min(600,p.toString().length()))); break; }
        JsonObject body=new JsonObject(); body.addProperty("revision",r);
        if(p!=null){
          String method=nul(p,"method")?"?":p.get("method").getAsString();
          samples.putIfAbsent("prompt:"+method+":"+(nul(p,"supported")?"?":p.get("supported").toString()), p.toString().substring(0,Math.min(700,p.toString().length())));
          body.addProperty("op","reply"); body.add("promptId",p.get("id"));
          int min=nul(p,"min")?0:p.get("min").getAsInt(), max=nul(p,"max")?1:p.get("max").getAsInt();
          JsonArray opts=nul(p,"options")?new JsonArray():p.getAsJsonArray("options");
          if(method.equals("order")){ JsonArray idx=new JsonArray(); for(JsonElement o:opts) idx.add(o.getAsJsonObject().get("index")); body.add("indexes",idx); }
          else if(p.has("amounts")||method.contains("assign")||method.contains("amount")){ body.addProperty("skip",true); if(true){ body.remove("skip"); JsonArray am=new JsonArray(); int total=0; java.util.regex.Matcher mm=java.util.regex.Pattern.compile("(\\d+)").matcher(p.get("message").getAsString()); if(mm.find()) total=Integer.parseInt(mm.group(1)); for(int i=0;i<opts.size();i++) am.add(i==0?total:0); body.add("amounts",am);} }
          else if(opts.size()==0){ if(sameRev%2==0) body.addProperty("value", !nul(p,"min")? String.valueOf(min) : "true"); else body.addProperty("value", true); }
          else { int n=Math.max(min, Math.min(max, sameRev%2==0?1:min)); JsonArray idx=new JsonArray(); List<Integer> all=new ArrayList<>(); for(JsonElement o:opts) all.add(o.getAsJsonObject().get("index").getAsInt()); Collections.shuffle(all,rnd); for(int i=0;i<Math.min(n,all.size());i++) idx.add(all.get(i)); body.add("indexes",idx); }
        } else {
          JsonObject sel=st.getAsJsonObject("selection"); JsonArray act=sel.getAsJsonArray("actionable"); JsonObject b=st.getAsJsonObject("buttons");
          boolean ok=!nul(b,"okEnabled")&&b.get("okEnabled").getAsBoolean(), cancel=!nul(b,"cancelEnabled")&&b.get("cancelEnabled").getAsBoolean();
          samples.putIfAbsent("input:"+it, ("buttons "+b+" sel "+sel).substring(0,Math.min(700,("buttons "+b+" sel "+sel).length())));
          if(it.equals("InputConfirmMulligan")){ body.addProperty("op","ok"); }
          else if(act.size()==0 && (sel.getAsJsonArray("cards").size()+sel.getAsJsonArray("targets").size())>0 && !ok && sameRev<8){ JsonArray cs=new JsonArray(); cs.addAll(sel.getAsJsonArray("cards")); cs.addAll(sel.getAsJsonArray("targets")); JsonObject x=cs.get(rnd.nextInt(cs.size())).getAsJsonObject(); body.addProperty("op",nul(x,"kind")?"card":x.get("kind").getAsString()); body.add("id",x.get("id")); }
          else if(act.size()>0 && (sameRev<6) && rnd.nextInt(10)<8){ JsonObject x=act.get(rnd.nextInt(act.size())).getAsJsonObject(); String kind=nul(x,"kind")?"card":x.get("kind").getAsString(); body.addProperty("op",kind); body.add("id",x.get("id")); }
          else if(ok&&(sameRev<12||!cancel)) body.addProperty("op","ok"); else if(cancel) body.addProperty("op","cancel"); else if(act.size()>0){ JsonObject x=act.get(rnd.nextInt(act.size())).getAsJsonObject(); body.addProperty("op",nul(x,"kind")?"card":x.get("kind").getAsString()); body.add("id",x.get("id")); } else { sameRev++; continue; }
        }
        var rep=s.call("POST","/action",body.toString()); actions++; sameRev++; lastAct=now;
        if(rep.status()!=202){ rejected++; String k="reject:"+rep.status()+":"+rep.body(); if(errs.size()<12) errs.add(k.substring(0,Math.min(200,k.length()))+" <- "+body.toString().substring(0,Math.min(120,body.toString().length()))+" in "+it); }
      }
      String line=String.format("%s vs %s [%s] seed %d -> %s | turns %d actions %d rejected %d secs %d maxEventsPerRev %d | events %s | %s | errs %s", h.get("key").getAsString(), c.get("key").getAsString(), fmt, seed0+hi, outcome, turn, actions, rejected, (System.currentTimeMillis()-t0)/1000, maxEventsPerRev, ev, stallInfo, errs);
      System.out.println("RESULT "+line); report.append(line).append("\n");
      played++; if(outcome.equals("STALL")) stalls++; if(outcome.startsWith("FAILED")) failed++;
      try{ s.close(); }catch(Exception e){}
      Thread.sleep(500);
    }
    for(var e:samples.entrySet()) report.append("SAMPLE ").append(e.getKey()).append(" => ").append(e.getValue()).append("\n");
    Files.writeString(Paths.get("report-"+from+"-"+to+"-"+seed0+".txt"),report.toString());
    // Release gate: any engine stall (no progress for 25 s while Forge is not waiting on the player) or failed match fails the run.
    System.out.println("SOAK_SUMMARY played "+played+" stalls "+stalls+" failed "+failed);
    System.exit(stalls+failed==0?0:1);
  }
}
