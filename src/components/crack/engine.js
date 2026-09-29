import { CATALOG, POSITIONS, byId, playerSkill } from '@/components/crack/catalog';
export const STORE_KEY = 'crack.match.v1';
export const INITIAL_SKIPS = 3;
export const skipsLeft = team => team?.skips ?? INITIAL_SKIPS;
export const BOT_PERSONALITIES = [
  { id: 'tiburon', name: 'EL TIBURÓN', text: 'Agresivo. Paga de más por estrellas.', aggression: 1.22, starBias: 1.24, bargain: .94, patience: .9 },
  { id: 'scout', name: 'EL SCOUT', text: 'Busca valor y posiciones que necesita.', aggression: 1, starBias: 1.03, bargain: 1.16, patience: 1.06 },
  { id: 'ahorrista', name: 'EL AHORRISTA', text: 'Cuida la caja y espera oportunidades.', aggression: .84, starBias: .92, bargain: 1.25, patience: 1.18 },
  { id: 'galactico', name: 'EL GALÁCTICO', text: 'Se obsesiona con los nombres pesados.', aggression: 1.12, starBias: 1.38, bargain: .88, patience: .94 }
];
export const getBotPersonality = id => BOT_PERSONALITIES.find(p => p.id === id) || BOT_PERSONALITIES[1];

