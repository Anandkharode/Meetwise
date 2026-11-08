import assert from 'node:assert/strict';
import axios from 'axios';
import { mock, test } from 'node:test';
import {
  AIServiceError,
  analyzeMeeting,
  checkAIHealth,
  normalizeAnalysisResponse,
} from '../services/ai/meetingAnalysisService.js';

const sampleResponse = {
  success: true,
  meeting: { title: 'A review', meeting_date: '2026-11-08' },
  summary: { text: 'Nora will review the notes.', key_points: ['Review the notes'] },
  entities: { people: ['Nora'], organizations: [], dates: [] },
  classifications: [{ sentence: 'Nora will review the notes.', label: 'TASK', confidence: 0.8 }],
  tasks: [{
    task_id: 'python-id-is-not-used', description: 'Review the notes', action: 'Review',
    responsible_person: 'Nora', deadline: null, priority: null, status: 'pending',
    source_sentence: 'Nora will review the notes.', confidence: 0.8, warnings: [],
  }],
  decisions: [],
  analysis_metadata: { total_sentences: 1, tasks_found: 1, decisions_found: 0, processing_time_ms: 20, warnings: [] },
};

test('AI service sends the actual FastAPI request and normalizes snake_case fields', async () => {
  const post = mock.method(axios, 'post', async () => ({ data: sampleResponse }));
  try {
    const result = await analyzeMeeting({
      meetingTitle: 'A review',
      meetingDate: new Date('2026-11-08T00:00:00.000Z'),
      transcript: 'Nora will review the notes.',
    });
    assert.equal(post.mock.calls[0].arguments[0], 'http://127.0.0.1:8000/analyze');
    assert.deepEqual(post.mock.calls[0].arguments[1], {
      meeting_title: 'A review', meeting_date: '2026-11-08', transcript: 'Nora will review the notes.',
    });
    assert.equal(result.tasks[0].responsiblePerson, 'Nora');
    assert.equal(result.tasks[0].deadline, null);
    assert.equal(result.tasks[0].priority, null);
    assert.equal(result.analysisMetadata.totalSentences, 1);
  } finally {
    post.mock.restore();
  }
});

test('AI service rejects invalid upstream response instead of fabricating data', () => {
  assert.throws(() => normalizeAnalysisResponse({ success: true, tasks: [] }), AIServiceError);
});

test('AI service maps offline and timeout failures to stable API errors', async () => {
  const post = mock.method(axios, 'post', async () => {
    const error = new Error('connect ECONNREFUSED');
    error.isAxiosError = true;
    error.code = 'ECONNREFUSED';
    error.config = {};
    throw error;
  });
  try {
    await assert.rejects(
      analyzeMeeting({ meetingTitle: 'A review', meetingDate: '2026-11-08', transcript: 'Text.' }),
      (error) => error instanceof AIServiceError && error.status === 503,
    );
  } finally {
    post.mock.restore();
  }
});

test('AI service maps Python request timeouts to HTTP 504', async () => {
  const post = mock.method(axios, 'post', async () => {
    const error = new Error('request timed out');
    error.isAxiosError = true;
    error.code = 'ETIMEDOUT';
    error.config = {};
    throw error;
  });
  try {
    await assert.rejects(
      analyzeMeeting({ meetingTitle: 'A review', meetingDate: '2026-11-08', transcript: 'Text.' }),
      (error) => error instanceof AIServiceError && error.status === 504,
    );
  } finally {
    post.mock.restore();
  }
});

test('AI health endpoint client does not expose upstream details', async () => {
  const get = mock.method(axios, 'get', async () => { throw new Error('private upstream details'); });
  try {
    assert.equal(await checkAIHealth(), false);
  } finally {
    get.mock.restore();
  }
});

