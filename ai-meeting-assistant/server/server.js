import 'dotenv/config';
import app from './app.js';
import { connectDatabase } from './config/db.js';

const port = Number(process.env.PORT) || 5000;

try {
  await connectDatabase();
  const server = app.listen(port, () => {
    console.info(`Meeting Action API listening on port ${port}`);
  });

  const shutdown = (signal) => {
    console.info(`${signal} received; closing server.`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
} catch (error) {
  console.error(`Server startup aborted: ${error.message}`);
  process.exit(1);
}
