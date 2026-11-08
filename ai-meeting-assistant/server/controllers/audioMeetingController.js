import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { validationResult } from 'express-validator';
import Meeting from '../models/Meeting.js';
import Task from '../models/Task.js';
import { AIServiceError, analyzeMeeting } from '../services/ai/meetingAnalysisService.js';
import { WhisperError, transcribeAudio } from '../services/ai/whisperService.js';
import { getUploadRoot } from '../utils/audioFiles.js';
import path from 'node:path';
import { unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { persistAnalysis } from './meetingAnalysisController.js';

const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function safeMeeting(meeting) {
  const result = meeting.toObject ? meeting.toObject() : { ...meeting };
  if (result.audio) delete result.audio.filePath;
  delete result.analysisRunId;
  delete result.analysisStartedAt;
  return result;
}

async function removeUnpersistedUpload(file) {
  if (file?.filename) await unlink(path.join(getUploadRoot(), path.basename(file.filename))).catch(() => {});
}

async function markFailed(meeting, userId, runId, message) {
  await Meeting.updateOne(
    { _id: meeting._id, createdBy: userId, analysisStatus: 'processing', analysisRunId: runId },
    { $set: { analysisStatus: 'failed', analysisError: message, analysisStartedAt: null, analysisRunId: null } },
  );
}

function failureResponse(error, defaultMessage) {
  if (error instanceof WhisperError || error instanceof AIServiceError) {
    return { status: error.status, message: error.message, code: error.code };
  }
  return { status: 502, message: defaultMessage, code: 'AUDIO_MEETING_FAILED' };
}

/** Upload audio, transcribe locally with Whisper.cpp, then analyze using FastAPI. */
export async function uploadAudioMeeting(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    await removeUnpersistedUpload(req.file);
    return res.status(400).json({ message: 'Request validation failed.', errors: errors.array() });
  }
  if (!req.file) return res.status(400).json({ message: 'An audio file is required in the audio field.' });
  if (!req.user?._id || !mongoose.isValidObjectId(req.user._id)) {
    await removeUnpersistedUpload(req.file);
    return res.status(401).json({ message: 'Authentication is required.' });
  }

  const userId = req.user._id;
  const runId = randomUUID();
  let meeting;
  try {
    const relativeAudioPath = path.relative(SERVER_ROOT, req.file.path).split(path.sep).join('/');
    meeting = await Meeting.create({
      title: req.body.title.trim(),
      meetingDate: new Date(`${req.body.meetingDate}T00:00:00.000Z`),
      transcript: '',
      sourceType: 'audio',
      createdBy: userId,
      analysisStatus: 'processing',
      analysisRunId: runId,
      analysisStartedAt: new Date(),
      audio: {
        originalName: path.basename(req.file.originalname),
        filename: req.file.filename,
        filePath: relativeAudioPath,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
      },
    });
  } catch (error) {
    await removeUnpersistedUpload(req.file);
    return next(error);
  }

  let transcription;
  try {
    transcription = await transcribeAudio(req.file.path);
  } catch (error) {
    const failure = failureResponse(error, 'Audio transcription failed.');
    try {
      await markFailed(meeting, userId, runId, failure.message);
      meeting = await Meeting.findOne({ _id: meeting._id, createdBy: userId });
    } catch (saveError) {
      return next(saveError);
    }
    return res.status(failure.status).json({
      success: false,
      message: failure.message,
      code: failure.code,
      meeting: meeting ? safeMeeting(meeting) : undefined,
    });
  }

  try {
    meeting.transcript = transcription.transcript;
    await meeting.save();
    const analysis = await analyzeMeeting({
      meetingTitle: meeting.title,
      meetingDate: meeting.meetingDate,
      transcript: transcription.transcript,
    });
    await persistAnalysis({ meeting, userId, runId, analysis, replaceManualTasks: false });
    const [savedMeeting, tasks] = await Promise.all([
      Meeting.findOne({ _id: meeting._id, createdBy: userId }),
      Task.find({ meetingId: meeting._id, createdBy: userId }).sort({ createdAt: 1 }),
    ]);
    return res.status(201).json({
      success: true,
      meeting: safeMeeting(savedMeeting),
      transcription: {
        text: transcription.transcript,
        language: transcription.language ?? null,
        duration: transcription.duration ?? null,
      },
      summary: analysis.summary,
      tasks,
      decisions: analysis.decisions,
    });
  } catch (error) {
    const failure = failureResponse(error, 'Meeting analysis failed while saving results.');
    try {
      await markFailed(meeting, userId, runId, failure.message);
    } catch (saveError) {
      return next(saveError);
    }
    const savedMeeting = await Meeting.findOne({ _id: meeting._id, createdBy: userId });
    return res.status(failure.status).json({
      success: false,
      message: failure.message,
      code: failure.code,
      meeting: savedMeeting ? safeMeeting(savedMeeting) : undefined,
    });
  }
}
