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

const enabled = process.env.RUN_ATLAS_AI_E2E === '1';
let server;
let baseUrl;
let temporaryUser;
let temporaryMeeting;

before(async () => {
  if (!enabled) return;
  await connectDatabase();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (temporaryMeeting && temporaryUser) {
    await Task.deleteMany({ meetingId: temporaryMeeting._id, createdBy: temporaryUser._id });
    await Meeting.deleteOne({ _id: temporaryMeeting._id, createdBy: temporaryUser._id });
    assert.equal(await Task.countDocuments({ meetingId: temporaryMeeting._id, createdBy: temporaryUser._id }), 0);
    assert.equal(await Meeting.exists({ _id: temporaryMeeting._id, createdBy: temporaryUser._id }), null);
  }
  if (temporaryUser) {
    await User.deleteOne({ _id: temporaryUser._id });
    assert.equal(await User.exists({ _id: temporaryUser._id }), null);
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  if (enabled && mongoose.connection.readyState !== 0) await mongoose.disconnect();
});

test('real Atlas plus FastAPI analysis persists and replaces AI tasks without deleting manual tasks', { skip: !enabled }, async () => {
  const suffix = randomUUID();
  temporaryUser = await User.create({
    name: 'Temporary AI integration test',
    email: `ai-integration-${suffix}@example.invalid`,
    password: `${randomUUID()}-Test-password`,
  });
  const token = generateToken(temporaryUser._id);
  temporaryMeeting = await Meeting.create({
    title: `Temporary integration meeting ${suffix}`,
    meetingDate: new Date('2026-11-08T00:00:00.000Z'),
    transcript: 'Rahul will complete the login module by Friday. Priya will test the API tomorrow. We decided to use JWT authentication.',
    createdBy: temporaryUser._id,
  });

  const request = (body = {}) => fetch(`${baseUrl}/api/meetings/${temporaryMeeting._id}/analyze`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const first = await request();
  const firstText = await first.text();
  assert.equal(first.status, 200, firstText);
  const firstResult = JSON.parse(firstText);
  assert.equal(firstResult.meeting.analysisStatus, 'completed');
  assert.ok(firstResult.meeting.summary);
  assert.ok(firstResult.meeting.decisions.length > 0);
  assert.ok(firstResult.tasks.length > 0);
  assert.equal(firstResult.tasks[0].deadline.normalizedDate.slice(0, 10), '2026-11-13');
  console.log('Atlas/FastAPI analysis response:', JSON.stringify({
    status: first.status,
    analysisStatus: firstResult.meeting.analysisStatus,
    summary: firstResult.meeting.summary,
    tasks: firstResult.tasks.map(({ description, responsiblePerson, deadline }) => ({ description, responsiblePerson, deadline })),
    decisions: firstResult.meeting.decisions,
    tasksPersisted: firstResult.tasks.length,
  }));

  const manualTask = await Task.create({
    meetingId: temporaryMeeting._id,
    description: 'Manual integration-test task',
    sourceSentence: 'A reviewer added this task manually.',
    createdBy: temporaryUser._id,
    origin: 'manual',
  });
  const editedAiTask = await Task.findOneAndUpdate(
    { _id: firstResult.tasks[0]._id, meetingId: temporaryMeeting._id, createdBy: temporaryUser._id },
    { $set: { isManuallyEdited: true, description: 'Manually refined login task' } },
    { new: true },
  );
  assert.ok(editedAiTask);
  const duplicate = await request();
  assert.equal(duplicate.status, 409);

  const reanalysis = await request({ reanalyze: true });
  const reanalysisText = await reanalysis.text();
  assert.equal(reanalysis.status, 200, reanalysisText);
  const reanalysisResult = JSON.parse(reanalysisText);
  const storedTasks = await Task.find({ meetingId: temporaryMeeting._id, createdBy: temporaryUser._id });
  assert.equal(storedTasks.filter((task) => task.origin === 'ai').length, firstResult.tasks.length + 1);
  assert.ok(storedTasks.some((task) => task._id.equals(editedAiTask._id) && task.isManuallyEdited));
  assert.ok(storedTasks.some((task) => task._id.equals(manualTask._id)));

  const details = await fetch(`${baseUrl}/api/meetings/${temporaryMeeting._id}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(details.status, 200);
  assert.equal((await details.json()).tasks.length, storedTasks.length);
  assert.equal(reanalysisResult.meeting.analysisStatus, 'completed');
});
