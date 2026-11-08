import { ArrowUpRight, CalendarDays, FileText, Mic2 } from 'lucide-react';
import { Link } from 'react-router-dom';

function formatMeetingDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(date);
}

function AnalysisBadge({ status }) {
  const appearance = {
    completed: 'bg-emerald-50 text-emerald-700',
    failed: 'bg-rose-50 text-rose-700',
    processing: 'bg-blue-50 text-blue-700',
    pending: 'bg-slate-100 text-slate-600',
  }[status] || 'bg-slate-100 text-slate-600';
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${appearance}`}>{status || 'Unknown'}</span>;
}

function SourceType({ sourceType }) {
  const isAudio = sourceType === 'audio';
  const Icon = isAudio ? Mic2 : FileText;
  return <span className="inline-flex items-center gap-1.5 capitalize"><Icon size={13} />{sourceType || 'unknown'}</span>;
}

export default function RecentMeetings({ meetings, isLoading }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
        <div><h2 className="font-bold text-slate-900">Recent meetings</h2><p className="mt-1 text-xs text-slate-500">Your five latest meeting records</p></div>
        <Link to="/meetings" className="text-xs font-semibold text-blue-700 hover:text-blue-900">View all</Link>
      </div>
      {isLoading ? (
        <div className="space-y-4 p-6" aria-label="Loading meetings" role="status">{[1, 2, 3, 4, 5].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}</div>
      ) : meetings.length ? (
        <div className="divide-y divide-slate-100">
          {meetings.map((meeting) => <div key={meeting._id} className="flex items-center gap-3 px-5 py-4 sm:gap-4 sm:px-6">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><CalendarDays size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{meeting.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                <span>{formatMeetingDate(meeting.meetingDate)}</span><span aria-hidden="true">·</span><SourceType sourceType={meeting.sourceType} />
              </div>
            </div>
            <AnalysisBadge status={meeting.analysisStatus} />
            <Link to={`/meetings/${meeting._id}`} aria-label={`View meeting: ${meeting.title}`} title="View meeting" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-blue-50 hover:text-blue-700"><ArrowUpRight size={17} /></Link>
          </div>)}
        </div>
      ) : (
        <div className="px-6 py-12 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500"><CalendarDays size={21} /></span>
          <p className="mt-4 text-sm font-semibold text-slate-800">No meetings yet</p>
          <p className="mt-1 text-xs text-slate-500">Create or upload a meeting to see it here.</p>
        </div>
      )}
    </article>
  );
}
