import { useEffect, useMemo, useState } from 'react';
import { Trophy, RotateCcw, Share2, Newspaper, History, Sparkles, Goal, HandHelping, ShieldCheck, BadgeDollarSign } from 'lucide-react';
import { standings, teamIdentity } from '@/components/crack/engine';
import { byId } from '@/components/crack/catalog';
import Pitch from '@/components/crack/Pitch';
import Tournament from '@/components/crack/Tournament';

const HISTORY_KEY = 'crack.history.v1';

const KIND_LABELS = {
  penal: 'PENAL',
  freekick: 'TIRO LIBRE',
  oneonone: 'MANO A MANO',
  cross: 'CENTRO',
  counter: 'CONTRAATAQUE',
  longshot: 'REMATE DE AFUERA',
  openplay: 'JUGADA'
};

const readHistory = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const tournamentStory = game => {
  const t = game.tournament;
  if (!t?.champion) return null;

  const champion = t.champion;
  const final = [...t.results].reverse().find(r => r.round === 2) || [...t.results].reverse()[0];
  const byTeamId = Object.fromEntries(t.teams.map(team => [team.id, team]));
  const rivalId = final ? (final.a === champion.id ? final.b : final.a) : null;
  const rival = rivalId ? byTeamId[rivalId] : null;
  const championScore = final ? (final.a === champion.id ? final.goalsA : final.goalsB) : null;
  const rivalScore = final ? (final.a === champion.id ? final.goalsB : final.goalsA) : null;
  const championPens = final ? (final.a === champion.id ? final.pensA : final.pensB) : null;
  const rivalPens = final ? (final.a === champion.id ? final.pensB : final.pensA) : null;

  const statEvents = t.results.flatMap(result => result.stats || []);
  const playerStats = new Map();

  const ratingFor = (teamId, playerName) => {
    const team = byTeamId[teamId];
    return team?.players?.find(player => player.name === playerName)?.rating || team?.strength || 75;
  };

  statEvents.forEach(event => {
    if (!event?.player) return;
    const key = event.teamId + '::' + event.player;
    const row = playerStats.get(key) || {
      key,
      teamId: event.teamId,
      team: byTeamId[event.teamId]?.name || '—',
      player: event.player,
      rating: ratingFor(event.teamId, event.player),
      goals: 0,
      assists: 0,
      saves: 0,
      freeKicks: 0,
      penalties: 0,
      impact: 0
    };
    const value = event.value || 1;
    if (event.type === 'goal') {
      row.goals += value;
      if (event.kind === 'freekick') row.freeKicks += value;
      if (event.kind === 'penal') row.penalties += value;
    }
    if (event.type === 'assist') row.assists += value;
    if (event.type === 'save') row.saves += value;
    playerStats.set(key, row);
  });

  const stats = [...playerStats.values()].map(row => ({
    ...row,
    impact: row.goals * 4 + row.assists * 2.4 + row.saves * .7 + row.freeKicks * 1.1 + row.rating * .015
  })).sort((a, b) => b.impact - a.impact || b.goals - a.goals || b.assists - a.assists);

  const championPlayers = champion.players || [];
  const fallbackMvp = championPlayers.length ? [...championPlayers].sort((a, b) => b.rating - a.rating)[0] : null;
  const mvp = stats[0] || (fallbackMvp ? { player: fallbackMvp.name, team: champion.name, rating: fallbackMvp.rating, goals: 0, assists: 0, saves: 0 } : null);
  const topScorer = [...stats].sort((a, b) => b.goals - a.goals || b.impact - a.impact)[0] || null;
  const topAssist = [...stats].sort((a, b) => b.assists - a.assists || b.impact - a.impact)[0] || null;
  const topKeeper = [...stats].sort((a, b) => b.saves - a.saves || b.impact - a.impact)[0] || null;

  const goalQuality = { freekick: 100, longshot: 96, counter: 88, cross: 84, oneonone: 78, openplay: 72, penal: 55 };
  const goalOfTournament = statEvents
    .filter(event => event.type === 'goal')
    .map(event => ({
      ...event,
      score: (goalQuality[event.kind] || 70) + (event.round || 0) * 7 + Math.min(8, (event.minute || 0) / 12)
    }))
    .sort((a, b) => b.score - a.score)[0] || null;

  const purchases = game.teams.flatMap((team, teamIndex) => team.squad.map(item => {
    const player = byId(item.id);
    return { player, price: item.price, team: game.teams[teamIndex].team };
  })).filter(item => item.player);

  const mostExpensive = purchases.length ? [...purchases].sort((a, b) => b.price - a.price)[0] : null;
  const bargain = purchases.length
    ? [...purchases].sort((a, b) => (b.player.rating - b.price * 1.35) - (a.player.rating - a.price * 1.35))[0]
    : null;
  const worstBuy = purchases.length
    ? [...purchases].sort((a, b) => (b.price * 1.35 - b.player.rating) - (a.price * 1.35 - a.player.rating))[0]
    : null;

  return {
    champion,
    final,
    rival,
    championScore,
    rivalScore,
    championPens,
    rivalPens,
    stats,
    mvp,
    topScorer,
    topAssist,
    topKeeper,
    goalOfTournament,
    mostExpensive,
    bargain,
    worstBuy,
    byTeamId
  };
};

