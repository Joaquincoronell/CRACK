import { useEffect, useState } from 'react';
import { CircleHelp, Image, Save, LogOut, Volume2, VolumeX } from 'lucide-react';
import { feedbackEnabled, setFeedbackEnabled, playFeedback } from '@/components/crack/feedback';

export default function GameHeader({ playing, onRules, onPhotos, onHome, onAbandon, saveError }) {
  const [sound, setSound] = useState(feedbackEnabled());

  useEffect(() => {
    const sync = event => setSound(!!event.detail);
    window.addEventListener('crack-feedback-change', sync);
    return () => window.removeEventListener('crack-feedback-change', sync);
  }, []);

  const toggleSound = () => {
    const next = !sound;
    setFeedbackEnabled(next);
    setSound(next);
    if (next) setTimeout(() => playFeedback('tap'), 0);
  };

  return <header className="game-header">
    <button className="wordmark" aria-label="CRACK, inicio" onClick={onHome}>CRACK<span>®</span><i /></button>
    <div className="header-divider" />
    <span className="header-caption">EL FÚTBOL SE JUEGA.<br />LA SUERTE SE SUBASTA.</span>
    <nav>
      {playing
        ? <>
          <span className={'save-status ' + (saveError ? 'save-error' : '')}><Save size={13} />{saveError ? 'No se pudo guardar' : 'Guardado local'}</span>
          <button onClick={onAbandon} className="header-link abandon-game"><LogOut size={16} /><span>Abandonar</span></button>
        </>
        : <span className="header-local"><span className="pulse-dot" /> HECHO PARA JUGAR JUNTOS</span>}
      <button onClick={toggleSound} className={'header-link feedback-toggle ' + (sound ? 'active' : '')} aria-label={sound ? 'Desactivar sonido y vibración' : 'Activar sonido y vibración'}>
        {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}<span>{sound ? 'Sonido' : 'Silencio'}</span>
      </button>
      {!playing && <button onClick={onPhotos} className="header-link"><Image size={16} /><span>Fotos</span></button>}
      <button onClick={onRules} className="header-link"><CircleHelp size={17} /><span>Cómo jugar</span></button>
    </nav>
  </header>;
}
