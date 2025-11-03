# Career Trajectory AI - Codebase Exploration Guide

## Navigate This Repo Like a Production Engineer

This guide provides role-based navigation paths through the codebase with specific file/line references. Skip to your role or follow the "First-Time Reviewer" path.

---

## Table of Contents
1. [First-Time Reviewers](#first-time-reviewers)
2. [Frontend Developers](#frontend-developers)
3. [Backend/API Engineers](#backend-engineers)
4. [AI/ML Engineers](#ai-ml-engineers)
5. [DevOps/Infrastructure](#devops-infrastructure)
6. [Key Code Patterns to Look For](#key-patterns)
7. [Testing Entry Points](#testing-entry-points)
8. [Tracing a Feature End-to-End](#tracing-features)

---

## 1. First-Time Reviewers {#first-time-reviewers}

**Goal**: Understand the system at a high level, then dive into key implementation details.

### Step-by-Step Exploration Path

#### Phase 1: Documentation (15 minutes)
1. **Start here**: `REVIEW_DOCUMENTATION/01_HIGH_LEVEL.md`
   - Understand the problem, solution, and architectural decisions
   - Key sections: "Core Innovation", "System Architecture", "Key Architectural Decisions"

2. **Then read**: `README.md`
   - Quick start guide, feature list, cost structure
   - Visual diagrams showing agent flow

3. **Then skim**: `CURRENT_AGENT_ARCHITECTURE.md`
   - Technical implementation details for async research + WebSocket
   - Performance metrics table

#### Phase 2: Backend Core (20 minutes)
4. **Entry point**: `backend/src/server.ts`
   - Lines 1-50: Server initialization, middleware setup
   - Lines 70-90: WebSocket integration
   - Lines 95-120: Database constraint testing

5. **Agent orchestration**: `backend/src/agents/chain-coordinator.ts`
   - Lines 15-40: ChainCoordinator class structure
   - Lines 60-100: executeChain() method (sequential agent execution)
   - Lines 120-150: spawnResearchTask() (async background tasks)

6. **Async research**: `backend/src/services/parallel-mcp.ts`
   - Lines 20-50: createResearchTask() (returns task ID immediately)
   - Lines 80-120: executeResearch() (background execution)
   - Lines 150-180: clearOldTasks() (memory management)

#### Phase 3: Frontend Core (15 minutes)
7. **Entry point**: `frontend/src/App.tsx`
   - Lines 1-30: Context providers (Theme, ResearchTier, React Query)
   - Lines 40-60: WebSocket integration via useWebSocket()
   - Lines 80-100: Router setup

8. **WebSocket client**: `frontend/src/hooks/useWebSocket.ts`
   - Lines 20-50: Auto-connect logic
   - Lines 70-100: Message handling (research_started, research_complete)
   - Lines 120-150: Auto-reconnect with 3s delay

9. **Timeline display**: `frontend/src/views/TimelineView.tsx`
   - Lines 30-60: Timeline data fetching
   - Lines 100-150: LayerView rendering (pyramid visual)
   - Lines 200-250: BlockEditor modal integration

#### Phase 4: Key Patterns (10 minutes)
10. **Error handling**: `backend/src/utils/UserError.ts`
    - Lines 1-30: UserError class definition
    - Lines 50-80: Express error middleware
    - Note: Separates user-facing vs internal errors

11. **Type safety**: `backend/src/utils/validation.ts`
    - Lines 1-40: Zod schemas for runtime validation
    - Lines 60-90: UserConfigSchema with refinements

12. **Research tier selection**: `frontend/src/contexts/ResearchTierContext.tsx`
    - Lines 1-50: Global tier state management
    - Lines 70-100: localStorage persistence
    - Lines 120-150: RESEARCH_TIERS array (9 tiers)

**After completing Phase 4, you understand 80% of the system's core logic.**

---

## 2. Frontend Developers {#frontend-developers}

**Goal**: Understand React component hierarchy, state management, and UI patterns.

### Component Tree Exploration

```
App.tsx (root)
├── ThemeProvider (dark mode)
├── ResearchTierProvider (global tier selection)
├── QueryClientProvider (server state)
└── Router
    ├── Navigation (always visible)
    │   ├── HomeButton (conditional)
    │   ├── ThemeToggle
    │   └── PricingButton → PricingModal
    ├── ConversationalConfigView (route: /)
    │   ├── Initial form input
    │   ├── Clarification questions (iterative)
    │   └── Timeline generation trigger
    └── TimelineView (route: /timeline/:id)
        ├── LayerView (for each layer)
        │   └── TimelineBlock (for each block)
        │       ├── Pulsing blue dot (if researching)
        │       └── Green glow border (if complete)
        ├── BlockEditor (modal, conditional)
        └── ResearchNotificationContainer (toasts)
```

### File-by-File Frontend Guide

#### Core Application
1. **`frontend/src/main.tsx`** (entry point)
   - Lines 1-10: React 18 createRoot
   - Lines 15-20: StrictMode wrapping

2. **`frontend/src/App.tsx`** (root component)
   - Lines 1-30: Context setup (Theme, ResearchTier, Query)
   - Lines 40-60: WebSocket hook integration
   - Lines 80-100: React Router v6 setup
   - Lines 120-150: Notification container + error modal

#### State Management
3. **`frontend/src/contexts/ThemeContext.tsx`**
   - Lines 1-30: Dark mode state + localStorage sync
   - Lines 40-60: ThemeProvider component

4. **`frontend/src/contexts/ResearchTierContext.tsx`**
   - Lines 1-50: ResearchTier type definitions (9 tiers)
   - Lines 70-100: Global tier state + setters
   - Lines 120-150: RESEARCH_TIERS array (pricing data)

#### Custom Hooks
5. **`frontend/src/hooks/useWebSocket.ts`**
   - Lines 1-30: WebSocket connection state
   - Lines 40-70: Auto-connect on mount
   - Lines 90-120: Message handler (switch statement)
   - Lines 150-180: Auto-reconnect logic (3s delay)
   - Lines 200-230: Cleanup on unmount

#### UI Components
6. **`frontend/src/components/Navigation.tsx`**
   - Lines 1-30: Navigation state (pricing modal open/close)
   - Lines 50-80: Pricing button with tier badge
   - Lines 100-130: Theme toggle
   - Lines 150-180: Home button (conditional rendering)

7. **`frontend/src/components/PricingModal.tsx`**
   - Lines 1-50: Modal overlay + close on click outside
   - Lines 70-120: Table layout (processor, cost, best for, latency, action)
   - Lines 150-200: Tier selection logic (highlights selected)
   - Lines 220-250: Close button

8. **`frontend/src/components/TimelineBlock.tsx`**
   - Lines 1-40: Block props (title, description, ages, research state)
   - Lines 60-90: Click handler (opens BlockEditor)
   - Lines 110-140: Pulsing blue dot (if isResearching)
   - Lines 160-190: Green glow animation (if isComplete)
   - Lines 210-240: Age range display

9. **`frontend/src/components/BlockEditor.tsx`**
   - Lines 1-50: Modal state (open/close, form fields)
   - Lines 80-120: Form handling (title, description, ages)
   - Lines 150-200: Research buttons (Quick vs Deep)
   - Lines 230-270: Save logic (updates timeline)

10. **`frontend/src/components/ResearchNotification.tsx`**
    - Lines 1-40: Toast notification component
    - Lines 60-90: Auto-dismiss after 5 seconds
    - Lines 110-140: Icon selection based on type
    - Lines 160-190: Color coding (blue/green/red/yellow)

#### Views (Pages)
11. **`frontend/src/views/ConversationalConfigView.tsx`**
    - Lines 1-60: Initial form (name, ages, goal, layers)
    - Lines 80-140: Clarification loop (iterative questions)
    - Lines 170-220: Timeline generation trigger
    - Lines 250-300: Loading states + error handling

12. **`frontend/src/views/TimelineView.tsx`**
    - Lines 1-50: Timeline fetching via React Query
    - Lines 80-130: LayerView rendering (pyramid scale)
    - Lines 160-210: Chat interface for edits
    - Lines 240-290: Export button

#### API Client
13. **`frontend/src/lib/api-client.ts`**
    - Lines 1-40: Axios client configuration
    - Lines 60-100: Timeline endpoints (get, create, update, delete)
    - Lines 120-160: Research endpoints (trigger, status)
    - Lines 180-220: Chat endpoints (send message, get history)

### Key Frontend Patterns

**Pattern 1: Optimistic Updates**
```typescript
// BlockEditor.tsx - Lines 250-270
const handleSave = async () => {
  // Update UI immediately
  setBlocks(prev => prev.map(b => b.id === block.id ? updatedBlock : b));

  try {
    await apiClient.blocks.update(block.id, updatedBlock);
  } catch (error) {
    // Rollback on error
    setBlocks(prev => prev.map(b => b.id === block.id ? originalBlock : b));
    showError(error);
  }
};
```

**Pattern 2: WebSocket State Synchronization**
```typescript
// useWebSocket.ts - Lines 90-120
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'research_started':
      setResearchingBlocks(prev => new Set(prev).add(data.blockId));
      break;
    case 'research_complete':
      setResearchingBlocks(prev => { prev.delete(data.blockId); return new Set(prev); });
      setCompletedBlocks(prev => new Set(prev).add(data.blockId));
      break;
  }
};
```

**Pattern 3: React Query Cache Invalidation**
```typescript
// TimelineView.tsx - Lines 200-220
const { mutate: updateBlock } = useMutation({
  mutationFn: (block) => apiClient.blocks.update(block.id, block),
  onSuccess: () => {
    // Invalidate timeline cache - triggers refetch
    queryClient.invalidateQueries(['timeline', timelineId]);
  }
});
```

---

## 3. Backend/API Engineers {#backend-engineers}

**Goal**: Understand API routes, database interactions, and business logic.

### API Route Map

```
/api
├── /configure-with-context
│   ├── POST /init                    # Start timeline creation
│   ├── POST /clarify                 # Clarification questions
│   ├── POST /review                  # Internal review
│   ├── POST /generate                # Generate timeline
│   └── GET /history                  # Timeline list
├── /timelines
│   ├── GET /:id                      # Fetch timeline
│   ├── GET /:id/export               # Export for LLM
│   ├── PUT /:id                      # Update timeline
│   └── DELETE /:id                   # Soft delete
├── /blocks
│   ├── GET /:id                      # Fetch block
│   ├── PUT /:id                      # Update block
│   ├── POST /:id/research            # Trigger research
│   └── GET /:id/research/status      # Check research status
├── /chat
│   └── POST /:timelineId             # Conversational editing
└── /test
    ├── GET /websocket                # WebSocket test page
    └── POST /research                # Trigger test research
```

### File-by-File Backend Guide

#### Entry Point
1. **`backend/src/server.ts`**
   - Lines 1-30: Express app initialization
   - Lines 40-70: Middleware (CORS, JSON parsing, logging)
   - Lines 80-110: WebSocket server integration
   - Lines 130-160: Route mounting
   - Lines 180-210: Error handling middleware
   - Lines 230-250: Graceful shutdown (SIGTERM handler)

#### Agents
2. **`backend/src/agents/pre-validation.ts`**
   - Lines 1-40: Confidence calculation algorithm
   - Lines 60-100: Missing field detection
   - Lines 120-160: LangChain model invocation
   - Lines 180-220: Response parsing + validation

3. **`backend/src/agents/conversational.ts`**
   - Lines 1-50: Conversation history management
   - Lines 70-120: Question generation logic
   - Lines 140-190: Information density calculation
   - Lines 210-260: Confidence update algorithm

4. **`backend/src/agents/internal-review.ts`**
   - Lines 1-40: Context validation
   - Lines 60-100: Logical consistency checks
   - Lines 120-170: Final confidence gate (95% threshold)

5. **`backend/src/agents/configuration.ts`**
   - Lines 1-60: Timeline generation prompt construction
   - Lines 80-140: LangChain invocation (90% threshold)
   - Lines 160-220: Response parsing (JSON extraction)
   - Lines 240-300: Database insertion (atomic transaction)

6. **`backend/src/agents/chain-coordinator.ts`**
   - Lines 1-50: ChainCoordinator class structure
   - Lines 70-130: executeChain() (sequential agent calls)
   - Lines 150-200: spawnResearchTask() (async background)
   - Lines 220-270: mergeAgentResults() (context accumulation)

7. **`backend/src/agents/research-sub-agents.ts`**
   - Lines 1-60: UniversityResearchAgent
   - Lines 80-140: CareerPathResearchAgent
   - Lines 160-220: SkillsGapAnalysisAgent
   - Lines 240-300: TimelineOptimizationAgent
   - Lines 320-380: QuickResearchAgent

#### Services
8. **`backend/src/services/parallel-mcp.ts`**
   - Lines 1-50: ParallelMCPService class
   - Lines 70-130: createResearchTask() (task queue insertion)
   - Lines 150-220: executeResearch() (background execution)
   - Lines 240-290: clearOldTasks() (15min TTL cleanup)
   - Lines 310-360: checkTaskStatus() (REST API for status)

9. **`backend/src/services/parallel-research.ts`**
   - Lines 1-40: Parallel AI API client setup
   - Lines 60-120: executeResearch() (HTTP request)
   - Lines 140-190: Error handling (401, 429, timeout)
   - Lines 210-250: Cost tracking

#### WebSocket
10. **`backend/src/websocket/research-websocket.ts`**
    - Lines 1-50: ResearchWebSocketServer class
    - Lines 70-120: Connection handler (heartbeat setup)
    - Lines 140-190: Broadcast logic (to all connected clients)
    - Lines 210-260: Event notifications (started, complete, error)

#### Database
11. **`backend/src/database/db.ts`**
    - Lines 1-40: SQLite client initialization
    - Lines 60-100: execute() (parameterized queries)
    - Lines 120-170: Transaction helpers (BEGIN, COMMIT, ROLLBACK)
    - Lines 190-240: testConstraints() (validation on startup)

12. **`backend/src/database/schema.sql`**
    - Lines 1-50: timelines table (with CHECK constraints)
    - Lines 60-100: layers table
    - Lines 110-160: blocks table (duration constraints per layer)
    - Lines 170-220: research_tasks table
    - Lines 230-270: messages table

13. **`backend/src/database/migrations/`**
    - `001_initial_schema.sql`: Base tables
    - `002_add_research_tasks.sql`: Research task tracking

#### Routes
14. **`backend/src/routes/configure-with-context.ts`**
    - Lines 1-60: POST /init (pre-validation agent)
    - Lines 80-150: POST /clarify (conversational agent)
    - Lines 170-240: POST /review (internal review agent)
    - Lines 260-340: POST /generate (configuration agent)
    - Lines 360-420: GET /history (timeline list)

15. **`backend/src/routes/blocks.ts`**
    - Lines 1-50: GET /:id (fetch block)
    - Lines 70-130: PUT /:id (update block)
    - Lines 150-220: POST /:id/research (trigger research)
    - Lines 240-300: GET /:id/research/status (check status)

16. **`backend/src/routes/chat.ts`**
    - Lines 1-60: POST /:timelineId (send message)
    - Lines 80-150: GET /:timelineId/history (fetch messages)
    - Lines 170-240: Conversational Agent invocation
    - Lines 260-320: Timeline update logic

17. **`backend/src/routes/test-research.ts`**
    - Lines 1-60: POST /research (trigger test research)
    - Lines 80-140: GET /research/:taskId (check status)
    - Lines 160-300: GET /websocket (HTML test page)

#### Utils
18. **`backend/src/utils/logger.ts`**
    - Lines 1-40: Winston logger setup
    - Lines 60-100: Log levels (info, warn, error)
    - Lines 120-160: File rotation (daily, 14d retention)

19. **`backend/src/utils/UserError.ts`**
    - Lines 1-50: UserError class definition
    - Lines 70-120: Express error middleware
    - Lines 140-180: toJSON() serialization

20. **`backend/src/utils/validation.ts`**
    - Lines 1-60: Zod schemas (UserConfig, TimelineBlock, etc.)
    - Lines 80-140: Runtime validation functions
    - Lines 160-210: Custom refinements (age ranges, etc.)

### Key Backend Patterns

**Pattern 1: Agent Orchestration**
```typescript
// chain-coordinator.ts - Lines 70-130
async executeChain(context: AgentContext) {
  for (const agent of this.agents) {
    const result = await agent.execute(context);

    // Critical: Check confidence threshold
    if (result.confidence < agent.threshold) {
      throw new UserError('Agent confidence too low');
    }

    // Accumulate context for next agent
    context = this.mergeAgentResults(context, agent.name, result);
  }
  return context;
}
```

**Pattern 2: Async Research Spawn**
```typescript
// parallel-mcp.ts - Lines 70-130
async createResearchTask(params: ResearchParams) {
  const taskId = uuidv4();

  // Store in task queue
  this.tasks.set(taskId, { ...params, status: 'pending' });

  // Spawn async (don't await) - returns immediately
  this.executeResearch(taskId, params).catch(err =>
    this.handleError(taskId, err)
  );

  return { taskId, estimatedTime: this.calculateEstimatedTime(params.processor) };
}
```

**Pattern 3: Database Atomicity**
```typescript
// db.ts - Lines 120-170
db.serialize(() => {
  db.run('BEGIN TRANSACTION');

  try {
    // Multiple inserts (timeline, layers, blocks)
    insertTimeline();
    insertLayers();
    insertBlocks();

    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
});
```

---

## 4. AI/ML Engineers {#ai-ml-engineers}

**Goal**: Understand agent architecture, prompt engineering, and LLM orchestration.

### Agent Architecture Deep Dive

#### LangChain Integration Points

1. **Model Configuration** (`backend/src/agents/*.ts`)
   ```typescript
   // Every agent file - Lines 1-40
   const model = new ChatAnthropic({
     model: 'claude-sonnet-4-5-20250929',
     anthropicApiKey: process.env.ANTHROPIC_API_KEY,
     temperature: 0.1,  // Low for consistency
     maxTokens: 4096
   });
   ```

2. **Prompt Templates** (`backend/src/agents/pre-validation.ts` - Lines 60-120)
   ```typescript
   const systemPrompt = `You are a career planning validation agent.
   Analyze user input for completeness and clarity.
   Calculate confidence score (0-1 scale).
   Identify missing information needed for timeline generation.`;

   const userPrompt = `User Input:
   - Name: ${userConfig.user_name}
   - Ages: ${userConfig.start_age} to ${userConfig.end_age}
   - Goal: ${userConfig.end_goal}

   Calculate confidence and list missing fields.`;
   ```

3. **Structured Output Parsing** (Zod schemas for LLM responses)
   ```typescript
   // validation.ts - Lines 1-60
   const AgentResponseSchema = z.object({
     confident: z.boolean(),
     confidence_score: z.number().min(0).max(1),
     missing_fields: z.array(z.string()),
     reasoning: z.string()
   });

   // Parse LLM JSON response
   const parsed = AgentResponseSchema.parse(JSON.parse(llmResponse));
   ```

#### Agent Confidence Thresholds

| Agent | Threshold | Rationale |
|-------|-----------|-----------|
| Pre-Validation | 95% | Deterministic validation - high bar |
| Conversational | 95% | Must gather complete info before generation |
| Internal Review | 95% | Final gate before expensive operation |
| Configuration | 90% | Creative task - empirically tested optimal |

#### Prompt Engineering Best Practices (Used in This Codebase)

1. **System Prompts**: Clear role definition + constraints
2. **Few-Shot Examples**: Included in conversational agent
3. **Output Format**: JSON schema specified in prompt
4. **Chain-of-Thought**: Reasoning field required in responses
5. **Temperature Control**: 0.1 for consistency, 0.3 for creativity

#### LangSmith Tracing

**View traces at**: https://smith.langchain.com/projects/career-trajectory

**What's traced**:
- Every agent invocation (system + user prompts)
- Token usage (input + output counts)
- Latency (ms per agent)
- Confidence scores (in metadata)
- Timeline IDs (for correlation)

**How to trace custom code**:
```typescript
import { ChatAnthropic } from '@langchain/anthropic';

const response = await model.invoke(
  [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)],
  {
    tags: ['custom-agent', timelineId],
    metadata: {
      agentName: 'CustomAgent',
      confidence: 0.87,
      timestamp: new Date().toISOString()
    }
  }
);
```

---

## 5. DevOps/Infrastructure {#devops-infrastructure}

**Goal**: Understand deployment, monitoring, and scaling considerations.

### Current Infrastructure (Development)

- **Backend**: `tsx watch` (hot reload) on port 3001
- **Frontend**: Vite dev server on port 3000
- **Database**: SQLite at `data/timelines.db`
- **WebSocket**: Integrated with Express on same port as HTTP

### Production Deployment Checklist

1. **Environment Variables** (`.env.example`)
   ```bash
   ANTHROPIC_API_KEY=sk-...
   PARALLEL_API_KEY=...
   LANGCHAIN_TRACING_V2=true
   LANGCHAIN_API_KEY=lsv2_pt_...
   LANGCHAIN_PROJECT=career-trajectory
   NODE_ENV=production
   ```

2. **Database Migration** (SQLite → PostgreSQL)
   - File: `backend/src/database/db.ts` - Lines 1-40
   - Change: Replace `better-sqlite3` with `pg`
   - Schema: Compatible (same SQL, just change `TEXT` → `VARCHAR` types)

3. **Task Queue Migration** (In-Memory → Redis/BullMQ)
   - File: `backend/src/services/parallel-mcp.ts` - Lines 1-50
   - Change: Replace `Map<string, Task>` with BullMQ queue
   - Benefit: Persistent tasks, horizontal scaling

4. **WebSocket Scaling** (Sticky Sessions)
   - File: `backend/src/websocket/research-websocket.ts` - Lines 1-50
   - Change: Add Redis adapter for multi-instance WebSocket
   - Library: `socket.io` (if migrating from ws)

5. **Logging** (File → Cloud)
   - File: `backend/src/utils/logger.ts` - Lines 1-40
   - Change: Add Winston transport (CloudWatch, Datadog, etc.)

6. **Health Checks**
   - Endpoint: `GET /api/health`
   - Checks: Database connection, API keys valid, WebSocket server running

### Monitoring & Observability

**LangSmith** (AI Operations):
- URL: https://smith.langchain.com
- Metrics: Token usage, latency, errors
- Alerts: Configure via LangSmith UI

**Application Logs**:
- Location: `logs/app.log` (dev) or CloudWatch (prod)
- Format: Structured JSON (Winston)
- Rotation: Daily, 14-day retention

**Cost Tracking**:
- File: `backend/src/services/parallel-research.ts` - Lines 210-250
- Metrics: Anthropic API costs, Parallel AI costs
- Alerts: Budget exceeded warnings

---

## 6. Key Code Patterns to Look For {#key-patterns}

### Pattern 1: Confidence-Driven Flow Control
**Where**: All agent files (`backend/src/agents/*.ts`)
```typescript
if (confidence >= 0.95) {
  proceedToNextAgent();
} else {
  triggerClarification();
}
```

### Pattern 2: Async Task Spawning
**Where**: `backend/src/services/parallel-mcp.ts` - Lines 70-130
```typescript
// Don't await - return immediately
this.executeResearch(taskId, params).catch(handleError);
return { taskId };
```

### Pattern 3: WebSocket Broadcast
**Where**: `backend/src/websocket/research-websocket.ts` - Lines 140-190
```typescript
this.clients.forEach(client => {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(message));
  }
});
```

### Pattern 4: React Query Cache Invalidation
**Where**: `frontend/src/views/TimelineView.tsx` - Lines 200-220
```typescript
onSuccess: () => {
  queryClient.invalidateQueries(['timeline', id]);
}
```

### Pattern 5: Optimistic Updates
**Where**: `frontend/src/components/BlockEditor.tsx` - Lines 250-270
```typescript
// Update UI first, rollback on error
setBlocks(updated);
try {
  await apiClient.update(block);
} catch {
  setBlocks(original);
}
```

---

## 7. Testing Entry Points {#testing-entry-points}

### Manual Testing

1. **WebSocket Test Page**
   - URL: http://localhost:3001/api/test/websocket
   - Actions: Connect WebSocket → Trigger Research → Watch broadcasts
   - Validates: WebSocket connection, research flow, error handling

2. **Timeline Creation Flow**
   - URL: http://localhost:3000/
   - Flow: Fill form → Answer questions → View timeline
   - Validates: Agent orchestration, confidence thresholds, database insertion

3. **Research Trigger**
   - Action: Click block → "Deep Research" button
   - Validates: Async task creation, WebSocket updates, UI indicators

### Automated Testing

1. **E2E Test Suite**
   - File: `backend/test-e2e-comprehensive.ts`
   - Scenarios: 5 realistic user journeys
   - Coverage: Full agent pipeline + research

2. **Database Constraint Tests**
   - File: `backend/src/server.ts` - Lines 95-120
   - Validates: Age ranges, duration constraints, foreign keys
   - Runs: On server startup (auto-test)

---

## 8. Tracing a Feature End-to-End {#tracing-features}

### Example: Block Research Feature

**User Action**: Click "Deep Research" button on a timeline block

**Frontend Flow**:
1. `frontend/src/components/BlockEditor.tsx` - Line 180
   - User clicks "Deep Research" button
   - `handleResearch('deep')` called

2. `frontend/src/components/BlockEditor.tsx` - Lines 200-220
   - Determines processor: `selectedTier` (from ResearchTierContext)
   - Calls API: `apiClient.blocks.research(blockId, selectedTier)`

3. `frontend/src/lib/api-client.ts` - Lines 140-160
   - POST request to `/api/blocks/${blockId}/research`
   - Payload: `{ processor: 'pro' }`

**Backend Flow**:
4. `backend/src/routes/blocks.ts` - Lines 150-180
   - Route handler receives request
   - Validates blockId exists in database
   - Calls `parallelMCPService.createResearchTask()`

5. `backend/src/services/parallel-mcp.ts` - Lines 70-100
   - Generates taskId (uuidv4)
   - Stores task in Map (status: 'pending')
   - **Critical**: Spawns async execution (doesn't await)
   - Returns `{ taskId, estimatedTime }` immediately

6. `backend/src/services/parallel-mcp.ts` - Lines 150-200 (async)
   - Background: `executeResearch()` runs
   - WebSocket broadcast: `research_started`
   - Calls Parallel AI API
   - WebSocket broadcast: `research_complete`

**WebSocket Flow**:
7. `backend/src/websocket/research-websocket.ts` - Lines 140-190
   - `notifyResearchStarted()` broadcasts to all clients
   - Payload: `{ type: 'research_started', taskId, blockId }`

8. `frontend/src/hooks/useWebSocket.ts` - Lines 90-120
   - Client receives WebSocket message
   - Updates state: `setResearchingBlocks(prev => new Set(prev).add(blockId))`

**UI Update**:
9. `frontend/src/components/TimelineBlock.tsx` - Lines 110-140
   - Rerenders due to state change
   - Displays pulsing blue dot (isResearching === true)

10. (5 seconds later) WebSocket broadcast: `research_complete`
    - Frontend removes blue dot
    - Frontend adds green glow animation
    - Toast notification appears

**Total Latency**: <50ms for task creation, 5-60s for research (async)

---

## Conclusion

This guide provides multiple entry points into the codebase based on your role. For deeper technical details, see:
- `01_HIGH_LEVEL.md` - Architectural decisions
- `02_MEDIUM_LEVEL.md` - API contracts, component hierarchy
- `03_LOW_LEVEL.md` - Algorithms, data structures, edge cases

**Pro Tip**: Start with the "First-Time Reviewers" path, then jump to your role-specific section for deeper exploration.
