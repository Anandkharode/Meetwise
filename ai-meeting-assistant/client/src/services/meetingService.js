import api from './api.js';

const AUDIO_PROCESSING_TIMEOUT_MS = 30 * 60 * 1000;

/** List one page of the authenticated user's meetings. */
export async function listMeetings({ page = 1, limit = 10 } = {}, signal) {
  const { data } = await api.get('/meetings', { params: { page, limit }, signal });
  return data;
}

/** Fetch every page supported by the existing paginated endpoint. */
export async function listAllMeetings(signal) {
  const first = await listMeetings({ page: 1, limit: 100 }, signal);
  const totalPages = Math.max(1, Number(first.pagination?.totalPages) || 1);
  const remaining = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) =>
    listMeetings({ page: index + 2, limit: 100 }, signal)));
  return [first, ...remaining].flatMap((page) => page.meetings || []);
}

/** Create a text meeting; analysis is intentionally a separate API operation. */
export async function createMeeting(input, signal) {
  const { data } = await api.post('/meetings', input, { signal });
  return data;
}

/** Upload audio and wait for transcription and analysis to complete. */
export async function uploadAudioMeeting({ title, meetingDate, audio, onUploadProgress, signal }) {
  const formData = new FormData();
  formData.append('title', title);
  formData.append('meetingDate', meetingDate);
  formData.append('audio', audio);
  const { data } = await api.post('/meetings/upload-audio', formData, {
    signal,
    timeout: AUDIO_PROCESSING_TIMEOUT_MS,
    headers: { 'Content-Type': undefined },
    onUploadProgress,
  });
  return data;
}

/** Get an owned meeting and its separate associated task documents. */
export async function getMeeting(meetingId, signal) {
  const { data } = await api.get(`/meetings/${encodeURIComponent(meetingId)}`, { signal });
  return data;
}

/** Run or re-run analysis on an existing meeting. */
export async function analyzeMeeting(meetingId, { reanalyze = false } = {}, signal) {
  const { data } = await api.post(`/meetings/${encodeURIComponent(meetingId)}/analyze`, { reanalyze }, {
    signal,
    timeout: 5 * 60 * 1000,
  });
  return data;
}

/** Delete an owned meeting; the backend also deletes its tasks and audio file. */
export async function deleteMeeting(meetingId, signal) {
  const { data } = await api.delete(`/meetings/${encodeURIComponent(meetingId)}`, { signal });
  return data;
}
