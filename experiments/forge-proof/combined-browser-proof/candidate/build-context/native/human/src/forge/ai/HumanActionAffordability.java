/* SPDX-License-Identifier: GPL-3.0-or-later */
package forge.ai;

import forge.card.mana.ManaAtom;
import forge.card.mana.ManaCostShard;
import forge.game.ability.AbilityUtils;
import forge.game.card.Card;
import forge.game.card.CardCollection;
import forge.game.card.CardCopyService;
import forge.game.cost.Cost;
import forge.game.cost.CostAdjustment;
import forge.game.cost.CostPartMana;
import forge.game.cost.CostTap;
import forge.game.keyword.Keyword;
import forge.game.mana.Mana;
import forge.game.mana.ManaCostBeingPaid;
import forge.game.mana.ManaPool;
import forge.game.player.Player;
import forge.game.replacement.ReplacementType;
import forge.game.spellability.SpellAbility;
import forge.game.staticability.StaticAbility;
import forge.game.staticability.StaticAbilityManaConvert;
import forge.game.staticability.StaticAbilityMode;
import forge.game.zone.ZoneType;
import java.util.*;

/** Human payment feasibility, never AI willingness. This is a bounded predictor,
 * not permission to execute a spell. Native casting still validates every choice.
 * Only an exhausted, closed fixed-mana model can prove unavailability. Unsupported
 * resource interactions, dynamic costs and a spent search budget preserve priority.
 */
public final class HumanActionAffordability {
    public enum Assessment { AVAILABLE, PROVEN_UNAVAILABLE, UNKNOWN }
    private HumanActionAffordability() {}
    private static final Set<String> SIMPLE_ADJUSTMENT_PARAMS = Set.of(
        "Mode", "ValidCard", "Type", "Amount", "Activator", "EffectZone", "Description");
    private static final Set<ReplacementType> RESOURCE_REPLACEMENTS = Set.of(
        ReplacementType.ProduceMana, ReplacementType.LoseMana, ReplacementType.PayLife,
        ReplacementType.LifeReduced, ReplacementType.Tap, ReplacementType.Untap);
    private record Token(byte color, boolean snow) {}
    private static final class Uncertain extends RuntimeException {}
    private static final class Budget {
        final long deadline; int nodes;
        Budget(long deadline) { this.deadline = deadline; }
        void tick() { if (++nodes > 8192 || System.nanoTime() >= deadline) throw new Uncertain(); }
    }

    public static Assessment assess(SpellAbility ability, Player player, long deadlineNanos) {
        try { return assessFixed(ability, player, new Budget(deadlineNanos)); }
        catch (RuntimeException uncertainty) { return Assessment.UNKNOWN; }
    }

