import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import Logger from '../utils/logger';

// Load environment variables from .env file in project root
// Resolves from working directory (backend/) up to project root: backend/ -> project-root/.env
dotenv.config({ path: path.join(process.cwd(), '../.env') });

/**
 * Parallel AI API client wrapper with logging and cost tracking
 * Used by Internal Agent for research-backed recommendations
 */

const PARALLEL_API_URL = 'https://api.parallel.ai/v1beta/search';
const PARALLEL_API_KEY = process.env.PARALLEL_API_KEY;

// Research processors and pricing
const PROCESSORS = {
  BASE: 'base',
  PRO: 'pro',
} as const;

const PRICING = {
  [PROCESSORS.BASE]: 0.005, // $0.005 per query (faster, lighter)
  [PROCESSORS.PRO]: 0.05,   // $0.05 per query (deeper, more comprehensive)
};

interface ParallelSearchParams {
  objective: string;
  processor?: 'base' | 'pro';
  maxResults?: number;
}

interface ParallelSearchResult {
  searchId: string;
  objective: string;
  processor: string;
  results: Array<{
    url: string;
    title: string;
    excerpts: string[];
  }>;
  cost: number;
  duration: number;
}

/**
 * Execute a research query using Parallel AI
 * Returns structured research results with citations
 */
export async function research(params: ParallelSearchParams): Promise<ParallelSearchResult> {
  const startTime = Date.now();
  const processor = params.processor || PROCESSORS.PRO; // Default to pro for quality

  try {
    Logger.entry('parallelResearch', { objective: params.objective, processor });

    // Make API request to Parallel AI Search API
    const response = await axios.post(
      PARALLEL_API_URL,
      {
        objective: params.objective,
        processor,
        max_results: params.maxResults || 10,
      },
      {
        headers: {
          'x-api-key': PARALLEL_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: processor === PROCESSORS.PRO ? 300000 : 60000, // 5 min for pro, 1 min for base
      }
    );

    const duration = Date.now() - startTime;
    const cost = PRICING[processor as keyof typeof PRICING];

    const result: ParallelSearchResult = {
      searchId: response.data.search_id || '',
      objective: params.objective,
      processor,
      results: response.data.results || [],
      cost,
      duration,
    };

    // Log API call
    Logger.apiCall('parallel', {
      tier: processor,
      cost,
      duration,
    });

    // Log full research call
    Logger.llmCall({
      provider: 'parallel',
      role: 'internal',
      prompt: params,
      response: result,
      cost,
      duration,
    });

    Logger.exit('parallelResearch', { resultCount: result.results.length });

    return result;
  } catch (error) {
    Logger.error('Parallel AI research failed', error as Error, { params });
    throw error;
  }
}

/**
 * Quick research using base processor
 * Used for fast lookups, definitions, quick facts
 */
export async function quickResearch(objective: string): Promise<ParallelSearchResult> {
  return research({
    objective,
    processor: PROCESSORS.BASE,
    maxResults: 5,
  });
}

/**
 * Deep research using pro processor
 * Used for comprehensive research, architecture decisions, career planning
 */
export async function deepResearch(objective: string): Promise<ParallelSearchResult> {
  return research({
    objective,
    processor: PROCESSORS.PRO,
    maxResults: 10,
  });
}

/**
 * Research a career block (used by Internal Agent)
 * Returns skills, timeline, resources for a specific career goal
 */
export async function researchBlock(params: {
  blockTitle: string;
  blockDescription?: string;
  startAge: number;
  endAge: number;
  overallGoal: string;
  processor?: 'base' | 'pro';
}): Promise<ParallelSearchResult> {
  const objective = `
Research for career planning block: "${params.blockTitle}"

Context:
- Overall goal: ${params.overallGoal}
- Time period: Age ${params.startAge} to ${params.endAge} (${params.endAge - params.startAge} years)
- Description: ${params.blockDescription || 'Not provided'}

Find information about:
1. Key skills and competencies needed for this block
2. Typical timeline and milestones to achieve
3. Prerequisites and dependencies
4. Recommended resources, programs, and opportunities
5. Common pitfalls to avoid
6. Real-world examples of successful paths
  `.trim();

  return research({
    objective,
    processor: params.processor || PROCESSORS.PRO,
    maxResults: 8,
  });
}

export { PROCESSORS };
