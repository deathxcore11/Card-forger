package cardstashy.forge;
import forge.GuiDesktop;import forge.gui.GuiBase;import forge.model.FModel;import forge.localinstance.properties.ForgePreferences.FPref;import forge.StaticData;import java.nio.file.*;import java.util.*;
public final class NativeFormatCatalogAudit {
 public static void main(String[]args)throws Exception{
  String root=System.getProperty("proof.root");GuiBase.setInterface(new GuiDesktop(){@Override public String getAssetsDir(){return root+"/forge/forge-gui/";}});FModel.initialize(null,p->{p.setPref(FPref.USE_SENTRY,false);p.setPref(FPref.DECKGEN_CARDBASED,false);return null;});
  Map<String,Object> out=new TreeMap<>();for(var card:StaticData.instance().getCommonCards().getAllCards())if(!out.containsKey(card.getRules().getName()))out.put(card.getRules().getName(),Map.of("standard",NativeMatchFormat.Standard.pool().getFilterRules().test(card),"modern",NativeMatchFormat.Modern.pool().getFilterRules().test(card)));
  Files.writeString(Path.of(args[0]),NativeDeckInput.JSON.toJson(out));System.out.println("Native format predicate audit rows="+out.size());System.exit(0);
 }
}
