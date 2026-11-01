import cardstashy.forge.HeadlessGui;
import forge.LobbyPlayer;
import forge.StaticData;
import forge.deck.Deck;
import forge.game.*;
import forge.game.player.RegisteredPlayer;
import forge.gui.GuiBase;
import forge.item.PaperCard;
import forge.localinstance.properties.ForgePreferences.FPref;
import forge.model.FModel;
import forge.player.GamePlayerUtil;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;

/** Story mode deck check + Forge self-play (story-mode-acts.md D1 steps 4-5).
 *  java StorySim <forgeRoot> <games> <deckA.txt> <deckB.txt> [<deckA> <deckB> ...]
 *  Deck file lines: "qty|Card Name|SET". Prints one JSON line per pair. */
public final class StorySim {
  static Deck load(Path p, List<String> problems, List<String> aiWarn) throws Exception {
    Deck d = new Deck(p.getFileName().toString());
    for (String line : Files.readAllLines(p)) {
      if (line.isBlank()) continue;
      String[] f = line.split("\\|");
      int qty = Integer.parseInt(f[0].trim());
      String name = f[1].trim(), set = f[2].trim().toUpperCase();
      PaperCard pc = StaticData.instance().getCommonCards().getCard(name, set);
      if (pc == null) { problems.add("unknown:" + name + "@" + set); continue; }
      d.getMain().add(name, set, qty);
      var hints = pc.getRules().getAiHints();
      if (hints.getRemAIDecks()) aiWarn.add("RemoveDeck:All:" + name);
      else if (hints.getRemRandomDecks()) aiWarn.add("RemoveDeck:Random:" + name);
    }
    String conf = FModel.getFormats().get("Vintage").getDeckConformanceProblem(d);
    if (conf != null) problems.add("vintage:" + conf);
    String size = forge.deck.DeckFormat.Constructed.getDeckConformanceProblem(d);
    if (size != null) problems.add("constructed:" + size);
    return d;
  }
  static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static String arr(List<String> l) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < l.size(); i++) { if (i > 0) b.append(','); b.append(q(l.get(i))); } return b.append(']').toString(); }

  public static void main(String[] a) throws Exception {
    String root = a[0]; int games = Integer.parseInt(a[1]);
    System.setProperty("java.awt.headless", "true");
    GuiBase.setInterface(new HeadlessGui(root + "/forge/forge-gui/"));
    FModel.initialize(null, prefs -> { prefs.setPref(FPref.USE_SENTRY, false); prefs.setPref(FPref.UI_ENABLE_AI_CHEATS, false); return null; });
    ExecutorService ex = Executors.newSingleThreadExecutor(r -> { Thread t = new Thread(r); t.setDaemon(true); return t; });
    for (int i = 2; i + 1 < a.length; i += 2) {
      List<String> pa = new ArrayList<>(), pb = new ArrayList<>(), wa = new ArrayList<>(), wb = new ArrayList<>();
      Deck da = load(Paths.get(a[i]), pa, wa), db = load(Paths.get(a[i + 1]), pb, wb);
      int winA = 0, winB = 0, draw = 0, timeouts = 0, turns = 0;
      if (pa.isEmpty() && pb.isEmpty()) for (int g = 0; g < games; g++) {
        GameRules rules = new GameRules(GameType.Constructed); rules.setGamesPerMatch(1);
        LobbyPlayer A = GamePlayerUtil.createAiPlayer("A", 0), B = GamePlayerUtil.createAiPlayer("B", 1);
        List<RegisteredPlayer> ps = new ArrayList<>();
        // Alternate who sits first so play/draw evens out.
        RegisteredPlayer ra = new RegisteredPlayer(da).setPlayer(A), rb = new RegisteredPlayer(db).setPlayer(B);
        if (g % 2 == 0) { ps.add(ra); ps.add(rb); } else { ps.add(rb); ps.add(ra); }
        Match m = new Match(rules, ps, "story");
        Game game = m.createGame();
        Future<?> fut = ex.submit(() -> m.startGame(game));
        try { fut.get(90, TimeUnit.SECONDS); } catch (TimeoutException t) { fut.cancel(true); timeouts++; game.setGameOver(GameEndReason.Draw); ex.shutdownNow(); ex = Executors.newSingleThreadExecutor(r -> { Thread th = new Thread(r); th.setDaemon(true); return th; }); continue; }
        GameOutcome o = game.getOutcome();
        if (o == null || o.isDraw()) draw++;
        else if (o.getWinningLobbyPlayer() == A) winA++; else winB++;
        if (o != null) turns += o.getLastTurnNumber();
      }
      int played = winA + winB + draw;
      System.out.println("RESULT {\"a\":" + q(a[i]) + ",\"b\":" + q(a[i + 1]) + ",\"problemsA\":" + arr(pa) + ",\"problemsB\":" + arr(pb) + ",\"aiA\":" + arr(wa) + ",\"aiB\":" + arr(wb)
        + ",\"games\":" + played + ",\"winA\":" + winA + ",\"winB\":" + winB + ",\"draw\":" + draw + ",\"timeouts\":" + timeouts + ",\"avgTurns\":" + (played > 0 ? Math.round(turns * 10.0 / played) / 10.0 : 0) + "}");
    }
    System.exit(0);
  }
}