const auctionVisible = state => state.mode === 'revelado' || (state.mode === 'intercalado' && (state.round + 1) % 2 === 1);
function makeAuctionEvent(state, player) {
  if (Math.random() > .24) return null;
  if (!auctionVisible(state) && Math.random() < .48) {
    const tier = player.rating >= 93 ? 'SCOUT: perfil de élite, 93+' : player.rating >= 87 ? 'SCOUT: nivel alto, 87–92' : player.rating >= 80 ? 'SCOUT: nivel competitivo, 80–86' : 'SCOUT: apuesta de riesgo, menos de 80';
    return { id: 'scout', label: 'INFORME DE SCOUT', text: tier, botFactor: 1 };
  }
  if (Math.random() < .5) return { id: 'hype', label: 'SUBASTA CALIENTE', text: 'Los bots llegan con ganas de gastar.', botFactor: 1.18 };
  return { id: 'cold', label: 'MERCADO FRÍO', text: 'Los bots están más cautos de lo normal.', botFactor: .86 };
}
export function shuffle(values) { const a = [...values]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const countPosition = (team, pos) => team.squad.filter(p => byId(p.id).position === pos).length;
export const maxBid = team => team.budget - (10 - team.squad.length);
export const eligible = (team, pos) => team.squad.length < 11 && countPosition(team, pos) < POSITIONS[pos].quota;
export function nextAuction(state) {
  if (state.teams.every(t => t.squad.length === 11)) return { ...state, phase: 'finished', auction: null };
  const index = state.deck.findIndex(id => state.teams.some(t => eligible(t, byId(id).position)));
  if (index < 0) throw new Error('No quedan jugadores para las posiciones pendientes.');
  const id = state.deck[index], deck = state.deck.filter((_, i) => i !== index);
  const active = state.teams.map((t, i) => eligible(t, byId(id).position) ? i : -1).filter(i => i >= 0);
  const start = state.round % state.teams.length;
  const turn = active.find(i => i >= start) ?? active[0];
  const player = byId(id);
  return { ...state, deck, round: state.round + 1, phase: 'auction', notice: state.notice || '', auction: { id, active, turn, openingTurn: turn, price: 0, leader: null, event: makeAuctionEvent(state, player) } };
}
export const MODES = ['ciegas', 'revelado', 'intercalado'];
export const cardVisible = state => state.mode === 'revelado' || (state.mode === 'intercalado' && state.round % 2 === 1);
export function newDeck() { return shuffle(CATALOG.map(p => p.id)); }
export function newGame(players, mode) {
  const gameId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  return nextAuction({
    version: 1,
    gameId,
    mode: MODES.includes(mode) ? mode : 'ciegas',
    teams: players.map((p, i) => ({
      name: p.name.trim() || 'Participante ' + (i + 1),
      team: p.team.trim() || 'Equipo ' + (i + 1),
      bot: !!p.bot,
      botPersonality: p.bot ? BOT_PERSONALITIES[i % BOT_PERSONALITIES.length].id : null,
      skips: INITIAL_SKIPS,
      budget: 100,
      squad: []
    })),
    deck: newDeck(),
    round: 0,
    notice: ''
  });
}
function settle(state) {
  const a = state.auction;
  if (a.leader !== null && a.active.length === 1) {
    const teams = state.teams.map((t, i) => i === a.leader ? { ...t, budget: t.budget - a.price, squad: [...t.squad, { id: a.id, price: a.price }] } : t);
    return { ...state, teams, phase: 'reveal', notice: '' };
  }
  if (!a.active.length) return nextAuction({ ...state, notice: 'El jugador quedó fuera del mercado. No vuelve al mazo.' });
  const candidates = a.active.filter(i => i !== a.leader);
  const turn = candidates.find(i => i > a.turn) ?? candidates[0];
  return { ...state, auction: { ...a, turn } };
}
export function gameReducer(state, action) {
  if (action.type === 'abandon') return null;
  if (action.type === 'new') return newGame(action.players, action.mode);
  if (action.type === 'next' && state.phase === 'reveal') return nextAuction({ ...state, notice: '' });
  if (action.type === 'startTournament' && state.phase === 'finished' && !state.tournament) return { ...state, tournament: buildTournament(state) };
  if (action.type === 'resetTournament' && state.tournament) return { ...state, tournament: null };
  if (action.type === 'matchResult' && state.tournament && state.phase === 'finished') {
    const t = state.tournament, m = nextMatch(t), { goalsA = 0, goalsB = 0, pensA = 0, pensB = 0 } = action;
    if (!m || goalsA > 12 || goalsB > 12 || goalsA === goalsB && pensA === pensB) return state;
    const resultStats = (action.stats || []).map(stat => ({ ...stat, round: t.round }));
    const results = [...t.results, { round: t.round, a: m.a.id, b: m.b.id, goalsA, goalsB, pensA, pensB, stats: resultStats, winner: goalsA > goalsB || goalsA === goalsB && pensA > pensB ? m.a.id : m.b.id }];
    const pairs = pairsForRound(t), roundDone = pairs.every(([a, b]) => results.some(r => r.round === t.round && r.a === a.id && r.b === b.id));
    const winners = roundDone ? pairs.map(([a, b]) => results.find(r => r.round === t.round && r.a === a.id && r.b === b.id).winner === a.id ? a : b) : [];
    return { ...state, tournament: { ...t, results, round: roundDone && winners.length > 1 ? t.round + 1 : t.round, champion: roundDone && winners.length === 1 ? winners[0] : t.champion } };
  }
  if (state.phase !== 'auction') return state;
  const a = state.auction, team = state.teams[a.turn];
  if (action.type === 'bid') {
    if (![1, 2, 5].includes(action.amount) || a.price + action.amount > maxBid(team) || !eligible(team, byId(a.id).position) || !a.active.includes(a.turn) || a.turn === a.leader) return state;
    return settle({ ...state, notice: '', auction: { ...a, price: a.price + action.amount, leader: a.turn } });
  }
  if (action.type === 'pass') {
    const openingTurn = a.openingTurn ?? a.turn;
    const isOpeningDecision = a.leader === null && a.price === 0 && a.turn === openingTurn;

    if (isOpeningDecision) {
      const remaining = skipsLeft(team);
      if (remaining > 0) {
        const teams = state.teams.map((t, i) => i === a.turn ? { ...t, skips: remaining - 1 } : t);
        return nextAuction({
          ...state,
          teams,
          notice: team.name + ' usó un skip. El jugador sale del mercado y no vuelve al mazo.'
        });
      }

      const forcedAmount = 1;
      if (forcedAmount <= maxBid(team) && eligible(team, byId(a.id).position)) {
        return settle({
          ...state,
          notice: team.name + ' no tiene skips: abre la subasta por $1M.',
          auction: { ...a, price: forcedAmount, leader: a.turn }
        });
      }
      return state;
    }

    return settle({ ...state, notice: '', auction: { ...a, active: a.active.filter(i => i !== a.turn) } });
  }
  return state;
}
export const LEGENDS = [
  { name: 'Brasil 1970', strength: 97, stars: 'Pelé, Jairzinho, Rivelino, Tostão, Carlos Alberto' },
  { name: 'Barcelona 2009', strength: 94, stars: 'Messi, Xavi, Iniesta, Eto’o, Henry' },
  { name: 'Real Madrid 1960', strength: 93, stars: 'Di Stéfano, Puskás, Gento' },
  { name: 'Milan 1989', strength: 93, stars: 'Van Basten, Gullit, Rijkaard, Baresi, Maldini' },
  { name: 'España 2010', strength: 92, stars: 'Casillas, Xavi, Iniesta, Villa' },
  { name: 'Argentina 1986', strength: 91, stars: 'Maradona, Valdano, Burruchaga, Passarella, Pumpido' },
  { name: 'Ajax 1972', strength: 90, stars: 'Cruyff, Keizer, Krol, Rep' },
  { name: 'Francia 1998', strength: 90, stars: 'Zidane, Deschamps, Thuram, Barthez' }
];
export const ROUND_NAMES = ['Cuartos de final', 'Semifinal', 'Final'];
export function buildTournament(state) {
  const spots = [0, 7, 3, 4], slots = new Array(8).fill(null);
  standings(state.teams).forEach((s, i) => {
    const roster = state.teams[s.index].squad.map(p => {
      const player = byId(p.id);
      return { name: player.name, rating: player.rating, position: player.position, attributes: player.attributes };
    });
    const sourceTeam = state.teams[s.index];
    slots[spots[i]] = {
      id: 'p' + s.index,
      name: s.team,
      stars: s.name,
      strength: teamStrength(sourceTeam),
      isPlayer: !sourceTeam.bot,
      isHuman: !sourceTeam.bot,
      isBot: !!sourceTeam.bot,
      isAuctionTeam: true,
      scorers: roster,
      players: roster,
      identity: teamIdentity(sourceTeam)
    };
  });
  const legends = shuffle(LEGENDS);
  for (let i = 0; i < 8; i++) if (!slots[i]) {
    const l = legends.pop();
    const players = l.stars.split(',').map((n, index) => {
      const name = n.trim();
      const position = /Casillas|Barthez|Pumpido/i.test(name) ? 'ARQ' : index < 2 ? 'DEL' : index < 4 ? 'MED' : 'DEF';
      return { name, rating: l.strength, position, attributes: null };
    });
    slots[i] = { id: 'l' + l.name, name: l.name, stars: l.stars, strength: l.strength, isPlayer: false, isHuman: false, isBot: false, isAuctionTeam: false, scorers: players, players, identity: { style: 'LEYENDA', chemistry: Math.min(99, Math.round(l.strength + 2)), tags: ['HISTORIA', 'JERARQUÍA'] } };
  }
  return { teams: slots, round: 0, results: [], champion: null };
}
export const aliveAtRoundStart = t => t.teams.filter(tm => !t.results.some(r => r.round < t.round && r.winner !== tm.id && (r.a === tm.id || r.b === tm.id)));
export function pairsForRound(t) { const alive = aliveAtRoundStart(t), out = []; for (let i = 0; i < alive.length; i += 2) out.push([alive[i], alive[i + 1]]); return out; }
export function nextMatch(t) { return pairsForRound(t).map(([a, b]) => ({ a, b })).find(m => !t.results.some(r => r.round === t.round && r.a === m.a.id && r.b === m.b.id)) || null; }
const poisson = l => { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; };
const pickScorer = t => {
  if (!t.scorers?.length) return null;
  const weights = t.scorers.map(s => (s.rating / 100) ** 4);
  let r = Math.random() * weights.reduce((x, y) => x + y, 0);
  for (let i = 0; i < t.scorers.length; i++) { r -= weights[i]; if (r <= 0) return t.scorers[i].name; }
  return t.scorers[t.scorers.length - 1].name;
};
const avg = values => values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : 0;
const rosterSkill = (players, positions, keys, fallback) => {
  const pool = players.filter(p => positions.includes(p.position));
  if (!pool.length) return fallback;
  return avg(pool.map(p => avg(keys.map(key => playerSkill(p, key)))));
};

export function teamIdentity(team) {
  const players = team.squad?.map(s => byId(s.id)).filter(Boolean) || [];
  if (!players.length) return { attack: 0, midfield: 0, defense: 0, keeper: 0, chemistry: 0, style: 'SIN DEFINIR', tags: [] };

  const base = avg(players.map(p => p.rating));
  const attack = rosterSkill(players, ['DEL'], ['finishing', 'technique', 'pace'], base);
  const midfield = rosterSkill(players, ['MED'], ['passing', 'technique', 'physical'], base);
  const defense = rosterSkill(players, ['DEF'], ['defense', 'physical', 'pace'], base);
  const keeper = rosterSkill(players, ['ARQ'], ['goalkeeping'], base);
  const pace = avg(players.map(p => playerSkill(p, 'pace')));
  const passing = avg(players.map(p => playerSkill(p, 'passing')));
  const setPieces = avg(players.map(p => playerSkill(p, 'setPieces')));
  const spread = Math.max(attack, midfield, defense, keeper) - Math.min(attack, midfield, defense, keeper);
  const chemistry = Math.max(62, Math.min(99, Math.round(94 - spread * .75 + passing * .045)));

  let style = 'EQUILIBRADO';
  if (attack >= defense + 5 && attack >= midfield + 3) style = 'ATAQUE TOTAL';
  else if (defense >= attack + 5) style = 'BLOQUE DE ACERO';
  else if (midfield >= attack && midfield >= defense && passing >= 82) style = 'DUEÑO DE LA PELOTA';
  else if (pace >= 86) style = 'TRANSICIÓN ELÉCTRICA';

  const tags = [];
  if (setPieces >= 85) tags.push('PELOTA PARADA');
  if (pace >= 86) tags.push('VELOCIDAD');
  if (defense >= 87) tags.push('DEFENSA FUERTE');
  if (attack >= 88) tags.push('MUCHO GOL');
  if (passing >= 86) tags.push('BUEN PIE');
  if (!tags.length) tags.push('EQUIPO PAREJO');

  return {
    attack: Math.round(attack),
    midfield: Math.round(midfield),
    defense: Math.round(defense),
    keeper: Math.round(keeper),
    chemistry,
    style,
    tags: tags.slice(0, 3),
    pace: Math.round(pace),
    passing: Math.round(passing),
    setPieces: Math.round(setPieces)
  };
}

const teamProfile = team => {
  const players = team.players?.length ? team.players : team.scorers || [];
  const base = team.strength || 80;
  const attack = rosterSkill(players, ['DEL'], ['finishing', 'technique', 'pace'], base);
  const midfield = rosterSkill(players, ['MED'], ['passing', 'technique', 'physical'], base);
  const defense = rosterSkill(players, ['DEF'], ['defense', 'physical', 'pace'], base);
  const keeper = rosterSkill(players, ['ARQ'], ['goalkeeping'], base);
  const chemistry = team.identity?.chemistry || Math.round(base);
  const setPieces = avg(players.map(p => playerSkill(p, 'setPieces'))) || base;
  return { overall: base, attack, midfield, defense, keeper, chemistry, setPieces };
};
export function simulateMatch(a, b, options = {}) {
  const interactive = !!options.interactive;
  const pa = teamProfile(a), pb = teamProfile(b);
  const overallEdge = (pa.overall - pb.overall) / 26;
  const attackEdgeA = (pa.attack - pb.defense) / 22;
  const attackEdgeB = (pb.attack - pa.defense) / 22;
  const midfieldEdge = (pa.midfield - pb.midfield) / 48;
  const keeperA = (pa.keeper - 85) / 45;
  const keeperB = (pb.keeper - 85) / 45;
  const chemistryEdge = (pa.chemistry - pb.chemistry) / 95;
  const base = interactive ? .58 : 1.16;
  const cap = interactive ? 2.05 : 3.25;
  const lambdaA = Math.max(.22, Math.min(cap, base + overallEdge + attackEdgeA + midfieldEdge + chemistryEdge * .18 - keeperB * .32));
  const lambdaB = Math.max(.22, Math.min(cap, base - overallEdge + attackEdgeB - midfieldEdge - chemistryEdge * .18 - keeperA * .32));
  const goalsA = poisson(lambdaA), goalsB = poisson(lambdaB);
  const minutes = shuffle(Array.from({ length: 90 }, (_, i) => i + 1));
  let pens = null;
  if (!interactive && goalsA === goalsB) {
    let paScore, pbScore;
    do {
      paScore = 3 + Math.floor(Math.random() * 3);
      pbScore = 3 + Math.floor(Math.random() * 3);
    } while (paScore === pbScore);
    pens = { a: paScore, b: pbScore };
  }
  return {
    goalsA,
    goalsB,
    eventsA: minutes.slice(0, goalsA).sort((x, y) => x - y).map(minute => ({ minute, scorer: pickScorer(a) })),
    eventsB: minutes.slice(goalsA, goalsA + goalsB).sort((x, y) => x - y).map(minute => ({ minute, scorer: pickScorer(b) })),
    pens,
    interactive,
    round: options.round ?? 0,
    profileA: pa,
    profileB: pb
  };
}
const pickAssistant = (team, scorer) => {
  const pool = (team.players?.length ? team.players : team.scorers || []).filter(p => p.name !== scorer && p.position !== 'ARQ');
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)].name;
};

