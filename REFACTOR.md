# REFACTOR PLAN - Recovery to NEXT_GEN_ARCHITECTURE

## 🎯 **CURRENT POINTER**: Backend Validation Checkpoint - AWAITING USER MANUAL TEST at http://localhost:3001/api/test/websocket

---

## Problem Statement
- Had an AMAZING working project that was perfectly built around `NEXT_GEN_ARCHITECTURE.md`
- The final app UI was perfect and everything worked
- Accidentally reverted to an old version (without git)
- **GOAL**: Get back to that working state

## Target State
- Rebuild entire project to match specifications in `NEXT_GEN_ARCHITECTURE.md`
- Restore the perfect UI that was working
- Ensure all functionality matches the final working version

## Current State
- Reverted to old version
- Need to rebuild according to NEXT_GEN_ARCHITECTURE.md

---

## KEY ARCHITECTURE INSIGHTS (From File Analysis)

### NEXT_GEN_ARCHITECTURE.md Core Features:
1. **Async Research Orchestrator** - Uses Parallel Task MCP Server for background research
2. **Chain of Agents Pattern** - Training-free, task-agnostic framework (2025 papers)
3. **MAPLE Memory System** - Multi-Agent Adaptive Planning for long-term memory
4. **Bayesian Nash Equilibrium Coordination** - Agent negotiation for optimal config
5. **Decoupled Research Latency** - Research doesn't block conversation flow
6. **Progressive Enhancement** - Timeline starts simple, gets richer over time
7. **WebSocket Real-Time Updates** - Live research progress notifications
8. **Per-Block Research Control** - User chooses research depth per block

### OLD vs NEW Architecture Comparison:

| Feature | OLD (AGENT_ARCHITECTURE.md) | NEW (NEXT_GEN_ARCHITECTURE.md) |
|---------|----------------------------|-------------------------------|
| Research Flow | Synchronous, blocks UI | Async, background tasks |
| User Experience | Wait 30-60s | See results in 5-10s |
| Research Control | All or nothing | Per-block granular control |
| Notifications | None | WebSocket real-time updates |
| Iteration Speed | Serial | Parallel (3-5x faster) |
| Memory System | None | MAPLE (planned v2.0) |

---

## REFACTOR EXECUTION TIMELINE

### **PHASE 0: Problem Definition** ✅ COMPLETE
- ✅ Goal: Restore NEXT_GEN_ARCHITECTURE.md implementation
- ✅ Scope: End-to-end system (frontend + backend + architecture)
- ✅ Success Criteria: Async research, real-time updates, perfect UI

### **PHASE 1: Architecture Exploration** ✅ COMPLETE

**Current Task**: Creating updated CLAUDE.md that reflects NEXT_GEN migration

#### Step 1.1: Read All Architecture Files ✅ COMPLETE
- ✅ Read AGENT_ARCHITECTURE.md (old 4-agent system)
- ✅ Read NEXT_GEN_ARCHITECTURE.md (async + Chain of Agents)
- ✅ Read CITATIONS_AND_CREDITS.md (academic attribution)
- ✅ Read CLAUDE.md (current system config)

#### Step 1.2: Update CLAUDE.md ✅ COMPLETE
- ✅ Edit CLAUDE.md to reflect NEXT_GEN migration
- ✅ Keep useful metadata (Parallel AI config, LangSmith, etc.)
- ✅ State that we're following this refactoring plan
- ✅ Maintain holistic role as global config file

#### Step 1.3: Create Holistic CLAUDE.md with Template ✅ COMPLETE
- ✅ Combine updated CLAUDE.md + Universal Technical Iteration Loop template
- ✅ Integrate old information INTO template structure
- ✅ **USER APPROVED** - Moving forward

#### Step 1.4: Update CITATIONS_AND_CREDITS.md ✅ COMPLETE
- ✅ Review what features are ACTUALLY implemented vs planned
- ✅ Removed ALL citations for unimplemented features (Chain of Agents, MAPLE, MIRIX, SWEET-RL, STeCa, CS-Agent, CoMet)
- ✅ Kept only foundational influences and framework credits
- ✅ Added "Currently Implemented Features" section for clarity

#### Step 1.5: Rename Architecture Files ✅ COMPLETE
- ✅ Deleted AGENT_ARCHITECTURE.md (old 4-agent synchronous system)
- ✅ Renamed NEXT_GEN_ARCHITECTURE.md → CURRENT_AGENT_ARCHITECTURE.md (new async target)

