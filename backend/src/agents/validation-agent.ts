import { sendMessageJSON } from '../services/anthropic';
import Logger from '../utils/logger';
import { tracedValidationAgent } from '../utils/langsmith-tracer';

/**
 * Validation & Correction Agent (LLM Role 4)
 *
 * Purpose: Intelligently validate and correct timeline structures
 *
 * Process:
 * 1. Takes generated timeline from Configuration Agent
 * 2. Validates against hard bounds and business rules
 * 3. If invalid: Intelligently corrects errors while preserving intent
 * 4. Returns corrected timeline with validation report
 *
 * This solves the problem of wasted API calls from validation failures
 * by using LLM intelligence to self-heal constraint violations.
 */

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

interface UserConfig {
  user_name: string;
  start_age: number;
  end_age: number;
  end_goal: string;
  num_layers: number;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  correctedTimeline?: GeneratedTimeline;
  corrections: string[];
  cost: number;
}

/**
 * Validate and correct timeline using LLM intelligence
 */
export async function validateAndCorrectTimeline(
  timeline: GeneratedTimeline,
  config: UserConfig
): Promise<ValidationResult> {
  Logger.entry('validateAndCorrectTimeline', { layersCount: timeline.layers.length });

  // First, run deterministic validation to collect errors
  const errors = collectValidationErrors(timeline, config);

  // If no errors, return immediately
  if (errors.length === 0) {
    Logger.info('Timeline passed validation without corrections');
    return {
      isValid: true,
      errors: [],
      corrections: [],
      cost: 0,
    };
  }

  Logger.info(`Timeline has ${errors.length} validation errors, attempting intelligent correction`, {
    errors,
  });

  // Use LLM to intelligently correct errors
  try {
    const systemPrompt = `You are a timeline validation and correction expert. Your job is to fix validation errors in career timelines while preserving the original intent.

CRITICAL HARD BOUNDS - MUST BE ENFORCED:
1. Layer 1 blocks: MUST be between 4.0 and 10.0 years
2. Layer 2 blocks: MUST be between 0.0 and 5.0 years
3. Layer 3 blocks: MUST be between 0.0 and 1.0 years
4. Timeline: Start at age ${config.start_age}, end at age ${config.end_age}
5. Total duration: ${config.end_age - config.start_age} years
6. Number of layers: ${config.num_layers}

CORRECTION RULES:
- Fix duration violations by adjusting block boundaries
- Fill gaps by expanding adjacent blocks
- Fix overlaps by adjusting boundaries
- Ensure blocks cover entire timeline (no gaps at start/end)
- Preserve semantic meaning and titles as much as possible
- Use decimal ages (e.g., 14.5) for precise boundaries
- Duration must exactly match: duration_years = end_age - start_age

Your goal: Fix all errors while keeping the timeline as close to the original as possible.`;

    const userPrompt = `Fix the following timeline validation errors:

ERRORS:
${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

ORIGINAL TIMELINE:
${JSON.stringify(timeline, null, 2)}

USER CONFIG:
- Name: ${config.user_name}
- Age Range: ${config.start_age} to ${config.end_age} (${config.end_age - config.start_age} years)
- Goal: ${config.end_goal}
- Layers: ${config.num_layers}

Return a corrected timeline that:
1. Fixes ALL validation errors
2. Preserves original block titles and intent
3. Ensures no gaps, overlaps, or bound violations
4. Covers entire timeline from start to end`;

    const schema = {
      name: 'correct_timeline',
      description: 'Corrects timeline validation errors while preserving intent',
      schema: {
        type: 'object',
        properties: {
          corrected_timeline: {
            type: 'object',
            description: 'The corrected timeline structure',
            properties: {
              layers: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    layer_number: { type: 'number' },
                    title: { type: 'string' },
                    start_age: { type: 'number' },
                    end_age: { type: 'number' },
                    blocks: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          title: { type: 'string' },
                          description: { type: 'string' },
                          start_age: { type: 'number' },
                          end_age: { type: 'number' },
                          duration_years: { type: 'number' },
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
          corrections_made: {
            type: 'array',
            description: 'List of corrections applied',
            items: { type: 'string' },
          },
        },
        required: ['corrected_timeline', 'corrections_made'],
      },
    };

    const response = await tracedValidationAgent(
      { timeline, config, errors },
      async () => {
        return await sendMessageJSON<{
          corrected_timeline: GeneratedTimeline;
          corrections_made: string[];
        }>([{ role: 'user', content: userPrompt }], schema, {
          system: systemPrompt,
          maxTokens: 8192,
        });
      }
    );

    const { corrected_timeline, corrections_made } = response.data;

    // Validate the corrected timeline
    const newErrors = collectValidationErrors(corrected_timeline, config);

    if (newErrors.length === 0) {
      Logger.info('Timeline successfully corrected', {
        originalErrors: errors.length,
        corrections: corrections_made.length,
        cost: response.cost,
      });

      return {
        isValid: true,
        errors: [],
        correctedTimeline: corrected_timeline,
        corrections: corrections_made,
        cost: response.cost,
      };
    } else {
      Logger.info('Correction attempt still has errors', {
        originalErrors: errors.length,
        remainingErrors: newErrors.length,
        cost: response.cost,
      });

      return {
        isValid: false,
        errors: newErrors,
        correctedTimeline: corrected_timeline,
        corrections: corrections_made,
        cost: response.cost,
      };
    }
  } catch (error) {
    Logger.error('Validation and correction failed', error as Error, { errors });
    return {
      isValid: false,
      errors,
      corrections: [],
      cost: 0,
    };
  }
}

/**
 * Deterministic validation - collects all errors
 */
function collectValidationErrors(timeline: GeneratedTimeline, config: UserConfig): string[] {
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
      continue;
    }

    let prevEnd = config.start_age;
    for (let i = 0; i < layer.blocks.length; i++) {
      const block = layer.blocks[i];
      const blockPrefix = `${layerPrefix} Block ${i + 1}`;

      // Check block continuity (allow 0.01 tolerance for floating point)
      if (Math.abs(block.start_age - prevEnd) > 0.01) {
        errors.push(`${blockPrefix}: gap detected (starts at ${block.start_age}, prev ended at ${prevEnd})`);
      }

      // Check duration calculation
      const expectedDuration = block.end_age - block.start_age;
      if (Math.abs(block.duration_years - expectedDuration) > 0.01) {
        errors.push(`${blockPrefix}: duration mismatch (${block.duration_years} != ${expectedDuration})`);
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
        errors.push(`${layerPrefix}: last block ends at ${lastBlock.end_age}, expected ${config.end_age}`);
      }
    }
  }

  return errors;
}

export default { validateAndCorrectTimeline };
