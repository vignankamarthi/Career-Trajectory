/**
 * PARALLEL MCP SERVICE
 * Manages async research tasks using background processing
 */

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

export enum ResearchProcessor {
  LITE = 'lite',        // 5-60s, $0.005
  BASE = 'base',        // 30s-2m, $0.02
  PRO = 'pro',          // 1-3m, $0.10
  ULTRA = 'ultra',      // 2-5m, $0.30
  ULTRA2X = 'ultra2x',  // 3-7m, $0.60
  ULTRA4X = 'ultra4x',  // 5-10m, $1.20
  ULTRA8X = 'ultra8x'   // 10-20m, $2.40
}

export interface ResearchTask {
  taskId: string;
  blockId: string;
  blockTitle: string;
  query: string;
  processor: ResearchProcessor;
  estimatedTime: number; // in seconds
  status: 'pending' | 'running' | 'complete' | 'error';
  results?: any;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

const PROCESSOR_TIMEOUTS = {
  [ResearchProcessor.LITE]: 60,
  [ResearchProcessor.BASE]: 120,
  [ResearchProcessor.PRO]: 180,
  [ResearchProcessor.ULTRA]: 300,
  [ResearchProcessor.ULTRA2X]: 420,
  [ResearchProcessor.ULTRA4X]: 600,
  [ResearchProcessor.ULTRA8X]: 1200
};

class ParallelMCPService {
  private tasks: Map<string, ResearchTask> = new Map();

  /**
   * Create an async research task
   * Returns immediately with task ID, runs research in background
   */
  async createResearchTask(params: {
    blockId: string;
    blockTitle: string;
    query: string;
    processor: ResearchProcessor;
    researchType: 'university' | 'career' | 'skills' | 'timeline' | 'quick';
  }): Promise<{ taskId: string; estimatedTime: number }> {
    const taskId = uuidv4();
    const estimatedTime = PROCESSOR_TIMEOUTS[params.processor];

    const task: ResearchTask = {
      taskId,
      blockId: params.blockId,
      blockTitle: params.blockTitle,
      query: params.query,
      processor: params.processor,
      estimatedTime,
      status: 'pending',
      createdAt: new Date()
    };

    this.tasks.set(taskId, task);
    Logger.info('[ParallelMCP] Created research task', {
      taskId,
      blockId: params.blockId,
      processor: params.processor,
      researchType: params.researchType
    });

    // Notify via WebSocket that research started
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
    }

    // Run research in background
    this.executeResearch(taskId, params.researchType, params.query, params.processor);

    return { taskId, estimatedTime };
  }

  /**
   * Execute research in background
   */
  private async executeResearch(
    taskId: string,
    researchType: string,
    query: string,
    processor: ResearchProcessor
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      Logger.error('[ParallelMCP] Task not found', new Error('Task not found'), { taskId });
      return;
    }

    task.status = 'running';
    Logger.info('[ParallelMCP] Starting research execution', { taskId, researchType });

    try {
      let results;

      // Route to appropriate research agent
      switch (researchType) {
        case 'university':
          results = await UniversityResearchAgent({
            goal: query,
            fieldOfStudy: query,
            processor
          });
          break;

        case 'career':
          results = await CareerPathResearchAgent({
            goal: query,
            currentRole: 'current',
            processor
          });
          break;

        case 'skills':
          results = await SkillsGapAnalysisAgent({
            currentSkills: [],
            targetRole: query,
            processor
          });
          break;

        case 'timeline':
          results = await TimelineOptimizationAgent({
            goal: query,
            currentProgress: 'starting',
            timeConstraints: '',
            processor
          });
          break;

        case 'quick':
          results = await QuickResearchAgent({
            query
          });
          break;

        default:
          throw new Error(`Unknown research type: ${researchType}`);
      }

      task.status = 'complete';
      task.results = results;
      task.completedAt = new Date();

      Logger.info('[ParallelMCP] Research completed', {
        taskId,
        researchType,
        hasResults: !!results
      });

      // Notify via WebSocket
      try {
        const wsServer = getWebSocketServer();
        wsServer.notifyResearchComplete(taskId, results);
      } catch (error) {
        Logger.error('[ParallelMCP] Failed to send WebSocket notification', error as Error);
      }

    } catch (error) {
      task.status = 'error';
      task.error = (error as Error).message;
      task.completedAt = new Date();

      Logger.error('[ParallelMCP] Research failed', error as Error, {
        taskId,
        researchType
      });

      // Notify via WebSocket
      try {
        const wsServer = getWebSocketServer();
        wsServer.notifyResearchError(taskId, (error as Error).message);
      } catch (wsError) {
        Logger.error('[ParallelMCP] Failed to send WebSocket error notification', wsError as Error);
      }
    }
  }

  /**
   * Check status of a research task
   */
  async checkTaskStatus(taskId: string): Promise<ResearchTask | null> {
    return this.tasks.get(taskId) || null;
  }

  /**
   * Get all tasks for a specific block
   */
  getTasksForBlock(blockId: string): ResearchTask[] {
    return Array.from(this.tasks.values()).filter(task => task.blockId === blockId);
  }

  /**
   * Get all running tasks
   */
  getRunningTasks(): ResearchTask[] {
    return Array.from(this.tasks.values()).filter(task => task.status === 'running');
  }

  /**
   * Clear completed tasks older than 1 hour
   */
  clearOldTasks(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    for (const [taskId, task] of this.tasks.entries()) {
      if (task.status === 'complete' || task.status === 'error') {
        if (task.completedAt && task.completedAt < oneHourAgo) {
          this.tasks.delete(taskId);
          Logger.info('[ParallelMCP] Cleared old task', { taskId });
        }
      }
    }
  }
}

// Singleton instance
const parallelMCPService = new ParallelMCPService();

// Periodic cleanup every 15 minutes
setInterval(() => {
  parallelMCPService.clearOldTasks();
}, 15 * 60 * 1000);

export default parallelMCPService;
