import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, FilterX, Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import Alert from '../components/common/Alert.jsx';
import MeetingCard from '../components/meetings/MeetingCard.jsx';
import MeetingTable from '../components/meetings/MeetingTable.jsx';
import { deleteMeeting, listAllMeetings } from '../services/meetingService.js';
import { getApiError } from '../services/api.js';
import { filterMeetings } from '../utils/meetingData.js';

const PAGE_SIZE = 10;

export default function Meetings() {
  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [sourceType, setSourceType] = useState('all');
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async (signal) => {
    setIsLoading(true); setError('');
    try { setMeetings(await listAllMeetings(signal)); }
    catch (requestError) { if (requestError.code !== 'ERR_CANCELED') setError(getApiError(requestError, 'Could not load meetings.')); }
    finally { if (!signal?.aborted) setIsLoading(false); }
  }, []);

  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);

  const filtered = useMemo(() => filterMeetings(meetings, { search, date, sourceType }), [meetings, search, date, sourceType]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  function setFilter(setter, value) { setter(value); setPage(1); }

  async function onDelete(meeting) {
    if (!window.confirm(`Delete “${meeting.title}” and its associated tasks?`)) return;
    setDeletingId(meeting._id); setError('');
    try { await deleteMeeting(meeting._id); setMeetings((items) => items.filter((item) => item._id !== meeting._id)); }
    catch (requestError) { setError(getApiError(requestError, 'Could not delete this meeting.')); }
    finally { setDeletingId(null); }
  }

  const hasFilters = search || date || sourceType !== 'all';
  return <div className="space-y-6">
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-sm font-medium text-blue-700">Your workspace</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Meetings</h1><p className="mt-2 text-sm text-slate-500">Browse transcripts, analysis, and action items from your meetings.</p></div>
      <Link to="/meetings/new" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"><Plus size={17} />Create meeting</Link>
    </section>
    {error && <Alert>{error} <button className="ml-1 font-semibold underline" onClick={() => load()}>Try again</button></Alert>}

    <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(220px,1fr)_190px_170px_auto] md:items-end">
      <label className="block text-xs font-semibold text-slate-600">Search title<span className="relative mt-1.5 block"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setFilter(setSearch, event.target.value)} type="search" placeholder="Search meetings" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" /></span></label>
      <label className="block text-xs font-semibold text-slate-600">Meeting date<input value={date} onChange={(event) => setFilter(setDate, event.target.value)} type="date" className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" /></label>
      <label className="block text-xs font-semibold text-slate-600">Source type<select value={sourceType} onChange={(event) => setFilter(setSourceType, event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"><option value="all">All sources</option><option value="text">Text</option><option value="audio">Audio</option></select></label>
      <button type="button" disabled={!hasFilters} onClick={() => { setSearch(''); setDate(''); setSourceType('all'); setPage(1); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-40"><FilterX size={16} />Clear</button>
    </section>

    <div className="flex items-center justify-between"><p className="text-sm text-slate-500">{hasFilters ? `${filtered.length} matching meetings` : `${meetings.length} meetings`}</p>{pages > 1 && <p className="text-xs text-slate-400">Page {page} of {pages}</p>}</div>
    {isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:hidden">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl bg-slate-200" />)}</div> : null}
    {!isLoading && !error && meetings.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700"><CalendarPlus size={22} /></span><h2 className="mt-4 text-lg font-bold text-slate-900">No meetings yet</h2><p className="mt-1 text-sm text-slate-500">Create a meeting from a transcript or upload a recording.</p><Link to="/meetings/new" className="mt-5 inline-flex rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Create meeting</Link></div>}
    {!isLoading && meetings.length > 0 && visible.length === 0 && <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center"><h2 className="font-semibold text-slate-900">No matching meetings</h2><p className="mt-1 text-sm text-slate-500">Change or clear your filters to see more results.</p></div>}
    {!isLoading && visible.length > 0 && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:hidden">{visible.map((meeting) => <MeetingCard key={meeting._id} meeting={meeting} onDelete={onDelete} deleting={deletingId === meeting._id} />)}</div>
      <div className="hidden xl:block"><MeetingTable meetings={visible} onDelete={onDelete} deletingId={deletingId} /></div>
    </>}
    {pages > 1 && <nav aria-label="Meeting pages" className="flex items-center justify-center gap-3"><button disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-40">Previous</button><span className="text-sm text-slate-500">{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-40">Next</button></nav>}
  </div>;
}
