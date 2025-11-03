// ============================================================================
// COMPREHENSIVE LOGGING SYSTEM
// ============================================================================
// Architecture: Winston-based multi-transport logger with automatic cost tracking
// Pattern: Centralized logging with function entry/exit tracing for debugging
// Transports: Console (development), file logs (production), JSON logs (LLM calls)
// Log Files:
//   - logs/system.log: All events (INFO, DEBUG, ERROR) - 10MB rotation, 5 files
//   - logs/errors.log: Errors only - 5MB rotation, 3 files
//   - logs/api_calls.log: API metadata (Anthropic, Parallel) - 10MB rotation, 5 files
//   - logs/llm_calls.log: Full prompts and responses (JSON) - 20MB rotation, 5 files
// Cost Tracking: In-memory counters for Anthropic and Parallel API usage
// ============================================================================

import winston from 'winston';
import path from 'path';
import fs from 'fs';

const LOG_DIR = path.join(__dirname, '../../../logs'); // Project root/logs directory

// Ensure log directory exists on module load
// Critical: Must happen before logger initialization
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ============================================================================
// CUSTOM LOG FORMAT
// ============================================================================
// Format: YYYY-MM-DD HH:mm:ss - LEVEL - message | metadata
// Stack traces: Appended on newline for errors
// Why combine: Single format for both console and file transports
// ============================================================================
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // Human-readable timestamps
  winston.format.errors({ stack: true }), // Include stack traces for Error objects
  winston.format.printf(({ timestamp, level, message, stack, ...metadata }) => {
    let log = `${timestamp} - ${level.toUpperCase()} - ${message}`;

    // Add metadata if present (query params, function args, etc.)
    if (Object.keys(metadata).length > 0) {
      log += ` | ${JSON.stringify(metadata)}`;
    }

    // Add stack trace for errors on separate line for readability
    if (stack) {
      log += `\n${stack}`;
    }

    return log;
  })
);

// ============================================================================
// SYSTEM LOGGER (ALL EVENTS)
// ============================================================================
// Purpose: Main logger for application events, debugging, and errors
// Level: debug (captures everything)
// Transports: File (all levels) + Console (info and above in dev)
// Rotation: 10MB files, keep 5 historical copies
// ============================================================================
const systemLogger = winston.createLogger({
  level: 'debug', // Log everything from debug to error
  format: customFormat,
  transports: [
    // File transport: All logs to disk
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'system.log'),
      maxsize: 10485760, // 10MB - prevents unbounded disk growth
      maxFiles: 5, // Keep 5 rotated files (50MB total)
    }),
    // Console transport: Only INFO and above, with colors
    new winston.transports.Console({
      level: 'info', // Don't spam console with DEBUG logs
      format: winston.format.combine(
        winston.format.colorize(), // Green INFO, red ERROR, etc.
        winston.format.simple() // Simplified format for console readability
      ),
    }),
  ],
});

// ============================================================================
// ERROR LOGGER (ERRORS ONLY)
// ============================================================================
// Purpose: Separate log file for errors to enable fast incident triage
// Why separate: Easier to grep for failures without INFO/DEBUG noise
// Pattern: Duplicate error logging (both system.log and errors.log)
// ============================================================================
const errorLogger = winston.createLogger({
  level: 'error', // Only ERROR level messages
  format: customFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'errors.log'),
      maxsize: 5242880, // 5MB - smaller since errors are less frequent
      maxFiles: 3, // Keep 3 historical files (15MB total)
    }),
  ],
});

// ============================================================================
// API CALLS LOGGER (ANTHROPIC + PARALLEL)
// ============================================================================
// Purpose: Track API usage, costs, and performance metrics
// Why separate: Business intelligence, cost tracking, performance analysis
// Format: Same as system logs but dedicated file for easy parsing
// Use case: Generate cost reports, analyze API latency trends
// ============================================================================
const apiLogger = winston.createLogger({
  level: 'info',
  format: customFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'api_calls.log'),
      maxsize: 10485760, // 10MB - can be high volume with many API calls
      maxFiles: 5,
    }),
  ],
});

// ============================================================================
// LLM CALLS LOGGER (FULL PROMPTS + RESPONSES)
// ============================================================================
// Purpose: Debug LLM behavior, audit prompt engineering, analyze quality
// Format: JSON (enables programmatic parsing for analysis)
// Size: Largest log file (20MB) because prompts/responses are verbose
// Use case: Replay conversations, debug prompt issues, quality analysis
// Security: Be careful - may contain PII if users input sensitive data
// ============================================================================
const llmLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json() // JSON format for easy parsing with jq or scripts
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'llm_calls.log'),
      maxsize: 20971520, // 20MB - largest file due to full prompt/response content
      maxFiles: 5,
    }),
  ],
});

// ============================================================================
// COST TRACKING (IN-MEMORY)
// ============================================================================
// Purpose: Track cumulative API costs for budgeting and billing
// Scope: Session-based (resets on server restart)
// Future: Could persist to database for long-term tracking
// ============================================================================
interface CostTracking {
  anthropicCalls: number; // Number of Claude API calls
  anthropicCost: number; // Total cost in USD
  parallelCalls: number; // Number of Parallel AI research calls
  parallelCost: number; // Total cost in USD
}

