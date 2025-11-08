/**
 * Pre-Generation Validation Agent (Agent #1)
 *
 * Purpose: Analyze initial user input to determine if enough information exists
 * to create a high-quality timeline.
 *
 * Process:
 * 1. Takes user configuration from initial form
 * 2. Analyzes what information is missing or unclear
 * 3. Returns confidence score (0-100)
 * 4. If confidence < 95%: Returns questions to ask user
 * 5. If confidence >= 95%: Allows workflow to proceed
 *
 * This is the FIRST agent in the workflow. It prevents wasted effort by ensuring
 * we have enough information before attempting to generate a timeline.
 *
 * @module pre-validation-agent
 */

import { sendMessageJSON } from '../services/anthropic';
import Logger from '../utils/logger';
import { tracedPreValidationAgent } from '../utils/langsmith-tracer';
import {
  AgentContext,
  ValidationResult,
  ValidationAttention,
} from '../types/agent-context';

/**
 * Analyzes initial user input and determines if enough information exists
 * to create a high-quality timeline.
 *
 * CRITICAL RULE: Must be AT LEAST 95% confident before proceeding.
 * If < 95%, returns questions to ask user.
 *
 * @param context - Agent context with user configuration
 * @returns Validation result with confidence score and questions (if needed)
 *
 * @example
 * ```typescript
 * const context: AgentContext = {
 *   user_config: {
 *     user_name: "Alex",
 *     start_age: 14,
 *     end_age: 18,
 *     end_goal: "Get into MIT",
 *     num_layers: 3
 *   },
 *   attention: {},
 *   workflow: {
 *     current_stage: "validation",
 *     attempt_count: 1,
 *     started_at: new Date().toISOString(),
 *     last_updated_at: new Date().toISOString()
 *   }
 * };
 *
 * const result = await analyzeInitialInput(context);
 * // result.confidence_score = 75
 * // result.is_confident = false
 * // result.questions = ["Which area of study are you interested in for MIT?", ...]
 * ```
 */
