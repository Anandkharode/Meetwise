import { AudioLines } from 'lucide-react';

export default function Brand({ dark = false }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${dark ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white'} shadow-sm`}>
        <AudioLines size={21} strokeWidth={2.4} />
      </span>
      <span className={`text-lg font-bold tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>Meetwise</span>
    </div>
  );
}
