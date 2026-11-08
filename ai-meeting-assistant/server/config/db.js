import mongoose from 'mongoose';

/** Connect to MongoDB Atlas using the configured connection string. */
export async function connectDatabase() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri || uri === 'your_mongodb_atlas_connection_string') {
    throw new Error('MONGODB_URI is missing. Set it in server/.env to your MongoDB Atlas URI.');
  }

  try {
    const connection = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.info(`MongoDB Atlas connected: ${connection.connection.host}`);
    return connection;
  } catch (error) {
    if (error?.code === 8000 || /authentication failed|bad auth/i.test(error?.message || '')) {
      const authError = new Error(
        'MongoDB Atlas authentication failed. Check the database user name and password in MONGODB_URI, ' +
        'URL-encode reserved password characters, and confirm the database user has access to the target database.',
        { cause: error },
      );
      console.error(`MongoDB connection failed: ${authError.message}`);
      throw authError;
    }

    const connectionError = new Error(`MongoDB connection failed: ${error.message}`, { cause: error });
    console.error(connectionError.message);
    throw connectionError;
  }
}
