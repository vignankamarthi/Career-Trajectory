# EXPLORATION GUIDE - Career Trajectory AI

**Document Purpose**: Guide new developers through the codebase with recommended reading order and navigation paths.

**Last Updated**: 2025-11-09
**Target Audience**: New developers, code reviewers, contributors

---

## Table of Contents

1. [Quick Orientation](#quick-orientation)
2. [Repository Structure](#repository-structure)
3. [Recommended Reading Order](#recommended-reading-order)
4. [Entry Points by Use Case](#entry-points-by-use-case)
5. [Tracing User Flows](#tracing-user-flows)
6. [Finding Specific Functionality](#finding-specific-functionality)
7. [Development Workflow](#development-workflow)

---

## 1. Quick Orientation

### 30-Second Overview

**What is this?** AI-powered career timeline generator using multi-agent system with Claude Sonnet 4.5 and asynchronous research.

**Tech Stack**:
- Backend: Node.js + TypeScript + Express + SQLite
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS
- AI: Anthropic Claude + Parallel AI research

**Key Files to Start**:
1. `README.md` - Feature overview and quick start
2. `QUICKSTART.md` - Step-by-step user guide
3. `CURRENT_STATE.md` - Current production status
4. `backend/src/server.ts` - Backend entry point (150 lines)
5. `frontend/src/App.tsx` - Frontend entry point (89 lines)

### 5-Minute Orientation

Read these files in order for basic understanding:

1. **README.md** (5 min) - Understand what the system does
2. **REVIEW_DOCUMENTATION/01_HIGH_LEVEL.md** (10 min) - System architecture
3. **backend/src/server.ts** (5 min) - See how backend initializes
4. **frontend/src/App.tsx** (3 min) - See how frontend initializes
5. **backend/src/types/agent-context.ts** (5 min) - Core data structures

**Total: ~30 minutes** to understand the entire system architecture.

---

## 2. Repository Structure

```
Career-Trajectory/
├── backend/                          # Node.js + TypeScript backend
│   ├── src/
│   │   ├── agents/                   # 7 AI agents (configuration, conversational, etc.)
│   │   │   ├── configuration-agent.ts        # Timeline generation (615 lines)
│   │   │   ├── conversational-assistant.ts   # User Q&A (285 lines)
│   │   │   ├── internal-review-agent.ts      # State analysis (158 lines)
│   │   │   ├── pre-validation-agent.ts       # Input validation (143 lines)
│   │   │   ├── validation-agent.ts           # Timeline validation (236 lines)
│   │   │   └── research-agents/              # 5 specialized research agents
│   │   │
│   │   ├── routes/                   # 7 API endpoints
│   │   │   ├── configure-with-context.ts     # Main timeline generation (802 lines)
│   │   │   ├── configure.ts                  # Simple timeline generation (257 lines)
│   │   │   ├── chat.ts                       # Conversational endpoint (177 lines)
│   │   │   ├── save.ts                       # Timeline save/update (277 lines)
│   │   │   ├── research-status.ts            # Research polling (80 lines)
│   │   │   └── ...
│   │   │
│   │   ├── services/                 # External integrations
│   │   │   ├── parallel-mcp.ts               # Parallel AI research service (338 lines)
│   │   │   ├── anthropic.ts                  # Claude API wrapper (242 lines)
│   │   │   └── ...
│   │   │
│   │   ├── websocket/                # Real-time updates
│   │   │   └── research-websocket.ts         # WebSocket server (199 lines)
│   │   │
│   │   ├── database/                 # SQLite database
│   │   │   ├── schema.sql                    # Database schema with constraints
│   │   │   └── db.ts                         # Database connection (76 lines)
│   │   │
│   │   ├── utils/                    # Shared utilities
│   │   │   ├── logger.ts                     # Logging with LangSmith (104 lines)
│   │   │   ├── validation.ts                 # Zod schemas (198 lines)
│   │   │   ├── langsmith-tracer.ts           # LangSmith tracing (78 lines)
│   │   │   └── ...
│   │   │
│   │   ├── types/                    # TypeScript types
│   │   │   ├── agent-context.ts              # Core data structures (149 lines)
│   │   │   └── ...
│   │   │
│   │   ├── mcp/                      # Model Context Protocol
│   │   │   └── langsmith-server.ts           # LangSmith MCP server
│   │   │
│   │   └── server.ts                 # Express server entry point (150 lines)
│   │
│   ├── dist/                         # Compiled TypeScript (production build)
│   └── data/                         # SQLite database file
│
├── frontend/                         # React + TypeScript frontend
│   ├── src/
│   │   ├── views/                    # Main views
│   │   │   ├── ConfigurationView.tsx         # Timeline generation UI (removed)
│   │   │   └── TimelineView.tsx              # Timeline display UI (362 lines)
│   │   │
│   │   ├── components/               # Reusable UI components
│   │   │   ├── LayerView.tsx                 # Layer container (147 lines)
│   │   │   ├── TimelineBlock.tsx             # Individual block (154 lines)
│   │   │   ├── ResearchNotification.tsx      # Research status indicator (77 lines)
│   │   │   ├── PricingModal.tsx              # Research pricing display (169 lines)
│   │   │   ├── ChatInterface.tsx             # Q&A interface (217 lines)
│   │   │   └── ...
│   │   │
│   │   ├── contexts/                 # React contexts
│   │   │   ├── ThemeContext.tsx              # Dark/light mode (59 lines)
│   │   │   └── ResearchTierContext.tsx       # Research processor selection (27 lines)
│   │   │
│   │   ├── hooks/                    # React hooks
│   │   │   └── useWebSocket.ts               # WebSocket connection (118 lines)
│   │   │
│   │   ├── lib/                      # Utilities
│   │   │   └── api.ts                        # API client (132 lines)
│   │   │
│   │   ├── App.tsx                   # Frontend entry point (89 lines)
│   │   └── main.tsx                  # React mount point (26 lines)
│   │
│   └── dist/                         # Production build
│
├── REVIEW_DOCUMENTATION/             # Technical documentation
│   ├── 01_HIGH_LEVEL.md              # System architecture (552 lines)
│   ├── 02_MEDIUM_LEVEL.md            # Component reference (1020 lines)
│   ├── 03_LOW_LEVEL.md               # Implementation details (823 lines)
│   └── 04_EXPLORATION_GUIDE.md       # This file
│
├── README.md                         # Project overview and features
├── QUICKSTART.md                     # User guide
├── CURRENT_STATE.md                  # Production status (untracked)
├── CITATIONS_AND_CREDITS.md          # Research citations
├── CLAUDE.md                         # AI assistant instructions
└── .env.example                      # Environment variables template
```

---

## 3. Recommended Reading Order

### For New Developers (First Day)

**Goal**: Understand what the system does and how to run it.

1. **README.md** (5 min)
   - What: Feature overview, architecture diagram, badges
   - Why: Understand the product

2. **QUICKSTART.md** (5 min)
   - What: Step-by-step user guide
   - Why: Know how users interact with the system

3. **CURRENT_STATE.md** (3 min)
   - What: Current production status
   - Why: Know what's working, what's in progress

4. **REVIEW_DOCUMENTATION/01_HIGH_LEVEL.md** (15 min)
   - What: System architecture, data flow, technology stack
   - Why: Understand how all pieces fit together

5. **backend/src/types/agent-context.ts** (5 min)
   - What: Core TypeScript interfaces (AgentContext, TimelineData, ResearchTask)
   - Why: Know the data structures everything uses

6. **backend/src/server.ts** (5 min)
   - What: Express server initialization, routes, database, WebSocket
   - Why: See how backend starts and wires together

7. **frontend/src/App.tsx** (5 min)
   - What: React app initialization, routing, theme
   - Why: See how frontend starts

**Total: ~45 minutes** to get oriented.

### For Backend Developers

**Goal**: Understand agent system, API routes, and database.

1. **Read "For New Developers" section first** (45 min)

2. **backend/src/routes/configure-with-context.ts** (15 min)
   - What: Main timeline generation endpoint
   - Why: See complete agent orchestration flow

3. **backend/src/agents/configuration-agent.ts** (15 min)
   - What: Timeline generation logic with tool calling
   - Why: Understand how AI generates timelines

4. **backend/src/services/parallel-mcp.ts** (10 min)
   - What: Async research service with fire-and-forget pattern
   - Why: Understand how research works

5. **backend/src/websocket/research-websocket.ts** (5 min)
   - What: WebSocket server for real-time updates
   - Why: Know how clients get research notifications

6. **backend/src/database/schema.sql** (10 min)
   - What: Database schema with constraints
   - Why: Understand data model and validation rules

7. **backend/src/utils/validation.ts** (5 min)
   - What: Zod schemas for API request validation
   - Why: Know what valid requests look like

**Total: ~1.5 hours** to understand backend.

### For Frontend Developers

**Goal**: Understand React components, state management, and API integration.

1. **Read "For New Developers" section first** (45 min)

2. **frontend/src/views/TimelineView.tsx** (10 min)
   - What: Main timeline display UI
   - Why: See complete user flow from input to timeline

3. **frontend/src/components/LayerView.tsx** (5 min)
   - What: Layer container with drag-and-drop editing
   - Why: Understand timeline editing UX

4. **frontend/src/components/TimelineBlock.tsx** (5 min)
   - What: Individual block with inline editing
   - Why: See how blocks work

5. **frontend/src/hooks/useWebSocket.ts** (5 min)
   - What: WebSocket connection with auto-reconnect
   - Why: Understand real-time updates

6. **frontend/src/lib/api.ts** (5 min)
   - What: API client with all endpoints
   - Why: Know how to call backend

7. **frontend/src/components/ChatInterface.tsx** (5 min)
   - What: Conversational Q&A interface
   - Why: Understand chat functionality

**Total: ~1.5 hours** to understand frontend.

### For AI/ML Engineers

**Goal**: Understand agent system, prompt engineering, and AI integration.

1. **Read "For New Developers" section first** (45 min)

2. **backend/src/agents/configuration-agent.ts** (20 min)
   - What: Timeline generation with tool calling
   - Why: See prompt structure and tool use

3. **backend/src/agents/validation-agent.ts** (10 min)
   - What: Timeline validation with confidence scores
   - Why: Understand validation logic

4. **backend/src/agents/conversational-assistant.ts** (10 min)
   - What: Q&A agent with context awareness
   - Why: See conversational pattern

5. **backend/src/agents/research-agents/** (15 min)
   - What: 5 specialized research agents
   - Why: Understand multi-agent research system

6. **backend/src/services/anthropic.ts** (10 min)
   - What: Claude API wrapper with tool calling
   - Why: Know how to invoke Claude

7. **backend/src/utils/langsmith-tracer.ts** (5 min)
   - What: LangSmith tracing wrapper
   - Why: Understand observability

**Total: ~2 hours** to understand AI system.

### For DevOps/Infrastructure

**Goal**: Understand deployment, databases, monitoring, and environment setup.

1. **Read "For New Developers" section first** (45 min)

2. **.env.example** (3 min)
   - What: Required environment variables
   - Why: Know what to configure

3. **backend/src/database/schema.sql** (10 min)
   - What: Database schema with constraints
   - Why: Understand data persistence

4. **backend/src/utils/logger.ts** (5 min)
   - What: Logging with LangSmith integration
   - Why: Know how logging works

5. **backend/package.json** (5 min)
   - What: Scripts (dev, build, start)
   - Why: Know how to build and deploy

6. **frontend/package.json** (5 min)
   - What: Scripts (dev, build, preview)
   - Why: Know how to build frontend

7. **backend/src/server.ts** (5 min)
   - What: Server initialization and shutdown
   - Why: Understand lifecycle

**Total: ~1.5 hours** to understand infrastructure.

---

## 4. Entry Points by Use Case

### "I want to understand how timeline generation works"

**Start here**: `backend/src/routes/configure-with-context.ts:175`

**Path**:
1. User submits form → `POST /api/configure-with-context` (Line 175)
2. Pre-validation agent checks input → `pre-validation-agent.ts:84`
3. Configuration agent generates timeline → `configuration-agent.ts:348`
4. Validation agent checks timeline → `validation-agent.ts:97`
5. Timeline saved to database → `configure-with-context.ts:632`
6. Research tasks spawned → `parallel-mcp.ts:129`
7. Response returned with timeline_id → `configure-with-context.ts:756`

**Key Files**:
- `backend/src/routes/configure-with-context.ts` (802 lines)
- `backend/src/agents/configuration-agent.ts` (615 lines)
- `backend/src/agents/validation-agent.ts` (236 lines)

### "I want to understand how research works"

**Start here**: `backend/src/services/parallel-mcp.ts:129`

**Path**:
1. Research task created → `createResearchTask()` (Line 129)
2. Task stored in memory → Line 167
3. Research executed async → `executeResearch()` (Line 193)
4. WebSocket notification sent → `research-websocket.ts:73`
5. Frontend receives update → `useWebSocket.ts:48`
6. UI shows research indicator → `ResearchNotification.tsx:38`

**Key Files**:
- `backend/src/services/parallel-mcp.ts` (338 lines)
- `backend/src/websocket/research-websocket.ts` (199 lines)
- `frontend/src/hooks/useWebSocket.ts` (118 lines)
- `frontend/src/components/ResearchNotification.tsx` (77 lines)

### "I want to understand how conversational chat works"

**Start here**: `backend/src/routes/chat.ts:65`

**Path**:
1. User sends message → `POST /api/chat` (Line 65)
2. Internal review agent analyzes state → `internal-review-agent.ts:86`
3. Conversational agent generates response → `conversational-assistant.ts:126`
4. Response returned with confidence → `chat.ts:151`

**Key Files**:
- `backend/src/routes/chat.ts` (177 lines)
- `backend/src/agents/conversational-assistant.ts` (285 lines)
- `frontend/src/components/ChatInterface.tsx` (217 lines)

### "I want to understand how timeline editing works"

**Start here**: `frontend/src/views/TimelineView.tsx:209`

**Path**:
1. User clicks edit → `handleEditBlock()` (Line 209)
2. Block switches to edit mode → `TimelineBlock.tsx:67`
3. User types changes → Line 88
4. User presses Ctrl+Enter → `handleKeyDown()` (Line 96)
5. Changes saved to backend → `api.saveTimeline()` (Line 223)
6. Database updated → `backend/src/routes/save.ts:145`

**Key Files**:
- `frontend/src/components/TimelineBlock.tsx` (154 lines)
- `frontend/src/views/TimelineView.tsx` (362 lines)
- `backend/src/routes/save.ts` (277 lines)

### "I want to understand how WebSocket notifications work"

**Start here**: `backend/src/websocket/research-websocket.ts:28`

**Path**:
1. Server initializes WebSocket → Line 28
2. Client connects → `useWebSocket.ts:32`
3. Research starts → Backend calls `notifyResearchStarted()` (Line 73)
4. Message broadcast to clients → Line 144
5. Client receives message → `useWebSocket.ts:48`
6. UI updates → `ResearchNotification.tsx:38`

**Key Files**:
- `backend/src/websocket/research-websocket.ts` (199 lines)
- `frontend/src/hooks/useWebSocket.ts` (118 lines)

### "I want to understand the database schema"

**Start here**: `backend/src/database/schema.sql:1`

**Structure**:
```
timelines (id, end_goal, start_age, end_age, created_at)
    ↓
layers (id, timeline_id, title, duration_years, description, layer_number)
    ↓
blocks (id, layer_id, title, duration_text, description, order_index)
    ↓
research_tasks (id, block_id, task_id, status, processor, query, results)
    ↓
uploaded_files (id, timeline_id, filename, content_type, file_data, extracted_text)
```

**Key Files**:
- `backend/src/database/schema.sql` (Complete schema)
- `backend/src/database/db.ts` (Connection and transactions)

---

## 5. Tracing User Flows

### Flow 1: Generate New Timeline

**User Action**: Fill form and click "Generate Timeline"

**Frontend**:
```
App.tsx:40
  ↓
TimelineView.tsx:167 (handleSubmit)
  ↓
api.ts:68 (generateTimeline)
  ↓
POST /api/configure-with-context
```

**Backend**:
```
server.ts:89 (route registered)
  ↓
configure-with-context.ts:175 (POST handler)
  ↓
pre-validation-agent.ts:84 (validate input)
  ↓
configuration-agent.ts:348 (generate timeline)
  ↓
validation-agent.ts:97 (validate timeline)
  ↓
configure-with-context.ts:632 (save to database)
  ↓
parallel-mcp.ts:129 (spawn research)
  ↓
research-websocket.ts:73 (notify clients)
  ↓
Return timeline_id
```

**Frontend**:
```
api.ts:82 (receive response)
  ↓
TimelineView.tsx:180 (setTimelineData)
  ↓
LayerView.tsx:47 (render layers)
  ↓
TimelineBlock.tsx:40 (render blocks)
```

**Files Touched**: 11 files, ~2500 lines total

### Flow 2: Async Research Notification

**Trigger**: Research task completes in background

**Backend**:
```
parallel-mcp.ts:193 (executeResearch)
  ↓
parallel-mcp.ts:227 (research completes)
  ↓
research-websocket.ts:112 (notifyResearchComplete)
  ↓
research-websocket.ts:144 (broadcast)
  ↓
WebSocket send to all clients
```

**Frontend**:
```
useWebSocket.ts:48 (message received)
  ↓
useWebSocket.ts:58 (parse research_complete)
  ↓
TimelineView.tsx:140 (useWebSocket callback)
  ↓
ResearchNotification.tsx:38 (update UI)
```

**Files Touched**: 4 files, ~500 lines total

### Flow 3: Edit Block and Save

**User Action**: Click block, edit text, press Ctrl+Enter

**Frontend**:
```
TimelineBlock.tsx:67 (setIsEditing)
  ↓
TimelineBlock.tsx:88 (onChange)
  ↓
TimelineBlock.tsx:96 (handleKeyDown - Ctrl+Enter)
  ↓
TimelineView.tsx:209 (handleEditBlock)
  ↓
api.ts:99 (saveTimeline)
  ↓
PUT /api/save/:id
```

**Backend**:
```
save.ts:106 (PUT handler)
  ↓
save.ts:145 (update transaction)
  ↓
db.ts:44 (execute UPDATE)
  ↓
Return success
```

**Frontend**:
```
api.ts:106 (receive response)
  ↓
TimelineView.tsx:223 (update state)
  ↓
TimelineBlock.tsx:67 (setIsEditing(false))
```

**Files Touched**: 5 files, ~800 lines total

### Flow 4: Ask Question via Chat

**User Action**: Type question and press Enter

**Frontend**:
```
ChatInterface.tsx:64 (handleSend)
  ↓
api.ts:88 (sendChatMessage)
  ↓
POST /api/chat
```

**Backend**:
```
chat.ts:65 (POST handler)
  ↓
internal-review-agent.ts:86 (analyze state)
  ↓
conversational-assistant.ts:126 (generate response)
  ↓
Return response + confidence
```

**Frontend**:
```
api.ts:93 (receive response)
  ↓
ChatInterface.tsx:72 (add to messages)
  ↓
ChatInterface.tsx:112 (render message)
```

**Files Touched**: 5 files, ~700 lines total

---

## 6. Finding Specific Functionality

### "Where is X implemented?"

| Functionality | File | Lines |
|--------------|------|-------|
| Timeline generation | `backend/src/agents/configuration-agent.ts` | 348-570 |
| Timeline validation | `backend/src/agents/validation-agent.ts` | 97-180 |
| Research spawning | `backend/src/services/parallel-mcp.ts` | 129-191 |
| Research execution | `backend/src/services/parallel-mcp.ts` | 193-276 |
| WebSocket broadcast | `backend/src/websocket/research-websocket.ts` | 144-162 |
| Database save | `backend/src/routes/configure-with-context.ts` | 632-735 |
| Timeline editing | `frontend/src/components/TimelineBlock.tsx` | 67-132 |
| Chat interface | `frontend/src/components/ChatInterface.tsx` | 64-160 |
| Theme toggle | `frontend/src/contexts/ThemeContext.tsx` | 22-45 |
| API client | `frontend/src/lib/api.ts` | 1-132 |
| Logging | `backend/src/utils/logger.ts` | 1-104 |
| Validation schemas | `backend/src/utils/validation.ts` | 1-198 |

### "Where is data structure X defined?"

| Data Structure | File | Lines |
|---------------|------|-------|
| AgentContext | `backend/src/types/agent-context.ts` | 12-34 |
| TimelineData | `backend/src/types/agent-context.ts` | 36-58 |
| LayerData | `backend/src/types/agent-context.ts` | 60-67 |
| BlockData | `backend/src/types/agent-context.ts` | 69-75 |
| ResearchTask | `backend/src/types/agent-context.ts` | 77-91 |
| ResearchUpdate | `backend/src/websocket/research-websocket.ts` | 10-22 |
| API Request/Response | `backend/src/utils/validation.ts` | 1-198 |

### "Where is API endpoint X?"

| Endpoint | File | Method | Lines |
|----------|------|--------|-------|
| `/api/configure-with-context` | `configure-with-context.ts` | POST | 175-766 |
| `/api/configure` | `configure.ts` | POST | 50-203 |
| `/api/chat` | `chat.ts` | POST | 65-170 |
| `/api/save/:id` | `save.ts` | PUT | 106-196 |
| `/api/timelines/:id` | `save.ts` | GET | 52-103 |
| `/api/research/:taskId` | `research-status.ts` | GET | 31-77 |
| `/api/health` | `health.ts` | GET | 11-28 |

### "Where is React component X?"

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| App | `App.tsx` | 89 | Root component |
| TimelineView | `TimelineView.tsx` | 362 | Main timeline UI |
| LayerView | `LayerView.tsx` | 147 | Layer container |
| TimelineBlock | `TimelineBlock.tsx` | 154 | Individual block |
| ChatInterface | `ChatInterface.tsx` | 217 | Q&A chat |
| ResearchNotification | `ResearchNotification.tsx` | 77 | Research status |
| PricingModal | `PricingModal.tsx` | 169 | Pricing display |

---

## 7. Development Workflow

### Setting Up for Development

**1. Clone and Install**:
```bash
git clone <repo-url>
cd Career-Trajectory

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

**2. Configure Environment**:
```bash
# Copy example env file
cd backend
cp .env.example .env

# Edit .env with your API keys
# Required: ANTHROPIC_API_KEY, PARALLEL_API_KEY
# Optional: LANGCHAIN_TRACING_V2, LANGCHAIN_API_KEY
```

**3. Initialize Database**:
```bash
# Database initializes automatically on first run
# Schema: backend/src/database/schema.sql
# Location: backend/data/timelines.db
```

**4. Run Development Servers**:
```bash
# Terminal 1: Backend (port 3001)
cd backend
npm run dev

# Terminal 2: Frontend (port 5173)
cd frontend
npm run dev
```

**5. Access Application**:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- WebSocket: ws://localhost:3001/ws
- LangSmith: https://smith.langchain.com (if enabled)

### Making Changes

**Backend Changes**:
```bash
# Edit TypeScript files in backend/src/
# Server auto-reloads via tsx --watch

# Example: Add new API route
1. Create file: backend/src/routes/my-route.ts
2. Register in: backend/src/server.ts
3. Test with: curl http://localhost:3001/api/my-route
```

**Frontend Changes**:
```bash
# Edit React files in frontend/src/
# Vite HMR updates instantly

# Example: Add new component
1. Create file: frontend/src/components/MyComponent.tsx
2. Import in: frontend/src/App.tsx or other component
3. Browser updates automatically
```

**Database Changes**:
```bash
# Edit schema.sql
# Delete database to force recreation
rm backend/data/timelines.db

# Restart backend server
# Database will be recreated with new schema
```

### Testing Changes

**Backend Testing**:
```bash
# Manual API testing
curl -X POST http://localhost:3001/api/configure-with-context \
  -H "Content-Type: application/json" \
  -d '{"end_goal": "Test goal", "start_age": 18, "end_age": 25}'

# Check logs in terminal
# LangSmith traces at: https://smith.langchain.com
```

**Frontend Testing**:
```bash
# Open browser console (F12)
# Check for errors and network requests
# Test user interactions manually
```

**Production Build Testing**:
```bash
# Backend
cd backend
npm run build  # Compiles to dist/
npm start      # Runs compiled version

# Frontend
cd frontend
npm run build  # Builds to dist/
npm run preview  # Serves production build on port 4173
```

### Common Development Tasks

**Add New Agent**:
1. Create file: `backend/src/agents/my-agent.ts`
2. Implement agent function with LangSmith traceable wrapper
3. Import in route that uses it
4. Update `REVIEW_DOCUMENTATION/02_MEDIUM_LEVEL.md`

**Add New API Endpoint**:
1. Create file: `backend/src/routes/my-endpoint.ts`
2. Add Zod validation schema in `backend/src/utils/validation.ts`
3. Register route in `backend/src/server.ts`
4. Add API client function in `frontend/src/lib/api.ts`
5. Update `REVIEW_DOCUMENTATION/02_MEDIUM_LEVEL.md`

**Add New React Component**:
1. Create file: `frontend/src/components/MyComponent.tsx`
2. Use TypeScript interfaces for props
3. Import in parent component
4. Update `REVIEW_DOCUMENTATION/02_MEDIUM_LEVEL.md`

**Add New Database Table**:
1. Edit `backend/src/database/schema.sql`
2. Add TypeScript interface in `backend/src/types/`
3. Delete `backend/data/timelines.db`
4. Restart backend to recreate database

**Add Environment Variable**:
1. Add to `backend/.env.example` with description
2. Add to `.env` with actual value
3. Use in code: `process.env.VARIABLE_NAME`
4. Update `README.md` environment section

### Debugging Tips

**Backend Debugging**:
```typescript
// Use Logger utility (includes LangSmith tracing)
import { Logger } from '../utils/logger';

Logger.info('Debug message', { data: value });
Logger.error('Error occurred', error, { context: info });
```

**Frontend Debugging**:
```typescript
// Use console logs (removed in production build)
console.log('[Component] State:', state);

// Use React DevTools browser extension
// Inspect component props and state
```

**WebSocket Debugging**:
```typescript
// Backend: Add logs to research-websocket.ts
Logger.info('[WebSocket] Broadcasting', { type, taskId, clientCount });

// Frontend: Check useWebSocket.ts console logs
console.log('[WebSocket] Message received:', data);
```

**Database Debugging**:
```bash
# Open database directly
cd backend/data
sqlite3 timelines.db

# Run SQL queries
SELECT * FROM timelines;
SELECT * FROM layers WHERE timeline_id = 1;
.schema blocks
```

**LangSmith Debugging**:
1. Go to https://smith.langchain.com
2. Find project: "career-trajectory"
3. View traces for AI agent calls
4. Check input/output for each agent
5. Review token usage and latency

---

## Quick Reference

### Key Directories
- `backend/src/agents/` - AI agents
- `backend/src/routes/` - API endpoints
- `backend/src/services/` - External integrations
- `frontend/src/components/` - React UI components
- `frontend/src/views/` - Main views
- `REVIEW_DOCUMENTATION/` - Technical docs

### Key Files
- `backend/src/server.ts` - Backend entry point
- `frontend/src/App.tsx` - Frontend entry point
- `backend/src/types/agent-context.ts` - Core data structures
- `backend/src/database/schema.sql` - Database schema
- `README.md` - Project overview
- `CURRENT_STATE.md` - Production status

### Key Commands
```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm start            # Run production build

# Database
rm backend/data/timelines.db  # Reset database
sqlite3 backend/data/timelines.db  # Open database

# Testing
curl http://localhost:3001/api/health  # Test backend
```

### Key URLs
- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- WebSocket: ws://localhost:3001/ws
- LangSmith: https://smith.langchain.com

---

**END OF EXPLORATION GUIDE**
