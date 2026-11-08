import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import app from '../app.js';
import axios from 'axios';
import { mock } from 'node:test';

let server;
let baseUrl;

before(async () => {
  process.env.JWT_SECRET = 'test-only-secret-long-enough-for-http-tests';
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  delete process.env.JWT_SECRET;
});

test('health endpoint returns healthy status', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'healthy', service: 'meeting-action-api' });
});

test('Python health route reports reachability without leaking upstream errors', async () => {
  const get = mock.method(axios, 'get', async () => ({
    status: 200,
    data: { status: 'healthy', service: 'meeting-analysis-engine' },
  }));
  try {
    const response = await fetch(`${baseUrl}/api/ai/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'healthy', service: 'python-ai-engine' });
  } finally {
    get.mock.restore();
  }
});

test('unknown route returns JSON 404', async () => {
  const response = await fetch(`${baseUrl}/api/not-a-route`);
  assert.equal(response.status, 404);
  assert.match((await response.json()).message, /Route not found/);
});

test('registration validates payload before touching MongoDB', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'A', email: 'not-an-email', password: 'short' }),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).message, 'Request validation failed.');
});

test('login validates payload before touching MongoDB', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'invalid', password: '' }),
  });
  assert.equal(response.status, 400);
});

test('private profile route rejects missing and invalid bearer tokens', async () => {
  const missing = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(missing.status, 401);
  const invalid = await fetch(`${baseUrl}/api/auth/me`, { headers: { authorization: 'Bearer not-a-token' } });
  assert.equal(invalid.status, 401);
});

test('all meeting endpoints reject requests without a bearer token', async () => {
  const requests = [
    fetch(`${baseUrl}/api/meetings`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }),
    fetch(`${baseUrl}/api/meetings/upload-audio`, { method: 'POST' }),
    fetch(`${baseUrl}/api/meetings`),
    fetch(`${baseUrl}/api/meetings/not-an-id`),
    fetch(`${baseUrl}/api/meetings/not-an-id`, { method: 'DELETE' }),
  ];
  const responses = await Promise.all(requests);
  assert.deepEqual(responses.map((response) => response.status), [401, 401, 401, 401, 401]);
});

test('all task endpoints reject requests without a bearer token', async () => {
  const responses = await Promise.all([
    fetch(`${baseUrl}/api/tasks`),
    fetch(`${baseUrl}/api/tasks/stats`),
    fetch(`${baseUrl}/api/tasks/not-an-id`),
    fetch(`${baseUrl}/api/tasks/not-an-id`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{}' }),
    fetch(`${baseUrl}/api/tasks/not-an-id`, { method: 'DELETE' }),
  ]);
  assert.deepEqual(responses.map((response) => response.status), [401, 401, 401, 401, 401]);
});

test('task update validator rejects protected fields, invalid enums and invalid dates', async () => {
  const { default: taskRoutes } = await import('../routes/taskRoutes.js');
  const route = taskRoutes.stack.find((layer) => layer.route?.path === '/:id' && layer.route.methods.patch);
  const validators = route.route.stack.slice(0, -1).flatMap((layer) => layer.handle.stack || [layer.handle]);
  const { validationResult } = await import('express-validator');

  for (const body of [
    { status: 'blocked' },
    { priority: 'urgent' },
    { deadline: { normalizedDate: '2026-02-30' } },
    { createdBy: '507f1f77bcf86cd799439011' },
    { meetingId: '507f1f77bcf86cd799439011' },
    { origin: 'manual' },
  ]) {
    const req = { body, params: { id: '507f1f77bcf86cd799439011' }, query: {} };
    for (const validator of validators) await validator.run(req);
    assert.equal(validationResult(req).isEmpty(), false);
  }
});

test('task list validator rejects invalid filters and pagination', async () => {
  const { default: taskRoutes } = await import('../routes/taskRoutes.js');
  const route = taskRoutes.stack.find((layer) => layer.route?.path === '/' && layer.route.methods.get);
  const { validationResult } = await import('express-validator');
  for (const query of [{ status: 'blocked' }, { priority: 'urgent' }, { origin: 'system' }, { page: '0' }, { limit: '101' }, { meetingId: 'bad-id' }]) {
    const req = { body: {}, params: {}, query };
    for (const layer of route.route.stack.slice(0, -1)) await layer.handle.run(req);
    assert.equal(validationResult(req).isEmpty(), false);
  }
});

test('meeting routes return validation errors for authenticated request bodies through validator chains', async () => {
  const { default: meetingRoutes } = await import('../routes/meetingRoutes.js');
  const route = meetingRoutes.stack.find((layer) => layer.route?.path === '/' && layer.route.methods.post);
  const validators = route.route.stack.slice(0, -1).flatMap((layer) => layer.handle.stack || [layer.handle]);
  const { validationResult } = await import('express-validator');

  for (const body of [
    { title: ' ', meetingDate: '2026-11-08', transcript: 'Transcript' },
    { title: 'Meeting', meetingDate: '2026-02-30', transcript: 'Transcript' },
    { title: 'Meeting', meetingDate: '2026-11-08', transcript: ' ' },
    { title: 'Meeting', meetingDate: '2026-11-08', transcript: 'Transcript', sourceType: 'video' },
  ]) {
    const req = { body, params: {}, query: {} };
    for (const validator of validators) await validator.run(req);
    assert.equal(validationResult(req).isEmpty(), false);
  }
});

test('meeting pagination validator rejects invalid values', async () => {
  const { default: meetingRoutes } = await import('../routes/meetingRoutes.js');
  const route = meetingRoutes.stack.find((layer) => layer.route?.path === '/' && layer.route.methods.get);
  const { validationResult } = await import('express-validator');

  for (const query of [{ page: '0' }, { limit: '101' }, { page: '1.5' }]) {
    const req = { body: {}, params: {}, query };
    for (const layer of route.route.stack.slice(0, -1)) await layer.handle.run(req);
    assert.equal(validationResult(req).isEmpty(), false);
  }
});