const keeperName = team => {
  const pool = team.players?.length ? team.players : team.scorers || [];
  return pool.find(p => p.position === 'ARQ')?.name || team.name;
};

export function buildMatchStats(a, b, result = {}) {
  const eventsFor = (team, teamId, count, events = []) => {
    const normalized = events.length
      ? events
      : Array.from({ length: count }, (_, i) => ({ minute: 8 + Math.floor(Math.random() * 82), scorer: pickScorer(team), kind: 'openplay' }));
    const out = [];
    normalized.forEach(event => {
      const scorer = event.scorer || pickScorer(team);
      if (!scorer) return;
      out.push({ type: 'goal', teamId, player: scorer, minute: event.minute || 0, kind: event.kind || 'openplay', value: 1 });
      if ((event.kind || 'openplay') !== 'penal' && Math.random() < .72) {
        const assistant = pickAssistant(team, scorer);
        if (assistant) out.push({ type: 'assist', teamId, player: assistant, minute: event.minute || 0, kind: event.kind || 'openplay', value: 1 });
      }
    });
    return out;
  };

  const stats = [
    ...eventsFor(a, a.id, result.goalsA || 0, result.eventsA || []),
    ...eventsFor(b, b.id, result.goalsB || 0, result.eventsB || [])
  ];

  const savesA = 2 + Math.floor(Math.random() * 4) + Math.max(0, (result.goalsB || 0) === 0 ? 1 : 0);
  const savesB = 2 + Math.floor(Math.random() * 4) + Math.max(0, (result.goalsA || 0) === 0 ? 1 : 0);
  stats.push({ type: 'save', teamId: a.id, player: keeperName(a), minute: 90, kind: 'keeper', value: savesA });
  stats.push({ type: 'save', teamId: b.id, player: keeperName(b), minute: 90, kind: 'keeper', value: savesB });
  return stats;
}

