# Low-Level Implementation Details

**Career Trajectory AI - Technical Implementation Guide**
**Date**: 2025-11-09
**Status**: Production Ready
**Version**: 2.1

---

## Table of Contents

1. [Critical Implementation Patterns](#critical-implementation-patterns)
2. [Agent Implementation Details](#agent-implementation-details)
3. [Database Implementation](#database-implementation)
4. [API Implementation Patterns](#api-implementation-patterns)
5. [Frontend State Management](#frontend-state-management)
6. [Error Handling Strategies](#error-handling-strategies)
7. [Performance Optimizations](#performance-optimizations)
8. [Security Implementation](#security-implementation)

---

## Critical Implementation Patterns

### 1. LangSmith Traceable Wrapper

**Problem**: Need to trace all AI operations for observability without boilerplate.

**Solution**: `traceable()` decorator from LangSmith

**Implementation**:
```typescript
// backend/src/agents/pre-validation-agent.ts
import { traceable } from 'langsmith/traceable';

export const preValidationAgent = traceable(
  async function analyzeInput(context: AgentContext): Promise<ValidationResult> {
    // Agent logic here
    return result;
  },
  {
    name: 'PreValidationAgent',
    metadata: {
      agent: 'pre-validation',
      version: '2.1'
    }
  }
);
```

**Key Points**:
- Function name MUST be explicit (not arrow function)
- Metadata tracked in LangSmith dashboard
- Automatic input/output logging
- Duration and token tracking

---

### 2. Anthropic Tool Calling Pattern

**Problem**: Need structured JSON outputs from Claude, not freeform text.

**Solution**: Tool calling with strict schemas

**Implementation**:
```typescript
// backend/src/services/anthropic.ts
const tools = [{
  name: 'provide_validation_result',
  description: 'Report validation analysis results',
  input_schema: {
    type: 'object',
    properties: {
      confidence_score: {
        type: 'number',
        description: '0-100 confidence score'
      },
      missing_information_categories: {
        type: 'array',
        items: { type: 'string' }
      },
      critical_constraints: {
        type: 'array',
        items: { type: 'string' }
      }
    },
    required: ['confidence_score', 'missing_information_categories']
  }
}];

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 4096,
  tools,
  messages: [{ role: 'user', content: prompt }]
});

// Extract tool call
const toolUse = response.content.find(c => c.type === 'tool_use');
const result = toolUse.input;  // Guaranteed to match schema
```

**Why This Works**:
- Claude forced to return valid JSON matching schema
- No parsing errors
- Type-safe access to fields
- Validation happens at AI layer

---

### 3. Async Research Fire-and-Forget

**Problem**: Research takes 30s-20min, can't block HTTP response.

**Solution**: Return task_id immediately, execute in background

**Implementation**:
```typescript
// backend/src/services/parallel-mcp.ts
async createResearchTask(params): Promise<{ taskId: string; estimatedTime: number }> {
  const taskId = uuidv4();
  const task: ResearchTask = {
    taskId,
    blockId: params.blockId,
    query: params.query,
    processor: params.processor,
    status: 'pending',
    createdAt: new Date()
  };

  this.tasks.set(taskId, task);  // In-memory storage

  // Fire-and-forget (NO await)
  this.executeResearch(taskId, params.researchType, params.query, params.processor);

  return { taskId, estimatedTime: PROCESSOR_TIMEOUTS[params.processor] };
}

private async executeResearch(taskId, researchType, query, processor): Promise<void> {
  const task = this.tasks.get(taskId);
  task.status = 'running';

  try {
    const results = await /* call Parallel AI */;
    task.status = 'complete';
    task.results = results;

    // Broadcast via WebSocket
    wsServer.notifyResearchComplete(taskId, results);
  } catch (error) {
    task.status = 'error';
    task.error = error.message;
    wsServer.notifyResearchError(taskId, error.message);
  }
}
```

**Critical Details**:
- NO `await` on executeResearch() call
- Task state stored in Map (in-memory)
- WebSocket broadcasts keep UI in sync
- Errors caught and stored, never thrown to caller

---

### 4. WebSocket Broadcast Pattern

**Problem**: Multiple clients need real-time updates for same research task.

**Solution**: Singleton WebSocket server broadcasting to all connected clients

**Implementation**:
```typescript
// backend/src/websocket/research-websocket.ts
export class ResearchWebSocketServer {
  private clients: Set<WebSocket> = new Set();

  notifyResearchStarted(params) {
    const update: ResearchUpdate = {
      type: 'research_started',
      ...params,
      timestamp: new Date().toISOString()
    };
    this.broadcast(update);
  }

  private broadcast(data: ResearchUpdate): void {
    const message = JSON.stringify(data);

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          Logger.error('[WebSocket] Send failed', error);
        }
      }
    });
  }
}
```

**Key Points**:
- Set<WebSocket> tracks all connected clients
- Broadcast sends to ALL clients (not just one)
- Check `readyState === OPEN` before sending
- Non-fatal errors (log and continue)

---

## Agent Implementation Details

### Configuration Agent Timeline Generation

**File**: `backend/src/agents/configuration-agent.ts`

**Critical Implementation**:
```typescript
// Line 45-120: Timeline generation logic
const generateTimeline = async (context: AgentContext) => {
  const { start_age, end_age, end_goal, num_layers } = context.user_config;
  const totalYears = end_age - start_age;

  // Layer 1: Strategic phases (4-20 year blocks)
  const layer1Count = Math.ceil(totalYears / 6);  // ~6 years each
  const layer1Blocks = [];

  let currentAge = start_age;
  for (let i = 0; i < layer1Count; i++) {
    const duration = Math.min(
      20,  // Max duration
      Math.max(4, (end_age - currentAge) / (layer1Count - i))  // Min 4 years
    );

    layer1Blocks.push({
      title: `Phase ${i + 1}: ${/* AI generates title */}`,
      start_age: currentAge,
      end_age: currentAge + duration,
      duration_years: duration
    });

    currentAge += duration;
  }

  // Layer 2: Tactical milestones (0-5 year blocks)
  // Layer 3: Execution steps (0-1 year blocks)
  // ... similar logic
};
```

**Hard Bounds Validation**:
```typescript
// Validate BEFORE inserting to database
function validateBlock(block, layerNumber) {
  const { start_age, end_age, duration_years } = block;

  // Age bounds
  if (start_age < 10 || start_age > 60) throw new Error('Invalid start_age');
  if (end_age < 10 || end_age > 60) throw new Error('Invalid end_age');
  if (end_age <= start_age) throw new Error('end_age must be > start_age');

  // Duration bounds by layer
  if (layerNumber === 1 && (duration_years < 4 || duration_years > 20)) {
    throw new Error('Layer 1 blocks must be 4-20 years');
  }
  if (layerNumber === 2 && (duration_years < 0 || duration_years > 5)) {
    throw new Error('Layer 2 blocks must be 0-5 years');
  }
  if (layerNumber === 3 && (duration_years < 0 || duration_years > 1)) {
    throw new Error('Layer 3 blocks must be 0-1 years');
  }

  // Duration matches age range
  const calculatedDuration = end_age - start_age;
  if (Math.abs(calculatedDuration - duration_years) > 0.01) {
    throw new Error('Duration must match age range');
  }
}
```

---

### Conversational Agent State Machine

**File**: `backend/src/agents/conversational-clarification-agent.ts`

**State Transitions**:
```typescript
// Input: user_message, context with previous attention
// Output: next_question OR ready signal

const determineNextState = (context: AgentContext) => {
  const validationAttention = context.attention.validation_agent;

  if (!validationAttention) {
    return 'ERROR: No validation ran first';
  }

  if (validationAttention.confidence_score >= 95) {
    return 'READY';  // Skip conversation, go to generation
  }

  // Conversation needed
  const missingCategories = validationAttention.missing_information_categories;

  if (missingCategories.length === 0) {
    return 'READY';  // All info gathered
  }

  // Generate next focused question
  const nextCategory = missingCategories[0];  // One at a time
  return {
    state: 'CONTINUE',
    question: generateQuestion(nextCategory, context)
  };
};
```

**Question Generation Strategy**:
```typescript
function generateQuestion(category: string, context: AgentContext): string {
  // Use Claude to generate focused question based on:
  // 1. Missing category
  // 2. User's previous answers (conversation_history)
  // 3. End goal context

  const prompt = `
    User's goal: ${context.user_config.end_goal}
    Missing information: ${category}
    Previous conversation: ${context.conversation_history}

    Generate ONE focused question to gather information about ${category}.
    Make it specific and actionable.
  `;

  // Claude generates question via tool calling
  return question;
}
```

---

## Database Implementation

### SQLite Connection Management

**File**: `backend/src/database/db.ts`

**Critical Pattern**: Synchronous better-sqlite3 (not async)

```typescript
import Database from 'better-sqlite3';

// Initialize database connection
const dbPath = path.join(process.cwd(), '../data/timelines.db');
const db = new Database(dbPath);

// Enable foreign keys (NOT enabled by default in SQLite!)
db.pragma('foreign_keys = ON');

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Wrapper functions
export function execute(sql: string, params: any[] = []): void {
  try {
    const stmt = db.prepare(sql);
    stmt.run(...params);
  } catch (error) {
    Logger.error('Database execute failed', error, { sql, params });
    throw error;
  }
}

export function query(sql: string, params: any[] = []): any[] {
  try {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  } catch (error) {
    Logger.error('Database query failed', error, { sql, params });
    throw error;
  }
}
```

**Why Synchronous?**:
- Simpler error handling (no promise rejections)
- Better performance for single-process app
- Clearer transaction semantics
- Easier to reason about execution order

---

### Transaction Pattern

**Implementation**:
```typescript
// backend/src/routes/configure-with-context.ts
// Line 580-620: Timeline insertion with transaction

export function insertTimelineWithTransaction(timelineData) {
  const transaction = db.transaction(() => {
    // 1. Insert timeline
    const timelineId = uuidv4();
    execute(
      'INSERT INTO timelines (id, user_name, start_age, end_age, end_goal, num_layers) VALUES (?, ?, ?, ?, ?, ?)',
      [timelineId, userData.name, userData.startAge, userData.endAge, userData.goal, 3]
    );

    // 2. Insert layers
    for (const layer of timelineData.layers) {
      const layerId = uuidv4();
      execute(
        'INSERT INTO layers (id, timeline_id, layer_number, title, start_age, end_age) VALUES (?, ?, ?, ?, ?, ?)',
        [layerId, timelineId, layer.number, layer.title, layer.start, layer.end]
      );

      // 3. Insert blocks
      for (const block of layer.blocks) {
        const blockId = uuidv4();
        execute(
          'INSERT INTO blocks (id, layer_id, layer_number, title, start_age, end_age, duration_years) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [blockId, layerId, layer.number, block.title, block.start, block.end, block.duration]
        );
      }
    }

    return timelineId;
  });

  try {
    return transaction();  // Execute transaction
  } catch (error) {
    // Automatic rollback on error
    Logger.error('Timeline insertion failed', error);
    throw error;
  }
}
```

**Key Points**:
- `db.transaction()` ensures atomicity
- Automatic rollback on error
- Nested inserts execute in order
- Returns value from transaction function

---

## API Implementation Patterns

### Request Validation Pattern

**File**: `backend/src/utils/validation.ts`

**Zod Schema Validation**:
```typescript
import { z } from 'zod';

const UserConfigSchema = z.object({
  user_name: z.string().min(1, 'Name required'),
  start_age: z.number().min(10).max(60),
  end_age: z.number().min(10).max(60),
  end_goal: z.string().min(10, 'Goal must be specific'),
  num_layers: z.literal(2).or(z.literal(3))
}).refine(data => data.end_age > data.start_age, {
  message: 'end_age must be greater than start_age'
});

// Usage in route handler
router.post('/init', async (req, res) => {
  try {
    const validated = UserConfigSchema.parse(req.body);
    // Use validated data (type-safe)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    throw error;
  }
});
```

**Why Zod?**:
- Runtime validation (catches bad inputs)
- TypeScript type inference (no manual types)
- Clear error messages for users
- Composable schemas

---

### Error Response Pattern

**Standard Error Format**:
```typescript
// backend/src/utils/user-errors.ts

export class UserFacingError extends Error {
  constructor(
    public statusCode: number,
    public userMessage: string,
    public details?: any
  ) {
    super(userMessage);
  }
}

// Usage
throw new UserFacingError(
  400,
  'Timeline generation failed: age range must be at least 4 years',
  { providedRange: end_age - start_age }
);

// Error middleware catches and formats
app.use((err, req, res, next) => {
  if (err instanceof UserFacingError) {
    return res.status(err.statusCode).json({
      error: err.userMessage,
      details: err.details
    });
  }

  // Unknown error - hide details in production
  Logger.error('Unhandled error', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});
```

---

## Frontend State Management

### localStorage Persistence Pattern

**File**: `frontend/src/views/ConversationalConfigView.tsx`

**Implementation**:
```typescript
const STORAGE_KEY = 'career-trajectory-conversation';

// Load on mount
useEffect(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const state = JSON.parse(saved);
      setContextId(state.contextId);
      setMessages(state.messages);
      setConfidence(state.confidence);
      setIsReadyToGenerate(state.isReadyToGenerate);
    }
  } catch (error) {
    console.error('Failed to load state:', error);
    // Non-fatal - continue with empty state
  }
}, []);  // Empty deps = run once on mount

// Save on every state change
useEffect(() => {
  const state = {
    contextId,
    messages,
    confidence,
    isReadyToGenerate,
    initialFormData
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}, [contextId, messages, confidence, isReadyToGenerate]);  // Deps = save triggers

// Clear on successful generation
const handleGenerate = async () => {
  const { timeline_id } = await generateTimeline(contextId);
  localStorage.removeItem(STORAGE_KEY);  // Clear stale data
  navigate(`/timeline/${timeline_id}`);
};
```

**Key Points**:
- Try/catch around localStorage (quota errors possible)
- Non-fatal failures (continue with empty state)
- Clear stale data after success
- Separate save triggers (specific deps array)

---

### WebSocket Auto-Reconnect

**File**: `frontend/src/hooks/useWebSocket.ts`

**Implementation**:
```typescript
const useWebSocket = (): UseWebSocketReturn => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    const socket = new WebSocket('ws://localhost:3001/ws');

    socket.onopen = () => {
      setIsConnected(true);
      console.log('[WebSocket] Connected');
    };

    socket.onclose = () => {
      setIsConnected(false);
      console.log('[WebSocket] Disconnected, reconnecting in 3s...');

      // Auto-reconnect after 3 seconds
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 3000);
    };

    socket.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      socket.close();  // Trigger onclose → reconnect
    };

    socket.onmessage = (event) => {
      const update = JSON.parse(event.data);
      handleUpdate(update);
    };

    setWs(socket);
  }, []);

  // Connect on mount
  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws) {
        ws.close();
      }
    };
  }, []);  // Empty deps = run once

  return { isConnected, lastMessage, researchingBlocks, completedBlocks };
};
```

**Critical Details**:
- `useCallback` prevents infinite re-connects
- Timeout cleanup in useEffect return
- Close existing socket before reconnect
- Don't reconnect if unmounted (check timeout ref)

---

## Error Handling Strategies

### Anthropic API Retry Logic

**File**: `backend/src/services/anthropic.ts`

**Implementation**:
```typescript
async function callAnthropicWithRetry(params, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await anthropic.messages.create(params);
      return response;
    } catch (error) {
      if (error.status === 429) {
        // Rate limit - wait and retry
        const delay = Math.pow(2, attempt) * 1000;  // Exponential backoff
        Logger.warn(`Rate limited, retrying in ${delay}ms`, { attempt });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (error.status >= 500) {
        // Server error - retry
        if (attempt < maxRetries) {
          Logger.warn('Anthropic server error, retrying', { attempt });
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      }

      // Client error (4xx) - don't retry
      throw error;
    }
  }

  throw new Error('Max retries exceeded');
}
```

**Retry Strategy**:
- 429 Rate Limit: Exponential backoff (2s, 4s, 8s)
- 5xx Server Error: Fixed 1s delay
- 4xx Client Error: No retry (user's fault)
- Max 3 attempts

---

## Performance Optimizations

### Database Indexing Strategy

**File**: `backend/src/database/schema.sql`

```sql
-- Index on foreign keys (JOIN performance)
CREATE INDEX idx_layers_timeline ON layers(timeline_id);
CREATE INDEX idx_blocks_layer ON blocks(layer_id);

-- Index on query filters
CREATE INDEX idx_blocks_status ON blocks(status);
CREATE INDEX idx_research_tasks_status ON research_tasks(status);

-- Composite index for common queries
CREATE INDEX idx_save_history_timeline_timestamp
  ON save_history(timeline_id, timestamp DESC);
```

**Query Optimization**:
```sql
-- BAD: Full table scan
SELECT * FROM blocks WHERE timeline_id = ?;

-- GOOD: Use index via JOIN
SELECT b.*
FROM blocks b
JOIN layers l ON b.layer_id = l.id
WHERE l.timeline_id = ?;
```

---

### React Query Caching

**File**: `frontend/src/App.tsx`

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // 5 minutes
      cacheTime: 1000 * 60 * 30,  // 30 minutes
      refetchOnWindowFocus: false,  // Don't refetch on tab switch
      retry: 1,  // Only retry once
    },
  },
});
```

**Why This Helps**:
- Stale data reused for 5 minutes (reduces API calls)
- Cache kept for 30 minutes (fast navigation)
- No refetch on focus (prevents spam)

---

## Security Implementation

### Environment Variable Loading

**File**: `backend/src/server.ts`

```typescript
import dotenv from 'dotenv';
import path from 'path';

// Load from project root, not backend directory
dotenv.config({ path: path.join(process.cwd(), '../.env') });

// Validate required variables
const requiredEnvVars = ['ANTHROPIC_API_KEY'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars);
  process.exit(1);
}
```

**Critical Points**:
- Load BEFORE any imports that use process.env
- Validate required vars on startup
- Exit if missing (fail-fast)
- Never commit .env to git (.gitignore)

---

### SQL Injection Prevention

**Pattern**: Always use parameterized queries

```typescript
// BAD: SQL injection vulnerable
const sql = `SELECT * FROM blocks WHERE title = '${userInput}'`;
execute(sql);

// GOOD: Parameterized query
const sql = 'SELECT * FROM blocks WHERE title = ?';
execute(sql, [userInput]);
```

**Why Safe**:
- Parameters escaped by better-sqlite3
- No string concatenation
- Prevents injection attacks

---

**Document Version**: 1.0
**Last Updated**: 2025-11-09
**Status**: Production Ready
**Maintainer**: Engineering Team
