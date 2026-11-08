import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  createMeeting,
  deleteMeeting,
  getMeetingById,
  getMeetings,
} from '../controllers/meetingController.js';
import { analyzeMeetingController } from '../controllers/meetingAnalysisController.js';
import { uploadAudioMeeting } from '../controllers/audioMeetingController.js';
import { uploadAudio, verifyAudioSignature } from '../middleware/uploadMiddleware.js';

const router = Router();

const meetingIdValidation = param('id').isMongoId().withMessage('Meeting ID must be a valid MongoDB ObjectId.');

router.use(requireAuth);

router.post(
  '/upload-audio',
  uploadAudio,
  verifyAudioSignature,
  [
    body('title').isString().withMessage('Title is required.').trim().notEmpty().withMessage('Title cannot be empty.').isLength({ max: 300 }),
    body('meetingDate')
      .isString().withMessage('Meeting date is required in YYYY-MM-DD format.')
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Meeting date must use YYYY-MM-DD format.')
      .bail()
      .custom((value) => {
        const date = new Date(`${value}T00:00:00.000Z`);
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
          throw new Error('Meeting date must be a valid calendar date.');
        }
        return true;
      }),
  ],
  uploadAudioMeeting,
);

router.post(
  '/',
  [
    body('title').isString().withMessage('Title is required.').trim().notEmpty().withMessage('Title cannot be empty.').isLength({ max: 300 }),
    body('meetingDate')
      .isString().withMessage('Meeting date is required in YYYY-MM-DD format.')
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Meeting date must use YYYY-MM-DD format.')
      .bail()
      .custom((value) => {
        const date = new Date(`${value}T00:00:00.000Z`);
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
          throw new Error('Meeting date must be a valid calendar date.');
        }
        return true;
      }),
    body('transcript').isString().withMessage('Transcript is required.').trim().notEmpty().withMessage('Transcript cannot be empty.'),
    body('sourceType').optional().isIn(['text', 'audio']).withMessage('Source type must be text or audio.'),
  ],
  createMeeting,
);

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.').toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be an integer between 1 and 100.').toInt(),
  ],
  getMeetings,
);

router.get('/:id', [meetingIdValidation], getMeetingById);
router.delete('/:id', [meetingIdValidation], deleteMeeting);
router.post(
  '/:id/analyze',
  [
    param('id').isMongoId().withMessage('Meeting ID must be a valid MongoDB ObjectId.'),
    body('reanalyze').optional().isBoolean().withMessage('reanalyze must be a boolean.').toBoolean(),
    body('replaceManualTasks')
      .optional()
      .isBoolean().withMessage('replaceManualTasks must be a boolean.')
      .toBoolean()
      .custom((value, { req }) => {
        if (value === true && req.body.reanalyze !== true) {
          throw new Error('replaceManualTasks requires reanalyze to be true.');
        }
        return true;
      }),
  ],
  analyzeMeetingController,
);

export default router;
