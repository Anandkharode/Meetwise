import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export default function Alert({ type = 'error', children, onClose }) {
  const success = type === 'success';
  const Icon = success ? CheckCircle2 : AlertCircle;
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${success ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`} role={success ? 'status' : 'alert'}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <p className="flex-1 leading-5">{children}</p>
      {onClose && <button type="button" onClick={onClose} aria-label="Dismiss message" className="rounded p-0.5 opacity-70 hover:opacity-100"><X size={16} /></button>}
    </div>
  );
}
