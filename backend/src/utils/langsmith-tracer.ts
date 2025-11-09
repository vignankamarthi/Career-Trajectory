import dotenv from 'dotenv';
import path from 'path';
// Load environment variables from .env file in project root
// Resolves from working directory (backend/) up to project root: backend/ -> project-root/.env
dotenv.config({ path: path.join(process.cwd(), '../.env') });

import { traceable, getCurrentRunTree } from 'langsmith/traceable';

/**
 * LangSmith Tracing Wrapper
 *
 * Wraps all agent calls with LangSmith tracing for observability
 * Automatically logs to LangSmith when LANGCHAIN_TRACING_V2=true
 *
 * Uses the lightweight traceable decorator instead of full LangChain integration
 * This allows us to keep using the existing Anthropic SDK while getting traces
 */

/**
 * Configuration Agent with LangSmith tracing
 */
export const tracedConfigurationAgent = traceable(
  async function generateTimeline(
    userConfig: any,
    anthropicFn: () => Promise<any>
  ) {
    const result = await anthropicFn();

    // Format usage for LangSmith - use OpenAI-compatible format
    if (result.usage) {
      const inputTokens = result.usage.input_tokens || result.usage.inputTokens;
      const outputTokens = result.usage.output_tokens || result.usage.outputTokens;

      // Return data with OpenAI-compatible usage format that LangSmith expects
      return {
        ...result,
        usage: {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
          total_tokens: inputTokens + outputTokens
        }
      };
    }

    return result;
  },
  {
    name: 'ConfigurationAgent.generateTimeline',
    run_type: 'llm',
    metadata: { agent: 'ConfigurationAgent' },
  }
);

/**
 * Conversational Assistant with LangSmith tracing
 */
export const tracedConversationalAssistant = traceable(
  async function chat(
    timelineId: string,
    messageCount: number,
    anthropicFn: () => Promise<any>
  ) {
    const result = await anthropicFn();

    // Format usage for LangSmith - use OpenAI-compatible format
    if (result.usage) {
      const inputTokens = result.usage.input_tokens || result.usage.inputTokens;
      const outputTokens = result.usage.output_tokens || result.usage.outputTokens;

      // Return data with OpenAI-compatible usage format that LangSmith expects
      return {
        ...result,
        usage: {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
          total_tokens: inputTokens + outputTokens
        }
      };
    }

    return result;
  },
  {
    name: 'ConversationalAssistant.chat',
    run_type: 'llm',
    metadata: { agent: 'ConversationalAssistant' },
  }
);

/**
 * Internal Agent with LangSmith tracing
 */
export const tracedInternalAgent = traceable(
  async function internalOperation(
    operation: string,
    timelineId: string,
    anthropicFn: () => Promise<any>
  ) {
    return await anthropicFn();
  },
  {
    name: 'InternalAgent.operation',
    metadata: { agent: 'InternalAgent' },
  }
);

/**
 * Parallel AI Research with LangSmith tracing
 */
export const tracedParallelResearch = traceable(
  async function researchBlock(
    blockId: string,
    blockTitle: string,
    researchFn: () => Promise<any>
  ) {
    return await researchFn();
  },
  {
    name: 'ParallelResearch.researchBlock',
    metadata: { service: 'ParallelAI' },
  }
);

/**
 * Pre-Validation Agent with LangSmith tracing
 */
export const tracedPreValidationAgent = traceable(
  async function analyzeInitialInput(
    context: any,
    anthropicFn: () => Promise<any>
  ) {
    const result = await anthropicFn();

    // Format usage for LangSmith - use OpenAI-compatible format
    if (result.usage) {
      const inputTokens = result.usage.input_tokens || result.usage.inputTokens;
      const outputTokens = result.usage.output_tokens || result.usage.outputTokens;

      // Return data with OpenAI-compatible usage format that LangSmith expects
      return {
        ...result,
        usage: {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
          total_tokens: inputTokens + outputTokens
        }
      };
    }

    return result;
  },
  {
    name: 'PreValidationAgent.analyzeInitialInput',
    run_type: 'llm',
    metadata: { agent: 'PreValidationAgent' },
  }
);

/**
 * Conversational Clarification Agent with LangSmith tracing
 */
export const tracedConversationalClarificationAgent = traceable(
  async function gatherClarifications(
    context: any,
    anthropicFn: () => Promise<any>
  ): Promise<any> {
    const result = await anthropicFn();

    // Format usage for LangSmith - use OpenAI-compatible format
    if (result.usage) {
      const inputTokens = result.usage.input_tokens || result.usage.inputTokens;
      const outputTokens = result.usage.output_tokens || result.usage.outputTokens;

      // Return data with OpenAI-compatible usage format that LangSmith expects
      return {
        ...result,
        usage: {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
          total_tokens: inputTokens + outputTokens
        }
      };
    }

    return result;
  },
  {
    name: 'ConversationalClarificationAgent.gatherClarifications',
    run_type: 'llm',
    metadata: { agent: 'ConversationalClarificationAgent' },
  }
);

/**
 * Internal Review Agent with LangSmith tracing
 */
export const tracedInternalReviewAgent = traceable(
  async function reviewBeforeGeneration(
    context: any,
    anthropicFn: () => Promise<any>
  ) {
    return await anthropicFn();
  },
  {
    name: 'InternalReviewAgent.reviewBeforeGeneration',
    metadata: { agent: 'InternalReviewAgent' },
  }
);

/**
 * Validation Agent with LangSmith tracing
 */
export const tracedValidationAgent = traceable(
  async function validateAndCorrect(
    input: any,
    anthropicFn: () => Promise<any>
  ) {
    const result = await anthropicFn();

    // Format usage for LangSmith - use OpenAI-compatible format
    if (result.usage) {
      const inputTokens = result.usage.input_tokens || result.usage.inputTokens;
      const outputTokens = result.usage.output_tokens || result.usage.outputTokens;

      // Return data with OpenAI-compatible usage format that LangSmith expects
      return {
        ...result,
        usage: {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
          total_tokens: inputTokens + outputTokens
        }
      };
    }

    return result;
  },
  {
    name: 'ValidationAgent.validateAndCorrect',
    run_type: 'llm',
    metadata: { agent: 'ValidationAgent' },
  }
);

export default {
  tracedPreValidationAgent,
  tracedConversationalClarificationAgent,
  tracedInternalReviewAgent,
  tracedConfigurationAgent,
  tracedConversationalAssistant,
  tracedInternalAgent,
  tracedParallelResearch,
  tracedValidationAgent,
};
