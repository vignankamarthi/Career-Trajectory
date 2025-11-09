# Medium-Level Component Documentation

**Career Trajectory AI - Component Reference**
**Date**: 2025-11-09
**Status**: Production Ready
**Version**: 2.1

---

## Table of Contents

1. [Backend Components](#backend-components)
   - [Agents](#agents)
   - [API Routes](#api-routes)
   - [Services](#services)
   - [Database Layer](#database-layer)
   - [WebSocket System](#websocket-system)
2. [Frontend Components](#frontend-components)
   - [Views](#views)
   - [UI Components](#ui-components)
   - [Hooks & Contexts](#hooks--contexts)
3. [Data Models](#data-models)

---

## Backend Components

### Agents

#### 1. Pre-Validation Agent
**File**: `backend/src/agents/pre-validation-agent.ts`
**Purpose**: Analyzes input completeness before starting expensive operations

**Input**:
```typescript
interface PreValidationInput {
  user_config: UserConfig;  // name, age range, goal, layers
  uploaded_files?: UploadedFile[];
}
```

**Output**:
```typescript
interface ValidationResult {
  is_confident: boolean;     // >= 95% confidence?
  confidence_score: number;  // 0-100
  questions?: string[];      // If not confident
  attention: ValidationAttention;
}
```

**Logic Flow**:
1. Analyzes user_config fields for completeness
2. Identifies missing information categories
3. Determines critical constraints (age bounds, goal clarity)
4. Generates focused questions if confidence < 95%
5. Writes insights to attention.validation_agent

**Confidence Calculation**:
- Base: 60 points
- +10 for clear goal statement
- +10 for realistic age range
- +10 for specific constraints mentioned
- +10 for uploaded files (resume/transcript)
- -10 for vague goal
- -10 for unrealistic timeline

---

#### 2. Conversational Clarification Agent
**File**: `backend/src/agents/conversational-clarification-agent.ts`
**Purpose**: Gathers missing information through natural conversation

**Input**:
```typescript
interface ClarificationInput {
  context: AgentContext;
  user_message: string;
}
```

**Output**:
```typescript
interface ConversationalResult {
  is_confident: boolean;
  confidence_score: number;
  next_question?: string;
  response: string;
  attention: ConversationalAttention;
}
```

**Logic Flow**:
1. Reviews validation_agent attention (what's missing)
2. Analyzes user's response for new information
3. Extracts key requirements and preferences
4. Determines if more clarification needed
5. Generates next question or declares ready
6. Writes clarified intent to attention.conversational_agent

**Question Strategy**:
- Focused questions (not multi-part)
- Builds on previous answers
- Targets specific gaps from validation
- Maximum 5 clarification rounds

---

#### 3. Internal Review Agent
**File**: `backend/src/agents/internal-agent.ts`
**Purpose**: Final quality gate before expensive timeline generation

**Input**:
```typescript
interface InternalReviewInput {
  context: AgentContext;
}
```

**Output**:
```typescript
interface InternalResult {
  is_confident: boolean;
  confidence_score: number;
  should_research: boolean;
  research_queries?: string[];
  attention: InternalAttention;
}
```

**Logic Flow**:
1. Reviews all previous agent attention fields
2. Validates completeness of gathered information
3. Checks for logical inconsistencies
4. Determines if ready for configuration agent
5. Identifies research priorities if needed

**Validation Checks**:
- ✓ Confidence >= 95% from previous agents
- ✓ Age range is valid (10-60, end > start)
- ✓ Goal is specific and achievable
- ✓ Timeframe is realistic (4+ years total)

---

#### 4. Configuration Agent
**File**: `backend/src/agents/configuration-agent.ts`
**Purpose**: Generates multi-layer timeline structure

**Input**:
```typescript
interface ConfigurationInput {
  context: AgentContext;
}
```

**Output**:
```typescript
interface ConfigurationResult {
  is_confident: boolean;
  confidence_score: number;
  timeline?: {
    layers: Layer[];
  };
  issues?: string[];
  attention: ConfigurationAttention;
}
```

**Timeline Structure**:
```typescript
interface Timeline {
  layers: [
    {
      layer_number: 1,  // Strategic (4-20 year blocks)
      blocks: Block[]
    },
    {
      layer_number: 2,  // Tactical (0-5 year blocks)
      blocks: Block[]
    },
    {
      layer_number: 3,  // Execution (0-1 year blocks)
      blocks: Block[]
    }
  ]
}
```

**Logic Flow**:
1. Reviews all attention fields for context
2. Plans 3-layer structure:
   - Layer 1: 3-6 strategic phases
   - Layer 2: 8-15 tactical milestones
   - Layer 3: 15-30 execution steps
3. Generates block titles and descriptions
4. Assigns age ranges respecting constraints
5. Validates against database hard bounds
6. Returns structured timeline JSON

**Hard Bounds Enforcement**:
- Layer 1: `duration_years >= 4.0 AND <= 20.0`
- Layer 2: `duration_years >= 0.0 AND <= 5.0`
- Layer 3: `duration_years >= 0.0 AND <= 1.0`
- All: `start_age >= 10 AND <= 60`
- All: `end_age >= start_age AND <= 60`

---

#### 5. Research Sub-Agents
**File**: `backend/src/agents/research-sub-agents.ts`
**Purpose**: Specialized research agents calling Parallel AI

**Agents**:

##### UniversityResearchAgent
- **Processor**: PRO ($0.10, 3-9min)
- **Query**: University programs, admissions, funding
- **Output Schema**: Programs, requirements, deadlines, recommendations

##### CareerPathResearchAgent
- **Processor**: BASE ($0.02, 30s-2m)
- **Query**: Job market, salaries, career progression
- **Output Schema**: Market trends, salary data, skill requirements

##### SkillsGapAnalysisAgent
- **Processor**: LITE ($0.005, 5-60s)
- **Query**: Missing skills, learning resources
- **Output Schema**: Skill gaps, timelines, resources

##### TimelineOptimizationAgent
- **Processor**: PRO ($0.10, 3-9min)
- **Query**: Timeline compression, risks, parallel paths
- **Output Schema**: Optimization recommendations, success metrics

##### QuickResearchAgent
- **Processor**: LITE ($0.005, 5-60s)
- **Query**: Fast fact-checking
- **Output Schema**: Concise research answer
- **Special**: Auto-approved (no user confirmation)

**Parallel AI Integration**:
```typescript
const response = await axios.post(
  'https://api.parallel.ai/v1/tasks/runs',
  {
    input: query,
    processor: ResearchProcessor.PRO,
    task_spec: {
      output_schema: 'Structured research results...'
    }
  },
  {
    headers: {
      'x-api-key': process.env.PARALLEL_API_KEY,
      'Content-Type': 'application/json'
    }
  }
);
```

---

### API Routes

#### 1. Configure with Context (4-Agent Workflow)
**File**: `backend/src/routes/configure-with-context.ts`
**Base Path**: `/api/configure-with-context`

**Endpoints**:

##### POST /init
**Purpose**: Initialize conversation with pre-validation
**Input**:
```json
{
  "user_name": "John Doe",
  "start_age": 14,
  "end_age": 18,
  "end_goal": "Get accepted to MIT for Bioengineering",
  "num_layers": 3
}
```
**Output**:
```json
{
  "context_id": "uuid",
  "confidence_score": 75,
  "questions": ["Which area of bioengineering interests you most?"],
  "is_ready": false
}
```

##### POST /clarify
**Purpose**: Continue clarification conversation
**Input**:
```json
{
  "context_id": "uuid",
  "user_message": "I'm interested in computational biology and CRISPR"
}
```
**Output** (if confident):
```json
{
  "confidence_score": 95,
  "is_ready": true,
  "response": "Perfect! I have enough information to create your timeline."
}
```

##### POST /generate
**Purpose**: Generate timeline after 95% confidence reached
**Input**:
```json
{
  "context_id": "uuid"
}
```
**Output**:
```json
{
  "timeline_id": "uuid",
  "timeline": {
    "user_name": "John Doe",
    "start_age": 14,
    "end_age": 18,
    "end_goal": "...",
    "layers": [...]
  }
}
```

**Research Integration**:
After timeline generation, this route spawns async research for qualifying blocks:
```typescript
// Line 637-672
for (const block of layer.blocks) {
  // Insert block into database
  execute('INSERT INTO blocks...');

  // Selective research spawning
  if (shouldResearchBlock(block.title, layer.layer_number)) {
    await parallelMCPService.createResearchTask({
      blockId: block_id,
      blockTitle: block.title,
      query: buildResearchQuery(block, context),
      processor: getResearchProcessor(context),
      researchType: determineResearchType(block.title)
    });
  }
}
```

---

#### 2. Chat Route
**File**: `backend/src/routes/chat.ts`
**Base Path**: `/api/chat`

##### POST /
**Purpose**: Conversational timeline editing
**Input**:
```json
{
  "timeline_id": "uuid",
  "message": "Can you add more detail about technical skills in year 2?",
  "stream": false
}
```
**Output**:
```json
{
  "response": "I've added detailed technical skills to Layer 2, Block 4...",
  "cost": 0.08
}
```

**Streaming Support**:
```typescript
if (stream) {
  res.setHeader('Content-Type', 'text/event-stream');
  await chatStream(timeline_id, message, (chunk) => {
    res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
  });
}
```

---

#### 3. Timelines Route
**File**: `backend/src/routes/timelines.ts`
**Base Path**: `/api/timelines`

**Endpoints**:
- `GET /` - List all timelines
- `GET /:id` - Get specific timeline with layers and blocks
- `POST /` - Create new timeline (manual, bypasses 4-agent flow)
- `PUT /:id` - Update timeline metadata
- `DELETE /:id` - Soft delete timeline (sets is_deleted=1)
- `GET /:id/export` - Export timeline as plain text for LLMs

**Export Format**:
```text
Career Timeline for [User Name]
Goal: [End Goal]
Age: [Start Age] to [End Age]

=== LAYER 1: Strategic Path ===
[Block 1 Title] (Age [start]-[end])
  Description: [...]
  Research: [...]
  Notes: [...]

=== LAYER 2: Tactical Milestones ===
...

=== LAYER 3: Execution Steps ===
...
```

---

#### 4. Blocks Route
**File**: `backend/src/routes/blocks.ts`
**Base Path**: `/api/blocks`

**Endpoints**:
- `GET /:id` - Get block details with research data
- `PUT /:id` - Update block (title, description, notes, status)

**Update Validation**:
- Title: Required, non-empty
- Description: Optional
- User Notes: Optional
- Status: Enum (not_started | in_progress | completed)
- Age bounds: Not editable (enforced by database constraints)

---

#### 5. Save Route
**File**: `backend/src/routes/save.ts`
**Base Path**: `/api/save`

**Endpoints**:

##### POST /:timelineId/save-only
**Purpose**: Save without AI validation (instant)
**Cost**: $0
**Duration**: <100ms

##### POST /:timelineId/lite-check
**Purpose**: Quick AI validation
**Cost**: ~$0.005
**Duration**: ~30s

##### POST /:timelineId/refactor
**Purpose**: Deep analysis with research
**Cost**: ~$0.15
**Duration**: 2-3min

**Save History**:
All saves create snapshot in `save_history` table:
```sql
INSERT INTO save_history (id, timeline_id, state_snapshot, save_type, research_cost, timestamp)
VALUES (?, ?, ?, ?, ?, datetime('now'));
```

---

### Services

#### 1. Parallel MCP Service
**File**: `backend/src/services/parallel-mcp.ts`
**Purpose**: Async research task orchestration

**Key Methods**:

##### createResearchTask()
```typescript
async createResearchTask(params: {
  blockId: string;
  blockTitle: string;
  query: string;
  processor: ResearchProcessor;
  researchType: 'university' | 'career' | 'skills' | 'timeline' | 'quick';
}): Promise<{ taskId: string; estimatedTime: number }>
```
**Returns immediately** with task_id, executes research in background.

##### executeResearch() (Private)
```typescript
private async executeResearch(
  taskId: string,
  researchType: string,
  query: string,
  processor: ResearchProcessor
): Promise<void>
```
Routes to appropriate research agent, broadcasts WebSocket updates.

**Task Lifecycle**:
1. `pending` - Task created, queued
2. `running` - Research executing via Parallel AI
3. `complete` - Results available
4. `error` - Failed (network, API, timeout)

**Cleanup Strategy**:
- Runs every 15 minutes via `setInterval`
- Deletes tasks completed > 1 hour ago
- Never deletes `pending` or `running` tasks

---

#### 2. Anthropic Service
**File**: `backend/src/services/anthropic.ts`
**Purpose**: Claude API integration with structured outputs

**Key Features**:
- Tool calling for structured JSON responses
- Token counting and cost tracking
- Error handling with retries
- LangSmith tracing integration

**Tool Schemas**:
```typescript
const validationTool = {
  name: 'provide_validation_result',
  description: 'Report validation analysis',
  input_schema: {
    type: 'object',
    properties: {
      confidence_score: { type: 'number' },
      missing_information_categories: { type: 'array' },
      questions_to_ask: { type: 'array' }
    }
  }
};
```

---

#### 3. WebSocket Server
**File**: `backend/src/websocket/research-websocket.ts`
**Purpose**: Real-time research update broadcasts

**Connection**:
- Path: `ws://localhost:3001/ws`
- Protocol: Native WebSocket
- Auto-reconnect: 3-second delay (client-side)

**Message Types**:
```typescript
{
  type: 'connected' | 'research_started' | 'research_progress' | 'research_complete' | 'research_error',
  taskId: string,
  blockId?: string,
  blockTitle?: string,
  processor?: string,
  estimatedTime?: number,
  progress?: number,
  message?: string,
  results?: any,
  error?: string,
  timestamp: string
}
```

**Broadcast Flow**:
```
ParallelMCPService.createResearchTask()
  ↓
wsServer.notifyResearchStarted()
  ↓
clients.forEach(client => client.send(JSON.stringify(update)))
  ↓
Frontend receives via useWebSocket hook
  ↓
UI updates (blue dot, toast notification)
```

---

### Database Layer

#### Database Connection
**File**: `backend/src/database/db.ts`
**Driver**: better-sqlite3 (synchronous, embedded)

**Key Functions**:
```typescript
function execute(sql: string, params?: any[]): void
function query(sql: string, params?: any[]): any[]
function queryOne(sql: string, params?: any[]): any | undefined
function testConstraints(): boolean
```

**Constraint Testing**:
```typescript
// Tests all SQLite CHECK constraints
function testConstraints(): boolean {
  try {
    // Layer 1: duration < 4 years (should FAIL)
    execute('INSERT INTO blocks (...) VALUES (..., 3.5)');
    return false;  // Should have thrown
  } catch (error) {
    // Expected failure
    return true;
  }
}
```

#### Schema Design
**File**: `backend/src/database/schema.sql`

**8 Tables**:
1. `timelines` - User career timelines
2. `layers` - Timeline layers (1-3)
3. `blocks` - Career milestones
4. `conversations` - Chat history
5. `agent_contexts` - Agent shared state
6. `research_tasks` - Async research tracking
7. `save_history` - Version snapshots
8. `metadata` - Uploaded files

**Key Constraints**:
```sql
-- Age validation
CHECK (start_age >= 10 AND start_age <= 60)
CHECK (end_age >= start_age AND end_age <= 60)

-- Layer-specific duration bounds
CHECK (
  (layer_number = 1 AND duration_years >= 4.0 AND <= 20.0) OR
  (layer_number = 2 AND duration_years >= 0.0 AND <= 5.0) OR
  (layer_number = 3 AND duration_years >= 0.0 AND <= 1.0)
)

-- Duration matches age range
CHECK (ABS((end_age - start_age) - duration_years) < 0.01)
```

---

## Frontend Components

### Views

#### 1. Conversational Config View
**File**: `frontend/src/views/ConversationalConfigView.tsx`
**Purpose**: Initial timeline configuration via conversation

**State Management**:
```typescript
const [contextId, setContextId] = useState<string | null>(null);
const [messages, setMessages] = useState<Message[]>([]);
const [confidence, setConfidence] = useState<number>(0);
const [isReadyToGenerate, setIsReadyToGenerate] = useState(false);
```

**Flow**:
1. User fills form → POST /api/configure-with-context/init
2. If confidence < 95% → Show chat interface
3. User answers questions → POST /api/configure-with-context/clarify
4. Repeat until confidence >= 95%
5. Click "Generate Timeline" → POST /api/configure-with-context/generate
6. Navigate to TimelineView with timeline_id

**State Persistence**:
```typescript
// Save to localStorage on every state change
useEffect(() => {
  localStorage.setItem('career-trajectory-conversation', JSON.stringify({
    contextId,
    messages,
    confidence,
    isReadyToGenerate,
    initialFormData
  }));
}, [contextId, messages, confidence, isReadyToGenerate]);

// Clear on successful generation
const handleGenerate = async () => {
  const { timeline_id } = await generate();
  localStorage.removeItem('career-trajectory-conversation');  // Clear
  onTimelineCreated(timeline_id);
};
```

**File Upload**:
```typescript
// PDF/TXT upload with automatic text extraction
<input
  type="file"
  accept=".pdf,.txt"
  multiple
  onChange={handleFileUpload}
/>

const handleFileUpload = async (e) => {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));

  await fetch('/api/configure-with-context/upload', {
    method: 'POST',
    body: formData
  });
};
```

---

#### 2. Timeline View
**File**: `frontend/src/views/TimelineView.tsx`
**Purpose**: Visual timeline editor with chat interface

**Layout**:
```
┌────────────────────────────────────────────────┐
│ Header: [Goal] | Age [start]-[end]             │
├────────────────────────────────────────────────┤
│                                                 │
│  Layer 1: Strategic Path (3-6 blocks)          │
│  ┌─────┐  ┌─────┐  ┌─────┐                     │
│  │ [●] │  │ [●] │  │     │  ← Blue dot =       │
│  └─────┘  └─────┘  └─────┘    researching      │
│                                                 │
│  Layer 2: Tactical Milestones (8-15 blocks)    │
│  ┌─────┐  ┌─────┐  ┌─────┐  ...                │
│  │ [✓] │  │     │  │     │  ← Green = complete │
│  └─────┘  └─────┘  └─────┘                     │
│                                                 │
│  Layer 3: Execution Steps (15-30 blocks)       │
│  ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ...                  │
│  └─┘ └─┘ └─┘ └─┘ └─┘ └─┘                      │
│                                                 │
├────────────────────────────────────────────────┤
│ [Show Chat] [Save▼] [Export]                   │
└────────────────────────────────────────────────┘
```

**Research Integration**:
```typescript
const { researchingBlocks, completedBlocks } = useWebSocket();

// Pass to LayerView → TimelineBlock
<LayerView
  layer={layer}
  researchingBlocks={researchingBlocks}
  completedBlocks={completedBlocks}
/>
```

**Chat Sidebar**:
- Toggle with "Show Chat" button
- Full conversation history
- Real-time message streaming
- Context: Full timeline + research data

---

### UI Components

#### 1. Timeline Block
**File**: `frontend/src/components/TimelineBlock.tsx`
**Purpose**: Individual block visualization with research indicators

**Visual States**:
1. **Default**: Gray border, white background
2. **Researching**: Blue pulsing dot (top-right)
3. **Complete**: Green glow animation + green border
4. **Hover**: Elevated shadow, cursor pointer

**Research Indicator**:
```tsx
{researchingBlocks.has(block.id) && (
  <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full animate-pulse-dot ring-2 ring-blue-300" />
)}

{completedBlocks.has(block.id) && (
  <div className="animate-glow-green border-green-500" />
)}
```

**Custom Animations** (tailwind.config.js):
```javascript
animation: {
  'pulse-dot': 'pulse-dot 1.5s ease-in-out infinite',
  'glow-green': 'glow-green 2s ease-in-out'
}
```

**Click Handler**:
```tsx
<div onClick={() => onBlockClick(block)}>
  {/* Block content */}
</div>

// Opens BlockEditor modal
```

---

#### 2. Block Editor
**File**: `frontend/src/components/BlockEditor.tsx`
**Purpose**: Modal for editing block details

**Editable Fields**:
- Title (required)
- Description (optional)
- User Notes (optional)
- Status (not_started | in_progress | completed)

**Read-Only Fields**:
- Age range (enforced by database constraints)
- Duration (calculated from age range)
- Layer number (structural)

**Research Data Display**:
```tsx
{block.research_data && (
  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded">
    <h4>Research Findings</h4>
    <pre>{JSON.stringify(block.research_data, null, 2)}</pre>
  </div>
)}
```

---

#### 3. Research Notification (Toast)
**File**: `frontend/src/components/ResearchNotification.tsx`
**Purpose**: Real-time toast notifications for research events

**Position**: Bottom-right corner, stacked vertically

**Types**:
```tsx
research_started:  Blue icon, "Research started..."
research_complete: Green icon, "Research complete!"
research_error:    Red icon, "Research failed"
```

**Auto-Dismiss**:
```tsx
useEffect(() => {
  const timer = setTimeout(() => {
    onDismiss(index);
  }, 5000);  // 5-second auto-dismiss
  return () => clearTimeout(timer);
}, []);
```

---

### Hooks & Contexts

#### 1. useWebSocket Hook
**File**: `frontend/src/hooks/useWebSocket.ts`
**Purpose**: WebSocket client with auto-reconnect

**State**:
```typescript
const [isConnected, setIsConnected] = useState(false);
const [lastMessage, setLastMessage] = useState<ResearchUpdate | null>(null);
const [researchingBlocks, setResearchingBlocks] = useState<Set<string>>(new Set());
const [completedBlocks, setCompletedBlocks] = useState<Set<string>>(new Set());
```

**Connection Management**:
```typescript
useEffect(() => {
  const ws = new WebSocket('ws://localhost:3001/ws');

  ws.onopen = () => setIsConnected(true);
  ws.onclose = () => {
    setIsConnected(false);
    // Auto-reconnect after 3 seconds
    setTimeout(connect, 3000);
  };
  ws.onmessage = (event) => {
    const update = JSON.parse(event.data);
    handleUpdate(update);
  };

  return () => ws.close();
}, []);
```

**Update Handling**:
```typescript
const handleUpdate = (update: ResearchUpdate) => {
  switch (update.type) {
    case 'research_started':
      setResearchingBlocks(prev => new Set(prev).add(update.blockId!));
      break;
    case 'research_complete':
      setResearchingBlocks(prev => {
        const next = new Set(prev);
        next.delete(update.blockId!);
        return next;
      });
      setCompletedBlocks(prev => new Set(prev).add(update.blockId!));
      break;
  }
  setLastMessage(update);
};
```

---

#### 2. Theme Context
**File**: `frontend/src/contexts/ThemeContext.tsx`
**Purpose**: Dark mode toggle with localStorage persistence

**Implementation**:
```typescript
const [isDark, setIsDark] = useState(() => {
  const saved = localStorage.getItem('theme');
  return saved === 'dark';
});

useEffect(() => {
  document.documentElement.classList.toggle('dark', isDark);
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}, [isDark]);
```

---

#### 3. Research Tier Context
**File**: `frontend/src/contexts/ResearchTierContext.tsx`
**Purpose**: Global research processor tier selection

**Tiers**:
- lite ($0.005, 5-60s)
- base ($0.02, 30s-2m)
- pro ($0.10, 3-9min) - DEFAULT
- ultra, ultra2x, ultra4x, ultra8x

**Usage**:
```typescript
const { tier, setTier } = useResearchTier();

// Set in PricingModal
<select value={tier} onChange={e => setTier(e.target.value)}>
  <option value="lite">Lite ($0.005)</option>
  <option value="pro">Pro ($0.10)</option>
  <option value="ultra8x">Ultra8x ($2.40)</option>
</select>
```

---

## Data Models

### Agent Context
**File**: `backend/src/types/agent-context.ts`

**Complete Structure**:
```typescript
interface AgentContext {
  timeline_id?: string;
  user_config: {
    user_name: string;
    start_age: number;
    end_age: number;
    end_goal: string;
    num_layers: number;
    global_research_model?: ResearchProcessor;
  };
  attention: {
    validation_agent?: ValidationAttention;
    conversational_agent?: ConversationalAttention;
    configuration_agent?: ConfigurationAttention;
    internal_agent?: InternalAttention;
  };
  conversation_history?: ConversationMessage[];
  workflow: {
    current_stage: string;
    attempt_count: number;
    started_at: string;
    last_updated_at: string;
  };
  uploaded_files?: UploadedFile[];
}
```

**Size**: Typically 1-2KB JSON serialized

---

### Research Task
**File**: `backend/src/services/parallel-mcp.ts`

```typescript
interface ResearchTask {
  taskId: string;              // UUID
  blockId: string;             // Links to blocks table
  blockTitle: string;          // For UI display
  query: string;               // Parallel AI input
  processor: ResearchProcessor; // Cost/time tier
  estimatedTime: number;       // Seconds (for progress bars)
  status: 'pending' | 'running' | 'complete' | 'error';
  results?: any;               // Parallel AI JSON response
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}
```

**Storage**: In-memory Map (not persisted to database)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-09
**Status**: Production Ready
**Maintainer**: Engineering Team

