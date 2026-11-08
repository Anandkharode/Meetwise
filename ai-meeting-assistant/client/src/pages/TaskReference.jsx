import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckSquare, Clock3, UserRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import Alert from '../components/common/Alert.jsx';
import { getApiError } from '../services/api.js';
import { getTask } from '../services/taskService.js';
import { formatMeetingDate } from '../utils/meetingData.js';

export default function TaskReference() {
  const { taskId } = useParams();
  const [task, setTask] = useState(null);
  const [meeting, setMeeting] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    getTask(taskId, controller.signal).then((result) => { setTask(result.task); setMeeting(result.meeting); })
      .catch((requestError) => { if (requestError.code !== 'ERR_CANCELED') setError(getApiError(requestError, 'Could not load this task.')); });
    return () => controller.abort();
  }, [taskId]);

  if (error) return <div className="mx-auto max-w-2xl space-y-5"><Link to="/meetings" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><ArrowLeft size={16} />Meetings</Link><Alert>{error}</Alert></div>;
  if (!task) return <div className="mx-auto max-w-2xl"><div className="h-8 w-1/2 animate-pulse rounded bg-slate-200" /><div className="mt-5 h-40 animate-pulse rounded-2xl bg-white" /></div>;
  return <div className="mx-auto max-w-3xl space-y-5">
    {meeting && <Link to={`/meetings/${task.meetingId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline"><ArrowLeft size={16} />{meeting.title}</Link>}
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckSquare size={17} />Task detail</div><h1 className="mt-3 text-2xl font-bold text-slate-900">{task.description}</h1>
      <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
        <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</dt><dd className="mt-1 text-sm capitalize text-slate-700">{String(task.status || '').replace('_', ' ')}</dd></div>
        {task.responsiblePerson && <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Assigned to</dt><dd className="mt-1 flex items-center gap-1.5 text-sm text-slate-700"><UserRound size={14} />{task.responsiblePerson}</dd></div>}
        {task.deadline?.normalizedDate && <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Deadline</dt><dd className="mt-1 flex items-center gap-1.5 text-sm text-slate-700"><CalendarDays size={14} />{formatMeetingDate(task.deadline.normalizedDate)}</dd></div>}
        {task.priority && <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Priority</dt><dd className="mt-1 text-sm capitalize text-slate-700">{task.priority}</dd></div>}
      </dl>
      {task.sourceSentence && <div className="mt-6 rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Evidence sentence</p><p className="mt-2 text-sm leading-6 text-slate-600">“{task.sourceSentence}”</p></div>}
      {meeting?.meetingDate && <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400"><Clock3 size={13} />From meeting on {formatMeetingDate(meeting.meetingDate)}</p>}
    </section>
    <p className="text-xs text-slate-400">Task editing is available in the Tasks module stage.</p>
  </div>;
}
