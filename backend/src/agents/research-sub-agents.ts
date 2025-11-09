/**
 * RESEARCH SUB-AGENTS WITH PARALLEL AI INTEGRATION
 * Advanced sub-agents for deep research using Parallel AI API
 */

import axios from 'axios';
import { traceable } from 'langsmith/traceable';

// Load Parallel AI API key from environment (required for research features)
const PARALLEL_API_KEY = process.env.PARALLEL_API_KEY;
if (!PARALLEL_API_KEY) {
  throw new Error('PARALLEL_API_KEY environment variable is required for research functionality');
}

const PARALLEL_API_URL = 'https://api.parallel.ai/v1/tasks/runs';

// Research processor tiers
enum ResearchProcessor {
  LITE = 'lite',        // 5-60s, $0.005
  BASE = 'base',        // 30s-2m, $0.02
  PRO = 'pro',          // 1-3m, $0.10
  ULTRA = 'ultra',      // 2-5m, $0.30
  ULTRA2X = 'ultra2x',  // 3-7m, $0.60
  ULTRA4X = 'ultra4x',  // 5-10m, $1.20
  ULTRA8X = 'ultra8x'   // 10-20m, $2.40
}

/**
 * University Research Sub-Agent
 * Researches specific universities, programs, and admission requirements
 */
