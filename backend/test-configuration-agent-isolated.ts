/**
 * Isolated Test for Configuration Agent - Timeline Generation
 *
 * Purpose: Test the exact LLM prompt and tool schema that's failing in production
 * Issue: LLM is calling generate_timeline tool but with empty input: {}
 *
 * Root Cause Hypothesis:
 * - Prompt is instructing to "use the tool" but not being explicit about HOW to populate the input
 * - System prompt says "call the generate_timeline tool" but doesn't give examples
 * - Schema might be too complex for the model to understand without examples
 *
 * Test Strategy:
 * 1. Reproduce the exact failing prompt + schema from production
 * 2. Add detailed examples in the prompt
 * 3. Simplify language to be more explicit
 * 4. Test with direct Anthropic API call (no framework overhead)
 */

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
// Resolves from working directory (backend/) up to project root: backend/ -> project-root/.env
dotenv.config({ path: path.join(process.cwd(), '../.env') });

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Schema from production (lines 416-481 of configuration-agent.ts)
const schema = {
  name: 'generate_timeline',
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
    },
    required: ['layers'],
  },
};

// Test configuration (simplified from real user data)
const testConfig = {
  user_name: 'Vignan Kamarthi',
  start_age: 10,
  end_age: 60,
  num_layers: 3,
  end_goal: 'I want to become an AI Scientist',
};

// ORIGINAL FAILING PROMPT (from production - lines 378-413)
const originalSystemPrompt = `You are a career timeline generation expert. Use the generate_timeline tool to create a structured ${testConfig.num_layers}-layer career timeline.

CRITICAL CONSTRAINTS:
- Layer 1 blocks: 4-20 years each
- Layer 2 blocks: 0-5 years each
- Layer 3 blocks: 0-1 years each
- No gaps or overlaps between blocks
- All layers span from age ${testConfig.start_age} to ${testConfig.end_age}
- duration_years = end_age - start_age (must be exact)

Generate a comprehensive timeline covering the entire journey from age ${testConfig.start_age} to achieving the goal by age ${testConfig.end_age}.

You MUST call the generate_timeline tool with the complete timeline structure.`;

const originalUserPrompt = `Generate a ${testConfig.num_layers}-layer career timeline for ${testConfig.user_name}.

GOAL: ${testConfig.end_goal}
AGE RANGE: ${testConfig.start_age} to ${testConfig.end_age} years old
LAYERS: ${testConfig.num_layers}

Create detailed, actionable blocks for each layer that build toward the goal. Use the generate_timeline tool with the complete timeline structure.`;

// NEW IMPROVED PROMPT (with explicit instructions and examples)
const improvedSystemPrompt = `You are a career timeline generation expert. You will receive a career goal and age range, and you must create a detailed ${testConfig.num_layers}-layer timeline.

CRITICAL: You MUST call the generate_timeline tool and populate the "layers" array in the tool input. DO NOT return empty input {}.

STRUCTURE REQUIREMENTS:
- Create ${testConfig.num_layers} layers (Layer 1, Layer 2, Layer 3)
- All layers span from age ${testConfig.start_age} to ${testConfig.end_age}
- Layer 1: Broad phases (4-20 years each block)
- Layer 2: Medium detail (0-5 years each block)
- Layer 3: Fine detail (0-1 years each block)
- No gaps or overlaps between blocks in each layer
- duration_years = end_age - start_age (exact calculation)

EXAMPLE STRUCTURE (DO NOT COPY, GENERATE BASED ON USER'S GOAL):
{
  "layers": [
    {
      "layer_number": 1,
      "title": "Career Journey Overview",
      "start_age": 10,
      "end_age": 60,
      "blocks": [
        {
          "title": "Foundation Building",
          "description": "Build educational foundation",
          "start_age": 10,
          "end_age": 22,
          "duration_years": 12
        },
        {
          "title": "Professional Growth",
          "description": "Develop career expertise",
          "start_age": 22,
          "end_age": 60,
          "duration_years": 38
        }
      ]
    }
  ]
}

IMPORTANT: This is just an example structure. Generate a REAL timeline based on the user's specific goal and create all ${testConfig.num_layers} layers with appropriate blocks.`;

const improvedUserPrompt = `Create a ${testConfig.num_layers}-layer career timeline for ${testConfig.user_name}.

GOAL: ${testConfig.end_goal}
AGE RANGE: ${testConfig.start_age} to ${testConfig.end_age} years old

Call the generate_timeline tool with a "layers" array containing ${testConfig.num_layers} layer objects. Each layer must have appropriate blocks that guide the user from age ${testConfig.start_age} to age ${testConfig.end_age} to achieve their goal.`;

