import { CalendarDays, Eye, FileAudio2, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import AnalysisStatus from './AnalysisStatus.jsx';
import { formatMeetingDate } from '../../utils/meetingData.js';

export default function MeetingCard({ meeting, onDelete, deleting = false }) {
  const SourceIcon = meeting.sourceType === 'audio' ? FileAudio2 : FileText;
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="truncate font-semibold text-slate-900">{meeting.title}</h2>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500"><CalendarDays size={15} />{formatMeetingDate(meeting.meetingDate)}</p>
      </div><AnalysisStatus status={meeting.analysisStatus} />
    </div>
    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium capitalize text-slate-500"><SourceIcon size={14} />{meeting.sourceType}</span>
      <div className="flex gap-2">
        <Link to={`/meetings/${meeting._id}`} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"><Eye size={14} />View</Link>
        <button type="button" onClick={() => onDelete(meeting)} disabled={deleting} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">{deleting ? 'Deleting…' : 'Delete'}</button>
      </div>
    </div>
  </article>;
}

