# 95% Confidence-Based Multi-Agent Architecture

**The Complete Technical Reference**

This document describes the entire agent orchestration framework that powers Career Trajectory AI. Every component, every decision, every interaction pattern is explained here.

---

## Code Architecture Map

**Where everything lives in the codebase:**

### Core 4-Agent Workflow (Pre-Generation)

| Agent | File | Main Function | Purpose |
|-------|------|---------------|---------|
| 1. Pre-Validation Agent | `backend/src/agents/pre-validation-agent.ts` | `analyzeInitialInput()` | Analyzes initial input, identifies missing info |
| 2. Conversational Clarification Agent | `backend/src/agents/conversational-clarification-agent.ts` | `gatherClarifications()` | Asks questions until 95% confident |
| 3. Internal Review Agent | `backend/src/agents/internal-agent.ts` | `reviewBeforeGeneration()` | Quality gate, determines research needs |
| 4. Configuration Agent | `backend/src/agents/configuration-agent.ts` | `generateWithContext()` | Generates timeline with full context |

### Research Sub-Agents (Optional AI Research)

| Agent | File | Main Function | Purpose |
|-------|------|---------------|---------|
| University Research Agent | `backend/src/agents/research-sub-agents.ts` | `researchUniversities()` | University program analysis |
| Career Path Research Agent | `backend/src/agents/research-sub-agents.ts` | `researchCareerPaths()` | Industry pathway research |
| Skills Gap Analysis Agent | `backend/src/agents/research-sub-agents.ts` | `analyzeSkillsGap()` | Skill requirement mapping |
| Timeline Optimization Agent | `backend/src/agents/research-sub-agents.ts` | `optimizeTimeline()` | Timeline efficiency analysis |
| Quick Research Agent | `backend/src/agents/research-sub-agents.ts` | `quickResearch()` | Fast fact-checking |

### Utility Functions (Supporting Features)

| Function | File | Purpose |
|----------|------|---------|
| Post-Generation Chat | `backend/src/agents/conversational-assistant.ts` | `chat()`, `chatStream()` | Chat about existing timeline |
| Timeline Validation | `backend/src/agents/validation-agent.ts` | `validateAndCorrectTimeline()` | Validates timeline structure |
| Refactor Analysis | `backend/src/agents/internal-agent.ts` | `analyzeStateChanges()`, `researchBlocks()`, etc. | Refactor save mode utilities |

### API Routes

| Route | File | Implements |
|-------|------|-----------|
| POST `/api/configure-with-context/init` | `backend/src/routes/configure-with-context.ts` | Initialize context, run Pre-Validation Agent |
| POST `/api/configure-with-context/clarify` | `backend/src/routes/configure-with-context.ts` | Conversational clarification loop |
| POST `/api/configure-with-context/generate` | `backend/src/routes/configure-with-context.ts` | Generate timeline with context |
| POST `/api/chat` | `backend/src/routes/chat.ts` | Post-generation chat |
| POST `/api/save` | `backend/src/routes/save.ts` | Save with refactor analysis |
| POST `/api/analyze` | `backend/src/routes/analyze.ts` | Analyze timeline changes |

### Services (External APIs)

| Service | File | Wraps |
|---------|------|-------|
| Anthropic Service | `backend/src/services/anthropic.ts` | Claude Sonnet 4.5 API calls |
| Parallel Service | `backend/src/services/parallel.ts` | Parallel AI research API (9 tiers) |

### Database

| Table | Schema | Purpose |
|-------|--------|---------|
| `agent_contexts` | `backend/src/database/schema.sql` | Stores shared context between agents |
| `timelines` | `backend/src/database/schema.sql` | User timeline metadata |
| `layers` | `backend/src/database/schema.sql` | Timeline layers |
| `blocks` | `backend/src/database/schema.sql` | Timeline blocks with hard constraints |
| `conversations` | `backend/src/database/schema.sql` | Chat history (pre & post generation) |

### Types

| Type | File | Purpose |
|------|------|---------|
| `AgentContext` | `backend/src/types/agent-context.ts` | Shared context with attention mechanism |
| `Attention` | `backend/src/types/agent-context.ts` | All agent contributions |
| `ValidationResult` | `backend/src/types/agent-context.ts` | Pre-Validation Agent output |
| `ConversationalResult` | `backend/src/types/agent-context.ts` | Conversational Clarification Agent output |
| `InternalResult` | `backend/src/types/agent-context.ts` | Internal Review Agent output |
| `ConfigurationResult` | `backend/src/types/agent-context.ts` | Configuration Agent output |

---

## Table of Contents

