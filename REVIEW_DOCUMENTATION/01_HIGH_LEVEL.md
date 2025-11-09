# High-Level System Architecture

**Career Trajectory AI - Production Documentation**
**Date**: 2025-11-09
**Status**: Production Ready
**Version**: 2.1

---

## Executive Summary

Career Trajectory AI is a production-grade AI-powered career planning platform that generates personalized, multi-layer career timelines through intelligent conversation. The system features a 4-agent architecture with async research capabilities, real-time WebSocket notifications, and comprehensive observability via LangSmith tracing.

**Key Metrics**:
- **Timeline Generation**: 5-10 seconds (95% confidence threshold)
- **Research Latency**: Non-blocking (30s-20min background execution)
- **Technology**: Claude Sonnet 4.5, React 18, TypeScript, SQLite
- **Architecture**: Async multi-agent system with WebSocket real-time updates

---

## System Architecture Overview

### Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React 18)                      │
│  ┌──────────────────┐    ┌────────────────┐   ┌──────────────┐ │
│  │ Conversational   │    │ Timeline       │   │ WebSocket    │ │
│  │ Config View      │───▶│ View           │◀──│ Client       │ │
│  │ (Chat Interface) │    │ (Visual Editor)│   │ (Real-time)  │ │
│  └──────────────────┘    └────────────────┘   └──────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTP/REST
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXPRESS SERVER (Node.js)                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    7 API ROUTES                           │  │
│  │  /configure-with-context  /timelines  /blocks  /chat     │  │
│  │  /save  /analyze  /validate                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌──────────────────┐    ┌─────────────────┐   ┌────────────┐ │
│  │ 4-Agent System   │    │ Async Research  │   │ WebSocket  │ │
│  │ (Chain of Agents)│───▶│ Service         │──▶│ Server     │ │
│  └──────────────────┘    └─────────────────┘   └────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                   │                    │
         ┌─────────┴────────┐  ┌────────┴─────────┐
         ▼                  ▼  ▼                  ▼
┌─────────────────┐  ┌────────────────┐  ┌──────────────┐
│ Claude Sonnet   │  │ Parallel AI    │  │ SQLite       │
│ 4.5 (Anthropic) │  │ (Research API) │  │ Database     │
└─────────────────┘  └────────────────┘  └──────────────┘
         │                    │                  │
         ▼                    ▼                  ▼
┌─────────────────┐  ┌────────────────┐  ┌──────────────┐
│ LangSmith       │  │ 9 Processor    │  │ 8 Tables     │
│ (Observability) │  │ Tiers (lite    │  │ (Timelines,  │
│                 │  │ → ultra8x)     │  │ Blocks, etc.)│
└─────────────────┘  └────────────────┘  └──────────────┘
```

---

## Design Philosophy

### 1. Confidence-Driven Architecture

**Core Principle**: Every agent must achieve **AT LEAST 95% confidence** before proceeding to the next stage.

**Why 95%?**
- Prevents expensive operations on incomplete data
- Ensures high-quality timeline generation
- Reduces wasted API costs from retries
- Creates predictable, reliable user experience

**Confidence Gates**:
1. **Pre-Validation Agent**: 95% confidence that input is complete
2. **Conversational Agent**: 95% confidence that user intent is clear
3. **Internal Review Agent**: 95% confidence before expensive generation
4. **Configuration Agent**: 90% confidence (slightly lower for creative output)

### 2. Async Research Architecture

**Problem**: Research takes 30s to 20 minutes, blocking timeline generation.

**Solution**: Fire-and-forget background research with WebSocket notifications.

**Benefits**:
- Timeline generation: 5-10s (previously 60-180s)
- Non-blocking UI - users can chat/edit while research runs
- Progressive enhancement - timeline starts simple, gets richer
- Real-time feedback via pulsing dots and toast notifications

### 3. Attention Mechanism

**Inspired by**: "Attention Is All You Need" (Transformer paper)

**Implementation**: Each agent writes what IT thinks is important to a shared `attention` field.

**Flow**:
```typescript
Validation → Conversational → Internal → Configuration
    ↓              ↓              ↓             ↓
Missing info   Clarified    Detected      Generated
  + gaps       intent +     changes +     structure +
  + focus      preferences  priorities    challenges
```

**Example**:
```json
{
  "attention": {
    "validation_agent": {
      "confidence_score": 75,
      "missing_information": ["specific bioengineering subfield"],
      "focus_areas": ["research vs clinical pathway"]
    },
    "conversational_agent": {
      "confidence_score": 95,
      "clarified_intent": "User wants computational biology with wet lab experience"
    },
    "configuration_agent": {
      "confidence_score": 92,
      "generated_structure": "3-layer timeline: foundation → specialization → application"
    }
  }
}
```

---

## Data Flow Architecture

### User Journey Flow

```
1. USER INPUT (ConversationalConfigView)
   ├─ Form: name, age range, goal, layers
   ├─ Optional: PDF upload (resume, transcript)
   └─ HTTP POST /api/configure-with-context/init
        ↓
