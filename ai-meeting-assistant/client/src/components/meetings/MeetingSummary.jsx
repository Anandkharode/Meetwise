import { ListChecks, Sparkles } from 'lucide-react';

export default function MeetingSummary({ summary = '', keyPoints = [] }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <h2 className="flex items-center gap-2 font-semibold text-slate-900"><Sparkles size={18} className="text-blue-600" />Meeting summary</h2>
    <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600">{summary || 'No summary is available yet.'}</p>
    {keyPoints.length > 0 && <div className="mt-5 border-t border-slate-100 pt-4"><h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><ListChecks size={16} className="text-blue-600" />Key points</h3>
      <ul className="mt-3 space-y-2">{keyPoints.map((point, index) => <li key={`${index}-${point}`} className="flex gap-2 text-sm leading-6 text-slate-600"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />{point}</li>)}</ul>
    </div>}
  </section>;
}

