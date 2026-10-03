/* Pitch lines: DEF and LAT share defense. Never change a player's declared positions. */
(function(root) {
  const lines = ['DEF', 'MED', 'DEL'];
  const pitch = role => role === 'LAT' ? 'DEF' : role;
  function validate(teams, minimum = {DEF:2, MED:1, DEL:1}) {
    const capacity = Array(8).fill(0), adapted = [];
    for (const team of teams) {
      const counts = Object.fromEntries(lines.map(line => [line, team.filter(p => pitch(p.assigned) === line).length]));
      if (team.filter(p => p.assigned === 'ARQ').length !== 1 || lines.some(line => counts[line] < minimum[line])) return false;
      for (const player of team) {
        if (player.assigned === 'ARQ') continue;
        const natural = player.positions.map(pitch);
        for (let mask = 1; mask < 8; mask++) {
          if (lines.some((line, bit) => (mask & (1 << bit)) && natural.includes(line))) capacity[mask]++;
        }
        const line = pitch(player.assigned);
        if (!natural.includes(line)) {
          if (!lines.includes(line) || counts[line] > minimum[line]) return false;
          adapted.push(lines.indexOf(line));
        }
      }
    }
    const deficits = capacity.map((count, mask) => Math.max(0, lines.reduce((sum, line, bit) => sum + ((mask & (1 << bit)) ? minimum[line] * teams.length : 0), 0) - count));
    return adapted.length <= Math.max(...deficits) && adapted.every(bit => deficits.some((deficit, mask) => deficit > 0 && (mask & (1 << bit))));
  }
  function assignSmall(players, keeper, positions, rating) {
    let best = null;
    for (const adapt of [false, true]) {
      let states = new Map([['0,0,0', {counts:[0,0,0], changed:0, adapted:0, rating:0, assignment:new Map(keeper ? [[keeper,'ARQ']] : [])}]]);
      for (const player of players) {
        if (player === keeper) continue;
        const natural = positions(player).filter(role => role !== 'ARQ');
        const options = [...new Set([...natural,...(adapt ? lines : [])])];
        const next = new Map();
        for (const state of states.values()) for (const role of options) {
          const index = lines.indexOf(pitch(role));
          if (index < 0) continue;
          const counts = state.counts.slice(); counts[index]++;
          const candidate = {counts, changed:state.changed + Number(role !== natural[0]), adapted:state.adapted + Number(!natural.map(pitch).includes(pitch(role))), rating:state.rating + rating(player,role), assignment:new Map(state.assignment).set(player,role)};
          const key = counts.join(',');
          const old = next.get(key);
          if (!old || candidate.adapted < old.adapted || (candidate.adapted === old.adapted && (candidate.changed < old.changed || (candidate.changed === old.changed && candidate.rating > old.rating)))) next.set(key,candidate);
        }
        states = next;
      }
      for (const state of states.values()) {
        if (state.counts[0] < 2 || state.counts[1] < 1 || state.counts[2] < 1) continue;
        if (!best || state.adapted < best.adapted || (state.adapted === best.adapted && (state.changed < best.changed || (state.changed === best.changed && state.rating > best.rating)))) best = state;
      }
      if (best) break;
    }
    return best?.assignment || new Map(players.map(p => [p, p === keeper ? 'ARQ' : positions(p).find(role => role !== 'ARQ') || 'MED']));
  }
  function assignCounts(players, keeper, positions, rating, target) {
    let states = new Map([['0,0,0',{counts:[0,0,0],adapted:0,changed:0,rating:0,assignment:new Map(keeper ? [[keeper,'ARQ']] : [])}]]);
    for (const player of players) {
      if (player === keeper) continue;
      const natural = positions(player).filter(role => role !== 'ARQ');
      const next = new Map();
      for (const state of states.values()) for (const line of lines) {
        const index = lines.indexOf(line);
        if (state.counts[index] >= target[line]) continue;
        const role = natural.find(role => pitch(role) === line) || line;
        const counts = state.counts.slice(); counts[index]++;
        const candidate = {counts,adapted:state.adapted + Number(!natural.map(pitch).includes(line)),changed:state.changed + Number(role !== natural[0]),rating:state.rating + rating(player,role),assignment:new Map(state.assignment).set(player,role)};
        const key = counts.join(','); const old = next.get(key);
        if (!old || candidate.adapted < old.adapted || (candidate.adapted === old.adapted && (candidate.changed < old.changed || (candidate.changed === old.changed && candidate.rating > old.rating)))) next.set(key,candidate);
      }
      states = next;
    }
    return states.get(lines.map(line => target[line]).join(','))?.assignment || null;
  }
  const api = {validate,assignSmall,assignCounts};
  root.GoodfellasFormation = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
