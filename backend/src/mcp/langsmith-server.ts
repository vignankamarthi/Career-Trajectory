#!/usr/bin/env node

/**
 * LangSmith MCP Server
 *
 * Provides tools to query LangSmith traces for debugging and analysis
 * Allows Claude Code to iteratively test and improve the agent system
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const LANGSMITH_API_KEY = process.env.LANGCHAIN_API_KEY;
const LANGSMITH_PROJECT = process.env.LANGCHAIN_PROJECT || 'career-trajectory';
const LANGSMITH_API_URL = 'https://api.smith.langchain.com';

// Create MCP server
const server = new Server(
  {
    name: 'langsmith-tracer',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_recent_traces',
        description: 'List recent traces from LangSmith for the career-trajectory project',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of traces to return (default: 10)',
              default: 10,
            },
            agent_name: {
              type: 'string',
              description: 'Filter by agent name (ConfigurationAgent, ConversationalAssistant, InternalAgent)',
            },
          },
        },
      },
      {
        name: 'get_trace_details',
        description: 'Get detailed information about a specific trace',
        inputSchema: {
          type: 'object',
          properties: {
            trace_id: {
              type: 'string',
              description: 'The trace ID to fetch',
            },
          },
          required: ['trace_id'],
        },
      },
      {
        name: 'analyze_agent_performance',
        description: 'Analyze performance metrics for a specific agent',
        inputSchema: {
          type: 'object',
          properties: {
            agent_name: {
              type: 'string',
              description: 'Agent to analyze (ConfigurationAgent, ConversationalAssistant, InternalAgent)',
            },
            time_range: {
              type: 'string',
              description: 'Time range: 1h, 24h, 7d (default: 24h)',
              default: '24h',
            },
          },
          required: ['agent_name'],
        },
      },
      {
        name: 'search_traces_by_error',
        description: 'Find traces that resulted in errors',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of error traces to return',
              default: 10,
            },
          },
        },
      },
    ],
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_recent_traces':
        return await listRecentTraces(args.limit || 10, args.agent_name);

      case 'get_trace_details':
        return await getTraceDetails(args.trace_id);

      case 'analyze_agent_performance':
        return await analyzeAgentPerformance(args.agent_name, args.time_range || '24h');

      case 'search_traces_by_error':
        return await searchTracesByError(args.limit || 10);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
    };
  }
});

/**
 * List recent traces
 */
async function listRecentTraces(limit: number, agentName?: string) {
  const response = await axios.get(`${LANGSMITH_API_URL}/runs`, {
    headers: {
      'x-api-key': LANGSMITH_API_KEY,
    },
    params: {
      project: LANGSMITH_PROJECT,
      limit,
      ...(agentName && { filter: `name:"${agentName}"` }),
    },
  });

  const traces = response.data.map((trace: any) => ({
    id: trace.id,
    name: trace.name,
    start_time: trace.start_time,
    end_time: trace.end_time,
    status: trace.status,
    error: trace.error,
    latency_ms: trace.latency ? Math.round(trace.latency * 1000) : null,
  }));

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(traces, null, 2),
      },
    ],
  };
}

/**
 * Get trace details
 */
async function getTraceDetails(traceId: string) {
  const response = await axios.get(`${LANGSMITH_API_URL}/runs/${traceId}`, {
    headers: {
      'x-api-key': LANGSMITH_API_KEY,
    },
  });

  const trace = response.data;

  const details = {
    id: trace.id,
    name: trace.name,
    start_time: trace.start_time,
    end_time: trace.end_time,
    status: trace.status,
    error: trace.error,
    inputs: trace.inputs,
    outputs: trace.outputs,
    latency_ms: trace.latency ? Math.round(trace.latency * 1000) : null,
    token_usage: trace.token_usage,
    child_runs: trace.child_runs?.length || 0,
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(details, null, 2),
      },
    ],
  };
}

/**
 * Analyze agent performance
 */
async function analyzeAgentPerformance(agentName: string, timeRange: string) {
  // Convert time range to hours
  const hours = timeRange === '1h' ? 1 : timeRange === '7d' ? 168 : 24;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const response = await axios.get(`${LANGSMITH_API_URL}/runs`, {
    headers: {
      'x-api-key': LANGSMITH_API_KEY,
    },
    params: {
      project: LANGSMITH_PROJECT,
      filter: `name:"${agentName}"`,
      start_time: since,
    },
  });

  const traces = response.data;

  const analysis = {
    agent: agentName,
    time_range: timeRange,
    total_runs: traces.length,
    successful_runs: traces.filter((t: any) => t.status === 'success').length,
    failed_runs: traces.filter((t: any) => t.status === 'error').length,
    avg_latency_ms: traces.length
      ? Math.round(
          traces.reduce((sum: number, t: any) => sum + (t.latency || 0), 0) /
            traces.length *
            1000
        )
      : 0,
    total_tokens: traces.reduce(
      (sum: number, t: any) => sum + (t.token_usage?.total_tokens || 0),
      0
    ),
    recent_errors: traces
      .filter((t: any) => t.error)
      .slice(0, 5)
      .map((t: any) => ({
        trace_id: t.id,
        error: t.error,
        timestamp: t.start_time,
      })),
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(analysis, null, 2),
      },
    ],
  };
}

/**
 * Search traces by error
 */
async function searchTracesByError(limit: number) {
  const response = await axios.get(`${LANGSMITH_API_URL}/runs`, {
    headers: {
      'x-api-key': LANGSMITH_API_KEY,
    },
    params: {
      project: LANGSMITH_PROJECT,
      filter: 'error:*',
      limit,
    },
  });

  const errorTraces = response.data.map((trace: any) => ({
    id: trace.id,
    name: trace.name,
    error: trace.error,
    timestamp: trace.start_time,
    inputs: trace.inputs,
  }));

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(errorTraces, null, 2),
      },
    ],
  };
}

/**
 * Start server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('LangSmith MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
