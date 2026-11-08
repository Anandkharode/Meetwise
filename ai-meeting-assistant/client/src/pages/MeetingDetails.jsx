import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, AudioLines, CalendarDays, FileText, LoaderCircle, RefreshCw } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Alert from '../components/common/Alert.jsx';
import AnalysisStatus from '../components/meetings/AnalysisStatus.jsx';
import DecisionList from '../components/meetings/DecisionList.jsx';
import ExtractedTaskList from '../components/meetings/ExtractedTaskList.jsx';
import MeetingSummary from '../components/meetings/MeetingSummary.jsx';
import TranscriptEditor from '../components/meetings/TranscriptEditor.jsx';
import { analyzeMeeting, getMeeting } from '../services/meetingService.js';
import { getApiError } from '../services/api.js';
import { formatMeetingDate } from '../utils/meetingData.js';

export default function MeetingDetails() {
  const { meetingId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.notice || '');

  const load = useCallback(async (signal) => {
    setIsLoading(true); setError('');
    try {
      const result = await getMeeting(meetingId, signal);
      setMeeting(result.meeting || null); setTasks(result.tasks || []);
    } catch (requestError) {
      if (requestError.code !== 'ERR_CANCELED') setError(getApiError(requestError, 'Could not load meeting details.'));
    } finally { if (!signal?.aborted) setIsLoading(false); }
  }, [meetingId]);

  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);

  async function reanalyze() {
    if (isAnalyzing || meeting?.analysisStatus === 'processing') return;
    setIsAnalyzing(true); setError(''); setNotice('');
    setMeeting((current) => current ? { ...current, analysisStatus: 'processing' } : current);
    try {
      const result = await analyzeMeeting(meetingId, { reanalyze: meeting?.analysisStatus === 'completed' });
      setMeeting(result.meeting || null); setTasks(result.tasks || []); setNotice('Meeting analysis is complete.');
    } catch (requestError) {
      setError(getApiError(requestError, 'Could not analyze this meeting.'));
      await load();
    } finally { setIsAnalyzing(false); }
  }

  if (isLoading) return <div className="mx-auto max-w-4xl space-y-5"><div className="h-8 w-1/3 animate-pulse rounded bg-slate-200" /><div className="h-36 animate-pulse rounded-2xl bg-white" /><div className="h-64 animate-pulse rounded-2xl bg-white" /></div>;
  if (error && !meeting) return <section className="mx-auto max-w-2xl space-y-5 py-8"><Link to="/meetings" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><ArrowLeft size={16} />All meetings</Link><Alert>{error}</Alert><button onClick={() => load()} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">Try again</button></section>;
  if (!meeting) return null;

  const SourceIcon = meeting.sourceType === 'audio' ? AudioLines : FileText;
  return <div className="mx-auto max-w-5xl space-y-6">
    <div><Link to="/meetings" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline"><ArrowLeft size={16} />All meetings</Link>
      <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="min-w-0"><h1 className="break-words text-3xl font-bold tracking-tight text-slate-900">{meeting.title}</h1><div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500"><span className="inline-flex items-center gap-1.5"><CalendarDays size={15} />{formatMeetingDate(meeting.meetingDate)}</span><span className="inline-flex items-center gap-1.5 capitalize"><SourceIcon size={15} />{meeting.sourceType}</span><AnalysisStatus status={meeting.analysisStatus} /></div></div>
        <button type="button" onClick={reanalyze} disabled={isAnalyzing || meeting.analysisStatus === 'processing' || !meeting.transcript?.trim()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw size={16} className={isAnalyzing ? 'animate-spin' : ''} />{isAnalyzing ? 'Analyzing…' : meeting.analysisStatus === 'completed' ? 'Re-analyze' : 'Analyze meeting'}</button>
      </div>
    </div>
    {notice && <Alert type="success" onClose={() => setNotice('')}>{notice}</Alert>}
    {error && <Alert>{error}</Alert>}
    {meeting.analysisStatus === 'failed' && meeting.analysisError && <div className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertCircle size={17} className="mt-0.5 shrink-0" />{meeting.analysisError}</div>}
    {isAnalyzing && <div role="status" className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700"><LoaderCircle size={17} className="animate-spin" />Analysis is running. This page will show the latest results when it finishes.</div>}
    <div className="grid gap-5 lg:grid-cols-2"><MeetingSummary summary={meeting.summary} keyPoints={meeting.keyPoints || []} /><DecisionList decisions={meeting.decisions || []} /></div>
    <ExtractedTaskList tasks={tasks} />
    <TranscriptEditor transcript={meeting.transcript} />
    {meeting.analysisMetadata?.warnings?.length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="text-sm font-semibold text-amber-900">Analysis notes</h2><ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-800">{meeting.analysisMetadata.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></section>}
    <div className="text-xs text-slate-400">{meeting.analysisMetadata?.totalSentences != null ? `${meeting.analysisMetadata.totalSentences} sentences analyzed` : ''}</div>
  </div>;
}
