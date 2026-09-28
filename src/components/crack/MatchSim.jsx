import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Swords, Shield, Target, Zap, Gauge, Activity } from 'lucide-react';

const PHRASES = ['¡GOLAZO!', '¡De penal!', '¡Golpe de efecto!', '¡Qué definición!', '¡De cabeza al ángulo!', '¡Contragolpe letal!', '¡Zurdazo imposible!', '¡La picó por encima del arquero!', '¡Palomita!', '¡La rompió al palo izquierdo!'];
const LANES = ['IZQUIERDA', 'CENTRO', 'DERECHA'];
const CROSS_LANES = ['PRIMER PALO', 'PUNTO PENAL', 'SEGUNDO PALO'];
const GAME_LABELS = {
  penal: 'PENAL',
  freekick: 'TIRO LIBRE',
  oneonone: 'MANO A MANO',
  save: 'REFLEJOS',
  cross: 'CENTRO + CABEZAZO',
  counter: 'CONTRAATAQUE',
  longshot: 'REMATE DE AFUERA'
};
const ROUND_NAMES = ['CUARTOS', 'SEMIFINAL', 'FINAL'];
const SURFACES = [
  { name: 'SECO', control: 1.05, speed: 1, bounce: .98 },
  { name: 'MOJADO', control: .9, speed: 1.12, bounce: 1.06 },
  { name: 'PESADO', control: .93, speed: .9, bounce: .92 }
];
const TEMPOS = [
  { name: 'CERRADO', pace: .92, pressure: .04 },
  { name: 'NORMAL', pace: 1, pressure: 0 },
  { name: 'VERTIGINOSO', pace: 1.12, pressure: .07 }
];
const ROLE_BONUS = {
  penal: { DEL: 5, MED: 3, DEF: -2, ARQ: -6 },
  freekick: { DEL: 2, MED: 6, DEF: 0, ARQ: -7 },
  oneonone: { DEL: 7, MED: 3, DEF: -2, ARQ: -7 },
  cross: { DEL: 2, MED: 6, DEF: 1, ARQ: -7 },
  counter: { DEL: 5, MED: 5, DEF: 0, ARQ: -7 },
  longshot: { DEL: 4, MED: 6, DEF: 1, ARQ: -7 },
  save: { ARQ: 8, DEF: 1, MED: -2, DEL: -4 }
};

const rand = n => Math.floor(Math.random() * n);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const average = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

const teamMetrics = team => {
  const players = team.players?.length ? team.players : team.scorers || [];
  const base = team.strength || 80;
  const ratings = pos => players.filter(p => p.position === pos).map(p => p.rating || base);
  const forwards = ratings('DEL');
  const mids = ratings('MED');
  const defs = ratings('DEF');
  const keepers = ratings('ARQ');
  return {
    overall: base,
    attack: forwards.length ? average(forwards) : base,
    midfield: mids.length ? average(mids) : base,
    defense: defs.length ? average(defs) : base,
    keeper: keepers.length ? Math.max(...keepers) : base - 2
  };
};

