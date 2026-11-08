import { CheckCircle2, CircleDashed, ListTodo, LoaderCircle } from 'lucide-react';
import { getCompletionPercentage } from '../../utils/dashboardData.js';

const rows = [
  { key: 'pendingTasks', label: 'Pending', icon: CircleDashed, color: 'bg-amber-500', text: 'text-amber-700' },
  { key: 'inProgressTasks', label: 'In progress', icon: LoaderCircle, color: 'bg-blue-600', text: 'text-blue-700' },
  { key: 'completedTasks', label: 'Completed', icon: CheckCircle2, color: 'bg-emerald-500', text: 'text-emerald-700' },
];

export default function TaskOverview({ stats, isLoading }) {
  const total = Number(stats?.totalTasks) || 0;
  const completed = Number(stats?.completedTasks) || 0;
  const completion = getCompletionPercentage(stats);

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div><h2 className="font-bold text-slate-900">Task overview</h2><p className="mt-1 text-xs text-slate-500">A live breakdown of your action items</p></div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-700"><ListTodo size={19} /></span>
      </div>

      {isLoading ? <div className="mt-6 space-y-4" role="status" aria-label="Loading task statistics">{[1, 2, 3].map((item) => <div key={item} className="h-8 animate-pulse rounded-lg bg-slate-100" />)}</div> : total === 0 ? (
        <div className="py-9 text-center"><p className="text-sm font-semibold text-slate-800">No tasks to summarize</p><p className="mt-1 text-xs text-slate-500">Tasks will be counted here when available.</p></div>
      ) : <>
        <div className="mt-7 flex items-end justify-between">
          <div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Completion</p><p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{completion}<span className="ml-0.5 text-lg text-slate-500">%</span></p></div>
          <p className="pb-1 text-xs text-slate-500">{completed} of {total} tasks</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Task completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow={completion}>
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${completion}%` }} />
        </div>
        <div className="mt-6 space-y-4">
          {rows.map(({ key, label, icon: Icon, color, text }) => {
            const count = Number(stats?.[key]) || 0;
            const width = total ? Math.min(100, (count / total) * 100) : 0;
            return <div key={key}>
              <div className="mb-2 flex items-center justify-between text-sm"><span className={`inline-flex items-center gap-2 font-medium ${text}`}><Icon size={15} />{label}</span><span className="font-semibold text-slate-700">{count}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} /></div>
            </div>;
          })}
        </div>
      </>}
    </article>
  );
}