1. [Code Architecture Map](#code-architecture-map) - Where everything lives
2. [Core Principle: 95% Confidence Threshold](#core-principle)
3. [The Four Agents](#the-four-agents)
4. [Agent Context & Attention Mechanism](#agent-context--attention-mechanism)
5. [Conservative Assumption Policy](#conservative-assumption-policy)
6. [Complete Workflow Diagrams](#complete-workflow-diagrams)
7. [Implementation Details](#implementation-details)
8. [Hard Constraints & Validation Rules](#hard-constraints--validation-rules)
9. [API Contract](#api-contract)
10. [Cost Tracking](#cost-tracking)
11. [Observability & Debugging](#observability--debugging)

---

## Core Principle

### The 95% Confidence Threshold

**Every agent must be AT LEAST 95% confident before proceeding to the next step.**

```
Confidence < 95% → Ask questions → Get more info → Retry
Confidence ≥ 95% → Proceed to next agent
```

This threshold prevents premature generation, eliminates wrong assumptions, and ensures high-quality output.

### Why 95%?

- **90% is too low:** Allows too much uncertainty, leading to errors
- **99% is too high:** Agents would ask excessive questions for diminishing returns
- **95% is the sweet spot:** High confidence without over-questioning

---

## The Four Agents

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   USER INPUT                                                        │
│   ↓                                                                 │
│   VALIDATION AGENT ────→ Questions? ────→ CONVERSATIONAL AGENT     │
│   ↓                                       ↓                         │
│   Confident? ←──────────────────────────┘                         │
│   ↓                                                                 │
│   INTERNAL AGENT                                                    │
│   ↓                                                                 │
│   CONFIGURATION AGENT                                               │
│   ↓                                                                 │
│   VALIDATION AGENT (Error Correction)                              │
│   ↓                                                                 │
│   TIMELINE OUTPUT                                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Agent 1: Pre-Validation Agent

**Role:** Information gap analysis & error correction

**Two Modes:**

1. **Pre-Generation Analysis**
   - Input: User's initial form data
   - Task: Determine if enough information exists to generate timeline
   - Output: Either confidence ≥95% OR list of questions

2. **Post-Generation Error Correction**
   - Input: Generated timeline from Configuration Agent
   - Task: Validate constraints, intelligently fix errors
   - Output: Corrected timeline OR failure if unfixable

**Confidence Criteria:**
- "I am AT LEAST 95% confident I have enough information to construct a valid timeline"
- OR "I am AT LEAST 95% confident I can fix all validation errors"

**Key Behavior:**
```typescript
if (hasEnoughInformation && confidence >= 0.95) {
  return { confident: true };
} else {
  return {
    confident: false,
    questions: generateTargetedQuestions(),
    missing_categories: identifyGaps()
  };
}
```

### Agent 2: Conversational Clarification Agent

**Role:** Clarification through dialogue

**Responsibilities:**
- Ask questions generated by Pre-Validation Agent
- Understand user's answers
- Validate that answers are helpful for other agents
- Continue questioning until confident

**Confidence Criteria:**
- "I am AT LEAST 95% confident the answers the user has given me will be helpful for the validation and construction agents"

**Key Behavior:**
```typescript
if (userAnswersAreHelpful && confidence >= 0.95) {
  return {
    confident: true,
    clarified_intent: extractedIntent,
    key_requirements: extractedRequirements
  };
} else {
  return {
    confident: false,
    follow_up_questions: askForClarification()
  };
}
```

**Prevents:**
- Redundant questions (reads Pre-Validation Agent's context)
- Ambiguous answers being passed forward
- Misunderstanding user intent

### Agent 3: Internal Review Agent

**Role:** Final quality gate before expensive operations

**Responsibilities:**
- Review all context from previous agents
- Verify changes are feasible
- Approve/reject construction
- Determine research priorities

**Confidence Criteria:**
- "I am AT LEAST 95% confident the requested changes are:
  1. Technically feasible within constraints
  2. Clearly understood
  3. Won't break existing timeline structure"

**Key Behavior:**
```typescript
if (changesAreFeasible && nothingAmbiguous && confidence >= 0.95) {
  return {
    confident: true,
    approve_construction: true,
    research_priorities: determineResearch()
  };
} else {
  return {
    confident: false,
    concerns: listSpecificIssues(),
    return_to_conversational: true
  };
}
```

**Prevents:**
- Running expensive Parallel research on unclear goals
- Triggering reconstruction when timeline would break
- Wasting API costs on low-confidence workflows

### Agent 4: Configuration Agent

**Role:** Timeline structure generation

**Responsibilities:**
- Generate timeline with layers and blocks
- Respect all hard constraints
- Use full context from all agents
- Document any assumptions made

**Confidence Criteria:**
- "I am AT LEAST 95% confident I can generate a valid timeline that meets all hard bounds with the given information"

**Key Behavior:**
```typescript
// Reads ALL agent context
const context = {
  validation_focus: validationAgent.focus_areas,
  user_preferences: conversationalAgent.key_requirements,
  research_priorities: internalAgent.research_priorities
};

// Generates timeline WITH full awareness
const timeline = generateWithContext(config, context);

// Documents what was challenging
return {
  timeline,
  challenging_blocks: selfReportDifficulties(),
  assumptions_made: listAssumptions()
};
```

**Uses:**
- Pre-Validation Agent's focus areas → knows what's critical
- Conversational Clarification Agent's clarified intent → refined goal
- Internal Review Agent's research priorities → what to emphasize

---

## Agent Context & Attention Mechanism

### The Core Innovation

Inspired by "Attention Is All You Need", agents communicate through a shared lightweight JSON context where each agent highlights what **IT** thinks is important.

### AgentContext Structure

```typescript
interface AgentContext {
  // Core timeline info
  timeline_id?: string;
  user_config: {
    user_name: string;
    start_age: number;
    end_age: number;
    end_goal: string;
    num_layers: number;
  };

  // ═══ ATTENTION MECHANISM ═══
  // Each agent writes what IT thinks is important
  attention: {
    validation_agent?: {
      confidence_score: number;           // 0.0-1.0
      missing_information_categories: string[];  // LLM-determined categories
      critical_constraints: string[];     // What MUST be respected
      focus_areas: string[];              // What's most important
    };

    conversational_agent?: {
      confidence_score: number;
      clarified_intent: string;           // Refined understanding
      key_requirements: string[];         // User-confirmed needs
      user_preferences: Record<string, any>;  // Extracted preferences
    };

    configuration_agent?: {
      confidence_score: number;
      generated_structure: string;        // Timeline summary
      challenging_blocks: string[];       // What was hard to generate
      assumptions_made: string[];         // What agent assumed
    };

    internal_agent?: {
      confidence_score: number;
      detected_changes: string[];         // What changed
      blocks_requiring_attention: string[];  // Special care needed
      research_priorities: string[];      // Focus research here
    };
  };

  // Conversation history
  conversation_history?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    agent: 'validation' | 'conversational' | 'configuration' | 'internal';
    timestamp: string;
  }>;

  // Previous results for validation
  previous_results?: {
    validation_questions?: Question[];
    user_answers?: Record<string, string>;
    generated_timeline?: GeneratedTimeline;
    corrections_made?: string[];
  };

  // Workflow state
  workflow: {
    current_stage: 'validation_analysis' | 'conversational_clarification' |
                   'configuration_generation' | 'internal_gate' | 'reconstruction';
    attempt_count: number;
    started_at: string;
    last_updated_at: string;
  };
}
```

### How Attention Flows

**Example: "Get into MIT for bioengineering" with minimal info**

```
Step 1: VALIDATION AGENT
────────────────────────────────────────────────
Input: { end_goal: "Get into MIT for bioengineering" }

Analyzes: "MIT bioengineering" is too vague
Confidence: 0.68 (< 95%)

Writes to context.attention.validation_agent:
{
  confidence_score: 0.68,
  missing_information_categories: ["bioengineering_subfield", "academic_plan"],
  focus_areas: ["bioengineering specialization", "prerequisite courses"]
}

Returns: Questions about subfield


Step 2: CONVERSATIONAL AGENT
────────────────────────────────────────────────
READS context.attention.validation_agent.focus_areas
Sees: ["bioengineering specialization", "prerequisite courses"]

Asks targeted questions:
- "Which bioengineering area? (CRISPR, tissue engineering, etc.)"
- "What courses are you planning?"

User answers: "CRISPR gene therapy, planning AP Bio + AP Chem"

Writes to context.attention.conversational_agent:
{
  confidence_score: 0.97,
  clarified_intent: "CRISPR gene therapy focus for MIT bioengineering",
  key_requirements: ["CRISPR focus", "AP Bio", "AP Chem"],
  user_preferences: { subfield: "CRISPR", courses: ["AP Bio", "AP Chem"] }
}


Step 3: VALIDATION AGENT (Re-evaluation)
────────────────────────────────────────────────
READS context.attention.conversational_agent
Sees clarified intent and key requirements

Re-evaluates: NOW has specific subfield and courses
Confidence: 0.98 (≥ 95%)

Updates context.attention.validation_agent:
{
  confidence_score: 0.98,
  missing_information_categories: [],
  critical_constraints: ["CRISPR focus required"],
  focus_areas: ["CRISPR research timeline", "AP Biology → genetics path"]
}

Approves for generation


Step 4: INTERNAL AGENT
────────────────────────────────────────────────
READS all attention fields:
- validation_agent.critical_constraints: ["CRISPR focus required"]
- validation_agent.focus_areas: ["CRISPR research timeline"]
- conversational_agent.key_requirements: ["CRISPR focus", "AP Bio", "AP Chem"]

Determines: Ready for construction, needs CRISPR research
Confidence: 0.96

Writes to context.attention.internal_agent:
{
  confidence_score: 0.96,
  research_priorities: ["CRISPR programs", "gene therapy internships"],
  blocks_requiring_attention: []
}


Step 5: CONFIGURATION AGENT
────────────────────────────────────────────────
READS ALL attention fields

Injects into LLM prompt:
"CRITICAL CONSTRAINTS: CRISPR focus required
 FOCUS AREAS: CRISPR research timeline, AP Biology → genetics path
 USER REQUIREMENTS: CRISPR focus, AP Bio, AP Chem
 RESEARCH PRIORITIES: CRISPR programs, gene therapy internships"

Generates timeline WITH full context awareness
Creates blocks that align with CRISPR focus
Includes AP Bio → genetics pathway
Plans for CRISPR research opportunities

Writes to context.attention.configuration_agent:
{
  confidence_score: 0.95,
  challenging_blocks: ["Research Experience block - tight 1-year window"],
  assumptions_made: []
}
```

### Benefits of Attention Mechanism

1. **No Redundant Questions**
   ```
    Without Context:
   Validation: "What bioengineering area?"
   User: "CRISPR"
   Conversational: "Tell me about your bioengineering interests?"  ← REDUNDANT

    With Context:
   Validation: "What bioengineering area?"
   User: "CRISPR"
   Conversational: [READS context, sees bioengineering discussed]
   Conversational: "Any specific CRISPR applications interest you?"  ← BUILDS ON PREVIOUS
   ```

2. **Full Contextual Awareness**
   - Configuration Agent knows what Validation thinks is critical
   - Internal Review Agent sees what Conversational confirmed with user
   - Everyone has complete picture

3. **Debugging & Observability**
   - Full trace of agent decisions
   - Can replay workflows from context
   - Confidence scores show decision points

4. **Scalability**
   - Easy to add new agents (just add to attention object)
   - Context is lightweight (~1-2KB JSON)
   - Can be passed via API or stored in DB

---

## Conservative Assumption Policy

### The Golden Rule

**DEFAULT: ASK, NOT ASSUME**

Agents make assumptions ONLY when ALL of these are true:
1.  Information is readily available (factual, not inferred)
2.  Information is universal (not person-specific)
3.  Assumption is inconsequential to final plan
4.  Agent has AT LEAST 95% confidence assumption won't matter

### Acceptable Assumptions (Very Rare)

| Assumption | Why Acceptable |
|------------|----------------|
| `duration = end_age - start_age` | Pure mathematics |
| `create num_layers layers` | Direct user instruction |
| `blocks must be sequential` | Hard constraint |

### Unacceptable Assumptions (Must Ask)

| Bad Assumption | Why Unacceptable | What to Do |
|----------------|------------------|------------|
| "SAT in junior year" | Person-specific pattern | Ask: "When do you want SAT prep?" |
| "Assume 2-3 activities" | General inference | Ask: "How many extracurriculars?" |
| "MIT → wants research" | Presumptuous | Ask: "Want research experience?" |
| "No gap years mentioned → continuous" | Affects plan structure | Ask: "Continuous or gap years?" |
| "Bioengineering → lab focus" | Subfield assumption | Ask: "Which bioengineering area?" |

### Prompt Engineering Template

Every agent uses this in its system prompt:

```typescript
const systemPrompt = `[Agent role]

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

UNACCEPTABLE assumptions (ask instead):
- "Typical" patterns (e.g., "SAT in junior year")
- User preferences (e.g., "probably wants research")
- Context-based inferences (e.g., "MIT → competitive")
- Demographic assumptions (e.g., "young → parent involvement")

When in doubt: ASK.

If you make an assumption, you MUST:
1. Document it in assumptions_made[]
2. Explain why ≥95% confident it's inconsequential
3. Mark for Pre-Validation Agent review
`;
```

### Example: Testing the Policy

**Input:**
```json
{
  "user_name": "Alex",
  "start_age": 14,
  "end_age": 18,
  "end_goal": "Get into MIT",
  "num_layers": 3
}
```

**WRONG Response (Old System):**
```json
{
  "confident": true,
  "timeline": {
    "layers": [
      {
        "blocks": [
          {"title": "AP Biology and Chemistry"},  // ← ASSUMED subjects
          {"title": "SAT Prep (Junior Year)"},    // ← ASSUMED timing
          {"title": "Research Internship"}        // ← ASSUMED interest
        ]
      }
    ]
  }
}
```

**RIGHT Response (95% Confidence System):**
```json
{
  "confident": false,
  "confidence_score": 0.65,
  "questions": [
    {
      "category": "end_goal_specificity",
      "question": "Which MIT program interests you? (e.g., Engineering, Computer Science, Biology)",
      "why_needed": "Different programs have different prerequisite paths"
    },
    {
      "category": "academic_plan",
      "question": "Do you want to take AP classes? If so, which subjects?",
      "why_needed": "Determines academic preparation timeline"
    },
    {
      "category": "testing",
      "question": "Are you planning to take the SAT or ACT? When?",
      "why_needed": "Affects preparation block timing"
    },
    {
      "category": "experience",
      "question": "Are you interested in research, internships, or other experiences?",
      "why_needed": "Determines experiential learning blocks"
    }
  ]
}
```

---

## Complete Workflow Diagrams

### Scenario 1: Initial Timeline Generation

```
                    ┌─────────────────────┐
                    │   USER FILLS FORM   │
                    │  - Name: Alex       │
                    │  - Ages: 14-18      │
                    │  - Goal: Get MIT    │
                    │  - Layers: 3        │
                    └──────────┬──────────┘
                               │
                               ▼
              ┌─────────────────────────────────────┐
              │  POST /api/configure/generate       │
              └──────────────┬──────────────────────┘
                             │
                             ▼
        ╔════════════════════════════════════════════════╗
        ║  VALIDATION AGENT: Pre-Generation Analysis     ║
        ╠════════════════════════════════════════════════╣
        ║  • Creates empty AgentContext                  ║
        ║  • Analyzes: "Enough info to generate?"        ║
        ║  • Evaluates: end_goal specificity, constraints║
        ║                                                ║
        ║  Confidence Check:                             ║
        ║  ├─ Has specific program? NO                   ║
        ║  ├─ Has academic plan? NO                      ║
        ║  ├─ Has timeline constraints? NO               ║
        ║  └─ Confidence: 0.65 < 0.95                 ║
        ╚═══════════════════┬════════════════════════════╝
                            │
                ┌───────────┴──────────┐
                │                      │
         Confident (≥95%)      Not Confident (<95%)
                │                      │
                │ (Skip for now)       ▼
                │          ┌─────────────────────────────────┐
                │          │  Pre-Validation Agent Generates:    │
                │          │  1. Targeted questions          │
                │          │  2. Missing info categories     │
                │          │  3. Focus areas                 │
                │          │                                 │
                │          │  Writes to AgentContext:        │
                │          │  attention.validation_agent {   │
                │          │    confidence_score: 0.65,      │
                │          │    missing: ["program",         │
                │          │             "academics"],       │
                │          │    focus: ["MIT program",       │
                │          │            "preparation"]       │
                │          │  }                              │
                │          └────────────┬────────────────────┘
                │                       │
                │                       ▼
                │          ┌─────────────────────────────────┐
                │          │  RETURN TO FRONTEND             │
                │          │  {                              │
                │          │    confident: false,            │
                │          │    context_id: "ctx_123",       │
                │          │    questions: [                 │
                │          │      "Which MIT program?",      │
                │          │      "Academic plan?"           │
                │          │    ]                            │
                │          │  }                              │
                │          └────────────┬────────────────────┘
                │                       │
                │                       ▼
                │          ┌─────────────────────────────────┐
                │          │  USER ANSWERS IN CHAT UI        │
                │          │  "Bioengineering, CRISPR focus" │
                │          │  "Plan AP Bio, AP Chem"         │
                │          └────────────┬────────────────────┘
                │                       │
                │                       ▼
                │          ┌─────────────────────────────────┐
                │          │  POST /api/chat/continue-setup  │
                │          │  { context_id, answers }        │
                │          └────────────┬────────────────────┘
                │                       │
                │                       ▼
                │          ╔══════════════════════════════════╗
                │          ║  CONVERSATIONAL AGENT            ║
                │          ╠══════════════════════════════════╣
                │          ║  • READS validation context      ║
                │          ║  • Sees focus_areas flagged      ║
                │          ║  • Processes user answers        ║
                │          ║                                  ║
                │          ║  Confidence Check:               ║
                │          ║  ├─ Answers helpful? YES         ║
                │          ║  ├─ Clear intent? YES            ║
                │          ║  └─ Confidence: 0.97 ≥ 0.95   ║
                │          ║                                  ║
                │          ║  Writes to AgentContext:         ║
                │          ║  attention.conversational {      ║
                │          ║    confidence_score: 0.97,       ║
                │          ║    clarified_intent:             ║
                │          ║      "CRISPR gene therapy",      ║
                │          ║    key_requirements:             ║
                │          ║      ["CRISPR", "AP Bio",        ║
                │          ║       "AP Chem"]                 ║
                │          ║  }                               ║
                │          ╚══════════════┬═══════════════════╝
                │                         │
                │                         ▼
                │          ┌─────────────────────────────────┐
                │          │  Signals: Ready for generation  │
                │          └────────────┬────────────────────┘
                │                       │
                └───────────────────────┘
                            │
                            ▼
        ╔════════════════════════════════════════════════╗
        ║  VALIDATION AGENT: Re-evaluation               ║
        ╠════════════════════════════════════════════════╣
        ║  • READS conversational context                ║
        ║  • Sees clarified_intent + key_requirements    ║
        ║  • Re-evaluates with new information           ║
        ║                                                ║
        ║  Confidence Check:                             ║
        ║  ├─ Specific program? YES (Bioengineering)     ║
        ║  ├─ Academic plan? YES (AP Bio, AP Chem)       ║
        ║  └─ Confidence: 0.98 ≥ 0.95                 ║
        ║                                                ║
        ║  Updates AgentContext:                         ║
        ║  attention.validation_agent {                  ║
        ║    confidence_score: 0.98,                     ║
        ║    missing: [],                                ║
        ║    critical_constraints:                       ║
        ║      ["CRISPR focus required"],                ║
        ║    focus_areas:                                ║
        ║      ["CRISPR research timeline"]              ║
        ║  }                                             ║
        ╚═══════════════════┬════════════════════════════╝
                            │
                            ▼
        ╔════════════════════════════════════════════════╗
        ║  INTERNAL AGENT: Final Gate                    ║
        ╠════════════════════════════════════════════════╣
        ║  • READS ALL attention fields                  ║
        ║  • Reviews:                                    ║
        ║    - validation critical_constraints           ║
        ║    - conversational key_requirements           ║
        ║  • Determines research needs                   ║
        ║                                                ║
        ║  Confidence Check:                             ║
        ║  ├─ Feasible? YES                              ║
        ║  ├─ Clear? YES                                 ║
        ║  └─ Confidence: 0.96 ≥ 0.95                 ║
        ║                                                ║
        ║  Writes to AgentContext:                       ║
        ║  attention.internal_agent {                    ║
        ║    confidence_score: 0.96,                     ║
        ║    research_priorities:                        ║
        ║      ["CRISPR programs",                       ║
        ║       "gene therapy internships"]              ║
        ║  }                                             ║
        ║                                                ║
        ║  Decision: APPROVE CONSTRUCTION                ║
        ╚═══════════════════┬════════════════════════════╝
                            │
                            ▼
        ╔════════════════════════════════════════════════╗
        ║  CONFIGURATION AGENT: Generate Timeline        ║
        ╠════════════════════════════════════════════════╣
        ║  • READS ALL attention fields                  ║
        ║  • Injects into LLM prompt:                    ║
        ║    "CRITICAL: CRISPR focus required"           ║
        ║    "FOCUS: CRISPR research timeline"           ║
        ║    "REQUIREMENTS: AP Bio, AP Chem"             ║
        ║                                                ║
        ║  • Generates timeline structure                ║
        ║  • Creates 3 layers with blocks                ║
        ║  • Aligns all blocks with CRISPR focus         ║
        ║                                                ║
        ║  Confidence: 0.95                            ║
        ║                                                ║
        ║  Writes to AgentContext:                       ║
        ║  attention.configuration_agent {               ║
        ║    challenging_blocks:                         ║
        ║      ["Research block - tight timing"],        ║
        ║    assumptions_made: []                        ║
        ║  }                                             ║
        ╚═══════════════════┬════════════════════════════╝
                            │
                            ▼
        ╔════════════════════════════════════════════════╗
        ║  VALIDATION AGENT: Error Correction            ║
        ╠════════════════════════════════════════════════╣
        ║  • Validates generated timeline                ║
        ║  • Checks:                                     ║
        ║    - Layer 1 blocks: 4-10 years              ║
        ║    - Layer 2 blocks: 0-5 years               ║
        ║    - Layer 3 blocks: 0-1 years               ║
        ║    - No gaps, no overlaps                    ║
        ║    - Duration calculations exact             ║
        ║                                                ║
        ║  Result: ALL VALIDATIONS PASS                  ║
        ║  Confidence: 1.0                             ║
        ║  No corrections needed                         ║
        ╚═══════════════════┬════════════════════════════╝
                            │
                            ▼
                ┌─────────────────────────┐
                │  PARALLEL RESEARCH      │
                │  (if enabled)           │
                │                         │
                │  Research priorities:   │
                │  - CRISPR programs      │
                │  - Gene therapy jobs    │
                └────────┬────────────────┘
                         │
                         ▼
                ┌─────────────────────────┐
                │  SAVE TO DATABASE       │
                │  - Timeline             │
                │  - Layers               │
                │  - Blocks               │
                │  - Context              │
                └────────┬────────────────┘
                         │
                         ▼
                ┌─────────────────────────┐
                │  RETURN TO FRONTEND     │
                │  {                      │
                │    confident: true,     │
                │    timeline: {...},     │
                │    layers: [...],       │
                │    blocks: [...],       │
                │    costs: {...}         │
                │  }                      │
                └─────────────────────────┘
```

### Scenario 2: Editing Existing Timeline

```
                ┌─────────────────────┐
                │  USER IN CHAT UI    │
                │  "Add AP Chemistry  │
                │   to sophomore year"│
                └──────────┬──────────┘
                           │
                           ▼
          ┌─────────────────────────────────┐
          │  POST /api/chat                 │
          │  {                              │
          │    timeline_id: "123",          │
          │    message: "Add AP Chem..."    │
          │  }                              │
          └──────────┬──────────────────────┘
                     │
                     ▼
╔═══════════════════════════════════════════════════╗
║  CONVERSATIONAL AGENT: Understand Request         ║
╠═══════════════════════════════════════════════════╣
║  • Loads existing timeline context                ║
║  • Analyzes user request                          ║
║  • Evaluates: "Do I understand the change?"       ║
║                                                   ║
║  Confidence Check:                                ║
║  ├─ Clear what to add? YES (AP Chemistry)         ║
║  ├─ Clear when? YES (sophomore year)              ║
║  ├─ Clear how to integrate? YES                   ║
║  └─ Confidence: 0.96 ≥ 0.95                    ║
║                                                   ║
║  Writes to AgentContext:                          ║
║  attention.conversational_agent {                 ║
║    clarified_intent: "Add AP Chem to year 2",     ║
║    key_requirements: ["AP Chemistry",             ║
║                       "sophomore timing"]         ║
║  }                                                ║
╚════════════════════┬══════════════════════════════╝
                     │
                     ▼
╔═══════════════════════════════════════════════════╗
║  VALIDATION AGENT: Change Feasibility             ║
╠═══════════════════════════════════════════════════╣
║  • READS conversational context                   ║
║  • Evaluates: "Can this change be made?"          ║
║  • Checks:                                        ║
║    - Constraint conflicts? NO                     ║
║    - Space in sophomore year? YES                 ║
║    - Breaks existing blocks? NO                   ║
║                                                   ║
║  Confidence Check:                                ║
║  ├─ Technically feasible? YES                     ║
║  ├─ Clear implementation? YES                     ║
║  └─ Confidence: 0.97 ≥ 0.95                    ║
╚════════════════════┬══════════════════════════════╝
                     │
                     ▼
╔═══════════════════════════════════════════════════╗
║  INTERNAL AGENT: Final Gate                       ║
╠═══════════════════════════════════════════════════╣
║  • READS all context                              ║
║  • Reviews feasibility                            ║
║  • Determines research needs                      ║
║                                                   ║
║  Confidence Check:                                ║
║  ├─ Won't break timeline? YES                     ║
║  ├─ Clear instructions? YES                       ║
║  └─ Confidence: 0.98 ≥ 0.95                    ║
║                                                   ║
║  Decision: APPROVE RECONSTRUCTION                 ║
║                                                   ║
║  Writes to AgentContext:                          ║
║  attention.internal_agent {                       ║
║    approve_reconstruction: true,                  ║
║    research_priorities:                           ║
║      ["AP Chemistry curriculum"]                  ║
║  }                                                ║
╚════════════════════┬══════════════════════════════╝
                     │
                     ▼
          ┌──────────────────────┐
          │  PARALLEL RESEARCH   │
          │  (if needed)         │
          │  Research AP Chem    │
          └──────────┬───────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │  UPDATE DATABASE     │
          │  Add AP Chem block   │
          └──────────┬───────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │  RETURN UPDATED      │
          │  TIMELINE            │
          └──────────────────────┘
```

---

## Implementation Details

### Database Schema

```sql
-- Timelines
CREATE TABLE timelines (
  id VARCHAR(36) PRIMARY KEY,
  user_name VARCHAR(255),
  start_age REAL,
  end_age REAL,
  end_goal TEXT,
  num_layers INTEGER,
  global_research_model VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Layers
CREATE TABLE layers (
  id VARCHAR(36) PRIMARY KEY,
  timeline_id VARCHAR(36),
  layer_number INTEGER,
  title VARCHAR(255),
  start_age REAL,
  end_age REAL,
  FOREIGN KEY (timeline_id) REFERENCES timelines(id)
);

-- Blocks
CREATE TABLE blocks (
  id VARCHAR(36) PRIMARY KEY,
  layer_id VARCHAR(36),
  layer_number INTEGER,
  position INTEGER,
  title VARCHAR(255),
  description TEXT,
  start_age REAL,
  end_age REAL,
  duration_years REAL,
  status VARCHAR(50),
  research_data TEXT,
  FOREIGN KEY (layer_id) REFERENCES layers(id)
);

-- Agent Contexts (for persistence)
CREATE TABLE agent_contexts (
  id VARCHAR(36) PRIMARY KEY,
  timeline_id VARCHAR(36),
  context_json TEXT,
  stage VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (timeline_id) REFERENCES timelines(id)
);

-- Chat History
CREATE TABLE chat_messages (
  id VARCHAR(36) PRIMARY KEY,
  timeline_id VARCHAR(36),
  role VARCHAR(50),
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (timeline_id) REFERENCES timelines(id)
);
```

### TypeScript Interfaces

```typescript
// User Configuration
interface UserConfig {
  user_name: string;
  start_age: number;
  end_age: number;
  end_goal: string;
  num_layers: number;
  global_research_model?: 'lite' | 'base' | 'core' | 'core2x' |
                          'pro' | 'ultra' | 'ultra2x' | 'ultra4x' | 'ultra8x';
}

// Generated Structures
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

// Question Format
interface Question {
  id: string;
  category: string;
  question: string;
  why_needed: string;
  suggestions?: string[];
}

// Agent Responses
interface ValidationAnalysisResult {
  confident: boolean;
  confidence_score: number;
  questions?: Question[];
  missing_information_categories?: string[];
  critical_constraints?: string[];
  focus_areas?: string[];
}

interface ConversationalResult {
  confident: boolean;
  confidence_score: number;
  clarified_intent?: string;
  key_requirements?: string[];
  user_preferences?: Record<string, any>;
  follow_up_questions?: Question[];
}

interface InternalGateResult {
  confident: boolean;
  confidence_score: number;
  approve_construction: boolean;
  research_priorities?: string[];
  blocks_requiring_attention?: string[];
  concerns?: string[];
}

interface ConfigurationResult {
  timeline: GeneratedTimeline;
  confidence_score: number;
  challenging_blocks?: string[];
  assumptions_made?: string[];
  cost: number;
}

interface ValidationCorrectionResult {
  isValid: boolean;
  errors: string[];
  correctedTimeline?: GeneratedTimeline;
  corrections: string[];
  cost: number;
}
```

---

## Hard Constraints & Validation Rules

### Layer Duration Bounds

**CRITICAL - MUST BE ENFORCED:**

| Layer | Min Duration | Max Duration | Purpose |
|-------|--------------|--------------|---------|
| Layer 1 | 4.0 years | 10.0 years | Broad phases |
| Layer 2 | 0.0 years | 5.0 years | Specific milestones |
| Layer 3 | 0.0 years | 1.0 years | Monthly actions |

### Validation Rules

1. **Timeline Coverage**
   ```typescript
   // Each layer MUST span full timeline
   layer.start_age === config.start_age
   layer.end_age === config.end_age
   ```

2. **No Gaps**
   ```typescript
   // Next block starts exactly where previous ended
   block[i].start_age === block[i-1].end_age
   // Tolerance: 0.01 for floating point
   ```

3. **No Overlaps**
   ```typescript
   // Blocks within a layer cannot overlap
   block[i].start_age >= block[i-1].end_age
   ```

4. **Exact Duration**
   ```typescript
   // Duration must be exact
   block.duration_years === block.end_age - block.start_age
   // Tolerance: 0.01 for floating point
   ```

5. **Layer Count**
   ```typescript
   // Must match user request
   timeline.layers.length === config.num_layers
   ```

### Error Correction Strategy

When Pre-Validation Agent finds errors:

1. **Deterministic Check** - Fast, rule-based validation
2. **If errors found** → Call Pre-Validation Agent LLM
3. **LLM intelligently corrects** - Preserves intent, fixes constraints
4. **Re-validate** - Ensure all errors fixed
5. **If still errors** → FAIL (don't generate bad timeline)

---

## API Contract

### POST /api/configure/generate

**Initial Request:**
```typescript
{
  user_name: string;
  start_age: number;
  end_age: number;
  end_goal: string;
  num_layers: number;
  global_research_model?: string;
}
```

**Response (Not Confident):**
```typescript
{
  confident: false;
  context_id: string;
  questions: Question[];
  missing_categories: string[];
}
```

**Response (Confident):**
```typescript
{
  confident: true;
  timeline: {
    id: string;
    user_name: string;
    start_age: number;
    end_age: number;
    end_goal: string;
    num_layers: number;
  };
  layers: Layer[];
  blocks: Block[];
  costs: {
    anthropic: number;
    parallel: number;
    total: number;
  };
  correctionsMade: string[];
}
```

### POST /api/chat/continue-setup

**Request:**
```typescript
{
  context_id: string;
  answers: Record<string, string>;
}
```

**Response (Still Not Confident):**
```typescript
{
  confident: false;
  context_id: string;
  follow_up_questions: Question[];
}
```

**Response (Now Confident):**
```typescript
{
  confident: true;
  context_id: string;
  ready: true;
  message: string;
}
```

### POST /api/chat

**Request:**
```typescript
{
  timeline_id: string;
  message: string;
}
```

**Response:**
```typescript
{
  message: string;
  costs: {
    anthropic: number;
    parallel: number;
    total: number;
  };
}
```

---

## Cost Tracking

### Separate Tracking by Provider

```typescript
interface CostBreakdown {
  anthropic: number;  // All agent LLM calls
  parallel: number;   // Parallel AI research
  total: number;      // Sum of both
}
```

### Cost Sources

**Anthropic (Claude Sonnet 4.5):**
- Pre-Validation Agent analysis: ~$0.05-0.10
- Pre-Validation Agent correction: ~$0.05-0.15
- Conversational Clarification Agent: ~$0.03-0.07 per exchange
- Configuration Agent: ~$0.10-0.30
- Internal Review Agent: ~$0.02-0.05

**Parallel AI (per research call):**
- Lite: $0.005
- Core: $0.025
- Pro: $0.100
- Ultra8x: $2.400

### Logging

Every agent call logs:
```typescript
Logger.apiCall('anthropic', {
  model: 'claude-sonnet-4-20250514',
  inputTokens: 1500,
  outputTokens: 800,
  cost: 0.0165,
  duration: 2300
});
```

---

## Observability & Debugging

### LangSmith Tracing

Every agent wrapped with `traceable`:

```typescript
import { traceable } from 'langsmith/traceable';

export const tracedValidationAgent = traceable(
  async function validateAndCorrect(input, anthropicFn) {
    return await anthropicFn();
  },
  {
    name: 'ValidationAgent.validateAndCorrect',
    metadata: { agent: 'ValidationAgent' }
  }
);
```

**View traces:** https://smith.langchain.com

### Structured Logging

```typescript
Logger.entry('functionName', { params });
Logger.info('message', { context });
Logger.error('error', error, { context });
Logger.exit('functionName', { result });
Logger.llmCall({
  provider: 'anthropic',
  role: 'validation',
  prompt,
  response,
  tokens: { input, output },
  cost,
  duration
});
```

### Debug Workflow

1. **Check LangSmith traces** - See exact prompts/responses
2. **Review logs** - Confidence scores, decisions
3. **Inspect AgentContext** - What each agent saw
4. **Validate constraints** - Which rules failed

---

## Summary

This architecture implements:

 **95% Confidence Threshold** - Every agent verified before proceeding
 **Agent Context & Attention** - Shared awareness, no redundancy
 **Conservative Assumptions** - Ask first, assume only when certain
 **Four Specialized Agents** - Clear roles, clear responsibilities
 **Intelligent Error Correction** - LLM-based constraint fixing
 **Full Observability** - Traces, logs, cost tracking
 **Hard Constraint Enforcement** - Validated timelines only

**Result:** Reliable, personalized, validated career timelines through confidence-based multi-agent orchestration.

---

## Academic Citations and Credits

This architecture builds upon foundational work in multi-agent systems, confidence-based coordination, and async agent patterns. For full academic attribution and proper citations of influences, see:

**[CITATIONS_AND_CREDITS.md](./CITATIONS_AND_CREDITS.md)** - Complete academic attribution for:
- Multi-agent system architecture influences
- Confidence threshold methodologies
- Chain of agents pattern references
- Twitter/X academic community discussions
- Framework and library credits
- Future research directions

---

**Last Updated:** 2025-10-30
**Version:** 1.0.0
