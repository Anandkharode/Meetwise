import { useRef, useState } from 'react';
import { FileAudio2, UploadCloud, X } from 'lucide-react';
import { formatFileSize, validateAudioFile } from '../../utils/meetingData.js';

export default function AudioUploader({ file, onChange, disabled = false, maxBytes }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const error = file ? validateAudioFile(file, maxBytes) : '';
  function choose(candidate) { onChange(candidate || null); }
  return <div>
    <input ref={inputRef} className="sr-only" type="file" accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4" onChange={(event) => choose(event.target.files?.[0])} disabled={disabled} />
    {!file ? <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()}
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
      onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files?.[0]); }}
      className={`flex min-h-48 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 text-center transition ${dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50'} disabled:cursor-not-allowed disabled:opacity-60`}>
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-blue-100 text-blue-700"><UploadCloud size={23} /></span>
      <span className="mt-3 text-sm font-semibold text-slate-800">Drop audio here or browse files</span>
      <span className="mt-1 text-xs text-slate-500">MP3, WAV, or M4A · up to {formatFileSize(maxBytes)}</span>
    </button> : <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700"><FileAudio2 size={19} /></span>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{file.name}</p><p className="mt-0.5 text-xs text-slate-500">{formatFileSize(file.size)}</p></div>
      <button type="button" aria-label="Remove audio file" disabled={disabled} onClick={() => choose(null)} className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-rose-600"><X size={17} /></button>
    </div>}
    {error && <p role="alert" className="mt-2 text-sm text-rose-600">{error}</p>}
  </div>;
}

