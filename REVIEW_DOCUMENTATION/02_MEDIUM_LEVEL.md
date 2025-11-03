# Career Trajectory AI - Medium-Level Developer Guide

## Overview

This guide explains the codebase organization, agent flows, API contracts, and component hierarchy. Intended for developers onboarding to the project or contributing features.

---

## Project Structure

```
Career-Trajectory/
├── backend/                    # Express.js API server
│   ├── src/
│   │   ├── agents/            # AI agent implementations
│   │   │   ├── pre-validation.ts          # Input completeness analysis
│   │   │   ├── conversational.ts          # Clarification question generation
│   │   │   ├── internal-review.ts         # Final validation gate
│   │   │   ├── configuration.ts           # Timeline generation
│   │   │   ├── chain-coordinator.ts       # Agent orchestration
│   │   │   └── research-sub-agents.ts     # Specialized research agents
│   │   ├── services/          # Business logic
│   │   │   ├── parallel-mcp.ts            # Async research orchestrator
│   │   │   └── parallel-research.ts       # Parallel AI API client
│   │   ├── websocket/         # Real-time communication
│   │   │   └── research-websocket.ts      # WebSocket server
│   │   ├── database/          # Data persistence
│   │   │   ├── db.ts                      # SQLite client
│   │   │   ├── schema.sql                 # Database schema
│   │   │   └── migrations/                # Schema versioning
│   │   ├── routes/            # API endpoints
│   │   │   ├── configure-with-context.ts  # Main timeline API
│   │   │   ├── blocks.ts                  # Block CRUD operations
│   │   │   ├── chat.ts                    # Conversational editing
│   │   │   └── test-research.ts           # Development testing
│   │   ├── utils/             # Shared utilities
│   │   │   ├── logger.ts                  # Structured logging
│   │   │   ├── UserError.ts               # User-friendly error handling
│   │   │   └── validation.ts              # Zod schemas
│   │   └── server.ts          # Express app initialization
│   ├── data/                   # SQLite database files
│   └── logs/                   # Application logs
│
├── frontend/                   # React + Vite SPA
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── TimelineBlock.tsx          # Individual timeline block
│   │   │   ├── LayerView.tsx              # Timeline layer display
│   │   │   ├── BlockEditor.tsx            # Block editing modal
│   │   │   ├── Navigation.tsx             # Top navigation bar
│   │   │   ├── PricingModal.tsx           # Research tier selection
│   │   │   ├── ResearchNotification.tsx   # Toast notifications
│   │   │   └── ErrorModal.tsx             # Error display
│   │   ├── views/             # Page-level components
│   │   │   ├── ConversationalConfigView.tsx  # Initial setup flow
│   │   │   └── TimelineView.tsx              # Timeline management
│   │   ├── contexts/          # React Context providers
│   │   │   ├── ThemeContext.tsx           # Dark mode state
│   │   │   └── ResearchTierContext.tsx    # Global tier selection
│   │   ├── hooks/             # Custom React hooks
│   │   │   └── useWebSocket.ts            # WebSocket client
│   │   ├── lib/               # Utilities and API client
│   │   │   └── api-client.ts              # Typed API client
│   │   ├── App.tsx            # Root component
│   │   └── main.tsx           # Vite entry point
│   └── public/                 # Static assets
│
├── REVIEW_DOCUMENTATION/       # Project documentation (this folder)
├── .claude/commands/           # Custom Claude Code commands
└── data/                       # SQLite database (gitignored)
```

---

## Agent Flow Architecture

### 1. Pre-Validation Agent
**File**: `backend/src/agents/pre-validation.ts`

**Purpose**: Analyze input completeness, determine if conversation is needed

**Input**:
```typescript
{
  user_name: string;
  start_age: number;
  end_age: number;
  end_goal: string;
  num_layers: number;
}
```

**Output**:
```typescript
{
  confident: boolean;           // True if >= 95% confidence
  confidence_score: number;     // 0-1 scale
  missing_fields: string[];     // Fields needing clarification
  reasoning: string;            // Why this score was assigned
}
```

**Logic**:
- Base confidence: 100%
- Penalty: -5% per missing field
- Penalty: -10% for vague end_goal (< 10 characters)
- Threshold: Must reach 95% to skip conversation

### 2. Conversational Clarification Agent
**File**: `backend/src/agents/conversational.ts`

