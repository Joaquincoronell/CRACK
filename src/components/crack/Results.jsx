import { useEffect, useMemo, useState } from 'react';
import { Trophy, RotateCcw, Share2, Newspaper, History, Sparkles } from 'lucide-react';
import { standings, teamIdentity } from '@/components/crack/engine';
import { byId } from '@/components/crack/catalog';
import Pitch from '@/components/crack/Pitch';
import Tournament from '@/components/crack/Tournament';

const HISTORY_KEY = 'crack.history.v1';

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
  const championPlayers = champion.players || [];
  const mvp = championPlayers.length ? [...championPlayers].sort((a, b) => b.rating - a.rating)[0] : null;

  const purchases = game.teams.flatMap((team, teamIndex) => team.squad.map(item => {
    const player = byId(item.id);
    return { player, price: item.price, team: game.teams[teamIndex].team };
  })).filter(x => x.player);
  const bargain = purchases.length
    ? [...purchases].sort((a, b) => (b.player.rating - b.price * 1.35) - (a.player.rating - a.price * 1.35))[0]
    : null;

  return { champion, final, rival, mvp, bargain };
};

export default function Results({ game, photos, onRematch, dispatch }) {
  const ranked = standings(game.teams);
  const winners = ranked.filter(t => t.rank === 1);
  const story = useMemo(() => tournamentStory(game), [game.tournament?.champion?.id, game.tournament?.results?.length]);
  const [history, setHistory] = useState(() => readHistory());
  const [shareState, setShareState] = useState('');

  useEffect(() => {
    if (!story || !game.gameId) return;
    setHistory(current => {
      if (current.some(entry => entry.gameId === game.gameId)) return current;
      const finalText = story.final
        ? story.final.goalsA === story.final.goalsB
          ? story.final.goalsA + '–' + story.final.goalsB + ' (' + story.final.pensA + '–' + story.final.pensB + ' pen.)'
          : story.final.goalsA + '–' + story.final.goalsB
        : '—';
      const entry = {
        gameId: game.gameId,
        date: new Date().toISOString(),
        champion: story.champion.name,
        rival: story.rival?.name || '—',
        score: finalText,
        mvp: story.mvp?.name || '—',
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
      ? story.final.goalsA === story.final.goalsB
        ? story.final.goalsA + '–' + story.final.goalsB + ' · penales ' + story.final.pensA + '–' + story.final.pensB
        : story.final.goalsA + '–' + story.final.goalsB
      : '';
    const text = 'CRACK · ' + story.champion.name + ' campeón. Final ' + finalScore + '. MVP: ' + (story.mvp?.name || '—') + '. Compra del torneo: ' + (story.bargain?.player?.name || '—') + '.';
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
      <p>{winners.map(t => t.team).join(' y ')} {winners.length > 1 ? 'se llevan' : 'se lleva'} la copa. Las excusas quedan para el asado.</p>
      <button className="primary-button" data-action="rematch" onClick={onRematch}><RotateCcw size={18} />Revancha</button>
    </div>

    <div className="standings">
      {ranked.map(t => <div key={t.index} className={'standing-row ' + (t.rank === 1 ? 'winner' : '')}>
        <b className="rank">{String(t.rank).padStart(2, '0')}</b>
        <span className={'team-dot team-' + t.index}><Trophy size={18} /></span>
        <div className="standing-team"><h2>{t.team}</h2><span>{t.name}</span></div>
        <div><strong>{t.score}</strong><small>PUNTOS</small></div>
        <div><strong>{'$' + t.budget + 'M'}</strong><small>RESTANTES</small></div>
      </div>)}
    </div>

    <section className="identity-section">
      <div className="identity-heading"><span className="eyebrow"><Sparkles size={15} /> ADN DE LOS EQUIPOS</span><h2>Lo que armaste importa.</h2></div>
      <div className="identity-grid">
        {ranked.map(t => {
          const identity = teamIdentity(t);
          return <article key={t.index} className="identity-card">
            <div><small>{t.team}</small><strong>{identity.style}</strong></div>
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

    {story && <section className="crack-newspaper">
      <div className="newspaper-masthead"><Newspaper size={18} /><span>CRACK · EDICIÓN ESPECIAL</span><small>FINAL DEL TORNEO</small></div>
      <div className="newspaper-body">
        <span className="newspaper-kicker">ÚLTIMO MOMENTO</span>
        <h2>{story.champion.name.toUpperCase()} CAMPEÓN.</h2>
        <p className="newspaper-deck">{story.rival ? 'Superó a ' + story.rival.name + ' y levantó la copa.' : 'Le ganó a la historia entera.'}</p>
        <div className="newspaper-score">
          <span>{story.champion.name}</span>
          <strong>{story.final ? story.final.goalsA + '–' + story.final.goalsB : 'CAMPEÓN'}</strong>
          <span>{story.rival?.name || 'LEYENDAS'}</span>
        </div>
        <div className="newspaper-columns">
          <div><small>MVP</small><b>{story.mvp?.name || '—'}</b><span>{story.mvp ? story.mvp.rating + ' de valoración' : '—'}</span></div>
          <div><small>COMPRA DEL TORNEO</small><b>{story.bargain?.player?.name || '—'}</b><span>{story.bargain ? '$' + story.bargain.price + 'M · ' + story.bargain.team : '—'}</span></div>
          <div><small>IDENTIDAD</small><b>{story.champion.identity?.style || 'LEYENDA'}</b><span>{story.champion.identity?.tags?.join(' · ') || 'JERARQUÍA'}</span></div>
        </div>
        <button className="newspaper-share" onClick={shareStory}><Share2 size={15} />{shareState || 'Compartir resumen'}</button>
      </div>
    </section>}

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
      {ranked.map(t => <div key={t.index}><div className="final-team-heading"><h2>{t.team}</h2><span>4–3–3 <i>·</i> {t.score} PTS</span></div><Pitch team={t} photos={photos} /></div>)}
    </section>
  </main>;
}
