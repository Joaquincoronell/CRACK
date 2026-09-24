import { byId } from '@/components/crack/catalog';
import { Image } from '@/components/ui/image';
import { Shirt } from 'lucide-react';
export default function Pitch({ team, photos }) {
  return <div className="pitch" aria-label={'Formación 4-3-3 de ' + team.team}><div className="pitch-lines"><div className="center-circle" /><div className="penalty-box top" /><div className="penalty-box bottom" /></div>{['DEL', 'MED', 'DEF', 'ARQ'].map(pos => <div className="pitch-row" key={pos}>{team.squad.filter(p => byId(p.id).position === pos).map(p => <div className="pitch-player" key={p.id}><div className="pitch-face">{photos[p.id] ? <Image src={photos[p.id]} alt={byId(p.id).name} className="pitch-photo" /> : <Shirt size={22} />}<b>{byId(p.id).rating}</b></div><span>{byId(p.id).name}</span><small>{'$' + p.price + 'M'}</small></div>)}</div>)}</div>;
}
