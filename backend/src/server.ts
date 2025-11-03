// ============================================================================
// EXPRESS SERVER - CAREER TRAJECTORY AI
// ============================================================================
// Purpose: Central HTTP server with WebSocket support for real-time research updates
// Architecture: Express.js REST API + WebSocket server on same port
// Port: 3001 (configurable via PORT env var)
// Lifecycle: Graceful shutdown with cost summary logging on SIGTERM/SIGINT
// Health: /health endpoint for container orchestration readiness probes
// ============================================================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import Logger from './utils/logger';
import { testConstraints } from './database/db';
import { initializeWebSocketServer } from './websocket/research-websocket';

// Load environment variables from .env file
// Critical: Must load before importing any modules that use process.env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001; // Default to 3001 for development
const server = http.createServer(app); // Create HTTP server for both Express and WebSocket

// ============================================================================
// MIDDLEWARE STACK
// ============================================================================
// Order matters: CORS → JSON parsing → Request logging
// ============================================================================

// CORS: Allow frontend (localhost:3000) to make requests
app.use(cors());

// JSON body parser: Enables req.body parsing for POST/PUT requests
app.use(express.json());

// Request logging middleware: Logs all incoming HTTP requests
// Excludes GET request bodies to reduce log noise
app.use((req, res, next) => {
  Logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    body: req.method !== 'GET' ? req.body : undefined, // Only log body for mutations
  });
  next();
});

// ============================================================================
// HEALTH CHECK ENDPOINT
// ============================================================================
// Used by: Container orchestration (Docker, K8s), load balancers, monitoring
// Returns: Server status, timestamp, environment
// ============================================================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ============================================================================
// DATABASE CONSTRAINT TEST ENDPOINT
// ============================================================================
// Purpose: Verify SQLite CHECK constraints are working correctly
// Why: SQLite constraints prevent invalid data (e.g., Layer 1 blocks < 4 years)
// How: Attempts valid/invalid inserts, reports success/failure
// Used by: CI/CD tests, manual verification, startup diagnostics
// ============================================================================
app.get('/test/constraints', (req, res) => {
  try {
    const success = testConstraints(); // Runs validation suite in db.ts
    res.json({
      success,
      message: success ? 'All constraints working correctly' : 'Some constraints failed',
    });
  } catch (error) {
    Logger.error('Constraint test endpoint failed', error as Error);
    res.status(500).json({ error: 'Test failed' });
  }
});

// ============================================================================
// API ROUTE IMPORTS
// ============================================================================
// Pattern: Each route module exports an Express Router
// Why separate: Modularity, testability, clear responsibility boundaries
// ============================================================================
import configureWithContextRouter from './routes/configure-with-context'; // 4-agent workflow (NEW)
import timelinesRouter from './routes/timelines'; // CRUD operations for timelines
import blocksRouter from './routes/blocks'; // Block-level operations
import chatRouter from './routes/chat'; // Conversational editing
import saveRouter from './routes/save'; // Save with research modes
import analyzeRouter from './routes/analyze'; // Pre-validation analysis
import testResearchRouter from './routes/test-research'; // Research sub-agent testing

// ============================================================================
// API ROUTE REGISTRATION
// ============================================================================
// All routes prefixed with /api for clear API namespace
// Frontend makes requests to http://localhost:3001/api/*
// ============================================================================
app.use('/api/configure-with-context', configureWithContextRouter); // 4-agent workflow (analyze, clarify, review, generate)
app.use('/api/timelines', timelinesRouter); // GET, POST, PUT, DELETE timelines
app.use('/api/blocks', blocksRouter); // GET, PUT blocks
app.use('/api/chat', chatRouter); // POST /:timelineId - conversational editing
app.use('/api/save', saveRouter); // POST / - save with lite/refactor modes
app.use('/api/analyze', analyzeRouter); // POST / - pre-validation only
app.use('/api/test', testResearchRouter); // POST /research - research agent testing

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================
// Purpose: Catch-all for unhandled errors in route handlers
// Pattern: Express error middleware with 4 parameters (err, req, res, next)
// Security: Only expose error messages in development (not production)
// ============================================================================
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  Logger.error('Unhandled error', err, {
    method: req.method,
    path: req.path,
    body: req.body,
  });

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined, // Hide details in production
  });
});

// ============================================================================
// WEBSOCKET SERVER INITIALIZATION
// ============================================================================
// Purpose: Real-time research progress updates to frontend
// Protocol: WebSocket over same port as HTTP server (upgrade from HTTP)
// Path: ws://localhost:3001/ws
// Used by: Async research tasks (30-60s operations) to push progress updates
// ============================================================================
const wsServer = initializeWebSocketServer(server); // Attaches WS server to HTTP server
Logger.info('WebSocket server initialized', { path: '/ws' });

// ============================================================================
// SERVER STARTUP
// ============================================================================
// Sequence: Start HTTP server → Test DB constraints → Log cost summary → Ready
// ============================================================================
server.listen(PORT, () => {
  Logger.info(`Server started on port ${PORT}`, {
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version, // Log Node.js version for debugging
  });

  // Test database constraints on startup
  // Critical: Ensures SQLite CHECK constraints are enforced before accepting requests
  Logger.info('Testing database constraints...');
  const constraintsOk = testConstraints();

  if (!constraintsOk) {
    Logger.error('Database constraints test failed! Check logs for details.');
    // Don't exit - let server run but warn operators
  }

  // Log cost summary on startup (should be zero)
  // Useful: Shows accumulated costs from previous session if server crashed
  Logger.logCostSummary();

  Logger.info('Server ready to accept requests', {
    http: `http://localhost:${PORT}`,
    websocket: `ws://localhost:${PORT}/ws`
  });
});

// ============================================================================
// GRACEFUL SHUTDOWN HANDLERS
// ============================================================================
// Purpose: Clean up resources before process exit
// Triggers: SIGTERM (Docker stop, K8s pod termination), SIGINT (Ctrl+C)
// Actions: Close WebSocket connections, log final cost summary, exit cleanly
// Why: Prevents abrupt connection drops, ensures cost tracking accuracy
// ============================================================================
process.on('SIGTERM', () => {
  Logger.info('SIGTERM received, shutting down gracefully');
  wsServer.close(); // Close all WebSocket connections
  Logger.logCostSummary(); // Final cost report for session
  process.exit(0);
});

process.on('SIGINT', () => {
  Logger.info('SIGINT received, shutting down gracefully');
  wsServer.close(); // Close all WebSocket connections
  Logger.logCostSummary(); // Final cost report for session
  process.exit(0);
});
