import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
export default function GameModal({ title, description, open, onClose, children }) {
  return <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}><DialogContent className="crack-modal"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{children}</DialogContent></Dialog>;
}
