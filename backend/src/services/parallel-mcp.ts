// ============================================================================
// PARALLEL MCP SERVICE - Async Research Task Orchestration
// ============================================================================
// Architecture: Background job processing with real-time WebSocket updates
// Why: Long-running research tasks (up to 20 minutes) cannot block HTTP requests
// Critical: Tasks are fire-and-forget - client must listen to WebSocket for results
// Integration: Used by BlockEditor for deep research, coordinated with WebSocket server
// ============================================================================

import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger';
import { getWebSocketServer } from '../websocket/research-websocket';
import {
  UniversityResearchAgent,
  CareerPathResearchAgent,
  SkillsGapAnalysisAgent,
  TimelineOptimizationAgent,
  QuickResearchAgent
} from '../agents/research-sub-agents';

// ============================================================================
// RESEARCH PROCESSOR TIERS
// ============================================================================
// Architecture: Parallel AI's tiered pricing model - cost scales with compute time
// Why: Different tasks require different depth - LITE for quick lookups, ULTRA8X for comprehensive analysis
// Critical: Timeout values are empirically derived from Parallel AI SLA - DO NOT reduce
// Business Logic: QuickResearchAgent always uses LITE, DeepResearch uses user's selected tier
// ============================================================================
export enum ResearchProcessor {
  LITE = 'lite',        // 5-60s, $0.005 - Quick facts, definitions
  BASE = 'base',        // 15s-100s, $0.01 - Standard research
  CORE = 'core',        // 1-5m, $0.025 - Cross-referenced, moderately complex
  CORE2X = 'core2x',    // 2-5m, $0.05 - High complexity cross-referenced
  PRO = 'pro',          // 3-9m, $0.10 - Default tier, balanced cost/quality
  ULTRA = 'ultra',      // 5-25m, $0.30 - Deep research
  ULTRA2X = 'ultra2x',  // 5-25m, $0.60 - Extended deep research
  ULTRA4X = 'ultra4x',  // 8-30m, $1.20 - Comprehensive research
  ULTRA8X = 'ultra8x'   // 8-30m, $2.40 - Maximum depth research
}

// ============================================================================
// RESEARCH TASK DATA MODEL
// ============================================================================
// Architecture: In-memory state machine tracking task lifecycle
// Why: SQLite persistence would add latency for operations that complete in seconds/minutes
// Critical: Tasks are NOT persisted - restart clears all pending research
// Performance: Map lookup is O(1) for status checks via WebSocket polling
// ============================================================================
export interface ResearchTask {
  taskId: string;              // UUID for tracking across WebSocket messages
  blockId: string;             // Links research results back to timeline block
  blockTitle: string;          // Displayed in UI notifications
  query: string;               // Natural language research query passed to Parallel AI
  processor: ResearchProcessor; // Determines cost and execution time
  estimatedTime: number;       // Seconds - used for progress bars in UI
  status: 'pending' | 'running' | 'complete' | 'error'; // State machine
  results?: any;               // Parallel AI response (raw JSON)
  error?: string;              // Error message if status === 'error'
  createdAt: Date;
  completedAt?: Date;          // Used for TTL-based cleanup
}

// ============================================================================
// PROCESSOR TIMEOUT CONFIGURATION
// ============================================================================
// Critical: These values MUST match Parallel AI's documented SLA
// Why: Prevents premature timeout on legitimate long-running research
// Edge Case: Network latency adds ~5-10s overhead - timeouts include buffer
// ============================================================================
const PROCESSOR_TIMEOUTS = {
  [ResearchProcessor.LITE]: 60,      // 1 minute max
  [ResearchProcessor.BASE]: 120,     // 2 minutes max
  [ResearchProcessor.CORE]: 300,     // 5 minutes max
  [ResearchProcessor.CORE2X]: 300,   // 5 minutes max
  [ResearchProcessor.PRO]: 600,      // 10 minutes max
  [ResearchProcessor.ULTRA]: 1500,   // 25 minutes max
  [ResearchProcessor.ULTRA2X]: 1500, // 25 minutes max
  [ResearchProcessor.ULTRA4X]: 1800, // 30 minutes max
  [ResearchProcessor.ULTRA8X]: 1800  // 30 minutes max
};

