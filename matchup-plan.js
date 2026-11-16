// Matchup read, no AI. The app's own matchup simulation (matchup.js: 2,000 games, half on the play and half on the
// draw) and its sideboard rules, put into plain sentences by fixed rules. Works offline; nothing leaves the device.
const pc = x => Math.round(x * 100) + '%';
const join = xs => xs.length > 1 ? xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1] : xs[0] || '';
const cut = (s, n = 800) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

/**
 * request: buildMatchupRequest's result (card ids p0.., o0..). me/op: matchup.js profiles. sim: simulateMatchup's result.
 * plan: gamePlan's result for best of three, or null. Returns the shape the matchup screen draws.
 */
export function buildMatchupPlan({ request, me, op, sim, plan = null, mode = 'bo1' }) {
  const mine = request.player.name || 'Your deck', theirs = request.opponent.name || 'the opponent', R = sim.reasons || [];
  const idOf = new Map([...request.player.cards, ...request.opponent.cards].map(c => [c.name.toLowerCase(), c.id])), ids = names => [...new Set(names.map(n => idOf.get(String(n).toLowerCase())).filter(Boolean))].slice(0, 12);
  const faster = /^You're faster/.test(R[0] || '') ? 'me' : /^They're faster/.test(R[0] || '') ? 'them' : 'even';
  const role = faster === 'me' ? 'You are the faster deck. Spend mana on threats first and keep answers for whatever stops your attack.' : faster === 'them' ? 'They are the faster deck. Answer their early threats first: your clock only wins if theirs is slowed.' : 'The clocks are even, so who goes first and who lands the first answer decide most games.';
  const outlook = sim.win >= 0.55 ? 'favorable' : sim.win <= 0.45 ? 'difficult' : 'balanced', gap = Math.round((sim.onPlay - sim.onDraw) * 100);
  const ins = plan?.ins || [], outs = plan?.outs || [], sided = mode === 'bo3' && ins.length > 0;
  const flow = me.flow > op.flow + 1 ? `You have more card flow (${me.flow} cards to their ${op.flow}), so a longer game favours you.` : op.flow > me.flow + 1 ? `They have more card flow (${op.flow} cards to your ${me.flow}), so a longer game favours them.` : `Card flow is about even (${me.flow} to ${op.flow}).`;
  const threats = me.threats > op.threats + 2 ? `You hold more threats (${me.threats} to ${op.threats}); each of their answers trades for less.` : op.threats > me.threats + 2 ? `They hold more threats (${op.threats} to ${me.threats}); you cannot answer each one, so answer the ones that end the game.` : `Threat counts are close (${me.threats} to ${op.threats}).`;
  const scenarios = [
    { title: 'You go first', setup: `${mine} is on the play. It wins ${pc(sim.onPlay)} of those simulated games.`, plan: cut(`${R[0] || ''} ${role}`), risk: cut(R[1] || 'The simulation found no single thing that stops you.'), lesson: gap >= 4 ? `Going first is worth about ${gap} points of win rate here.` : gap <= -4 ? `Going second is no handicap here: the extra card matters more than the tempo.` : 'Who goes first changes little in this matchup.', cardIds: [] },
    { title: 'You go second', setup: `${mine} is on the draw. It wins ${pc(sim.onDraw)} of those simulated games.`, plan: cut(faster === 'them' ? `You start a turn behind a faster deck. Keep hands with an early answer or blocker; a slow hand loses the race. ${R[2] || ''}` : faster === 'me' ? `You are still the faster deck, with one more card. Keep hands that curve out. ${R[2] || ''}` : `The extra card is your edge. Trade one for one and let it count. ${R[2] || ''}`), risk: cut(R[1] || ''), lesson: role, cardIds: [] },
    sided
      ? { title: 'After sideboarding', setup: 'Games two and three, with the sideboard.', plan: cut(`Bring in ${join(ins.map(x => `${x.qty} ${x.name} (${x.why})`))}.${outs.length ? ` Take out ${join(outs.map(x => `${x.qty} ${x.name} (${x.why})`))}.` : ''}`), risk: plan.after != null ? `With that swap the simulated win rate goes from ${pc(sim.win)} to ${pc(plan.after)}.` : 'The swap was not re-simulated.', lesson: 'Side only what the rules above call for. A swap the simulation scores worse is never suggested.', cardIds: ids([...ins, ...outs].map(x => x.name)) }
      : { title: 'A long game', setup: 'Neither deck closes on its usual turn.', plan: flow, risk: threats, lesson: mode === 'bo3' ? (plan?.worse ? 'Every sideboard swap the app tried simulated worse than the main deck, so keep the main deck.' : plan?.empty ? 'This list has no sideboard, so games two and three play the same.' : 'No sideboard card matches a rule for this opponent, so keep the main deck.') : 'Best of one: there is no sideboard, so this is the whole plan.', cardIds: [] },
  ];
  return {
    summary: cut(`${mine} wins ${pc(sim.win)} of ${sim.runs.toLocaleString('en-US')} simulated games against ${theirs}: ${pc(sim.onPlay)} going first, ${pc(sim.onDraw)} going second. ${R.join(' ')}`, 900),
    outlook, confidence: 'simulated', win: sim.win, onPlay: sim.onPlay, onDraw: sim.onDraw, runs: sim.runs,
    assumptions: ['Each deck races the turn it usually wins on when played out alone; the other side\'s answers push that turn back.', 'Half the games are on the play and half on the draw.'],
    scenarios,
    coaching: [{ title: 'Your role', text: role, cardIds: [] }, { title: 'Answers', text: cut(`${R[1] || ''} ${R[2] || ''}`), cardIds: [] }, { title: 'If it goes long', text: `${flow} ${threats}`, cardIds: [] }],
    recommendation: null,
    limitations: ['The simulation leaves out blocking, combat tricks and play skill, so read it as a lean, not a forecast.', 'Results are pulled toward even, and the better-built list gets a small edge.'],
    disclaimer: 'From the app\'s own simulation, with no AI. A lean, not a forecast.', generatedAt: '',
  };
}
