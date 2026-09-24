import { useEffect, useState } from 'react';
import { Swords, Trophy, RotateCcw, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { nextMatch, pairsForRound, ROUND_NAMES, simulateMatch } from '@/components/crack/engine';
import MatchSim from '@/components/crack/MatchSim';

export default function Tournament({ game, dispatch }) {
  const t = game.tournament, [sim, setSim] = useState(null);
  const champion = t?.champion ?? null;
  useEffect(() => { if (champion?.isPlayer) confetti({ particleCount: 170, spread: 80, origin: { y: .6 }, colors: ['#c1fa41', '#dec184', '#ffffff'] }); }, [champion?.id]);
  const pending = !t || champion || sim ? null : nextMatch(t);
  useEffect(() => {
    if (!pending || pending.a.isPlayer || pending.b.isPlayer) return;
    const timer = setTimeout(() => {
      const r = simulateMatch(pending.a, pending.b);
      dispatch({ type: 'matchResult', goalsA: r.goalsA, goalsB: r.goalsB, pensA: r.pens?.a, pensB: r.pens?.b });
    }, 1100);
    return () => clearTimeout(timer);
  }, [pending?.a?.id, pending?.b?.id, dispatch]);

  if (sim) return <section className="tournament"><div className="match-sim-wrap"><span className="eyebrow gold-text"><Swords size={18} /> {ROUND_NAMES[t.round].toUpperCase()}</span><MatchSim a={sim.a} b={sim.b} script={sim.script} onFinish={r => { dispatch({ type: 'matchResult', ...r }); setSim(null); }} /></div></section>;

  const mine = pending && (pending.a.isPlayer || pending.b.isPlayer) ? (pending.a.isPlayer ? pending.a : pending.b) : null;
  const other = mine ? (pending.a === mine ? pending.b : pending.a) : null;
  const chance = mine ? Math.round(100 / (1 + 2 ** ((other.strength - mine.strength) / 2.5))) : null;
  const byId = t ? Object.fromEntries(t.teams.map(x => [x.id, x])) : {};
  const played = t ? t.results.map(r => ({ r, a: byId[r.a], b: byId[r.b] })) : [];
  const upcoming = t && !champion ? pairsForRound(t).filter(([a, b]) => !t.results.some(r => r.round === t.round && r.a === a.id && r.b === b.id)) : [];
  return <section className="tournament">
    <div className="tournament-heading"><span className="eyebrow gold-text"><Swords size={18} /> TORNEO DE LEYENDAS</span><h2>La copa no se subasta.</h2><p>Ocho equipos a eliminación directa: los recién armados y las leyendas más pesadas de la historia. Cada partido dura 90 minutos, apretados en veinte segundos.</p></div>
    {!t ? <div className="legend-cta"><p>Tres rondas. Siete partidos. Una copa que casi nadie levanta.</p><button className="primary-button" onClick={() => dispatch({ type: 'startTournament' })}><Swords size={18} />Empezar el torneo</button></div>
      : champion ? <div className={'legend-end ' + (champion.isPlayer ? 'champion' : '')}>{champion.isPlayer ? <Trophy size={30} /> : <Sparkles size={26} />}<h3>{champion.isPlayer ? champion.name + ' campeón del torneo.' : 'Se lo llevó ' + champion.name + '.'}</h3><p>{champion.isPlayer ? 'Le ganó a la historia entera. Contalo, pero que no te crean.' : 'La historia no perdona. La revancha existe y no cuesta nada.'}</p><button className="primary-button" onClick={() => dispatch({ type: 'resetTournament' })}><RotateCcw size={16} />Jugarlo de nuevo</button></div>
      : pending && mine ? <div className="rival-card"><span className="rival-tag">{ROUND_NAMES[t.round].toUpperCase()}</span><h3 className="rival-names">{pending.a.name} <em>vs</em> {pending.b.name}</h3><p className="rival-stars"><Sparkles size={13} /> {pending.a.stars} · {pending.b.stars}</p><div className="rival-stats"><div><strong>{mine.strength.toFixed(1)}</strong><small>NIVEL {mine.name.toUpperCase()}</small></div><div><strong>{other.strength}</strong><small>NIVEL RIVAL</small></div><div><strong>{chance}%</strong><small>CHANCES</small></div></div><button className="primary-button" onClick={() => setSim({ a: pending.a, b: pending.b, script: simulateMatch(pending.a, pending.b) })}><Swords size={16} />Jugar el partido</button></div>
      : pending ? <div className="rival-card"><span className="rival-tag">{ROUND_NAMES[t.round].toUpperCase()}</span><h3 className="rival-names">{pending.a.name} <em>vs</em> {pending.b.name}</h3><p className="legend-playing">Se está jugando en otra cancha…</p></div>
      : <div className="rival-card"><p className="legend-playing">Cerrando la ronda…</p></div>}
    {played.length + upcoming.length > 0 && <div className="legend-log">{played.map(({ r, a, b }, i) => <div key={'r' + i} className={'legend-match ' + (byId[r.winner].isPlayer ? 'win' : a.isPlayer || b.isPlayer ? 'loss' : '')}><span>{ROUND_NAMES[r.round].toUpperCase()}</span><b>{a.name} — {b.name}</b><strong>{r.goalsA}–{r.goalsB}</strong><small>{r.goalsA === r.goalsB ? 'PENALES ' + r.pensA + '–' + r.pensB : 'PASÓ ' + byId[r.winner].name}</small></div>)}{upcoming.map(([a, b], i) => <div key={'u' + i} className="legend-match"><span>{ROUND_NAMES[t.round].toUpperCase()}</span><b>{a.name} — {b.name}</b><strong>VS</strong><small>PRÓXIMO</small></div>)}</div>}
  </section>;
}
