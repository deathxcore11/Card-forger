/* SPDX-License-Identifier: GPL-3.0-or-later */
package cardstashy.forge;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Map;

/** Binds startup to the actually loaded human-only overlay and build receipt. */
public final class NativeHumanPriorityProof {
    public static final String SOURCE_MANIFEST = "808b643d01c0c8fe63344733725c77e8c504e1f566453386c6cbfc36c95e40bc";
    public static final String CLASS_MANIFEST = "89975e8a8bff75923f977c28ebd8341990744205c07cc3a504509c7d7647c1ee";
    private NativeHumanPriorityProof() {}

    public static Map<String,Object> verify(String root) throws Exception {
        Path human = Path.of(root, "human");
        byte[] indexBytes = NativeRulesData.boundedRead(human.resolve("runtime-sha256.json"), 65536);
        if (!CLASS_MANIFEST.equals(NativeRulesData.hash(indexBytes))) throw new IllegalStateException("human_priority_class_manifest_mismatch");
        JsonObject index = JsonParser.parseString(new String(indexBytes, StandardCharsets.UTF_8)).getAsJsonObject();
        byte[] receiptBytes = NativeRulesData.boundedRead(human.resolve("build-attestation.json"), 131072);
        JsonObject receipt = JsonParser.parseString(new String(receiptBytes, StandardCharsets.UTF_8)).getAsJsonObject();
        if (!"cardstashy.human-affordability-build.v1".equals(receipt.get("schema").getAsString())
                || !ForgeHttpBridge.REV.equals(receipt.get("forgeRevision").getAsString())
                || !SOURCE_MANIFEST.equals(receipt.get("sourceManifestSha256").getAsString())
                || !CLASS_MANIFEST.equals(receipt.get("classManifestSha256").getAsString())
                || !ForgeHttpBridge.exactBoolean(receipt.get("actualCompilerBytecodeMatchesReviewed"), "actualCompilerBytecodeMatchesReviewed")
                || !index.equals(receipt.get("classes"))) throw new IllegalStateException("human_priority_build_attestation_mismatch");
        for (var entry : index.entrySet()) {
            try (var stream = NativeHumanPriorityProof.class.getClassLoader().getResourceAsStream(entry.getKey())) {
                if (stream == null || !entry.getValue().getAsString().equals(NativeRulesData.hash(stream.readAllBytes()))) {
                    throw new IllegalStateException("human_priority_runtime_bytecode_mismatch:" + entry.getKey());
                }
            }
        }
        return NativeDeckInput.map("schema", "cardstashy.human-priority-receipt.v1",
                "sourceManifestSha256", SOURCE_MANIFEST, "classManifestSha256", CLASS_MANIFEST,
                "buildAttestationSha256", NativeRulesData.hash(receiptBytes), "runtimeBytecodeVerified", true,
                "assessment", "bounded-human-feasibility-tristate-v1", "uncertaintyPreservesPriority", true);
    }

    public static void main(String[] args) throws Exception {
        verify(args[0]); System.out.println("HUMAN_PRIORITY_RUNTIME_VERIFIED");
    }
}
