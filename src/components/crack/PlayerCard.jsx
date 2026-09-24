import { useEffect, useState } from 'react';
import { LockKeyhole, ImageOff, Sparkles } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { POSITIONS } from '@/components/crack/catalog';
export default function PlayerCard({ player, photo, revealed = false, showcase = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo]);
  return <div className={'player-card ' + (revealed ? 'revealed ' : '') + (showcase ? 'showcase' : '')}>
    <div className="card-top"><span>{revealed ? player.rating : '??'}<small>{revealed ? 'VALORACIÓN' : 'IDENTIDAD OCULTA'}</small></span>{revealed ? <Sparkles size={22} /> : <LockKeyhole size={22} />}</div>
    <div className="portrait-wrap">{photo && !failed ? <Image src={photo} alt={revealed ? player.name : 'Futbolista misterioso'} className="player-portrait" onError={() => setFailed(true)} /> : <div className="missing-portrait" role="img" aria-label={revealed ? 'Foto no disponible' : 'Futbolista misterioso'}><ImageOff size={40} /><span>{showcase ? '¿QUIÉN SE ESCONDE?' : 'Foto no disponible'}</span></div>}</div>
    {!revealed && <div className="mystery-mark" aria-hidden="true">?</div>}
    <div className="card-bottom"><div className="card-divider" /><span className="position-label">{showcase ? 'EL PRÓXIMO CRACK' : POSITIONS[player.position].name}</span><h2>{revealed ? player.name : showcase ? 'PUEDE SER TUYO.' : '¿CRACK O CLAVO?'}</h2><p>{revealed ? 'BIENVENIDO AL EQUIPO' : 'CONFIÁ EN TU INSTINTO'}</p></div>
    <span className="card-brand">CRACK<span>®</span></span>
  </div>;
}
