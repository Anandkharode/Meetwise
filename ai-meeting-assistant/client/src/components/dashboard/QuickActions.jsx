import { ArrowUpRight, FilePlus2, ListChecks, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';

const actions = [
  { label: 'Upload meeting', description: 'Transcribe an audio recording', to: '/meetings/upload', icon: Upload, style: 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20' },
  { label: 'Create meeting', description: 'Add a transcript or notes', to: '/meetings/new', icon: FilePlus2, style: 'bg-white text-slate-800 hover:bg-slate-50 border border-slate-200' },
  { label: 'View all tasks', description: 'Review your action items', to: '/tasks', icon: ListChecks, style: 'bg-white text-slate-800 hover:bg-slate-50 border border-slate-200' },
];

export default function QuickActions() {
  return <section aria-labelledby="quick-actions-title">
    <div className="mb-3 flex items-center justify-between"><div><h2 id="quick-actions-title" className="text-sm font-bold text-slate-900">Quick actions</h2><p className="mt-1 text-xs text-slate-500">Jump into your workflow</p></div></div>
    <div className="grid gap-3 sm:grid-cols-3">
      {actions.map(({ label, description, to, icon: Icon, style }) => <Link key={label} to={to} className={`group flex items-center gap-3 rounded-xl px-4 py-3.5 shadow-sm transition ${style}`}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-black/5"><Icon size={18} /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{label}</span><span className={`mt-0.5 block truncate text-xs ${label === 'Upload meeting' ? 'text-blue-100' : 'text-slate-500'}`}>{description}</span></span>
        <ArrowUpRight size={16} className="shrink-0 opacity-50 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" />
      </Link>)}
    </div>
  </section>;
}
