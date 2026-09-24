import { useState } from 'react';
import { Upload, ImageOff, ExternalLink } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { CATALOG, POSITIONS } from '@/components/crack/catalog';
import { PHOTOS } from '@/components/crack/photos';

export default function PhotoManager({ photos, onUpload }) {
  const [filter, setFilter] = useState('missing'), [busy, setBusy] = useState(null), [error, setError] = useState('');
  const upload = async (name, file) => {
    if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setError('Usá una imagen JPG, PNG o WebP de hasta 8 MB.');
      return;
    }
    setBusy(name);
    try { await onUpload(name, file); }
    catch { setError('No pudimos guardar esa foto en este navegador. Probá con una imagen más chica.'); }
    finally { setBusy(null); }
  };
  return <div className="photo-manager"><p>El catálogo conserva sus {CATALOG.length} futbolistas, con o sin foto. Las fotos disponibles provienen principalmente de Wikimedia Commons. Las fichas originales de autor y licencia se enlazan cuando están disponibles.</p><p>Las fotos faltantes se indican de forma explícita. Podés cargar el retrato correcto antes de empezar; se guarda solo en este navegador. Cargá únicamente imágenes que tengas permiso de usar.</p><div className="photo-filters"><button onClick={() => setFilter('missing')} className={filter === 'missing' ? 'active' : ''}>Pendientes ({CATALOG.filter(p => !photos[p.id]).length})</button><button onClick={() => setFilter('all')} className={filter === 'all' ? 'active' : ''}>Catálogo completo ({CATALOG.length})</button></div>{error && <p role="alert" className="error-message">{error}</p>}
    <div className="photo-list">{CATALOG.filter(p => filter === 'all' || !photos[p.id]).map(p => <div className="photo-row" key={p.id}>{photos[p.id] ? <Image src={photos[p.id]} alt={p.name} className="photo-thumb" /> : <div className="photo-thumb no-photo"><ImageOff size={20} /></div>}<div className="photo-name"><strong>{p.name}</strong><span>{POSITIONS[p.position].name} · {photos[p.id] ? 'Foto disponible' : 'Foto pendiente'}</span>{PHOTOS[p.name]?.source && <a href={PHOTOS[p.name].source} target="_blank" rel="noreferrer">Fuente, autor y licencia <ExternalLink size={10} /></a>}</div><label className="upload-button"><Upload size={15} /><span>{busy === p.name ? 'Guardando…' : 'Cargar'}</span><input aria-label={'Cargar foto de ' + p.name} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy !== null} onChange={e => upload(p.name, e.target.files?.[0])} /></label></div>)}</div>
  </div>;
}