    private static Assessment assessFixed(SpellAbility original, Player player, Budget budget) {
        budget.tick();
        // LKI copies retain IDs; do not spend resources, choose targets, or modify
        // the live ability's cost, payment, or mana-conversion bookkeeping.
        Card host = CardCopyService.getLKICopy(original.getHostCard());
        SpellAbility sa = original.copy(host, player, true);
        host.setCastFrom(original.getHostCard().getLastKnownZone());
        Cost base = sa.getPayCosts();
        if (base == null) return Assessment.AVAILABLE;
        if (base.getCostMana() != null && (base.getCostMana().isExiledCreatureCost()
                || base.getCostMana().isEnchantedCreatureCost())) return Assessment.UNKNOWN;
        if (base.hasXInAnyCostPart() || base.getMaxWaterbend() != null
                || sa.isOffering() || sa.isEmerge() || sa.isCastFaceDown()
                || sa.isPowerUp() || sa.hasParam("TapCreaturesForMana")
                || sa.hasParam("RaiseCost") || sa.hasParam("ReduceCost")
                || sa.hasParam("Announce") || player.hasKeyword("PayLifeInsteadOf:B")) return Assessment.UNKNOWN;
        for (Keyword k : List.of(Keyword.CONVOKE, Keyword.IMPROVISE, Keyword.DELVE, Keyword.ASSIST)) {
            if (host.hasKeyword(k)) return Assessment.UNKNOWN;
        }
        List<Card> publicCards = new ArrayList<>();
        for (ZoneType zone : List.of(ZoneType.Battlefield, ZoneType.Stack, ZoneType.Command)) {
            for (Card c : player.getGame().getCardsIn(zone)) publicCards.add(c);
        }
        if (!publicCards.contains(original.getHostCard())) publicCards.add(original.getHostCard());
        for (Card c : publicCards) {
            budget.tick();
            // Resource replacements/triggered mana require a separate solver.
            // A battlefield-entry/counter/damage replacement is unrelated to the
            // fixed tap/mana/life resources modelled here. Treating every such
            // effect as uncertain would stop on ordinary insufficient mana.
            if (c.getReplacementEffects().stream().anyMatch(r -> RESOURCE_REPLACEMENTS.contains(r.getMode()))) return Assessment.UNKNOWN;
            for (var trigger : c.getTriggers()) {
                String mode = trigger.getParamOrDefault("Mode", "");
                if (Set.of("TapsForMana", "ManaAdded", "Taps", "Untaps").contains(mode)) return Assessment.UNKNOWN;
            }
            for (StaticAbility st : c.getStaticAbilities()) {
                if (st.checkMode(StaticAbilityMode.SetCost)) return Assessment.UNKNOWN;
                if (st.checkMode(StaticAbilityMode.RaiseCost) || st.checkMode(StaticAbilityMode.ReduceCost)) {
                    if (!SIMPLE_ADJUSTMENT_PARAMS.containsAll(st.getMapParams().keySet())
                            || !st.getParamOrDefault("Amount", "1").matches("[0-9]+")) return Assessment.UNKNOWN;
                    // Target/state-sensitive qualifiers can depend on unchosen decisions.
                    String valid = st.getParamOrDefault("ValidCard", "Card");
                    if (!valid.matches("(?:Card|Instant|Sorcery|Creature|Artifact|Enchantment)(?:\\.nonCreature)?(?:,(?:Instant|Sorcery))*")) return Assessment.UNKNOWN;
                }
            }
        }
        Cost cost = CostAdjustment.adjust(base, sa, false);
        ManaCostBeingPaid mana = new ManaCostBeingPaid(cost.getCostMana() == null
                ? forge.card.mana.ManaCost.ZERO : cost.getCostMana().getManaCostFor(sa));
        if (!CostAdjustment.adjust(mana, sa, player, new CardCollection(), true, false)) return Assessment.UNKNOWN;
        if (mana.getXcounter() != 0) return Assessment.UNKNOWN;
        // Native enumeration has already checked nonmana feasibility. When mana
        // remains, shared sacrifice/life/discard resources need joint planning.
        if (mana.isPaid()) return Assessment.AVAILABLE;
        if (cost.getCostParts().stream().anyMatch(p -> !(p instanceof CostPartMana) && !(p instanceof CostTap))) return Assessment.UNKNOWN;
        for (ManaCostShard shard : mana.getUnpaidShards()) {
            if (shard.isOr2Generic() || shard == ManaCostShard.COLORED_X) return Assessment.UNKNOWN;
        }
        ManaPool matrix = new ManaPool(player);
        if (sa.getMayPlayOption() != null) sa.getMayPlayOption().applyManaConvert(matrix);
        if (sa.hasParam("ManaConversion")) AbilityUtils.applyManaColorConversion(matrix, sa.getParam("ManaConversion"));
        if (sa.isActivatedAbility() && sa.getGrantorStatic() != null && sa.getGrantorStatic().hasParam("ManaConversion")) {
            AbilityUtils.applyManaColorConversion(matrix, sa.getGrantorStatic().getParam("ManaConversion"));
        }
        StaticAbilityManaConvert.manaConvert(matrix, player, host, sa);
        List<Token> floating = new ArrayList<>();
        for (Mana m : player.getManaPool()) {
            if (m.meetsManaRestrictions(sa)) floating.add(new Token(m.getColor(), m.isSnow()));
        }
        List<List<List<Token>>> groups = new ArrayList<>();
        boolean unknownSource = false;
        Set<Card> seen = new HashSet<>();
        for (ZoneType zone : List.of(ZoneType.Battlefield, ZoneType.Hand, ZoneType.Flashback, ZoneType.Command)) {
            for (Card c : player.getCardsIn(zone)) {
                if (!seen.add(c)) continue;
                budget.tick();
                List<List<Token>> options = new ArrayList<>();
                for (SpellAbility raw : c.getManaAbilities()) {
                    SpellAbility source = raw.copy(c, player, true);
                    // A tap-cost activation cannot also tap its host for mana.
                    if (cost.hasTapCost() && c.equals(original.getHostCard())) continue;
                    if (!source.canPlay(true)) continue;
                    Cost sourceCost = source.getPayCosts();
                    if (sourceCost == null || !sourceCost.hasOnlySpecificCostType(CostTap.class)
                            || source.getSubAbility() != null || source.getApi() != forge.game.ability.ApiType.Mana) {
                        unknownSource = true; continue;
                    }
                    String amount = source.getParamOrDefault("Amount", "1");
                    if (!amount.matches("[1-9][0-9]?")) { unknownSource = true; continue; }
                    int count = Integer.parseInt(amount);
                    if (count > 20) { unknownSource = true; continue; }
                    if (!source.getManaPart().meetsManaRestrictions(sa)) continue;
                    String produced = source.getManaPart().getOrigProduced();
                    if (produced.equals("Any")) {
                        for (byte color : forge.card.MagicColor.WUBRG) options.add(Collections.nCopies(count, new Token(color, c.isSnow())));
                    } else if (produced.matches("[WUBRGC](?: [WUBRGC])*")) {
                        List<Token> tokens = new ArrayList<>();
                        for (int i = 0; i < count; i++) for (String color : produced.split(" ")) tokens.add(new Token(ManaAtom.fromName(color), c.isSnow()));
                        options.add(tokens);
                    } else { unknownSource = true; }
                }
                if (!options.isEmpty()) groups.add(options);
            }
        }
        if (groups.size() > 32 || floating.size() > 64) return Assessment.UNKNOWN;
        boolean paid = chooseSources(0, groups, floating, mana, matrix, player, sa, budget);
        return paid ? Assessment.AVAILABLE : unknownSource ? Assessment.UNKNOWN : Assessment.PROVEN_UNAVAILABLE;
    }

