import mongoose from 'mongoose';
import { matchedData, validationResult } from 'express-validator';
import Meeting from '../models/Meeting.js';
import Task from '../models/Task.js';
import { deleteStoredAudioFile } from '../utils/audioFiles.js';

function sendValidationErrors(req, res) {
  const result = validationResult(req);
  if (result.isEmpty()) return false;
  res.status(400).json({ message: 'Request validation failed.', errors: result.array() });
  return true;
}

function ownsValidUser(req) {
  return req.user?._id && mongoose.isValidObjectId(req.user._id);
}

/** Create a meeting owned by the authenticated user; analysis remains pending. */
export async function createMeeting(req, res, next) {
  if (sendValidationErrors(req, res)) return;
  if (!ownsValidUser(req)) return res.status(401).json({ message: 'Authentication is required.' });

  const input = matchedData(req, { locations: ['body'] });
  try {
    const meeting = await Meeting.create({
      title: input.title,
      meetingDate: new Date(`${input.meetingDate}T00:00:00.000Z`),
      transcript: input.transcript,
      ...(input.sourceType ? { sourceType: input.sourceType } : {}),
      createdBy: req.user._id,
      analysisStatus: 'pending',
    });
    return res.status(201).json({ success: true, meeting });
  } catch (error) {
    return next(error);
  }
}

/** List only the current user's meetings, newest first, with bounded pagination. */
export async function getMeetings(req, res, next) {
  if (sendValidationErrors(req, res)) return;
  if (!ownsValidUser(req)) return res.status(401).json({ message: 'Authentication is required.' });

  const { page = 1, limit = 10 } = matchedData(req, { locations: ['query'] });
  const filter = { createdBy: req.user._id };
  const skip = (page - 1) * limit;
  try {
    const [total, meetings] = await Promise.all([
      Meeting.countDocuments(filter),
      Meeting.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ]);
    return res.status(200).json({
      success: true,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      meetings,
    });
  } catch (error) {
    return next(error);
  }
}

/** Return one owned meeting with its separately stored, owned tasks. */
export async function getMeetingById(req, res, next) {
  if (sendValidationErrors(req, res)) return;
  if (!ownsValidUser(req)) return res.status(401).json({ message: 'Authentication is required.' });

  try {
    const meeting = await Meeting.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!meeting) return res.status(404).json({ message: 'Meeting not found.' });

    const tasks = await Task.find({ meetingId: meeting._id, createdBy: req.user._id }).sort({ createdAt: 1 });
    return res.status(200).json({ success: true, meeting, tasks });
  } catch (error) {
    return next(error);
  }
}

function isTransactionUnsupported(error) {
  return error?.code === 20
    || error?.codeName === 'IllegalOperation'
    || /transaction numbers are only allowed|transactions are not supported|replica set|does not support transactions/i.test(error?.message || '');
}

async function deleteMeetingAndTasksWithoutTransaction(meeting, userId) {
  const filter = { meetingId: meeting._id };
  const taskSnapshots = await Task.find(filter).lean();
  await Task.deleteMany(filter);
  try {
    const result = await Meeting.deleteOne({ _id: meeting._id, createdBy: userId });
    if (result.deletedCount !== 1) throw new Error('Meeting changed during deletion; no meeting was deleted.');
  } catch (error) {
    // Restore associated tasks if removing the parent fails after task deletion.
    if (taskSnapshots.length) {
      try {
        await Task.insertMany(taskSnapshots, { ordered: false });
      } catch (restoreError) {
        error.restoreError = restoreError;
      }
    }
    throw error;
  }
}

/** Delete an owned meeting and all associated task documents. */
export async function deleteMeeting(req, res, next) {
  if (sendValidationErrors(req, res)) return;
  if (!ownsValidUser(req)) return res.status(401).json({ message: 'Authentication is required.' });

  let session;
  try {
    const meeting = await Meeting.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!meeting) return res.status(404).json({ message: 'Meeting not found.' });

    session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const result = await Meeting.deleteOne(
          { _id: meeting._id, createdBy: req.user._id },
          { session },
        );
        if (result.deletedCount !== 1) throw new Error('Meeting changed during deletion.');
        await Task.deleteMany(
          { meetingId: meeting._id },
          { session },
        );
      });
    } catch (error) {
      if (!isTransactionUnsupported(error)) throw error;
      await deleteMeetingAndTasksWithoutTransaction(meeting, req.user._id);
    }
    if (meeting.audio?.filePath) {
      try {
        await deleteStoredAudioFile(meeting.audio.filePath);
      } catch (error) {
        console.warn('Could not remove audio file for deleted meeting.', error.code || error.name);
      }
    }
    return res.status(200).json({ success: true, message: 'Meeting and associated tasks deleted.' });
  } catch (error) {
    return next(error);
  } finally {
    if (session) await session.endSession();
  }
}
