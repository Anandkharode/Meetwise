import mongoose from 'mongoose';
import { matchedData, validationResult } from 'express-validator';
import Meeting from '../models/Meeting.js';
import Task from '../models/Task.js';

function sendValidationErrors(req, res) {
  const result = validationResult(req);
  if (result.isEmpty()) return false;
  res.status(400).json({ message: 'Request validation failed.', errors: result.array() });
  return true;
}

function validUser(req) {
  return req.user?._id && mongoose.isValidObjectId(req.user._id);
}

/** List the authenticated user's tasks with validated filters and pagination. */
export async function getTasks(req, res, next) {
  if (sendValidationErrors(req, res)) return;
  if (!validUser(req)) return res.status(401).json({ message: 'Authentication is required.' });

  const filters = matchedData(req, { locations: ['query'] });
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 10;
  const filter = { createdBy: req.user._id };
  for (const key of ['status', 'priority', 'origin']) {
    if (filters[key]) filter[key] = filters[key];
  }
  if (filters.meetingId) filter.meetingId = filters.meetingId;
  if (filters.responsiblePerson) filter.responsiblePerson = filters.responsiblePerson;

  try {
    const [total, tasks] = await Promise.all([
      Task.countDocuments(filter),
      Task.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    ]);
    return res.status(200).json({
      success: true,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      tasks,
    });
  } catch (error) {
    return next(error);
  }
}

/** Fetch one owned task with its parent meeting's title and date. */
export async function getTaskById(req, res, next) {
  if (sendValidationErrors(req, res)) return;
  if (!validUser(req)) return res.status(401).json({ message: 'Authentication is required.' });
  try {
    const task = await Task.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    const meeting = await Meeting.findOne({ _id: task.meetingId, createdBy: req.user._id })
      .select('title meetingDate');
    if (!meeting) return res.status(404).json({ message: 'Task meeting not found.' });
    return res.status(200).json({ success: true, task, meeting });
  } catch (error) {
    return next(error);
  }
}

/** Update only whitelisted user-editable fields, preserving AI evidence. */
export async function updateTask(req, res, next) {
  if (sendValidationErrors(req, res)) return;
  if (!validUser(req)) return res.status(401).json({ message: 'Authentication is required.' });

  const allowed = ['description', 'responsiblePerson', 'deadline', 'priority', 'status'];
  const supplied = allowed.filter((key) => Object.hasOwn(req.body, key));
  if (supplied.length === 0) {
    return res.status(400).json({ message: 'Provide at least one editable task field.' });
  }

  try {
    const existing = await Task.findOne({ _id: req.params.id, createdBy: req.user._id }).select('origin deadline');
    if (!existing) return res.status(404).json({ message: 'Task not found.' });
    const set = {};
    for (const key of ['description', 'responsiblePerson', 'priority', 'status']) {
      if (Object.hasOwn(req.body, key)) set[key] = req.body[key];
    }
    if (Object.hasOwn(req.body, 'deadline')) {
      if (req.body.deadline === null) {
        set.deadline = null;
      } else {
        const incoming = req.body.deadline;
        set.deadline = {
          originalText: Object.hasOwn(incoming, 'originalText') ? incoming.originalText : existing.deadline?.originalText ?? null,
          normalizedDate: Object.hasOwn(incoming, 'normalizedDate')
            ? (incoming.normalizedDate === null ? null : new Date(`${incoming.normalizedDate}T00:00:00.000Z`))
            : existing.deadline?.normalizedDate ?? null,
        };
      }
    }
    if (existing.origin === 'ai') set.isManuallyEdited = true;

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      { $set: set },
      { new: true, runValidators: true },
    );
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    return res.status(200).json({ success: true, task });
  } catch (error) {
    return next(error);
  }
}

/** Delete one owned task without affecting its meeting or sibling tasks. */
export async function deleteTask(req, res, next) {
  if (sendValidationErrors(req, res)) return;
  if (!validUser(req)) return res.status(401).json({ message: 'Authentication is required.' });
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, createdBy: req.user._id });
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    return res.status(200).json({ success: true, message: 'Task deleted.' });
  } catch (error) {
    return next(error);
  }
}

/** Aggregate task counts and overdue/deadline totals for the authenticated user. */
export async function getTaskStats(req, res, next) {
  if (!validUser(req)) return res.status(401).json({ message: 'Authentication is required.' });
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  try {
    const [result] = await Task.aggregate([
      { $match: { createdBy: new mongoose.Types.ObjectId(req.user._id) } },
      {
        $group: {
          _id: null,
          totalTasks: { $sum: 1 },
          pendingTasks: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          inProgressTasks: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          overdueTasks: {
            $sum: {
              $cond: [
                { $and: [
                  { $ne: ['$status', 'completed'] },
                  { $eq: [{ $type: '$deadline.normalizedDate' }, 'date'] },
                  { $lt: ['$deadline.normalizedDate', today] },
                ] },
                1,
                0,
              ],
            },
          },
          tasksWithoutDeadline: {
            $sum: {
              $cond: [{ $ne: [{ $type: '$deadline.normalizedDate' }, 'date'] }, 1, 0],
            },
          },
        },
      },
      { $project: { _id: 0 } },
    ]);
    const stats = result ?? {
      totalTasks: 0,
      pendingTasks: 0,
      inProgressTasks: 0,
      completedTasks: 0,
      overdueTasks: 0,
      tasksWithoutDeadline: 0,
    };
    return res.status(200).json({ success: true, stats });
  } catch (error) {
    return next(error);
  }
}