const costs: CostTracking = {
  anthropicCalls: 0,
  anthropicCost: 0,
  parallelCalls: 0,
  parallelCost: 0,
};

// ============================================================================
// LOGGER CLASS (PUBLIC API)
// ============================================================================
// Pattern: Static class methods for easy global access
// Why not singleton: No state besides logs, static methods are simpler
// ============================================================================
export class Logger {
  /**
   * Log informational messages
   * Use for: Normal operations, state transitions, successful completions
   */
  static info(message: string, context?: Record<string, any>): void {
    systemLogger.info(message, context);
  }

  /**
   * Log debug messages
   * Use for: Detailed state inspection, variable dumps, control flow tracing
   * Note: Not shown in console (only in system.log file)
   */
  static debug(message: string, context?: Record<string, any>): void {
    systemLogger.debug(message, context);
  }

  /**
   * Log errors with full context
   * Pattern: Dual-write to system.log and errors.log
   * @param message - Human-readable error description
   * @param error - Error object (for stack trace)
   * @param context - Additional context (function args, state, etc.)
   */
  static error(message: string, error?: Error, context?: Record<string, any>): void {
    const errorContext = {
      ...context,
      errorMessage: error?.message,
      errorStack: error?.stack,
    };

    systemLogger.error(message, errorContext); // Write to system.log
    errorLogger.error(message, errorContext); // Write to errors.log
  }

  /**
   * Log function entry (for debugging)
   * Pattern: ENTERING <function_name>() | params
   * Use case: Trace execution flow, identify where errors occur
   */
  static entry(functionName: string, params?: Record<string, any>): void {
    systemLogger.debug(`ENTERING ${functionName}()`, params);
  }

  /**
   * Log function exit (for debugging)
   * Pattern: EXITING <function_name>() | resultType
   * Why log type: Helps identify what functions return without verbose output
   */
  static exit(functionName: string, result?: any): void {
    systemLogger.debug(`EXITING ${functionName}()`, {
      resultType: result ? typeof result : 'void'
    });
  }

  /**
   * Log API calls (Anthropic or Parallel)
   * Purpose: Track API usage, costs, and performance
   * Side effect: Updates in-memory cost counters
   */
  static apiCall(provider: 'anthropic' | 'parallel', details: {
    endpoint?: string;
    model?: string;
    tier?: string;
    inputTokens?: number;
    outputTokens?: number;
    cost?: number;
    duration?: number; // Milliseconds
  }): void {
    apiLogger.info(`API Call: ${provider}`, details);

    // Update cost tracking counters
    if (provider === 'anthropic') {
      costs.anthropicCalls++;
      if (details.cost) costs.anthropicCost += details.cost;
    } else if (provider === 'parallel') {
      costs.parallelCalls++;
      if (details.cost) costs.parallelCost += details.cost;
    }
  }

  /**
   * Log full LLM conversation (prompt + response)
   * Purpose: Debug LLM behavior, audit prompts, quality analysis
   * Format: JSON for programmatic parsing
   * Warning: Can be large (4K+ tokens per call)
   */
  static llmCall(data: {
    provider: 'anthropic' | 'parallel';
    role: 'configuration' | 'assistant' | 'internal'; // Which agent/role
    prompt: string | Record<string, any>; // Full prompt or messages array
    response: string | Record<string, any>; // Full response
    tokens?: { input: number; output: number };
    cost?: number;
    duration?: number; // Milliseconds
  }): void {
    llmLogger.info('LLM Call', data);
  }

  /**
   * Get current cost tracking
   * Returns: Copy of cost counters (not mutable reference)
   */
  static getCosts(): CostTracking {
    return { ...costs }; // Return copy to prevent external mutation
  }

  /**
   * Reset cost tracking
   * Use case: Testing, session boundaries, manual reset
   */
  static resetCosts(): void {
    costs.anthropicCalls = 0;
    costs.anthropicCost = 0;
    costs.parallelCalls = 0;
    costs.parallelCost = 0;
  }

  /**
   * Log cost summary
   * Purpose: Print human-readable cost breakdown to console and system.log
   * Use case: Server startup, shutdown, manual cost checks
   */
  static logCostSummary(): void {
    const summary = {
      total: costs.anthropicCost + costs.parallelCost,
      anthropic: {
        calls: costs.anthropicCalls,
        cost: costs.anthropicCost.toFixed(4), // 4 decimal places ($0.0001)
      },
      parallel: {
        calls: costs.parallelCalls,
        cost: costs.parallelCost.toFixed(4),
      },
    };

    systemLogger.info('=== COST SUMMARY ===', summary);

    // Also print to console for visibility
    console.log('\n=== API COST SUMMARY ===');
    console.log(`Anthropic: ${costs.anthropicCalls} calls, $${costs.anthropicCost.toFixed(4)}`);
    console.log(`Parallel: ${costs.parallelCalls} calls, $${costs.parallelCost.toFixed(4)}`);
    console.log(`TOTAL: $${summary.total.toFixed(4)}`);
    console.log('=======================\n');
  }
}

// Initialize logger on module load
// Why: Confirm log directory creation and logger setup
Logger.info('Logger initialized', { logDir: LOG_DIR });

export default Logger;
