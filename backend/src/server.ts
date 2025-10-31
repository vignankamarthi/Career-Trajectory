import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Logger from './utils/logger';
import { testConstraints } from './database/db';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  Logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    body: req.method !== 'GET' ? req.body : undefined,
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Test database constraints endpoint
app.get('/test/constraints', (req, res) => {
  try {
    const success = testConstraints();
    res.json({
      success,
      message: success ? 'All constraints working correctly' : 'Some constraints failed',
    });
  } catch (error) {
    Logger.error('Constraint test endpoint failed', error as Error);
    res.status(500).json({ error: 'Test failed' });
  }
});

// API routes
import configureWithContextRouter from './routes/configure-with-context';
import timelinesRouter from './routes/timelines';
import blocksRouter from './routes/blocks';
import chatRouter from './routes/chat';
import saveRouter from './routes/save';
import analyzeRouter from './routes/analyze';

app.use('/api/configure-with-context', configureWithContextRouter);
app.use('/api/timelines', timelinesRouter);
app.use('/api/blocks', blocksRouter);
app.use('/api/chat', chatRouter);
app.use('/api/save', saveRouter);
app.use('/api/analyze', analyzeRouter);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  Logger.error('Unhandled error', err, {
    method: req.method,
    path: req.path,
    body: req.body,
  });

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
app.listen(PORT, () => {
  Logger.info(`Server started on port ${PORT}`, {
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
  });

  // Test database constraints on startup
  Logger.info('Testing database constraints...');
  const constraintsOk = testConstraints();

  if (!constraintsOk) {
    Logger.error('Database constraints test failed! Check logs for details.');
  }

  // Log cost summary on startup (should be zero)
  Logger.logCostSummary();

  Logger.info('Server ready to accept requests');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  Logger.info('SIGTERM received, shutting down gracefully');
  Logger.logCostSummary();
  process.exit(0);
});

process.on('SIGINT', () => {
  Logger.info('SIGINT received, shutting down gracefully');
  Logger.logCostSummary();
  process.exit(0);
});
