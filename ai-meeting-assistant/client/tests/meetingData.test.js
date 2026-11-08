import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterMeetings, formatFileSize, formatMeetingDate, validateAudioFile } from '../src/utils/meetingData.js';

const meetings = [
  { title: 'Planning Session', meetingDate: '2026-11-08T00:00:00.000Z', sourceType: 'text' },
  { title: 'Customer interview', meetingDate: '2026-11-09T00:00:00.000Z', sourceType: 'audio' },
  { title: 'Planning follow-up', meetingDate: '2026-11-10T00:00:00.000Z', sourceType: 'audio' },
];

test('meeting filters combine title, exact date, and source type', () => {
  assert.deepEqual(filterMeetings(meetings, { search: 'planning', sourceType: 'audio' }), [meetings[2]]);
  assert.deepEqual(filterMeetings(meetings, { date: '2026-11-09' }), [meetings[1]]);
  assert.deepEqual(filterMeetings(meetings, { search: 'ABSENT' }), []);
});

test('meeting date formatter preserves calendar date in UTC', () => {
  assert.equal(formatMeetingDate('2026-11-08T00:00:00.000Z'), new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  }).format(new Date('2026-11-08T00:00:00.000Z')));
  assert.equal(formatMeetingDate('invalid'), 'Date unavailable');
});

test('audio validation accepts supported extensions and rejects unsupported or oversized files', () => {
  assert.equal(validateAudioFile({ name: 'meeting.MP3', size: 100 }, 1000), '');
  assert.match(validateAudioFile({ name: 'meeting.ogg', size: 100 }, 1000), /MP3, WAV, or M4A/);
  assert.match(validateAudioFile({ name: 'meeting.wav', size: 1001 }, 1000), /upload limit/);
  assert.match(validateAudioFile(null, 1000), /Choose an audio file/);
});

test('file size helper formats bytes and larger units', () => {
  assert.equal(formatFileSize(0), '0 B');
  assert.equal(formatFileSize(512), '512 B');
  assert.equal(formatFileSize(1024), '1.0 KB');
  assert.equal(formatFileSize(1024 * 1024), '1.0 MB');
});
