/**
 * Conversational Clarification Agent (Agent #2)
 *
 * Purpose: Gather missing information from user through natural conversation.
 *
 * Process:
 * 1. Receives questions from Pre-Validation Agent
 * 2. Asks user questions in conversational manner
 * 3. Analyzes user's answers for completeness and clarity
 * 4. Returns confidence score (0-100)
 * 5. If confidence < 95%: Asks follow-up questions
 * 6. If confidence >= 95%: Updates attention with clarified intent
 *
 * This is the SECOND agent in the workflow. It bridges the gap between
 * what the user initially provided and what we need to generate a timeline.
 *
 * @module conversational-clarification-agent
 */

import { sendMessage, sendMessageJSON } from '../services/anthropic';
import Logger from '../utils/logger';
import { tracedConversationalClarificationAgent } from '../utils/langsmith-tracer';
import {
  AgentContext,
  ConversationalResult,
  ConversationalAttention,
  ConversationMessage,
} from '../types/agent-context';

/**
 * Asks user clarifying questions based on Validation Agent's analysis.
 *
 * CRITICAL RULE: Must be AT LEAST 95% confident that answers are clear
 * and actionable before proceeding.
 *
 * @param context - Agent context with validation attention and user config
 * @param userMessage - User's response to questions
 * @returns Conversational result with confidence score and next question (if needed)
 *
 * @example
 * ```typescript
 * // Initial call - ask first question
 * const context: AgentContext = {
 *   user_config: { ... },
 *   attention: {
 *     validation_agent: {
 *       confidence_score: 75,
 *       questions_to_ask: [
 *         "Which area of bioengineering interests you most?",
 *         "Do you prefer research or clinical applications?"
 *       ],
 *       ...
 *     }
 *   },
 *   conversation_history: [],
 *   workflow: { ... }
 * };
 *
 * const result = await gatherClarifications(context);
 * // result.response = "Which area of bioengineering interests you most? (e.g., ...)"
 * // result.is_confident = false
 *
 * // After user responds
 * context.conversation_history.push(
 *   { role: 'assistant', content: result.response, ... },
 *   { role: 'user', content: "I'm interested in CRISPR and gene editing", ... }
 * );
 *
 * const result2 = await gatherClarifications(context, "I'm interested in CRISPR and gene editing");
 * // result2.is_confident = true (if all questions answered satisfactorily)
 * // result2.attention.clarified_intent = "User wants computational biology focus with CRISPR research"
 * ```
 */
