import { sendMessageJSON } from '../services/anthropic';
import { researchBlock } from '../services/parallel';
import { query, queryOne } from '../database/db';
import Logger from '../utils/logger';
import { tracedInternalAgent, tracedParallelResearch, tracedInternalReviewAgent } from '../utils/langsmith-tracer';
import {
  AgentContext,
  InternalResult,
  InternalAttention,
} from '../types/agent-context';

/**
 * Internal Agent (LLM Role 3)
 *
 * Purpose: State analysis + research integration + pre-generation quality gate
 *
 * Capabilities:
 * - Compare old vs new timeline state
 * - Identify blocks requiring research
 * - Execute research via Parallel AI
 * - Synthesize research into recommendations
 * - Validate timeline coherence
 * - Pre-generation validation (95% confidence threshold)
 * - Edit request analysis
 *
 * Used by: Refactor save mode + Initial generation workflow + Conversational editing
 */

interface TimelineSnapshot {
  timeline: any;
  layers: any[];
  blocks: any[];
}

interface BlockChange {
  blockId: string;
  blockTitle: string;
  changeType: 'added' | 'modified' | 'removed';
  needsResearch: boolean;
  reason?: string;
}

interface ResearchResult {
  blockId: string;
  blockTitle: string;
  researchData: any;
  cost: number;
}

interface AnalysisResult {
  changes: BlockChange[];
  blocksNeedingResearch: string[];
  recommendations: string[];
  totalResearchCost: number;
  researchResults: ResearchResult[];
  anthropicCost: number;
  parallelCost: number;
}

/**
 * Fetch current timeline snapshot
 */
export async function getTimelineSnapshot(timelineId: string): Promise<TimelineSnapshot> {
  Logger.entry('getTimelineSnapshot', { timelineId });

  const timeline = queryOne('SELECT * FROM timelines WHERE id = ?', [timelineId]);
  if (!timeline) {
    throw new Error('Timeline not found');
  }

  const layers = query(
    'SELECT * FROM layers WHERE timeline_id = ? ORDER BY layer_number',
    [timelineId]
  );

  const blocks: any[] = [];
  for (const layer of layers) {
    const layerBlocks = query(
      'SELECT * FROM blocks WHERE layer_id = ? ORDER BY position',
      [layer.id]
    );
    blocks.push(...layerBlocks);
  }

  Logger.exit('getTimelineSnapshot', {
    layers: layers.length,
    blocks: blocks.length,
  });

  return { timeline, layers, blocks };
}

/**
 * Compare two timeline states and identify changes
 */
export async function analyzeStateChanges(
  oldState: TimelineSnapshot,
  newState: TimelineSnapshot
): Promise<{ changes: BlockChange[]; cost: number }> {
  Logger.entry('analyzeStateChanges', {
    oldBlocks: oldState.blocks.length,
    newBlocks: newState.blocks.length,
  });

  try {
    // Use Anthropic JSON mode to analyze changes
    const systemPrompt = `You are analyzing changes to a career timeline to identify blocks that need research.

OLD STATE BLOCKS:
${oldState.blocks.map((b: any) => `- ${b.id}: ${b.title} (Age ${b.start_age}-${b.end_age})`).join('\n')}

NEW STATE BLOCKS:
${newState.blocks.map((b: any) => `- ${b.id}: ${b.title} (Age ${b.start_age}-${b.end_age})`).join('\n')}

Identify:
1. New blocks (added)
2. Modified blocks (title, age range, or description changed significantly)
3. Removed blocks

For each change, determine if research is needed (e.g., new blocks always need research, modified blocks may need updated research).`;

    const userPrompt = 'Analyze the state changes and identify which blocks need research.';

    const schema = {
      name: 'analyze_changes',
      description: 'Analyzes timeline state changes and identifies research needs',
      schema: {
        type: 'object',
        properties: {
          changes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                blockId: { type: 'string' },
                blockTitle: { type: 'string' },
                changeType: { type: 'string', enum: ['added', 'modified', 'removed'] },
                needsResearch: { type: 'boolean' },
                reason: { type: 'string' },
              },
              required: ['blockId', 'blockTitle', 'changeType', 'needsResearch'],
            },
          },
        },
        required: ['changes'],
      },
    };

    // Call traced Internal Agent with LangSmith tracing
    const response = await tracedInternalAgent(
      'analyzeStateChanges',
      oldState.timeline.id,
      async () => {
        return await sendMessageJSON<{ changes: BlockChange[] }>(
          [{ role: 'user', content: userPrompt }],
          schema,
          { system: systemPrompt, maxTokens: 2048 }
        );
      }
    );

    Logger.info('State changes analyzed', {
      changesCount: response.data.changes.length,
      cost: response.cost,
    });

    Logger.exit('analyzeStateChanges', {
      changes: response.data.changes.length,
    });

    return { changes: response.data.changes, cost: response.cost };
  } catch (error) {
    Logger.error('State change analysis failed', error as Error);
    throw error;
  }
}

