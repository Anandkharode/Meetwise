import { useEffect, useRef, useState } from 'react';
import { AudioLines, CheckCircle2, FileText, LoaderCircle, UploadCloud } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Alert from '../components/common/Alert.jsx';
import AudioUploader from '../components/meetings/AudioUploader.jsx';
import { analyzeMeeting, createMeeting, uploadAudioMeeting } from '../services/meetingService.js';
import { getApiError } from '../services/api.js';
import { validateAudioFile } from '../utils/meetingData.js';

const MAX_AUDIO_BYTES = Number(import.meta.env.VITE_MAX_AUDIO_UPLOAD_BYTES) || 100 * 1024 * 1024;
const today = new Date().toISOString().slice(0, 10);

export default function MeetingForm({ initialTab = 'text' }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') === 'audio' || initialTab === 'audio' ? 'audio' : 'text');
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(today);
  const [transcript, setTranscript] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [uploadPercent, setUploadPercent] = useState(0);
  const lockRef = useRef(false);

  useEffect(() => {
    const nextTab = searchParams.get('tab') === 'audio' || initialTab === 'audio' ? 'audio' : 'text';
    setTab(nextTab);
  }, [initialTab, searchParams]);

  function chooseTab(nextTab) {
    if (busy) return;
    setTab(nextTab);
    if (nextTab === 'audio') setSearchParams({ tab: 'audio' }, { replace: true });
    else setSearchParams({}, { replace: true });
  }

  async function submitText(event) {
    event.preventDefault();
    if (lockRef.current) return;
    if (!title.trim() || !meetingDate || !transcript.trim()) { setError('Enter a title, date, and transcript.'); return; }
    lockRef.current = true; setBusy(true); setError(''); setStage('Creating meeting…');
    let createdId;
    try {
      const created = await createMeeting({ title: title.trim(), meetingDate, transcript: transcript.trim(), sourceType: 'text' });
      createdId = created.meeting?._id;
      if (!createdId) throw new Error('The server created the meeting but did not return its identifier.');
      setStage('Analyzing transcript…');
      await analyzeMeeting(createdId);
      navigate(`/meetings/${createdId}`, { state: { notice: 'Meeting created and analyzed.' } });
    } catch (requestError) {
      setError(getApiError(requestError, 'Could not create and analyze the meeting.'));
      if (createdId) setStage('Meeting saved; analysis did not finish.');
    } finally { lockRef.current = false; setBusy(false); }
  }

  async function submitAudio(event) {
    event.preventDefault();
    if (lockRef.current) return;
    const fileError = validateAudioFile(file, MAX_AUDIO_BYTES);
    if (fileError || !title.trim() || !meetingDate) { setError(fileError || 'Enter a title and meeting date.'); return; }
    lockRef.current = true; setBusy(true); setError(''); setStage('Uploading audio…'); setUploadPercent(0);
    try {
      const result = await uploadAudioMeeting({ title: title.trim(), meetingDate, audio: file,
        onUploadProgress: (event) => {
          if (event.total) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadPercent(percent);
            if (percent >= 100) setStage('Transcribing and analyzing…');
          }
        },
      });
      const id = result.meeting?._id;
      if (!id) throw new Error('The server completed processing but did not return the meeting identifier.');
      navigate(`/meetings/${id}`, { state: { notice: result.transcription?.text ? 'Audio transcribed and meeting analyzed.' : 'Audio uploaded and meeting analyzed.' } });
    } catch (requestError) {
      setError(getApiError(requestError, 'Audio upload or processing failed.'));
      if (requestError.response?.data?.meeting?._id) {
        setStage('A meeting record was created; processing failed.');
      }
    } finally { lockRef.current = false; setBusy(false); }
  }

  return <div className="mx-auto max-w-3xl space-y-6">
    <div><Link to="/meetings" className="text-sm font-semibold text-blue-700 hover:underline">← All meetings</Link><h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Create a meeting</h1><p className="mt-2 text-sm text-slate-500">Add a transcript or upload audio for local transcription and analysis.</p></div>
    {error && <Alert>{error}{stage.includes('saved') || stage.includes('record was created') ? <> <Link to="/meetings" className="font-semibold underline">View meetings</Link></> : null}</Alert>}
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div role="tablist" aria-label="Meeting input type" className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
        <button role="tab" aria-selected={tab === 'audio'} onClick={() => chooseTab('audio')} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold ${tab === 'audio' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}><AudioLines size={17} />Upload audio</button>
        <button role="tab" aria-selected={tab === 'text'} onClick={() => chooseTab('text')} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold ${tab === 'text' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}><FileText size={17} />Paste transcript</button>
      </div>
      <form onSubmit={tab === 'audio' ? submitAudio : submitText} className="mt-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_210px]">
          <label className="block text-sm font-semibold text-slate-700">Meeting title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} required placeholder="e.g. Product planning" disabled={busy} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50" /></label>
          <label className="block text-sm font-semibold text-slate-700">Meeting date<input value={meetingDate} onChange={(event) => setMeetingDate(event.target.value)} type="date" required disabled={busy} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50" /></label>
        </div>
        {tab === 'audio' ? <>
          <AudioUploader file={file} onChange={setFile} disabled={busy} maxBytes={MAX_AUDIO_BYTES} />
          {busy && <div><div className="mb-1 flex justify-between text-xs text-slate-500"><span>{stage}</span><span>{stage === 'Uploading audio…' ? `${uploadPercent}%` : <LoaderCircle size={14} className="animate-spin" />}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full bg-blue-600 transition-all ${stage === 'Transcribing and analyzing…' ? 'w-full animate-pulse' : ''}`} style={stage === 'Uploading audio…' ? { width: `${uploadPercent}%` } : undefined} /></div></div>}
          <p className="text-xs leading-5 text-slate-400">Audio is transcribed by the configured local Whisper.cpp service. Processing may take several minutes.</p>
        </> : <label className="block text-sm font-semibold text-slate-700">Transcript<textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} required rows={12} disabled={busy} placeholder="Paste the meeting transcript…" className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-3 py-3 text-sm font-normal leading-6 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-50" /></label>}
        <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-100 pt-5 sm:flex-row">
          <Link to="/meetings" className="rounded-xl border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</Link>
          <button disabled={busy || (tab === 'audio' && Boolean(validateAudioFile(file, MAX_AUDIO_BYTES)))} type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? <><LoaderCircle size={16} className="animate-spin" />{stage || 'Working…'}</> : <>{tab === 'audio' ? <UploadCloud size={16} /> : <CheckCircle2 size={16} />}{tab === 'audio' ? 'Upload and analyze' : 'Create and analyze'}</>}
          </button>
        </div>
      </form>
    </div>
  </div>;
}