2. PRE-VALIDATION AGENT
   ├─ Analyzes input completeness
   ├─ Confidence < 95%? → Generate questions
   └─ Returns: confidence_score, questions, attention
        ↓
3. CONVERSATIONAL CLARIFICATION (if needed)
   ├─ HTTP POST /api/configure-with-context/clarify
   ├─ User responds to questions
   ├─ Repeat until confidence ≥ 95%
   └─ Returns: next_question | ready_to_generate
        ↓
4. INTERNAL REVIEW AGENT
   ├─ Final quality gate before expensive operations
   ├─ Validates all constraints
   └─ Returns: is_confident | issues
        ↓
5. CONFIGURATION AGENT
   ├─ Generates 3-layer timeline structure
   ├─ HTTP POST /api/configure-with-context/generate
   ├─ Inserts timeline → layers → blocks into SQLite
   └─ Returns: timeline_id
        ↓
6. ASYNC RESEARCH SPAWN (Non-blocking)
   ├─ Selectively spawns research for qualifying blocks
   │  - Layer 1: ALL blocks researched (strategic value)
   │  - Layer 2: Keyword filtering (education/career only)
   │  - Layer 3: No research (too granular)
   ├─ WebSocket broadcast: research_started
   └─ Background execution via ParallelMCPService
        ↓
7. TIMELINE VIEW
   ├─ User sees timeline immediately (5-10s total)
   ├─ Blue pulsing dots on blocks being researched
   ├─ Toast notifications for research events
   └─ Green glow animation when research completes
        ↓
8. CONVERSATIONAL EDITING
   ├─ HTTP POST /api/chat/:timelineId
   ├─ User refines timeline via natural language
   ├─ Conversational Assistant handles edits
   └─ Real-time updates via WebSocket
