/**
 * Agent Context & Attention Mechanism
 *
 * This module defines the shared context structure that flows between all four agents
 * (Validation, Conversational, Internal, Configuration). Each agent writes what IT thinks
 * is important to the 'attention' field, creating an "attention mechanism" inspired by
 * "Attention Is All You Need."
 *
 * @module agent-context
 */

/**
 * User configuration for timeline generation
 */
export interface UserConfig {
  user_name: string;
  start_age: number;
  end_age: number;
  end_goal: string;
  num_layers: number;
}

/**
 * Validation Agent's attention contribution
 *
 * Written by Validation Agent after analyzing user input.
 * Highlights what information is missing and what constraints are critical.
 */
export interface ValidationAttention {
  /** Confidence score (0-100) that enough information exists to create timeline */
  confidence_score: number;

  /** Categories of missing information (e.g., "specific subfield interest", "timeline flexibility") */
  missing_information_categories: string[];

  /** Critical constraints that must be respected (e.g., "age 14-18 timeline", "bioengineering focus") */
  critical_constraints: string[];

  /** Areas that need special focus (e.g., "research vs clinical pathway", "geographic preferences") */
  focus_areas: string[];

  /** Questions to ask user if confidence < 95% */
  questions_to_ask?: string[];
}

/**
 * Conversational Agent's attention contribution
 *
 * Written by Conversational Agent after gathering clarifications.
 * Highlights what the user's true intent is and what preferences matter.
 */
export interface ConversationalAttention {
  /** Confidence score (0-100) that user's answers are clear and actionable */
  confidence_score: number;

  /** Clarified understanding of user's intent (e.g., "User wants computational biology focus with wet lab experience") */
  clarified_intent: string;

  /** Key requirements extracted from conversation (e.g., "Must include research publications", "Prefers East Coast schools") */
  key_requirements: string[];

  /** User preferences as key-value pairs (e.g., { "research_area": "CRISPR", "competition_level": "high" }) */
  user_preferences: Record<string, any>;
}

/**
 * Configuration Agent's attention contribution
 *
 * Written by Configuration Agent after generating timeline structure.
 * Highlights what was difficult to structure and what assumptions were made.
 */
export interface ConfigurationAttention {
  /** Confidence score (0-100) that generated timeline is high-quality */
  confidence_score: number;

  /** High-level description of generated structure (e.g., "3-layer timeline: foundation → specialization → application") */
  generated_structure: string;

  /** Blocks that were challenging to create (e.g., "Layer 2: Finding specific CRISPR research programs for high schoolers") */
  challenging_blocks: string[];

  /** Assumptions made during generation (e.g., "Assumed summer availability for internships") */
  assumptions_made: string[];
}

/**
 * Internal Agent's attention contribution
 *
 * Written by Internal Agent during conversational edits.
 * Highlights what changed and what needs research or adjustment.
 */
export interface InternalAttention {
  /** Confidence score (0-100) that changes are understood and can be applied */
  confidence_score: number;

  /** Detected changes from user's edit request (e.g., "Add focus on computational modeling in year 2-3") */
  detected_changes: string[];

  /** Specific blocks requiring attention (e.g., ["Layer 2, Block 3: Advanced Coursework", "Layer 3, Block 8: Research Timeline"]) */
  blocks_requiring_attention: string[];

  /** Research priorities for expensive operations (e.g., "Look up computational biology programs for high schoolers") */
  research_priorities: string[];
}

/**
 * Attention mechanism - each agent contributes what IT thinks is important
 *
 * This creates contextual awareness between agents:
 * - Validation highlights gaps → Conversational knows what to ask
 * - Conversational highlights intent → Configuration knows what to generate
 * - Configuration highlights challenges → Internal knows what to research
 * - Internal highlights changes → Configuration knows what to regenerate
 */
export interface Attention {
  validation_agent?: ValidationAttention;
  conversational_agent?: ConversationalAttention;
  configuration_agent?: ConfigurationAttention;
  internal_agent?: InternalAttention;
}

