import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Swords, Shield, Target, Zap, Gauge, Activity } from 'lucide-react';
import { playerSkill } from '@/components/crack/catalog';
import { playFeedback } from '@/components/crack/feedback';

const PHRASES = ['¡GOLAZO!', '¡De penal!', '¡Golpe de efecto!', '¡Qué definición!', '¡De cabeza al ángulo!', '¡Contragolpe letal!', '¡Zurdazo imposible!', '¡La picó por encima del arquero!', '¡Palomita!', '¡La rompió al palo izquierdo!'];
const LANES = ['IZQUIERDA', 'CENTRO', 'DERECHA'];
const CROSS_LANES = ['PRIMER PALO', 'PUNTO PENAL', 'SEGUNDO PALO'];
const PENALTY_ZONES = ['ARRIBA IZQ.', 'ARRIBA CENTRO', 'ARRIBA DER.', 'ABAJO IZQ.', 'ABAJO CENTRO', 'ABAJO DER.'];
const LONGSHOT_ZONES = ['ÁNGULO IZQ.', 'ÁNGULO DER.', 'ABAJO IZQ.', 'ABAJO DER.'];
const GAME_LABELS = {
  penal: 'PENAL',
  freekick: 'TIRO LIBRE',
  oneonone: 'MANO A MANO',
  save: 'REFLEJOS',
  cross: 'CENTRO + CABEZAZO',
  counter: 'CONTRAATAQUE',
  longshot: 'REMATE DE AFUERA'
};
const GAME_SKILL_LABELS = {
  penal: 'FIN + TEC',
  freekick: 'BAL + TEC',
  oneonone: 'FIN + VEL',
  save: 'ARQ',
  cross: 'PAS + TEC',
  counter: 'VEL + PAS',
  longshot: 'FIN + TEC'
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
const shuffleValues = values => {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const makeBadPenaltyZones = () => {
  const first = rand(6);
  let second = rand(5);
  if (second >= first) second += 1;
  return [first, second];
};
const makeDistinctZones = n => {
  const first = rand(n);
  let second = rand(n - 1);
  if (second >= first) second += 1;
  return [first, second];
};
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const average = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

const skillAverage = (players, positions, keys, fallback) => {
  const pool = players.filter(p => positions.includes(p.position));
  if (!pool.length) return fallback;
  return average(pool.map(p => average(keys.map(key => playerSkill(p, key)))));
};

const teamMetrics = team => {
  const players = team.players?.length ? team.players : team.scorers || [];
  const base = team.strength || 80;
  return {
    overall: base,
    attack: skillAverage(players, ['DEL'], ['finishing', 'technique', 'pace'], base),
    midfield: skillAverage(players, ['MED'], ['passing', 'technique', 'physical'], base),
    defense: skillAverage(players, ['DEF'], ['defense', 'physical', 'pace'], base),
    keeper: skillAverage(players, ['ARQ'], ['goalkeeping'], base),
    pace: average(players.map(p => playerSkill(p, 'pace'))) || base,
    passing: average(players.map(p => playerSkill(p, 'passing'))) || base,
    setPieces: average(players.map(p => playerSkill(p, 'setPieces'))) || base
  };
};

const relevantPlayerSkill = (player, game) => {
  if (!player) return 80;
  const keys = {
    penal: ['finishing', 'technique'],
    freekick: ['setPieces', 'technique'],
    oneonone: ['finishing', 'pace'],
    cross: ['passing', 'technique'],
    counter: ['pace', 'passing'],
    longshot: ['finishing', 'technique'],
    save: ['goalkeeping']
  }[game] || ['technique'];
  return average(keys.map(key => playerSkill(player, key)));
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
const featuredPlayer = team => {
  const players = team.players?.length ? team.players : team.scorers || [];
  if (!players.length) return { name: team.name, rating: Math.round(team.strength || 80), position: 'XI' };
  return [...players].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
};

const pickAssistant = (team, scorer) => {
  const all = team.players?.length ? team.players : team.scorers || [];
  const pool = all.filter(p => p.name !== scorer && p.position !== 'ARQ');
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)].name;
};
const skillScale = rating => clamp(.8 + ((rating || 80) - 68) * .013, .78, 1.24);

const matchDifficulty = (a, b, userSide, round) => {
  const me = userSide === 0 ? a : b;
  const rival = userSide === 0 ? b : a;
  const roundBase = [0.94, 1.06, 1.2][round] || .94;
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

function LongShotAimStage({ aimX = 50, aimY = 50, onShoot = null, result = null }) {
  const x = result?.x ?? aimX;
  const y = result?.y ?? aimY;
  return <div className={'longshot-aim-stage' + (result ? ' result' : '')}>
    <div className="longshot-aim-arena">
      <div className="longshot-aim-goal">
        <div className="goal-net" />
        <div className="longshot-center-danger"><span>ATAJABLE</span></div>
        <div className="longshot-corner-hint left">ÁNGULO</div>
        <div className="longshot-corner-hint right">ÁNGULO</div>
        <div className="longshot-aim-keeper">
          <i className="keeper-head" /><i className="keeper-body" /><i className="keeper-arm left" /><i className="keeper-arm right" /><i className="keeper-leg left" /><i className="keeper-leg right" />
        </div>
      </div>
      <div className={'longshot-reticle' + (result ? (result.goal ? ' scored' : ' stopped') : '')} style={{ left: x + '%', top: y + '%' }}>
        <i />
      </div>
      {result && <div className={'longshot-result-ball ' + (result.goal ? 'goal' : 'save')} style={{ left: x + '%', top: y + '%' }}>⚽</div>}
    </div>
    <div className="longshot-aim-field">
      <span>REMATE LEJANO · LA MIRA TAMBIÉN SALE DEL ARCO</span>
      {!result && <button type="button" onClick={onShoot}>¡PEGARLE!</button>}
    </div>
  </div>;
}

function FreeKickFifaStage({ target, onTarget, onShoot }) {
  const [drag, setDrag] = useState(null);

  const aim = event => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 7, 93);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 7, 76);
    onTarget({ x, y });
  };

  const startSwipe = event => {
    if (!target) return;
    const pad = event.currentTarget.closest('.fk-swipe-pad');
    const rect = pad.getBoundingClientRect();
    const start = { x: rect.width / 2, y: rect.height - 30 };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({ start, current: start, rect });
  };

  const moveSwipe = event => {
    if (!drag) return;
    const current = {
      x: clamp(event.clientX - drag.rect.left, 0, drag.rect.width),
      y: clamp(event.clientY - drag.rect.top, 0, drag.rect.height)
    };
    setDrag(value => value ? { ...value, current } : value);
  };

  const endSwipe = event => {
    if (!drag || !target) return;
    const current = {
      x: clamp(event.clientX - drag.rect.left, 0, drag.rect.width),
      y: clamp(event.clientY - drag.rect.top, 0, drag.rect.height)
    };
    const dx = current.x - drag.start.x;
    const up = drag.start.y - current.y;
    setDrag(null);
    onShoot({ target, dx, up });
  };

  return <div className="fifa-freekick">
    <div className="fifa-fk-goal" onPointerDown={aim}>
      <div className="goal-net" />
      <div className="fifa-fk-wall"><i /><i /><i /><i /></div>
      <div className="fifa-fk-keeper">
        <i className="keeper-head" /><i className="keeper-body" /><i className="keeper-arm left" /><i className="keeper-arm right" /><i className="keeper-leg left" /><i className="keeper-leg right" />
      </div>
      {target && <div className="fifa-fk-target" style={{ left: target.x + '%', top: target.y + '%' }}><i /></div>}
      <span className="fifa-fk-aim-note">{target ? 'OBJETIVO FIJADO' : 'TOCÁ EL ARCO PARA APUNTAR'}</span>
    </div>

    <div className={'fk-swipe-pad' + (target ? ' ready' : '')}>
      <div className="fk-swipe-guide">ARRASTRÁ LA PELOTA HACIA ARRIBA · EL DESVÍO LATERAL DA ROSCA</div>
      {drag && <svg className="fk-swipe-line" viewBox={'0 0 ' + drag.rect.width + ' ' + drag.rect.height} preserveAspectRatio="none">
        <line x1={drag.start.x} y1={drag.start.y} x2={drag.current.x} y2={drag.current.y} />
      </svg>}
      <button
        type="button"
        className="fk-swipe-ball"
        disabled={!target}
        onPointerDown={startSwipe}
        onPointerMove={moveSwipe}
        onPointerUp={endSwipe}
        onPointerCancel={() => setDrag(null)}
      >⚽</button>
      <span className="fk-power-hint">POTENCIA</span>
      <span className="fk-curve-hint left">↖ ROSCA</span>
      <span className="fk-curve-hint right">ROSCA ↗</span>
    </div>
  </div>;
}

