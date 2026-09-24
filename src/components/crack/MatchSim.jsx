import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Swords } from 'lucide-react';
const PHRASES = ['¡GOLAZO!', '¡De penal!', '¡Golpe de efecto!', '¡Qué definición!', '¡De cabeza al ángulo!', '¡Contragolpe letal!', '¡Zurdazo imposible!', '¡La picó por encima del arquero!', '¡Palomita!', '¡La rompió al palo izquierdo!'];
const rand = n => Math.floor(Math.random() * n);
const ZONES = { shoot: { penal: 32, tiro: 18 }, save: { penal: 16, tiro: 28 } };
const SPEED = { penal: 1.7, tiro: 2.5 };
const pickScorer = team => {
  const scorers = team.scorers || [];
  if (!scorers.length) return team.name;
  const weights = scorers.map(s => (s.rating / 100) ** 4);
  let r = Math.random() * weights.reduce((x, y) => x + y, 0);
  for (let i = 0; i < scorers.length; i++) { r -= weights[i]; if (r <= 0) return scorers[i].name; }
  return scorers[scorers.length - 1].name;
};
export default function MatchSim({ a, b, script, onFinish }) {
  const userSide = a.isPlayer || !b.isPlayer ? 0 : 1;
  const [minute, setMinute] = useState(0);
  const [moment, setMoment] = useState(null);
  const [needle, setNeedle] = useState(0);
  const [flash, setFlash] = useState(null);
  const [log, setLog] = useState([]);
  const done = useRef([]);
  const plan = useMemo(() => {
    const mins = [26, 44, 63, 79].sort(() => Math.random() - .5).slice(0, 3);
    let kinds = [rand(2), rand(2), rand(2)];
    if (kinds.every(k => k === kinds[0])) kinds[rand(3)] = 1 - kinds[0];
    const types = ['shoot', 'save', 'shoot'];
    return mins.map((m, i) => {
      const type = types[i], kind = kinds[i] ? 'tiro' : 'penal';
      return { minute: m, kind, type, side: type === 'shoot' ? userSide : 1 - userSide, center: 12 + rand(76), width: ZONES[type][kind] };
    }).sort((x, y) => x.minute - y.minute);
  }, []);
  const paused = !!moment || !!flash;
  const finished = minute >= 90 && !paused;
  const teamName = side => side === 0 ? a.name : b.name;
  useEffect(() => { if (finished || paused) return; const timer = setInterval(() => setMinute(m => Math.min(90, m + 1)), 200); return () => clearInterval(timer); }, [finished, paused]);
  useEffect(() => { if (paused || minute >= 90) return; const next = plan.find(p => !done.current.includes(p.minute) && p.minute <= minute); if (next) { done.current = [...done.current, next.minute]; setMoment(next); } }, [minute, paused, plan]);
  useEffect(() => {
    if (!moment) return;
    let pos = 0, dir = 1;
    const step = SPEED[moment.kind];
    const timer = setInterval(() => {
      pos += dir * step;
      if (pos >= 100) { pos = 100; dir = -1; }
      if (pos <= 0) { pos = 0; dir = 1; }
      setNeedle(pos);
    }, 30);
    return () => clearInterval(timer);
  }, [moment]);
  const events = useMemo(() => [...script.eventsA.map(e => ({ m: e.minute, side: 0, scorer: e.scorer })), ...script.eventsB.map(e => ({ m: e.minute, side: 1, scorer: e.scorer }))].sort((x, y) => x.m - y.m || x.side - y.side), [script]);
  const shown = [...events.filter(e => e.m <= minute), ...log.filter(e => e.m <= minute)].sort((x, y) => y.m - x.m || y.side - x.side);
  const goalsA = events.filter(e => e.m <= minute && e.side === 0).length + log.filter(e => e.m <= minute && e.side === 0 && e.goal).length;
  const goalsB = events.filter(e => e.m <= minute && e.side === 1).length + log.filter(e => e.m <= minute && e.side === 1 && e.goal).length;
  const resolve = () => {
    const m = moment, hit = Math.abs(needle - m.center) <= m.width / 2;
    const goal = m.type === 'shoot' ? hit : !hit;
    const scorer = pickScorer(m.side === 0 ? a : b);
    setLog(l => [...l, { m: minute, side: m.side, goal, scorer, kind: m.kind }]);
    setMoment(null);
    setFlash({ goal, scorer, kind: m.kind });
    setTimeout(() => setFlash(null), 1700);
  };
  const finish = () => {
    const finalA = script.goalsA + log.filter(e => e.side === 0 && e.goal).length;
    const finalB = script.goalsB + log.filter(e => e.side === 1 && e.goal).length;
    let pens = script.pens && script.goalsA === script.goalsB ? script.pens : null;
    if (finalA === finalB && !pens) { let pa, pb; do { pa = 3 + rand(3); pb = 3 + rand(3); } while (pa === pb); pens = { a: pa, b: pb }; }
    onFinish({ goalsA: finalA, goalsB: finalB, pensA: pens?.a, pensB: pens?.b });
  };
  return <div className="match-sim">
    <div className="sim-board"><div className={'sim-team ' + (a.isPlayer ? 'me' : '')}><strong>{a.name}</strong><span>{a.isPlayer ? 'SUBASTADO' : 'LEYENDA'}</span></div><div className="sim-score"><b>{goalsA}–{goalsB}</b><span>{finished ? <><Clock size={13} /> FINAL</> : <><Clock size={13} /> {minute}′</>}</span></div><div className={'sim-team ' + (b.isPlayer ? 'me' : '')}><strong>{b.name}</strong><span>{b.isPlayer ? 'SUBASTADO' : 'LEYENDA'}</span></div></div>
    {moment && <div className="sim-moment" role="group" aria-label="interacción"><strong>{moment.kind === 'penal' ? '¡PENAL!' : '¡TIRO LIBRE!'}</strong><p>{moment.type === 'shoot' ? 'Pateá para ' + teamName(moment.side) + '. Frená la aguja en la zona verde para convertir' + (moment.kind === 'penal' ? ': el penal perdona más' : ': al tiro hay que ser más fino') : 'Patea ' + teamName(moment.side) + '. Frená la aguja en la zona dorada para atajar' + (moment.kind === 'penal' ? ': atajar un penal es casi milagro' : '')}</p><div className="moment-track"><div className={'moment-zone ' + (moment.type === 'shoot' ? 'goal' : 'save')} style={{ left: (moment.center - moment.width / 2) + '%', width: moment.width + '%' }} /><div className="moment-needle" style={{ left: needle + '%' }} /></div><button className="moment-btn moment-stop" onClick={resolve}>¡AHORA!</button></div>}
    {flash && <div className={'sim-flash ' + (flash.goal ? 'goal' : 'save')}><strong>{flash.goal ? '¡GOL DE ' + flash.scorer + '!' : '¡ATAJADÓN!'}</strong><span>{flash.goal ? (flash.kind === 'penal' ? 'De penal, al ángulo.' : 'Imparable para el arquero.') : 'El arquero voló y sacó todo.'}</span></div>}
    <div className="sim-feed">{shown.length ? shown.map((e, i) => <div key={i} className={'sim-event side-' + e.side + ' ' + (i === 0 && !finished ? 'fresh' : '')}><b>{e.m}′</b><span>{e.goal === undefined ? PHRASES[e.m % PHRASES.length] : e.goal ? (e.kind === 'penal' ? '¡De penal!' : '¡GOLAZO!') : '¡ATAJADA!'}</span><small>{e.goal === undefined ? 'GOL DE ' + (e.scorer || teamName(e.side)) : e.goal ? 'GOL DE ' + (e.scorer || teamName(e.side)) : 'EL ARQUERO LO SACÓ'}</small></div>) : <p className="sim-quiet">Rodando la pelota…</p>}</div>
    {finished && <div className="sim-final"><strong>FINAL DEL PARTIDO</strong><p>Partido jugado a pura puntería: cada penal y tiro libre se decidió con la aguja.</p><button className="primary-button" onClick={finish}><Swords size={16} />Continuar</button></div>}
  </div>;
}
