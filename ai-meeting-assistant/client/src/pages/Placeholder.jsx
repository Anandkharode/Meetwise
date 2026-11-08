import { ArrowLeft, Construction } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const copy = {
  '/meetings': ['Meetings', 'Your meeting library will live here.'],
  '/tasks': ['Tasks', 'Your action items will live here.'],
  '/settings': ['Settings', 'Workspace preferences will live here.'],
  '/meetings/upload': ['Upload a meeting', 'Audio upload will be available in the next stage.'],
  '/meetings/new': ['Create a meeting', 'Meeting creation will be available in the next stage.'],
};

export default function Placeholder() {
  const location = useLocation();
  const [title, description] = copy[location.pathname]
    || (location.pathname.startsWith('/meetings/') ? ['Meeting details', 'Meeting details will be available in the next stage.'] : ['Page', 'This page is not available yet.']);
  return (
    <section className="mx-auto grid min-h-[55vh] max-w-xl place-items-center text-center">
      <div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Construction size={25} /></span><h1 className="mt-5 text-2xl font-bold text-slate-900">{title}</h1><p className="mt-2 text-sm text-slate-500">{description}</p><Link to="/dashboard" className="mt-6 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"><ArrowLeft size={16} /> Back to dashboard</Link></div>
    </section>
  );
}