export async function analyzeInitialInput(
  context: AgentContext
): Promise<ValidationResult> {
  Logger.entry('analyzeInitialInput', {
    user_name: context.user_config.user_name,
    end_goal: context.user_config.end_goal,
  });

  const systemPrompt = `You are a career trajectory analysis expert. Your job is to analyze initial user input and determine if enough information exists to create a high-quality, personalized timeline.

CRITICAL ASSUMPTION POLICY - EXTRA CONSERVATIVE:

DEFAULT: ASK FOR CLARIFICATION. Do NOT make assumptions.

ONLY make an assumption if ALL of these are true:
1. Information is READILY AVAILABLE (factual, not inferred)
2. Information is UNIVERSAL (applies to everyone)
3. Assumption is INCONSEQUENTIAL to final plan
4. You are AT LEAST 95% confident it won't affect user goals

ACCEPTABLE assumptions (rare):
- Mathematical calculations (duration = end - start)
- Direct user instructions (create 3 layers)
- Hard constraints (blocks must be sequential)

UNACCEPTABLE assumptions (NEVER make these):
- "Typical" patterns (e.g., "SAT in junior year")
- User preferences (e.g., "probably wants research")
- Context-based inferences (e.g., "MIT → competitive")
- Goals like "MIT" implying specific interests
- Assuming 2-3 standard activities
- Any person-specific or goal-specific details

When in doubt: ASK.

---

CONFIDENCE THRESHOLD: You must be AT LEAST 95% confident that you have enough information to create a high-quality timeline.

If confidence < 95%:
- Identify SPECIFIC missing information categories
- Generate targeted questions to ask the user
- Highlight critical constraints and focus areas

If confidence >= 95%:
- Proceed to timeline generation
- Document what constraints are critical

Your analysis should consider:
1. Is the end goal specific enough? (e.g., "get into MIT" vs "get into MIT for Bioengineering")
2. Are there implicit choices that need clarification? (e.g., research vs clinical pathway)
3. What constraints or preferences might affect the timeline? (e.g., geographic preferences, budget, time commitment)
4. Are there multiple valid approaches that need user input to decide?

Remember: It's better to ask too many questions than to generate a generic timeline.`;

  // Build uploaded files context if any files were uploaded
  let uploadedFilesContext = '';
  if (context.uploaded_files && context.uploaded_files.length > 0) {
    uploadedFilesContext = '\n\nUPLOADED FILES:\n';
    context.uploaded_files.forEach((file, index) => {
      uploadedFilesContext += `\nFile ${index + 1}: ${file.originalname}\n`;
      if (file.error) {
        uploadedFilesContext += `  ERROR: ${file.error}\n`;
      } else if (file.extractedText) {
        uploadedFilesContext += `  Content:\n${file.extractedText}\n`;
      }
    });
  }

  const userPrompt = `Analyze this user's goal and determine if enough information exists to create a personalized timeline.

USER CONFIGURATION:
- Name: ${context.user_config.user_name}
- Age Range: ${context.user_config.start_age} to ${context.user_config.end_age} (${
    context.user_config.end_age - context.user_config.start_age
  } years)
- Goal: ${context.user_config.end_goal}
- Number of Detail Layers: ${context.user_config.num_layers}${uploadedFilesContext}

CRITICAL RULES:
1. Be AT LEAST 95% confident before saying you have enough information
2. Do NOT make assumptions about user preferences or specifics
3. If the goal is vague or has multiple interpretations, ask for clarification
4. If there are implicit choices, ask which path the user prefers

Analyze the goal and return:
1. Confidence score (0-100) - how confident are you that you can create a high-quality timeline?
2. Missing information categories (if confidence < 95%)
3. Specific questions to ask the user (if confidence < 95%)
4. Critical constraints that must be respected
5. Focus areas that need special attention`;

  const schema = {
    name: 'analyze_initial_input',
    description: 'Analyzes initial user input to determine if enough information exists',
    schema: {
      type: 'object',
      properties: {
        confidence_score: {
          type: 'number',
          description:
            'Confidence score (0-100) that enough information exists to create a high-quality timeline',
        },
        analysis: {
          type: 'string',
          description:
            'Detailed analysis of the user goal and what information is available or missing',
        },
        missing_information_categories: {
          type: 'array',
          description:
            'Categories of missing information (empty if confidence >= 95%)',
          items: { type: 'string' },
        },
        questions_to_ask: {
          type: 'array',
          description:
            'Specific questions to ask the user (empty if confidence >= 95%)',
          items: { type: 'string' },
        },
        critical_constraints: {
          type: 'array',
          description:
            'Critical constraints that must be respected (e.g., "age 14-18 timeline", "MIT admissions requirements")',
          items: { type: 'string' },
        },
        focus_areas: {
          type: 'array',
          description:
            'Areas that need special focus or attention (e.g., "research vs clinical pathway", "geographic preferences")',
          items: { type: 'string' },
        },
      },
      required: [
        'confidence_score',
        'analysis',
        'missing_information_categories',
        'questions_to_ask',
        'critical_constraints',
        'focus_areas',
      ],
    },
  };

  try {
    const response = await tracedPreValidationAgent(
      context,
      async () => {
        return await sendMessageJSON<{
          confidence_score: number;
          analysis: string;
          missing_information_categories: string[];
          questions_to_ask: string[];
          critical_constraints: string[];
          focus_areas: string[];
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
      missing_information_categories,
      questions_to_ask,
      critical_constraints,
      focus_areas,
    } = response.data;

    const is_confident = confidence_score >= 95;

    Logger.info('Pre-validation analysis complete', {
      confidence_score,
      is_confident,
      missing_categories: missing_information_categories.length,
      questions_count: questions_to_ask.length,
      cost: response.cost,
    });

    // Build attention object
    const attention: ValidationAttention = {
      confidence_score,
      missing_information_categories,
      critical_constraints,
      focus_areas,
      questions_to_ask: is_confident ? undefined : questions_to_ask,
    };

    return {
      is_confident,
      confidence_score,
      questions: is_confident ? undefined : questions_to_ask,
      attention,
    };
  } catch (error) {
    Logger.error('Pre-validation analysis failed', error as Error);
    throw error;
  }
}

export default { analyzeInitialInput };
