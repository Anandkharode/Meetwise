import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { mock, test } from 'node:test';
import Meeting from '../models/Meeting.js';
import { analyzeMeetingController } from '../controllers/meetingAnalysisController.js';

function requestFor(meeting, body = {}) {
  return {
    params: { id: meeting._id.toString() },
    body,
    user: { _id: meeting.createdBy },
  };
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('completed analysis requires an explicit reanalysis request', async () => {
  const meeting = {
    _id: new mongoose.Types.ObjectId(),
    createdBy: new mongoose.Types.ObjectId(),
    transcript: 'A transcript.',
    analysisStatus: 'completed',
  };
  const findOne = mock.method(Meeting, 'findOne', async () => meeting);
  try {
    const res = responseRecorder();
    await analyzeMeetingController(requestFor(meeting), res, (error) => { throw error; });
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /reanalyze/);
  } finally {
    findOne.mock.restore();
  }
});

test('fresh processing analysis rejects duplicate requests', async () => {
  const meeting = {
    _id: new mongoose.Types.ObjectId(),
    createdBy: new mongoose.Types.ObjectId(),
    transcript: 'A transcript.',
    analysisStatus: 'processing',
    analysisStartedAt: new Date(),
  };
  const findOne = mock.method(Meeting, 'findOne', async () => meeting);
  try {
    const res = responseRecorder();
    await analyzeMeetingController(requestFor(meeting), res, (error) => { throw error; });
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /already in progress/);
  } finally {
    findOne.mock.restore();
  }
});

test('atomic claim race returns conflict rather than starting two Python jobs', async () => {
  const meeting = {
    _id: new mongoose.Types.ObjectId(),
    createdBy: new mongoose.Types.ObjectId(),
    transcript: 'A transcript.',
    analysisStatus: 'pending',
  };
  const findOne = mock.method(Meeting, 'findOne', async () => meeting);
  const findOneAndUpdate = mock.method(Meeting, 'findOneAndUpdate', async () => null);
  try {
    const res = responseRecorder();
    await analyzeMeetingController(requestFor(meeting), res, (error) => { throw error; });
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /state changed/);
  } finally {
    findOne.mock.restore();
    findOneAndUpdate.mock.restore();
  }
});