**Purpose**: Generate targeted questions to fill gaps, iterate until 95% confidence

**Input**:
```typescript
{
  context_id: string;           // Session identifier
  conversation_history: Message[];  // Previous Q&A
  user_message?: string;        // Latest user response
}
```

**Output**:
```typescript
{
  question?: string;            // Next clarifying question
  ready_for_generation: boolean; // True when >= 95% confidence
  confidence_score: number;
  gathered_info: Record<string, any>; // Accumulated context
}
```

**Logic**:
- Analyzes conversation history to identify gaps
- Generates 1 question per round (focused, not overwhelming)
- Updates confidence based on information density
- Max 5 rounds before forcing generation

### 3. Internal Review Agent
**File**: `backend/src/agents/internal-review.ts`

**Purpose**: Final validation gate before expensive timeline generation

**Input**:
```typescript
{
  user_config: UserConfig;      // All gathered information
  conversation_summary: string; // Condensed Q&A
}
```

**Output**:
```typescript
{
  approved: boolean;            // True if >= 95% confidence
  confidence_score: number;
  issues: string[];             // Blocking issues if any
  recommendations: string[];    // Optional improvements
}
```

**Logic**:
- Reviews all gathered context
- Checks for logical inconsistencies
- Validates age ranges, goals, timeframes
- Last chance to trigger clarification

### 4. Configuration Agent
**File**: `backend/src/agents/configuration.ts`

**Purpose**: Generate validated timeline with 3 layers

**Input**:
```typescript
{
  user_config: UserConfig;
  num_layers: 2 | 3;            // User-specified depth
}
```

**Output**:
```typescript
{
  timeline_id: string;
  layers: [
    {
      layer_number: 1,          // Strategic (4-10 year blocks)
      name: "Strategic Vision",
      blocks: TimeBlock[]
    },
    {
      layer_number: 2,          // Tactical (0-5 year blocks)
      name: "Tactical Planning",
      blocks: TimeBlock[]
    },
    {
      layer_number: 3,          // Execution (0-1 year blocks)
      name: "Execution Details",
      blocks: TimeBlock[]
    }
  ]
}
```

**Logic**:
- 90% confidence threshold (creative task, empirically tested)
- Generates parent-child block relationships
- Enforces database constraints (duration limits per layer)
- Returns structured JSON validated by Zod schema

---

## API Contracts

### Timeline Generation Flow

#### 1. Initialize Conversation
```http
POST /api/configure-with-context/init
Content-Type: application/json

{
  "user_name": "Vignan",
  "start_age": 21,
  "end_age": 30,
  "end_goal": "Become a senior AI/ML engineer at a top tech company",
  "num_layers": 3
}

Response 200:
{
  "context_id": "uuid-v4",
  "needs_clarification": false,  // If true, proceed to /clarify
  "confidence_score": 0.97
}
```

#### 2. Clarification Loop (if needed)
```http
POST /api/configure-with-context/clarify
Content-Type: application/json

{
  "context_id": "uuid-v4",
  "user_message": "I have a CS degree and 2 years experience in full-stack development"
}

Response 200:
{
  "question": "What specific areas of AI/ML are you most interested in? (e.g., NLP, computer vision, reinforcement learning)",
  "ready_for_generation": false,
  "confidence_score": 0.85
}
```

#### 3. Generate Timeline
```http
POST /api/configure-with-context/generate
Content-Type: application/json

{
  "context_id": "uuid-v4"
}

Response 200:
{
  "timeline_id": "uuid-v4",
  "user_config": { ... },
  "layers": [ ... ],
  "created_at": "2025-11-02T..."
}
```

### Research Operations

#### 1. Trigger Block Research
```http
POST /api/blocks/:blockId/research
Content-Type: application/json

{
  "processor": "pro"  // lite | base | pro | ultra | ultra2x | ultra4x | ultra8x
}

Response 200:
{
  "taskId": "uuid-v4",
  "estimatedTime": 120,  // seconds
  "websocketUrl": "ws://localhost:3001/ws"
}
```

#### 2. Check Research Status
```http
GET /api/test/research/:taskId

Response 200:
{
  "success": true,
  "task": {
    "id": "uuid-v4",
    "status": "complete",  // pending | running | complete | error
    "results": { ... },
    "createdAt": "2025-11-02T...",
    "completedAt": "2025-11-02T..."
  }
}
```

### WebSocket Events

#### Server → Client Broadcasts