// ============================================================================
// PARALLEL MCP SERVICE - Singleton Service
// ============================================================================
// Architecture: Singleton pattern ensures single Map instance across all routes
// Why: Multiple service instances would lose track of spawned background tasks
// Critical: NOT thread-safe - Node.js single-threaded event loop handles concurrency
// ============================================================================
class ParallelMCPService {
  private tasks: Map<string, ResearchTask> = new Map(); // In-memory task registry

  // ==========================================================================
  // CREATE RESEARCH TASK - Fire-and-Forget Entry Point
  // ==========================================================================
  // Architecture: Async/await for task creation, but research executes in background
  // Why: HTTP request returns immediately - research can take 20+ minutes
  // Critical: Client MUST listen to WebSocket for completion - no polling API exists
  // Performance: Task creation is <5ms - just Map.set() and WS broadcast
  // ==========================================================================
  async createResearchTask(params: {
    blockId: string;
    blockTitle: string;
    query: string;
    processor: ResearchProcessor;
    researchType: 'university' | 'career' | 'skills' | 'timeline' | 'quick';
  }): Promise<{ taskId: string; estimatedTime: number }> {
    const taskId = uuidv4(); // Unique ID for tracking across WebSocket updates
    const estimatedTime = PROCESSOR_TIMEOUTS[params.processor]; // Used for UI progress bars

    const task: ResearchTask = {
      taskId,
      blockId: params.blockId,
      blockTitle: params.blockTitle,
      query: params.query,
      processor: params.processor,
      estimatedTime,
      status: 'pending', // State machine: pending -> running -> complete/error
      createdAt: new Date()
    };

    this.tasks.set(taskId, task); // Register in-memory - no DB persistence
    Logger.info('[ParallelMCP] Created research task', {
      taskId,
      blockId: params.blockId,
      processor: params.processor,
      researchType: params.researchType
    });

    // Notify WebSocket clients that research started
    // Edge Case: If WS broadcast fails, research still executes but UI won't show updates
    try {
      const wsServer = getWebSocketServer();
      wsServer.notifyResearchStarted({
        taskId,
        blockId: params.blockId,
        blockTitle: params.blockTitle,
        processor: params.processor,
        estimatedTime
      });
    } catch (error) {
      Logger.error('[ParallelMCP] Failed to send WebSocket notification', error as Error);
      // Non-fatal error - research will still execute
    }

    // Fire-and-forget: Research executes in background (no await)
    // Why: Keeps HTTP response fast while research runs asynchronously
    this.executeResearch(taskId, params.researchType, params.query, params.processor);

    return { taskId, estimatedTime }; // Client uses this to track task via WebSocket
  }

  // ==========================================================================
  // EXECUTE RESEARCH - Background Task Runner
  // ==========================================================================
  // Architecture: Private async method runs in Node event loop (not separate thread)
  // Why: Node.js single-threaded - "background" means non-blocking via promises
  // Critical: Errors are caught and stored in task.error - never throws to caller
  // Performance: Parallel AI API calls are the bottleneck (5s to 20m)
  // ==========================================================================
  private async executeResearch(
    taskId: string,
    researchType: string,
    query: string,
    processor: ResearchProcessor
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      // Edge Case: Task deleted before execution started (unlikely but possible)
      Logger.error('[ParallelMCP] Task not found', new Error('Task not found'), { taskId });
      return;
    }

    task.status = 'running'; // State transition: pending -> running
    Logger.info('[ParallelMCP] Starting research execution', { taskId, researchType });

