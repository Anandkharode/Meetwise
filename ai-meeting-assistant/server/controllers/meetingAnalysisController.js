import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { validationResult } from 'express-validator';
import Meeting from '../models/Meeting.js';
import Task from '../models/Task.js';
import { AIServiceError, analyzeMeeting } from '../services/ai/meetingAnalysisService.js';

const STALE_AFTER_MS = Math.max(60_000, Number(process.env.ANALYSIS_STALE_AFTER_MS) || 15 * 60 * 1000);

function sendValidationErrors(req, res) {
  const result = validationResult(req);
  if (result.isEmpty()) return false;
  res.status(400).json({ message: 'Request validation failed.', errors: result.array() });
  return true;
}

function isTransactionUnsupported(error) {
  return error?.code === 20
    || error?.codeName === 'IllegalOperation'
    || /transaction numbers are only allowed|transactions are not supported|replica set|does not support transactions/i.test(error?.message || '');
}

function publicFailure(error) {
  if (error instanceof AIServiceError) return error.message;
  return 'Meeting analysis failed while saving results.';
}

function taskDocuments(analysis, meeting, userId, runId) {
  return analysis.tasks.map((task) => ({
    ...task,
    meetingId: meeting._id,
    createdBy: userId,
    origin: 'ai',
    analysisRunId: runId,
    isManuallyEdited: false,
  }));
}

export async function persistAnalysis({ meeting, userId, runId, analysis, replaceManualTasks = false }) {
  const update = {
    summary: analysis.summary,
    keyPoints: analysis.keyPoints,
    entities: analysis.entities,
    decisions: analysis.decisions,
    analysisMetadata: analysis.analysisMetadata,
    analysisStatus: 'completed',
    analysisError: null,
    analysisStartedAt: null,
    analysisRunId: null,
  };

  const writeResults = async (session) => {
    const taskFilter = replaceManualTasks
      ? { meetingId: meeting._id, createdBy: userId }
      : { meetingId: meeting._id, createdBy: userId, origin: 'ai', isManuallyEdited: { $ne: true } };
    await Task.deleteMany(taskFilter, session ? { session } : undefined);

    const docs = taskDocuments(analysis, meeting, userId, runId);
    if (docs.length) await Task.insertMany(docs, session ? { session } : undefined);

    const result = await Meeting.updateOne(
      { _id: meeting._id, createdBy: userId, analysisStatus: 'processing', analysisRunId: runId },
      { $set: update },
      session ? { session, runValidators: true } : { runValidators: true },
    );
    if (result.matchedCount !== 1) {
      const conflict = new Error('This analysis run no longer owns the meeting processing lock.');
      conflict.status = 409;
      throw conflict;
    }
  };

  const session = await mongoose.startSession();
  try {
    try {
      await session.withTransaction(() => writeResults(session));
    } catch (error) {
      if (!isTransactionUnsupported(error)) throw error;
      // On standalone MongoDB deployments, first stage replacement tasks and
      // restore the prior AI task set if any write or final status update fails.
      await persistWithoutTransaction({ meeting, userId, runId, analysis, replaceManualTasks, update });
    }
  } finally {
    await session.endSession();
  }
}

async function persistWithoutTransaction({ meeting, userId, runId, analysis, replaceManualTasks, update }) {
  const filter = replaceManualTasks
    ? { meetingId: meeting._id, createdBy: userId }
    : { meetingId: meeting._id, createdBy: userId, origin: 'ai', isManuallyEdited: { $ne: true } };
  const priorTasks = await Task.find(filter).lean();
  await Task.deleteMany(filter);
  try {
    const docs = taskDocuments(analysis, meeting, userId, runId);
    if (docs.length) await Task.insertMany(docs);
    const result = await Meeting.updateOne(
      { _id: meeting._id, createdBy: userId, analysisStatus: 'processing', analysisRunId: runId },
      { $set: update },
      { runValidators: true },
    );
    if (result.matchedCount !== 1) {
      const conflict = new Error('This analysis run no longer owns the meeting processing lock.');
      conflict.status = 409;
      throw conflict;
    }
  } catch (error) {
    await Task.deleteMany({ meetingId: meeting._id, createdBy: userId, origin: 'ai', analysisRunId: runId });
    if (priorTasks.length) await Task.insertMany(priorTasks, { ordered: false });
    throw error;
  }
}

