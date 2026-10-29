#!/usr/bin/env python3
"""Copy the Forge host's bridge sources and make the few changes the phone needs.

The phone has no Swing and no com.sun.net.httpserver, and its classes are dex, not
.class files. Every other line of the bridge stays exactly as the host runs it.
Usage: port-bridge.py <host adapter src/cardstashy/forge dir> <output dir>
"""
import pathlib, re, sys

SOURCES = ['ForgeHttpBridge.java', 'BoundedHeuristicPolicy.java', 'NativeCpuPolicyIntegration.java',
           'NativeDeckAdmission.java', 'NativeDeckInput.java', 'NativeMatchFormat.java',
           'NativeRulesData.java', 'NativeStartingPlayer.java', 'NativeHumanPriorityProof.java',
           'NativePatchsetProof.java']

EDITS = {
    'ForgeHttpBridge.java': [
        ('import com.sun.net.httpserver.*;', 'import cardstashy.forge.http.*;', 1),
        ('import forge.GuiDesktop;\n', '', 1),
        ('import javax.swing.SwingUtilities;\n', '', 1),
        ('SwingUtilities.invokeLater(', 'HeadlessGui.edt(', None),
        ('GuiBase.setInterface(new GuiDesktop() {\n            @Override public String getAssetsDir(){ return root+"/forge/forge-gui/"; }\n        });',
         'GuiBase.setInterface(new HeadlessGui(root+"/forge/forge-gui/"));', 1),
    ],
    # Dex has no .class resources: check the reviewed overlay bytes shipped beside the engine.
    'NativeHumanPriorityProof.java': [
        ('NativeHumanPriorityProof.class.getClassLoader().getResourceAsStream(entry.getKey())',
         'java.nio.file.Files.newInputStream(human.resolve("runtime-classes").resolve(entry.getKey()))', 1),
    ],
    'NativePatchsetProof.java': [
        ('NativePatchsetProof.class.getClassLoader().getResourceAsStream(e.getKey())',
         'java.nio.file.Files.newInputStream(java.nio.file.Paths.get(System.getProperty("proof.root"),"cpu","runtime-classes",e.getKey()))', 1),
    ],
}

# Applied to every file: Android before 14 lacks these Java 11-17 calls (see Jdk.java).
COMMON = [
    ('HexFormat.of().formatHex(', 'Jdk.hex('),
    ('stream.readAllBytes()', 'Jdk.readAll(stream)'),
    ('in.readNBytes(limit+1)', 'Jdk.readN(in,limit+1)'),
    ('x.getRequestBody().readNBytes(16385)', 'Jdk.readN(x.getRequestBody(),16385)'),
]

def main(src, out):
    src, out = pathlib.Path(src), pathlib.Path(out)
    out.mkdir(parents=True, exist_ok=True)
    for name in SOURCES:
        text = (src / name).read_text()
        for old, new, count in EDITS.get(name, []):
            found = text.count(old)
            if found == 0 or (count is not None and found != count):
                raise SystemExit(f'{name}: expected {count or "some"} of {old[:60]!r}, found {found}')
            text = text.replace(old, new)
        for old, new in COMMON:
            text = text.replace(old, new)
        text = re.sub(r'(?<![\w.])Path\.of\(', 'java.nio.file.Paths.get(', text)
        for banned in (r'javax\.swing', 'GuiDesktop', r'com\.sun\.net', r'HexFormat\.', r'(?<!Files)\.readAllBytes\(', r'\.readNBytes\(', r'\bPath\.of\('):
            if re.search(banned, text):
                raise SystemExit(f'{name}: still uses {banned}')
        (out / name).write_text(text)
    print('PORTED', len(SOURCES), 'bridge sources')

if __name__ == '__main__':
    main(*sys.argv[1:])
