import { useEffect, useState } from 'react';
import useCrack from '@/components/crack/useCrack';
import GameHeader from '@/components/crack/GameHeader';
import Welcome from '@/components/crack/Welcome';
import Auction from '@/components/crack/Auction';
import Results from '@/components/crack/Results';
import GameModal from '@/components/crack/GameModal';
import Rules from '@/components/crack/Rules';
import PhotoManager from '@/components/crack/PhotoManager';
import { botMove } from '@/components/crack/engine';

export default function Crack() {
  const c = useCrack(), [modal, setModal] = useState(null);
  useEffect(() => { document.title = 'CRACK — Subastas futboleras a ciegas'; document.documentElement.lang = 'es-AR'; }, []);
  const playing = !!c.game && !c.home;
  useEffect(() => {
    const g = c.game;
    if (!g || c.home || g.phase !== 'auction' || !g.teams[g.auction.turn]?.bot) return;
    const timer = setTimeout(() => c.dispatch(botMove(g)), 1400);
    return () => clearTimeout(timer);
  }, [c.game, c.home, c.dispatch]);
  return <div className="crack-app"><GameHeader playing={playing} saveError={c.saveError} onHome={() => c.setHome(true)} onRules={() => setModal('rules')} onPhotos={() => setModal('photos')} />{c.saveError && <div className="storage-warning" role="alert">La partida sigue, pero el navegador no pudo guardarla. No cierres esta pestaña.</div>}{c.photoError && <div className="storage-warning">{c.photoError}</div>}
    {!playing ? <Welcome photos={c.photos} onStart={c.start} missing={c.missing} loading={c.loading} onPhotos={() => setModal('photos')} saved={c.game} onContinue={() => c.setHome(false)} /> : c.loading ? <div className="preparing"><div className="loading-ball" /><h2>Preparando el mercado…</h2><p>Precargando las fotos de tu partida guardada.</p></div> : c.game.phase === 'finished' ? <Results game={c.game} photos={c.photos} dispatch={c.dispatch} onRematch={() => c.start(c.game.teams)} /> : <Auction game={c.game} dispatch={c.dispatch} photos={c.photos} />}
    <GameModal open={modal === 'rules'} onClose={() => setModal(null)} title="Acá se juega así." description="Las reglas son simples. Las decisiones, no tanto."><Rules compact /></GameModal>
    <GameModal open={modal === 'photos' && !playing} onClose={() => setModal(null)} title="El álbum de CRACK" description="Fotos del catálogo y retratos que cargues vos."><PhotoManager photos={c.photos} onUpload={c.upload} /></GameModal>
  </div>;
}