// Test function
async function testPrompt(systemPrompt: string, userPrompt: string, testName: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST: ${testName}`);
  console.log('='.repeat(80));
  console.log('\nSYSTEM PROMPT:');
  console.log(systemPrompt);
  console.log('\nUSER PROMPT:');
  console.log(userPrompt);

  try {
    const startTime = Date.now();
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      temperature: 1.0,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      tools: [
        {
          name: schema.name,
          description: schema.description,
          input_schema: schema.schema,
        },
      ],
      tool_choice: { type: 'tool', name: schema.name },
    });

    const duration = Date.now() - startTime;

    console.log(`\nAPI CALL SUCCESSFUL (${duration}ms)`);
    console.log(`Token Usage: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`);
    console.log(`Cost: $${(response.usage.input_tokens * 0.000003 + response.usage.output_tokens * 0.000015).toFixed(6)}`);

    // Check for tool use
    const toolUse = response.content.find((block) => block.type === 'tool_use');

    if (!toolUse || toolUse.type !== 'tool_use') {
      console.log('\nERROR: No tool_use found in response');
      console.log('Response content:', JSON.stringify(response.content, null, 2));
      return false;
    }

    console.log(`\nTOOL CALLED: ${toolUse.name}`);
    console.log(`TOOL INPUT KEYS: ${Object.keys(toolUse.input).join(', ')}`);

    // Check if input is empty
    if (Object.keys(toolUse.input).length === 0) {
      console.log('\nFAILURE: Tool input is empty {}');
      console.log('Full response:', JSON.stringify(response.content, null, 2));
      return false;
    }

    // Check if layers exist
    const input = toolUse.input as any;
    if (!input.layers || !Array.isArray(input.layers) || input.layers.length === 0) {
      console.log('\nFAILURE: No layers in tool input');
      console.log('Tool input:', JSON.stringify(toolUse.input, null, 2));
      return false;
    }

    console.log(`\nSUCCESS: Generated ${input.layers.length} layers`);
    console.log(`\nTIMELINE PREVIEW:`);
    input.layers.forEach((layer: any) => {
      console.log(`  Layer ${layer.layer_number}: "${layer.title}" (${layer.blocks?.length || 0} blocks)`);
      if (layer.blocks && Array.isArray(layer.blocks)) {
        layer.blocks.forEach((block: any) => {
          console.log(`    - ${block.title} (age ${block.start_age}-${block.end_age})`);
        });
      }
    });

    return true;
  } catch (error) {
    console.log('\nAPI ERROR:', error);
    return false;
  }
}

// Run tests
async function main() {
  console.log('CONFIGURATION AGENT ISOLATED TEST');
  console.log('Testing why LLM returns empty tool input {}');
  console.log(`Model: claude-sonnet-4-5-20250929`);
  console.log(`Goal: ${testConfig.end_goal}`);
  console.log(`Age Range: ${testConfig.start_age}-${testConfig.end_age}`);
  console.log(`Layers: ${testConfig.num_layers}`);

  // Test 1: Original failing prompt
  const originalResult = await testPrompt(
    originalSystemPrompt,
    originalUserPrompt,
    'ORIGINAL PROMPT (from production)'
  );

  // Small delay to avoid rate limiting
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Improved prompt with explicit examples
  const improvedResult = await testPrompt(
    improvedSystemPrompt,
    improvedUserPrompt,
    'IMPROVED PROMPT (with explicit structure example)'
  );

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Original Prompt: ${originalResult ? 'PASS' : 'FAIL'}`);
  console.log(`Improved Prompt: ${improvedResult ? 'PASS' : 'FAIL'}`);

  if (!originalResult && improvedResult) {
    console.log('\nROOT CAUSE CONFIRMED: Prompt needs explicit structure example');
    console.log('   The model needs to see HOW to populate the tool input, not just be told to use it.');
  } else if (originalResult) {
    console.log('\nUNEXPECTED: Original prompt worked in isolation');
    console.log('   Issue may be with context size or previous conversation history');
  } else if (!improvedResult) {
    console.log('\nDEEPER ISSUE: Neither prompt works');
    console.log('   Problem may be with schema definition or tool setup');
  }
}

main().catch(console.error);
