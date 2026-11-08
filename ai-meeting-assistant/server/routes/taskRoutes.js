import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  deleteTask,
  getTaskById,
  getTaskStats,
  getTasks,
  updateTask,
} from '../controllers/taskController.js';

const router = Router();
const taskId = param('id').isMongoId().withMessage('Task ID must be a valid MongoDB ObjectId.');

router.use(requireAuth);

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.').toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be an integer between 1 and 100.').toInt(),
    query('status').optional().isIn(['pending', 'in_progress', 'completed']).withMessage('Invalid task status.'),
    query('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid task priority.'),
    query('meetingId').optional().isMongoId().withMessage('meetingId must be a valid MongoDB ObjectId.'),
    query('responsiblePerson').optional().isString().trim().notEmpty().isLength({ max: 100 }),
    query('origin').optional().isIn(['ai', 'manual']).withMessage('origin must be ai or manual.'),
  ],
  getTasks,
);

// Keep this before /:id so the literal "stats" is not treated as an ObjectId.
router.get('/stats', getTaskStats);
router.get('/:id', [taskId], getTaskById);

router.patch(
  '/:id',
  [
    taskId,
    body().custom((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Request body must be an object.');
      const allowed = new Set(['description', 'responsiblePerson', 'deadline', 'priority', 'status']);
      const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
      if (unexpected.length) throw new Error(`Fields cannot be updated: ${unexpected.join(', ')}.`);
      if (Object.hasOwn(value, 'deadline') && value.deadline !== null) {
        if (typeof value.deadline !== 'object' || Array.isArray(value.deadline)) throw new Error('deadline must be an object or null.');
        const allowedDeadline = new Set(['originalText', 'normalizedDate']);
        const deadlineUnexpected = Object.keys(value.deadline).filter((key) => !allowedDeadline.has(key));
        if (deadlineUnexpected.length) throw new Error(`Deadline fields cannot be updated: ${deadlineUnexpected.join(', ')}.`);
        if (Object.keys(value.deadline).length === 0) throw new Error('Provide originalText or normalizedDate to update the deadline.');
      }
      return true;
    }),
    body('description').optional().isString().withMessage('description must be text.').trim().notEmpty().withMessage('description cannot be empty.').isLength({ max: 2000 }),
    body('responsiblePerson').optional({ nullable: true }).isString().withMessage('responsiblePerson must be text or null.').trim().notEmpty().withMessage('responsiblePerson cannot be empty.').isLength({ max: 100 }),
    body('deadline').optional({ nullable: true }).custom((value) => value === null || (typeof value === 'object' && !Array.isArray(value))),
    body('deadline.originalText').optional({ nullable: true }).isString().withMessage('deadline.originalText must be text or null.').trim().notEmpty().withMessage('deadline.originalText cannot be empty.').isLength({ max: 200 }),
    body('deadline.normalizedDate')
      .optional({ nullable: true })
      .isString().withMessage('deadline.normalizedDate must be YYYY-MM-DD or null.')
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('deadline.normalizedDate must use YYYY-MM-DD format.')
      .bail()
      .custom((value) => {
        const date = new Date(`${value}T00:00:00.000Z`);
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
          throw new Error('deadline.normalizedDate must be a valid calendar date.');
        }
        return true;
      }),
    body('priority').optional({ nullable: true }).isIn(['low', 'medium', 'high']).withMessage('priority must be low, medium, high or null.'),
    body('status').optional().isIn(['pending', 'in_progress', 'completed']).withMessage('status must be pending, in_progress or completed.'),
  ],
  updateTask,
);

router.delete('/:id', [taskId], deleteTask);

export default router;
