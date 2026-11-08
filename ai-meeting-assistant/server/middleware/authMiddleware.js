import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';

/** Verify the bearer JWT and attach its active database user to the request. */
export async function requireAuth(req, res, next) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return res.status(401).json({ message: 'Authentication token is required.' });
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === 'replace_with_a_long_random_secret') {
      return res.status(503).json({ message: 'Authentication is not configured.' });
    }
    const payload = jwt.verify(token, secret);
    if (typeof payload === 'string' || typeof payload.sub !== 'string' || !mongoose.isValidObjectId(payload.sub)) {
      return res.status(401).json({ message: 'Invalid authentication token.' });
    }

    const user = await User.findById(payload.sub).select('-password');
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid authentication token.' });
    }
    req.user = user;
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired authentication token.' });
    }
    return next(error);
  }
}
