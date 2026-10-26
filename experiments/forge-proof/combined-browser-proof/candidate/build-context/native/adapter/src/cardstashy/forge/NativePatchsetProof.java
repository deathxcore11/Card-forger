package cardstashy.forge;
import java.security.MessageDigest;
import java.util.*;
/** Exact local review artifact check, not a portable recompile identity. */
public final class NativePatchsetProof {
 private NativePatchsetProof() {}
 private static final Map<String,String> EXPECTED=Map.ofEntries(
        Map.entry("forge/ai/PlayerControllerAi$1.class","6e396c21db6228a000bac003726f223f04e8b1860503db64ab6343ebfa5c6e1c"),
        Map.entry("forge/ai/ComputerUtilCard$LandEvaluator.class","819571a37325e551fd395a2501ff11e22cb1b0064add84d167d7ac97355fb5b6"),
        Map.entry("forge/ai/ObservedLethalCounterGuard.class","e420ca7417b0f49c41cec8a61890c3498414020c9f5d3ee1bcfabe0975b707f7"),
        Map.entry("forge/ai/ComputerUtilCard.class","7b29a5ed4851605d7d86b2c9288ff135d2febad551e37e82c6083a561b11a0bf"),
        Map.entry("forge/ai/VisibleAiCards.class","b2df76be1581b1fb10f7709437dfcbe604c71a3cf4b4eed5ca625968963ca6ee"),
        Map.entry("forge/ai/PlayerControllerAi.class","50dc7193144e0b07f4ac504949a7e6b79afc7cd20f9dd5eb26c20f7e1f3829fa"),
        Map.entry("forge/ai/ObservedCardNames.class","a9321db6c885123c05466edb68d964b0dff3e0899ce84ed162e01e287b8b7e6f"),
        Map.entry("forge/ai/ability/CounterAi.class","5fda6b9b33138a8623240a7011a74bc256652addd6950ce179ede74a7aeec441"),
        Map.entry("forge/ai/ability/ClashAi.class","e05e42de92f4ecbcfa275e95a67ad7e3e1d02f34b3decf8f1b917d838227b122"),
        Map.entry("forge/ai/ability/ChangeZoneAi.class","8aa42da65e0cb938aeb8fc4bea42fd47ef0fc8cba6f9874f440bb4305cd6289c"),
        Map.entry("forge/ai/AiController.class","7553dccc74637a5f5cfaf5378530c2fcb45c6664d7f7415b858369529f475ccc"),
        Map.entry("forge/ai/AiController$1.class","8d9bd51689f8d29c514be4cf85ad12a6e9d6c13e4c08d293d2d8cfa7ac6c1426"));
 public static void verify() throws Exception {
  for(var e:EXPECTED.entrySet()) try(var stream=NativePatchsetProof.class.getClassLoader().getResourceAsStream(e.getKey())) {
   if(stream==null||!e.getValue().equals(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(stream.readAllBytes()))))
    throw new IllegalStateException("Required reviewed native AI bytecode mismatch: "+e.getKey());
  }
 }
 public static void main(String[] args)throws Exception {verify();System.out.println("NATIVE_PATCHSET_VERIFIED");}
}