/**
 * Conversation message in agent context
 */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  agent: string;
  timestamp: string;
}

/**
 * Workflow tracking information
 */
export interface Workflow {
  /** Current stage of processing (e.g., "validation", "conversation", "configuration") */
  current_stage: string;

  /** Number of attempts made (increments on retries) */
  attempt_count: number;

  /** ISO timestamp when workflow started */
  started_at: string;

  /** ISO timestamp of last update */
  last_updated_at: string;
}

/**
 * Uploaded file metadata
 */
export interface UploadedFile {
  /** Original filename */
  originalname: string;

  /** Stored filename (unique) */
  filename: string;

  /** File path on server */
  path: string;

  /** MIME type */
  mimetype: string;

  /** File size in bytes */
  size: number;
}

/**
 * Complete Agent Context
 *
 * This is the shared state that flows between all agents. Size is typically 1-2KB.
 * Stored in database and passed via API calls.
 *
 * @example
 * ```typescript
 * const context: AgentContext = {
 *   user_config: {
 *     user_name: "Alex",
 *     start_age: 14,
 *     end_age: 18,
 *     end_goal: "Get accepted to MIT for Bioengineering",
 *     num_layers: 3
 *   },
 *   attention: {
 *     validation_agent: {
 *       confidence_score: 75,
 *       missing_information_categories: ["specific bioengineering subfield"],
 *       critical_constraints: ["age 14-18 timeline", "MIT admissions requirements"],
 *       focus_areas: ["research vs clinical pathway"],
 *       questions_to_ask: ["Which area of bioengineering interests you most?"]
 *     }
 *   },
 *   workflow: {
 *     current_stage: "validation",
 *     attempt_count: 1,
 *     started_at: "2025-01-26T10:00:00Z",
 *     last_updated_at: "2025-01-26T10:00:00Z"
 *   }
 * };
 * ```
 */
export interface AgentContext {
  /** Timeline ID (only present after initial generation) */
  timeline_id?: string;

  /** User configuration from initial form */
  user_config: UserConfig;

  /** Attention mechanism - each agent's contributions */
  attention: Attention;

  /** Conversation history (optional, for conversational edits) */
  conversation_history?: ConversationMessage[];

  /** Workflow tracking */
  workflow: Workflow;

  /** Uploaded files (resumes, transcripts, etc.) */
  uploaded_files?: UploadedFile[];
}

/**
 * Result from Validation Agent
 */
export interface ValidationResult {
  /** Is confidence >= 95%? */
  is_confident: boolean;

  /** Confidence score (0-100) */
  confidence_score: number;

  /** Questions to ask user (only if not confident) */
  questions?: string[];

  /** Updated attention field to write to context */
  attention: ValidationAttention;
}

/**
 * Result from Conversational Agent
 */
export interface ConversationalResult {
  /** Is confidence >= 95%? */
  is_confident: boolean;

  /** Confidence score (0-100) */
  confidence_score: number;

  /** Next question to ask (only if not confident) */
  next_question?: string;

  /** Assistant's response to show user */
  response: string;

  /** Updated attention field to write to context */
  attention: ConversationalAttention;
}

/**
 * Result from Internal Agent
 */
export interface InternalResult {
  /** Is confidence >= 95%? */
  is_confident: boolean;

  /** Confidence score (0-100) */
  confidence_score: number;

  /** Should we trigger expensive research? */
  should_research: boolean;

  /** Research queries (if should_research = true) */
  research_queries?: string[];

  /** Updated attention field to write to context */
  attention: InternalAttention;
}

/**
 * Result from Configuration Agent
 */
export interface ConfigurationResult {
  /** Is confidence >= 95%? */
  is_confident: boolean;

  /** Confidence score (0-100) */
  confidence_score: number;

  /** Generated timeline structure (only if confident) */
  timeline?: any;

  /** Issues preventing generation (only if not confident) */
  issues?: string[];

  /** Updated attention field to write to context */
  attention: ConfigurationAttention;
}