/**
 * Research blocks that need it
 */
export async function researchBlocks(
  blocks: any[],
  blockIds: string[],
  timeline: any,
  processor: 'base' | 'pro' = 'pro'
): Promise<ResearchResult[]> {
  Logger.entry('researchBlocks', {
    totalBlocks: blocks.length,
    researchCount: blockIds.length,
    processor,
  });

  const results: ResearchResult[] = [];

  for (const blockId of blockIds) {
    const block = blocks.find((b: any) => b.id === blockId);
    if (!block) {
      Logger.warn('Block not found for research', { blockId });
      continue;
    }

    try {
      // Execute traced research via Parallel AI with LangSmith tracing
      const researchData = await tracedParallelResearch(
        block.id,
        block.title,
        async () => {
          return await researchBlock({
            blockTitle: block.title,
            blockDescription: block.description || '',
            startAge: block.start_age,
            endAge: block.end_age,
            overallGoal: timeline.end_goal,
            processor,
          });
        }
      );

      results.push({
        blockId: block.id,
        blockTitle: block.title,
        researchData,
        cost: researchData.cost,
      });

      Logger.info('Block researched', {
        blockId: block.id,
        blockTitle: block.title,
        cost: researchData.cost,
      });
    } catch (error) {
      Logger.error('Block research failed', error as Error, {
        blockId: block.id,
        blockTitle: block.title,
      });
      // Continue with other blocks even if one fails
    }
  }

  Logger.exit('researchBlocks', { resultsCount: results.length });

  return results;
}

/**
 * Synthesize research into actionable recommendations
 */
export async function synthesizeRecommendations(
  timeline: any,
  blocks: any[],
  researchResults: ResearchResult[]
): Promise<{ recommendations: string[]; cost: number }> {
  Logger.entry('synthesizeRecommendations', {
    timelineId: timeline.id,
    researchCount: researchResults.length,
  });

  try {
    // Build research summary
    const researchSummary = researchResults
      .map(
        (r: ResearchResult) =>
          `Block: ${r.blockTitle}\nResearch findings: ${JSON.stringify(r.researchData.results.slice(0, 3))}`
      )
      .join('\n\n');

    const systemPrompt = `You are synthesizing research findings into actionable career planning recommendations.

TIMELINE GOAL: ${timeline.end_goal}
USER: ${timeline.user_name}

RESEARCH FINDINGS:
${researchSummary}

Generate specific, actionable recommendations based on the research. Focus on:
1. Skills to develop
2. Resources to use
3. Milestones to achieve
4. Common pitfalls to avoid
5. Timeline adjustments if needed`;

    const userPrompt = 'Synthesize the research into 3-5 clear, actionable recommendations.';

    const schema = {
      name: 'synthesize_recommendations',
      description: 'Synthesizes research into recommendations',
      schema: {
        type: 'object',
        properties: {
          recommendations: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of actionable recommendations',
          },
        },
        required: ['recommendations'],
      },
    };

    // Call traced Internal Agent with LangSmith tracing
    const response = await tracedInternalAgent(
      'synthesizeRecommendations',
      timeline.id,
      async () => {
        return await sendMessageJSON<{ recommendations: string[] }>(
          [{ role: 'user', content: userPrompt }],
          schema,
          { system: systemPrompt, maxTokens: 2048 }
        );
      }
    );

    Logger.info('Recommendations synthesized', {
      count: response.data.recommendations.length,
      cost: response.cost,
    });

    Logger.exit('synthesizeRecommendations', {
      recommendationsCount: response.data.recommendations.length,
    });

    return { recommendations: response.data.recommendations, cost: response.cost };
  } catch (error) {
    Logger.error('Recommendation synthesis failed', error as Error);
    throw error;
  }
}

/**
 * Full analysis pipeline: compare states, research, and recommend
 */