function CrossChoiceStage({ onPick, selectedLane = null }) {
  return <div className="cross-choice-stage mystery-cross">
    <div className="cross-box-line" />
    <div className="cross-goal-mini" />
    {[0, 1, 2].map(i => <button
      key={i}
      type="button"
      className={'cross-zone mystery lane-' + i + (selectedLane === i ? ' selected' : '')}
      onClick={() => onPick?.(i)}
      disabled={!onPick}
    >
      <span>{CROSS_LANES[i]}</span>
      <div className="cross-mystery-mark">?</div>
      <small>ZONA MISTERIOSA</small>
    </button>)}
    <div className="cross-ball-origin">⚽</div>
  </div>;
}

function PitchStage({ pressureLane, selectedLane = null, onPick = null }) {
  return <div className="mini-pitch">
    <div className="pitch-center-line" />
    <div className="pitch-circle" />
    {[0, 1, 2].map(i => <button key={i} type="button" className={'pitch-lane lane-' + i + (i === pressureLane ? ' pressured' : '') + (selectedLane === i ? ' selected' : '')} onClick={() => onPick?.(i)} disabled={!onPick}>
      <span>{LANES[i]}</span>
      <small>{i === pressureLane ? '3 DEFENSORES' : i === 1 ? 'PASE FILTRADO' : 'ESPACIO'}</small>
      <i className="runner-dot" />
      {i === pressureLane ? <><i className="defender-dot d1" /><i className="defender-dot d2" /><i className="defender-dot d3" /></> : <i className="defender-dot d1" />}
    </button>)}
    <div className="pitch-ball">⚽</div>
  </div>;
}

function CounterLaneStage({ lane, blockers = [], progress = 0, wave = 0, total = 5, onLane }) {
  return <div className="counter-runner-game">
    <div className="counter-runner-head">
      <span>OLEADA {Math.min(wave + 1, total)}/{total}</span>
      <b>CAMBIÁ LA PELOTA DE CARRIL</b>
    </div>
    <div className="counter-runner-pitch">
      <div className="counter-halfway" />
      {[0, 1, 2].map(i => <button
        type="button"
        key={i}
        className={'counter-runner-lane lane-' + i + (lane === i ? ' active' : '')}
        onClick={() => onLane(i)}
        aria-label={'Mover a ' + LANES[i]}
      >
        <span>{LANES[i]}</span>
      </button>)}
      {blockers.map((blockerLane, i) => <div
        key={blockerLane + '-' + i}
        className={'counter-chasing-defender lane-' + blockerLane}
        style={{ top: (8 + progress * .7) + '%' }}
      ><i /><b>{4 + i}</b></div>)}
      <div className={'counter-running-ball lane-' + lane}>⚽</div>
    </div>
    <div className="counter-runner-controls">
      <button type="button" onClick={() => onLane(Math.max(0, lane - 1))} disabled={lane === 0}>← CAMBIAR</button>
      <div className="counter-wave-bar"><i style={{ width: progress + '%' }} /></div>
      <button type="button" onClick={() => onLane(Math.min(2, lane + 1))} disabled={lane === 2}>CAMBIAR →</button>
    </div>
  </div>;
}

