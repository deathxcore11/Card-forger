package cardstashy.forge;
import forge.*;import forge.gui.GuiBase;import forge.model.FModel;import forge.localinstance.properties.ForgePreferences.FPref;
import forge.game.*;import forge.game.player.*;import forge.game.card.*;import forge.game.combat.*;import forge.game.phase.*;import forge.game.zone.*;import forge.deck.*;import forge.player.*;import forge.gamemodes.match.input.*;import java.util.*;
/** Explicit native-state fixture, not a simulated match or replacement combat rules. */
public final class NativeAffordanceChecks {
 static void check(boolean b,String m){if(!b)throw new AssertionError(m);System.out.println("PASS "+m);}
 static Card creature(String name,Player owner){Card c=Card.fromPaperCard(StaticData.instance().getCommonCards().getCard(name),owner);owner.getZone(ZoneType.Battlefield).add(c);c.setSickness(false);return c;}
 static final class Attack extends InputAttack{Attack(PlayerControllerHuman c,Player p,Combat combat){super(c,p,combat);}List<CardView> candidates(){return getActionable();}}
 static final class Block extends InputBlock{Block(PlayerControllerHuman c,Player p,Combat combat){super(c,p,combat);}List<CardView> candidates(){return getActionable();}}
 public static void main(String[]args){
  String root=System.getProperty("proof.root");GuiBase.setInterface(new GuiDesktop(){@Override public String getAssetsDir(){return root+"/forge/forge-gui/";}});
  FModel.initialize(null,p->{p.setPref(FPref.USE_SENTRY,false);p.setPref(FPref.UI_SHOW_ACTIONABLE_HIGHLIGHTS,true);p.setPref(FPref.UI_SHOW_AUTOTAP_PREVIEW,true);return null;});
  var a=new RegisteredPlayer(new Deck("native predicate fixture A")).setPlayer(new LobbyPlayerHuman("A",0,0));var b=new RegisteredPlayer(new Deck("native predicate fixture B")).setPlayer(GamePlayerUtil.createAiPlayer("B",1,"Default"));
  Game game=new Match(new GameRules(GameType.Constructed),List.of(a,b),"Native affordance fixture").createGame();Player human=game.getPlayers().get(0),opponent=game.getPlayers().get(1);PlayerControllerHuman controller=(PlayerControllerHuman)human.getController();
  game.getPhaseHandler().devModeSet(PhaseType.COMBAT_DECLARE_ATTACKERS,human,false,3);
  Card angel=creature("Serra Angel",human),lion=creature("Silvercoat Lion",human),wall=creature("Wall of Omens",human);Combat combat=new Combat(human);Attack attack=new Attack(controller,human,combat);
  check(attack.candidates().containsAll(List.of(angel.getView(),lion.getView()))&&!attack.candidates().contains(wall.getView()),"native attacker highlights include eligible creatures and exclude defender");
  lion.setTapped(true);check(!attack.candidates().contains(lion.getView()),"native attacker highlight excludes tapped creature");lion.setTapped(false);lion.setSickness(true);check(!attack.candidates().contains(lion.getView()),"native attacker highlight excludes summoning sickness");lion.setSickness(false);
  combat.addAttacker(angel,opponent);check(!attack.candidates().contains(angel.getView()),"native attacker highlight removes already declared attacker");
  game.getPhaseHandler().devModeSet(PhaseType.COMBAT_DECLARE_BLOCKERS,opponent,false,4);Card drake=creature("Wind Drake",opponent);Combat defense=new Combat(opponent);defense.addAttacker(drake,human);Block block=new Block(controller,human,defense);
  check(block.candidates().contains(angel.getView())&&!block.candidates().contains(lion.getView())&&!block.candidates().contains(wall.getView()),"native blocker highlights respect actual flying attacker");
  angel.setTapped(true);check(block.candidates().isEmpty(),"native blocker highlights exclude tapped legal blocker");angel.setTapped(false);
  controller.getYieldController().setPref(FPref.UI_SHOW_ACTIONABLE_HIGHLIGHTS,"false");check(attack.candidates().isEmpty()&&block.candidates().isEmpty(),"native preference disables both combat affordances");
  System.out.println("PASS native attacker/blocker predicate fixture; no handwritten legal enumeration");System.exit(0);
 }
}
