import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import path from 'path';
import Logger from '../utils/logger';

// Load environment variables from .env file in project root
// Resolves from working directory (backend/) up to project root: backend/ -> project-root/.env
dotenv.config({ path: path.join(process.cwd(), '../.env') });

/**
 * Anthropic API client wrapper with logging and cost tracking
 * Supports all 3 LLM roles:
 * 1. Configuration Agent (initial timeline setup)
 * 2. Conversational Assistant (Q&A with user)
 * 3. Internal Agent (state analysis + research)
 */

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Model configurations
const MODELS = {
  SONNET: 'claude-sonnet-4-5-20250929', // Sonnet 4.5 - optimized for agentic workflows
  HAIKU: 'claude-3-5-haiku-20241022', // Optional for cheaper operations
};

// Pricing per million tokens (as of 2025)
const PRICING = {
  [MODELS.SONNET]: {
    input: 3.0 / 1_000_000,
    output: 15.0 / 1_000_000,
  },
  [MODELS.HAIKU]: {
    input: 1.0 / 1_000_000,
    output: 5.0 / 1_000_000,
  },
};

/**
 * Calculate cost for API call
 */
function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model as keyof typeof PRICING];
  if (!pricing) return 0;

  const inputCost = inputTokens * pricing.input;
  const outputCost = outputTokens * pricing.output;
  return inputCost + outputCost;
}

/**
 * Basic conversation with Anthropic
 * Used for all 3 LLM roles
 */
