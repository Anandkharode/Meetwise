import { GitCommitHorizontal } from 'lucide-react';

export default function DecisionList({ decisions = [] }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <h2 className="flex items-center gap-2 font-semibold text-slate-900"><GitCommitHorizontal size={18} className="text-violet-600" />Extracted decisions</h2>
    <p className="mt-1 text-xs text-slate-500">Decision records returned by meeting analysis.</p>
    {!decisions.length ? <p className="mt-4 text-sm text-slate-500">No decision records were extracted.</p> :
      <ul className="mt-4 space-y-3">{decisions.map((decision, index) => <li key={`${index}-${decision.description}`} className="rounded-xl bg-violet-50/70 p-4">
        <p className="text-sm font-medium leading-6 text-slate-800">{decision.description}</p>
        {decision.sourceSentence && <p className="mt-2 border-l-2 border-violet-200 pl-3 text-xs leading-5 text-slate-500">“{decision.sourceSentence}”</p>}
        {typeof decision.confidence === 'number' && <p className="mt-2 text-[11px] text-slate-400">Model confidence: {Math.round(decision.confidence * 100)}%</p>}
      </li>)}</ul>}
  </section>;
}