export const teamStrength = team => team.squad.length ? team.squad.reduce((sum, p) => sum + byId(p.id).rating, 0) / team.squad.length : 0;
export function botMove(state) {
  const a = state.auction, team = state.teams[a.turn], player = byId(a.id);
  const personality = getBotPersonality(team.botPersonality);
  const need = POSITIONS[player.position].quota - countPosition(team, player.position);
  const urgency = Math.max(.86, 1 + (11 - team.squad.length <= 4 ? .08 : 0) + (need >= 2 ? .08 : 0));
  const eventFactor = a.event?.botFactor || 1;

  const visibleFloor = personality.id === 'galactico' ? 84 : personality.id === 'ahorrista' ? 82 : 79;
  if (cardVisible(state) && player.rating < visibleFloor && need <= 1) return { type: 'pass' };

  const slots = 11 - team.squad.length;
  const cap = Math.min(maxBid(team), team.budget - (slots - 1) * 4);
  const baseTier = player.rating <= 85 ? 10 : player.rating <= 93 ? 25 : 45;
  const starBoost = player.rating >= 92 ? personality.starBias : player.rating <= 82 ? personality.bargain : 1;
  const perceived = Math.min(100, Math.max(1, player.rating + Math.random() * 10 - 5));
  const interest = ((perceived / 100) ** 3 * 60 + 3) * personality.aggression * starBoost * urgency * eventFactor;
  const limit = Math.min(cap, baseTier * personality.aggression * starBoost, interest);

  if (a.price < limit) {
    const gap = limit - a.price;
    const amount = gap > 12 && a.price + 5 <= cap && Math.random() > personality.patience * .55 ? 5 : gap > 5 && a.price + 2 <= cap ? 2 : 1;
    return { type: 'bid', amount };
  }
  return { type: 'pass' };
}
export function standings(teams) { const sorted = teams.map((t, i) => ({ ...t, index: i, score: t.squad.reduce((sum, p) => sum + byId(p.id).rating, 0) })).sort((a, b) => b.score - a.score || b.budget - a.budget); return sorted.map((t, i) => ({ ...t, rank: i && t.score === sorted[i - 1].score && t.budget === sorted[i - 1].budget ? sorted.findIndex(s => s.score === t.score && s.budget === t.budget) + 1 : i + 1 })); }