export async function sendMessage(
  messages: Anthropic.MessageParam[],
  options?: {
    system?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<{ content: string; usage: { inputTokens: number; outputTokens: number }; cost: number }> {
  const startTime = Date.now();
  const model = options?.model || MODELS.SONNET;

  try {
    Logger.entry('sendMessage', { messageCount: messages.length, model });

    const response = await anthropic.messages.create({
      model,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature || 1.0,
      system: options?.system,
      messages,
    });

    const duration = Date.now() - startTime;
    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const cost = calculateCost(model, inputTokens, outputTokens);

    // Log API call
    Logger.apiCall('anthropic', {
      model,
      inputTokens,
      outputTokens,
      cost,
      duration,
    });

    // Log full LLM call
    Logger.llmCall({
      provider: 'anthropic',
      role: 'assistant',
      prompt: messages,
      response: content,
      tokens: { input: inputTokens, output: outputTokens },
      cost,
      duration,
    });

    Logger.exit('sendMessage', { contentLength: content.length });

    return {
      content,
      usage: { inputTokens, outputTokens },
      cost,
    };
  } catch (error) {
    Logger.error('Anthropic API call failed', error as Error, { messages, options });
    throw error;
  }
}

/**
 * Streaming conversation with Anthropic
 * Useful for real-time chat interface
 */
export async function sendMessageStream(
  messages: Anthropic.MessageParam[],
  onChunk: (chunk: string) => void,
  options?: {
    system?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<{ usage: { inputTokens: number; outputTokens: number }; cost: number }> {
  const startTime = Date.now();
  const model = options?.model || MODELS.SONNET;
  let fullContent = '';

  try {
    Logger.entry('sendMessageStream', { messageCount: messages.length, model });

    const stream = await anthropic.messages.create({
      model,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature || 1.0,
      system: options?.system,
      messages,
      stream: true,
    });

    let inputTokens = 0;
    let outputTokens = 0;

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const chunk = event.delta.text;
        fullContent += chunk;
        onChunk(chunk);
      } else if (event.type === 'message_start') {
        inputTokens = event.message.usage.input_tokens;
      } else if (event.type === 'message_delta') {
        outputTokens = event.usage.output_tokens;
      }
    }

    const duration = Date.now() - startTime;
    const cost = calculateCost(model, inputTokens, outputTokens);

    // Log API call
    Logger.apiCall('anthropic', {
      model,
      inputTokens,
      outputTokens,
      cost,
      duration,
    });

    // Log full LLM call
    Logger.llmCall({
      provider: 'anthropic',
      role: 'assistant',
      prompt: messages,
      response: fullContent,
      tokens: { input: inputTokens, output: outputTokens },
      cost,
      duration,
    });

    Logger.exit('sendMessageStream', { contentLength: fullContent.length });

    return {
      usage: { inputTokens, outputTokens },
      cost,
    };
  } catch (error) {
    Logger.error('Anthropic streaming API call failed', error as Error, { messages, options });
    throw error;
  }
}

/**
 * JSON mode for structured outputs
 * Used by Configuration Agent and Internal Agent
 */
export async function sendMessageJSON<T>(
  messages: Anthropic.MessageParam[],
  schema: {
    name: string;
    description: string;
    schema: Record<string, any>;
  },
  options?: {
    system?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<{ data: T; usage: { inputTokens: number; outputTokens: number }; cost: number }> {
  const startTime = Date.now();
  const model = options?.model || MODELS.SONNET;

  try {
    Logger.entry('sendMessageJSON', { messageCount: messages.length, model, schema: schema.name });

    const response = await anthropic.messages.create({
      model,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature || 1.0,
      system: options?.system,
      messages,
      tools: [
        {
          name: schema.name,
          description: schema.description,
          input_schema: {
            type: 'object' as const,
            ...schema.schema,
          },
        },
      ],
      tool_choice: { type: 'tool', name: schema.name },
    });

    const duration = Date.now() - startTime;
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const cost = calculateCost(model, inputTokens, outputTokens);

    // DEBUG: Log the raw response to understand what LLM is returning
    Logger.info('sendMessageJSON raw LLM response', {
      contentBlocks: response.content.map(block => ({ type: block.type, hasToolUse: block.type === 'tool_use' })),
      fullContent: JSON.stringify(response.content, null, 2)
    });

    // Extract tool use result
    const toolUse = response.content.find((block) => block.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      Logger.error('No tool use found in LLM response', new Error('Missing tool_use'), {
        contentTypes: response.content.map(block => block.type),
        responseContent: response.content
      });
      throw new Error('No tool use found in response');
    }

    const data = toolUse.input as T;

    // DEBUG: Log what we extracted from tool_use
    Logger.info('sendMessageJSON extracted tool data', {
      toolUseName: toolUse.name,
      inputKeys: toolUse.input && typeof toolUse.input === 'object' ? Object.keys(toolUse.input) : [],
      inputContent: JSON.stringify(toolUse.input, null, 2)
    });

    // Log API call
    Logger.apiCall('anthropic', {
      model,
      inputTokens,
      outputTokens,
      cost,
      duration,
    });

    // Log full LLM call
    Logger.llmCall({
      provider: 'anthropic',
      role: 'configuration',
      prompt: messages,
      response: data as Record<string, any>,
      tokens: { input: inputTokens, output: outputTokens },
      cost,
      duration,
    });

    Logger.exit('sendMessageJSON', { schemaName: schema.name });

    return {
      data,
      usage: { inputTokens, outputTokens },
      cost,
    };
  } catch (error) {
    Logger.error('Anthropic JSON mode API call failed', error as Error, { messages, schema, options });
    throw error;
  }
}

/**
 * Extract JSON from text response (hybrid approach)
 * Handles various formats: JSON code blocks, plain JSON, or mixed text
 */
function extractTimelineJSON(text: string): any {
  // Strategy 1: JSON code blocks (most reliable - preferred by LLM)
  const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    try {
      const timeline = JSON.parse(codeBlockMatch[1]);
      if (timeline.layers && Array.isArray(timeline.layers)) {
        return timeline;
      }
    } catch (error) {
      // Fall through to other strategies
    }
  }

  // Strategy 2: Bare JSON (if no code blocks)
  const bareJsonMatch = text.match(/^\s*(\{[\s\S]*\})\s*$/);
  if (bareJsonMatch) {
    try {
      const timeline = JSON.parse(bareJsonMatch[1]);
      if (timeline.layers && Array.isArray(timeline.layers)) {
        return timeline;
      }
    } catch (error) {
      // Fall through to fallback strategy
    }
  }

  // Strategy 3: Fallback - any JSON object (original logic)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${(error as Error).message}`);
  }
}

export { MODELS, extractTimelineJSON };
