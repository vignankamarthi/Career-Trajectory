# Citations and Credits

---

## Academic Foundations

### Multi-Agent Systems

**Tampuu et al. (2017)** - "Multiagent deep reinforcement learning with extremely sparse rewards"
- *Application*: Inspired my multi-agent coordination patterns where agents must achieve confidence thresholds before proceeding to next stage.

**Stone et al. (2000)** - "Multiagent Systems: A Survey from a Machine Learning Perspective"
- *Application*: Informed my confidence-based agent coordination architecture and communication protocols between agents.

### Distributed Systems

**Hewitt et al. (1973)** - "A Universal Modular ACTOR Formalism for Artificial Intelligence"
- *Application*: Actor model pattern influenced my async research service with fire-and-forget message passing for non-blocking research execution.

**Lewis & Fowler (2014)** - "Microservices" (martinfowler.com)
- *Application*: Microservices principles applied to my separation of 7 independent agents, each with single responsibility.

**Hohpe & Woolf (2003)** - "Enterprise Integration Patterns"
- *Application*: Event-driven architecture inspired my WebSocket broadcast pattern for real-time research notifications.

---

## Technical Frameworks

### Backend
- **LangChain** (Smith et al., 2023) - AI agent orchestration framework → I used this for agent wrapping and LangSmith tracing
- **Anthropic Claude Sonnet 4.5** - Primary reasoning engine → Powers all 7 agents I built with structured outputs
- **Express.js** - Web framework → I built my API server with 7 REST endpoints
- **SQLite (better-sqlite3)** - Database → I implemented synchronous timeline/research storage with ACID transactions
- **Zod** - Schema validation → I use this for runtime type checking on all API requests/responses

### Frontend
- **React 18** (Meta, 2022) - UI framework → I leveraged concurrent features for smooth research updates
- **Vite** (Evan You, 2020) - Build tool → Fast HMR for my development workflow
- **Tailwind CSS** (Adam Wathan et al., 2017) - Utility CSS → I implemented dark mode and responsive timeline design
- **TypeScript** (Microsoft, 2012) - Type safety → I use strict mode across my entire codebase

### Infrastructure
- **LangSmith** (LangChain) - AI observability → I integrated this to trace every agent call with input/output/tokens
- **WebSocket (ws library)** - Real-time updates → I built research status broadcast to frontend clients

---

## My Innovations

### 1. 95% Confidence Threshold Architecture
**My original contribution** - Quality gate system requiring 95%+ agent confidence before expensive operations
- Inspired by: Conservative assumption policies in safety-critical AI systems
- Validation: I tested with 5 comprehensive E2E scenarios

### 2. Fire-and-Forget Async Research
**My original contribution** - Non-blocking research pattern with WebSocket notifications
- Pattern: Research spawns in background, UI updates via WebSocket, no blocking
- Visual feedback: Pulsing blue dots (in-progress), green glow (complete)

### 3. Selective Research Spawning
**My original contribution** - Layer-based research filtering to reduce costs
- Layer 1: I research all blocks (strategic level needs depth)
- Layer 2: I research only keyword-matching blocks (tactical filtering)
- Layer 3: I skip research (execution level too granular)

---

## Acknowledgments

**Author**:
- Vignan Kamarthi - I designed the architecture and built the entire system

**Implementation Assistance**:
- Claude Code - Helped with implementation and documentation

**Community Influences**:
- LangChain community - Best practices for production AI agents
- AI Research Twitter/X - Multi-agent system discussions
- Open source maintainers - React, Vite, Tailwind, Express ecosystems

---

## System Summary (v2.0)

**Architecture**: 7-agent system I built (4-agent pipeline + validation + 5 research specialists)
**Research**: I integrated Parallel AI with 9 processor tiers (lite → ultra8x)
**Real-time**: I implemented WebSocket-powered async research notifications
**Observability**: I added LangSmith tracing on every AI operation
**Database**: I designed SQLite schema with strict constraints for timeline/research/files
**Frontend**: I built with React 18 + TypeScript + Tailwind with dark mode
**Production**: I achieved TypeScript strict mode (0 errors), optimized bundles

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
Built by Vignan Kamarthi. License: MIT
```

---

**Last Updated**: November 9, 2025
**Version**: 2.0 (Production-ready)
