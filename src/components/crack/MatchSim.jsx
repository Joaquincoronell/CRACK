import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Swords, Shield, Target, Zap } from 'lucide-react';

const PHRASES = ['¡GOLAZO!', '¡De penal!', '¡Golpe de efecto!', '¡Qué definición!', '¡De cabeza al ángulo!', '¡Contragolpe letal!', '¡Zurdazo imposible!', '¡La picó por encima del arquero!', '¡Palomita!', '¡La rompió al palo izquierdo!'];
const LANES = ['IZQUIERDA', 'CENTRO', 'DERECHA'];
const GAME_LABELS = {
  penal: 'PENAL',
  freekick: 'TIRO LIBRE',
  oneonone: 'MANO A MANO',
  save: 'ATAJADA',
  cross: 'CENTRO + CABEZAZO',
  counter: 'CONTRAATAQUE'
};
const ROUND_NAMES = ['CUARTOS', 'SEMIFINAL', 'FINAL'];
const rand = n => Math.floor(Math.random() * n);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const pickPlayer = (team, preferred = []) => {
  const all = team.players?.length ? team.players : team.scorers || [];
  if (!all.length) return { name: team.name, rating: team.strength || 80, position: 'DEL' };
  const preferredPlayers = all.filter(p => preferred.includes(p.position));
  const pool = preferredPlayers.length ? preferredPlayers : all;
  const weights = pool.map(p => Math.max(1, (p.rating || team.strength || 80) - 55));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
};

const pickScorer = team => pickPlayer(team, ['DEL', 'MED']).name;
const skillScale = rating => clamp(.82 + ((rating || 80) - 70) * .012, .82, 1.2);

const matchDifficulty = (a, b, userSide, round) => {
  const me = userSide === 0 ? a : b;
  const rival = userSide === 0 ? b : a;
  const roundBase = [1, 1.16, 1.34][round] || 1;
  const strengthEdge = clamp((rival.strength - me.strength) / 18, -.22, .3);
  return clamp(roundBase + strengthEdge, .86, 1.62);
};

const timingProfile = (moment, step) => {
  const rating = moment.player?.rating || 80;
  const skill = skillScale(rating);
  const d = moment.difficulty;
  const profiles = {
    penal: [{ label: 'PRECISIÓN', width: 25, speed: 2.25 }],
    freekick: [{ label: 'POTENCIA', width: 29, speed: 2.05 }, { label: 'PRECISIÓN', width: 17, speed: 2.85 }],
    cross: [{ label: 'CENTRO', width: 25, speed: 2.3 }, { label: 'CABEZAZO', width: 15, speed: 3.15 }]
  };
  const p = (profiles[moment.game] || profiles.penal)[step] || profiles.penal[0];
  return {
    label: p.label,
    width: clamp(p.width * skill / d, 9, 34),
    speed: clamp(p.speed * d / skill, 1.6, 4.5)
  };
};

