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
