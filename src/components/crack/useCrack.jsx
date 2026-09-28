import { useEffect, useReducer, useState } from 'react';
import { gameReducer, MODES, STORE_KEY, INITIAL_SKIPS } from '@/components/crack/engine';
import { CATALOG } from '@/components/crack/catalog';
import { PHOTOS } from '@/components/crack/photos';
import { getPhotos, savePhoto, preload } from '@/components/crack/photoStore';

function restore() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY) || sessionStorage.getItem(STORE_KEY) || 'null');
    if (!(data?.version === 1 && [2, 3, 4].includes(data.teams?.length))) return null;

    const teams = data.teams.map(team => ({ ...team, skips: team.skips ?? INITIAL_SKIPS }));
    const auction = data.auction ? { ...data.auction, openingTurn: data.auction.openingTurn ?? data.auction.turn } : null;

    let tournament = null;
    if (data.tournament?.teams) {
      const tournamentTeams = data.tournament.teams.map(team => {
        if (typeof team.id === 'string' && team.id.startsWith('p')) {
          const sourceIndex = Number(team.id.slice(1));
          const sourceTeam = teams[sourceIndex];
          if (sourceTeam) return { ...team, isPlayer: !sourceTeam.bot, isHuman: !sourceTeam.bot, isBot: !!sourceTeam.bot, isAuctionTeam: true };
        }
        return { ...team, isPlayer: false, isHuman: false, isBot: false, isAuctionTeam: false };
      });
      const byId = Object.fromEntries(tournamentTeams.map(team => [team.id, team]));
      tournament = {
        ...data.tournament,
        teams: tournamentTeams,
        champion: data.tournament.champion?.id ? byId[data.tournament.champion.id] || data.tournament.champion : null
      };
    }

    return { ...data, teams, auction, mode: MODES.includes(data.mode) ? data.mode : 'ciegas', tournament };
  } catch {
    return null;
  }
}

export default function useCrack() {
  const [game, dispatch] = useReducer(gameReducer, null, restore), [home, setHome] = useState(!game), [photos, setPhotos] = useState({}), [loading, setLoading] = useState(true), [saveError, setSaveError] = useState(false), [photoError, setPhotoError] = useState('');
  useEffect(() => { if (!game) return; try { const snapshot = JSON.stringify(game); sessionStorage.setItem(STORE_KEY, snapshot); localStorage.setItem(STORE_KEY, snapshot); setSaveError(false); } catch { setSaveError(true); } }, [game]);
  useEffect(() => { let canceled = false; let local = {}; (async () => { try { local = await getPhotos(); } catch { if (!canceled) setPhotoError('El navegador no permite guardar fotos locales. Las fotos del catálogo siguen disponibles.'); } const candidates = {}; for (const p of CATALOG) { const catalogUrl = PHOTOS[p.name]?.url; const url = catalogUrl?.startsWith('/players/') ? catalogUrl : (local[p.name] || catalogUrl); if (url) candidates[p.id] = url; } const entries = Object.entries(candidates); const loaded = {}; for (let i = 0; i < entries.length; i += 6) { await Promise.all(entries.slice(i, i + 6).map(async ([id, url]) => { if (await preload(url)) loaded[id] = url; })); if (!canceled) setPhotos({ ...loaded }); } if (!canceled) setLoading(false); })(); return () => { canceled = true; Object.values(local).forEach(URL.revokeObjectURL); }; }, []);
  const upload = async (name, file) => { const test = URL.createObjectURL(file); const valid = await preload(test); URL.revokeObjectURL(test); if (!valid) throw new Error('La imagen no se puede abrir.'); const url = await savePhoto(name, file); const player = CATALOG.find(p => p.name === name); if (player) setPhotos(p => ({ ...p, [player.id]: url })); };
  const start = (players, mode) => { dispatch({ type: 'new', players, mode }); setHome(false); };
  const abandon = () => {
    try {
      localStorage.removeItem(STORE_KEY);
      sessionStorage.removeItem(STORE_KEY);
    } catch {}
    dispatch({ type: 'abandon' });
    setHome(true);
  };
  return { game, dispatch, home, setHome, photos, loading, saveError, photoError, upload, start, abandon, missing: CATALOG.filter(p => !photos[p.id]).length };
}
