# Complete File Locations Reference

## Frontend Source Files

### Core Components
- `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/App.tsx`
- `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/main.tsx`
- `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/index.css`

### Navigation & Theme
- `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/components/Navigation.tsx` (MISSING: Pricing button & examples)
- `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/components/ThemeToggle.tsx`
- `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/contexts/ThemeContext.tsx` (HAS: localStorage persistence)

### Views/Pages
- `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/views/ConversationalConfigView.tsx` (MISSING: pricing context, model selection)
- `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/views/ConfigurationView.tsx` (HAS: research model selection)
- `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/views/TimelineView.tsx`

### UI Components
- `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/components/GenerateConfirmationModal.tsx` (REFERENCES: missing pricing tab)
- `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/components/ErrorModal.tsx`
- `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/components/BlockEditor.tsx`
- `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/components/LayerView.tsx`
- `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/components/TimelineBlock.tsx`

### API & Services
- `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/src/lib/api.ts`

## Backend Source Files

### Main Server
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/src/server.ts`

### Database
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/src/database/db.ts` (HAS: "Test User" test data)
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/src/database/schema.sql`

### Services
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/src/services/parallel.ts` (HAS: Parallel API integration, lite/pro support)
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/src/services/anthropic.ts`

### Agents
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/src/agents/configuration-agent.ts`
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/src/agents/conversational-assistant.ts`
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/src/agents/conversational-clarification-agent.ts`
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/src/agents/internal-agent.ts`
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/src/agents/pre-validation-agent.ts`
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/src/agents/validation-agent.ts`
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/src/agents/research-sub-agents.ts`

### API Routes
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/src/routes/configure-with-context.ts`
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/src/routes/timelines.ts`
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/src/routes/blocks.ts`
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/src/routes/chat.ts`
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/src/routes/save.ts`
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/src/routes/analyze.ts`

### Utilities
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/src/utils/logger.ts`
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/src/utils/validation.ts`
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/src/utils/user-errors.ts`
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/src/utils/langsmith-tracer.ts`

### Types
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/src/types/agent-context.ts`

### Testing
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/test-e2e-comprehensive.ts` (HAS: "Test User" example data)

## Configuration Files
- `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/vite.config.ts`
- `/Users/vkamarthi24/Desktop/Career-Trajectory/package.json` (root)
- `/Users/vkamarthi24/Desktop/Career-Trajectory/frontend/package.json`
- `/Users/vkamarthi24/Desktop/Career-Trajectory/backend/package.json`

## Logs & Data
- `/Users/vkamarthi24/Desktop/Career-Trajectory/logs/system.log` (HAS: "Test User" database test records)
- `/Users/vkamarthi24/Desktop/Career-Trajectory/logs/llm_calls.log`
- `/Users/vkamarthi24/Desktop/Career-Trajectory/logs/errors.log`
- `/Users/vkamarthi24/Desktop/Career-Trajectory/data/timelines.db` (SQLite database)

## Documentation
- `/Users/vkamarthi24/Desktop/Career-Trajectory/CLAUDE.md` (Project instructions, mentions PARALLEL_API_KEY)
- `/Users/vkamarthi24/Desktop/Career-Trajectory/README.md`
