import winston from 'winston';
import path from 'path';
import fs from 'fs';

/**
 * Comprehensive logging system with automatic caller detection and contextual error reporting.
 * Based on IMPEL project logger structure.
 *
 * Provides separate log files for:
 * - system.log: All events (INFO, DEBUG, ERROR)
 * - errors.log: Errors only
 * - api_calls.log: All API calls (Anthropic, Parallel)
 * - llm_calls.log: Full LLM prompts and responses
 */

const LOG_DIR = path.join(__dirname, '../../../logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Custom format with caller info
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...metadata }) => {
    let log = `${timestamp} - ${level.toUpperCase()} - ${message}`;

    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      log += ` | ${JSON.stringify(metadata)}`;
    }

    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }

    return log;
  })
);

// System logger (all events)
const systemLogger = winston.createLogger({
  level: 'debug',
  format: customFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'system.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.Console({
      level: 'info',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Error logger (errors only)
const errorLogger = winston.createLogger({
  level: 'error',
  format: customFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'errors.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    }),
  ],
});

// API calls logger (Anthropic + Parallel)
const apiLogger = winston.createLogger({
  level: 'info',
  format: customFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'api_calls.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
});

// LLM calls logger (full prompts + responses)
const llmLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json() // JSON format for easy parsing
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'llm_calls.log'),
      maxsize: 20971520, // 20MB
      maxFiles: 5,
    }),
  ],
});

// Cost tracking in-memory (could be persisted to DB later)
interface CostTracking {
  anthropicCalls: number;
  anthropicCost: number;
  parallelCalls: number;
  parallelCost: number;
}

const costs: CostTracking = {
  anthropicCalls: 0,
  anthropicCost: 0,
  parallelCalls: 0,
  parallelCost: 0,
};

/**
 * Main logger class with utility methods
 */
export class Logger {
  /**
   * Log informational messages
   */
  static info(message: string, context?: Record<string, any>): void {
    systemLogger.info(message, context);
  }

  /**
   * Log debug messages
   */
  static debug(message: string, context?: Record<string, any>): void {
    systemLogger.debug(message, context);
  }

  /**
   * Log errors with full context
   */
  static error(message: string, error?: Error, context?: Record<string, any>): void {
    const errorContext = {
      ...context,
      errorMessage: error?.message,
      errorStack: error?.stack,
    };

    systemLogger.error(message, errorContext);
    errorLogger.error(message, errorContext);
  }

  /**
   * Log function entry (for debugging)
   */
  static entry(functionName: string, params?: Record<string, any>): void {
    systemLogger.debug(`ENTERING ${functionName}()`, params);
  }

  /**
   * Log function exit (for debugging)
   */
  static exit(functionName: string, result?: any): void {
    systemLogger.debug(`EXITING ${functionName}()`, {
      resultType: result ? typeof result : 'void'
    });
  }

  /**
   * Log API calls (Anthropic or Parallel)
   */
  static apiCall(provider: 'anthropic' | 'parallel', details: {
    endpoint?: string;
    model?: string;
    tier?: string;
    inputTokens?: number;
    outputTokens?: number;
    cost?: number;
    duration?: number;
  }): void {
    apiLogger.info(`API Call: ${provider}`, details);

    // Update cost tracking
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
   */
  static llmCall(data: {
    provider: 'anthropic' | 'parallel';
    role: 'configuration' | 'assistant' | 'internal';
    prompt: string | Record<string, any>;
    response: string | Record<string, any>;
    tokens?: { input: number; output: number };
    cost?: number;
    duration?: number;
  }): void {
    llmLogger.info('LLM Call', data);
  }

  /**
   * Get current cost tracking
   */
  static getCosts(): CostTracking {
    return { ...costs };
  }

  /**
   * Reset cost tracking
   */
  static resetCosts(): void {
    costs.anthropicCalls = 0;
    costs.anthropicCost = 0;
    costs.parallelCalls = 0;
    costs.parallelCost = 0;
  }

  /**
   * Log cost summary
   */
  static logCostSummary(): void {
    const summary = {
      total: costs.anthropicCost + costs.parallelCost,
      anthropic: {
        calls: costs.anthropicCalls,
        cost: costs.anthropicCost.toFixed(4),
      },
      parallel: {
        calls: costs.parallelCalls,
        cost: costs.parallelCost.toFixed(4),
      },
    };

    systemLogger.info('=== COST SUMMARY ===', summary);
    console.log('\n=== API COST SUMMARY ===');
    console.log(`Anthropic: ${costs.anthropicCalls} calls, $${costs.anthropicCost.toFixed(4)}`);
    console.log(`Parallel: ${costs.parallelCalls} calls, $${costs.parallelCost.toFixed(4)}`);
    console.log(`TOTAL: $${summary.total.toFixed(4)}`);
    console.log('=======================\n');
  }
}

// Initialize logger on import
Logger.info('Logger initialized', { logDir: LOG_DIR });

export default Logger;