```

---

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18 | UI framework with hooks architecture |
| TypeScript | 5.x | Type safety throughout |
| Vite | 5.x | Build tool (3x faster than Webpack) |
| Tailwind CSS | 3.x | Utility-first styling with dark mode |
| React Query | 4.x | Data fetching & caching |
| WebSocket API | Native | Real-time research updates |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | JavaScript runtime |
| Express.js | 4.x | HTTP server framework |
| TypeScript | 5.x | Type safety |
| SQLite | 3.x | Embedded database |
| ws | 8.x | WebSocket server |
| LangChain | 0.3.x | AI agent orchestration |

### AI & External Services
| Service | Purpose | Cost Model |
|---------|---------|------------|
| Claude Sonnet 4.5 | Primary reasoning engine | $3/MTok input, $15/MTok output |
| Parallel AI | Research capabilities | $0.005-$2.40 per query |
| LangSmith | Observability & tracing | Free tier available |

### Database Schema
| Table | Purpose | Row Count (Typical) |
|-------|---------|----------------------|
| timelines | User career timelines | 1-10 per user |
| layers | Timeline layers (1-3) | 2-3 per timeline |
| blocks | Career milestones | 10-30 per timeline |
| conversations | Chat history | 5-50 per timeline |
| agent_contexts | Agent state | 1 per timeline |
| research_tasks | Async research tracking | 5-15 per timeline |
| save_history | Version snapshots | 3-10 per timeline |
| metadata | Uploaded files | 0-5 per timeline |

---

## Core Workflows

### Workflow 1: Initial Timeline Generation

**Trigger**: User submits initial configuration form
**Duration**: 5-10 seconds (95% confidence path)
**Cost**: $0.30-$0.70 (4-agent pipeline)

**Steps**:
1. POST /api/configure-with-context/init
2. Pre-Validation Agent analyzes input → 75% confidence
3. Conversational Agent asks 2-3 clarifying questions
4. User responds → 95% confidence reached
5. Internal Review Agent validates → green light
6. Configuration Agent generates timeline → 92% confidence
7. Timeline saved to SQLite, returned to frontend
8. Async research spawned for qualifying blocks
9. User sees timeline in TimelineView

**Error Handling**:
- If confidence never reaches 95% after 5 attempts → Fallback to simpler timeline
- If Claude API fails → User-friendly error modal
- If database constraint fails → Validation error with specific fix

### Workflow 2: Async Research Execution

**Trigger**: Timeline generation or manual block research
**Duration**: Non-blocking (30s-20min background)
**Cost**: $0.005-$2.40 per query (depends on processor tier)

**Steps**:
1. ParallelMCPService.createResearchTask()
   - Assigns UUID task_id
   - Stores in in-memory Map
   - Returns task_id immediately
2. WebSocket broadcast: research_started
   - Frontend receives update
   - Blue pulsing dot appears on block
   - Toast notification shows "Research started..."
3. Background execution via executeResearch()
   - Routes to specialized research agent:
     - UniversityResearchAgent
     - CareerPathResearchAgent
     - SkillsGapAnalysisAgent
     - TimelineOptimizationAgent
     - QuickResearchAgent
   - Parallel AI API call (30s-20min)
4. WebSocket broadcast: research_complete
   - Frontend receives results
   - Blue dot disappears
   - Green glow animation plays
   - Toast notification shows "Research complete!"
5. User clicks block → Research results displayed

**Selective Research Strategy** (Cost Optimization):
- Layer 1 (Strategic): ALL blocks researched (~$1.50 total)
- Layer 2 (Tactical): Keyword filtering (~$0.60 total)
  - Keywords: university, college, degree, career, job, skill, certification
- Layer 3 (Execution): No research (too granular)
- **Total savings**: ~76% cost reduction vs researching all blocks

### Workflow 3: Conversational Timeline Editing

**Trigger**: User sends chat message in TimelineView
**Duration**: 2-5 seconds per message
**Cost**: $0.05-$0.10 per turn

**Steps**:
1. POST /api/chat/:timelineId with user message
2. Load full timeline from SQLite
3. Conversational Assistant analyzes request
   - Context: Full timeline structure + research data + conversation history
   - Output: Specific edits to apply
4. Apply edits to timeline
5. Save updated timeline
6. Return assistant response
7. Frontend updates UI

**Edit Types Supported**:
- Add/remove blocks
- Modify block descriptions
- Adjust timelines/durations
- Request additional research
- Clarify ambiguities

---

## Performance Characteristics

### Latency Targets

| Operation | Target | Achieved | Status |
|-----------|--------|----------|--------|
| Initial Timeline | <10s | 5-10s | ✅ PASS |
| Chat Turn | <5s | 2-5s | ✅ PASS |
| Block Edit | <2s | <2s | ✅ PASS |
| WebSocket Latency | <100ms | <50ms | ✅ PASS |
| Research (async) | Non-blocking | Background | ✅ PASS |

### Scalability Limits

**Current Architecture (SQLite)**:
- **Concurrent Users**: 10-50 (single process)
- **Database Size**: Up to 100GB (SQLite limit)
- **WebSocket Connections**: 1000+ (ws library limit)
- **Research Queue**: In-memory Map (not persisted)

**Production Scale (PostgreSQL + Redis)**:
- **Concurrent Users**: 1000+ (horizontal scaling)
- **Database Size**: Unlimited (PostgreSQL)
- **WebSocket Connections**: 10,000+ (sticky sessions)
- **Research Queue**: Redis/BullMQ (persistent, distributed)

### Cost Structure

| Operation | Anthropic Cost | Parallel AI Cost | Total Cost |
|-----------|----------------|------------------|------------|
| Initial Timeline | $0.30-$0.70 | $0 | $0.30-$0.70 |
| Clarification Turn | $0.05-$0.10 | $0 | $0.05-$0.10 |
| Chat Edit | $0.10-$0.30 | $0 | $0.10-$0.30 |
| Quick Research | $0 | $0.005 | $0.005 |
| Standard Research | $0 | $0.02-$0.10 | $0.02-$0.10 |
| Deep Research | $0 | $0.30-$2.40 | $0.30-$2.40 |

**Typical User Session Cost**: $1.00-$3.00
- Timeline generation: $0.50
- Clarifications (3 turns): $0.30
- Research (5 queries): $0.50-$1.50
- Edits (2 chat turns): $0.20-$0.60

---

## Security & Privacy

### API Key Management
- **Environment Variables**: All keys in `.env` (never committed)
- **No Hardcoded Keys**: Security audit passed (Phase 1)
- **Key Rotation**: Manual rotation via environment update

### Data Privacy
- **SQLite Database**: Local filesystem (not cloud-hosted)
- **No Data Sharing**: User data stays on server
- **Uploaded Files**: Stored in `/uploads`, PDFs extracted locally
- **Soft Deletes**: `is_deleted` flag (no hard deletions)

### Input Validation
- **Zod Schemas**: Runtime validation on all API inputs
- **SQLite Constraints**: Database-level validation:
  - Age ranges: 10-60 years
  - Layer counts: 2 or 3
  - Duration bounds: Layer-specific (4-20y, 0-5y, 0-1y)
  - Status enum: not_started | in_progress | completed

### CORS Policy
- **Allowed Origins**: Configured via environment
- **Default**: `http://localhost:3000` (development)
- **Production**: Specific domain whitelist

