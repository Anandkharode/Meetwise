import { Router } from 'express';
import { body } from 'express-validator';
import { currentUser, login, register } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

const emailValidation = body('email')
  .isString().withMessage('Email is required.')
  .trim().isEmail().withMessage('Enter a valid email address.')
  .normalizeEmail();

router.post(
  '/register',
  [
    body('name').isString().withMessage('Name is required.').trim().isLength({ min: 2, max: 100 }),
    emailValidation,
    body('password').isString().withMessage('Password is required.').isLength({ min: 8, max: 128 }),
  ],
  register,
);

router.post(
  '/login',
  [emailValidation, body('password').isString().withMessage('Password is required.').notEmpty()],
  login,
);

router.get('/me', requireAuth, currentUser);

export default router;
