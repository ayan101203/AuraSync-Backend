import mongoose from 'mongoose';

let connected = false;

export async function connectDB(): Promise<void> {
  if (connected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[DB] MONGODB_URI not set — running without database');
    return;
  }

  await mongoose.connect(uri);
  connected = true;
  console.log('[DB] Connected to MongoDB Atlas');
}