---

## Observability & Monitoring

### LangSmith Tracing

**Integration**: All agents wrapped with `traceable()` decorator

**Traced Operations**:
- Agent function calls (4 main agents + 5 research agents)
- Input/output payloads
- Execution duration
- Confidence scores
- Error messages

**Dashboard**: https://smith.langchain.com

**Metrics Available**:
- Agent success rates
- Average confidence scores
- Token usage by agent
- Error frequency by type
- Research query analytics

### Structured Logging

**Implementation**: Custom Logger utility (`backend/src/utils/logger.ts`)

**Log Levels**:
- **INFO**: Normal operations (agent calls, API requests)
- **ERROR**: Failures (API errors, validation failures, DB errors)
- **WARN**: Recoverable issues (low confidence, retries)

**Log Files** (`/logs`):
- `system.log`: All system events
- `llm_calls.log`: Claude API calls with token counts
- `api_calls.log`: HTTP requests/responses
- `errors.log`: Error-level events only

**Cost Tracking**:
- Automatic cost accumulation via Logger.logCost()
- Session summary via Logger.logCostSummary()
- Logged on graceful shutdown (SIGTERM/SIGINT)

### Health Checks

**Endpoint**: GET /health

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-11-09T18:00:00.000Z",
  "environment": "development"
}
```

**Database Health**: GET /test/constraints
- Tests SQLite CHECK constraints
- Verifies layer-specific duration bounds
- Returns success/failure status

---

## Deployment Architecture

### Development Environment

```
├── Backend:  http://localhost:3001 (npm run dev)
├── Frontend: http://localhost:3000 (npm run dev)
├── WebSocket: ws://localhost:3001/ws
├── Database: ../data/timelines.db (SQLite)
└── Logs:     /logs/*.log
```

### Production Build

```bash
# Backend
cd backend
npm run build  # TypeScript → dist/
npm start      # node dist/server.js

# Frontend
cd frontend
npm run build  # Vite → dist/
npm run preview  # Production preview server
```

**Build Artifacts**:
- Backend: `backend/dist/` (compiled JavaScript)
- Frontend: `frontend/dist/` (optimized bundle)
  - `index-*.js`: 442KB (135KB gzipped)
  - `index-*.css`: 51KB (7.8KB gzipped)

### Recommended Cloud Stack

| Component | Recommended Service | Alternative |
|-----------|---------------------|-------------|
| Frontend | Vercel, Netlify | Cloudflare Pages |
| Backend | Railway, Render | DigitalOcean App Platform |
| Database | PostgreSQL (Supabase) | PlanetScale (MySQL) |
| WebSocket | Same as backend | Ably, Pusher |
| Research Queue | Redis Cloud + BullMQ | AWS SQS |
| Monitoring | LangSmith + DataDog | Sentry + Prometheus |

---

## Future Enhancements

### v2.2 Roadmap (Planned)
- [ ] Redis/BullMQ persistent task queue
- [ ] PostgreSQL migration for production
- [ ] Multi-user support with authentication
- [ ] Timeline sharing/collaboration
- [ ] Mobile-responsive improvements

### v3.0 Vision (Exploratory)
- [ ] MAPLE Memory System integration
- [ ] Temporal Workflows for durability
- [ ] MIRIX multi-agent memory
- [ ] SWEET-RL reinforcement learning
- [ ] Bayesian Nash Equilibrium coordination

---

## Key Design Decisions

### Why Async Research?
**Problem**: Research blocking timeline generation (60-180s wait).
**Solution**: Fire-and-forget with WebSocket notifications.
**Result**: 5-10s timeline generation + background research.

### Why 95% Confidence Threshold?
**Problem**: Low-quality timelines from incomplete data.
**Solution**: Force clarification until 95% confidence reached.
**Result**: High-quality outputs, reduced retries.

### Why Attention Mechanism?
**Problem**: Agents working in isolation without context.
**Solution**: Shared attention field where each agent contributes insights.
**Result**: Context-aware agent chain with better coordination.

### Why SQLite?
**Problem**: Need embedded database with zero configuration.
**Solution**: SQLite with CHECK constraints for validation.
**Result**: Development simplicity, easy migration to PostgreSQL later.

### Why WebSocket over Polling?
**Problem**: Polling inefficient for 30s-20min research tasks.
**Solution**: WebSocket server for real-time push notifications.
**Result**: Sub-50ms latency, zero polling overhead.

---

**Document Version**: 1.0
**Last Updated**: 2025-11-09
**Status**: Production Ready
**Maintainer**: Architecture Team

