import { ArrowRight, BadgeCheck } from 'lucide-react';
import { byId } from '@/components/crack/catalog';
export default function Reveal({ game, dispatch }) {
  const a = game.auction, player = byId(a.id), buyer = game.teams[a.leader];
  return <div className="reveal-info" aria-live="polite"><div className="eyebrow gold-text"><BadgeCheck size={16} /> ¡ADJUDICADO!</div><h1>Se cerró<br /><span>el fichaje.</span></h1><p className="reveal-name">{player.name}</p><blockquote>“{player.phrase}”</blockquote><div className="purchase-detail"><div><span>EQUIPO COMPRADOR</span><strong>{buyer.team}</strong><small>{buyer.name}</small></div><div><span>PRECIO PAGADO</span><strong>{'$' + a.price}<small>M</small></strong></div></div><button className="primary-button" data-action="next" onClick={() => dispatch({ type: 'next' })}>{game.teams.every(t => t.squad.length === 11) ? 'Ver resultados' : 'Siguiente subasta'}<ArrowRight size={20} /></button><p className="fine-print">Valoración subjetiva creada para CRACK. No es una estadística oficial.</p></div>;
}
