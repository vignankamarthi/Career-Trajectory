/**
 * CHAIN COORDINATOR
 * Implements Chain of Agents pattern for async agent orchestration
 * Inspired by Zhang et al. (2025) "Chain of Agents" - NeurIPS 2024
 */

import { Logger } from '../utils/logger';
import { AgentContext } from '../types/agent-context';
import parallelMCPService, { ResearchProcessor } from '../services/parallel-mcp';

export interface ChainAgent {
  name: string;
  execute: (context: AgentContext) => Promise<any>;
  canSpawnTasks: boolean;
}

export interface TaskSpawnedCallback {
  (task: { taskId: string; blockId: string; estimatedTime: number }): void;
}

export interface TaskCompleteCallback {
  (task: { taskId: string; blockId: string; results: any }): void;
}

export interface ChainExecutionOptions {
  onTaskCreated?: TaskSpawnedCallback;
  onTaskComplete?: TaskCompleteCallback;
}

/**
 * Chain Coordinator
 * Orchestrates agent execution with async task spawning capabilities
 */
export class ChainCoordinator {
  private agents: ChainAgent[] = [];

  /**
   * Register agents in execution order
   */
  registerAgent(agent: ChainAgent): void {
    this.agents.push(agent);
    Logger.info('[ChainCoordinator] Agent registered', { agentName: agent.name });
  }

  /**
   * Execute agent chain with async capabilities
   * Each agent can spawn background tasks independently
   */
  async executeChain(
    context: AgentContext,
    options: ChainExecutionOptions = {}
  ): Promise<{
    context: AgentContext;
    spawnedTasks: Array<{ taskId: string; blockId: string; estimatedTime: number }>;
  }> {
    Logger.info('[ChainCoordinator] Starting chain execution', {
      agentCount: this.agents.length,
      stage: context.workflow.current_stage
    });

    const spawnedTasks: Array<{ taskId: string; blockId: string; estimatedTime: number }> = [];

    // Execute each agent in sequence
    for (const agent of this.agents) {
      Logger.info('[ChainCoordinator] Executing agent', { agentName: agent.name });

      try {
        const result = await agent.execute(context);

        // Check if agent spawned any async tasks
        if (agent.canSpawnTasks && result.spawnedTasks) {
          for (const task of result.spawnedTasks) {
            spawnedTasks.push(task);

            // Notify callback
            if (options.onTaskCreated) {
              options.onTaskCreated(task);
            }

            Logger.info('[ChainCoordinator] Agent spawned async task', {
              agentName: agent.name,
              taskId: task.taskId,
              blockId: task.blockId
            });
          }
        }

        // Update context with agent results
        context = this.mergeAgentResults(context, agent.name, result);

        Logger.info('[ChainCoordinator] Agent completed', {
          agentName: agent.name,
          hasResults: !!result
        });

      } catch (error) {
        Logger.error('[ChainCoordinator] Agent execution failed', error as Error, {
          agentName: agent.name
        });

        // Decide whether to continue or fail the chain
        // For now, we continue with other agents
        context.workflow.last_updated_at = new Date().toISOString();
      }
    }

    Logger.info('[ChainCoordinator] Chain execution complete', {
      agentCount: this.agents.length,
      spawnedTaskCount: spawnedTasks.length
    });

    return {
      context,
      spawnedTasks
    };
  }

  /**
   * Spawn async research task for a block
   * This can be called by any agent during execution
   */
  async spawnResearchTask(params: {
    blockId: string;
    blockTitle: string;
    query: string;
    processor: ResearchProcessor;
    researchType: 'university' | 'career' | 'skills' | 'timeline' | 'quick';
  }): Promise<{ taskId: string; estimatedTime: number }> {
    Logger.info('[ChainCoordinator] Spawning research task', {
      blockId: params.blockId,
      researchType: params.researchType,
      processor: params.processor
    });

    const task = await parallelMCPService.createResearchTask(params);

    Logger.info('[ChainCoordinator] Research task spawned', {
      taskId: task.taskId,
      blockId: params.blockId,
      estimatedTime: task.estimatedTime
    });

    return task;
  }

  /**
   * Merge agent results into context
   */
  private mergeAgentResults(
    context: AgentContext,
    agentName: string,
    results: any
  ): AgentContext {
    // Update workflow timestamp
    context.workflow.last_updated_at = new Date().toISOString();

    // Store agent-specific results in attention mechanism
    switch (agentName) {
      case 'PreValidationAgent':
        if (!context.attention) {
          context.attention = {};
        }
        context.attention.validation_agent = {
          confidence_score: results.confidence_score || 0,
          missing_information_categories: results.missing_information_categories || [],
          critical_constraints: results.critical_constraints || [],
          focus_areas: results.focus_areas || []
        };
        break;

      case 'ConversationalClarificationAgent':
        if (!context.attention) {
          context.attention = {};
        }
        context.attention.conversational_agent = {
          confidence_score: results.confidence_score || 0,
          clarified_intent: results.clarified_intent || '',
          key_requirements: results.key_requirements || [],
          user_preferences: results.user_preferences || {}
        };
        break;

      case 'InternalReviewAgent':
        if (!context.attention) {
          context.attention = {};
        }
        context.attention.internal_agent = {
          confidence_score: results.confidence_score || 0,
          detected_changes: results.detected_changes || [],
          blocks_requiring_attention: results.blocks_requiring_attention || [],
          research_priorities: results.research_priorities || []
        };
        break;

      case 'ConfigurationAgent':
        if (!context.attention) {
          context.attention = {};
        }
        context.attention.configuration_agent = {
          confidence_score: results.confidence_score || 0,
          generated_structure: results.generated_structure || '',
          challenging_blocks: results.challenging_blocks || [],
          assumptions_made: results.assumptions_made || []
        };
        break;
    }

    return context;
  }

  /**
   * Get number of registered agents
   */
  getAgentCount(): number {
    return this.agents.length;
  }

  /**
   * Clear all registered agents
   */
  clear(): void {
    this.agents = [];
    Logger.info('[ChainCoordinator] All agents cleared');
  }
}

// Singleton instance for default coordinator
const defaultChainCoordinator = new ChainCoordinator();

export default defaultChainCoordinator;
