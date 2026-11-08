const styles = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  processing: 'bg-blue-50 text-blue-700 ring-blue-200',
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  failed: 'bg-rose-50 text-rose-700 ring-rose-200',
};
const labels = { pending: 'Pending', processing: 'Processing', completed: 'Completed', failed: 'Failed' };

export default function AnalysisStatus({ status = 'pending' }) {
  const normalized = styles[status] ? status : 'pending';
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles[normalized]}`}>
    {normalized === 'processing' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
    {labels[normalized]}
  </span>;
}

