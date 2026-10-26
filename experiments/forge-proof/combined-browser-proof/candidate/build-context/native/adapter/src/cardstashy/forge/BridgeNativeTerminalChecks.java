package cardstashy.forge;
import forge.gamemodes.net.*;import forge.gamemodes.net.event.*;import java.util.*;
/** No game rules: verifies terminal unwind never invents a native option. */
public final class BridgeNativeTerminalChecks {
 public static void main(String[]args){
  ForgeHttpBridge b=new ForgeHttpBridge();b.concessionRequested=true;b.concessionThread=Thread.currentThread();
  Object ack=b.sendAndWait(new GuiGameEvent(ProtocolMethod.getChoices,"Native end-game reveal",-1,-1,List.of("shown item"),List.of(),null));
  if(!ack.equals(List.of())||b.pending!=null)throw new AssertionError("reveal acknowledgment invented choice");
  try{b.sendAndWait(new GuiGameEvent(ProtocolMethod.getChoices,"Required choice",1,1,List.of("one"),List.of(),null));throw new AssertionError("invented mandatory answer");}catch(IllegalStateException expected){if(!expected.getMessage().startsWith("unsupported_dialog_during_native_concession"))throw expected;}
  b.concessionThread=null;b.nativeOutcomeConfirmed=true;b.concessionTerminal.complete(null);
  try{b.sendAndWait(new GuiGameEvent(ProtocolMethod.getChoices,"Late choice",1,1,List.of("one"),List.of(),null));throw new AssertionError("postgame option returned");}catch(ForgeHttpBridge.NativeMatchEnded expected){}
  b.recordFailure(new ForgeHttpBridge.NativeMatchEnded());if(b.failure!=null)throw new AssertionError("confirmed terminal abort became failure");
  System.out.println("PASS native terminal signaling: display-only acknowledgment, mandatory choice fail-closed, no late fabricated answer");
 }
}
