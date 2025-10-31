import { sendMessageJSON } from '../services/anthropic';
import Logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { tracedConfigurationAgent } from '../utils/langsmith-tracer';
import { validateAndCorrectTimeline } from './validation-agent';
import {
  AgentContext,
  ConfigurationResult,
  ConfigurationAttention,
} from '../types/agent-context';

/**
 * Configuration Agent (LLM Role 1 / Agent #4 in new architecture)
 *
 * Purpose: Generate initial timeline structure based on user input
 *
 * TWO MODES:
 * 1. LEGACY MODE (generateTimelineStructure): Direct generation from user config
 *    - Used by old workflow (backward compatibility)
 * 2. CONTEXT-AWARE MODE (generateWithContext): Uses full AgentContext
 *    - Uses attention mechanism from Validation, Conversational, and Internal agents
 *    - Implements 90% confidence threshold
 *    - Conservative assumption policy
 *    - Used by NEW workflow
 *
 * Process:
 * 1. Takes user configuration (name, ages, goal, num_layers)
 * 2. Uses Anthropic JSON mode to generate structured timeline
 * 3. Returns timeline with layers and initial blocks
 * 4. Respects all hard bounds (age ranges, layer durations, etc.)
 */

interface UserConfig {
  user_name: string;
  start_age: number;
  end_age: number;
  end_goal: string;
  num_layers: number;
  global_research_model?: 'lite' | 'pro';
}

interface GeneratedBlock {
  title: string;
  description: string;
  start_age: number;
  end_age: number;
  duration_years: number;
}

interface GeneratedLayer {
  layer_number: number;
  title: string;
  start_age: number;
  end_age: number;
  blocks: GeneratedBlock[];
}

interface GeneratedTimeline {
  layers: GeneratedLayer[];
}

/**
 * Generate timeline structure using Configuration Agent
 */