export default function MatchSim({ a, b, script, round = 0, onFinish }) {
  const userSide = a.isPlayer || !b.isPlayer ? 0 : 1;
  const difficulty = useMemo(() => matchDifficulty(a, b, userSide, round), [a, b, userSide, round]);
  const [minute, setMinute] = useState(0);
  const [moment, setMoment] = useState(null);
  const [needle, setNeedle] = useState(0);
  const [step, setStep] = useState(0);
  const [timingHits, setTimingHits] = useState([]);
  const [flash, setFlash] = useState(null);
  const [log, setLog] = useState([]);
  const [reactionCue, setReactionCue] = useState(false);
  const [shootout, setShootout] = useState(null);
  const [shootDir, setShootDir] = useState(null);
  const [shootFlash, setShootFlash] = useState(null);
  const done = useRef([]);
  const reactionTimeout = useRef(null);

  const plan = useMemo(() => {
    const count = round === 0 ? 3 : round === 1 ? 4 : 5;
    const attackGames = ['penal', 'freekick', 'oneonone', 'cross', 'counter'];
    const used = [];
    while (used.length < count - 1) {
      const g = attackGames[rand(attackGames.length)];
      if (!used.includes(g) || used.length > 3) used.push(g);
    }
    used.splice(Math.min(1, used.length), 0, 'save');
    if (round === 2 && !used.includes('penal')) used[used.length - 2] = 'penal';
    const baseMinutes = count === 3 ? [27, 57, 82] : count === 4 ? [20, 42, 66, 84] : [16, 35, 55, 73, 88];
    return used.slice(0, count).map((game, i) => {
      const defensivePenalty = round === 2 && game === 'penal' && i === count - 2 && Math.random() < .45;
      const attack = game !== 'save' && !defensivePenalty;
      const side = attack ? userSide : 1 - userSide;
      const attackingTeam = side === 0 ? a : b;
      const defendingTeam = side === 0 ? b : a;
      const preferred = game === 'cross' ? ['MED', 'DEL'] : game === 'freekick' ? ['MED', 'DEL'] : ['DEL', 'MED'];
      return {
        id: i + '-' + game,
        minute: clamp(baseMinutes[i] + rand(7) - 3, 5, 89),
        game,
        attack,
        side,
        player: pickPlayer(attackingTeam, preferred),
        keeper: pickPlayer(defendingTeam, ['ARQ']),
        difficulty,
        center: 18 + rand(65),
        keeperLane: rand(3),
        pressureLane: rand(3),
        targetLane: rand(3),
        clutch: round === 2 && i === count - 1
      };
    }).sort((x, y) => x.minute - y.minute);
  }, [a, b, difficulty, round, userSide]);

  const paused = !!moment || !!flash || !!shootout?.active;
  const finished = minute >= 90 && !moment && !flash;
  const teamName = side => side === 0 ? a.name : b.name;
  const userTeam = userSide === 0 ? a : b;
  const rivalTeam = userSide === 0 ? b : a;

  const events = useMemo(() => [
    ...script.eventsA.map(e => ({ m: e.minute, side: 0, scorer: e.scorer })),
    ...script.eventsB.map(e => ({ m: e.minute, side: 1, scorer: e.scorer }))
  ].sort((x, y) => x.m - y.m || x.side - y.side), [script]);

  const shown = [...events.filter(e => e.m <= minute), ...log.filter(e => e.m <= minute)]
    .sort((x, y) => y.m - x.m || y.side - x.side);
  const goalsA = events.filter(e => e.m <= minute && e.side === 0).length + log.filter(e => e.m <= minute && e.side === 0 && e.goal).length;
  const goalsB = events.filter(e => e.m <= minute && e.side === 1).length + log.filter(e => e.m <= minute && e.side === 1 && e.goal).length;

  const clearMoment = () => {
    setMoment(null);
    setStep(0);
    setTimingHits([]);
    setNeedle(0);
    setReactionCue(false);
    if (reactionTimeout.current) clearTimeout(reactionTimeout.current);
  };

  const finishMoment = (success, headline, subline) => {
    if (!moment) return;
    const goal = moment.attack ? success : !success;
    const attackingTeam = moment.side === 0 ? a : b;
    const scorer = goal ? pickScorer(attackingTeam) : null;
    setLog(l => [...l, {
      m: minute,
      side: moment.side,
      goal,
      scorer,
      kind: moment.game,
      label: headline
    }]);
    clearMoment();
    setFlash({ goal, headline, subline, scorer, defensive: !moment.attack });
    setTimeout(() => setFlash(null), 1500);
  };

  useEffect(() => {
    if (finished || paused) return;
    const timer = setInterval(() => setMinute(m => Math.min(90, m + 1)), 165);
    return () => clearInterval(timer);
  }, [finished, paused]);

  useEffect(() => {
    if (paused || minute >= 90) return;
    const next = plan.find(p => !done.current.includes(p.id) && p.minute <= minute);
    if (next) {
      done.current = [...done.current, next.id];
      setStep(0);
      setTimingHits([]);
      setNeedle(0);
      setMoment(next);
    }
  }, [minute, paused, plan]);

  const currentTiming = moment && ['penal', 'freekick', 'cross'].includes(moment.game) && !(moment.game === 'penal' && !moment.attack)
    ? timingProfile(moment, step)
    : null;

  useEffect(() => {
    if (!moment || !currentTiming) return;
    let pos = 0;
    let dir = 1;
    const timer = setInterval(() => {
      pos += dir * currentTiming.speed;
      if (pos >= 100) { pos = 100; dir = -1; }
      if (pos <= 0) { pos = 0; dir = 1; }
      setNeedle(pos);
    }, 28);
    return () => clearInterval(timer);
  }, [moment?.id, step, currentTiming?.speed]);

  useEffect(() => {
    if (!moment || moment.game !== 'save') return;
    setReactionCue(false);
    const prep = setTimeout(() => {
      setReactionCue(true);
      const keeperSkill = skillScale(moment.keeper?.rating || 80);
      const windowMs = clamp(1080 * keeperSkill / difficulty, 470, 1250);
      reactionTimeout.current = setTimeout(() => {
        finishMoment(false, '¡GOL RIVAL!', 'Llegaste tarde. El remate entró.');
      }, windowMs);
    }, 480 + rand(420));
    return () => {
      clearTimeout(prep);
      if (reactionTimeout.current) clearTimeout(reactionTimeout.current);
    };
  }, [moment?.id]);

  const stopTiming = () => {
    if (!moment || !currentTiming) return;
    const hit = Math.abs(needle - moment.center) <= currentTiming.width / 2;
    const nextHits = [...timingHits, hit];
    const totalSteps = moment.game === 'freekick' || moment.game === 'cross' ? 2 : 1;
    if (step + 1 < totalSteps) {
      setTimingHits(nextHits);
      setStep(s => s + 1);
      setNeedle(0);
      return;
    }
    const success = nextHits.every(Boolean);
    if (moment.game === 'penal') finishMoment(success, success ? '¡GOL DE PENAL!' : '¡LO ERRÓ!', success ? 'Frío. Adentro.' : 'La presión pudo más.');
    if (moment.game === 'freekick') finishMoment(success, success ? '¡GOLAZO DE TIRO LIBRE!' : '¡CERCA!', success ? 'Potencia y rosca perfectas.' : 'Una de las dos etapas falló.');
    if (moment.game === 'cross') finishMoment(success, success ? '¡CABEZAZO Y GOL!' : '¡SE FUE!', success ? 'Centro perfecto. Testazo imposible.' : 'El centro o el cabezazo no salió limpio.');
  };

  const chooseOneOnOne = lane => {
    const goal = lane !== moment.keeperLane;
    finishMoment(goal, goal ? '¡DEFINICIÓN PERFECTA!' : '¡ATAJÓ EL ARQUERO!', goal ? moment.player.name + ' leyó al arquero.' : 'El arquero adivinó la intención.');
  };

  const chooseCounter = lane => {
    const read = lane !== moment.pressureLane;
    const execution = clamp(.58 + ((moment.player.rating || 80) - 75) * .012 - (difficulty - 1) * .18, .42, .9);
    const goal = read && Math.random() < execution;
    finishMoment(goal, goal ? '¡CONTRA LETAL!' : read ? '¡LA CORTARON AL FINAL!' : '¡MALA DECISIÓN!', goal ? 'Leíste el espacio y el equipo voló.' : read ? 'La lectura fue buena, faltó ejecución.' : 'Fuiste directo a la zona con más presión.');
  };

  const choosePenaltySave = lane => {
    const save = lane === moment.keeperLane;
    finishMoment(save, save ? '¡ATAJÓ EL PENAL!' : '¡GOL RIVAL!', save ? moment.keeper.name + ' eligió el palo correcto.' : 'El pateador te mandó para el otro lado.');
  };

  const chooseSave = lane => {
    if (!reactionCue) return;
    if (reactionTimeout.current) clearTimeout(reactionTimeout.current);
    const save = lane === moment.targetLane;
    finishMoment(save, save ? '¡ATAJADÓN!' : '¡GOL RIVAL!', save ? moment.keeper.name + ' voló a tiempo.' : 'Fuiste al lugar equivocado.');
  };

  const startShootout = () => {
    setShootDir(null);
    setShootFlash(null);
    setShootout({ active: true, a: 0, b: 0, kicksA: 0, kicksB: 0, turn: 0, done: false, winner: null, opponentDir: rand(3) });
  };

  const shootSide = shootout ? shootout.turn % 2 : null;
  const userShooting = shootout?.active && shootSide === userSide;

  useEffect(() => {
    if (!shootout?.active || shootout.done || !userShooting || shootDir === null) return;
    let pos = 0;
    let dir = 1;
    const shooter = pickPlayer(userTeam, ['DEL', 'MED']);
    const speed = clamp(3 * difficulty / skillScale(shooter.rating), 2.3, 4.8);
    const timer = setInterval(() => {
      pos += dir * speed;
      if (pos >= 100) { pos = 100; dir = -1; }
      if (pos <= 0) { pos = 0; dir = 1; }
      setNeedle(pos);
    }, 28);
    return () => clearInterval(timer);
  }, [shootout?.turn, shootout?.active, shootout?.done, userShooting, shootDir, difficulty]);

  const recordShootoutKick = goal => {
    setShootout(s => {
      const side = s.turn % 2;
      const next = {
        ...s,
        a: s.a + (side === 0 && goal ? 1 : 0),
        b: s.b + (side === 1 && goal ? 1 : 0),
        kicksA: s.kicksA + (side === 0 ? 1 : 0),
        kicksB: s.kicksB + (side === 1 ? 1 : 0)
      };
      const remA = Math.max(0, 5 - next.kicksA);
      const remB = Math.max(0, 5 - next.kicksB);
      let winner = null;
      if (next.a > next.b + remB) winner = 0;
      if (next.b > next.a + remA) winner = 1;
      if (next.kicksA >= 5 && next.kicksB >= 5 && next.kicksA === next.kicksB && next.a !== next.b) winner = next.a > next.b ? 0 : 1;
      if (winner !== null) return { ...next, done: true, winner };
      return { ...next, turn: s.turn + 1, opponentDir: rand(3) };
    });
    setShootDir(null);
    setNeedle(0);
  };

  const shootPenalty = () => {
    if (shootDir === null) return;
    const shooter = pickPlayer(userTeam, ['DEL', 'MED']);
    const width = clamp(26 * skillScale(shooter.rating) / difficulty, 12, 31);
    const distance = Math.abs(needle - 50);
    const onTarget = distance <= width / 2;
    const perfect = distance <= width * .14;
    const keeperLane = rand(3);
    const goal = onTarget && (keeperLane !== shootDir || perfect);
    setShootFlash(goal ? '¡GOL!' : onTarget ? '¡ATAJÓ!' : '¡AFUERA!');
    setTimeout(() => { setShootFlash(null); recordShootoutKick(goal); }, 700);
  };

  const saveShootoutPenalty = lane => {
    const missChance = clamp(.06 - (rivalTeam.strength - 90) * .004, .015, .08);
    const miss = Math.random() < missChance;
    const save = !miss && lane === shootout.opponentDir;
    const goal = !miss && !save;
    setShootFlash(miss ? '¡AFUERA!' : save ? '¡ATAJASTE!' : '¡GOL RIVAL!');
    setTimeout(() => { setShootFlash(null); recordShootoutKick(goal); }, 700);
  };

  const finish = () => {
    onFinish({
      goalsA,
      goalsB,
      pensA: shootout?.done ? shootout.a : undefined,
      pensB: shootout?.done ? shootout.b : undefined
    });
  };

  const renderMoment = () => {
    if (!moment) return null;
    const clutch = moment.clutch || minute >= 85;
    const timing = currentTiming;
    return <div className={'sim-moment ' + (clutch ? 'clutch' : '')}>
      {clutch && <div className="clutch-banner"><Zap size={14} /> ÚLTIMA DEL PARTIDO · TODO O NADA</div>}
      <div className="moment-title-row">
        <div>
          <span className="moment-kicker">{moment.attack ? moment.player.name : moment.keeper.name}</span>
          <strong>{GAME_LABELS[moment.game]}</strong>
        </div>
        <span className="difficulty-chip">DIF. {Math.round(difficulty * 100)}</span>
      </div>

      {timing && <>
        <p>{moment.game === 'freekick' ? 'Dos pasos: primero potencia, después precisión.' : moment.game === 'cross' ? 'Primero clavá el centro. Después ganá el cabezazo.' : 'Frená la aguja dentro de la zona para convertir.'}</p>
        <div className="timing-label">{timing.label} · PASO {step + 1}</div>
        <div className="moment-track">
          <div className="moment-zone goal" style={{ left: (moment.center - timing.width / 2) + '%', width: timing.width + '%' }} />
          <div className="moment-needle" style={{ left: needle + '%' }} />
        </div>
        <button className="moment-btn moment-stop" onClick={stopTiming}>¡AHORA!</button>
      </>}

      {moment.game === 'oneonone' && <>
        <p>El arquero carga el peso hacia <b>{LANES[moment.keeperLane]}</b>. Elegí cómo definir antes de que cierre el ángulo.</p>
        <div className="choice-grid">
          {LANES.map((lane, i) => <button key={lane} className="choice-btn" onClick={() => chooseOneOnOne(i)}>{lane === 'CENTRO' ? 'PICARLA' : lane}</button>)}
        </div>
      </>}

      {moment.game === 'counter' && <>
        <p>Leé la defensa. Hay más presión por <b>{LANES[moment.pressureLane]}</b>. Encontrá el espacio.</p>
        <div className="choice-grid counter-grid">
          {LANES.map((lane, i) => <button key={lane} className={'choice-btn ' + (i === moment.pressureLane ? 'pressured' : '')} onClick={() => chooseCounter(i)}>
            <span>{lane}</span><small>{i === moment.pressureLane ? 'DEFENSA' : 'ESPACIO'}</small>
          </button>)}
        </div>
      </>}

      {moment.game === 'save' && <>
        <p>{reactionCue ? '¡YA! La pelota sale hacia ' + LANES[moment.targetLane] + '.' : 'Esperá la señal. Si te tirás antes, perdiste.'}</p>
        <div className={'reaction-cue ' + (reactionCue ? 'live' : '')}>{reactionCue ? LANES[moment.targetLane] : 'PREPARADO...'}</div>
        <div className="choice-grid">
          {LANES.map((lane, i) => <button key={lane} disabled={!reactionCue} className="choice-btn keeper" onClick={() => chooseSave(i)}>{lane}</button>)}
        </div>
      </>}

      {moment.game === 'penal' && !moment.attack && <>
        <p>Elegí el palo. El rival ya decidió dónde patear.</p>
        <div className="choice-grid">
          {LANES.map((lane, i) => <button key={lane} className="choice-btn keeper" onClick={() => choosePenaltySave(i)}>{lane}</button>)}
        </div>
      </>}
    </div>;
  };

  const renderShootout = () => {
    if (!shootout?.active) return null;
    const sideName = shootSide === 0 ? a.name : b.name;
    return <div className="shootout-box">
      <div className="shootout-head">
        <span>PENALES</span>
        <strong>{shootout.a}–{shootout.b}</strong>
        <small>{shootout.kicksA} / {shootout.kicksB} ejecutados</small>
      </div>
      {shootout.done ? <>
        <h3>{shootout.winner === userSide ? '¡LO GANASTE EN LOS PENALES!' : 'Se terminó en los penales.'}</h3>
        <p>{shootout.winner === userSide ? 'La presión era máxima y no temblaste.' : 'La tanda fue cruel. La revancha queda servida.'}</p>
        <button className="primary-button" onClick={finish}><Swords size={16} />Continuar</button>
      </> : shootFlash ? <div className="shootout-flash">{shootFlash}</div> : userShooting ? <>
        <h3>Patea {sideName}</h3>
        {shootDir === null ? <>
          <p>Elegí dirección. Después vas a tener que clavar la precisión.</p>
          <div className="choice-grid">
            {LANES.map((lane, i) => <button key={lane} className="choice-btn" onClick={() => setShootDir(i)}>{lane}</button>)}
          </div>
        </> : <>
          <p>Dirección elegida: <b>{LANES[shootDir]}</b>. Ahora clavá la aguja en el centro.</p>
          <div className="moment-track shootout-track">
            <div className="moment-zone goal" style={{ left: '39%', width: '22%' }} />
            <div className="moment-needle" style={{ left: needle + '%' }} />
          </div>
          <button className="moment-btn" onClick={shootPenalty}>¡PATEAR!</button>
        </>} 
      </> : <>
        <h3>¡ATAJÁ EL PENAL!</h3>
        <p>Elegí el palo antes del remate de {sideName}.</p>
        <div className="choice-grid">
          {LANES.map((lane, i) => <button key={lane} className="choice-btn keeper" onClick={() => saveShootoutPenalty(i)}>{lane}</button>)}
        </div>
      </>}
    </div>;
  };

  return <div className="match-sim">
    <div className="sim-board">
      <div className={'sim-team ' + (a.isPlayer ? 'me' : '')}><strong>{a.name}</strong><span>{a.isPlayer ? 'SUBASTADO' : 'LEYENDA'}</span></div>
      <div className="sim-score"><b>{goalsA}–{goalsB}</b><span>{finished ? <><Clock size={13} /> FINAL</> : <><Clock size={13} /> {minute}′</>}</span></div>
      <div className={'sim-team ' + (b.isPlayer ? 'me' : '')}><strong>{b.name}</strong><span>{b.isPlayer ? 'SUBASTADO' : 'LEYENDA'}</span></div>
    </div>

    <div className="sim-meta">
      <span><Shield size={12} /> {ROUND_NAMES[round] || 'PARTIDO'}</span>
      <span><Target size={12} /> Dificultad dinámica {Math.round(difficulty * 100)}</span>
      <span><Zap size={12} /> {plan.length} momentos jugables</span>
    </div>

    {renderMoment()}

    {flash && <div className={'sim-flash ' + (flash.goal ? 'goal' : 'save')}>
      <strong>{flash.headline}</strong>
      <span>{flash.goal && flash.scorer ? 'GOL DE ' + flash.scorer + '. ' + flash.subline : flash.subline}</span>
    </div>}

    {!shootout?.active && <div className="sim-feed">
      {shown.length ? shown.map((e, i) => <div key={i} className={'sim-event side-' + e.side + ' ' + (i === 0 && !finished ? 'fresh' : '')}>
        <b>{e.m}′</b>
        <span>{e.label || (e.goal === undefined ? PHRASES[e.m % PHRASES.length] : e.goal ? '¡GOLAZO!' : '¡SE SALVÓ!')}</span>
        <small>{e.goal === undefined ? 'GOL DE ' + (e.scorer || teamName(e.side)) : e.goal ? 'GOL DE ' + (e.scorer || teamName(e.side)) : 'NO TERMINÓ EN GOL'}</small>
      </div>) : <p className="sim-quiet">Rodando la pelota…</p>}
    </div>}

    {renderShootout()}

    {finished && !shootout?.active && <div className="sim-final">
      <strong>{goalsA === goalsB ? 'EMPATE. NOS VAMOS A PENALES.' : 'FINAL DEL PARTIDO'}</strong>
      <p>{goalsA === goalsB ? 'Acá ya no decide el simulador: pateás y atajás vos.' : 'El resultado mezcló nivel del equipo, contexto del partido y tus decisiones.'}</p>
      {goalsA === goalsB
        ? <button className="primary-button" onClick={startShootout}><Target size={16} />Jugar los penales</button>
        : <button className="primary-button" onClick={finish}><Swords size={16} />Continuar</button>}
    </div>}
  </div>;
}