const pickPlayer = (team, preferred = []) => {
  const all = team.players?.length ? team.players : team.scorers || [];
  if (!all.length) return { name: team.name, rating: team.strength || 80, position: preferred[0] || 'DEL' };
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
const skillScale = rating => clamp(.8 + ((rating || 80) - 68) * .013, .78, 1.24);

const matchDifficulty = (a, b, userSide, round) => {
  const me = userSide === 0 ? a : b;
  const rival = userSide === 0 ? b : a;
  const roundBase = [1, 1.13, 1.3][round] || 1;
  const strengthEdge = clamp((rival.strength - me.strength) / 20, -.2, .3);
  return clamp(roundBase + strengthEdge, .82, 1.62);
};

const laneLeft = lane => ['22%', '50%', '78%'][lane] || '50%';

function GoalStage({ mode, keeperLane = 1, targetLane = 1, selectedLane = null, onPick, live = false, wall = false, defensive = false, result = null, laneLabels = LANES }) {
  const showTarget = live && mode === 'save';
  const resultLane = result?.lane ?? selectedLane ?? targetLane;
  return <div className={'goal-scene ' + mode + (live ? ' live' : '') + (result ? ' result' : '')}>
    <div className="stadium-lights"><i /><i /><i /><i /></div>
    <div className="goal-mouth">
      <div className="goal-net" />
      {wall && <div className="free-kick-wall"><i /><i /><i /><i /></div>}
      <div className={'keeper-figure lane-' + keeperLane + (defensive ? ' user-keeper' : '')}>
        <i className="keeper-head" /><i className="keeper-body" /><i className="keeper-arm left" /><i className="keeper-arm right" /><i className="keeper-leg left" /><i className="keeper-leg right" />
      </div>
      {showTarget && <div className="reaction-ball" style={{ left: laneLeft(targetLane) }}>⚽</div>}
      {result && <div className={'result-ball ' + (result.goal ? 'scored' : 'stopped')} style={{ '--ball-left': laneLeft(resultLane) }}>⚽</div>}
      {onPick && [0, 1, 2].map(i => <button key={i} type="button" className={'goal-hit-zone zone-' + i + (selectedLane === i ? ' selected' : '')} onClick={() => onPick(i)} aria-label={laneLabels[i]}>
        <span>{laneLabels[i]}</span>
      </button>)}
    </div>
    <div className="penalty-grass">
      <div className="ball-start">⚽</div>
      <div className="boot-shape"><i /></div>
    </div>
  </div>;
}

function PitchStage({ pressureLane, selectedLane = null, onPick }) {
  return <div className="mini-pitch">
    <div className="pitch-center-line" />
    <div className="pitch-circle" />
    {[0, 1, 2].map(i => <button key={i} type="button" className={'pitch-lane lane-' + i + (i === pressureLane ? ' pressured' : '') + (selectedLane === i ? ' selected' : '')} onClick={() => onPick(i)}>
      <span>{LANES[i]}</span>
      <small>{i === pressureLane ? '3 DEFENSORES' : i === 1 ? 'PASE FILTRADO' : 'ESPACIO'}</small>
      <i className="runner-dot" />
      {i === pressureLane ? <><i className="defender-dot d1" /><i className="defender-dot d2" /><i className="defender-dot d3" /></> : <i className="defender-dot d1" />}
    </button>)}
    <div className="pitch-ball">⚽</div>
  </div>;
}

export default function MatchSim({ a, b, script, round = 0, onFinish }) {
  const userSide = a.isPlayer || !b.isPlayer ? 0 : 1;
  const baseDifficulty = useMemo(() => matchDifficulty(a, b, userSide, round), [a, b, userSide, round]);
  const userTeam = userSide === 0 ? a : b;
  const rivalTeam = userSide === 0 ? b : a;
  const myMetrics = useMemo(() => teamMetrics(userTeam), [userTeam]);
  const rivalMetrics = useMemo(() => teamMetrics(rivalTeam), [rivalTeam]);
  const environment = useMemo(() => ({
    surface: SURFACES[rand(SURFACES.length)],
    tempo: TEMPOS[rand(TEMPOS.length)],
    crowd: clamp(.06 + round * .045 + Math.max(0, rivalTeam.strength - 90) * .004, .05, .24)
  }), [round, rivalTeam.strength]);

  const [minute, setMinute] = useState(0);
  const [moment, setMoment] = useState(null);
  const [needle, setNeedle] = useState(0);
  const [step, setStep] = useState(0);
  const [timingHits, setTimingHits] = useState([]);
  const [selectedLane, setSelectedLane] = useState(null);
  const [flash, setFlash] = useState(null);
  const [log, setLog] = useState([]);
  const [reactionCue, setReactionCue] = useState(false);
  const [momentum, setMomentum] = useState(0);
  const [shootout, setShootout] = useState(null);
  const [shootDir, setShootDir] = useState(null);
  const [shootFlash, setShootFlash] = useState(null);
  const done = useRef([]);
  const reactionTimeout = useRef(null);

  const plan = useMemo(() => {
    const count = round === 0 ? 4 : round === 1 ? 5 : 6;
    const attackGames = ['penal', 'freekick', 'oneonone', 'cross', 'counter', 'longshot'];
    const used = [];
    while (used.length < count - 1) {
      const game = attackGames[rand(attackGames.length)];
      if (!used.includes(game) || used.length >= attackGames.length) used.push(game);
    }
    used.splice(Math.min(1, used.length), 0, 'save');
    if (round === 2 && !used.includes('penal')) used[used.length - 2] = 'penal';
    const minuteSets = count === 4 ? [18, 39, 65, 84] : count === 5 ? [14, 32, 52, 72, 87] : [12, 28, 45, 61, 77, 89];
    return used.slice(0, count).map((game, i) => {
      const defensivePenalty = round === 2 && game === 'penal' && i === count - 2 && Math.random() < .42;
      const attack = game !== 'save' && !defensivePenalty;
      const side = attack ? userSide : 1 - userSide;
      const attackingTeam = side === 0 ? a : b;
      const defendingTeam = side === 0 ? b : a;
      const preferred = game === 'freekick' || game === 'cross' || game === 'longshot' ? ['MED', 'DEL'] : ['DEL', 'MED'];
      return {
        id: i + '-' + game,
        minute: clamp(minuteSets[i] + rand(7) - 3, 4, 89),
        game,
        attack,
        side,
        player: pickPlayer(attackingTeam, preferred),
        keeper: pickPlayer(defendingTeam, ['ARQ']),
        keeperLane: rand(3),
        pressureLane: rand(3),
        targetLane: rand(3),
        defensiveLane: rand(3),
        clutch: round === 2 && i === count - 1
      };
    }).sort((x, y) => x.minute - y.minute);
  }, [a, b, round, userSide]);

  const paused = !!moment || !!flash || !!shootout?.active;
  const finished = minute >= 90 && !moment && !flash;
  const teamName = side => side === 0 ? a.name : b.name;

  const events = useMemo(() => [
    ...script.eventsA.map(e => ({ m: e.minute, side: 0, scorer: e.scorer })),
    ...script.eventsB.map(e => ({ m: e.minute, side: 1, scorer: e.scorer }))
  ].sort((x, y) => x.m - y.m || x.side - y.side), [script]);

  const goalsA = events.filter(e => e.m <= minute && e.side === 0).length + log.filter(e => e.m <= minute && e.side === 0 && e.goal).length;
  const goalsB = events.filter(e => e.m <= minute && e.side === 1).length + log.filter(e => e.m <= minute && e.side === 1 && e.goal).length;
  const shown = [...events.filter(e => e.m <= minute), ...log.filter(e => e.m <= minute)].sort((x, y) => y.m - x.m || y.side - x.side);

  const myGoals = userSide === 0 ? goalsA : goalsB;
  const rivalGoals = userSide === 0 ? goalsB : goalsA;
  const fatigue = clamp((minute / 90) * (.14 + (environment.tempo.pace - 1) * .2), 0, .22);
  const scorePressure = minute > 68 ? clamp((rivalGoals - myGoals) * .07 + (minute - 68) * .003, 0, .24) : 0;
  const matchPressure = clamp(environment.crowd + environment.tempo.pressure + scorePressure - momentum * .025, .02, .42);
  const dynamicDifficulty = clamp(baseDifficulty + fatigue + matchPressure * .6 - momentum * .035, .78, 1.9);

  const currentPlayerRating = moment?.player?.rating || userTeam.strength || 80;
  const roleBonus = moment ? (ROLE_BONUS[moment.game]?.[moment.player?.position] || 0) : 0;
  const composure = clamp(currentPlayerRating + roleBonus + momentum * 2.5 - matchPressure * 22 - fatigue * 18, 55, 103);

  const timingProfile = (m, currentStep) => {
    const profiles = {
      penal: [{ label: 'PRECISIÓN', width: 25, speed: 2.2 }],
      freekick: [{ label: 'POTENCIA', width: 29, speed: 2.05 }, { label: 'ROSCA', width: 17, speed: 2.9 }],
      cross: [{ label: 'CALIDAD DEL CENTRO', width: 25, speed: 2.35 }, { label: 'TIMING DEL CABEZAZO', width: 15, speed: 3.15 }],
      longshot: [{ label: 'POTENCIA', width: 23, speed: 2.55 }, { label: 'COLOCACIÓN', width: 14, speed: 3.35 }]
    };
    const p = (profiles[m.game] || profiles.penal)[currentStep] || profiles.penal[0];
    const skill = skillScale(composure);
    const width = clamp(p.width * skill * environment.surface.control / dynamicDifficulty, 7, 36);
    const speed = clamp(p.speed * dynamicDifficulty * environment.surface.speed / skill, 1.55, 5.1);
    return { label: p.label, width, speed };
  };

  const clearMoment = () => {
    setMoment(null);
    setStep(0);
    setTimingHits([]);
    setSelectedLane(null);
    setNeedle(0);
    setReactionCue(false);
    if (reactionTimeout.current) clearTimeout(reactionTimeout.current);
  };

  const finishMoment = (success, headline, subline, visual = {}) => {
    if (!moment) return;
    const goal = moment.attack ? success : !success;
    const attackingTeam = moment.side === 0 ? a : b;
    const scorer = goal ? pickScorer(attackingTeam) : null;
    setMomentum(m => clamp(m + (success ? 1 : -1), -3, 3));
    setLog(l => [...l, { m: minute, side: moment.side, goal, scorer, kind: moment.game, label: headline }]);
    setFlash({
      goal,
      headline,
      subline,
      scorer,
      defensive: !moment.attack,
      lane: visual.lane ?? selectedLane ?? moment.targetLane,
      game: moment.game,
      keeperLane: moment.keeperLane
    });
    clearMoment();
    setTimeout(() => setFlash(null), 1450);
  };

  useEffect(() => {
    if (finished || paused) return;
    const timer = setInterval(() => setMinute(m => Math.min(90, m + 1)), 145);
    return () => clearInterval(timer);
  }, [finished, paused]);

  useEffect(() => {
    if (paused || minute >= 90) return;
    const next = plan.find(p => !done.current.includes(p.id) && p.minute <= minute);
    if (next) {
      done.current = [...done.current, next.id];
      setStep(0);
      setTimingHits([]);
      setSelectedLane(null);
      setNeedle(0);
      setMoment(next);
    }
  }, [minute, paused, plan]);

  const currentTiming = moment && ['penal', 'freekick', 'cross', 'longshot'].includes(moment.game) && !(moment.game === 'penal' && !moment.attack)
    ? timingProfile(moment, step)
    : null;

  useEffect(() => {
    if (!moment || !currentTiming || selectedLane === null) return;
    let pos = 0;
    let dir = 1;
    const timer = setInterval(() => {
      pos += dir * currentTiming.speed;
      if (pos >= 100) { pos = 100; dir = -1; }
      if (pos <= 0) { pos = 0; dir = 1; }
      setNeedle(pos);
    }, 28);
    return () => clearInterval(timer);
  }, [moment?.id, step, currentTiming?.speed, selectedLane]);

  useEffect(() => {
    if (!moment || moment.game !== 'save') return;
    setReactionCue(false);
    const prep = setTimeout(() => {
      setReactionCue(true);
      const keeperRating = moment.keeper?.rating || myMetrics.keeper || 80;
      const keeperSkill = skillScale(keeperRating + (ROLE_BONUS.save.ARQ || 0));
      const windowMs = clamp(1040 * keeperSkill / dynamicDifficulty * (1 - fatigue * .35), 410, 1250);
      reactionTimeout.current = setTimeout(() => finishMoment(false, '¡GOL RIVAL!', 'Llegaste tarde al remate.', { lane: moment.targetLane }), windowMs);
    }, 420 + rand(450));
    return () => {
      clearTimeout(prep);
      if (reactionTimeout.current) clearTimeout(reactionTimeout.current);
    };
  }, [moment?.id]);

  const stopTiming = () => {
    if (!moment || !currentTiming || selectedLane === null) return;
    const distance = Math.abs(needle - moment.center);
    const hit = distance <= currentTiming.width / 2;
    const perfect = distance <= currentTiming.width * .16;
    const nextHits = [...timingHits, { hit, perfect }];
    const totalSteps = ['freekick', 'cross', 'longshot'].includes(moment.game) ? 2 : 1;
    if (step + 1 < totalSteps) {
      setTimingHits(nextHits);
      setStep(s => s + 1);
      setNeedle(0);
      return;
    }

    const clean = nextHits.every(x => x.hit);
    const perfectCount = nextHits.filter(x => x.perfect).length;
    const keeper = moment.keeper?.rating || rivalMetrics.keeper || 80;
    const keeperEdge = clamp((keeper - composure) / 100, -.16, .18);

    if (moment.game === 'penal') {
      const beatsKeeper = selectedLane !== moment.keeperLane || perfectCount > 0;
      const success = clean && beatsKeeper;
      finishMoment(success, success ? '¡GOL DE PENAL!' : clean ? '¡ATAJÓ!' : '¡AFUERA!', success ? 'Dirección y temple perfectos.' : clean ? 'El arquero leyó el remate.' : 'La presión movió el pie.', { lane: selectedLane });
    }

    if (moment.game === 'freekick') {
      const wallPenalty = selectedLane === 1 ? .07 : 0;
      const goalChance = clamp(.9 - keeperEdge - wallPenalty - matchPressure * .12 + perfectCount * .08, .48, .97);
      const success = clean && Math.random() < goalChance;
      finishMoment(success, success ? '¡GOLAZO DE TIRO LIBRE!' : clean ? '¡VOLÓ EL ARQUERO!' : '¡A LA BARRERA!', success ? 'Potencia, rosca y dirección.' : clean ? 'El arquero sacó una imposible.' : 'La ejecución no salió limpia.', { lane: selectedLane });
    }

    if (moment.game === 'longshot') {
      const longEdge = (myMetrics.midfield - rivalMetrics.defense) / 180;
      const goalChance = clamp(.72 + longEdge - keeperEdge - matchPressure * .08 + perfectCount * .1, .35, .93);
      const success = clean && Math.random() < goalChance;
      finishMoment(success, success ? '¡MISIL DE AFUERA!' : clean ? '¡MANOTAZO!' : '¡SE FUE!', success ? 'Le pegaste con todo y al lugar justo.' : clean ? 'El arquero reaccionó a tiempo.' : 'No salió centrado el remate.', { lane: selectedLane });
    }

    if (moment.game === 'cross') {
      const duelEdge = (composure - rivalMetrics.defense) / 120;
      const crowded = selectedLane === moment.defensiveLane;
      const headerChance = clamp(.82 + duelEdge - (crowded ? .22 : 0) - fatigue * .2 + perfectCount * .08, .38, .96);
      const success = clean && Math.random() < headerChance;
      finishMoment(success, success ? '¡CABEZAZO Y GOL!' : clean ? '¡GANÓ EL DUELO EL CENTRAL!' : '¡MAL CENTRO!', success ? 'Centro medido y cabezazo de manual.' : clean ? 'La defensa ganó por arriba.' : 'La pelota no llegó limpia.', { lane: selectedLane });
    }
  };

  const chooseOneOnOne = lane => {
    const keeperRating = moment.keeper?.rating || rivalMetrics.keeper;
    const readKeeper = lane !== moment.keeperLane;
    const finishingEdge = (composure - keeperRating) / 100;
    const chance = clamp(.76 + finishingEdge - matchPressure * .12 - fatigue * .16, .45, .95);
    const goal = readKeeper && Math.random() < chance;
    finishMoment(goal, goal ? '¡DEFINICIÓN PERFECTA!' : readKeeper ? '¡SE HIZO GIGANTE!' : '¡LO LEYÓ!', goal ? moment.player.name + ' esperó al arquero.' : readKeeper ? 'Elegiste bien, pero el arquero llegó.' : 'El arquero leyó la intención.', { lane });
  };

  const chooseCounter = lane => {
    setSelectedLane(lane);
    const read = lane !== moment.pressureLane;
    const transitionEdge = (myMetrics.midfield + myMetrics.attack - rivalMetrics.midfield - rivalMetrics.defense) / 220;
    const chance = clamp(.67 + transitionEdge + (composure - 80) * .006 - dynamicDifficulty * .08, .38, .91);
    const goal = read && Math.random() < chance;
    finishMoment(goal, goal ? '¡CONTRA LETAL!' : read ? '¡LA CORTARON AL FINAL!' : '¡TE ENCERRARON!', goal ? 'Leíste el espacio y atacaste a máxima velocidad.' : read ? 'La lectura fue buena; faltó la última.' : 'Entraste justo donde estaba la superioridad rival.', { lane });
  };

  const choosePenaltySave = lane => {
    const save = lane === moment.keeperLane;
    finishMoment(save, save ? '¡ATAJÓ EL PENAL!' : '¡GOL RIVAL!', save ? moment.keeper.name + ' eligió el palo correcto.' : 'El pateador te mandó al otro lado.', { lane: moment.keeperLane });
  };

  const chooseSave = lane => {
    if (!reactionCue) return;
    if (reactionTimeout.current) clearTimeout(reactionTimeout.current);
    const correct = lane === moment.targetLane;
    const keeperRating = moment.keeper?.rating || myMetrics.keeper;
    const lateSaveChance = clamp(.86 + (keeperRating - 85) * .008 - dynamicDifficulty * .07 - fatigue * .16, .58, .97);
    const save = correct && Math.random() < lateSaveChance;
    finishMoment(save, save ? '¡ATAJADÓN!' : correct ? '¡LE PASÓ POR ABAJO!' : '¡GOL RIVAL!', save ? moment.keeper.name + ' reaccionó a puro reflejo.' : correct ? 'Llegaste al palo, pero no alcanzó.' : 'Fuiste al lugar equivocado.', { lane: moment.targetLane });
  };

  const startShootout = () => {
    setShootDir(null);
    setShootFlash(null);
    setNeedle(0);
    setShootout({ active: true, a: 0, b: 0, kicksA: 0, kicksB: 0, turn: 0, done: false, winner: null, opponentDir: rand(3) });
  };

  const shootSide = shootout ? shootout.turn % 2 : null;
  const userShooting = shootout?.active && shootSide === userSide;

  useEffect(() => {
    if (!shootout?.active || shootout.done || !userShooting || shootDir === null) return;
    let pos = 0;
    let dir = 1;
    const shooter = pickPlayer(userTeam, ['DEL', 'MED']);
    const shootPressure = clamp(environment.crowd + round * .06 + (shootout.turn >= 8 ? .12 : 0), .08, .45);
    const effective = shooter.rating - shootPressure * 20;
    const speed = clamp(3 * baseDifficulty / skillScale(effective), 2.2, 4.9);
    const timer = setInterval(() => {
      pos += dir * speed;
      if (pos >= 100) { pos = 100; dir = -1; }
      if (pos <= 0) { pos = 0; dir = 1; }
      setNeedle(pos);
    }, 28);
    return () => clearInterval(timer);
  }, [shootout?.turn, shootout?.active, shootout?.done, userShooting, shootDir, baseDifficulty, round]);

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
    const width = clamp(25 * skillScale(shooter.rating - matchPressure * 16) / baseDifficulty, 10, 31);
    const distance = Math.abs(needle - 50);
    const onTarget = distance <= width / 2;
    const perfect = distance <= width * .14;
    const keeperLane = rand(3);
    const goal = onTarget && (keeperLane !== shootDir || perfect);
    setShootFlash({ text: goal ? '¡GOL!' : onTarget ? '¡ATAJÓ!' : '¡AFUERA!', goal, lane: shootDir, keeperLane });
    setTimeout(() => { setShootFlash(null); recordShootoutKick(goal); }, 850);
  };

  const saveShootoutPenalty = lane => {
    const shooterQuality = rivalMetrics.attack;
    const missChance = clamp(.07 - (shooterQuality - 85) * .003, .015, .08);
    const miss = Math.random() < missChance;
    const save = !miss && lane === shootout.opponentDir;
    const goal = !miss && !save;
    setShootFlash({ text: miss ? '¡AFUERA!' : save ? '¡ATAJASTE!' : '¡GOL RIVAL!', goal, lane: shootout.opponentDir, keeperLane: lane });
    setTimeout(() => { setShootFlash(null); recordShootoutKick(goal); }, 850);
  };

  const finish = () => {
    onFinish({
      goalsA,
      goalsB,
      pensA: shootout?.done ? shootout.a : undefined,
      pensB: shootout?.done ? shootout.b : undefined
    });
  };

  const laneLabelsForMoment = moment?.game === 'cross' ? CROSS_LANES : LANES;
  const needsLane = currentTiming && selectedLane === null;

  const renderMoment = () => {
    if (!moment) return null;
    const clutch = moment.clutch || minute >= 85;
    return <div className={'sim-moment ' + (clutch ? 'clutch' : '')}>
      {clutch && <div className="clutch-banner"><Zap size={14} /> ÚLTIMA DEL PARTIDO · TODO O NADA</div>}

      <div className="moment-title-row">
        <div>
          <span className="moment-kicker">{moment.attack ? moment.player.name : moment.keeper.name} · {moment.attack ? moment.player.position : 'ARQ'} · {moment.attack ? moment.player.rating : moment.keeper.rating || myMetrics.keeper}</span>
          <strong>{GAME_LABELS[moment.game]}</strong>
        </div>
        <span className="difficulty-chip">DIF. {Math.round(dynamicDifficulty * 100)}</span>
      </div>

      <div className="moment-variables">
        <span><b>{Math.round(composure)}</b> COMPOSTURA</span>
        <span><b>{Math.round(matchPressure * 100)}</b> PRESIÓN</span>
        <span><b>{Math.round(fatigue * 100)}</b> FATIGA</span>
        <span><b>{momentum > 0 ? '+' + momentum : momentum}</b> MOMENTO</span>
      </div>

      {['penal', 'freekick', 'cross', 'longshot'].includes(moment.game) && moment.attack && <>
        <p>{needsLane ? (moment.game === 'cross' ? 'Elegí dónde mandar el centro.' : 'Elegí dónde querés colocar la pelota.') : moment.game === 'freekick' ? 'Ahora combiná potencia y rosca.' : moment.game === 'cross' ? 'Clavá el centro y después atacá el cabezazo.' : moment.game === 'longshot' ? 'Primero potencia, después colocación.' : 'Ahora clavá la precisión.'}</p>
        <GoalStage
          mode={moment.game}
          keeperLane={moment.keeperLane}
          selectedLane={selectedLane}
          onPick={needsLane ? setSelectedLane : null}
          wall={moment.game === 'freekick' || moment.game === 'longshot'}
          laneLabels={laneLabelsForMoment}
        />
        {!needsLane && currentTiming && <>
          <div className="timing-label">{currentTiming.label} · PASO {step + 1}</div>
          <div className="moment-track">
            <div className="moment-zone goal" style={{ left: (moment.center - currentTiming.width / 2) + '%', width: currentTiming.width + '%' }} />
            <div className="moment-needle" style={{ left: needle + '%' }} />
          </div>
          <button className="moment-btn moment-stop" onClick={stopTiming}>¡AHORA!</button>
        </>}
      </>}

      {moment.game === 'oneonone' && <>
        <p>Leé el cuerpo del arquero. No te dice el palo: te lo insinúa.</p>
        <GoalStage mode="oneonone" keeperLane={moment.keeperLane} onPick={chooseOneOnOne} />
      </>}

      {moment.game === 'counter' && <>
        <p>La defensa se cargó hacia un sector. Atacá el espacio antes de que cierre.</p>
        <PitchStage pressureLane={moment.pressureLane} selectedLane={selectedLane} onPick={chooseCounter} />
      </>}

      {moment.game === 'save' && <>
        <p>{reactionCue ? '¡YA! Seguí la pelota y tirate.' : 'No te tires antes. Esperá a ver salir la pelota.'}</p>
        <GoalStage mode="save" keeperLane={1} targetLane={moment.targetLane} live={reactionCue} onPick={reactionCue ? chooseSave : null} defensive />
      </>}

      {moment.game === 'penal' && !moment.attack && <>
        <p>El rival ya eligió. Vos elegí dónde volar.</p>
        <GoalStage mode="penal-save" keeperLane={1} onPick={choosePenaltySave} defensive />
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
      </> : shootFlash ? <>
        <GoalStage mode="shootout-result" keeperLane={shootFlash.keeperLane} result={{ goal: shootFlash.goal, lane: shootFlash.lane }} />
        <div className="shootout-flash">{shootFlash.text}</div>
      </> : userShooting ? <>
        <h3>Patea {sideName}</h3>
        {shootDir === null ? <>
          <p>Elegí el rincón. Después vas a tener que clavar el timing.</p>
          <GoalStage mode="shootout" keeperLane={1} onPick={setShootDir} />
        </> : <>
          <p>Elegiste <b>{LANES[shootDir]}</b>. Ahora no tiembles.</p>
          <GoalStage mode="shootout" keeperLane={1} selectedLane={shootDir} />
          <div className="moment-track shootout-track">
            <div className="moment-zone goal" style={{ left: '39%', width: '22%' }} />
            <div className="moment-needle" style={{ left: needle + '%' }} />
          </div>
          <button className="moment-btn" onClick={shootPenalty}>¡PATEAR!</button>
        </>}
      </> : <>
        <h3>¡ATAJÁ EL PENAL!</h3>
        <p>Elegí el palo antes del remate de {sideName}.</p>
        <GoalStage mode="shootout-save" keeperLane={1} onPick={saveShootoutPenalty} defensive />
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
      <span><Gauge size={12} /> {environment.tempo.name}</span>
      <span><Activity size={12} /> CÉSPED {environment.surface.name}</span>
      <span><Target size={12} /> DIF. {Math.round(dynamicDifficulty * 100)}</span>
      <span><Zap size={12} /> {plan.length} MOMENTOS</span>
    </div>

    <div className="team-variable-strip">
      <span><b>{myMetrics.attack.toFixed(0)}</b> ATAQUE</span>
      <span><b>{myMetrics.midfield.toFixed(0)}</b> MEDIO</span>
      <span><b>{myMetrics.defense.toFixed(0)}</b> DEFENSA</span>
      <span><b>{myMetrics.keeper.toFixed(0)}</b> ARQ</span>
    </div>

    {renderMoment()}

    {flash && <div className={'sim-flash ' + (flash.goal ? 'goal' : 'save')}>
      <GoalStage mode={'result-' + flash.game} keeperLane={flash.keeperLane} result={{ goal: flash.goal, lane: flash.lane }} />
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
      <p>{goalsA === goalsB ? 'Acá ya no decide el simulador: pateás y atajás vos.' : 'Nivel, posiciones, arquero, césped, ritmo, presión, fatiga, momento y tus decisiones movieron el partido.'}</p>
      {goalsA === goalsB
        ? <button className="primary-button" onClick={startShootout}><Target size={16} />Jugar los penales</button>
        : <button className="primary-button" onClick={finish}><Swords size={16} />Continuar</button>}
    </div>}
  </div>;
}
