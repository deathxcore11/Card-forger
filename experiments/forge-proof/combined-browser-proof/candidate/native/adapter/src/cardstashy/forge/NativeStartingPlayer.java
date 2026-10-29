package cardstashy.forge;

import com.google.gson.JsonObject;
import forge.ai.LobbyPlayerAi;
import forge.ai.PlayerControllerAi;
import forge.game.Game;
import forge.game.player.Player;
import forge.player.LobbyPlayerHuman;
import forge.player.PlayerControllerHuman;
import forge.util.GuiDisplayUtil;
import java.util.Set;

/** Pregame preferences only. Native Forge still tosses, draws, mulligans and plays.
 * For random, its coin winner starts. Practice may explicitly select a seat.
 * The override is a native controller choice, never a post-deal board mutation. */
public record NativeStartingPlayer(String selection, String playStyle) {
    public static NativeStartingPlayer parse(JsonObject input) {
        boolean selectionPresent=input.has("startingPlayer"), stylePresent=input.has("playStyle");
        if(!selectionPresent&&!stylePresent)return null; // retain historical proof inputs
        if(!selectionPresent||!stylePresent)throw new IllegalArgumentException("invalid_starting_player_selection");
        String selection=NativeDeckInput.string(input.get("startingPlayer"),"startingPlayer",16);
        String style=NativeDeckInput.string(input.get("playStyle"),"playStyle",16);
        if(!Set.of("random","first","second").contains(selection)||!Set.of("quick","practice").contains(style)
                ||style.equals("quick")&&!selection.equals("random"))throw new IllegalArgumentException("invalid_starting_player_selection");
        return new NativeStartingPlayer(selection,style);
    }
    Player choose(Player nativeCoinWinner) {
        if(selection.equals("random"))return nativeCoinWinner;
        var players=nativeCoinWinner.getGame().getPlayers();
        if(players.size()<2)throw new IllegalStateException("starting_player_requires_two_seats");
        boolean wantAI=selection.equals("second");
        // A Commander pod: "second" means the CPU seated after you starts.
        if(players.size()>2)return wantAI?players.get(1):players.get(0);
        Player selected=null;
        for(Player p:players)if(p.isAI()==wantAI){
            if(selected!=null)throw new IllegalStateException("starting_player_seat_ambiguous");
            selected=p;
        }
        if(selected==null)throw new IllegalStateException("starting_player_seat_missing");
        return selected;
    }
    public LobbyPlayerHuman humanLobby(String name) {
        return new LobbyPlayerHuman(name,0,0) {
            @Override public Player createIngamePlayer(Game game,int id) {
                Player player=new Player(GuiDisplayUtil.personalizeHuman(getName()),game,id);
                player.setFirstController(new PlayerControllerHuman(game,player,this) {
                    @Override public Player chooseStartingPlayer(boolean firstGame) {
                        return firstGame?choose(player):super.chooseStartingPlayer(false);
                    }
                });
                return player;
            }
        };
    }
    public LobbyPlayerAi aiLobby(LobbyPlayerAi configured) {
        LobbyPlayerAi lobby=new LobbyPlayerAi(configured.getName(),null) {
            @Override public Player createIngamePlayer(Game game,int id) {
                Player player=new Player(getName(),game,id);
                PlayerControllerAi controller=new PlayerControllerAi(game,player,this) {
                    @Override public Player chooseStartingPlayer(boolean firstGame) {
                        return firstGame?choose(player):super.chooseStartingPlayer(false);
                    }
                };
                controller.getAi().setUseSimulation(null);
                player.setFirstController(controller);
                return player;
            }
        };
        lobby.setAiProfile(configured.getAiProfile());
        lobby.setRotateProfileEachGame(false);
        lobby.setAvatarIndex(configured.getAvatarIndex());
        lobby.setSleeveIndex(configured.getSleeveIndex());
        return lobby;
    }
}
