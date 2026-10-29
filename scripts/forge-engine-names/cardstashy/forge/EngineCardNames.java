package cardstashy.forge;
import com.google.gson.JsonObject;
import forge.StaticData;
import forge.card.CardRules;
import forge.card.ICardFace;
import forge.gui.GuiBase;
import forge.item.PaperCard;
import forge.model.FModel;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
/** Lists every card name the bundled Forge accepts in a deck: each card's name, its
 * face names and "Face // Face", kept only when NativeDeckInput.resolveCard (the same
 * call that refused "Wear/Tear") resolves it to exactly one card. */
public final class EngineCardNames {
  public static void main(String[] a) throws Exception {
    String root=a[0];
    System.setProperty("proof.root",root);System.setProperty("java.awt.headless","true");
    GuiBase.setInterface(new HeadlessGui(root+"/forge/forge-gui/"));
    FModel.initialize(null,p->null);
    TreeSet<String> names=new TreeSet<>();
    for(PaperCard c:StaticData.instance().getCommonCards().getUniqueCards()){
      CardRules r=c.getRules();names.add(r.getName());
      List<String> faces=new ArrayList<>();for(ICardFace f:r.getAllFaces())if(f!=null)faces.add(f.getName());
      names.addAll(faces);if(faces.size()>1)names.add(String.join(" // ",faces));
    }
    int refused=0;
    try(PrintStream out=new PrintStream(new FileOutputStream(a[1]),true,StandardCharsets.UTF_8)){
      for(String n:names){
        JsonObject row=new JsonObject();row.addProperty("name",n);
        try{NativeDeckInput.resolveCard(row);out.print(n+"\n");}catch(RuntimeException e){refused++;System.err.println("left out: "+e.getMessage());}
      }
    }
    System.err.println((names.size()-refused)+" names accepted, "+refused+" left out");
  }
}
