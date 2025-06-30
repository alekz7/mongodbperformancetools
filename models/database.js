import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

let client = null;
let db = null;

export async function connectToDatabase() {
  try {
    if (db) {
      return db;
    }

    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/studio3t_profiler';
    
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });

    await client.connect();
    
    // Extract database name from URI or use default
    const dbName = uri.split('/').pop().split('?')[0] || 'studio3t_profiler';
    db = client.db(dbName);

    console.log(`Connected to MongoDB database: ${dbName}`);
    
    // Enable profiling on the database if not already enabled
    await enableProfiling();
    
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call connectToDatabase() first.');
  }
  return db;
}

export async function enableProfiling() {
  try {
    if (!db) return;

    // Check current profiling level
    const profilingStatus = await db.command({ profile: -1 });
    console.log('Current profiling level:', profilingStatus.was);

    // Enable profiling for operations slower than 100ms (level 1)
    if (profilingStatus.was === 0) {
      await db.command({ profile: 1, slowms: 100 });
      console.log('MongoDB profiling enabled for operations > 100ms');
    }
  } catch (error) {
    console.warn('Could not enable profiling (may need admin privileges):', error.message);
  }
}

export async function closeDatabaseConnection() {
  try {
    if (client) {
      await client.close();
      client = null;
      db = null;
      console.log('MongoDB connection closed');
    }
  } catch (error) {
    console.error('Error closing MongoDB connection:', error);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT. Gracefully shutting down...');
  await closeDatabaseConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Gracefully shutting down...');
  await closeDatabaseConnection();
  process.exit(0);
});