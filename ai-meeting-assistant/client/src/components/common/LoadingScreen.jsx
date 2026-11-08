export default function LoadingScreen({ label = 'Loading…' }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
        {label}
      </div>
    </main>
  );
}