### **PHASE 2: IMPLEMENTATION** 🔄 IN PROGRESS

**Status**: Building async research infrastructure + Chain of Agents pattern

#### Backend Refactor (IN PROGRESS)
- 🔄 Async Research Infrastructure
  - ✅ ParallelMCPService implementation (background research tasks)
  - ✅ Task queue system (in-memory with cleanup)
  - ✅ WebSocket server setup (ws://localhost:3001/ws)
  - [ ] Database schema updates for task tracking
- ✅ Chain of Agents Pattern
  - ✅ ChainCoordinator implementation (agent orchestration)
  - ✅ Agent async task spawning (background tasks)
  - ✅ Background research execution (via ParallelMCP)
- [ ] API Updates
  - [ ] WebSocket endpoints for research updates
  - [ ] Task status endpoints
  - [ ] Updated agent orchestration flow

#### Backend Validation Checkpoint 🔄 IN PROGRESS
**Critical Infrastructure Testing Before Frontend Development**

**Rationale**: Validate WebSocket + async research infrastructure works before building frontend. Prevents debugging nightmares and ensures solid foundation.

**Testing Steps**:
- ✅ Start backend server (verify WebSocket initialization) **COMPLETE**
- 🔄 **MANUAL TEST REQUIRED** - Access http://localhost:3001/api/test/websocket in browser
- [ ] Click "1. Connect WebSocket" button → Should see "✅ WebSocket CONNECTED!"
- [ ] Click "2. Trigger Test Research" button → Should create task
- [ ] Verify WebSocket broadcasts research_started (watch log)
- [ ] Verify research executes in background (wait ~5-60s for LITE processor)
- [ ] Verify WebSocket broadcasts research_complete (watch log)
- [ ] Check task status tracking (logs show task progression)
- [ ] Verify graceful error handling (test endpoint handles errors)

**Current Status**: Server running at http://localhost:3001
- ✅ WebSocket server: ws://localhost:3001/ws
- ✅ Test page: http://localhost:3001/api/test/websocket
- ✅ Backend infrastructure ready for testing

**SUCCESS CRITERIA**: All 8 tests pass → Proceed to frontend with confidence

**If Issues Found**: Debug and fix infrastructure before frontend work

---

## 🧪 **USER ACTION REQUIRED**:
**Open http://localhost:3001/api/test/websocket in your browser and run the manual tests above!**
This validates the entire async research + WebSocket flow works correctly before we build the frontend.

#### Frontend Refactor (Starts after Backend Validation passes)
- [ ] Real-Time Notifications
  - [ ] WebSocket client integration
  - [ ] ResearchNotification component
  - [ ] Pulsing dots for blocks being researched
  - [ ] Green borders for research-complete blocks
- [ ] Progressive Enhancement UI
  - [ ] Timeline displays immediately (no research)
  - [ ] Research happens in background
  - [ ] Smooth transitions on research complete
- [ ] Per-Block Research Control
  - [ ] Research processor choice UI
  - [ ] Cost transparency per block
  - [ ] "Refactor without research" button

### **PHASE 3: Testing Strategy** ⏳ PENDING
- Will brainstorm together after Phase 2 check-in
- Must include: career trajectory map testing
- Focus: Async flow, WebSocket updates, UI responsiveness

### **PHASE 4: Last-Minute UI Changes** ⏳ PENDING
- User plays with test career trajectory maps
- Make final UI adjustments based on feedback

### **PHASE 5: Documentation Finalization** ⏳ PENDING
- Sit down together and decide:
  - What to update
  - What to keep
  - What to delete
  - What to add
- Final state of project complete after documentation

---

## GIT WORKFLOW

Throughout development, group commits logically:
- Feature-based commits (e.g., "Add async research infrastructure")
- Test commits after major features
- Documentation commits after completion
- Follow good development practices

---

## NOTES & DISCOVERIES

### Key Insight #1: Research Latency Decoupling
The biggest change in NEXT_GEN is that research no longer blocks the UI. Users see timelines immediately and research enhances them progressively.

### Key Insight #2: WebSocket Architecture
Real-time updates require WebSocket server + client integration. This is a major infrastructure change.

### Key Insight #3: Chain of Agents Pattern
From 2025 NeurIPS paper (Zhang et al.). Training-free, task-agnostic multi-agent collaboration pattern.

---

*Status: Phase 1 Architecture Exploration - IN PROGRESS*
*Last Updated: Just now*
*Next Action: Update CLAUDE.md with NEXT_GEN migration details*
