import { ArrowUpRight, CheckCircle2, CircleDashed, Clock3, ListTodo } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatMeetingDate } from '../../utils/meetingData.js';

const statusStyle = { pending: 'bg-amber-50 text-amber-700', in_progress: 'bg-blue-50 text-blue-700', completed: 'bg-emerald-50 text-emerald-700' };
const statusLabel = { pending: 'Pending', in_progress: 'In progress', completed: 'Completed' };

export default function ExtractedTaskList({ tasks = [] }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <h2 className="flex items-center gap-2 font-semibold text-slate-900"><ListTodo size={18} className="text-emerald-600" />Extracted tasks <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{tasks.length}</span></h2>
    {!tasks.length ? <p className="mt-4 text-sm text-slate-500">No tasks were extracted.</p> : <ul className="mt-4 divide-y divide-slate-100">{tasks.map((task) => {
      const StatusIcon = task.status === 'completed' ? CheckCircle2 : task.status === 'in_progress' ? Clock3 : CircleDashed;
      return <li key={task._id} className="py-4 first:pt-0 last:pb-0">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="min-w-0">
          <p className="text-sm font-semibold leading-6 text-slate-800">{task.description}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            {task.responsiblePerson && <span>Assigned to {task.responsiblePerson}</span>}
            {task.deadline?.normalizedDate && <span>Due {formatMeetingDate(task.deadline.normalizedDate)}{task.deadline.originalText ? ` · ${task.deadline.originalText}` : ''}</span>}
            {task.priority && <span className="capitalize">{task.priority} priority</span>}
          </div>
        </div><span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[task.status] || 'bg-slate-100 text-slate-600'}`}><StatusIcon size={13} />{statusLabel[task.status] || task.status}</span></div>
        {task._id && <Link to={`/tasks/${task._id}`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline">Open task <ArrowUpRight size={13} /></Link>}
      </li>;
    })}</ul>}
  </section>;
}

