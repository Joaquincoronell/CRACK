import { useState } from 'react';
import { ArrowRight, Users, Check, AlertCircle, EyeOff, Eye, ArrowLeftRight, Bot } from 'lucide-react';
const MODES = [
  { id: 'ciegas', icon: EyeOff, title: 'A ciegas', text: 'Solo posición y silueta. El clásico.' },
  { id: 'revelado', icon: Eye, title: 'A la vista', text: 'La carta se ve antes de ofertar.' },
  { id: 'intercalado', icon: ArrowLeftRight, title: 'Intercalado', text: 'Una subasta oculta, una revelada.' }
];
const WAYS = [
  { id: 'amigos', icon: Users, title: 'Entre amigos', text: 'Pasá el teléfono. Todos subastan.' },
  { id: 'solo', icon: Bot, title: 'Solitario', text: 'Vos contra el bot. Después, leyendas.' }
];
export default function SetupForm({ onStart, missing, loading, onPhotos, saved, onContinue }) {
  const [count, setCount] = useState(2), [mode, setMode] = useState('ciegas'), [solo, setSolo] = useState(false), [accept, setAccept] = useState(false);
  const [players, setPlayers] = useState(Array.from({ length: 4 }, () => ({ name: '', team: '' })));
  const change = (i, key, value) => setPlayers(p => p.map((v, j) => i === j ? { ...v, [key]: value } : v));
  return <section className="setup-panel" id="crear-partida"><div className="setup-heading"><span className="section-number">01 / VESTUARIO</span><span className="live-dot">PARTIDA LOCAL</span></div><h2>Armá la mesa.</h2><p className="muted">Juntá a tus amigos. El resto se define en la cancha.</p>
    <form onSubmit={e => { e.preventDefault(); onStart(solo ? [{ ...players[0] }, { name: 'Bot', team: 'Botacional', bot: true }] : players.slice(0, count), mode); }}><label className="field-label">MODO DE JUEGO</label><div className="mode-options way-options">{WAYS.map(w => <button key={w.id} type="button" aria-pressed={solo === (w.id === 'solo')} data-way={w.id} onClick={() => setSolo(w.id === 'solo')} className={solo === (w.id === 'solo') ? 'selected' : ''}><strong><w.icon size={15} />{w.title}{solo === (w.id === 'solo') && <Check size={14} />}</strong><small>{w.text}</small></button>)}</div>
      {!solo && <><label className="field-label">¿CUÁNTOS JUEGAN?</label><div className="participant-options">{[2, 3, 4].map(n => <button key={n} type="button" aria-pressed={count === n} data-count={n} onClick={() => setCount(n)} className={count === n ? 'selected' : ''}><Users size={17} />{n} participantes{count === n && <Check size={15} />}</button>)}</div></>}
      <label className="field-label">MODO DE SUBASTA</label><div className="mode-options">{MODES.map(m => <button key={m.id} type="button" aria-pressed={mode === m.id} data-mode={m.id} onClick={() => setMode(m.id)} className={mode === m.id ? 'selected' : ''}><strong><m.icon size={15} />{m.title}{mode === m.id && <Check size={14} />}</strong><small>{m.text}</small></button>)}</div>
      <div className="player-inputs">{(solo ? players.slice(0, 1) : players.slice(0, count)).map((p, i) => <div className="player-input-row" key={i}><span className={'team-dot team-' + i}>{String(i + 1).padStart(2, '0')}</span><div><label htmlFor={'name-' + i}>PARTICIPANTE {i + 1}</label><input id={'name-' + i} maxLength={24} value={p.name} placeholder={i === 0 ? 'Tu nombre' : 'Nombre del participante ' + (i + 1)} onChange={e => change(i, 'name', e.target.value)} /></div><div><label htmlFor={'team-' + i}>NOMBRE DEL EQUIPO</label><input id={'team-' + i} maxLength={28} value={p.team} placeholder={i === 0 ? 'Ej. La Scaloneta' : i === 1 ? 'Ej. Los de siempre' : 'Equipo ' + (i + 1)} onChange={e => change(i, 'team', e.target.value)} /></div></div>)}</div>
      {solo && <p className="bot-note"><Bot size={13} />El bot arranca con los mismos 100M y subasta por su cuenta, con su propio criterio.</p>}
      {missing > 0 && <div className="photo-warning"><AlertCircle size={16} /><div><button type="button" onClick={onPhotos}>{missing} fotos pendientes. Revisar o cargar fotos</button><label className="accept-missing"><input type="checkbox" checked={accept} onChange={e => setAccept(e.target.checked)} />Jugar igual: esas cartas dirán “Foto no disponible”.</label></div></div>}
      <button className="primary-button start-button" data-action="start" type="submit" disabled={loading || (missing > 0 && !accept)}>{loading ? 'Preparando las fotos…' : 'Crear partida'}<ArrowRight size={20} /></button>
      {saved && <button type="button" className="continue-button" onClick={onContinue}>Continuar partida guardada <ArrowRight size={16} /></button>}
    </form><div className="setup-foot"><Check size={13} />Sin registro <span>·</span> Un solo dispositivo <span>·</span> Sin apuro</div>
  </section>;
}
