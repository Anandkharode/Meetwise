import jwt from 'jsonwebtoken';

/** Sign a JWT using server-only environment configuration. */
export function generateToken(userId) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'replace_with_a_long_random_secret') {
    throw new Error('JWT_SECRET is missing or still set to its example value.');
  }

  return jwt.sign({ sub: userId.toString() }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
}