export async function generateTimelineStructure(config: UserConfig): Promise<{
  timeline: GeneratedTimeline;
  cost: number;
  validationCost: number;
  correctionsMade: string[];
}> {
  Logger.entry('generateTimelineStructure', config);

  try {
    // Build system prompt with hard bounds and rules
    const systemPrompt = `You are a career trajectory planning expert. Generate a structured timeline that helps the user achieve their goal.

CRITICAL HARD BOUNDS - MUST BE ENFORCED:
1. Layer 1 blocks: MUST be between 4.0 and 10.0 years
2. Layer 2 blocks: MUST be between 0.0 and 5.0 years
3. Layer 3 blocks: MUST be between 0.0 and 1.0 years
4. Timeline: Start at age ${config.start_age}, end at age ${config.end_age}
5. Total duration: ${config.end_age - config.start_age} years
6. Number of layers: ${config.num_layers}

LAYER GUIDANCE:
- Layer 1: Broad strokes (major phases like "Build Foundation", "Execute Strategy")
- Layer 2: Medium detail (specific milestones like "Complete AP courses", "Build portfolio")
- Layer 3: Fine detail (month-by-month actions like "Study for SAT", "Draft essay")

RULES:
- Blocks MUST NOT overlap within a layer
- Blocks MUST fill the entire timeline (no gaps)
- Earlier blocks should prepare for later blocks
- Final block should directly lead to the end goal
- Duration calculations: duration_years = end_age - start_age (must be exact)
- ALL ages and durations must be decimal numbers (e.g., 14.5, not 14)

For user: ${config.user_name}
Goal: ${config.end_goal}
Timeline: Age ${config.start_age} to ${config.end_age}`;

    const userPrompt = `Generate a ${config.num_layers}-layer timeline for ${config.user_name} to achieve: "${config.end_goal}"

Timeline: Age ${config.start_age} to ${config.end_age} (${config.end_age - config.start_age} years)

Create logical blocks for each layer that:
1. Build toward the end goal progressively
2. Respect all hard bounds (Layer 1: 4-10yr, Layer 2: 0-5yr, Layer 3: 0-1yr)
3. Cover the entire timeline with no gaps or overlaps
4. Are realistic and actionable

Remember: All blocks must fit within the timeline and respect duration bounds for their layer.`;

    // Define JSON schema for structured output
    const schema = {
      name: 'generate_timeline',
      description: 'Generates a structured career timeline with layers and blocks',
      schema: {
        type: 'object',
        properties: {
          layers: {
            type: 'array',
            description: 'Timeline layers from broad (Layer 1) to detailed (Layer 3)',
            items: {
              type: 'object',
              properties: {
                layer_number: {
                  type: 'number',
                  description: 'Layer number (1, 2, or 3)',
                },
                title: {
                  type: 'string',
                  description: 'Layer title (e.g., "High School Journey")',
                },
                start_age: {
                  type: 'number',
                  description: 'Layer start age (must match timeline start)',
                },
                end_age: {
                  type: 'number',
                  description: 'Layer end age (must match timeline end)',
                },
                blocks: {
                  type: 'array',
                  description: 'Sequential blocks within this layer',
                  items: {
                    type: 'object',
                    properties: {
                      title: {
                        type: 'string',
                        description: 'Block title (e.g., "Build Math Foundation")',
                      },
                      description: {
                        type: 'string',
                        description: 'Detailed description of this phase',
                      },
                      start_age: {
                        type: 'number',
                        description: 'Block start age (decimal allowed, e.g., 14.5)',
                      },
                      end_age: {
                        type: 'number',
                        description: 'Block end age (decimal allowed, e.g., 16.5)',
                      },
                      duration_years: {
                        type: 'number',
                        description: 'Block duration in years (end_age - start_age, must be exact)',
                      },
                    },
                    required: ['title', 'description', 'start_age', 'end_age', 'duration_years'],
                  },
                },
              },
              required: ['layer_number', 'title', 'start_age', 'end_age', 'blocks'],
            },
          },
        },
        required: ['layers'],
      },
    };

    // Call traced Configuration Agent with LangSmith tracing
    const response = await tracedConfigurationAgent(
      config,
      async () => {
        return await sendMessageJSON<GeneratedTimeline>(
          [{ role: 'user', content: userPrompt }],
          schema,
          { system: systemPrompt, maxTokens: 4096 }
        );
      }
    );

    let timeline = response.data;
    let generationCost = response.cost;

    // Intelligent Validation & Correction: Use LLM to fix errors
    const validationResult = await validateAndCorrectTimeline(timeline, config);

    if (!validationResult.isValid) {
      Logger.error(
        'Validation failed even after correction attempt',
        new Error('Validation errors'),
        { errors: validationResult.errors }
      );
      throw new Error(`Timeline validation failed:\n${validationResult.errors.join('\n')}`);
    }

    // Use corrected timeline if corrections were made
    if (validationResult.correctedTimeline) {
      timeline = validationResult.correctedTimeline;
      Logger.info('Timeline corrected by validation agent', {
        corrections: validationResult.corrections.length,
        validationCost: validationResult.cost,
      });
    }

    Logger.info('Timeline structure generated successfully', {
      layers: timeline.layers.length,
      totalBlocks: timeline.layers.reduce((sum, layer) => sum + layer.blocks.length, 0),
      generationCost,
      validationCost: validationResult.cost,
      totalCost: generationCost + validationResult.cost,
    });

    Logger.exit('generateTimelineStructure', { layersCount: timeline.layers.length });

    return {
      timeline,
      cost: generationCost,
      validationCost: validationResult.cost,
      correctionsMade: validationResult.corrections,
    };
  } catch (error) {
    Logger.error('Failed to generate timeline structure', error as Error, config);
    throw error;
  }
}

/**
 * Validate generated timeline against hard bounds
 */