export async function analyzeAndResearch(
  timelineId: string,
  oldStateSnapshot: string,
  processor: 'base' | 'pro' = 'pro'
): Promise<AnalysisResult> {
  Logger.entry('analyzeAndResearch', { timelineId, processor });

  try {
    // Parse old state
    const oldState: TimelineSnapshot = JSON.parse(oldStateSnapshot);

    // Get current state
    const newState = await getTimelineSnapshot(timelineId);

    // Analyze changes (Anthropic cost)
    const { changes, cost: analysisCost } = await analyzeStateChanges(oldState, newState);

    // Identify blocks needing research
    const blocksNeedingResearch = changes
      .filter((c: BlockChange) => c.needsResearch && c.changeType !== 'removed')
      .map((c: BlockChange) => c.blockId);

    Logger.info('Blocks identified for research', {
      count: blocksNeedingResearch.length,
    });

    // Research blocks (Parallel cost)
    const researchResults =
      blocksNeedingResearch.length > 0
        ? await researchBlocks(
            newState.blocks,
            blocksNeedingResearch,
            newState.timeline,
            processor
          )
        : [];

    // Calculate parallel research cost
    const parallelCost = researchResults.reduce((sum, r) => sum + r.cost, 0);

    // Synthesize recommendations (Anthropic cost)
    const { recommendations, cost: synthesisCost } =
      researchResults.length > 0
        ? await synthesizeRecommendations(newState.timeline, newState.blocks, researchResults)
        : { recommendations: ['No significant changes detected. Timeline looks good!'], cost: 0 };

    // Calculate total Anthropic cost
    const anthropicCost = analysisCost + synthesisCost;

    Logger.info('Analysis complete', {
      timelineId,
      changesCount: changes.length,
      researchCount: researchResults.length,
      anthropicCost,
      parallelCost,
      totalCost: anthropicCost + parallelCost,
    });

    Logger.exit('analyzeAndResearch', {
      anthropicCost,
      parallelCost,
      totalCost: anthropicCost + parallelCost,
    });

    return {
      changes,
      blocksNeedingResearch,
      recommendations,
      totalResearchCost: parallelCost, // Keep for backward compatibility
      researchResults,
      anthropicCost,
      parallelCost,
    };
  } catch (error) {
    Logger.error('Analysis and research failed', error as Error, {
      timelineId,
    });
    throw error;
  }
}

/**
 * Reviews all agent context and determines if ready for expensive operations.
 *
 * CRITICAL RULE: Must be AT LEAST 95% confident before allowing expensive
 * operations (research, timeline generation).
 *
 * This is used in the PRE-GENERATION workflow as the final gate before Configuration Agent.
 *
 * @param context - Complete agent context with all attention fields
 * @returns Internal result with confidence and research determination
 */
