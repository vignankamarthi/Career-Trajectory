import { sendMessage, sendMessageStream } from '../services/anthropic';
import { query, queryOne } from '../database/db';
import Logger from '../utils/logger';
import { tracedConversationalAssistant } from '../utils/langsmith-tracer';

/**
 * Conversational Assistant (LLM Role 2)
 *
 * Purpose: Answer user questions about their timeline
 *
 * Capabilities:
 * - Q&A about timeline structure and blocks
 * - Explain requirements and constraints
 * - Provide guidance on career planning
 * - Suggest improvements (read-only, no state changes)
 *
 * Context: Full timeline state + conversation history
 */

interface ChatContext {
  timelineId: string;
  timeline: any;
  layers: any[];
  blocks: any[];
  conversationHistory: any[];
}

/**
 * Build context for the conversational assistant
 */
async function buildChatContext(timelineId: string): Promise<ChatContext> {
  Logger.entry('buildChatContext', { timelineId });

  // Fetch timeline
  const timeline = queryOne('SELECT * FROM timelines WHERE id = ?', [timelineId]);
  if (!timeline) {
    throw new Error('Timeline not found');
  }

  // Fetch layers
  const layers = query(
    'SELECT * FROM layers WHERE timeline_id = ? ORDER BY layer_number',
    [timelineId]
  );

  // Fetch all blocks
  const blocks: any[] = [];
  for (const layer of layers) {
    const layerBlocks = query(
      'SELECT * FROM blocks WHERE layer_id = ? ORDER BY position',
      [layer.id]
    );
    blocks.push(...layerBlocks);
  }

  // Fetch conversation history
  const conversationHistory = query(
    'SELECT * FROM conversations WHERE timeline_id = ? ORDER BY timestamp ASC',
    [timelineId]
  );

  Logger.exit('buildChatContext', {
    layers: layers.length,
    blocks: blocks.length,
    messages: conversationHistory.length,
  });

  return {
    timelineId,
    timeline,
    layers,
    blocks,
    conversationHistory,
  };
}

/**
 * Generate system prompt with timeline context
 */
function generateSystemPrompt(context: ChatContext): string {
  const { timeline, layers, blocks } = context;

  // Build blocks summary by layer
  const layersSummary = layers.map((layer: any) => {
    const layerBlocks = blocks.filter((b: any) => b.layer_id === layer.id);
    const blocksList = layerBlocks
      .map((b: any) => `  - ${b.title} (Age ${b.start_age}-${b.end_age}, ${b.duration_years}yr)`)
      .join('\n');

    return `Layer ${layer.layer_number}: ${layer.title}\n${blocksList}`;
  }).join('\n\n');

  return `You are a career planning assistant helping ${timeline.user_name} achieve their goal: "${timeline.end_goal}".

TIMELINE OVERVIEW:
- User: ${timeline.user_name}
- Age range: ${timeline.start_age} to ${timeline.end_age}
- Goal: ${timeline.end_goal}
- Layers: ${timeline.num_layers}

CURRENT TIMELINE STRUCTURE:
${layersSummary}

HARD BOUNDS (enforce these in your guidance):
- Layer 1 blocks: 4-20 years each
- Layer 2 blocks: 0-5 years each
- Layer 3 blocks: 0-1 years each
- Timeline: Age ${timeline.start_age} to ${timeline.end_age}

YOUR ROLE:
1. Answer questions about the timeline structure
2. Explain what each block involves
3. Provide career planning advice
4. Suggest improvements or adjustments
5. Help user understand requirements and milestones

IMPORTANT:
- You are READ-ONLY - you cannot modify the timeline
- If user wants changes, tell them to edit blocks directly or use Save Modes
- Be encouraging and supportive
- Ground advice in the actual timeline structure
- Reference specific blocks when relevant`;
}

/**
 * Send a chat message and get response
 */
export async function chat(
  timelineId: string,
  userMessage: string
): Promise<{ content: string; cost: number }> {
  Logger.entry('chat', { timelineId, messageLength: userMessage.length });

  try {
    // Build context
    const context = await buildChatContext(timelineId);

    // Generate system prompt
    const systemPrompt = generateSystemPrompt(context);

    // Build messages array with conversation history
    const messages: any[] = [];

    // Add conversation history
    for (const msg of context.conversationHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage,
    });

    // Call traced Conversational Assistant with LangSmith tracing
    const response = await tracedConversationalAssistant(
      timelineId,
      messages.length,
      async () => {
        return await sendMessage(messages, {
          system: systemPrompt,
          maxTokens: 2048,
          temperature: 0.7,
        });
      }
    );

    Logger.info('Chat response generated', {
      timelineId,
      cost: response.cost,
      responseLength: response.content.length,
    });

    Logger.exit('chat', { cost: response.cost });

    return {
      content: response.content,
      cost: response.cost,
    };
  } catch (error) {
    Logger.error('Chat failed', error as Error, { timelineId, userMessage });
    throw error;
  }
}

/**
 * Stream a chat message for real-time responses
 */
export async function chatStream(
  timelineId: string,
  userMessage: string,
  onChunk: (chunk: string) => void
): Promise<{ cost: number }> {
  Logger.entry('chatStream', { timelineId, messageLength: userMessage.length });

  try {
    // Build context
    const context = await buildChatContext(timelineId);

    // Generate system prompt
    const systemPrompt = generateSystemPrompt(context);

    // Build messages array with conversation history
    const messages: any[] = [];

    // Add conversation history
    for (const msg of context.conversationHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage,
    });

    // Call Anthropic with streaming
    const response = await sendMessageStream(messages, onChunk, {
      system: systemPrompt,
      maxTokens: 2048,
      temperature: 0.7,
    });

    Logger.info('Chat stream completed', {
      timelineId,
      cost: response.cost,
    });

    Logger.exit('chatStream', { cost: response.cost });

    return {
      cost: response.cost,
    };
  } catch (error) {
    Logger.error('Chat stream failed', error as Error, { timelineId, userMessage });
    throw error;
  }
}

export default { chat, chatStream };