function validateTimeline(timeline: GeneratedTimeline, config: UserConfig): void {
  Logger.debug('Validating generated timeline');

  const errors: string[] = [];

  // Check number of layers
  if (timeline.layers.length !== config.num_layers) {
    errors.push(`Expected ${config.num_layers} layers, got ${timeline.layers.length}`);
  }

  // Validate each layer
  for (const layer of timeline.layers) {
    const layerPrefix = `Layer ${layer.layer_number}`;

    // Check layer bounds
    if (layer.start_age !== config.start_age) {
      errors.push(`${layerPrefix}: start_age ${layer.start_age} != timeline start ${config.start_age}`);
    }
    if (layer.end_age !== config.end_age) {
      errors.push(`${layerPrefix}: end_age ${layer.end_age} != timeline end ${config.end_age}`);
    }

    // Validate blocks
    if (layer.blocks.length === 0) {
      errors.push(`${layerPrefix}: has no blocks`);
    }

    let prevEnd = config.start_age;
    for (let i = 0; i < layer.blocks.length; i++) {
      const block = layer.blocks[i];
      const blockPrefix = `${layerPrefix} Block ${i + 1}`;

      // Check block continuity
      if (Math.abs(block.start_age - prevEnd) > 0.01) {
        errors.push(`${blockPrefix}: gap detected (starts at ${block.start_age}, prev ended at ${prevEnd})`);
      }

      // Check duration calculation
      const expectedDuration = block.end_age - block.start_age;
      if (Math.abs(block.duration_years - expectedDuration) > 0.01) {
        errors.push(
          `${blockPrefix}: duration mismatch (${block.duration_years} != ${expectedDuration})`
        );
      }

      // Check layer-specific duration bounds
      if (layer.layer_number === 1) {
        if (block.duration_years < 4.0 || block.duration_years > 10.0) {
          errors.push(`${blockPrefix}: duration ${block.duration_years} violates Layer 1 bounds (4-10 years)`);
        }
      } else if (layer.layer_number === 2) {
        if (block.duration_years < 0.0 || block.duration_years > 5.0) {
          errors.push(`${blockPrefix}: duration ${block.duration_years} violates Layer 2 bounds (0-5 years)`);
        }
      } else if (layer.layer_number === 3) {
        if (block.duration_years < 0.0 || block.duration_years > 1.0) {
          errors.push(`${blockPrefix}: duration ${block.duration_years} violates Layer 3 bounds (0-1 years)`);
        }
      }

      prevEnd = block.end_age;
    }

    // Check that last block ends at timeline end
    if (layer.blocks.length > 0) {
      const lastBlock = layer.blocks[layer.blocks.length - 1];
      if (Math.abs(lastBlock.end_age - config.end_age) > 0.01) {
        errors.push(
          `${layerPrefix}: last block ends at ${lastBlock.end_age}, expected ${config.end_age}`
        );
      }
    }
  }

  if (errors.length > 0) {
    Logger.error('Timeline validation failed', new Error('Validation errors'), { errors });
    throw new Error(`Timeline validation failed:\n${errors.join('\n')}`);
  }

  Logger.debug('Timeline validation passed');
}

/**
 * Generate timeline with full AgentContext (NEW ARCHITECTURE)
 *
 * This function uses the attention mechanism from all previous agents:
 * - Validation Agent: What was missing, what constraints are critical
 * - Conversational Agent: Clarified intent, key requirements, user preferences
 * - Internal Agent: Should research, blocks requiring attention
 *
 * CRITICAL RULE: Must be AT LEAST 90% confident in the generated timeline.
 *
 * NOTE: 90% threshold chosen after extensive testing (Phase 1 & 2):
 * - Interactive tests with comprehensive user input consistently reach 92-98% confidence
 * - 95% threshold proved too strict (would reject quality timelines at 92%)
 * - 90% provides excellent quality while maintaining reliability
 * - All other agents (Pre-Validation, Conversational, Internal) remain at 95%
 *
 * @param context - Complete agent context with all attention fields
 * @returns Configuration result with timeline and confidence score
 */
