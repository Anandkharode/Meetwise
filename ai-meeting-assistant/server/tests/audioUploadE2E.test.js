import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { after, before, test } from 'node:test';
import mongoose from 'mongoose';
import app from '../app.js';
import { connectDatabase } from '../config/db.js';
import Meeting from '../models/Meeting.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { transcribeAudio } from '../services/ai/whisperService.js';
import { checkAIHealth } from '../services/ai/meetingAnalysisService.js';
import { deleteStoredAudioFile } from '../utils/audioFiles.js';
import { generateToken } from '../utils/generateToken.js';

const enabled = process.env.RUN_AUDIO_E2E === '1';
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
  if (!temporaryMeeting && temporaryUser) {
    temporaryMeeting = await Meeting.findOne({ createdBy: temporaryUser._id, title: 'Temporary JFK audio integration test' });
  }
  if (temporaryMeeting) {
    await Task.deleteMany({ meetingId: temporaryMeeting._id });
    await Meeting.deleteOne({ _id: temporaryMeeting._id });
    if (temporaryMeeting.audio?.filePath) await deleteStoredAudioFile(temporaryMeeting.audio.filePath).catch(() => {});
  }
  if (temporaryUser) await User.deleteOne({ _id: temporaryUser._id });
  if (server) await new Promise((resolve) => server.close(resolve));
  if (enabled && mongoose.connection.readyState !== 0) await mongoose.disconnect();
});

test('real Whisper WAV and authenticated audio upload persist actual transcript and analysis', { skip: !enabled }, async () => {
  const samplePath = process.env.WHISPER_SAMPLE_PATH;
  assert.ok(samplePath, 'Set WHISPER_SAMPLE_PATH to an actual WAV sample.');
  const sampleAudio = await readFile(samplePath);
  const directTranscription = await transcribeAudio(samplePath);
  assert.match(directTranscription.transcript, /And so my fellow Americans/i);

  assert.equal(await checkAIHealth(), true, 'Local Python FastAPI analysis service must be healthy.');
  temporaryUser = await User.create({
    name: 'Temporary audio integration test',
    email: `audio-integration-${randomUUID()}@example.invalid`,
    password: `${randomUUID()}-Test-password`,
  });
  const token = generateToken(temporaryUser._id);

  const form = new FormData();
  form.set('title', 'Temporary JFK audio integration test');
  form.set('meetingDate', '2026-11-08');
  form.set('audio', new Blob([sampleAudio], { type: 'audio/wav' }), 'jfk.wav');
  const response = await fetch(`${baseUrl}/api/meetings/upload-audio`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  const responseText = await response.text();
  assert.equal(response.status, 201, responseText);
  const body = JSON.parse(responseText);
  assert.equal(body.success, true);
  assert.equal(body.meeting.sourceType, 'audio');
  assert.equal(body.meeting.analysisStatus, 'completed');
  assert.equal(body.transcription.text, directTranscription.transcript);
  assert.equal(body.transcription.language, 'en');
  assert.match(body.transcription.text, /And so my fellow Americans/i);
  assert.ok(body.summary);
  assert.ok(Array.isArray(body.tasks));
  assert.ok(Array.isArray(body.decisions));
  assert.equal(JSON.stringify(body).includes('uploads/meetings'), false);

  temporaryMeeting = await Meeting.findOne({ _id: body.meeting._id, createdBy: temporaryUser._id });
  assert.ok(temporaryMeeting);
  assert.equal(temporaryMeeting.transcript, directTranscription.transcript);
  assert.equal(await stat(path.resolve(temporaryMeeting.audio.filePath)).then(() => true), true);
  assert.equal(await Task.countDocuments({ meetingId: temporaryMeeting._id, createdBy: temporaryUser._id }), body.tasks.length);

  console.log('Real audio upload response:', JSON.stringify({
    status: response.status,
    transcript: body.transcription.text,
    summary: body.summary,
    tasksPersisted: body.tasks.length,
    decisions: body.decisions.length,
  }));

  const deletion = await fetch(`${baseUrl}/api/meetings/${temporaryMeeting._id}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(deletion.status, 200, await deletion.text());
  await assert.rejects(stat(path.resolve(temporaryMeeting.audio.filePath)), { code: 'ENOENT' });
  temporaryMeeting = null;
});
