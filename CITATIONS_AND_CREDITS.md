# Citations and Credits

---

## Academic Foundations

### Multi-Agent Systems

**Tampuu et al. (2017)** - "Multiagent deep reinforcement learning with extremely sparse rewards"
- *Application*: Inspired our multi-agent coordination patterns where agents must achieve confidence thresholds before proceeding to next stage.

**Stone et al. (2000)** - "Multiagent Systems: A Survey from a Machine Learning Perspective"
- *Application*: Informed our confidence-based agent coordination architecture and communication protocols between agents.

### Distributed Systems

**Hewitt et al. (1973)** - "A Universal Modular ACTOR Formalism for Artificial Intelligence"
- *Application*: Actor model pattern influenced our async research service with fire-and-forget message passing for non-blocking research execution.

**Lewis & Fowler (2014)** - "Microservices" (martinfowler.com)
- *Application*: Microservices principles applied to our separation of 7 independent agents, each with single responsibility.

**Hohpe & Woolf (2003)** - "Enterprise Integration Patterns"
- *Application*: Event-driven architecture inspired our WebSocket broadcast pattern for real-time research notifications.

---

## Technical Frameworks

### Backend
- **LangChain** (Smith et al., 2023) - AI agent orchestration framework → Used for agent wrapping and LangSmith tracing
- **Anthropic Claude Sonnet 4.5** - Primary reasoning engine → Powers all 7 agents with structured outputs
- **Express.js** - Web framework → API server for 7 REST endpoints
- **SQLite (better-sqlite3)** - Database → Synchronous timeline/research storage with ACID transactions
- **Zod** - Schema validation → Runtime type checking for all API requests/responses

### Frontend
- **React 18** (Meta, 2022) - UI framework → Concurrent features for smooth research updates
- **Vite** (Evan You, 2020) - Build tool → Fast HMR for development
- **Tailwind CSS** (Adam Wathan et al., 2017) - Utility CSS → Dark mode and responsive timeline design
- **TypeScript** (Microsoft, 2012) - Type safety → Strict mode across entire codebase

### Infrastructure
- **LangSmith** (LangChain) - AI observability → Traces every agent call with input/output/tokens
- **WebSocket (ws library)** - Real-time updates → Research status broadcast to frontend clients

---

## Project Innovations

### 1. 95% Confidence Threshold Architecture
**Original contribution** - Quality gate system requiring 95%+ agent confidence before expensive operations
- Inspired by: Conservative assumption policies in safety-critical AI systems
- Validation: 5 comprehensive E2E test scenarios

### 2. Fire-and-Forget Async Research
**Original contribution** - Non-blocking research pattern with WebSocket notifications
- Pattern: Research spawns in background, UI updates via WebSocket, no blocking
- Visual feedback: Pulsing blue dots (in-progress), green glow (complete)

### 3. Selective Research Spawning
**Original contribution** - Layer-based research filtering to reduce costs
- Layer 1: Research all blocks (strategic level needs depth)
- Layer 2: Research only keyword-matching blocks (tactical filtering)
- Layer 3: No research (execution level too granular)

---

## Acknowledgments

**Direct Contributors**:
- Vignan Kamarthi - Architecture, implementation
- Claude Code - Implementation assistance, documentation

**Community Influences**:
- LangChain community - Best practices for production AI agents
- AI Research Twitter/X - Multi-agent system discussions
- Open source maintainers - React, Vite, Tailwind, Express ecosystems

---

## System Summary (v2.0)

**Architecture**: 7-agent system (4-agent pipeline + validation + 5 research specialists)
**Research**: Parallel AI integration with 9 processor tiers (lite → ultra8x)
**Real-time**: WebSocket-powered async research notifications
**Observability**: LangSmith tracing on every AI operation
**Database**: SQLite with strict constraints for timeline/research/files
**Frontend**: React 18 + TypeScript + Tailwind with dark mode
**Production**: TypeScript strict mode (0 errors), optimized bundles, comprehensive docs

---

## Citation Format

**Academic**:
```
Kamarthi, V. (2025). Career Trajectory AI: A Confidence-Threshold Multi-Agent System
for Personalized Career Planning. https://github.com/vignankamarthi/Career-Trajectory
```

**Technical**:
```
Multi-Agent Architecture with 95% confidence thresholds, async research integration,
and WebSocket real-time updates. Stack: Claude Sonnet 4.5 + LangChain + React 18.
License: MIT | Docs: REVIEW_DOCUMENTATION/
```

---

**Last Updated**: November 9, 2025
**Version**: 2.0 (Production-ready)

*For detailed technical documentation, see [REVIEW_DOCUMENTATION/](./REVIEW_DOCUMENTATION/)*