export async function reviewBeforeGeneration(
  context: AgentContext
): Promise<InternalResult> {
  Logger.entry('reviewBeforeGeneration', {
    validation_confidence: context.attention.validation_agent?.confidence_score,
    conversational_confidence: context.attention.conversational_agent?.confidence_score,
  });

  const systemPrompt = `You are an internal quality assurance agent. Your job is to review all gathered information and determine if we are ready for expensive operations (research, timeline generation).

CRITICAL ASSUMPTION POLICY - EXTRA CONSERVATIVE:

DEFAULT: ASK FOR CLARIFICATION. Do NOT make assumptions.

If you notice ANY gaps or assumptions in the gathered information, you must:
1. Flag them as missing information
2. Set confidence < 95%
3. Recommend gathering more details

Do NOT assume:
- User preferences that weren't explicitly stated
- "Typical" patterns or timelines
- Context-based inferences
- Any person-specific details

---

CONFIDENCE THRESHOLD: You must be AT LEAST 95% confident that:
1. We have enough information to generate a high-quality timeline
2. The user's intent is clear and specific
3. There are no significant gaps or ambiguities
4. The clarified requirements are actionable

YOUR TASKS:
1. Review ALL attention fields from Validation and Conversational agents
2. Verify that user's intent is crystal clear
3. Check if any information is still missing or ambiguous
4. Determine if we need expensive research (Parallel AI queries)
5. If research needed: Generate specific, targeted research queries

RESEARCH DETERMINATION:
- Research is EXPENSIVE ($0.005-$2.40 per query depending on tier)
- Only recommend research if:
  * User's goal involves specific programs/schools/opportunities
  * We need to validate feasibility of timeline
  * Current information is too general to create quality timeline
  * We need specific requirements or prerequisites

- Generate research queries that are:
  * Specific and targeted
  * Actionable (will return useful results)
  * Relevant to user's clarified intent
  * Worth the cost

CRITICAL: Only set is_confident = true when:
- Validation Agent confidence >= 95%
- Conversational Agent confidence >= 95%
- User's intent is clear and specific
- No significant information gaps remain
- You have 95%+ confidence we can generate high-quality timeline`;

  const userPrompt = `Review the following context and determine if we are ready for expensive operations.

USER GOAL: ${context.user_config.end_goal}
AGE RANGE: ${context.user_config.start_age} to ${context.user_config.end_age}
TIMELINE DURATION: ${context.user_config.end_age - context.user_config.start_age} years
LAYERS: ${context.user_config.num_layers}

VALIDATION AGENT ANALYSIS:
- Confidence: ${context.attention.validation_agent?.confidence_score || 0}%
- Missing Categories: ${context.attention.validation_agent?.missing_information_categories.join(', ') || 'None'}
- Critical Constraints: ${context.attention.validation_agent?.critical_constraints.join(', ') || 'None'}
- Focus Areas: ${context.attention.validation_agent?.focus_areas.join(', ') || 'None'}

CONVERSATIONAL AGENT ANALYSIS:
- Confidence: ${context.attention.conversational_agent?.confidence_score || 0}%
- Clarified Intent: ${context.attention.conversational_agent?.clarified_intent || 'N/A'}
- Key Requirements: ${context.attention.conversational_agent?.key_requirements.join(', ') || 'None'}
- User Preferences: ${JSON.stringify(context.attention.conversational_agent?.user_preferences || {})}

CONVERSATION HISTORY:
${
  context.conversation_history
    ?.map((m) => `${m.role}: ${m.content}`)
    .join('\n')
    .substring(0, 2000) || 'None'
}

TASK:
1. Review ALL information gathered
2. Determine overall confidence (0-100)
3. Set is_confident = true ONLY if >= 95% confident
4. Determine if expensive research is needed
5. If research needed: Generate specific research queries
6. Identify any blocks that will require special attention

Return:
1. Confidence score (0-100)
2. Is_confident (true only if >= 95%)
3. Should_research (true if expensive Parallel AI research recommended)
4. Research queries (if should_research = true)
5. Blocks requiring attention (areas that will be challenging to generate)`;

  const schema = {
    name: 'review_before_generation',
    description: 'Reviews context and determines readiness for expensive operations',
    schema: {
      type: 'object',
      properties: {
        confidence_score: {
          type: 'number',
          description:
            'Overall confidence score (0-100) that we can generate high-quality timeline',
        },
        analysis: {
          type: 'string',
          description: 'Detailed analysis of readiness and any remaining gaps',
        },
        is_confident: {
          type: 'boolean',
          description:
            'Set to true ONLY if confidence >= 95% and ready for expensive operations',
        },
        should_research: {
          type: 'boolean',
          description:
            'Should we perform expensive Parallel AI research before generation?',
        },
        research_queries: {
          type: 'array',
          description:
            'Specific research queries for Parallel AI (if should_research = true)',
          items: { type: 'string' },
        },
        blocks_requiring_attention: {
          type: 'array',
          description:
            'Areas that will be challenging to generate and need special focus',
          items: { type: 'string' },
        },
        detected_changes: {
          type: 'array',
          description: 'For conversational edits: what changes were detected',
          items: { type: 'string' },
        },
      },
      required: [
        'confidence_score',
        'analysis',
        'is_confident',
        'should_research',
        'blocks_requiring_attention',
      ],
    },
  };

  try {
    const response = await tracedInternalReviewAgent(
      context,
      async () => {
        return await sendMessageJSON<{
          confidence_score: number;
          analysis: string;
          is_confident: boolean;
          should_research: boolean;
          research_queries?: string[];
          blocks_requiring_attention: string[];
          detected_changes?: string[];
        }>(
          [{ role: 'user', content: userPrompt }],
          schema,
          {
            system: systemPrompt,
            maxTokens: 4096,
          }
        );
      }
    );

    const {
      confidence_score,
      analysis,
      is_confident,
      should_research,
      research_queries,
      blocks_requiring_attention,
      detected_changes,
    } = response.data;

    Logger.info('Internal agent review complete', {
      confidence_score,
      is_confident,
      should_research,
      research_count: research_queries?.length || 0,
      cost: response.cost,
    });

    // Build attention object
    const attention: InternalAttention = {
      confidence_score,
      detected_changes: detected_changes || [],
      blocks_requiring_attention,
      research_priorities: research_queries || [],
    };

    return {
      is_confident,
      confidence_score,
      should_research,
      research_queries: should_research ? research_queries : undefined,
      attention,
    };
  } catch (error) {
    Logger.error('Internal agent review failed', error as Error);
    throw error;
  }
}