function ShootoutSixZone({ onPick, selected = null, badZones = [], reveal = false, result = null }) {
  return <div className={'six-zone-goal' + (reveal ? ' reveal' : '')}>
    <div className="six-zone-net" />
    <div className="six-zone-keeper">
      <i className="keeper-head" />
      <i className="keeper-body" />
      <i className="keeper-arm left" />
      <i className="keeper-arm right" />
      <i className="keeper-leg left" />
      <i className="keeper-leg right" />
    </div>
    {PENALTY_ZONES.map((label, i) => {
      const bad = badZones.includes(i);
      return <button
        key={label}
        type="button"
        className={'six-zone-cell zone-' + i + (selected === i ? ' selected' : '') + (reveal ? (bad ? ' no-goal' : ' goal-zone') : '')}
        onClick={() => onPick?.(i)}
        disabled={!onPick}
      >
        <span>{label}</span>
        {reveal && <small>{bad ? 'NO GOL' : 'GOL'}</small>}
      </button>;
    })}
    {result && <div className={'six-zone-ball ' + (result.goal ? 'goal' : 'miss') + ' zone-' + result.zone}>⚽</div>}
    <div className="six-zone-spot">⚽</div>
    <div className="six-zone-boot"><i /></div>
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

  const [kickoffReady, setKickoffReady] = useState(false);
  const [minute, setMinute] = useState(0);
  const [moment, setMoment] = useState(null);
  const [momentStarted, setMomentStarted] = useState(false);
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
  const shootoutBusy = useRef(false);
  const shootoutTimer = useRef(null);
  useEffect(() => () => clearTimeout(shootoutTimer.current), []);
  const [tactic, setTactic] = useState(null);
  const [aimTick, setAimTick] = useState(0);
  const [freeKickTarget, setFreeKickTarget] = useState(null);
  const [counterLane, setCounterLane] = useState(1);
  const [counterWave, setCounterWave] = useState(0);
  const [counterProgress, setCounterProgress] = useState(0);
  const done = useRef([]);
  const reactionTimeout = useRef(null);
  const counterLaneRef = useRef(1);
  const statEvents = useRef([]);

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
      const longshotBlocks = game === 'longshot' ? makeDistinctZones(4) : [0, 1];
      const counterPressures = game === 'counter' ? makeDistinctZones(3) : [0, 1];
      const counterWaves = game === 'counter'
        ? Array.from({ length: 5 }, (_, wave) => shuffleValues([0, 1, 2]).slice(0, wave >= 2 && wave % 2 === 0 ? 2 : 1))
        : [];
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
        counterPressureLanes: counterPressures,
        counterWaves,
        targetLane: rand(3),
        defensiveLane: rand(3),
        longshotKeeperZone: longshotBlocks[0],
        longshotDefenderZone: longshotBlocks[1],
        centers: [18 + rand(65), 18 + rand(65)],
        clutch: round === 2 && i === count - 1
      };
    }).sort((x, y) => x.minute - y.minute);
  }, [a, b, round, userSide]);

  const halftimePrompt = minute >= 45 && minute < 90 && tactic === null && !moment && !flash && !shootout?.active;
  const paused = !kickoffReady || !!moment || !!flash || !!shootout?.active || halftimePrompt;
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
  const tacticModifier = tactic === 'attack'
    ? (moment?.attack ? -.1 : .1)
    : tactic === 'close'
      ? (moment?.attack ? .08 : -.12)
      : tactic === 'balanced' ? -.02 : 0;
  const dynamicDifficulty = clamp(baseDifficulty + fatigue + matchPressure * .6 - momentum * .035 + tacticModifier, .72, 1.9);

  const relevantSkill = moment
    ? (moment.attack ? relevantPlayerSkill(moment.player, moment.game) : playerSkill(moment.keeper, 'goalkeeping'))
    : userTeam.strength || 80;
  const roleBonus = moment ? (ROLE_BONUS[moment.game]?.[moment.attack ? moment.player?.position : 'ARQ'] || 0) : 0;
  const composure = clamp(relevantSkill + roleBonus + momentum * 2.5 - matchPressure * 22 - fatigue * 18, 55, 103);
  const skillImpact = relevantSkill >= 90 ? 'VENTAJA TÉCNICA' : relevantSkill >= 82 ? 'BUEN CONTROL' : relevantSkill <= 72 ? 'MUY EXIGENTE' : 'NEUTRO';

  const getLongshotAim = tick => {
    const control = clamp(1.06 - (relevantSkill - 80) * .0048, .92, 1.16);
    const xAmp = clamp(52 - (relevantSkill - 80) * .1, 49, 55);
    const yAmp = clamp(47 - (relevantSkill - 80) * .08, 44, 50);
    return {
      x: 50 + xAmp * Math.sin(tick * .142 * control),
      y: 49 + yAmp * Math.sin(tick * .101 * control + 1.15)
    };
  };

  const timingProfile = (m, currentStep) => {
    const profiles = {
      penal: [{ label: 'PRECISIÓN', width: 25, speed: 2.2 }],
      cross: [{ label: 'POTENCIA', width: 15, speed: 3.65 }],
      longshot: [{ label: 'CONTACTO', width: 17, speed: 3.45 }]
    };
    const p = (profiles[m.game] || profiles.penal)[currentStep] || profiles.penal[0];
    const skill = skillScale(composure);
    const width = clamp(p.width * 1.16 * skill * environment.surface.control / dynamicDifficulty, 8, 39);
    const speed = clamp(p.speed * .9 * dynamicDifficulty * environment.surface.speed / skill, 1.4, 4.6);
    return { label: p.label, width, speed };
  };

  const clearMoment = () => {
    setMoment(null);
    setMomentStarted(false);
    setStep(0);
    setTimingHits([]);
    setSelectedLane(null);
    setNeedle(0);
    setAimTick(0);
    setFreeKickTarget(null);
    setCounterLane(1);
    counterLaneRef.current = 1;
    setCounterWave(0);
    setCounterProgress(0);
    setReactionCue(false);
    if (reactionTimeout.current) clearTimeout(reactionTimeout.current);
  };

  const finishMoment = (success, headline, subline, visual = {}) => {
    if (!moment) return;
    const goal = moment.attack ? success : !success;
    const attackingTeam = moment.side === 0 ? a : b;
    const defendingTeam = moment.side === 0 ? b : a;
    const scorer = goal
      ? (moment.attack && moment.player?.name ? moment.player.name : pickScorer(attackingTeam))
      : null;
    const assist = goal && moment.attack && ['cross', 'counter'].includes(moment.game)
      ? pickAssistant(attackingTeam, scorer)
      : null;

    if (goal && scorer) {
      statEvents.current.push({ type: 'goal', teamId: attackingTeam.id, player: scorer, minute, kind: moment.game, value: 1 });
      if (assist) statEvents.current.push({ type: 'assist', teamId: attackingTeam.id, player: assist, minute, kind: moment.game, value: 1 });
    }
    if (!moment.attack && success && moment.keeper?.name) {
      statEvents.current.push({ type: 'save', teamId: defendingTeam.id, player: moment.keeper.name, minute, kind: moment.game, value: 1 });
    }
    if (moment.attack && !success && moment.keeper?.name && /ATAJ|MANOTAZO|GIGANTE|AL CUERPO/i.test(headline)) {
      statEvents.current.push({ type: 'save', teamId: defendingTeam.id, player: moment.keeper.name, minute, kind: moment.game, value: 1 });
    }

    playFeedback(goal ? 'goal' : (!moment.attack && success) ? 'save' : 'miss');
    setMomentum(m => clamp(m + (success ? 1 : -1), -3, 3));
    setLog(l => [...l, { m: minute, side: moment.side, goal, scorer, assist, kind: moment.game, label: headline }]);
    setFlash({
      goal,
      headline,
      subline,
      scorer,
      assist,
      defensive: !moment.attack,
      lane: visual.lane ?? selectedLane ?? moment.targetLane,
      game: moment.game,
      keeperLane: moment.keeperLane,
      longshotZone: visual.longshotZone ?? null,
      longshotKeeperZone: moment.longshotKeeperZone,
      longshotDefenderZone: moment.longshotDefenderZone,
      longshotAimX: visual.longshotAimX ?? null,
      longshotAimY: visual.longshotAimY ?? null
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
      setAimTick(0);
      setFreeKickTarget(null);
      setCounterLane(1);
      counterLaneRef.current = 1;
      setCounterWave(0);
      setCounterProgress(0);
      setMomentStarted(false);
      setReactionCue(false);
      setMoment(next);
    }
  }, [minute, paused, plan]);

  const currentTiming = moment && ['penal', 'cross'].includes(moment.game) && moment.attack
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
    if (!moment || moment.game !== 'longshot' || !moment.attack) return;
    const timer = setInterval(() => setAimTick(t => t + 1), 24);
    return () => clearInterval(timer);
  }, [moment?.id]);

  useEffect(() => {
    if (!moment || moment.game !== 'counter' || !moment.attack || !momentStarted) return;
    const waves = moment.counterWaves?.length ? moment.counterWaves : [[moment.pressureLane]];
    const blockers = waves[counterWave] || waves[waves.length - 1];
    const counterSkill = relevantPlayerSkill(moment.player, 'counter');
    const duration = clamp((1700 - counterWave * 135) * skillScale(counterSkill) / dynamicDifficulty, 800, 1980);
    const started = Date.now();
    setCounterProgress(0);

    const timer = setInterval(() => {
      const progress = clamp(((Date.now() - started) / duration) * 100, 0, 100);
      setCounterProgress(progress);
    }, 32);

    const collision = setTimeout(() => {
      clearInterval(timer);
      const hit = blockers.includes(counterLaneRef.current);
      if (hit) {
        finishMoment(false, '¡TE COMIERON!', 'El defensor llegó al mismo carril que la pelota.', { lane: counterLaneRef.current });
        return;
      }

      if (counterWave >= waves.length - 1) {
        finishMoment(true, '¡CONTRA LETAL!', 'Fuiste cambiando de carril y dejaste atrás a todos los defensores.', { lane: counterLaneRef.current });
        return;
      }

      setCounterWave(w => w + 1);
      setCounterProgress(0);
    }, duration);

    return () => {
      clearInterval(timer);
      clearTimeout(collision);
    };
  }, [moment?.id, counterWave, momentStarted]);

  useEffect(() => {
    if (!moment || moment.game !== 'save' || !momentStarted) return;
    setReactionCue(false);
    const prep = setTimeout(() => {
      setReactionCue(true);
      const keeperRating = moment.keeper?.rating || myMetrics.keeper || 80;
      const keeperSkill = skillScale(keeperRating + (ROLE_BONUS.save.ARQ || 0));
      const windowMs = clamp(1190 * keeperSkill / dynamicDifficulty * (1 - fatigue * .3), 500, 1400);
      reactionTimeout.current = setTimeout(() => finishMoment(false, '¡GOL RIVAL!', 'Llegaste tarde al remate.', { lane: moment.targetLane }), windowMs);
    }, 420 + rand(450));
    return () => {
      clearTimeout(prep);
      if (reactionTimeout.current) clearTimeout(reactionTimeout.current);
    };
  }, [moment?.id, momentStarted]);

  const stopTiming = () => {
    if (!moment || !currentTiming || selectedLane === null) return;
    const timingCenter = moment.centers?.[step] ?? 50;
    const distance = Math.abs(needle - timingCenter);
    const hit = distance <= currentTiming.width / 2;
    const perfect = distance <= currentTiming.width * .16;
    const nextHits = [...timingHits, { hit, perfect }];
    const totalSteps = 1;
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
      return;
    }

    if (moment.game === 'cross') {
      const foundTarget = selectedLane === moment.targetLane;
      const success = clean && foundTarget;
      const targetName = CROSS_LANES[moment.targetLane];
      finishMoment(
        success,
        success ? '¡CABEZAZO Y GOL!' : foundTarget ? '¡CENTRO PASADO!' : '¡NO ESTABA AHÍ!',
        success
          ? 'Elegiste la zona correcta y clavaste la potencia.'
          : foundTarget
            ? 'Encontraste al receptor, pero fallaste la potencia.'
            : 'La zona correcta era ' + targetName + '.',
        { lane: selectedLane }
      );
      return;
    }

  };

  const shootLongShot = () => {
    if (!moment || moment.game !== 'longshot') return;
    const { x, y } = getLongshotAim(aimTick);

    // The goal is only part of the aiming area: from distance it is easy to miss the frame.
    const inGoal = x >= 13 && x <= 87 && y >= 12 && y <= 78;
    const goalX = clamp((x - 13) / 74 * 100, 0, 100);
    const goalY = clamp((y - 12) / 66 * 100, 0, 100);
    const outer = goalX < 30 || goalX > 70;
    const upper = goalY < 40;
    const corner = outer && upper;
    const distanceFromKeeper = Math.hypot((goalX - 50) / 50, (goalY - 62) / 50);
    const baseChance = corner ? .86 : outer ? .68 : upper ? .58 : .31;
    const skillBonus = (composure - 80) * .0045;
    const pressurePenalty = (dynamicDifficulty - 1) * .1;
    const goalChance = clamp(baseChance + skillBonus - pressurePenalty + distanceFromKeeper * .04, .18, .92);
    const goal = inGoal && Math.random() < goalChance;
    const lane = goalX < 33 ? 0 : goalX > 67 ? 2 : 1;

    let headline;
    let subline;
    if (!inGoal) {
      headline = y < 12 ? '¡SE FUE ALTA!' : x < 13 || x > 87 ? '¡SE FUE ANCHA!' : '¡AFUERA!';
      subline = 'Desde tan lejos el margen es mínimo: la mira quedó fuera del arco.';
    } else if (goal) {
      headline = corner ? '¡AL ÁNGULO!' : '¡GOLAZO DE AFUERA!';
      subline = corner ? 'La clavaste desde lejísimos.' : 'Entró, pero desde ahí había que ser finísimo.';
    } else {
      headline = outer ? '¡MANOTAZO!' : '¡AL CUERPO!';
      subline = outer ? 'Iba adentro, pero el arquero alcanzó a sacarla.' : 'Entró al arco demasiado cerca del arquero.';
    }

    finishMoment(goal, headline, subline, { lane, longshotAimX: x, longshotAimY: y });
  };

  const takeFreeKick = ({ target, dx, up }) => {
    if (!moment || moment.game !== 'freekick' || !target) return;

    const desiredCurve = target.x < 42 ? -38 : target.x > 58 ? 38 : 0;
    const fkSkill = relevantPlayerSkill(moment.player, 'freekick');
    const powerTolerance = clamp(70 + (fkSkill - 80) * .72, 60, 84);
    const curveTolerance = clamp(70 + (fkSkill - 80) * .68, 60, 84);
    const powerQuality = clamp(1 - Math.abs(up - 128) / powerTolerance, 0, 1);
    const curveQuality = clamp(1 - Math.abs(dx - desiredCurve) / curveTolerance, 0, 1);
    const leftCorner = Math.hypot(target.x - 16, target.y - 16);
    const rightCorner = Math.hypot(target.x - 84, target.y - 16);
    const cornerDistance = Math.min(leftCorner, rightCorner);
    const placementQuality = clamp(1 - cornerDistance / 62, 0, 1);
    const centralLow = target.x > 34 && target.x < 66 && target.y > 46;
    const tooWeak = up < 72;
    const tooStrong = up > 188;
    const quality = placementQuality * .48 + powerQuality * .32 + curveQuality * .2;
    const skillEdge = (fkSkill - 80) * .0031;
    const required = clamp(.75 + (dynamicDifficulty - 1) * .035 - skillEdge, .67, .83);
    const success = !centralLow && !tooWeak && !tooStrong && quality >= required;
    const lane = target.x < 36 ? 0 : target.x > 64 ? 2 : 1;

    let headline = '¡ATAJÓ!';
    let subline = 'La dirección quedó demasiado cómoda para el arquero.';
    if (tooWeak || centralLow) {
      headline = '¡A LA BARRERA!';
      subline = 'Le faltó altura o apuntaste demasiado al centro.';
    } else if (tooStrong) {
      headline = '¡SE FUE ALTA!';
      subline = 'Te pasaste de potencia en el gesto.';
    } else if (!success && placementQuality > .62) {
      headline = '¡ROZÓ EL PALO!';
      subline = curveQuality < powerQuality ? 'El objetivo era bueno, pero faltó rosca.' : 'La colocación era buena, pero la potencia no quedó fina.';
    }

    finishMoment(
      success,
      success ? '¡LA CLAVASTE!' : headline,
      success ? 'Objetivo, potencia y rosca: tiro libre perfecto.' : subline,
      { lane }
    );
  };

  const chooseCross = lane => {
    if (!moment || moment.game !== 'cross' || selectedLane !== null) return;
    if (lane !== moment.targetLane) {
      finishMoment(
        false,
        '¡CENTRO A NADIE!',
        'No había receptor en esa zona. La zona correcta era ' + CROSS_LANES[moment.targetLane] + '.',
        { lane }
      );
      return;
    }
    setSelectedLane(lane);
    setNeedle(0);
  };

  const moveCounterLane = lane => {
    if (!momentStarted) return;
    const nextLane = clamp(lane, 0, 2);
    counterLaneRef.current = nextLane;
    setCounterLane(nextLane);
  };

  const chooseOneOnOne = lane => {
    const keeperRating = moment.keeper?.rating || rivalMetrics.keeper;
    const readKeeper = lane !== moment.keeperLane;
    const finishingEdge = (composure - keeperRating) / 100;
    const chance = clamp(.81 + finishingEdge - matchPressure * .1 - fatigue * .13, .52, .97);
    const goal = readKeeper && Math.random() < chance;
    finishMoment(goal, goal ? '¡DEFINICIÓN PERFECTA!' : readKeeper ? '¡SE HIZO GIGANTE!' : '¡LO LEYÓ!', goal ? moment.player.name + ' esperó al arquero.' : readKeeper ? 'Elegiste bien, pero el arquero llegó.' : 'El arquero leyó la intención.', { lane });
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
    const lateSaveChance = clamp(.9 + (keeperRating - 85) * .008 - dynamicDifficulty * .055 - fatigue * .13, .66, .98);
    const save = correct && Math.random() < lateSaveChance;
    finishMoment(save, save ? '¡ATAJADÓN!' : correct ? '¡LE PASÓ POR ABAJO!' : '¡GOL RIVAL!', save ? moment.keeper.name + ' reaccionó a puro reflejo.' : correct ? 'Llegaste al palo, pero no alcanzó.' : 'Fuiste al lugar equivocado.', { lane: moment.targetLane });
  };

  const chooseTactic = value => {
    if (tactic !== null) return;
    setTactic(value);
    setMomentum(m => clamp(m + (value === 'attack' ? 1 : value === 'close' ? 0 : .5), -3, 3));
  };

  const startShootout = () => {
    clearTimeout(shootoutTimer.current);
    shootoutBusy.current = false;
    setShootDir(null);
    setShootFlash(null);
    setNeedle(0);
    setShootout({
      active: true,
      a: 0,
      b: 0,
      kicksA: 0,
      kicksB: 0,
      historyA: [],
      historyB: [],
      turn: 0,
      done: false,
      winner: null,
      badZones: makeBadPenaltyZones()
    });
  };

  const shootSide = shootout ? shootout.turn % 2 : null;
  const userShooting = shootout?.active && shootSide === userSide;

  const recordShootoutKick = goal => {
    const expectedTurn = shootout.turn;
    const badZones = makeBadPenaltyZones();
    setShootout(s => {
      if (!s || s.done || s.turn !== expectedTurn) return s;
      const side = s.turn % 2;
      const next = {
        ...s,
        a: s.a + (side === 0 && goal ? 1 : 0),
        b: s.b + (side === 1 && goal ? 1 : 0),
        kicksA: s.kicksA + (side === 0 ? 1 : 0),
        kicksB: s.kicksB + (side === 1 ? 1 : 0),
        historyA: side === 0 ? [...s.historyA, goal] : s.historyA,
        historyB: side === 1 ? [...s.historyB, goal] : s.historyB
      };
      const remA = Math.max(0, 5 - next.kicksA);
      const remB = Math.max(0, 5 - next.kicksB);
      let winner = null;
      if (next.kicksA < 5 || next.kicksB < 5) {
        if (next.a > next.b + remB) winner = 0;
        if (next.b > next.a + remA) winner = 1;
      }
      if (next.kicksA >= 5 && next.kicksB >= 5 && next.kicksA === next.kicksB && next.a !== next.b) winner = next.a > next.b ? 0 : 1;
      if (winner !== null) return { ...next, done: true, winner };

      const nextTurn = s.turn + 1;
      return {
        ...next,
        turn: nextTurn,
        badZones: nextTurn % 2 === userSide ? badZones : next.badZones
      };
    });
    setShootDir(null);
    setNeedle(0);
  };

  const shootPenaltyZone = zone => {
    if (!shootout?.active || shootout.done || !userShooting || shootFlash || shootoutBusy.current) return;
    shootoutBusy.current = true;
    const badZones = shootout.badZones || [];
    const goal = !badZones.includes(zone);
    setShootDir(zone);
    setShootFlash({
      text: goal ? '¡GOL!' : '¡NO GOL!',
      goal,
      zone,
      badZones,
      playerKick: true
    });
    shootoutTimer.current = setTimeout(() => {
      setShootFlash(null);
      recordShootoutKick(goal);
      shootoutBusy.current = false;
    }, 1050);
  };

  const resolveRivalPenalty = () => {
    if (!shootout?.active || shootout.done || userShooting || shootFlash || shootoutBusy.current) return;
    shootoutBusy.current = true;
    // El remate rival se resuelve al azar: 70% gol, 30% fallo.
    const goal = Math.random() < .7;
    const zone = rand(6);
    setShootFlash({
      text: goal ? '¡GOL RIVAL!' : '¡LO ERRÓ!',
      goal,
      zone,
      rivalKick: true
    });
    shootoutTimer.current = setTimeout(() => {
      setShootFlash(null);
      recordShootoutKick(goal);
      shootoutBusy.current = false;
    }, 1050);
  };

  useEffect(() => {
    if (!shootout?.active || shootout.done || userShooting || shootFlash) return;
    const timer = setTimeout(resolveRivalPenalty, 850);
    return () => clearTimeout(timer);
  }, [shootout?.turn, shootout?.active, shootout?.done, userShooting, shootFlash]);

  const finish = () => {
    const scripted = [
      ...script.eventsA.map(event => ({
        type: 'goal',
        teamId: a.id,
        player: event.scorer,
        minute: event.minute,
        kind: event.kind || 'openplay',
        value: 1
      })),
      ...script.eventsB.map(event => ({
        type: 'goal',
        teamId: b.id,
        player: event.scorer,
        minute: event.minute,
        kind: event.kind || 'openplay',
        value: 1
      }))
    ].filter(event => event.player);

    onFinish({
      goalsA,
      goalsB,
      pensA: shootout?.done ? shootout.a : undefined,
      pensB: shootout?.done ? shootout.b : undefined,
      stats: [...scripted, ...statEvents.current]
    });
  };

  const laneLabelsForMoment = moment?.game === 'cross' ? CROSS_LANES : LANES;
  const needsLane = currentTiming && selectedLane === null;

  const homeStar = featuredPlayer(a);
  const awayStar = featuredPlayer(b);
  const finalStatEvents = [
    ...script.eventsA.map(event => ({ type: 'goal', teamId: a.id, player: event.scorer, value: 1 })),
    ...script.eventsB.map(event => ({ type: 'goal', teamId: b.id, player: event.scorer, value: 1 })),
    ...statEvents.current
  ].filter(event => event.player);
  const impactRows = Object.values(finalStatEvents.reduce((acc, event) => {
    const key = event.teamId + '::' + event.player;
    acc[key] ||= { player: event.player, teamId: event.teamId, goals: 0, assists: 0, saves: 0, score: 0 };
    const value = event.value || 1;
    if (event.type === 'goal') { acc[key].goals += value; acc[key].score += 4 * value; }
    if (event.type === 'assist') { acc[key].assists += value; acc[key].score += 2.2 * value; }
    if (event.type === 'save') { acc[key].saves += value; acc[key].score += .75 * value; }
    return acc;
  }, {}));
  const playerOfMatch = impactRows.sort((x, y) => y.score - x.score || y.goals - x.goals)[0] || null;
  const scorerLines = [...log.filter(event => event.goal), ...events.filter(event => event.m <= minute)]
    .sort((x, y) => x.m - y.m)
    .slice(0, 8);

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
        <span className="skill-live"><b>{Math.round(relevantSkill)}</b> {GAME_SKILL_LABELS[moment.game] || 'TÉCNICA'}</span>
        <span><b>{Math.round(composure)}</b> COMPOSTURA</span>
        <span><b>{Math.round(matchPressure * 100)}</b> PRESIÓN</span>
        <span><b>{Math.round(fatigue * 100)}</b> FATIGA</span>
        <span><b>{momentum > 0 ? '+' + momentum : momentum}</b> MOMENTO</span>
      </div>
      <div className={'skill-impact ' + (relevantSkill >= 88 ? 'positive' : relevantSkill <= 72 ? 'negative' : '')}>
        {moment.player?.name || moment.keeper?.name} · {skillImpact}
      </div>

      {moment.game === 'penal' && moment.attack && <>
        <p>{needsLane ? 'Elegí dónde querés colocar la pelota.' : 'Ahora clavá la precisión.'}</p>
        <GoalStage
          mode={moment.game}
          keeperLane={moment.keeperLane}
          selectedLane={selectedLane}
          onPick={needsLane ? setSelectedLane : null}
          laneLabels={LANES}
        />
        {!needsLane && currentTiming && <>
          <div className="timing-label">{currentTiming.label}</div>
          <div className="moment-track">
            <div className="moment-zone goal" style={{ left: ((moment.centers?.[step] ?? 50) - currentTiming.width / 2) + '%', width: currentTiming.width + '%' }} />
            <div className="moment-needle" style={{ left: needle + '%' }} />
          </div>
          <button className="moment-btn moment-stop" onClick={stopTiming}>¡AHORA!</button>
        </>}
      </>}

      {moment.game === 'longshot' && moment.attack && <>
        <p>Es un remate de muy lejos: la mira va <b>más rápido y también sale del arco</b>. Si frenás afuera, la tirás afuera. Si la dejás adentro pero al medio, el arquero tiene ventaja.</p>
        <LongShotAimStage
          aimX={getLongshotAim(aimTick).x}
          aimY={getLongshotAim(aimTick).y}
          onShoot={shootLongShot}
        />
      </>}

      {moment.game === 'freekick' && moment.attack && <>
        <p><b>Tiro libre estilo FIFA:</b> primero tocá dónde querés clavarla. Después arrastrá la pelota hacia arriba: la distancia da potencia y el movimiento lateral da rosca.</p>
        <FreeKickFifaStage
          target={freeKickTarget}
          onTarget={setFreeKickTarget}
          onShoot={takeFreeKick}
        />
      </>}

      {moment.game === 'cross' && moment.attack && <>
        <p>{selectedLane === null
          ? <>Elegí una de las <b>3 zonas misteriosas</b>. Solo una tiene al receptor: 1 de 3.</>
          : <>¡Encontraste al receptor! Ahora clavá la <b>potencia</b> · dificultad 8.5/10.</>}</p>
        <CrossChoiceStage selectedLane={selectedLane} onPick={selectedLane === null ? chooseCross : null} />
        {selectedLane !== null && currentTiming && <div className="skill-execution hard-execution">
          <div className="timing-label">{currentTiming.label} · DIF. 8.5/10</div>
          <div className="moment-track"><div className="moment-zone goal" style={{ left: ((moment.centers?.[0] ?? 50) - currentTiming.width / 2) + '%', width: currentTiming.width + '%' }} /><div className="moment-needle" style={{ left: needle + '%' }} /></div>
          <button className="moment-btn moment-stop" onClick={stopTiming}>¡CENTRAR!</button>
        </div>}
      </>}

      {moment.game === 'oneonone' && <>
        <p>Leé el cuerpo del arquero. No te dice el palo: te lo insinúa.</p>
        <GoalStage mode="oneonone" keeperLane={moment.keeperLane} onPick={chooseOneOnOne} />
      </>}

      {moment.game === 'counter' && moment.attack && <>
        <p>La pelota arranca por el medio. <b>Cambiala de carril mientras vienen los defensores.</b> Si uno llega a tu carril, perdés la contra. Sobreviví las 5 oleadas.</p>
        {!momentStarted ? <>
          <p>Cuando estés listo, tocá Play para empezar.</p>
          <button type="button" className="moment-btn" onClick={() => setMomentStarted(true)}>▶ PLAY</button>
        </> : <CounterLaneStage
          lane={counterLane}
          blockers={moment.counterWaves?.[counterWave] || [moment.pressureLane]}
          progress={counterProgress}
          wave={counterWave}
          total={moment.counterWaves?.length || 5}
          onLane={moveCounterLane}
        />}
      </>}

      {moment.game === 'save' && <>
        <p>{!momentStarted ? 'Tocá Play cuando estés listo. Después esperá a ver salir la pelota y tirate hacia su lado.' : reactionCue ? '¡YA! Seguí la pelota y tirate.' : 'No te tires antes. Esperá a ver salir la pelota.'}</p>
        {!momentStarted
          ? <button type="button" className="moment-btn" onClick={() => setMomentStarted(true)}>▶ PLAY</button>
          : <GoalStage mode="save" keeperLane={1} targetLane={moment.targetLane} live={reactionCue} onPick={reactionCue ? chooseSave : null} defensive />}
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
    const histories = [shootout.historyA, shootout.historyB].map((history, side) =>
      shootFlash && shootSide === side ? [...history, shootFlash.goal] : history
    );
    const scores = histories.map(history => history.filter(Boolean).length);
    const extraKicks = Math.max(0, ...histories.map(history => history.length - 5),
      !shootout.done && !shootFlash ? Math.floor(shootout.turn / 2) - 4 : 0);
    return <div className="shootout-box">
      <div className="shootout-head">
        <span>PENALES</span>
        <strong>{scores[0]}–{scores[1]}</strong>
        <small>{shootout.done ? 'FINAL' : shootout.turn >= 10 ? 'MUERTE SÚBITA' : 'SERIE DE 5'}</small>
      </div>
      <div className="penalty-tv-board" aria-label="Marcador de penales" aria-live="polite">
        {[a, b].map((team, side) => <div className={'penalty-tv-row' + (!shootout.done && shootSide === side ? ' taking' : '')} key={side}>
          <div className="penalty-tv-team"><span>{team.name}</span><b>{scores[side]}</b></div>
          <div className="penalty-tv-kicks">
            {Array.from({ length: 5 + extraKicks }, (_, index) => {
              const result = histories[side][index];
              const current = !shootout.done && !shootFlash && shootSide === side && index === histories[side].length;
              const label = result === true ? 'gol' : result === false ? 'fallado' : current ? 'en curso' : 'pendiente';
              return <span key={index} className={'penalty-tv-kick ' + (result === true ? 'scored' : result === false ? 'missed' : current ? 'current' : 'pending') + (index === 5 ? ' sudden-start' : '')} aria-label={'Penal ' + (index + 1) + ': ' + label}>
                <small>{index + 1}</small><b>{result === true ? '✓' : result === false ? '×' : current ? '●' : '–'}</b>
              </span>;
            })}
          </div>
        </div>)}
        <div className="penalty-tv-legend">✓ GOL · × FALLO · ● EN CURSO</div>
      </div>

      {shootout.done ? <>
        <h3>{shootout.winner === userSide ? '¡LO GANASTE EN LOS PENALES!' : 'Se terminó en los penales.'}</h3>
        <p>{shootout.winner === userSide ? 'La presión era máxima y no temblaste.' : 'La tanda fue cruel. La revancha queda servida.'}</p>
        <button className="primary-button" onClick={finish}><Swords size={16} />Continuar</button>
      </> : shootFlash ? <>
        {shootFlash.playerKick
          ? <ShootoutSixZone selected={shootFlash.zone} badZones={shootFlash.badZones} reveal result={{ goal: shootFlash.goal, zone: shootFlash.zone }} />
          : <ShootoutSixZone selected={shootFlash.zone} result={{ goal: shootFlash.goal, zone: shootFlash.zone }} />}
        <div className="shootout-flash">{shootFlash.text}</div>
      </> : userShooting ? <>
        <h3>Patea {sideName}</h3>
        <p>Elegí una de las <b>6 zonas</b>. En cada penal hay <b>4 zonas de gol y 2 de no gol</b>. Recién se revelan después de patear.</p>
        <ShootoutSixZone onPick={shootPenaltyZone} badZones={shootout.badZones || []} />
      </> : <>
        <h3>Patea {sideName}</h3>
        <p>El penal rival se resuelve al azar: puede ser gol o puede fallar.</p>
        <div className="rival-penalty-wait">
          <span>⚽</span>
          <strong>EL RIVAL TOMA CARRERA…</strong>
        </div>
      </>}
    </div>;
  };

  if (!kickoffReady) return <div className="match-sim match-broadcast-intro">
    <div className="broadcast-kicker"><span>CRACK SPORTS</span><b>{ROUND_NAMES[round] || 'PARTIDO'}</b></div>
    <div className="broadcast-stage">
      <div className="broadcast-team">
        <small>{a.isAuctionTeam ? (a.isBot ? 'BOTACIONAL' : 'TU EQUIPO') : 'LEYENDA'}</small>
        <h2>{a.name}</h2>
        <strong>{a.strength.toFixed?.(1) || a.strength}</strong>
        <span>NIVEL</span>
        <div><b>{homeStar.name}</b><small>{homeStar.position} · {homeStar.rating}</small></div>
      </div>
      <div className="broadcast-vs"><span>VS</span><small>{environment.tempo.name}<br/>CÉSPED {environment.surface.name}</small></div>
      <div className="broadcast-team">
        <small>{b.isAuctionTeam ? (b.isBot ? 'BOTACIONAL' : 'TU EQUIPO') : 'LEYENDA'}</small>
        <h2>{b.name}</h2>
        <strong>{b.strength.toFixed?.(1) || b.strength}</strong>
        <span>NIVEL</span>
        <div><b>{awayStar.name}</b><small>{awayStar.position} · {awayStar.rating}</small></div>
      </div>
    </div>
    <div className="broadcast-notes">
      <span><b>{Math.round(myMetrics.attack)}</b> ATAQUE</span>
      <span><b>{Math.round(myMetrics.midfield)}</b> MEDIO</span>
      <span><b>{Math.round(myMetrics.defense)}</b> DEFENSA</span>
      <span><b>{Math.round(myMetrics.keeper)}</b> ARQ</span>
    </div>
    <button className="primary-button broadcast-start" onClick={() => { playFeedback('reveal'); setKickoffReady(true); }}>
      <Swords size={17} />Entrar a la cancha
    </button>
  </div>;

  return <div className="match-sim">
    <div className="sim-board">
      <div className={'sim-team ' + (a.isHuman ? 'me' : '')}><strong>{a.name}</strong><span>{a.isAuctionTeam ? (a.isBot ? 'BOTACIONAL' : 'SUBASTADO') : 'LEYENDA'}</span></div>
      <div className="sim-score"><b>{goalsA}–{goalsB}</b><span>{finished ? <><Clock size={13} /> FINAL</> : <><Clock size={13} /> {minute}′</>}</span></div>
      <div className={'sim-team ' + (b.isHuman ? 'me' : '')}><strong>{b.name}</strong><span>{b.isAuctionTeam ? (b.isBot ? 'BOTACIONAL' : 'SUBASTADO') : 'LEYENDA'}</span></div>
    </div>

    <div className="sim-meta">
      <span><Shield size={12} /> {ROUND_NAMES[round] || 'PARTIDO'}</span>
      <span><Gauge size={12} /> {environment.tempo.name}</span>
      <span><Activity size={12} /> CÉSPED {environment.surface.name}</span>
      <span><Target size={12} /> DIF. {Math.round(dynamicDifficulty * 100)}</span>
      <span><Zap size={12} /> {plan.length} MOMENTOS</span>
      {tactic && <span className={'tactic-chip ' + tactic}><Swords size={12} /> {tactic === 'attack' ? 'IR A BUSCARLO' : tactic === 'close' ? 'CERRARSE' : 'EQUILIBRADO'}</span>}
    </div>

    <div className="team-variable-strip">
      <span><b>{myMetrics.attack.toFixed(0)}</b> ATAQUE</span>
      <span><b>{myMetrics.midfield.toFixed(0)}</b> MEDIO</span>
      <span><b>{myMetrics.defense.toFixed(0)}</b> DEFENSA</span>
      <span><b>{myMetrics.keeper.toFixed(0)}</b> ARQ</span>
    </div>

    {halftimePrompt && <div className="halftime-tactics">
      <span className="tactics-kicker">45′ · ENTRETIEMPO</span>
      <h3>¿Cómo salís al segundo tiempo?</h3>
      <p>Elegís una sola vez. La táctica modifica las situaciones que vienen después.</p>
      <div className="tactic-options">
        <button onClick={() => chooseTactic('attack')}><b>IR A BUSCARLO</b><small>Más peligro cuando atacás, pero quedás más expuesto.</small></button>
        <button onClick={() => chooseTactic('balanced')}><b>EQUILIBRADO</b><small>Pequeña mejora general, sin asumir demasiado riesgo.</small></button>
        <button onClick={() => chooseTactic('close')}><b>CERRARSE</b><small>Más fuerte defendiendo, más difícil cuando te toca atacar.</small></button>
      </div>
    </div>}

    {renderMoment()}

    {flash && <div className={'sim-flash ' + (flash.goal ? 'goal' : 'save')}>
      {flash.game === 'longshot'
        ? <LongShotAimStage result={{ goal: flash.goal, x: flash.longshotAimX ?? 50, y: flash.longshotAimY ?? 50 }} />
        : <GoalStage mode={'result-' + flash.game} keeperLane={flash.keeperLane} result={{ goal: flash.goal, lane: flash.lane }} />}
      <strong>{flash.headline}</strong>
      <span>{flash.goal && flash.scorer ? 'GOL DE ' + flash.scorer + (flash.assist ? ' · ASISTENCIA ' + flash.assist : '') + '. ' + flash.subline : flash.subline}</span>
    </div>}

    {!shootout?.active && <div className="sim-feed">
      {shown.length ? shown.map((e, i) => <div key={i} className={'sim-event side-' + e.side + ' ' + (i === 0 && !finished ? 'fresh' : '')}>
        <b>{e.m}′</b>
        <span>{e.label || (e.goal === undefined ? PHRASES[e.m % PHRASES.length] : e.goal ? '¡GOLAZO!' : '¡SE SALVÓ!')}</span>
        <small>{e.goal === undefined ? 'GOL DE ' + (e.scorer || teamName(e.side)) : e.goal ? 'GOL DE ' + (e.scorer || teamName(e.side)) : 'NO TERMINÓ EN GOL'}</small>
      </div>) : <p className="sim-quiet">Rodando la pelota…</p>}
    </div>}

    {renderShootout()}

    {finished && !shootout?.active && <div className="sim-final post-match-show">
      <span className="post-match-kicker">CRACK SPORTS · FINAL</span>
      <strong>{goalsA === goalsB ? 'EMPATE. NOS VAMOS A PENALES.' : a.name + ' ' + goalsA + '–' + goalsB + ' ' + b.name}</strong>
      {scorerLines.length > 0 && <div className="post-match-scorers">
        {scorerLines.map((event, i) => <span key={i}><b>{event.m}′</b> {event.scorer || teamName(event.side)}</span>)}
      </div>}
      {playerOfMatch && <div className="post-match-mvp"><small>FIGURA CRACK</small><b>{playerOfMatch.player}</b><span>{playerOfMatch.goals} G · {playerOfMatch.assists} A · {playerOfMatch.saves} ATJ</span></div>}
      <p>{goalsA === goalsB ? 'Cinco penales por equipo. Vos elegís dónde patear; el rival ejecuta automáticamente. Si siguen empatados, van a muerte súbita.' : 'Lo que compraste en la subasta ahora pesa en cada situación: técnica, velocidad, pase, definición y arquero.'}</p>
      {goalsA === goalsB
        ? <button className="primary-button" onClick={startShootout}><Target size={16} />Jugar los penales</button>
        : <button className="primary-button" onClick={finish}><Swords size={16} />Continuar</button>}
    </div>}
  </div>;
}
