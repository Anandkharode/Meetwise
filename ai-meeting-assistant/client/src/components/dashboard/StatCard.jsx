export default function StatCard({ label, value, caption, icon: Icon, tone = 'blue', isLoading }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    violet: 'bg-violet-50 text-violet-700 ring-violet-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  };
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900" aria-live="polite">{isLoading ? '—' : value}</p>
          <p className="mt-1.5 text-xs text-slate-500">{caption}</p>
        </div>
        <span className={`grid h-11 w-11 place-items-center rounded-xl ring-1 ${tones[tone]}`}><Icon size={20} /></span>
      </div>
    </article>
  );
}
