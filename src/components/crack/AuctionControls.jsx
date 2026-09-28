import { Gavel, ArrowRight, Wallet, CornerDownRight } from 'lucide-react';
import { maxBid, getBotPersonality, skipsLeft } from '@/components/crack/engine';

export default function AuctionControls({ game, dispatch, visible = false }) {
  const a = game.auction;
  const team = game.teams[a.turn];
  const limit = maxBid(team);
  const botProfile = team.bot ? getBotPersonality(team.botPersonality) : null;
  const openingTurn = a.openingTurn ?? a.turn;
  const openingDecision = a.leader === null && a.price === 0 && a.turn === openingTurn;
  const skips = skipsLeft(team);

  return <div className="auction-controls">
    <div className="eyebrow"><span className="pulse-dot" /> SUBASTA EN VIVO</div>

    {a.event && <div className={'market-event event-' + a.event.id}>
      <strong>{a.event.label}</strong>
      <span>{a.event.text}</span>
    </div>}

    <h1>{visible ? <>¿Cuánto vale<br /><span>tu cálculo?</span></> : <>¿Cuánto vale<br /><span>tu intuición?</span></>}</h1>
    <p className="muted">{visible ? 'La carta está a la vista. La decisión es toda tuya.' : 'La posición es la única pista. La decisión es tuya.'}</p>

    <div className="current-bid">
      <div>
        <span className="field-label">{a.leader === null ? 'PRECIO DE SALIDA' : 'MEJOR OFERTA'}</span>
        <strong>{'$' + (a.price || 1)}<small>M</small></strong>
      </div>
      <div className="bid-owner">
        {a.leader === null
          ? <><Gavel size={20} /><span>Sin ofertas todavía</span></>
          : <><span className={'team-dot team-' + a.leader}><Gavel size={17} /></span><span>{game.teams[a.leader].team}<small>{game.teams[a.leader].name}</small></span></>}
      </div>
    </div>

    <div className="turn-box" aria-live="polite">
      <div className="turn-heading">
        <span className={'team-dot team-' + a.turn}>{a.turn + 1}</span>
        <div><span>LE TOCA A</span><h2>{team.name}</h2></div>
        <span className="turn-team">{team.team}</span>
      </div>

      {team.bot
        ? <p className="bot-turn-note"><span className="loading-ball" /><span><b>{botProfile?.name}</b> · {botProfile?.text || 'El bot está pensando su oferta…'}</span></p>
        : <>
          <div className="bid-buttons">
            {[1, 2, 5].map(amount => <button
              data-action={'bid-' + amount}
              key={amount}
              disabled={a.price + amount > limit}
              onClick={() => dispatch({ type: 'bid', amount })}
            >
              <span>+{amount}M</span>
              <small>{'Ofertar $' + (a.price + amount) + 'M'}</small>
            </button>)}
          </div>

          {openingDecision
            ? skips > 0
              ? <button data-action="skip" className="pass-button skip-player-button" onClick={() => dispatch({ type: 'pass' })}>
                  Saltear jugador · {skips} skip{skips === 1 ? '' : 's'} <ArrowRight size={16} />
                </button>
              : <button data-action="forced-open" className="pass-button forced-buy-button" onClick={() => dispatch({ type: 'bid', amount: 1 })}>
                  Sin skips · abrir por $1M <Gavel size={16} />
                </button>
            : <button data-action="pass" className="pass-button" onClick={() => dispatch({ type: 'pass' })}>
                Pasar esta subasta <ArrowRight size={16} />
              </button>}

          <p className="reserve-note">
            <Wallet size={14} />
            {'Podés ofertar hasta $' + limit + 'M. Reservamos $' + (10 - team.squad.length) + 'M para completar tu once.'}
          </p>
        </>}
    </div>

    <p className="auction-note">
      <CornerDownRight size={14} />
      {openingDecision
        ? skips > 0
          ? 'El skip solo se gasta si sos el primero y nadie ofertó. Ese jugador no vuelve al mazo.'
          : 'No te quedan skips: tenés que abrir la subasta. Después, pasar no gasta nada.'
        : 'Una vez que hubo oferta, pasar es gratis y no gasta skips.'}
    </p>
  </div>;
}
