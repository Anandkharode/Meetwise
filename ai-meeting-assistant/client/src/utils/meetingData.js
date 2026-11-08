/** Format a backend meeting date without shifting calendar dates across timezones. */
export function formatMeetingDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
}

/** Filter meetings by title, meeting day, and exact source type. */
export function filterMeetings(meetings, { search = '', date = '', sourceType = 'all' } = {}) {
  const query = search.trim().toLocaleLowerCase();
  return meetings.filter((meeting) => {
    const titleMatches = !query || String(meeting.title || '').toLocaleLowerCase().includes(query);
    const parsedDate = new Date(meeting.meetingDate);
    const dateMatches = !date || (!Number.isNaN(parsedDate.valueOf()) && parsedDate.toISOString().slice(0, 10) === date);
    const sourceMatches = sourceType === 'all' || meeting.sourceType === sourceType;
    return titleMatches && dateMatches && sourceMatches;
  });
}

/** Validate the supported local audio extensions and configured size ceiling. */
export function validateAudioFile(file, maxBytes) {
  if (!file) return 'Choose an audio file first.';
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!['mp3', 'wav', 'm4a'].includes(extension)) return 'Choose an MP3, WAV, or M4A file.';
  if (maxBytes > 0 && file.size > maxBytes) return `File exceeds the ${formatFileSize(maxBytes)} upload limit.`;
  return '';
}

/** Convert bytes to a compact readable file size. */
export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unit = units[0];
  for (let index = 1; size >= 1024 && index < units.length; index += 1) {
    size /= 1024;
    unit = units[index];
  }
  return `${size.toFixed(size < 10 ? 1 : 0)} ${unit}`;
}
