import { validationResult } from 'express-validator';
import User from '../models/User.js';
import { generateToken } from '../utils/generateToken.js';

function validationFailure(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(400).json({ message: 'Request validation failed.', errors: errors.array() });
  return true;
}

function safeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

/** Register an account and return its safe profile and bearer token. */
export async function register(req, res, next) {
  if (validationFailure(req, res)) return;
  try {
    const email = req.body.email.trim().toLowerCase();
    const existing = await User.findOne({ email }).select('_id');
    if (existing) return res.status(409).json({ message: 'An account with this email already exists.' });

    const user = await User.create({
      name: req.body.name.trim(),
      email,
      password: req.body.password,
    });
    return res.status(201).json({ user: safeUser(user), token: generateToken(user._id) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An account with this email already exists.' });
    return next(error);
  }
}

/** Authenticate an active account with email and password. */
export async function login(req, res, next) {
  if (validationFailure(req, res)) return;
  try {
    const email = req.body.email.trim().toLowerCase();
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(req.body.password))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    if (!user.isActive) return res.status(403).json({ message: 'This account is inactive.' });
    return res.status(200).json({ user: safeUser(user), token: generateToken(user._id) });
  } catch (error) {
    return next(error);
  }
}

/** Return the authenticated user's safe profile. */
export function currentUser(req, res) {
  return res.status(200).json({ user: safeUser(req.user) });
}
