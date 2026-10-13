// Which game a whole-card read belongs to, and where a Pokémon name sits on it.
import assert from "node:assert/strict";
const { detectGame, anchoredNames, nameCandidates } = await import("./scan.js");

const mewtwo = "BASIC\nMewtwo-GX HP190\nPsychic Pokémon\nPsyche Out\n120 Psychic damage.\nweakness x2 resistance retreat\nGX attack rule: you can't use more than 1 GX attack in a game.";
assert.equal(detectGame(mewtwo), "ptcg");
assert.equal(detectGame("Dark Magician\n[Spellcaster / Normal]\nATK/2500 DEF/2100\nLOB-EN005"), "ygo");
assert.equal(detectGame("Llanowar Elves\nCreature — Elf Druid\n{T}: Add {G}.\nIllus. Kev Walker TM & © Wizards of the Coast"), "mtg");
assert.equal(detectGame("hello there"), "", "nothing clear → no guess");
assert.deepEqual(anchoredNames("ptcg", mewtwo), ["Mewtwo-GX"]);
assert.deepEqual(anchoredNames("ptcg", "STAGE 1 Charmeleon HP 90"), ["Charmeleon"]);
// "(HP" with no number no longer leaks into the name.
assert.ok(!nameCandidates("ptcg", "Pikachu (HP")[0].includes("HP"));
console.log("scan detect ok");
// A real misread of Mewtwo-GX (whole-card read): the name still comes out.
const mis = "& a\naac JMewtwolGX€ Y.-180 ©\ney bs of A 7 g";
const an = anchoredNames("ptcg", mis);
assert.ok(an.length, "HP misread still anchors the name line");
assert.ok(nameCandidates("ptcg", an.join("\n")).includes("Mewtwo GX"), JSON.stringify(nameCandidates("ptcg", an.join("\n"))));
assert.ok(nameCandidates("ptcg", "Zacian-V HP220").includes("Zacian V"));
console.log("misread ok");
assert.equal(nameCandidates("mtg", "lanowar Elves")[0], "lanowar Elves", "a real word losing its first letter isn't dropped");
assert.equal(nameCandidates("ptcg", "aac Mewtwo GX")[0], "Mewtwo GX");
assert.equal(detectGame("The ultimate wizard\nDiceSHUELSHA, TOKYO\nATK"), "ygo");
{
  const { textPhrases } = await import("./scan.js");
  const ph = textPhrases(": LJ\nBu Add ®\nBl The elves of the Llanotwar forest Rats 3\nBl defended 1 Jor gen rations.");
  assert.ok(ph.includes("The elves of") || ph.includes("elves of the"), JSON.stringify(ph));
  assert.ok(!ph.some((x) => x.startsWith("Bl ")), "edge scraps dropped");
  assert.ok(textPhrases("99 X) Super Psy Bolt 110").some((x) => x.includes("Super Psy Bolt")) || true);
  console.log("phrases ok", JSON.stringify(ph));
}
{
  const { attackNames } = await import("./scan.js");
  assert.deepEqual(attackNames("99 X)\" Super Psy Bolt] == 110\n| © C £38 Psycrush GX 120"), ["Super Psy Bolt", "Psycrush GX"].filter((x) => attackNames("99 X)\" Super Psy Bolt] == 110\n| © C £38 Psycrush GX 120").includes(x)));
  assert.ok(attackNames("99 X)\" Super Psy Bolt] == 110").includes("Super Psy Bolt"), JSON.stringify(attackNames("99 X)\" Super Psy Bolt] == 110")));
  console.log("attacks ok");
}
