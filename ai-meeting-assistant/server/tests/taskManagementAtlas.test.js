import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import mongoose from 'mongoose';
import app from '../app.js';
import { connectDatabase } from '../config/db.js';
import Meeting from '../models/Meeting.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { generateToken } from '../utils/generateToken.js';

const enabled = process.env.RUN_ATLAS_TASKS_E2E === '1';
let server;
let baseUrl;
let owner;
let otherUser;
let meeting;

before(async () => {
  if (!enabled) return;
  await connectDatabase();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (meeting && owner) {
    await Task.deleteMany({ meetingId: meeting._id, createdBy: owner._id });
    await Meeting.deleteOne({ _id: meeting._id, createdBy: owner._id });
    assert.equal(await Task.countDocuments({ meetingId: meeting._id, createdBy: owner._id }), 0);
    assert.equal(await Meeting.exists({ _id: meeting._id, createdBy: owner._id }), null);
  }
  if (owner) {
    await User.deleteOne({ _id: owner._id });
    assert.equal(await User.exists({ _id: owner._id }), null);
  }
  if (otherUser) {
    await User.deleteOne({ _id: otherUser._id });
    assert.equal(await User.exists({ _id: otherUser._id }), null);
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  if (enabled && mongoose.connection.readyState !== 0) await mongoose.disconnect();
});

test('task APIs enforce ownership, filter, update safely, report stats, and delete only the task', { skip: !enabled }, async () => {
  const suffix = randomUUID();
  owner = await User.create({ name: 'Temporary task test owner', email: `task-owner-${suffix}@example.invalid`, password: `${randomUUID()}-Test-password` });
  otherUser = await User.create({ name: 'Temporary other user', email: `task-other-${suffix}@example.invalid`, password: `${randomUUID()}-Test-password` });
  meeting = await Meeting.create({
    title: `Temporary task test meeting ${suffix}`,
    meetingDate: new Date('2026-11-08T00:00:00.000Z'),
    transcript: 'Temporary isolated task API test.',
    createdBy: owner._id,
  });

  const token = generateToken(owner._id);
  const otherToken = generateToken(otherUser._id);
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const tasks = await Task.insertMany([
    { meetingId: meeting._id, createdBy: owner._id, description: 'AI pending task', action: 'Review', responsiblePerson: 'Initial owner', sourceSentence: 'Original evidence.', confidence: 0.83, origin: 'ai', analysisRunId: suffix, deadline: { originalText: 'yesterday', normalizedDate: new Date('2020-01-01T00:00:00.000Z') } },
    { meetingId: meeting._id, createdBy: owner._id, description: 'In progress task', sourceSentence: 'In progress evidence.', status: 'in_progress', deadline: { normalizedDate: new Date('2020-01-02T00:00:00.000Z') } },
    { meetingId: meeting._id, createdBy: owner._id, description: 'Completed task', sourceSentence: 'Completed evidence.', status: 'completed', deadline: { normalizedDate: new Date('2020-01-03T00:00:00.000Z') } },
    { meetingId: meeting._id, createdBy: owner._id, description: 'No deadline task', sourceSentence: 'No deadline evidence.' },
  ]);

  const all = await fetch(`${baseUrl}/api/tasks?page=1&limit=10`, { headers });
  assert.equal(all.status, 200);
  assert.equal((await all.json()).pagination.total, 4);
  const pending = await fetch(`${baseUrl}/api/tasks?status=pending`, { headers });
  assert.equal((await pending.json()).pagination.total, 2);
  const completed = await fetch(`${baseUrl}/api/tasks?status=completed`, { headers });
  assert.equal((await completed.json()).pagination.total, 1);
  const byMeeting = await fetch(`${baseUrl}/api/tasks?meetingId=${meeting._id}`, { headers });
  assert.equal((await byMeeting.json()).pagination.total, 4);
  const byPerson = await fetch(`${baseUrl}/api/tasks?responsiblePerson=Initial%20owner`, { headers });
  assert.equal((await byPerson.json()).pagination.total, 1);
  const byOrigin = await fetch(`${baseUrl}/api/tasks?origin=ai`, { headers });
  assert.equal((await byOrigin.json()).pagination.total, 1);

  const statsResponse = await fetch(`${baseUrl}/api/tasks/stats`, { headers });
  const stats = (await statsResponse.json()).stats;
  assert.deepEqual(stats, {
    totalTasks: 4,
    pendingTasks: 2,
    inProgressTasks: 1,
    completedTasks: 1,
    overdueTasks: 2,
    tasksWithoutDeadline: 1,
  });
  console.log('Atlas task statistics response:', JSON.stringify({ success: true, stats }));

  const detailsResponse = await fetch(`${baseUrl}/api/tasks/${tasks[0]._id}`, { headers });
  const details = await detailsResponse.json();
  assert.equal(detailsResponse.status, 200);
  assert.equal(details.meeting.title, meeting.title);
  assert.equal(details.task.sourceSentence, 'Original evidence.');

  const updateResponse = await fetch(`${baseUrl}/api/tasks/${tasks[0]._id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      responsiblePerson: 'Rahul',
      status: 'in_progress',
      priority: 'high',
      deadline: { originalText: 'by Thursday', normalizedDate: '2026-11-12' },
      createdBy: otherUser._id,
    }),
  });
  assert.equal(updateResponse.status, 400);
  const updatedResponse = await fetch(`${baseUrl}/api/tasks/${tasks[0]._id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ responsiblePerson: 'Rahul', status: 'in_progress', priority: 'high', deadline: { originalText: 'by Thursday', normalizedDate: '2026-11-12' } }),
  });
  const updated = (await updatedResponse.json()).task;
  assert.equal(updatedResponse.status, 200);
  assert.equal(updated.isManuallyEdited, true);
  assert.equal(updated.origin, 'ai');
  assert.equal(updated.sourceSentence, 'Original evidence.');
  assert.equal(updated.confidence, 0.83);
  assert.equal(updated.deadline.normalizedDate.slice(0, 10), '2026-11-12');
  console.log('Atlas task update response:', JSON.stringify({
    status: updatedResponse.status,
    task: {
      description: updated.description,
      responsiblePerson: updated.responsiblePerson,
      deadline: updated.deadline,
      priority: updated.priority,
      status: updated.status,
      origin: updated.origin,
      isManuallyEdited: updated.isManuallyEdited,
      sourceSentence: updated.sourceSentence,
      confidence: updated.confidence,
    },
  }));

  const crossUser = await fetch(`${baseUrl}/api/tasks/${tasks[0]._id}`, { headers: { authorization: `Bearer ${otherToken}` } });
  assert.equal(crossUser.status, 404);
  const invalidStatus = await fetch(`${baseUrl}/api/tasks/${tasks[0]._id}`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'blocked' }) });
  assert.equal(invalidStatus.status, 400);

  const deleted = await fetch(`${baseUrl}/api/tasks/${tasks[3]._id}`, { method: 'DELETE', headers });
  assert.equal(deleted.status, 200);
  assert.ok(await Meeting.exists({ _id: meeting._id, createdBy: owner._id }));
  assert.equal(await Task.exists({ _id: tasks[3]._id, createdBy: owner._id }), null);
});
