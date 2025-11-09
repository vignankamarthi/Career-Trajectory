import { traceable } from 'langsmith/traceable';
import { analyzeInitialInput } from '../agents/pre-validation-agent';
import { gatherClarifications } from '../agents/conversational-clarification-agent';
import { generateWithContext } from '../agents/configuration-agent';
import Logger from '../utils/logger';

/**
 * Hierarchical LangSmith Tracing Service
 *
 * Wraps the entire timeline generation workflow in a single trace
 * with each agent step as a child span. This gives us:
 * - One trace for entire workflow
 * - Step-by-step agent progression
 * - Proper error attribution
 * - Total cost/time tracking
 */

/**
 * Main Timeline Generation Workflow
 * Creates ONE parent trace with all agents as child spans
 */
export const timelineGenerationWorkflow: (
  context: any,
  confidence_threshold?: number
) => Promise<any> = traceable(
  async (context: any, confidence_threshold: number = 90) => {
    Logger.info('Starting timeline generation workflow', {
      context_id: context.workflow?.context_id,
      confidence_threshold,
    });

    // Note: Pre-validation was already done in the init endpoint
    // This workflow focuses on the generation phase

    // Step 1: Timeline Generation (child span)
    const configResult = await wrappedConfigurationAgent(context, confidence_threshold);

    return configResult;
  },
  {
    name: 'Timeline Generation Workflow',
    run_type: 'chain',
    tags: ['timeline', 'multi-agent', 'career-planning'],
  }
);

/**
 * Wrapped Validation Agent
 * Creates child span for validation step
 */
const wrappedValidationAgent = traceable(
  async (context: any) => {
    Logger.info('Running validation agent');
    return await analyzeInitialInput(context);
  },
  {
    name: 'ValidationAgent.analyzeInitialInput',
    run_type: 'chain',
    tags: ['validation', 'pre-processing'],
  }
);

/**
 * Wrapped Clarification Agent
 * Creates child span for clarification step
 */
const wrappedClarificationAgent: (
  context: any,
  clarificationQuestions: any
) => Promise<any> = traceable(
  async (context: any, clarificationQuestions: any) => {
    Logger.info('Running clarification agent');
    return await gatherClarifications(context, clarificationQuestions);
  },
  {
    name: 'ClarificationAgent.gatherClarifications',
    run_type: 'chain',
    tags: ['clarification', 'conversation'],
  }
);

/**
 * Wrapped Configuration Agent
 * Creates child span for timeline generation step
 */
const wrappedConfigurationAgent = traceable(
  async (context: any, confidence_threshold: number) => {
    Logger.info('Running configuration agent');
    return await generateWithContext(context, confidence_threshold);
  },
  {
    name: 'ConfigurationAgent.generateWithContext',
    run_type: 'llm',
    tags: ['generation', 'timeline', 'configuration'],
  }
);

export {
  wrappedValidationAgent,
  wrappedClarificationAgent,
  wrappedConfigurationAgent,
};