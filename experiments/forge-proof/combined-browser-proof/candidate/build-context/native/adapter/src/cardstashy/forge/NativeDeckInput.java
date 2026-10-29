package cardstashy.forge;

import com.google.gson.*;
import forge.StaticData;
import forge.card.*;
import forge.deck.*;
import forge.item.PaperCard;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.*;

/** Existing CardStashy snapshot -> exact native supported-format deck. No builder, repair, substitution, or rules implementation. */
public final class NativeDeckInput {
    static final Gson JSON=new GsonBuilder().disableHtmlEscaping().serializeNulls().create();
    public record Resolution(JsonObject source, Deck deck, Map<String,Object> report) {}
    record Row(PaperCard card,int qty,String section,int index,JsonObject requested) {}
    static Map<String,Object> map(Object... pairs){return ForgeHttpBridge.obj(pairs);}
    static IllegalArgumentException fail(String code){return new IllegalArgumentException(code);}
    static String string(JsonElement e,String label,int limit){
        if(e==null||!e.isJsonPrimitive()||!e.getAsJsonPrimitive().isString())throw fail(label+"_must_be_string");
        String value=e.getAsString();
        if(value.isBlank()||value.length()>limit||value.chars().anyMatch(c->c<32||c==127))throw fail(label+"_invalid");
        return value;
    }
    static int quantity(JsonElement e,String label){int n=ForgeHttpBridge.exactInt(e,label);if(n<1||n>1000)throw fail(label+"_out_of_range");return n;}
    static JsonArray array(JsonObject o,String key,boolean optional){
        if(!o.has(key)&&optional)return new JsonArray();
        JsonElement x=o.get(key);if(x==null||!x.isJsonArray()||x.getAsJsonArray().size()>2500)throw fail(key+"_invalid");return x.getAsJsonArray();
    }
    static String optionalString(JsonObject row,String key){return row.has(key)?string(row.get(key),key,80):null;}
    static String sameField(JsonObject row,String a,String b){String x=optionalString(row,a),y=optionalString(row,b);if(x!=null&&y!=null&&!x.equals(y))throw fail("conflicting_"+a);return x!=null?x:y;}
    static PaperCard resolveCard(JsonObject row){
        String name=string(row.get("name"),"card_name",512);
        CardDb db=StaticData.instance().getCommonCards();
        // Never use CardDb.getCard(name,set): that API silently falls back to another printing.
        List<PaperCard> candidates=new ArrayList<>(db.getAllCardsNoAlt(name));
        if(candidates.isEmpty())candidates.addAll(db.getAllCards(name));
        if(candidates.isEmpty()&&name.contains(" // ")){
            String[] faces=name.split(" // ",-1);
            for(PaperCard card:db.getAllCards(faces[0])){
                List<String> actual=card.getRules().getAllFaces().stream().map(ICardFace::getName).toList();
                if(actual.size()==faces.length&&java.util.stream.IntStream.range(0,faces.length).allMatch(i->actual.get(i).equalsIgnoreCase(faces[i])))candidates.add(card);
            }
        }
        if(candidates.isEmpty())throw fail("unknown_card:"+name);
        if(candidates.stream().map(PaperCard::getRules).distinct().count()!=1)throw fail("ambiguous_card:"+name);
        String set=sameField(row,"set","setCode"),collector=sameField(row,"collectorNumber","collector_number");
        if(collector!=null&&set==null)throw fail("collector_requires_set:"+name);
        if(set!=null)candidates.removeIf(c->!c.getEdition().equalsIgnoreCase(set));
        if(collector!=null)candidates.removeIf(c->!c.getCollectorNumber().equals(collector));
        if(candidates.isEmpty())throw fail("printing_not_found:"+name);
        candidates.sort(Comparator.comparing(PaperCard::getEdition).thenComparing(PaperCard::getCollectorNumber).thenComparingInt(PaperCard::getArtIndex));
        PaperCard result=candidates.get(0);
        if(result.getRules().isUnsupported())throw fail("native_definition_unsupported:"+name);
        if(result.getRules().isCustom())throw fail("custom_card_not_supported:"+name);
        Boolean foil=row.has("foil")?ForgeHttpBridge.exactBoolean(row.get("foil"),"foil"):null;
        String finish=optionalString(row,"finish");
        if(finish!=null){
            if(!Set.of("foil","nonfoil").contains(finish))throw fail("finish_not_supported:"+name);
            boolean f=finish.equals("foil");if(foil!=null&&foil!=f)throw fail("conflicting_finish:"+name);foil=f;
        }
        return Boolean.TRUE.equals(foil)?result.getFoiled():result.getUnFoiled();
    }
    static List<Row> rows(JsonObject source,String section,boolean optional){
        List<Row> result=new ArrayList<>();int count=0,index=0;
        for(JsonElement e:array(source,section,optional)){
            if(!e.isJsonObject())throw fail(section+"_row_must_be_object");
            JsonObject row=e.getAsJsonObject();int qty=quantity(row.get("qty"),"qty");
            if((count+=qty)>2500)throw fail("deck_copy_limit");
            result.add(new Row(resolveCard(row),qty,section,index++,row.deepCopy()));
        }
        return result;
    }
    static Map<String,Object> identity(PaperCard card){return map("name",card.getName(),"rulesName",card.getRules().getName(),"faceNames",card.getRules().getAllFaces().stream().map(ICardFace::getName).toList(),"setCode",card.getEdition(),"collectorNumber",card.getCollectorNumber(),"artIndex",card.getArtIndex(),"foil",card.isFoil());}
    static Map<String,Object> rowReport(Row row,int qty){return map("sourceSection",row.section,"sourceRow",row.index,"requested",row.requested,"quantity",qty,"resolved",identity(row.card),"printingSelection",row.requested.has("set")||row.requested.has("setCode")?"explicit-printing-constraints":"unspecified-deterministic-native-printing");}
    public static Resolution resolveSnapshot(JsonObject original,boolean cpu){
        if(original==null)throw fail("snapshot_required");
        JsonObject source=original.deepCopy();bounded(source,0,new int[]{0});
        NativeMatchFormat format=NativeMatchFormat.parse(string(source.get("format"),"format",80));
        String name=string(source.get("name"),"deck_name",160);
        if(source.has("errors")&&(!source.get("errors").isJsonArray()||!source.getAsJsonArray("errors").isEmpty()))throw fail("import_errors_require_review");
        if(source.has("companion")&&!source.get("companion").isJsonNull()&&!source.get("companion").getAsString().isEmpty())throw fail("companion_designation_not_supported");
        List<Row> cards=rows(source,"cards",false),side=rows(source,"side",true);
        // Forge infers companions from Sideboard even without an explicit
        // designation. Its setup move to Command is outside this release's exact
        // roster contract, so reject the intact setup before starting either seat.
        if(side.stream().anyMatch(row->row.card().getRules().hasStartOfKeyword("Companion:")))throw fail("companion_sideboard_setup_not_supported");
        if(cards.isEmpty())throw fail("empty_deck");
        if(cards.size()+side.size()+array(source,"commanders",true).size()>2500||java.util.stream.Stream.concat(cards.stream(),side.stream()).mapToInt(Row::qty).sum()>2500)throw fail("deck_transport_limit");
        List<JsonObject> declarations=new ArrayList<>();
        for(JsonElement e:array(source,"commanders",true)){
            JsonObject d;if(e.isJsonPrimitive()&&e.getAsJsonPrimitive().isString()){d=new JsonObject();d.add("name",e);d.addProperty("qty",1);}else if(e.isJsonObject())d=e.getAsJsonObject();else throw fail("commander_declaration_invalid");
            if(quantity(d.get("qty"),"commander_qty")!=1)throw fail("commander_quantity_must_be_one");declarations.add(d);
        }
        String legacy=source.has("commander")&&!source.get("commander").isJsonNull()&&!source.get("commander").getAsString().isEmpty()?string(source.get("commander"),"commander",512):null;
        if(declarations.isEmpty()&&legacy!=null){JsonObject d=new JsonObject();d.addProperty("name",legacy);d.addProperty("qty",1);declarations.add(d);}
        if(format.commander()&&(declarations.isEmpty()||declarations.size()>2))throw fail("commander_count_invalid");
        if(!format.commander()&&!declarations.isEmpty())throw fail("commander_designation_not_supported_in_format");
        if(legacy!=null&&!resolveCard(declarations.get(0)).getRules().equals(resolveCard(named(legacy)).getRules()))throw fail("legacy_commander_conflict");
        Deck deck=new Deck(name);int[] remaining=cards.stream().mapToInt(Row::qty).toArray();Set<CardRules> seen=new HashSet<>();
        List<Object> mainReport=new ArrayList<>(),commandReport=new ArrayList<>(),sideReport=new ArrayList<>();
        for(JsonObject d:declarations){
            PaperCard designated=resolveCard(d);if(!seen.add(designated.getRules()))throw fail("duplicate_commander");
            int found=-1;
            for(int i=0;i<cards.size();i++)if(remaining[i]>0&&cards.get(i).card.getRules()==designated.getRules()){
                if(found>=0)throw fail("ambiguous_commander_row");found=i;
            }
            if(found<0)throw fail("commander_not_in_snapshot:"+d.get("name").getAsString());
            Row row=cards.get(found);
            if((d.has("set")||d.has("setCode")||d.has("collectorNumber")||d.has("collector_number")||d.has("foil")||d.has("finish"))&&!row.card.equals(designated))throw fail("commander_printing_conflict");
            remaining[found]--;deck.getOrCreate(DeckSection.Commander).add(row.card,1);commandReport.add(rowReport(row,1));
        }
        for(int i=0;i<cards.size();i++)if(remaining[i]>0){Row row=cards.get(i);deck.getMain().add(row.card,remaining[i]);mainReport.add(rowReport(row,remaining[i]));}
        for(Row row:side){deck.getOrCreate(DeckSection.Sideboard).add(row.card,row.qty);sideReport.add(rowReport(row,row.qty));}
        List<String> legality=new ArrayList<>();String problem=format.deckFormat.getDeckConformanceProblem(deck);if(problem!=null)legality.add(problem);
        Set<String> illegalCards=new LinkedHashSet<>(),aiWarnings=new LinkedHashSet<>();
        for(Row row:java.util.stream.Stream.concat(cards.stream(),side.stream()).toList()){
            if(!(format==NativeMatchFormat.Commander?DeckFormat.Commander.isLegalCard(row.card):format.pool().getFilterRules().test(row.card)))illegalCards.add(row.card.getName());
            if(cpu&&row.card.getRules().getAiHints().getRemAIDecks())aiWarnings.add(row.card.getName());
        }
        if(!illegalCards.isEmpty())legality.add("Cards not admitted by pinned native "+format.name()+" card pool: "+String.join(", ",illegalCards));
        if(format!=NativeMatchFormat.Commander){String poolProblem=format.pool().getDeckConformanceProblem(deck);if(poolProblem!=null&&illegalCards.isEmpty())legality.add(poolProblem);}
        int inputCount=cards.stream().mapToInt(Row::qty).sum();
        if(deck.getMain().countAll()+NativeMatchFormat.count(deck,DeckSection.Commander)!=inputCount)throw new IllegalStateException("exact_count_changed");
        Map<String,Object> report=map("nativeRoster",roster(deck),"nativeRosterDigest",digest(JSON.toJsonTree(roster(deck))),"sourceDigest",digest(source),"format",format.name(),"nativeFormatRevision",ForgeHttpBridge.REV,"nativeFormatDefinitionDigest",digest(JSON.toJsonTree(format.definition())),"legalityScope","pinned native format definitions; not a live official ban/rotation service","legal",legality.isEmpty(),"legalityProblems",legality,"nativeDefinitionsLoaded",true,"interactionCoverage","not-fully-certified; unknown native prompts fail closed","cpuWarnings",aiWarnings,"mainCount",deck.getMain().countAll(),"commanderCount",NativeMatchFormat.count(deck,DeckSection.Commander),"sideCount",side.stream().mapToInt(Row::qty).sum(),"resolved",map("main",mainReport,"commanders",commandReport,"sideboard",sideReport));
        return new Resolution(source,deck,report);
    }
    public static Map<String,Object> roster(Deck deck){
        Map<String,Object> result=new LinkedHashMap<>();
        for(DeckSection section:List.of(DeckSection.Main,DeckSection.Commander,DeckSection.Sideboard)){
            List<Map<String,Object>> rows=new ArrayList<>();var pool=deck.get(section);
            if(pool!=null)for(var entry:pool){Map<String,Object> row=new LinkedHashMap<>(identity(entry.getKey()));row.put("quantity",entry.getValue());rows.add(row);}
            rows.sort(Comparator.comparing(row->canonical(JSON.toJsonTree(row))));result.put(section.name(),rows);
        }
        return result;
    }
    static JsonObject named(String name){JsonObject o=new JsonObject();o.addProperty("name",name);return o;}
    static void bounded(JsonElement e,int depth,int[] count){
        if(depth>20||++count[0]>50000)throw fail("snapshot_structure_limit");
        if(e.isJsonArray())for(JsonElement x:e.getAsJsonArray())bounded(x,depth+1,count);
        else if(e.isJsonObject())for(var x:e.getAsJsonObject().entrySet()){if(x.getKey().length()>160)throw fail("snapshot_key_limit");bounded(x.getValue(),depth+1,count);}
        else if(e.isJsonPrimitive()){JsonPrimitive p=e.getAsJsonPrimitive();if(p.isString()&&p.getAsString().length()>100000)throw fail("snapshot_string_limit");if(p.isNumber()&&!Double.isFinite(p.getAsDouble()))throw fail("snapshot_number_invalid");}
    }
    // Same sorted-object-keys/preserved-array-order JSON domain as the existing HOST digest.
    static String canonical(JsonElement e){
        if(e.isJsonObject()){List<String> fields=new ArrayList<>();for(String k:jsonKeys(e.getAsJsonObject().keySet()))fields.add(quote(k)+":"+canonical(e.getAsJsonObject().get(k)));return "{"+String.join(",",fields)+"}";}
        if(e.isJsonArray()){List<String> rows=new ArrayList<>();for(JsonElement x:e.getAsJsonArray())rows.add(canonical(x));return "["+String.join(",",rows)+"]";}
        if(e.isJsonNull())return "null";
        JsonPrimitive p=e.getAsJsonPrimitive();if(p.isString())return quote(p.getAsString());if(p.isBoolean())return p.getAsString();
        double d=p.getAsDouble();if(!Double.isFinite(d))throw fail("snapshot_number_invalid");if(d==0)return "0";
        // ECMAScript Number::toString chooses the shortest decimal that round-trips,
        // nearest to the exact binary value (ties to even). Java Double.toString differs
        // for e.g. Double.MIN_VALUE, so do not hash its spelling.
        BigDecimal exact=new BigDecimal(d),b=null;
        for(int precision=1;precision<=17;precision++){
            BigDecimal candidate=exact.round(new MathContext(precision,RoundingMode.HALF_EVEN));
            if(Double.doubleToLongBits(Double.parseDouble(candidate.toString()))==Double.doubleToLongBits(d)){b=candidate.stripTrailingZeros();break;}
        }
        if(b==null)throw fail("number_canonicalization_failed");double a=Math.abs(d);
        if(a>=1e-6&&a<1e21)return b.toPlainString();
        String text=b.toString().replace("E","e");return text;
    }
    static List<String> jsonKeys(Set<String> keys){
        // Object.fromEntries(sorted) still enumerates JS array-index keys numerically.
        List<String> result=new ArrayList<>(keys);result.sort((a,b)->{
            Long ai=arrayIndex(a),bi=arrayIndex(b);
            if(ai!=null&&bi!=null)return Long.compare(ai,bi);
            if(ai!=null)return -1;if(bi!=null)return 1;return a.compareTo(b);
        });return result;
    }
    static Long arrayIndex(String s){
        if(!s.matches("0|[1-9][0-9]{0,9}"))return null;
        long n=Long.parseLong(s);return n<4294967295L?n:null;
    }
    static String quote(String s){
        StringBuilder out=new StringBuilder("\"");
        for(int i=0;i<s.length();i++){
            char c=s.charAt(i);
            switch(c){
                case '"' -> out.append("\\\"");case '\\' -> out.append("\\\\");
                case '\b' -> out.append("\\b");case '\f' -> out.append("\\f");
                case '\n' -> out.append("\\n");case '\r' -> out.append("\\r");case '\t' -> out.append("\\t");
                default -> {
                    if(c<32||(Character.isHighSurrogate(c)&&(i+1==s.length()||!Character.isLowSurrogate(s.charAt(i+1))))||(Character.isLowSurrogate(c)&&(i==0||!Character.isHighSurrogate(s.charAt(i-1)))))out.append(String.format("\\u%04x",(int)c));
                    else out.append(c);
                }
            }
        }return out.append('"').toString();
    }
    public static String digest(JsonElement value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonical(value).getBytes(StandardCharsets.UTF_8)));}catch(java.security.NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
}
