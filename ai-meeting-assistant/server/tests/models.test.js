import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { test } from 'node:test';
import Meeting from '../models/Meeting.js';
import Task from '../models/Task.js';

const userId = new mongoose.Types.ObjectId();
const meetingId = new mongoose.Types.ObjectId();

function validMeeting(overrides = {}) {
  return new Meeting({
    title: '  Project review  ',
    meetingDate: new Date('2026-11-07T00:00:00.000Z'),
    transcript: '  We agreed to review the plan.  ',
    createdBy: userId,
    ...overrides,
  });
}

function validTask(overrides = {}) {
  return new Task({
    meetingId,
    description: '  Review the plan  ',
    sourceSentence: '  Maya will review the plan.  ',
    createdBy: userId,
    ...overrides,
  });
}

test('valid meeting applies defaults, trims text, and references User', () => {
  const meeting = validMeeting();
  assert.equal(meeting.validateSync(), undefined);
  assert.equal(meeting.title, 'Project review');
  assert.equal(meeting.sourceType, 'text');
  assert.equal(meeting.analysisStatus, 'pending');
  assert.equal(meeting.createdBy.toString(), userId.toString());
  assert.equal(Meeting.schema.path('createdBy').options.ref, 'User');
  assert.equal(meeting.summary, '');
  assert.deepEqual(meeting.keyPoints, []);
  assert.equal(meeting.audio, undefined);
});

test('meeting requires title and date', () => {
  const meeting = validMeeting({ title: '  ', meetingDate: undefined });
  const error = meeting.validateSync();
  assert.ok(error?.errors.title);
  assert.ok(error?.errors.meetingDate);
});

test('meeting validates decision confidence and analysis status', () => {
  assert.ok(validMeeting({ decisions: [{ description: 'Use the plan', confidence: 1.1 }] }).validateSync()?.errors['decisions.0.confidence']);
  assert.ok(validMeeting({ analysisStatus: 'unknown' }).validateSync()?.errors.analysisStatus);
});

test('valid task has a separate Meeting reference and no inferred owner or deadline', () => {
  const task = validTask();
  assert.equal(task.validateSync(), undefined);
  assert.equal(task.description, 'Review the plan');
  assert.equal(task.status, 'pending');
  assert.equal(task.priority, null);
  assert.equal(task.responsiblePerson, null);
  assert.equal(task.deadline, null);
  assert.equal(task.origin, 'manual');
  assert.equal(task.isManuallyEdited, false);
  assert.equal(task.meetingId.toString(), meetingId.toString());
  assert.equal(Task.schema.path('meetingId').options.ref, 'Meeting');
  assert.equal(Task.schema.path('createdBy').options.ref, 'User');
});

test('task requires description and validates source text', () => {
  const task = validTask({ description: '  ', sourceSentence: '' });
  const error = task.validateSync();
  assert.ok(error?.errors.description);
  assert.ok(error?.errors.sourceSentence);
});

test('task rejects invalid status and priority values', () => {
  assert.ok(validTask({ status: 'blocked' }).validateSync()?.errors.status);
  assert.ok(validTask({ priority: 'urgent' }).validateSync()?.errors.priority);
});

test('task validates the origin enum', () => {
  assert.ok(validTask({ origin: 'system' }).validateSync()?.errors.origin);
});

test('task and embedded decision confidence must be between zero and one', () => {
  assert.ok(validTask({ confidence: -0.1 }).validateSync()?.errors.confidence);
  assert.ok(validTask({ confidence: 1.01 }).validateSync()?.errors.confidence);
  assert.ok(validMeeting({ decisions: [{ description: 'Choose a plan', confidence: -0.01 }] }).validateSync()?.errors['decisions.0.confidence']);
});

test('meeting has only requested indexes and tasks remain a separate collection', () => {
  assert.deepEqual(Meeting.schema.indexes().map(([fields]) => fields), [
    { createdBy: 1, createdAt: -1 },
    { analysisStatus: 1 },
  ]);
  assert.deepEqual(Task.schema.indexes().map(([fields]) => fields), [
    { meetingId: 1 },
    { createdBy: 1, status: 1 },
    { responsiblePerson: 1 },
    { 'deadline.normalizedDate': 1 },
  ]);
  assert.equal(Meeting.schema.path('tasks'), undefined);
});