export default function Results({ game, photos, onRematch, dispatch }) {
  const ranked = standings(game.teams);
  const winners = ranked.filter(team => team.rank === 1);
  const story = useMemo(() => tournamentStory(game), [game.tournament?.champion?.id, game.tournament?.results?.length]);
  const [history, setHistory] = useState(() => readHistory());
  const [shareState, setShareState] = useState('');

  useEffect(() => {
    if (!story || !game.gameId) return;
    setHistory(current => {
      if (current.some(entry => entry.gameId === game.gameId)) return current;
      const finalText = story.final
        ? story.championScore === story.rivalScore
          ? story.championScore + '–' + story.rivalScore + ' (' + story.championPens + '–' + story.rivalPens + ' pen.)'
          : story.championScore + '–' + story.rivalScore
        : '—';
      const entry = {
        gameId: game.gameId,
        date: new Date().toISOString(),
        champion: story.champion.name,
        rival: story.rival?.name || '—',
        score: finalText,
        mvp: story.mvp?.player || '—',
        bargain: story.bargain?.player?.name || '—'
      };
      const next = [entry, ...current].slice(0, 20);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [story?.champion?.id, game.gameId]);

  const titleCounts = history.reduce((acc, entry) => {
    acc[entry.champion] = (acc[entry.champion] || 0) + 1;
    return acc;
  }, {});
  const hall = Object.entries(titleCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const shareStory = async () => {
    if (!story) return;
    const finalScore = story.final
      ? story.championScore === story.rivalScore
        ? story.championScore + '–' + story.rivalScore + ' · penales ' + story.championPens + '–' + story.rivalPens
        : story.championScore + '–' + story.rivalScore
      : '';
    const text = 'CRACK · ' + story.champion.name + ' campeón. Final ' + finalScore + '. MVP: ' + (story.mvp?.player || '—') + '. Goleador: ' + (story.topScorer?.player || '—') + '. Compra del torneo: ' + (story.bargain?.player?.name || '—') + '.';
    try {
      if (navigator.share) await navigator.share({ title: 'CRACK — Diario del campeón', text });
      else await navigator.clipboard.writeText(text);
      setShareState(navigator.share ? 'COMPARTIDO' : 'COPIADO');
      setTimeout(() => setShareState(''), 1400);
    } catch {}
  };

  return <main className="results-page" data-phase="finished">
    <div className="results-heading">
      <span className="eyebrow gold-text"><Trophy size={18} /> SE TERMINÓ LA SUBASTA</span>
      <h1>{winners.length > 1 ? 'LA GLORIA SE COMPARTE.' : 'LA GLORIA TIENE DUEÑO.'}</h1>
      <p>{winners.map(team => team.team).join(' y ')} {winners.length > 1 ? 'se llevan' : 'se lleva'} la copa. Las excusas quedan para el asado.</p>
      <button className="primary-button" data-action="rematch" onClick={onRematch}><RotateCcw size={18} />Revancha</button>
    </div>

    <div className="standings">
      {ranked.map(team => <div key={team.index} className={'standing-row ' + (team.rank === 1 ? 'winner' : '')}>
        <b className="rank">{String(team.rank).padStart(2, '0')}</b>
        <span className={'team-dot team-' + team.index}><Trophy size={18} /></span>
        <div className="standing-team"><h2>{team.team}</h2><span>{team.name}</span></div>
        <div><strong>{team.score}</strong><small>PUNTOS</small></div>
        <div><strong>{'$' + team.budget + 'M'}</strong><small>RESTANTES</small></div>
      </div>)}
    </div>

    <section className="identity-section">
      <div className="identity-heading"><span className="eyebrow"><Sparkles size={15} /> ADN DE LOS EQUIPOS</span><h2>Lo que armaste importa.</h2></div>
      <div className="identity-grid">
        {ranked.map(team => {
          const identity = teamIdentity(team);
          return <article key={team.index} className="identity-card">
            <div><small>{team.team}</small><strong>{identity.style}</strong></div>
            <div className="identity-stats">
              <span><b>{identity.attack}</b>ATA</span>
              <span><b>{identity.midfield}</b>MED</span>
              <span><b>{identity.defense}</b>DEF</span>
              <span><b>{identity.keeper}</b>ARQ</span>
              <span><b>{identity.chemistry}</b>QUI</span>
            </div>
            <p>{identity.tags.join(' · ')}</p>
          </article>;
        })}
      </div>
    </section>

    <p className="results-disclaimer">Valoraciones y atributos ficticios creados para este juego, no estadísticas oficiales. Se suma el once completo; desempata el saldo. Si también empatan en dinero, comparten puesto.</p>

    <Tournament game={game} dispatch={dispatch} />

    {story && <>
      <section className="tournament-stats">
        <div className="identity-heading"><span className="eyebrow"><Goal size={15} /> ESTADÍSTICAS DEL TORNEO</span><h2>Lo que pasó en la cancha.</h2></div>
        <div className="stat-leaders">
          <article><Goal size={17} /><small>GOLEADOR</small><b>{story.topScorer?.player || '—'}</b><span>{story.topScorer ? story.topScorer.goals + ' goles' : 'Sin datos'}</span></article>
          <article><HandHelping size={17} /><small>ASISTENCIAS</small><b>{story.topAssist?.player || '—'}</b><span>{story.topAssist ? story.topAssist.assists + ' asistencias' : 'Sin datos'}</span></article>
          <article><ShieldCheck size={17} /><small>ATAJADAS</small><b>{story.topKeeper?.player || '—'}</b><span>{story.topKeeper ? story.topKeeper.saves + ' atajadas' : 'Sin datos'}</span></article>
          <article><Sparkles size={17} /><small>MVP</small><b>{story.mvp?.player || '—'}</b><span>{story.mvp ? story.mvp.goals + ' G · ' + story.mvp.assists + ' A · ' + story.mvp.saves + ' ATJ' : 'Sin datos'}</span></article>
        </div>

        {story.stats.length > 0 && <div className="tournament-stats-table">
          <div className="stats-row stats-head"><span>JUGADOR</span><b>G</b><b>A</b><b>ATJ</b><b>TL</b><b>PEN</b></div>
          {story.stats.slice(0, 8).map(row => <div className="stats-row" key={row.key}>
            <span><strong>{row.player}</strong><small>{row.team}</small></span>
            <b>{row.goals}</b><b>{row.assists}</b><b>{row.saves}</b><b>{row.freeKicks}</b><b>{row.penalties}</b>
          </div>)}
        </div>}
      </section>

      <section className="tournament-awards">
        <div className="identity-heading"><span className="eyebrow"><Trophy size={15} /> PREMIOS CRACK</span><h2>La historia de esta partida.</h2></div>
        <div className="awards-grid">
          <article><span>🏆</span><small>MVP DEL TORNEO</small><b>{story.mvp?.player || '—'}</b><p>{story.mvp?.team || '—'}</p></article>
          <article><span>🚀</span><small>GOL DEL TORNEO</small><b>{story.goalOfTournament?.player || '—'}</b><p>{story.goalOfTournament ? (KIND_LABELS[story.goalOfTournament.kind] || 'JUGADA') + ' · ' + story.goalOfTournament.minute + '′' : 'Sin datos'}</p></article>
          <article><span>💎</span><small>GANGA</small><b>{story.bargain?.player?.name || '—'}</b><p>{story.bargain ? '$' + story.bargain.price + 'M · ' + story.bargain.team : '—'}</p></article>
          <article><span>💸</span><small>COMPRA MÁS CARA</small><b>{story.mostExpensive?.player?.name || '—'}</b><p>{story.mostExpensive ? '$' + story.mostExpensive.price + 'M · ' + story.mostExpensive.team : '—'}</p></article>
          <article><span>🧱</span><small>GUANTE DEL TORNEO</small><b>{story.topKeeper?.player || '—'}</b><p>{story.topKeeper ? story.topKeeper.saves + ' atajadas' : 'Sin datos'}</p></article>
          <article><span>📉</span><small>COMPRA MÁS DURA</small><b>{story.worstBuy?.player?.name || '—'}</b><p>{story.worstBuy ? '$' + story.worstBuy.price + 'M · media ' + story.worstBuy.player.rating : '—'}</p></article>
        </div>
      </section>

      <section className="crack-newspaper">
        <div className="newspaper-masthead"><Newspaper size={18} /><span>CRACK · EDICIÓN ESPECIAL</span><small>FINAL DEL TORNEO</small></div>
        <div className="newspaper-body">
          <span className="newspaper-kicker">ÚLTIMO MOMENTO</span>
          <h2>{story.champion.name.toUpperCase()} CAMPEÓN.</h2>
          <p className="newspaper-deck">{story.rival ? 'Superó a ' + story.rival.name + ' y levantó la copa.' : 'Le ganó a la historia entera.'}</p>
          <div className="newspaper-score">
            <span>{story.champion.name}</span>
            <strong>{story.final ? story.championScore + '–' + story.rivalScore : 'CAMPEÓN'}</strong>
            <span>{story.rival?.name || 'LEYENDAS'}</span>
          </div>
          <div className="newspaper-columns">
            <div><small>MVP</small><b>{story.mvp?.player || '—'}</b><span>{story.mvp ? story.mvp.goals + ' goles · ' + story.mvp.assists + ' asist.' : '—'}</span></div>
            <div><small>GOLEADOR</small><b>{story.topScorer?.player || '—'}</b><span>{story.topScorer ? story.topScorer.goals + ' goles' : '—'}</span></div>
            <div><small>GOL DEL TORNEO</small><b>{story.goalOfTournament?.player || '—'}</b><span>{story.goalOfTournament ? KIND_LABELS[story.goalOfTournament.kind] || 'JUGADA' : '—'}</span></div>
          </div>
          <button className="newspaper-share" onClick={shareStory}><Share2 size={15} />{shareState || 'Compartir resumen'}</button>
        </div>
      </section>
    </>}

    {history.length > 0 && <section className="history-panel">
      <div className="history-title"><History size={17} /><div><span>HISTORIAL LOCAL</span><h2>Hall of Fame</h2></div></div>
      <div className="hall-grid">
        {hall.map(([name, titles], i) => <div key={name}><b>{i + 1}</b><span>{name}</span><strong>{titles}</strong><small>{titles === 1 ? 'TÍTULO' : 'TÍTULOS'}</small></div>)}
      </div>
      <div className="recent-champions">
        {history.slice(0, 5).map(entry => <p key={entry.gameId}><b>{entry.champion}</b><span>{entry.score} · MVP {entry.mvp}</span></p>)}
      </div>
    </section>}

    <section className="final-teams">
      {ranked.map(team => <div key={team.index}><div className="final-team-heading"><h2>{team.team}</h2><span>4–3–3 <i>·</i> {team.score} PTS</span></div><Pitch team={team} photos={photos} /></div>)}
    </section>
  </main>;
}
