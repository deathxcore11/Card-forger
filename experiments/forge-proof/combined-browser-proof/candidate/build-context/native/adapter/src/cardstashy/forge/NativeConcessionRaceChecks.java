package cardstashy.forge;
import forge.*;import forge.gui.GuiBase;import forge.model.FModel;import forge.localinstance.properties.ForgePreferences.FPref;import forge.game.*;import forge.game.player.*;import forge.deck.*;import forge.player.*;import java.util.*;import java.util.concurrent.*;
/** Real native GameOutcome fixture: the terminal monitor's winner must not be overwritten. */
public final class NativeConcessionRaceChecks{
 public static void main(String[]args)throws Exception{
  String root=System.getProperty("proof.root");GuiBase.setInterface(new GuiDesktop(){@Override public String getAssetsDir(){return root+"/forge/forge-gui/";}});FModel.initialize(null,p->{p.setPref(FPref.USE_SENTRY,false);return null;});
  var human=new RegisteredPlayer(new Deck("terminal race A")).setPlayer(new LobbyPlayerHuman("A",0,0));var ai=new RegisteredPlayer(new Deck("terminal race B")).setPlayer(GamePlayerUtil.createAiPlayer("B",1,"Default"));
  ForgeHttpBridge b=new ForgeHttpBridge();b.game=new Match(new GameRules(GameType.Constructed),List.of(human,ai),"Native terminal race fixture").createGame();b.controller=(PlayerControllerHuman)b.game.getPlayers().get(0).getController();b.concessionRequested=true;
  Player opponent=b.game.getPlayers().get(1);CompletableFuture<Boolean> result=new CompletableFuture<>();CountDownLatch entered=new CountDownLatch(1);
  synchronized(b.game){
   Thread t=new Thread(()->{entered.countDown();try{result.complete(b.invokeNativeConcession());}catch(Throwable e){result.completeExceptionally(e);}});t.start();entered.await();
   opponent.concede();b.game.getAction().checkGameOverCondition();
   if(!b.game.isGameOver()||!b.game.getOutcome().isWinner(human))throw new AssertionError("native fixture did not produce original human win");
  }
  if(result.get(5,TimeUnit.SECONDS)||b.controller.getPlayer().conceded()||!b.game.getOutcome().isWinner(human))throw new AssertionError("late concede overwrote completed native result");
  System.out.println("PASS native terminal monitor race: original winner preserved, late concession not applied");System.exit(0);
 }
}