    try {
      let results;

      // Route to appropriate specialized research agent
      // Architecture: Each agent wraps Parallel AI with domain-specific prompts
      switch (researchType) {
        case 'university':
          // University-focused research: programs, admissions, funding
          results = await UniversityResearchAgent({
            goal: query,
            fieldOfStudy: query
          });
          break;

        case 'career':
          // Career path research: job market, salaries, progression
          results = await CareerPathResearchAgent({
            targetRole: query,
            currentSkills: [],
            yearsOfExperience: 0
          });
          break;

        case 'skills':
          // Skills gap analysis: required skills, learning resources
          results = await SkillsGapAnalysisAgent({
            currentSkills: [],
            targetRole: query,
            timeframe: '1 year'
          });
          break;

        case 'timeline':
          // Timeline optimization: milestones, dependencies, risks
          results = await TimelineOptimizationAgent({
            blocks: [],
            constraints: [],
            priorities: [],
            riskTolerance: 'medium'
          });
          break;

        case 'quick':
          // Quick lookups: always uses LITE tier, auto-approved
          results = await QuickResearchAgent({ query });
          break;

        default:
          throw new Error(`Unknown research type: ${researchType}`);
      }

      // Success path: Update task state
      task.status = 'complete'; // State transition: running -> complete
      task.results = results;   // Store Parallel AI response (raw JSON)
      task.completedAt = new Date();

      Logger.info('[ParallelMCP] Research completed', {
        taskId,
        researchType,
        hasResults: !!results
      });

      // Broadcast success to all WebSocket clients
      try {
        const wsServer = getWebSocketServer();
        wsServer.notifyResearchComplete(taskId, results);
      } catch (error) {
        Logger.error('[ParallelMCP] Failed to send WebSocket notification', error as Error);
        // Non-fatal - results are stored in task Map
      }

    } catch (error) {
      // Error path: Update task state and notify clients
      task.status = 'error'; // State transition: running -> error
      task.error = (error as Error).message;
      task.completedAt = new Date();

      Logger.error('[ParallelMCP] Research failed', error as Error, {
        taskId,
        researchType
      });

      // Broadcast error to all WebSocket clients
      try {
        const wsServer = getWebSocketServer();
        wsServer.notifyResearchError(taskId, (error as Error).message);
      } catch (wsError) {
        Logger.error('[ParallelMCP] Failed to send WebSocket error notification', wsError as Error);
        // Non-fatal - error is stored in task Map
      }
    }
  }

  // ==========================================================================
  // CHECK TASK STATUS - Public Query Method
  // ==========================================================================
  // Architecture: Simple Map lookup exposed for debugging/polling
  // Why: Allows checking task state without WebSocket (useful for tests)
  // Performance: O(1) Map lookup
  // ==========================================================================
  async checkTaskStatus(taskId: string): Promise<ResearchTask | null> {
    return this.tasks.get(taskId) || null; // Returns null if task not found or expired
  }

  // ==========================================================================
  // GET TASKS FOR BLOCK - Query Helper
  // ==========================================================================
  // Architecture: Filter Map by blockId
  // Why: Allows viewing all research history for a specific timeline block
  // Performance: O(n) iteration over all tasks - acceptable since Map size stays small
  // ==========================================================================
  getTasksForBlock(blockId: string): ResearchTask[] {
    return Array.from(this.tasks.values()).filter(task => task.blockId === blockId);
  }

  // ==========================================================================
  // GET RUNNING TASKS - Monitoring Helper
  // ==========================================================================
  // Architecture: Filter Map by status
  // Why: Useful for monitoring dashboard and debugging stuck tasks
  // Performance: O(n) iteration over all tasks
  // ==========================================================================
  getRunningTasks(): ResearchTask[] {
    return Array.from(this.tasks.values()).filter(task => task.status === 'running');
  }

  // ==========================================================================
  // CLEAR OLD TASKS - TTL-Based Garbage Collection
  // ==========================================================================
  // Architecture: Periodic cleanup via setInterval (see bottom of file)
  // Why: Prevents infinite memory growth from completed/failed tasks
  // Critical: Only deletes completed/error tasks - never deletes running tasks
  // Performance: Runs every 15 minutes - negligible overhead
  // ==========================================================================
  clearOldTasks(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000); // 1 hour TTL

    for (const [taskId, task] of this.tasks.entries()) {
      // Only cleanup terminal states - never delete pending/running tasks
      if (task.status === 'complete' || task.status === 'error') {
        if (task.completedAt && task.completedAt < oneHourAgo) {
          this.tasks.delete(taskId); // Remove from in-memory Map
          Logger.info('[ParallelMCP] Cleared old task', { taskId });
        }
      }
    }
  }
}

// ============================================================================
// SINGLETON INITIALIZATION
// ============================================================================
// Architecture: Single service instance ensures consistent task registry
// Why: Multiple instances would fragment task tracking across memory spaces
// ============================================================================
const parallelMCPService = new ParallelMCPService();

// ============================================================================
// BACKGROUND CLEANUP SCHEDULER
// ============================================================================
// Architecture: Node.js setInterval runs in event loop
// Why: Prevents memory leaks from completed tasks accumulating indefinitely
// Critical: 15-minute interval is arbitrary but safe - adjust if Map grows too large
// Performance: Cleanup takes <1ms for typical task counts (10-100 tasks)
// ============================================================================
setInterval(() => {
  parallelMCPService.clearOldTasks();
}, 15 * 60 * 1000); // Run every 15 minutes

export default parallelMCPService;
