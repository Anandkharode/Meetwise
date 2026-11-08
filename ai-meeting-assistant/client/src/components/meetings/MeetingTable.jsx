import { CalendarDays, Eye, FileAudio2, FileText, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import AnalysisStatus from './AnalysisStatus.jsx';
import { formatMeetingDate } from '../../utils/meetingData.js';

export default function MeetingTable({ meetings, onDelete, deletingId = null }) {
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left">
      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
        <th className="px-5 py-4 font-semibold">Meeting</th><th className="px-5 py-4 font-semibold">Date</th><th className="px-5 py-4 font-semibold">Source</th><th className="px-5 py-4 font-semibold">Analysis</th><th className="px-5 py-4 text-right font-semibold">Actions</th>
      </tr></thead>
      <tbody className="divide-y divide-slate-100">{meetings.map((meeting) => {
        const Icon = meeting.sourceType === 'audio' ? FileAudio2 : FileText;
        return <tr key={meeting._id} className="hover:bg-slate-50/70">
          <td className="max-w-[320px] px-5 py-4"><Link to={`/meetings/${meeting._id}`} className="truncate font-semibold text-slate-900 hover:text-blue-700">{meeting.title}</Link></td>
          <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600"><CalendarDays size={14} className="mr-1.5 inline" />{formatMeetingDate(meeting.meetingDate)}</td>
          <td className="px-5 py-4 text-sm capitalize text-slate-600"><Icon size={15} className="mr-1.5 inline" />{meeting.sourceType}</td>
          <td className="px-5 py-4"><AnalysisStatus status={meeting.analysisStatus} /></td>
          <td className="px-5 py-4"><div className="flex justify-end gap-1">
            <Link aria-label={`View ${meeting.title}`} to={`/meetings/${meeting._id}`} className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700"><Eye size={17} /></Link>
            <button type="button" aria-label={`Delete ${meeting.title}`} disabled={deletingId === meeting._id} onClick={() => onDelete(meeting)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"><Trash2 size={17} /></button>
          </div></td>
        </tr>;
      })}</tbody>
    </table></div>
  </div>;
}

