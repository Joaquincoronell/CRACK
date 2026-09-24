import { ArrowUpRight, Shield, EyeOff } from 'lucide-react';
import PlayerCard from '@/components/crack/PlayerCard';
import SetupForm from '@/components/crack/SetupForm';
import Rules from '@/components/crack/Rules';
import { byId, CATALOG } from '@/components/crack/catalog';
export default function Welcome({ photos, ...props }) {
  return <main className="welcome"><div className="welcome-grid"><section className="intro"><div className="eyebrow"><span className="pulse-dot" /> SUBASTAS FUTBOLERAS A CIEGAS</div><div className="intro-stage"><h1>EL TALENTO<br />NO SE VE.<br /><span>SE APUESTA.</span></h1><p className="intro-description">Podés fichar una leyenda.<br />O comprar el próximo meme.<br /><strong>El precio lo ponés vos.</strong></p><div className="showcase-wrap"><div className="orbit-label"><EyeOff size={12} /> SIN NOMBRE. SIN PISTAS.</div><PlayerCard player={byId(49)} photo={photos[49]} showcase /><span className="floating-tag">¿CRACK O CLAVO? <ArrowUpRight size={15} /></span></div></div><div className="intro-stats"><div><strong>{CATALOG.length}</strong><span>FUTBOLISTAS</span></div><div><strong>100<span>M</span></strong><span>POR PARTICIPANTE</span></div><div><strong>11</strong><span>LUGARES. TU EQUIPO.</span></div></div></section><SetupForm {...props} /></div><div className="rules-strip"><Rules /></div><footer className="welcome-footer"><span><Shield size={13} />Lo que pasa en la subasta, queda entre amigos.</span><span>PLATA FICTICIA. RIVALIDAD REAL.</span></footer></main>;
}
