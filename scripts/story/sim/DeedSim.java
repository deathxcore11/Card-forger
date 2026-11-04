import cardstashy.forge.HeadlessGui;
import forge.LobbyPlayer;
import forge.StaticData;
import forge.deck.Deck;
import forge.game.*;
import forge.game.card.*;
import forge.game.combat.Combat;
import forge.game.event.GameEvent;
import forge.game.player.Player;
import forge.game.player.RegisteredPlayer;
import forge.game.zone.ZoneType;
import forge.gui.GuiBase;
import forge.localinstance.properties.ForgePreferences.FPref;
import forge.model.FModel;
import forge.player.GamePlayerUtil;
import com.google.common.eventbus.Subscribe;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;

/** Deed measurement (story-deeds.js): Forge self-play that prints what a table viewer would see.
 *  java DeedSim <forgeRoot> <games> <hero.txt> <villain.txt> [...pairs]
 *  Prints "P <pair>" per pair, "S <game> <surface json>" whenever the public board changes, and
 *  "G <game> {winner,heroFirst}" when a game ends. Seat 0 is always the hero (A), seat 1 the villain.
 *  scripts/story/sim/deed-facts.mjs turns the stream into match-facts.js facts for both seats. */
public final class DeedSim {
  static Deck load(Path p) throws Exception {
    Deck d = new Deck(p.getFileName().toString());
    for (String line : Files.readAllLines(p)) {
      if (line.isBlank()) continue;
      String[] f = line.split("\\|");
      d.getMain().add(f[1].trim(), f[2].trim().toUpperCase(), Integer.parseInt(f[0].trim()));
    }
    return d;
  }
  static String q(String s) { return s == null ? "null" : "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }

  static final class Watch {
    final Game game; final Player a; final int g; String last = "";
    Watch(Game game, Player a, int g) { this.game = game; this.a = a; this.g = g; }
    int seat(Player p) { return p == a ? 0 : 1; }
    @Subscribe public void on(GameEvent e) { try { snap(); } catch (Throwable t) { /* a mid-change board is skipped */ } }
    void snap() {
      StringBuilder b = new StringBuilder();
      var ph = game.getPhaseHandler();
      b.append("{\"turn\":").append(ph.getTurn()).append(",\"activeSeat\":").append(ph.getPlayerTurn() == null ? "null" : String.valueOf(seat(ph.getPlayerTurn()))).append(",\"players\":[");
      List<Player> ps = new ArrayList<>(game.getRegisteredPlayers()); ps.sort(Comparator.comparingInt(this::seat));
      for (int i = 0; i < ps.size(); i++) { Player p = ps.get(i); if (i > 0) b.append(',');
        b.append("{\"seat\":").append(seat(p)).append(",\"life\":").append(p.getLife()).append(",\"handCount\":").append(p.getCardsIn(ZoneType.Hand).size())
         .append(",\"libraryCount\":").append(p.getCardsIn(ZoneType.Library).size()).append(",\"counters\":{\"POISON\":").append(p.getPoisonCounters()).append("}}"); }
      b.append("],\"cards\":[");
      Combat combat = game.getCombat(); boolean first = true;
      for (ZoneType z : new ZoneType[]{ZoneType.Battlefield, ZoneType.Graveyard, ZoneType.Exile}) for (Card c : game.getCardsIn(z)) {
        if (!first) b.append(','); first = false;
        boolean known = !c.isFaceDown();
        b.append("{\"id\":").append(c.getId()).append(",\"zone\":\"").append(z.name()).append("\",\"owner\":").append(seat(c.getOwner())).append(",\"controller\":").append(seat(c.getController()))
         .append(",\"known\":").append(known);
        if (known) {
          b.append(",\"name\":").append(q(c.getName())).append(",\"type\":").append(q(c.getType().toString())).append(",\"types\":[");
          List<String> t = new ArrayList<>(); if (c.isCreature()) t.add("Creature"); if (c.isLand()) t.add("Land"); if (c.isArtifact()) t.add("Artifact"); if (c.isEnchantment()) t.add("Enchantment"); if (c.isPlaneswalker()) t.add("Planeswalker");
          for (int i = 0; i < t.size(); i++) b.append(i > 0 ? "," : "").append(q(t.get(i)));
          b.append("],\"power\":").append(c.isCreature() ? c.getNetPower() : 0).append(",\"flying\":").append(c.isCreature() && c.hasKeyword(forge.game.keyword.Keyword.FLYING));
        }
        b.append(",\"isToken\":").append(c.isToken()).append(",\"attacking\":").append(combat != null && combat.isAttacking(c))
         .append(",\"attachments\":[").append(String.join(",", Collections.nCopies(c.getAttachedCards().size(), "0"))).append("]")
         .append(",\"counters\":{\"P1P1\":").append(c.getCounters(CounterEnumType.P1P1)).append(",\"TIME\":").append(c.getCounters(CounterEnumType.TIME)).append("}}");
      }
      b.append("]}");
      String s = b.toString();
      if (!s.equals(last)) { last = s; System.out.println("S " + g + " " + s); }
    }
  }

  public static void main(String[] a) throws Exception {
    String root = a[0]; int games = Integer.parseInt(a[1]);
    System.setProperty("java.awt.headless", "true");
    GuiBase.setInterface(new HeadlessGui(root + "/forge/forge-gui/"));
    FModel.initialize(null, prefs -> { prefs.setPref(FPref.USE_SENTRY, false); prefs.setPref(FPref.UI_ENABLE_AI_CHEATS, false); return null; });
    ExecutorService ex = Executors.newSingleThreadExecutor(r -> { Thread t = new Thread(r); t.setDaemon(true); return t; });
    long seed = Long.getLong("story.seed", 1L);
    for (int i = 2; i + 1 < a.length; i += 2) {
      Deck da = load(Paths.get(a[i])), db = load(Paths.get(a[i + 1]));
      System.out.println("P " + q(a[i]));
      for (int g = 0; g < games; g++) {
        forge.util.MyRandom.setRandom(new Random(seed * 1_000_003L + g));
        GameRules rules = new GameRules(GameType.Constructed); rules.setGamesPerMatch(1);
        LobbyPlayer A = GamePlayerUtil.createAiPlayer("A", 0), B = GamePlayerUtil.createAiPlayer("B", 1);
        List<RegisteredPlayer> ps = new ArrayList<>();
        RegisteredPlayer ra = new RegisteredPlayer(da).setPlayer(A), rb = new RegisteredPlayer(db).setPlayer(B);
        if (g % 2 == 0) { ps.add(ra); ps.add(rb); } else { ps.add(rb); ps.add(ra); }
        Match m = new Match(rules, ps, "story");
        Game game = m.createGame();
        Player pa = game.getRegisteredPlayers().stream().filter(p -> p.getLobbyPlayer() == A).findFirst().orElse(null);
        game.subscribeToEvents(new Watch(game, pa, g));
        Future<?> fut = ex.submit(() -> m.startGame(game));
        String winner = "null";
        try { fut.get(90, TimeUnit.SECONDS); GameOutcome o = game.getOutcome(); if (o != null && !o.isDraw()) winner = o.getWinningLobbyPlayer() == A ? "0" : "1"; }
        catch (TimeoutException t) { fut.cancel(true); game.setGameOver(GameEndReason.Draw); ex.shutdownNow(); ex = Executors.newSingleThreadExecutor(r -> { Thread th = new Thread(r); th.setDaemon(true); return th; }); }
        System.out.println("G " + g + " {\"winner\":" + winner + ",\"heroFirst\":" + (g % 2 == 0) + "}");
      }
    }
    System.exit(0);
  }
}