export const UniversityResearchAgent = traceable(
  async function researchUniversities(params: {
    goal: string;
    fieldOfStudy: string;
    location?: string;
    budget?: string;
  }) {
    const query = `
      Research the best universities and graduate programs for ${params.fieldOfStudy}.
      Focus on:
      - Top programs for ${params.goal}
      - Admission requirements and acceptance rates
      - Research opportunities and faculty
      - Funding options and scholarships
      ${params.location ? `- Programs in or near ${params.location}` : ''}
      ${params.budget ? `- Consider budget constraints: ${params.budget}` : ''}

      Provide specific, actionable information with program names, deadlines, and requirements.
    `;

    try {
      const response = await axios.post(
        PARALLEL_API_URL,
        {
          input: query,
          processor: ResearchProcessor.PRO,
          task_spec: {
            output_schema: 'Structured research results with specific university programs, admission requirements, deadlines, and recommendations'
          }
        },
        {
          headers: {
            'x-api-key': PARALLEL_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        data: response.data,
        processor: ResearchProcessor.PRO,
        cost: 0.10
      };
    } catch (error: any) {
      console.error('University research failed:', error.message);
      return {
        success: false,
        error: error.message,
        fallback: 'Using cached university data'
      };
    }
  },
  {
    name: 'UniversityResearchAgent',
    metadata: {
      subAgent: true,
      service: 'ParallelAI',
      type: 'research'
    }
  }
);

/**
 * Career Path Research Sub-Agent
 * Researches job market, salary trends, and career trajectories
 */
export const CareerPathResearchAgent = traceable(
  async function researchCareerPaths(params: {
    targetRole: string;
    currentSkills: string[];
    yearsOfExperience: number;
    location?: string;
  }) {
    const query = `
      Research career paths and job market for: ${params.targetRole}

      Current profile:
      - Skills: ${params.currentSkills.join(', ')}
      - Experience: ${params.yearsOfExperience} years
      ${params.location ? `- Location: ${params.location}` : ''}

      Provide:
      - Current job market demand and trends
      - Typical career progression paths
      - Salary ranges at different levels
      - Key companies hiring for these roles
      - Required skills vs current skills gap
      - Certifications that would help
    `;

    try {
      const response = await axios.post(
        PARALLEL_API_URL,
        {
          input: query,
          processor: ResearchProcessor.BASE,
          task_spec: {
            output_schema: 'Career path analysis with job market trends, salary data, skill requirements, and career progression paths'
          }
        },
        {
          headers: {
            'x-api-key': PARALLEL_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        data: response.data,
        processor: ResearchProcessor.BASE,
        cost: 0.02
      };
    } catch (error: any) {
      console.error('Career path research failed:', error.message);
      return {
        success: false,
        error: error.message,
        fallback: 'Using general career guidance'
      };
    }
  },
  {
    name: 'CareerPathResearchAgent',
    metadata: {
      subAgent: true,
      service: 'ParallelAI',
      type: 'research'
    }
  }
);

/**
 * Skills Gap Analysis Sub-Agent
 * Identifies missing skills and recommends learning resources
 */
export const SkillsGapAnalysisAgent = traceable(
  async function analyzeSkillsGap(params: {
    currentSkills: string[];
    targetRole: string;
    timeframe: string;
    learningStyle?: string;
  }) {
    const query = `
      Analyze skills gap for transitioning to: ${params.targetRole}

      Current skills: ${params.currentSkills.join(', ')}
      Timeframe: ${params.timeframe}
      ${params.learningStyle ? `Learning preference: ${params.learningStyle}` : ''}

      Provide:
      - Critical skills missing for target role
      - Priority order for learning
      - Best resources (courses, books, projects)
      - Estimated time to acquire each skill
      - Free vs paid learning options
      - Hands-on projects to demonstrate skills
    `;

    try {
      const response = await axios.post(
        PARALLEL_API_URL,
        {
          input: query,
          processor: ResearchProcessor.LITE,
          task_spec: {
            output_schema: 'Skills gap analysis with missing skills, learning resources, timelines, and actionable recommendations'
          }
        },
        {
          headers: {
            'x-api-key': PARALLEL_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        data: response.data,
        processor: ResearchProcessor.LITE,
        cost: 0.005
      };
    } catch (error: any) {
      console.error('Skills gap analysis failed:', error.message);
      return {
        success: false,
        error: error.message,
        fallback: 'Using standard skill recommendations'
      };
    }
  },
  {
    name: 'SkillsGapAnalysisAgent',
    metadata: {
      subAgent: true,
      service: 'ParallelAI',
      type: 'analysis'
    }
  }
);

/**
 * Timeline Optimization Sub-Agent
 * Optimizes timeline based on constraints and opportunities
 */
export const TimelineOptimizationAgent = traceable(
  async function optimizeTimeline(params: {
    blocks: any[];
    constraints: string[];
    priorities: string[];
    riskTolerance: 'low' | 'medium' | 'high';
  }) {
    const query = `
      Optimize this career timeline for maximum success probability:

      Timeline blocks: ${JSON.stringify(params.blocks, null, 2)}
      Constraints: ${params.constraints.join(', ')}
      Priorities: ${params.priorities.join(', ')}
      Risk tolerance: ${params.riskTolerance}

      Analyze and suggest:
      - Potential timeline compression opportunities
      - Risk mitigation strategies
      - Parallel path options
      - Contingency plans for setbacks
      - Key decision points and triggers
      - Success metrics for each phase
    `;

    try {
      const response = await axios.post(
        PARALLEL_API_URL,
        {
          input: query,
          processor: ResearchProcessor.PRO,
          task_spec: {
            output_schema: 'Timeline optimization recommendations with compression opportunities, risk mitigation, parallel paths, and success metrics'
          }
        },
        {
          headers: {
            'x-api-key': PARALLEL_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        data: response.data,
        processor: ResearchProcessor.PRO,
        cost: 0.10
      };
    } catch (error: any) {
      console.error('Timeline optimization failed:', error.message);
      return {
        success: false,
        error: error.message,
        fallback: 'Using standard timeline'
      };
    }
  },
  {
    name: 'TimelineOptimizationAgent',
    metadata: {
      subAgent: true,
      service: 'ParallelAI',
      type: 'optimization'
    }
  }
);

/**
 * Quick Research Sub-Agent
 * For fast, simple lookups (auto-approved, no user confirmation needed)
 */
export const QuickResearchAgent = traceable(
  async function quickResearch(params: { query: string }) {
    try {
      const response = await axios.post(
        PARALLEL_API_URL,
        {
          input: params.query,
          processor: ResearchProcessor.LITE,
          task_spec: {
            output_schema: 'Concise research answer with key facts and actionable information'
          }
        },
        {
          headers: {
            'x-api-key': PARALLEL_API_KEY,
            'Content-Type': 'application/json'
          },
          timeout: 60000 // 60 second timeout
        }
      );

      return {
        success: true,
        data: response.data,
        processor: ResearchProcessor.LITE,
        cost: 0.005
      };
    } catch (error: any) {
      console.error('Quick research failed:', error.message);
      return {
        success: false,
        error: error.message,
        fallback: 'Research unavailable'
      };
    }
  },
  {
    name: 'QuickResearchAgent',
    metadata: {
      subAgent: true,
      service: 'ParallelAI',
      type: 'quick-lookup',
      autoApproved: true
    }
  }
);

/**
 * Coordinator for all research sub-agents
 */
export class ResearchCoordinator {
  private totalCost: number = 0;
  private researchCount: number = 0;

  async runComprehensiveResearch(params: {
    goal: string;
    current: string;
    timeframe: string;
    constraints: string[];
  }) {
    console.log('Starting comprehensive research with sub-agents...');

    // Run research agents in parallel for speed
    const [university, career, skills] = await Promise.all([
      UniversityResearchAgent({
        goal: params.goal,
        fieldOfStudy: this.extractField(params.goal),
        location: this.extractLocation(params.constraints),
        budget: this.extractBudget(params.constraints)
      }),
      CareerPathResearchAgent({
        targetRole: params.goal,
        currentSkills: this.extractSkills(params.current),
        yearsOfExperience: this.extractExperience(params.current),
        location: this.extractLocation(params.constraints)
      }),
      SkillsGapAnalysisAgent({
        currentSkills: this.extractSkills(params.current),
        targetRole: params.goal,
        timeframe: params.timeframe
      })
    ]);

    // Track costs
    this.totalCost += (university.cost || 0) + (career.cost || 0) + (skills.cost || 0);
    this.researchCount += 3;

    return {
      universityResearch: university,
      careerResearch: career,
      skillsAnalysis: skills,
      totalCost: this.totalCost,
      researchCount: this.researchCount
    };
  }

  // Helper methods
  private extractField(goal: string): string {
    if (goal.toLowerCase().includes('ai') || goal.toLowerCase().includes('machine learning')) {
      return 'Artificial Intelligence and Machine Learning';
    }
    if (goal.toLowerCase().includes('data')) {
      return 'Data Science';
    }
    return 'Computer Science';
  }

  private extractLocation(constraints: string[]): string | undefined {
    const locationConstraint = constraints.find(c =>
      c.toLowerCase().includes('location') ||
      c.toLowerCase().includes('city') ||
      c.toLowerCase().includes('area')
    );
    return locationConstraint;
  }

  private extractBudget(constraints: string[]): string | undefined {
    const budgetConstraint = constraints.find(c =>
      c.toLowerCase().includes('budget') ||
      c.toLowerCase().includes('financial') ||
      c.toLowerCase().includes('cost')
    );
    return budgetConstraint;
  }

  private extractSkills(current: string): string[] {
    const skills = [];
    if (current.toLowerCase().includes('python')) skills.push('Python');
    if (current.toLowerCase().includes('javascript')) skills.push('JavaScript');
    if (current.toLowerCase().includes('machine learning')) skills.push('Machine Learning');
    if (current.toLowerCase().includes('programming')) skills.push('Programming');
    if (current.toLowerCase().includes('data')) skills.push('Data Analysis');
    return skills.length > 0 ? skills : ['General Technical Skills'];
  }

  private extractExperience(current: string): number {
    const match = current.match(/(\d+)\s*year/i);
    return match ? parseInt(match[1]) : 0;
  }

  getCostSummary() {
    return {
      totalCost: this.totalCost,
      researchCount: this.researchCount,
      averageCost: this.researchCount > 0 ? this.totalCost / this.researchCount : 0
    };
  }
}

// Export singleton coordinator
export const researchCoordinator = new ResearchCoordinator();