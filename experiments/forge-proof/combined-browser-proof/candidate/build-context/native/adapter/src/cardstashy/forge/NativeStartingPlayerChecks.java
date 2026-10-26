package cardstashy.forge;

import com.google.gson.*;
import forge.GuiDesktop;
import forge.ai.LobbyPlayerAi;
import forge.deck.Deck;
import forge.game.*;
import forge.game.event.GameEventFlipCoin;
import forge.game.event.GameEventGameStarted;
import forge.game.player.*;
import forge.gui.GuiBase;
import forge.localinstance.properties.ForgePreferences.FPref;
import forge.model.FModel;
import forge.util.MyRandom;
import java.lang.reflect.Method;
import java.util.*;

/** Exercises the actual pinned Forge starting-player path, not a browser fixture. */
public final class NativeStartingPlayerChecks {
    static void check(boolean value,String label){if(!value)throw new AssertionError(label);}
    public static void main(String[] args)throws Exception {
        String root=System.getProperty("proof.root");
        GuiBase.setInterface(new GuiDesktop(){@Override public String getAssetsDir(){return root+"/forge/forge-gui/";}});
        FModel.initialize(null,p->{p.setPref(FPref.USE_SENTRY,false);p.setPref(FPref.DECKGEN_CARDBASED,false);return null;});
        check(NativeStartingPlayer.parse(new JsonObject())==null,"legacy input unchanged");
        for(String bad:List.of("{\"startingPlayer\":\"first\"}","{\"playStyle\":\"practice\"}","{\"startingPlayer\":\"first\",\"playStyle\":\"quick\"}","{\"startingPlayer\":true,\"playStyle\":\"practice\"}","{\"startingPlayer\":\"later\",\"playStyle\":\"practice\"}")){
            boolean rejected=false;try{NativeStartingPlayer.parse(JsonParser.parseString(bad).getAsJsonObject());}catch(IllegalArgumentException e){rejected=true;}check(rejected,"invalid preference rejected");
        }
        Method determine=GameAction.class.getDeclaredMethod("determineFirstTurnPlayer",GameOutcome.class);determine.setAccessible(true);
        Set<Boolean> randomHuman=new HashSet<>();int cases=0;
        for(String selection:List.of("random","first","second")){
            NativeStartingPlayer preference=new NativeStartingPlayer(selection,selection.equals("random")?"quick":"practice");
            LobbyPlayerAi ai=new LobbyPlayerAi("CPU",null);ai.setAiProfile("Default");ai=preference.aiLobby(ai);
            var h=new RegisteredPlayer(new Deck("human")).setPlayer(preference.humanLobby("Human"));
            var o=new RegisteredPlayer(new Deck("opponent")).setPlayer(ai);
            Game game=new Match(new GameRules(GameType.Constructed),List.of(h,o),"Native start fixture").createGame();
            Player human=game.getPlayers().get(0),opponent=game.getPlayers().get(1);
            // Direct controller calls exercise either native coin winner, so a
            // preference cannot accidentally work only after one toss result.
            for(Player winner:List.of(human,opponent)){
                Player result=winner.getController().chooseStartingPlayer(true);
                check(result==(selection.equals("random")?winner:selection.equals("first")?human:opponent),"either winning controller follows preference");cases++;
            }
            // Actual GameAction uses native RNG and its usual controller boundary.
            // Avoid blocking its unrelated await-next-input notification by using
            // the bridge's supported ProtocolGuiGame transport for the human.
            ForgeHttpBridge bridge=new ForgeHttpBridge();bridge.game=game;bridge.controller=(forge.player.PlayerControllerHuman)human.getController();bridge.viewer=human.getView();bridge.startingPlayer=preference;
            bridge.gui=new forge.gamemodes.net.ProtocolGuiGame(bridge);bridge.controller.setGui(bridge.gui);bridge.gui.setGameView(game.getView());
            for(int seed=1;seed<=16;seed++){
                MyRandom.setRandom(new Random(seed*100000L));
                Player result=(Player)determine.invoke(game.getAction(),new Object[]{null});
                if(selection.equals("random"))randomHuman.add(result==human);
                else check(result==(selection.equals("first")?human:opponent),"actual Forge start honors practice selection");cases++;
            }
            Player actual=selection.equals("second")?opponent:human;
            bridge.onGameStarted(new GameEventGameStarted(GameType.Constructed,actual,game.getPlayers()));
            check(bridge.pregame.get("firstPlayerId").equals(actual.getId()),"receipt records native event seat");
            check(bridge.pregame.get("selection").equals(selection),"receipt binds request selection");
            var receipt=bridge.pregame;
            bridge.onGameStarted(new GameEventGameStarted(GameType.Constructed,actual==human?opponent:human,game.getPlayers()));
            check(bridge.pregame==receipt,"opening receipt never rerolls");
        }
        check(randomHuman.size()==2,"native random reaches both first seats");
        System.out.println("NATIVE_STARTING_PLAYER PASS cases="+cases+"; native RNG, both controllers, strict input and immutable receipt");
        System.exit(0);
    }
}
