/** Return a consistent JSON response for unmatched routes. */
export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

/** Central Express error handler. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, _next) {
  const status = error.status || error.statusCode || 500;
  const message = status >= 500 && process.env.NODE_ENV === 'production'
    ? 'Internal server error.'
    : error.message || 'Internal server error.';
  if (status >= 500) console.error(error);
  res.status(status).json({ message });
}
