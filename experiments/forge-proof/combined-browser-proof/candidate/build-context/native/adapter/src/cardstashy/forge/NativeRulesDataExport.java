package cardstashy.forge;
import forge.GuiDesktop;import forge.gui.GuiBase;import forge.model.FModel;import forge.localinstance.properties.ForgePreferences.FPref;import forge.StaticData;import forge.card.ICardFace;import java.nio.file.*;import java.util.*;
public final class NativeRulesDataExport {
 public static void main(String[]args)throws Exception{
  String root=System.getProperty("proof.root");GuiBase.setInterface(new GuiDesktop(){@Override public String getAssetsDir(){return root+"/forge/forge-gui/";}});FModel.initialize(null,p->{p.setPref(FPref.USE_SENTRY,false);p.setPref(FPref.DECKGEN_CARDBASED,false);return null;});
  Map<String,Object> rows=new TreeMap<>();for(var card:StaticData.instance().getCommonCards().getAllCards())if(!rows.containsKey(card.getRules().getName()))rows.put(card.getRules().getName(),Map.of("faces",card.getRules().getAllFaces().stream().map(ICardFace::getName).toList(),"faceProfiles",card.getRules().getAllFaces().stream().map(f->Map.of("name",f.getName(),"type",f.getType().toString(),"manaCost",f.getManaCost().toString())).toList(),"unsupported",card.getRules().isUnsupported(),"custom",card.getRules().isCustom()));
  Map<String,Object> defs=new TreeMap<>();for(var f:NativeMatchFormat.values())defs.put(f.name(),Map.of("definition",f.definition(),"digest",NativeDeckInput.digest(NativeDeckInput.JSON.toJsonTree(f.definition()))));
  Files.writeString(Path.of(args[0]),NativeDeckInput.JSON.toJson(Map.of("cards",rows,"formats",defs,"engineRevision",ForgeHttpBridge.REV)));System.out.println("Native rule identity rows="+rows.size());System.exit(0);
 }
}
