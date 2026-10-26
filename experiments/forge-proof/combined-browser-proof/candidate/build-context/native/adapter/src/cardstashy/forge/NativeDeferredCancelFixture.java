package cardstashy.forge;

import forge.GuiDesktop;
import forge.gui.GuiBase;
import forge.gui.control.GameEventForwarder;
import forge.model.FModel;
import forge.localinstance.properties.ForgePreferences.FPref;
import forge.game.*;
import forge.game.player.*;
import forge.player.*;
import forge.gamemodes.net.ProtocolGuiGame;
import forge.util.MyRandom;
import java.nio.file.*;
import java.util.*;

/** Native test fixture for the standard GUI-player-only floating-mana warning; no custom rules or HTTP test hook. */
public final class NativeDeferredCancelFixture {
    public static void main(String[] args)throws Exception {
        String root=System.getProperty("proof.root");System.setProperty("java.awt.headless","true");
        GuiBase.setInterface(new GuiDesktop(){@Override public String getAssetsDir(){return root+"/forge/forge-gui/";}});
        FModel.initialize(null,p->{p.setPref(FPref.USE_SENTRY,false);p.setPref(FPref.PLAYER_NAME,"CardStashy");p.setPref(FPref.UI_MANA_LOST_PROMPT,true);p.setPref(FPref.YIELD_AUTO_PASS_NO_ACTIONS,false);p.setPref(FPref.YIELD_DECLINE_SCOPE_STACK_YIELD,"NEVER");p.setPref(FPref.YIELD_DECLINE_SCOPE_NO_ACTIONS,"NEVER");return null;});
        MyRandom.setRandom(new Random(20261025));
        ForgeHttpBridge b=new ForgeHttpBridge();b.humanDeckAlias="keen-engineering";b.aiDeckAlias="reign-of-dragons";b.actualAiProfile="Default";
        var humanLobby=GamePlayerUtil.getGuiPlayer();humanLobby.setAvatarIndex(0);humanLobby.setSleeveIndex(0);
        var human=RegisteredPlayer.forCommander(ForgeHttpBridge.loadDeck(root,b.humanDeckAlias)).setPlayer(humanLobby);
        var ai=RegisteredPlayer.forCommander(ForgeHttpBridge.loadDeck(root,b.aiDeckAlias)).setPlayer(GamePlayerUtil.createAiPlayer("Forge AI",1,"Default"));
        var rules=new GameRules(GameType.Commander);rules.setAppliedVariants(EnumSet.of(GameType.Commander));rules.setGamesPerMatch(1);rules.setAllowCheatShuffle(false);
        Match match=new Match(rules,List.of(human,ai),"Native deferred-cancel fixture");b.game=match.createGame();
        b.controller=(PlayerControllerHuman)b.game.getPlayers().get(0).getController();b.viewer=b.controller.getPlayer().getView();
        b.gui=new ProtocolGuiGame(b);b.controller.setGui(b.gui);b.gui.setGameView(b.game.getView());b.gui.setOriginalGameController(b.viewer,b.controller);
        GameEventForwarder forwarder=new GameEventForwarder(b.gui);b.gui.setForwarder(forwarder);b.game.subscribeToEvents(forwarder);b.game.subscribeToEvents(b.controller.getYieldController());b.controller.getInputQueue().addObserver(forwarder);
        for(Player p:b.game.getPlayers())p.updateOpponentsForView();
        b.serve(8765);Files.writeString(Path.of(root,"adapter/connection.json"),ForgeHttpBridge.JSON.toJson(ForgeHttpBridge.obj("baseUrl","http://127.0.0.1:8765","token",b.token)));
        new Thread(()->{try{match.startGame(b.game);forwarder.flush();b.finished=true;b.refreshBoard();b.publish();}catch(Throwable t){b.failure=t.toString();t.printStackTrace();b.publish();}},"native-fixture-game").start();
    }
}
