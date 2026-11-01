package cardstashy.forge;
import com.google.gson.*;import java.nio.file.*;import java.util.*;
/** Startup-only strict integration of the beta policies (Monte Carlo only for Hard, per player). */
public final class NativeCpuPolicyIntegration {
 public static final String CLASS_SET_SHA="e39ea6388050f31319b121c0605fde23069d35e7133a203fd19f0a6c72528f80";
 private static Map<String,Object> buildReceipt;
 private static final Map<String,String> PROFILE_HASHES=Map.of(
  "CardStashyEasyBetaV2","d82667a247770630b2b265004d8d39052e273b152686d9662c2c5c72369bc78d",
  "CardStashyMediumBetaV1","d77ec318868fcdb8fe1dce8d8c2df336fe26d54e13b51f7aab13d259bdf70330",
  "CardStashyHardBetaV2","09bdcc6003785a0abf08fde556c963d22a697b5309e5011dc6f39fefba97e63d");
 public static synchronized void install(String root)throws Exception{
  if(buildReceipt!=null)return;
  Path cpu=Path.of(root,"cpu");byte[] index=NativeRulesData.boundedRead(cpu.resolve("runtime-sha256.json"),65536);
  if(!NativeRulesData.hash(index).equals(CLASS_SET_SHA))throw new IllegalStateException("native_ai_class_manifest_mismatch");
  byte[] artifact=NativeRulesData.boundedRead(cpu.resolve("build-attestation.json"),131072);JsonObject a=JsonParser.parseString(new String(artifact,java.nio.charset.StandardCharsets.UTF_8)).getAsJsonObject();
  if(!"cardstashy.native-ai-build-attestation.v1".equals(a.get("schema").getAsString())||!ForgeHttpBridge.REV.equals(a.get("forgeRevision").getAsString())||!CLASS_SET_SHA.equals(a.get("classSetSha256").getAsString())||!ForgeHttpBridge.exactBoolean(a.get("actualCompilerBytecodeMatchesReviewed"),"actualCompilerBytecodeMatchesReviewed")||ForgeHttpBridge.exactInt(a.get("classCount"),"classCount")!=12||!a.get("classes").equals(JsonParser.parseString(new String(index,java.nio.charset.StandardCharsets.UTF_8))))throw new IllegalStateException("native_ai_build_attestation_mismatch");
  // Verifies actual classpath bytes, not merely this build file or a claimed compiler version.
  BoundedHeuristicPolicy.installProfiles(Path.of(root,"forge/forge-gui/res/ai/Default.ai"),Path.of(root,"adapter/cpu-profiles"));
  for(var policy:BoundedHeuristicPolicy.values())if(!PROFILE_HASHES.get(policy.profile).equals(policy.receipt().get("profileSha256")))throw new IllegalStateException("native_ai_profile_hash_mismatch");
  buildReceipt=NativeDeckInput.map("runtimeClassSetSha256",CLASS_SET_SHA,"nativeBuildAttestationSha256",NativeRulesData.hash(artifact),"buildCompilerVersion",ForgeHttpBridge.exactString(a.get("javacVersion"),"javacVersion"),"runtimeJavaVersion",System.getProperty("java.runtime.version"),"runtimeBytecodeVerified",true);
 }
 public static BoundedHeuristicPolicy parse(String version){return BoundedHeuristicPolicy.parseVersion(version);}
 public static Map<String,Object> receipt(BoundedHeuristicPolicy policy){
  if(buildReceipt==null)throw new IllegalStateException("native_ai_profiles_not_initialized");
  Map<String,Object> out=new LinkedHashMap<>(policy.receipt());out.putAll(buildReceipt);out.put("runtimeSettingsVerified",false);return out;
 }
 public static void verifyRuntime(NativeDeckAdmission.Admission admission,BoundedHeuristicPolicy policy,forge.game.Game game){
  // Each CPU seat keeps its own level: the first CPU uses the match level, extra pod seats theirs.
  List<BoundedHeuristicPolicy> seats=new ArrayList<>();seats.add(policy);if(admission!=null)seats.addAll(admission.extraPolicies());
  // A friend match has no CPU seat at all.
  if(admission!=null&&admission.humanOpponent())seats.clear();
  int aiPlayers=0;
  for(var p:game.getPlayers())if(p.getController() instanceof forge.ai.PlayerControllerAi){if(aiPlayers>=seats.size())throw new IllegalStateException("expected_one_native_cpu_per_seat");seats.get(aiPlayers).apply(p);aiPlayers++;}
  if(aiPlayers!=seats.size())throw new IllegalStateException("expected_one_native_cpu_per_seat");
  var prefs=forge.model.FModel.getPreferences();
  if(game.getRules().isAllowCheatShuffle()||game.AI_FLAT_MONTE_CARLO||game.AI_FLAT_MONTE_CARLO_MAX||game.AI_TIMEOUT!=5||prefs.getPrefBoolean(forge.localinstance.properties.ForgePreferences.FPref.UI_ENABLE_AI_CHEATS)||prefs.getPrefBoolean(forge.localinstance.properties.ForgePreferences.FPref.FILTERED_HANDS)||prefs.getPrefBoolean(forge.localinstance.properties.ForgePreferences.FPref.MATCH_AI_FLAT_MONTE_CARLO))throw new IllegalStateException("native_ai_global_policy_mismatch");
  if(admission!=null){
   @SuppressWarnings("unchecked") Map<String,Object> receipt=(Map<String,Object>)admission.receipt().get("cpuPolicy");
   receipt.put("runtimeSettingsVerified",true);
   // This descendant's native integration is explicitly bounded experimental admission.
   // It is not a claim that the host watchdog/cleanup or arbitrary-card fairness is certified.
   receipt.put("admissionAllowed",true);receipt.put("admissionScope","bounded-experimental-native-integration");
   admission.receipt().put("cpuPolicyRuntimeVerified",true);
  }
 }
}