    private static boolean chooseSources(int index, List<List<List<Token>>> groups, List<Token> tokens,
            ManaCostBeingPaid cost, ManaPool matrix, Player player, SpellAbility sa, Budget budget) {
        budget.tick();
        if (index == groups.size()) {
            return match(new ArrayList<>(cost.getUnpaidShards()), tokens, new boolean[tokens.size()], 0,
                    matrix, player, sa, budget, new HashSet<>());
        }
        for (List<Token> option : groups.get(index)) {
            List<Token> next = new ArrayList<>(tokens); next.addAll(option);
            if (chooseSources(index + 1, groups, next, cost, matrix, player, sa, budget)) return true;
        }
        return false;
    }

    private static boolean match(List<ManaCostShard> remaining, List<Token> tokens, boolean[] used,
            int life, ManaPool matrix, Player player, SpellAbility sa, Budget budget, Set<String> failed) {
        budget.tick();
        if (remaining.isEmpty()) return true;
        String key = remaining.toString()+Arrays.toString(used)+":"+life;
        if (!failed.add(key)) return false;
        ManaCostShard shard = remaining.get(0);
        List<ManaCostShard> tail = remaining.subList(1, remaining.size());
        Set<Token> tried = new HashSet<>();
        for (int i = 0; i < tokens.size(); i++) {
            Token token = tokens.get(i);
            if (used[i] || !tried.add(token)) continue;
            boolean accepts = shard.isSnow() ? token.snow() || matrix.isSnowForColor()
                    : matrix.canPayForShardWithColor(shard, token.color());
            if (accepts) {
                used[i] = true;
                boolean paid = match(tail, tokens, used, life, matrix, player, sa, budget, failed);
                used[i] = false;
                if (paid) return true;
            }
        }
        // Exact remaining life is legal even when it leads to a loss. Never use
        // AIPhyrexianPayment, life-preservation thresholds or opponent life here.
        return shard.isPhyrexian() && player.canPayLife(life + 2, false, sa)
                && match(tail, tokens, used, life + 2, matrix, player, sa, budget, failed);
    }
}
