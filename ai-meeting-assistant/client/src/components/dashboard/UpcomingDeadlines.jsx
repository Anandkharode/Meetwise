import { ArrowRight, CalendarClock, CircleCheck, Clock3, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';

function formatDueDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(date);
}

function Priority({ value }) {
  if (!value) return null;
  const className = {
    high: 'bg-rose-50 text-rose-700',
    medium: 'bg-amber-50 text-amber-700',
    low: 'bg-slate-100 text-slate-600',
  }[value] || 'bg-slate-100 text-slate-600';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${className}`}>{value}</span>;
}

export default function UpcomingDeadlines({ tasks, isLoading }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
        <div><h2 className="font-bold text-slate-900">Upcoming deadlines</h2><p className="mt-1 text-xs text-slate-500">Open tasks with a scheduled due date</p></div>
        <Link to="/tasks" aria-label="View all tasks" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900">All tasks <ArrowRight size={14} /></Link>
      </div>
      {isLoading ? <div className="space-y-4 p-6" role="status" aria-label="Loading deadlines">{[1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-slate-100" />)}</div> : tasks.length ? (
        <div className="divide-y divide-slate-100">
          {tasks.map((task) => <div key={task._id} className="flex gap-3 px-5 py-4 sm:px-6">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><CalendarClock size={17} /></span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-800">{task.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5"><Clock3 size={12} />{formatDueDate(task.deadline.normalizedDate)}</span>
                {task.responsiblePerson && <span className="inline-flex items-center gap-1.5"><UserRound size={12} />{task.responsiblePerson}</span>}
                <Priority value={task.priority} />
              </div>
            </div>
            <span className="inline-flex h-fit shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold capitalize text-slate-600">{task.status?.replaceAll('_', ' ') || 'Unknown'}</span>
          </div>)}
        </div>
      ) : (
        <div className="px-6 py-12 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><CircleCheck size={21} /></span>
          <p className="mt-4 text-sm font-semibold text-slate-800">No upcoming deadlines</p>
          <p className="mt-1 text-xs text-slate-500">Open tasks with future due dates will appear here.</p>
        </div>
      )}
    </article>
  );
}
