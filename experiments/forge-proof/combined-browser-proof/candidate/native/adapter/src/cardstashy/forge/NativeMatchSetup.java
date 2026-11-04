package cardstashy.forge;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import forge.game.Game;
import forge.game.card.Card;
import forge.game.player.Player;
import forge.game.zone.ZoneType;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Optional match start setting for scripted lessons (CPU matches only).
 * stack.hero / stack.villain name the cards to draw first, top of the library first.
 * noMulligan keeps the opening seven. The match is still dealt, drawn and played by native Forge:
 * only the order of the shuffled library changes, before the opening draw. */
public record NativeMatchSetup(List<String> hero, List<String> villain, boolean noMulligan) {
    static final int MAX_NAMES = 15, MAX_NAME_LENGTH = 120;
    public static NativeMatchSetup parse(JsonObject input) {
        if(!input.has("setup"))return null;
        if(!input.get("setup").isJsonObject())throw new IllegalArgumentException("invalid_match_setup");
        JsonObject setup=input.getAsJsonObject("setup");
        if(!Set.of("stack","noMulligan").containsAll(setup.keySet()))throw new IllegalArgumentException("invalid_match_setup");
        List<String> hero=List.of(),villain=List.of();
        if(setup.has("stack")){
            if(!setup.get("stack").isJsonObject())throw new IllegalArgumentException("invalid_match_setup");
            JsonObject stack=setup.getAsJsonObject("stack");
            if(!Set.of("hero","villain").containsAll(stack.keySet()))throw new IllegalArgumentException("invalid_match_setup");
            hero=names(stack.get("hero"));villain=names(stack.get("villain"));
        }
        boolean noMulligan=false;
        if(setup.has("noMulligan")){
            JsonElement e=setup.get("noMulligan");
            if(!e.isJsonPrimitive()||!e.getAsJsonPrimitive().isBoolean())throw new IllegalArgumentException("invalid_match_setup");
            noMulligan=e.getAsBoolean();
        }
        return new NativeMatchSetup(hero,villain,noMulligan);
    }
    private static List<String> names(JsonElement e) {
        if(e==null)return List.of();
        if(!e.isJsonArray()||e.getAsJsonArray().size()>MAX_NAMES)throw new IllegalArgumentException("invalid_match_setup");
        List<String> out=new ArrayList<>();
        for(JsonElement n:e.getAsJsonArray())out.add(NativeDeckInput.string(n,"setup.stack",MAX_NAME_LENGTH));
        return List.copyOf(out);
    }
    /** Moves the named cards to the top of each library. Returns a small receipt. */
    Map<String,Object> apply(Game game) {
        int hero=0,villain=0;
        for(Player p:game.getPlayers())if(p.isAI())villain=stack(p,villain());else hero=stack(p,hero());
        return Map.of("hero",hero,"villain",villain,"noMulligan",noMulligan);
    }
    private static int stack(Player player,List<String> names) {
        if(names.isEmpty())return 0;
        List<Card> rest=new ArrayList<>(player.getCardsIn(ZoneType.Library)),top=new ArrayList<>();
        for(String name:names)for(int i=0;i<rest.size();i++)if(rest.get(i).getName().equals(name)){top.add(rest.remove(i));break;}
        int moved=top.size();
        top.addAll(rest);
        player.getZone(ZoneType.Library).setCards(top);
        return moved;
    }
}
