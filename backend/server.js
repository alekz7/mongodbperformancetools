import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectToDatabase } from '../models/database.js';
import profilerRoutes from './routes/profiler.js';
import indexRoutes from './routes/indexes.js';
import analyticsRoutes from './routes/analytics.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/profiler', profilerRoutes);
app.use('/api/indexes', indexRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Studio3T Profiler API is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectToDatabase();
    console.log('Connected to MongoDB successfully');
    
    app.listen(PORT, () => {
      console.log(`🚀 Studio3T Profiler API server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔍 Profiler API: http://localhost:${PORT}/api/profiler`);
      console.log(`📇 Index API: http://localhost:${PORT}/api/indexes`);
      console.log(`📈 Analytics API: http://localhost:${PORT}/api/analytics`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();