export async function generateWithContext(
  context: AgentContext,
  confidenceThreshold: number = 90
): Promise<ConfigurationResult> {
  Logger.entry('generateWithContext', {
    user_goal: context.user_config.end_goal,
    has_validation_attention: !!context.attention.validation_agent,
    has_conversational_attention: !!context.attention.conversational_agent,
    has_internal_attention: !!context.attention.internal_agent,
  });

  const config = context.user_config;

  // Build enhanced system prompt with context from all agents
  const systemPrompt = `You are a career trajectory planning expert. Generate a structured timeline that helps the user achieve their goal.

CRITICAL HARD BOUNDS - MUST BE ENFORCED:
1. Layer 1 blocks: MUST be between 4.0 and 10.0 years
2. Layer 2 blocks: MUST be between 0.0 and 5.0 years
3. Layer 3 blocks: MUST be between 0.0 and 1.0 years
4. Timeline: Start at age ${config.start_age}, end at age ${config.end_age}
5. Total duration: ${config.end_age - config.start_age} years
6. Number of layers: ${config.num_layers}

CRITICAL ASSUMPTION POLICY - EXTRA CONSERVATIVE:

DEFAULT: If unclear, create general blocks and note what's uncertain.

ONLY make an assumption if ALL of these are true:
1. Information is READILY AVAILABLE (factual, not inferred)
2. Information is UNIVERSAL (applies to everyone)
3. Assumption is INCONSEQUENTIAL to final plan
4. You are AT LEAST 90% confident it won't affect user goals

ACCEPTABLE assumptions (rare):
- Mathematical calculations (duration = end - start)
- Hard constraints (blocks must be sequential)

UNACCEPTABLE assumptions (NEVER make these):
- "Typical" patterns (e.g., "SAT in junior year")
- User preferences not explicitly stated
- Context-based inferences (e.g., "MIT → research focus")

When information is unclear:
- Create more general blocks that can be refined later
- Note assumptions_made for transparency

---

CONTEXT FROM OTHER AGENTS:

VALIDATION AGENT identified these critical constraints:
${context.attention.validation_agent?.critical_constraints.map((c) => `- ${c}`).join('\n') || '- None specified'}

VALIDATION AGENT identified these focus areas:
${context.attention.validation_agent?.focus_areas.map((a) => `- ${a}`).join('\n') || '- None specified'}

CONVERSATIONAL AGENT clarified user's intent:
"${context.attention.conversational_agent?.clarified_intent || 'No specific clarification'}"

CONVERSATIONAL AGENT extracted these key requirements:
${context.attention.conversational_agent?.key_requirements.map((r) => `- ${r}`).join('\n') || '- None specified'}

CONVERSATIONAL AGENT documented these preferences:
${JSON.stringify(context.attention.conversational_agent?.user_preferences || {}, null, 2)}

INTERNAL AGENT flagged these areas as challenging:
${context.attention.internal_agent?.blocks_requiring_attention.map((b) => `- ${b}`).join('\n') || '- None specified'}

---

LAYER GUIDANCE:
- Layer 1: Broad strokes (major phases like "Build Foundation", "Execute Strategy")
- Layer 2: Medium detail (specific milestones like "Complete AP courses", "Build portfolio")
- Layer 3: Fine detail (month-by-month actions like "Study for SAT", "Draft essay")

RULES:
- Blocks MUST NOT overlap within a layer
- Blocks MUST fill the entire timeline (no gaps)
- Earlier blocks should prepare for later blocks
- Final block should directly lead to the end goal
- Duration calculations: duration_years = end_age - start_age (must be exact)
- ALL ages and durations must be decimal numbers (e.g., 14.5, not 14)
- Use ALL the context from other agents to create a personalized timeline
- Address the focus areas and challenging blocks identified

For user: ${config.user_name}
Goal: ${config.end_goal}
Timeline: Age ${config.start_age} to ${config.end_age}`;

  const userPrompt = `Generate a ${config.num_layers}-layer timeline for ${config.user_name} to achieve: "${config.end_goal}"

Timeline: Age ${config.start_age} to ${config.end_age} (${config.end_age - config.start_age} years)

IMPORTANT: Use ALL the context provided from Validation, Conversational, and Internal agents to create a highly personalized timeline that addresses:
1. The critical constraints and focus areas identified
2. The user's clarified intent and key requirements
3. The user's documented preferences
4. The challenging areas that need special attention

Create logical blocks for each layer that:
1. Build toward the end goal progressively
2. Respect all hard bounds (Layer 1: 4-10yr, Layer 2: 0-5yr, Layer 3: 0-1yr)
3. Cover the entire timeline with no gaps or overlaps
4. Are realistic, personalized, and actionable
5. Reflect the specific information gathered in the conversation

Remember: Use the conversational context to make this timeline SPECIFIC to ${config.user_name}'s situation and preferences.`;

  // Define JSON schema for structured output (same as legacy)
  const schema = {
    name: 'generate_timeline_with_context',
    description: 'Generates a personalized timeline using agent context and attention mechanism',
    schema: {
      type: 'object',
      properties: {
        layers: {
          type: 'array',
          description: 'Timeline layers from broad (Layer 1) to detailed (Layer 3)',
          items: {
            type: 'object',
            properties: {
              layer_number: {
                type: 'number',
                description: 'Layer number (1, 2, or 3)',
              },
              title: {
                type: 'string',
                description: 'Layer title (e.g., "High School Journey")',
              },
              start_age: {
                type: 'number',
                description: 'Layer start age (must match timeline start)',
              },
              end_age: {
                type: 'number',
                description: 'Layer end age (must match timeline end)',
              },
              blocks: {
                type: 'array',
                description: 'Sequential blocks within this layer',
                items: {
                  type: 'object',
                  properties: {
                    title: {
                      type: 'string',
                      description: 'Block title (e.g., "Build Math Foundation")',
                    },
                    description: {
                      type: 'string',
                      description: 'Detailed description of this phase',
                    },
                    start_age: {
                      type: 'number',
                      description: 'Block start age (decimal allowed, e.g., 14.5)',
                    },
                    end_age: {
                      type: 'number',
                      description: 'Block end age (decimal allowed, e.g., 16.5)',
                    },
                    duration_years: {
                      type: 'number',
                      description: 'Block duration in years (end_age - start_age, must be exact)',
                    },
                  },
                  required: ['title', 'description', 'start_age', 'end_age', 'duration_years'],
                },
              },
            },
            required: ['layer_number', 'title', 'start_age', 'end_age', 'blocks'],
          },
        },
        confidence_score: {
          type: 'number',
          description: 'Confidence score (0-100) that this timeline is high-quality and personalized',
        },
        generated_structure: {
          type: 'string',
          description: 'High-level description of the generated timeline structure',
        },
        challenging_blocks: {
          type: 'array',
          description: 'Blocks that were challenging to create or may need refinement',
          items: { type: 'string' },
        },
        assumptions_made: {
          type: 'array',
          description: 'Any assumptions made during generation (should be minimal)',
          items: { type: 'string' },
        },
      },
      required: ['layers', 'confidence_score', 'generated_structure', 'challenging_blocks', 'assumptions_made'],
    },
  };

  try {
    const response = await tracedConfigurationAgent(
      config,
      async () => {
        return await sendMessageJSON<{
          layers: GeneratedLayer[];
          confidence_score: number;
          generated_structure: string;
          challenging_blocks: string[];
          assumptions_made: string[];
        }>(
          [{ role: 'user', content: userPrompt }],
          schema,
          { system: systemPrompt, maxTokens: 8192 }
        );
      }
    );

    const {
      layers,
      confidence_score,
      generated_structure,
      challenging_blocks,
      assumptions_made,
    } = response.data;

    const timeline: GeneratedTimeline = { layers };
    const is_confident = confidence_score >= confidenceThreshold;

    Logger.info('Context-aware timeline generated', {
      confidence_score,
      is_confident,
      layers: layers.length,
      totalBlocks: layers.reduce((sum, layer) => sum + layer.blocks.length, 0),
      challenging_count: challenging_blocks.length,
      assumptions_count: assumptions_made.length,
      cost: response.cost,
    });

    // Intelligent Validation & Correction: Use LLM to fix errors
    const validationResult = await validateAndCorrectTimeline(timeline, config);

    if (!validationResult.isValid) {
      Logger.error(
        'Validation failed even after correction attempt',
        new Error('Validation errors'),
        { errors: validationResult.errors }
      );

      // Build attention object with issues
      const attention: ConfigurationAttention = {
        confidence_score: 0,
        generated_structure,
        challenging_blocks,
        assumptions_made,
      };

      return {
        is_confident: false,
        confidence_score: 0,
        issues: validationResult.errors,
        attention,
      };
    }

    // Use corrected timeline if corrections were made
    let finalTimeline = timeline;
    if (validationResult.correctedTimeline) {
      finalTimeline = validationResult.correctedTimeline;
      Logger.info('Timeline corrected by validation agent', {
        corrections: validationResult.corrections.length,
        validationCost: validationResult.cost,
      });
    }

    // Build attention object
    const attention: ConfigurationAttention = {
      confidence_score,
      generated_structure,
      challenging_blocks,
      assumptions_made,
    };

    return {
      is_confident,
      confidence_score,
      timeline: finalTimeline,
      attention,
    };
  } catch (error) {
    Logger.error('Context-aware timeline generation failed', error as Error);
    throw error;
  }
}

export default { generateTimelineStructure, generateWithContext };