**Connection Established**:
```json
{
  "type": "connected",
  "message": "WebSocket connection established"
}
```

**Research Started**:
```json
{
  "type": "research_started",
  "taskId": "uuid-v4",
  "blockId": "uuid-v4",
  "blockTitle": "Graduate Education",
  "processor": "pro",
  "estimatedTime": 120
}
```

**Research Progress** (optional):
```json
{
  "type": "research_progress",
  "taskId": "uuid-v4",
  "progress": 0.5,
  "message": "Analyzing university programs..."
}
```

**Research Complete**:
```json
{
  "type": "research_complete",
  "taskId": "uuid-v4",
  "blockId": "uuid-v4",
  "results": {
    "summary": "...",
    "universities": [ ... ],
    "programs": [ ... ]
  }
}
```

**Research Error**:
```json
{
  "type": "research_error",
  "taskId": "uuid-v4",
  "error": "API rate limit exceeded"
}
```

---

## Component Hierarchy (Frontend)

### App Structure
```
<App>
  <ThemeProvider>
    <ResearchTierProvider>
      <QueryClientProvider>
        <Router>
          <Navigation />           {/* Always visible */}

          <Routes>
            <Route path="/">
              <ConversationalConfigView />
            </Route>

            <Route path="/timeline/:id">
              <TimelineView>
                {layers.map(layer => (
                  <LayerView>
                    {blocks.map(block => (
                      <TimelineBlock />
                    ))}
                  </LayerView>
                ))}

                <BlockEditor />    {/* Modal, conditionally rendered */}
              </TimelineView>
            </Route>
          </Routes>

          <ResearchNotificationContainer />  {/* Toast notifications */}
          <ErrorModal />                     {/* Error display */}
        </Router>
      </QueryClientProvider>
    </ResearchTierProvider>
  </ThemeProvider>
</App>
```

### State Management

**Global State** (React Context):
- `ThemeContext`: Dark mode toggle
- `ResearchTierContext`: Selected research tier (lite → ultra8x)

**Server State** (React Query):
- Timeline data (cached, auto-refetches)
- Research task status (polling disabled, WebSocket preferred)

**Local State** (useState):
- UI interactions (modals, dropdowns, form inputs)
- WebSocket connection status
- Researching/completed block IDs

---

## Database Schema

### Tables

**timelines**
```sql
CREATE TABLE timelines (
  id TEXT PRIMARY KEY,
  user_name TEXT NOT NULL,
  start_age INTEGER NOT NULL,
  end_age INTEGER NOT NULL CHECK (end_age >= start_age AND end_age <= 60),
  end_goal TEXT NOT NULL,
  num_layers INTEGER NOT NULL CHECK (num_layers IN (2, 3)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT  -- Soft delete
);
```

**layers**
```sql
CREATE TABLE layers (
  id TEXT PRIMARY KEY,
  timeline_id TEXT NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
  layer_number INTEGER NOT NULL CHECK (layer_number IN (1, 2, 3)),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**blocks**
```sql
CREATE TABLE blocks (
  id TEXT PRIMARY KEY,
  layer_id TEXT NOT NULL REFERENCES layers(id) ON DELETE CASCADE,
  layer_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_age INTEGER NOT NULL,
  end_age INTEGER NOT NULL,
  duration_years REAL NOT NULL,
  parent_block_id TEXT REFERENCES blocks(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Critical constraint: enforces realistic block durations per layer
  CHECK (
    (layer_number = 1 AND duration_years >= 4.0 AND duration_years <= 10.0) OR
    (layer_number = 2 AND duration_years >= 0.0 AND duration_years <= 5.0) OR
    (layer_number = 3 AND duration_years >= 0.0 AND duration_years <= 1.0)
  )
);
```

**research_tasks**
```sql
CREATE TABLE research_tasks (
  id TEXT PRIMARY KEY,
  block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  block_title TEXT NOT NULL,
  query TEXT NOT NULL,
  processor TEXT NOT NULL CHECK (processor IN ('lite', 'base', 'pro', 'ultra', ...)),
  research_type TEXT NOT NULL CHECK (research_type IN ('university', 'career', 'skills', ...)),
  estimated_time INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'complete', 'error')),
  results TEXT,  -- JSON stored as TEXT
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);
```

**messages**
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timeline_id TEXT NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## Key Development Patterns

### 1. Error Handling
All errors use `UserError` class for user-friendly messages:

```typescript
import { UserError } from '../utils/UserError';

