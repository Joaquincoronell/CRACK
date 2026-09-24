import { CATALOG, POSITIONS, byId } from '@/components/crack/catalog';
export const STORE_KEY = 'crack.match.v1';
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
  return { ...state, deck, round: state.round + 1, phase: 'auction', notice: state.notice || '', auction: { id, active, turn, price: 0, leader: null } };
}
export const MODES = ['ciegas', 'revelado', 'intercalado'];
export const cardVisible = state => state.mode === 'revelado' || (state.mode === 'intercalado' && state.round % 2 === 1);
export function newDeck() { return shuffle(CATALOG.map(p => p.id)); }
export function newGame(players, mode) { return nextAuction({ version: 1, mode: MODES.includes(mode) ? mode : 'ciegas', teams: players.map((p, i) => ({ name: p.name.trim() || 'Participante ' + (i + 1), team: p.team.trim() || 'Equipo ' + (i + 1), bot: !!p.bot, budget: 100, squad: [] })), deck: newDeck(), round: 0, notice: '' }); }
function settle(state) {
  const a = state.auction;
  if (a.leader !== null && a.active.length === 1) {
    const teams = state.teams.map((t, i) => i === a.leader ? { ...t, budget: t.budget - a.price, squad: [...t.squad, { id: a.id, price: a.price }] } : t);
    return { ...state, teams, phase: 'reveal', notice: '' };
  }
  if (!a.active.length) return nextAuction({ ...state, deck: [...state.deck, a.id], notice: cardVisible(state) ? 'Nadie ofertó. El futbolista vuelve al mazo.' : 'Nadie ofertó. El futbolista vuelve al mazo, sin revelar su identidad.' });
  const candidates = a.active.filter(i => i !== a.leader);
  const turn = candidates.find(i => i > a.turn) ?? candidates[0];
  return { ...state, auction: { ...a, turn } };
}
export function gameReducer(state, action) {
  if (action.type === 'new') return newGame(action.players, action.mode);
  if (action.type === 'next' && state.phase === 'reveal') return nextAuction({ ...state, notice: '' });
  if (action.type === 'startTournament' && state.phase === 'finished' && !state.tournament) return { ...state, tournament: buildTournament(state) };
  if (action.type === 'resetTournament' && state.tournament) return { ...state, tournament: null };
  if (action.type === 'matchResult' && state.tournament && state.phase === 'finished') {
    const t = state.tournament, m = nextMatch(t), { goalsA = 0, goalsB = 0, pensA = 0, pensB = 0 } = action;
    if (!m || goalsA > 12 || goalsB > 12 || goalsA === goalsB && pensA === pensB) return state;
    const results = [...t.results, { round: t.round, a: m.a.id, b: m.b.id, goalsA, goalsB, pensA, pensB, winner: goalsA > goalsB || goalsA === goalsB && pensA > pensB ? m.a.id : m.b.id }];
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
  if (action.type === 'pass') return settle({ ...state, notice: '', auction: { ...a, active: a.active.filter(i => i !== a.turn) } });
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
  standings(state.teams).forEach((s, i) => { slots[spots[i]] = { id: 'p' + s.index, name: s.team, stars: s.name, strength: teamStrength(state.teams[s.index]), isPlayer: true, scorers: state.teams[s.index].squad.map(p => ({ name: byId(p.id).name, rating: byId(p.id).rating })) }; });
  const legends = shuffle(LEGENDS);
  for (let i = 0; i < 8; i++) if (!slots[i]) { const l = legends.pop(); slots[i] = { id: 'l' + l.name, name: l.name, stars: l.stars, strength: l.strength, isPlayer: false, scorers: l.stars.split(',').map(n => ({ name: n.trim(), rating: l.strength })) }; }
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
export function simulateMatch(a, b) {
  const diff = a.strength - b.strength;
  const goalsA = poisson(Math.max(.4, Math.min(3.4, 1.3 + diff / 9))), goalsB = poisson(Math.max(.4, Math.min(3.4, 1.3 - diff / 9)));
  const minutes = shuffle(Array.from({ length: 90 }, (_, i) => i + 1));
  let pens = null;
  if (goalsA === goalsB) { let pa, pb; do { pa = 3 + Math.floor(Math.random() * 3); pb = 3 + Math.floor(Math.random() * 3); } while (pa === pb); pens = { a: pa, b: pb }; }
  return { goalsA, goalsB, eventsA: minutes.slice(0, goalsA).sort((x, y) => x - y).map(minute => ({ minute, scorer: pickScorer(a) })), eventsB: minutes.slice(goalsA, goalsA + goalsB).sort((x, y) => x - y).map(minute => ({ minute, scorer: pickScorer(b) })), pens };
}
export const teamStrength = team => team.squad.length ? team.squad.reduce((sum, p) => sum + byId(p.id).rating, 0) / team.squad.length : 0;
export function botMove(state) {
  const a = state.auction, team = state.teams[a.turn], player = byId(a.id);
  if (cardVisible(state) && player.rating < 80) return { type: 'pass' };
  const slots = 11 - team.squad.length;
  const cap = Math.min(maxBid(team), team.budget - (slots - 1) * 4);
  const tier = player.rating <= 85 ? 10 : player.rating <= 93 ? 25 : 45;
  const perceived = Math.min(100, Math.max(1, player.rating + Math.random() * 10 - 5));
  const interest = (perceived / 100) ** 3 * 60 + 3;
  return a.price < Math.min(interest, cap, tier) ? { type: 'bid', amount: 1 } : { type: 'pass' };
}
export function standings(teams) { const sorted = teams.map((t, i) => ({ ...t, index: i, score: t.squad.reduce((sum, p) => sum + byId(p.id).rating, 0) })).sort((a, b) => b.score - a.score || b.budget - a.budget); return sorted.map((t, i) => ({ ...t, rank: i && t.score === sorted[i - 1].score && t.budget === sorted[i - 1].budget ? sorted.findIndex(s => s.score === t.score && s.budget === t.budget) + 1 : i + 1 })); }
