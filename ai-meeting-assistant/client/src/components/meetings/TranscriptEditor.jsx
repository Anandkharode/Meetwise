import { FileText, LockKeyhole } from 'lucide-react';

/** Show transcript text; the current API has no transcript update endpoint. */
export default function TranscriptEditor({ transcript = '' }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold text-slate-900"><FileText size={18} className="text-blue-600" />Transcript</h2><span title="Transcript editing is not supported by the current API" className="inline-flex items-center gap-1.5 text-xs text-slate-400"><LockKeyhole size={13} />Read only</span></div>
    <div className="mt-4 max-h-[30rem] overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">{transcript || 'No transcript is available.'}</div>
  </section>;
}