if (age < 18 || age > 60) {
  throw new UserError(
    'Age must be between 18 and 60',
    'error',
    ['Please check your start and end ages', 'Contact support if this is a valid career timeline'],
    'age'
  );
}
```

Frontend catches and displays via `ErrorModal`.

### 2. API Client Pattern
All API calls go through typed client:

```typescript
import { apiClient } from '../lib/api-client';

const timeline = await apiClient.timelines.get(timelineId);
const research = await apiClient.blocks.research(blockId, 'pro');
```

Type safety prevents runtime errors.

### 3. WebSocket Integration
Custom hook manages connection lifecycle:

```typescript
const { isConnected, researchingBlocks, completedBlocks } = useWebSocket();

// UI automatically updates when blocks change state
<TimelineBlock
  isResearching={researchingBlocks.has(block.id)}
  isComplete={completedBlocks.has(block.id)}
/>
```

### 4. Research Tier Selection
Global context persists user's tier choice:

```typescript
const { selectedTier, setSelectedTier } = useResearchTier();

// Quick research always uses LITE
const quickProcessor = 'lite';

// Deep research uses user's selection
const deepProcessor = selectedTier;
```

---

## Testing Strategy

### Backend Tests
- **Unit**: Individual agent logic (confidence calculations, question generation)
- **Integration**: Full API flows (init → clarify → generate)
- **E2E**: LangSmith-traced scenarios (5 realistic user journeys)

### Frontend Tests
- **Component**: Isolated UI rendering (React Testing Library)
- **Integration**: Full user flows (timeline creation, block editing)
- **E2E**: Cypress (manual WebSocket validation)

### Manual Validation
Test page at `http://localhost:3001/api/test/websocket`:
1. Connect WebSocket
2. Trigger test research
3. Verify broadcasts received
4. Check task status via API

---

## Development Workflow

### Starting Dev Servers
```bash
# Terminal 1: Backend
cd backend
npm run dev  # Runs on :3001

# Terminal 2: Frontend
cd frontend
npm run dev  # Runs on :3000
```

### Making Changes

**Backend Changes**:
1. Edit TypeScript files in `backend/src/`
2. tsx watch auto-reloads on save
3. Check logs in terminal or `logs/app.log`

**Frontend Changes**:
1. Edit TypeScript/React files in `frontend/src/`
2. Vite HMR updates browser instantly (no reload)
3. Check console for errors

**Database Changes**:
1. Create migration in `backend/src/database/migrations/`
2. Run migration manually or restart server
3. Verify schema with SQLite CLI

### Debugging

**Backend**:
- LangSmith traces: https://smith.langchain.com/projects/career-trajectory
- Logs: `logs/app.log` (structured JSON)
- API testing: Postman or `curl`

**Frontend**:
- React DevTools (component tree, state)
- Browser console (network, errors)
- Redux DevTools (if added in future)

---

## Common Development Tasks

### Add New Research Agent
1. Create agent in `backend/src/agents/research-sub-agents.ts`
2. Add to `ParallelMCPService.executeResearch()` router
3. Update `ResearchType` enum in types
4. Add API endpoint in `backend/src/routes/blocks.ts`

### Add New UI Component
1. Create component in `frontend/src/components/`
2. Export from `components/index.ts` (if creating index)
3. Import in parent view/component
4. Add TypeScript types for props

### Modify Agent Confidence Logic
1. Edit agent file in `backend/src/agents/`
2. Update confidence calculation function
3. Test with LangSmith tracing enabled
4. Verify E2E tests still pass

### Add Database Table
1. Create migration in `backend/src/database/migrations/`
2. Update schema.sql for reference
3. Add TypeScript types in `backend/src/types/`
4. Create repository functions in `backend/src/database/`

---

## Performance Optimization Tips

### Backend
- Use database indexes for frequently queried fields
- Cache expensive AI operations (deduplication)
- Batch WebSocket broadcasts (don't spam)
- Implement rate limiting per user

### Frontend
- Lazy load routes with React.lazy()
- Debounce user input (search, autocomplete)
- Use React.memo() for expensive renders
- Optimize bundle size (check with `vite build --report`)

---

## Next Steps

For low-level implementation details, see **03_LOW_LEVEL.md**.

For codebase navigation guide, see **EXPLORATION_GUIDE.md**.