/**
 * Analyzes user's conversational edit request to determine what changes are needed.
 *
 * Used when user wants to modify existing timeline through chat.
 * This is used in the CONVERSATIONAL EDITING workflow.
 *
 * @param context - Agent context with existing timeline and conversation history
 * @returns Internal result with detected changes and confidence
 */
export async function analyzeEditRequest(
  context: AgentContext
): Promise<InternalResult> {
  Logger.entry('analyzeEditRequest', {
    timeline_id: context.timeline_id,
    conversation_length: context.conversation_history?.length || 0,
  });

  const lastUserMessage =
    context.conversation_history?.filter((m) => m.role === 'user').pop()?.content || '';

  const systemPrompt = `You are an internal agent analyzing user's edit requests to existing timelines.

YOUR TASKS:
1. Analyze user's edit request
2. Identify what specific changes are needed
3. Determine which blocks/layers are affected
4. Assess if expensive research is needed for the changes
5. Provide confidence score (0-100)

CRITICAL: Be AT LEAST 95% confident you understand the requested changes.
If unclear, set is_confident = false and recommend asking clarifying questions.

RESEARCH DETERMINATION:
- Only recommend research if changes involve:
  * New programs/schools/opportunities not in original timeline
  * Significant timeline restructuring requiring external validation
  * New requirements or prerequisites that need verification`;

  const userPrompt = `Analyze this edit request and determine what changes are needed.

USER'S EDIT REQUEST: "${lastUserMessage}"

CURRENT TIMELINE STRUCTURE:
${context.attention.configuration_agent?.generated_structure || 'Not yet generated'}

PREVIOUS CONTEXT:
${JSON.stringify(context.attention, null, 2).substring(0, 2000)}

TASK:
1. What specific changes is the user requesting?
2. Which blocks/layers are affected?
3. Do we need expensive research for these changes?
4. What's your confidence level (0-100) that you understand the request?

Return:
1. Detected changes (list of specific modifications needed)
2. Blocks requiring attention (which blocks to update)
3. Research priorities (if new information needed)
4. Confidence score
5. Is_confident (true only if >= 95%)`;

  const schema = {
    name: 'analyze_edit_request',
    description: 'Analyzes edit request and determines required changes',
    schema: {
      type: 'object',
      properties: {
        confidence_score: {
          type: 'number',
          description: 'Confidence score (0-100) that edit request is understood',
        },
        is_confident: {
          type: 'boolean',
          description: 'Set to true ONLY if confidence >= 95%',
        },
        detected_changes: {
          type: 'array',
          description: 'Specific changes detected from user request',
          items: { type: 'string' },
        },
        blocks_requiring_attention: {
          type: 'array',
          description: 'Which blocks/layers need to be modified',
          items: { type: 'string' },
        },
        should_research: {
          type: 'boolean',
          description: 'Should we perform expensive research for these changes?',
        },
        research_queries: {
          type: 'array',
          description: 'Research queries if should_research = true',
          items: { type: 'string' },
        },
      },
      required: [
        'confidence_score',
        'is_confident',
        'detected_changes',
        'blocks_requiring_attention',
        'should_research',
      ],
    },
  };

  try {
    const response = await tracedInternalReviewAgent(
      context,
      async () => {
        return await sendMessageJSON<{
          confidence_score: number;
          is_confident: boolean;
          detected_changes: string[];
          blocks_requiring_attention: string[];
          should_research: boolean;
          research_queries?: string[];
        }>(
          [{ role: 'user', content: userPrompt }],
          schema,
          {
            system: systemPrompt,
            maxTokens: 4096,
          }
        );
      }
    );

    const {
      confidence_score,
      is_confident,
      detected_changes,
      blocks_requiring_attention,
      should_research,
      research_queries,
    } = response.data;

    Logger.info('Internal agent edit analysis complete', {
      confidence_score,
      is_confident,
      changes_count: detected_changes.length,
      cost: response.cost,
    });

    // Build attention object
    const attention: InternalAttention = {
      confidence_score,
      detected_changes,
      blocks_requiring_attention,
      research_priorities: research_queries || [],
    };

    return {
      is_confident,
      confidence_score,
      should_research,
      research_queries: should_research ? research_queries : undefined,
      attention,
    };
  } catch (error) {
    Logger.error('Internal agent edit analysis failed', error as Error);
    throw error;
  }
}

export default {
  // Original refactor save mode functions
  getTimelineSnapshot,
  analyzeStateChanges,
  researchBlocks,
  synthesizeRecommendations,
  analyzeAndResearch,
  // New pre-generation and editing functions
  reviewBeforeGeneration,
  analyzeEditRequest,
};