/** Analyze a user's meeting through FastAPI and persist results consistently. */
export async function analyzeMeetingController(req, res, next) {
  if (sendValidationErrors(req, res)) return;
  const userId = req.user?._id;
  if (!userId || !mongoose.isValidObjectId(userId)) {
    return res.status(401).json({ message: 'Authentication is required.' });
  }

  const reanalyze = req.body?.reanalyze === true;
  const replaceManualTasks = req.body?.replaceManualTasks === true && reanalyze;
  const runId = randomUUID();
  try {
    const meeting = await Meeting.findOne({ _id: req.params.id, createdBy: userId });
    if (!meeting) return res.status(404).json({ message: 'Meeting not found.' });
    if (!meeting.transcript?.trim()) return res.status(400).json({ message: 'Meeting transcript is empty.' });
    if (meeting.analysisStatus === 'processing'
      && meeting.analysisStartedAt
      && Date.now() - meeting.analysisStartedAt.getTime() < STALE_AFTER_MS) {
      return res.status(409).json({ message: 'Analysis for this meeting is already in progress.' });
    }
    if (meeting.analysisStatus === 'completed' && !reanalyze) {
      return res.status(409).json({ message: 'Meeting analysis is already completed. Set reanalyze to true to run it again.' });
    }

    const previousStatus = meeting.analysisStatus;
    const claimFilter = {
      _id: meeting._id,
      createdBy: userId,
      analysisStatus: previousStatus,
    };
    if (previousStatus === 'processing') {
      claimFilter.$or = [
        { analysisStartedAt: null },
        { analysisStartedAt: { $lte: new Date(Date.now() - STALE_AFTER_MS) } },
      ];
    }
    if (previousStatus === 'completed' && !reanalyze) {
      return res.status(409).json({ message: 'Meeting analysis is already completed.' });
    }
    const claimed = await Meeting.findOneAndUpdate(
      claimFilter,
      { $set: { analysisStatus: 'processing', analysisStartedAt: new Date(), analysisRunId: runId, analysisError: null } },
      { new: true, runValidators: true },
    );
    if (!claimed) return res.status(409).json({ message: 'Meeting analysis state changed; retry the request.' });

    let analysis;
    try {
      analysis = await analyzeMeeting({
        meetingTitle: claimed.title,
        meetingDate: claimed.meetingDate,
        transcript: claimed.transcript,
      });
    } catch (error) {
      await Meeting.updateOne(
        { _id: claimed._id, createdBy: userId, analysisStatus: 'processing', analysisRunId: runId },
        { $set: { analysisStatus: 'failed', analysisError: publicFailure(error), analysisStartedAt: null, analysisRunId: null } },
      );
      return res.status(error instanceof AIServiceError ? error.status : 502).json({
        message: publicFailure(error),
        code: error instanceof AIServiceError ? error.code : 'AI_ANALYSIS_FAILED',
      });
    }

    try {
      await persistAnalysis({ meeting: claimed, userId, runId, analysis, replaceManualTasks });
    } catch (error) {
      await Meeting.updateOne(
        { _id: claimed._id, createdBy: userId, analysisStatus: 'processing', analysisRunId: runId },
        { $set: { analysisStatus: 'failed', analysisError: publicFailure(error), analysisStartedAt: null, analysisRunId: null } },
      );
      return next(error);
    }

    const [savedMeeting, tasks] = await Promise.all([
      Meeting.findOne({ _id: claimed._id, createdBy: userId }),
      Task.find({ meetingId: claimed._id, createdBy: userId }).sort({ createdAt: 1 }),
    ]);
    return res.status(200).json({ success: true, meeting: savedMeeting, tasks });
  } catch (error) {
    return next(error);
  }
}
