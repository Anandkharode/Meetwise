import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeMeeting, checkAIHealth } from '../services/ai/meetingAnalysisService.js';

const enabled = process.env.RUN_PYTHON_AI_E2E === '1';

test('real local FastAPI engine returns normalized task and decision analysis', { skip: !enabled }, async () => {
  assert.equal(await checkAIHealth(), true);
  const result = await analyzeMeeting({
    meetingTitle: 'Local integration test',
    meetingDate: '2026-11-08',
    transcript: 'Rahul will complete the login module by Friday. We decided to use JWT authentication.',
  });

  assert.ok(Array.isArray(result.tasks));
  assert.ok(Array.isArray(result.decisions));
  assert.equal(typeof result.summary, 'string');
  assert.equal(result.tasks[0].deadline.normalizedDate, '2026-11-13');
  assert.ok(result.decisions.some((decision) => decision.description.toLowerCase().includes('jwt')));
});