export async function gatherClarifications(
  context: AgentContext,
  userMessage?: string
): Promise<ConversationalResult> {
  Logger.entry('gatherClarifications', {
    has_user_message: !!userMessage,
    conversation_length: context.conversation_history?.length || 0,
  });

  // Determine if this is the first question or a follow-up
  const isFirstQuestion = !context.conversation_history || context.conversation_history.length === 0;

  const systemPrompt = `You are a conversational career planning assistant. Your job is to gather missing information from users through natural, friendly conversation.

UPLOADED FILES POLICY:

If the user has uploaded files (resume, transcript, etc.), USE THAT INFORMATION FIRST:
- Review the uploaded file content carefully
- Do NOT ask questions that are already answered in the uploaded files
- If information from files needs clarification, acknowledge what you saw and ask for specific clarification
- Use uploaded files to inform your questions (e.g., "I see from your resume you have Python experience...")

CRITICAL ASSUMPTION POLICY - EXTRA CONSERVATIVE:

DEFAULT: ASK FOR CLARIFICATION. Do NOT make assumptions.

ONLY make an assumption if ALL of these are true:
1. Information is READILY AVAILABLE (factual, not inferred)
2. Information is UNIVERSAL (applies to everyone)
3. Assumption is INCONSEQUENTIAL to final plan
4. You are AT LEAST 95% confident it won't affect user goals

UNACCEPTABLE assumptions (NEVER make these):
- "Typical" patterns (e.g., "SAT in junior year")
- User preferences (e.g., "probably wants research")
- Context-based inferences (e.g., "MIT → competitive")
- Any person-specific or goal-specific details

When in doubt: ASK.

---

CONFIDENCE THRESHOLD: You must be AT LEAST 95% confident that user's answers are clear and actionable.

🚫 CRITICAL ANTI-PATTERNS - NEVER DO THESE (they break timeline generation):

❌ STAGE BLOCKING: Never get stuck in conversation stage - if confidence >= 90% with sufficient detail, proceed to generation
❌ INFINITE CLARIFICATION: Never ask >3 rounds of questions - user frustration kills timeline completion
❌ PERFECTIONIST PARALYSIS: Never demand 95% confidence for complex 50-year timelines - 85-90% is sufficient for generation
❌ CONTEXT CORRUPTION: Never lose user config data between agent handoffs - preserve all original user inputs
❌ OVER-CLARIFICATION: Never re-ask questions about info already provided - causes agent handoff failures
❌ VALIDATION LOOPS: Never trigger repeated validation cycles - once clarified, move forward immediately
❌ RATE LIMIT IGNORANCE: Never trigger >3 LLM calls per clarification - causes 429 errors and system breakdown

✅ SUCCESS PATTERNS:
- Accept 85-90% confidence for complex scenarios (like 50-year AI scientist timelines)
- Maximum 2-3 clarification questions total
- Preserve ALL user context during handoffs
- Progress to generation stage after reasonable clarification
- Focus on CRITICAL missing info only (not perfect details)

YOUR TASKS:
${
  isFirstQuestion
    ? `
1. Review the questions from the Validation Agent
2. Ask the first question in a friendly, conversational way
3. Provide context or examples to help user understand what you're asking
4. Set is_confident to false (first question just asked)
`
    : `
1. Analyze user's answer to your previous question
2. Determine if answer is clear and actionable (confidence >= 95%?)
3. If unclear or incomplete: Ask follow-up question for clarification
4. If clear: Move to next question from Validation Agent
5. When ALL questions answered satisfactorily: Set is_confident to true and summarize clarified intent
`
}

CONVERSATION STYLE:
- Be warm, friendly, and encouraging
- Use natural language (not formal or robotic)
- Provide examples when helpful
- Acknowledge user's answers before asking next question
- Show you understand their goals

CRITICAL: Only set is_confident = true when:
- ALL questions from Validation Agent have been answered
- ALL answers are clear and specific (not vague)
- You have 95%+ confidence you understand user's intent`;

  // Build user prompt based on whether this is first question or follow-up
  let userPrompt: string;

  if (isFirstQuestion) {
    // First question - introduce conversation and ask first question
    const questions = context.attention.validation_agent?.questions_to_ask || [];

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

    userPrompt = `You are starting a conversation to gather missing information about the user's career goal.

USER GOAL: ${context.user_config.end_goal}
AGE RANGE: ${context.user_config.start_age} to ${context.user_config.end_age}${uploadedFilesContext}

VALIDATION AGENT ANALYSIS:
${context.attention.validation_agent?.missing_information_categories.map((cat) => `- Missing: ${cat}`).join('\n')}

QUESTIONS TO ASK (in order):
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

FOCUS AREAS:
${context.attention.validation_agent?.focus_areas.map((area) => `- ${area}`).join('\n')}

Task: Ask the FIRST question in a friendly, conversational way. Provide context/examples if helpful.

Return:
1. Your conversational message to the user (ask first question)
2. Set is_confident to false
3. Leave other fields empty (will be filled later)`;
  } else {
    // Follow-up - analyze previous answer and continue
    const lastUserMessage =
      context.conversation_history!.filter((m) => m.role === 'user').pop()?.content || '';
    const questions = context.attention.validation_agent?.questions_to_ask || [];
    const answeredCount = Math.floor((context.conversation_history!.length - 1) / 2); // Rough estimate

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

    userPrompt = `You are continuing a conversation to gather missing information.

USER'S LATEST ANSWER: "${userMessage}"${uploadedFilesContext}

ORIGINAL QUESTIONS TO COVER:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

CONVERSATION SO FAR:
${context.conversation_history!.map((m) => `${m.role}: ${m.content}`).join('\n\n')}

TASK:
1. Analyze user's latest answer
2. Is it clear and specific? Or vague/incomplete?
3. If unclear: Ask follow-up for clarification
4. If clear: Acknowledge it, then move to next question
5. If ALL questions answered satisfactorily AND you're 95%+ confident you understand their intent:
   - Set is_confident = true
   - Provide clarified_intent summary
   - Extract key_requirements
   - Document user_preferences

Return:
1. Your conversational response to user
2. Confidence score (0-100)
3. Is_confident (true only if ALL done)
4. If confident: clarified_intent, key_requirements, user_preferences`;
  }

  const schema = {
    name: 'conversational_clarification',
    description: 'Gathers clarifications from user through conversation',
    schema: {
      type: 'object',
      properties: {
        response: {
          type: 'string',
          description: 'Your conversational message to the user (question or acknowledgment)',
        },
        confidence_score: {
          type: 'number',
          description:
            'Confidence score (0-100) that you have gathered enough clear information',
        },
        is_confident: {
          type: 'boolean',
          description:
            'Set to true ONLY when ALL questions answered AND you are 95%+ confident',
        },
        clarified_intent: {
          type: 'string',
          description:
            "Summary of user's clarified intent (ONLY if is_confident = true)",
        },
        key_requirements: {
          type: 'array',
          description:
            'Key requirements extracted from conversation (ONLY if is_confident = true)',
          items: { type: 'string' },
        },
        user_preferences: {
          type: 'object',
          description:
            'User preferences as key-value pairs (ONLY if is_confident = true)',
          additionalProperties: true,
        },
      },
      required: ['response', 'confidence_score', 'is_confident'],
    },
  };

  try {
    const response = await tracedConversationalClarificationAgent(
      context,
      async () => {
        return await sendMessageJSON<{
          response: string;
          confidence_score: number;
          is_confident: boolean;
          clarified_intent?: string;
          key_requirements?: string[];
          user_preferences?: Record<string, any>;
        }>(
          [{ role: 'user', content: userPrompt }],
          schema,
          {
            system: systemPrompt,
            maxTokens: 2048,
          }
        );
      }
    );

    const {
      response: assistantResponse,
      confidence_score,
      is_confident,
      clarified_intent,
      key_requirements,
      user_preferences,
    } = response.data;

    Logger.info('Conversational clarification complete', {
      confidence_score,
      is_confident,
      has_clarified_intent: !!clarified_intent,
      cost: response.cost,
    });

    // Build attention object
    const attention: ConversationalAttention = {
      confidence_score,
      clarified_intent: clarified_intent || '',
      key_requirements: key_requirements || [],
      user_preferences: user_preferences || {},
    };

    return {
      is_confident,
      confidence_score,
      next_question: is_confident ? undefined : assistantResponse,
      response: assistantResponse,
      attention,
    };
  } catch (error) {
    Logger.error('Conversational clarification failed', error as Error);
    throw error;
  }
}

export default { gatherClarifications };
