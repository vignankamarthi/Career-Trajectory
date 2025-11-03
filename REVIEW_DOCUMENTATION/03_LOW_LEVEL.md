# Career Trajectory AI - Low-Level Technical Implementation

## Deep Dive: Algorithms, Data Structures, Edge Cases, and Production Patterns

This document covers implementation-level details for engineers debugging issues, optimizing performance, or extending the system.

---

## Table of Contents
1. [Agent Confidence Calculation Algorithm](#agent-confidence-calculation)
2. [WebSocket Protocol & Message Format](#websocket-protocol)
3. [Database Transaction Patterns](#database-transactions)
4. [Task Queue & Memory Management](#task-queue-memory)
5. [LangChain/LangSmith Integration](#langchain-integration)
6. [Parallel AI API Integration](#parallel-ai-integration)
7. [Error Recovery Strategies](#error-recovery)
8. [TypeScript Type System Architecture](#typescript-types)
9. [Performance Optimization Patterns](#performance-optimization)
10. [Edge Cases & Error Handling](#edge-cases)

---

## 1. Agent Confidence Calculation Algorithm {#agent-confidence-calculation}

### Pre-Validation Agent Scoring

**File**: `backend/src/agents/pre-validation.ts`

**Algorithm**:
```typescript
confidence_score = BASE_CONFIDENCE - FIELD_PENALTIES - QUALITY_PENALTIES

where:
  BASE_CONFIDENCE = 1.0 (100%)
  FIELD_PENALTY = 0.05 per missing required field
  QUALITY_PENALTY = 0.10 for vague end_goal (< 10 chars)
```

**Implementation Details**:
```typescript
let confidence = 1.0;
const missingFields: string[] = [];

// Required field validation
if (!userConfig.user_name || userConfig.user_name.trim().length === 0) {
  confidence -= 0.05;
  missingFields.push('user_name');
}

if (!userConfig.end_goal || userConfig.end_goal.trim().length < 10) {
  confidence -= 0.10;  // Higher penalty for vague goals
  missingFields.push('end_goal (too vague)');
}

// Age validation (logical consistency)
if (userConfig.start_age >= userConfig.end_age) {
  confidence -= 0.15;  // Severe penalty for logical inconsistency
  missingFields.push('start_age/end_age (invalid range)');
}

return {
  confident: confidence >= 0.95,
  confidence_score: Math.max(0, confidence),  // Floor at 0
  missing_fields: missingFields,
  reasoning: `Confidence: ${(confidence * 100).toFixed(1)}% based on completeness analysis`
};
```

**Edge Cases**:
- Empty strings count as missing (`.trim().length === 0`)
- Negative confidence scores clamped to 0
- Age validation prevents database constraint violations downstream

### Conversational Agent Iteration Logic

**File**: `backend/src/agents/conversational.ts`

**Algorithm**:
```typescript
Round 1: confidence = BASE + (information_density * 0.2)
Round 2: confidence = Round_1 + (new_info_density * 0.15)
Round 3: confidence = Round_2 + (new_info_density * 0.10)
...
Max 5 rounds, then force generation
```

**Information Density Calculation**:
```typescript
function calculateInformationDensity(userMessage: string): number {
  const wordCount = userMessage.split(/\s+/).length;
  const uniqueWords = new Set(userMessage.toLowerCase().split(/\s+/)).size;
  const sentenceCount = userMessage.split(/[.!?]+/).length;

  // Heuristic: More unique words + longer messages = higher density
  const densityScore = (uniqueWords / wordCount) * Math.log(wordCount + 1);

  return Math.min(1.0, densityScore);  // Cap at 1.0
}
```

**Convergence Strategy**:
- Each round has diminishing returns (0.2 → 0.15 → 0.10 → ...)
- After 5 rounds, confidence forced to 0.95 (prevents infinite loops)
- Early termination if confidence >= 0.95

---

## 2. WebSocket Protocol & Message Format {#websocket-protocol}

### Connection Lifecycle

**File**: `backend/src/websocket/research-websocket.ts`

**State Machine**:
```
DISCONNECTED → [client connects] → CONNECTED
CONNECTED → [server broadcast] → MESSAGE_SENT
MESSAGE_SENT → [client ack implicit] → CONNECTED
CONNECTED → [client disconnects] → DISCONNECTED
CONNECTED → [server error] → ERROR → DISCONNECTED
```

**Implementation**:
```typescript
class ResearchWebSocketServer {
  private clients: Set<WebSocket> = new Set();

  constructor(server: http.Server) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      perMessageDeflate: false  // Disabled for lower latency
    });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);
      Logger.info('[WebSocket] Client connected');

      // Send immediate confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'WebSocket connection established'
      }));

      // Heartbeat mechanism (prevent idle timeout)
      const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();  // Built-in ping/pong
        }
      }, 30000);  // Every 30 seconds

      ws.on('close', () => {
        clearInterval(heartbeat);
        this.clients.delete(ws);
        Logger.info('[WebSocket] Client disconnected');
      });

      ws.on('error', (error) => {
        Logger.error('[WebSocket] Error', error);
        clearInterval(heartbeat);
        this.clients.delete(ws);
      });
    });
  }
}
```

**Heartbeat Rationale**:
- Prevents idle connection timeouts (Heroku/Railway close after 55s)
- WebSocket spec includes built-in ping/pong frames
- Client doesn't need to implement pong (browser handles automatically)

### Message Format Specification

**Type Definitions**:
```typescript
type WebSocketMessage =
  | { type: 'connected'; message: string }
  | { type: 'research_started'; taskId: string; blockId: string; blockTitle: string; processor: string; estimatedTime: number }
  | { type: 'research_progress'; taskId: string; progress: number; message?: string }
  | { type: 'research_complete'; taskId: string; blockId: string; results: ResearchResults }
  | { type: 'research_error'; taskId: string; error: string };
```

**Broadcast Implementation**:
```typescript
broadcast(message: WebSocketMessage): void {
  const payload = JSON.stringify(message);
  let successCount = 0;

  this.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
        successCount++;
      } catch (error) {
        Logger.error('[WebSocket] Failed to send', error);
        this.clients.delete(client);  // Remove dead client
      }
    }
  });

  Logger.info('[WebSocket] Broadcasted to clients', {
    type: message.type,
    clientCount: successCount,
    taskId: 'taskId' in message ? message.taskId : undefined
  });
}
```

**Error Handling**:
- Dead clients removed from set during broadcast (lazy cleanup)
- Send failures logged but don't crash server
- Graceful degradation: if WebSocket fails, client falls back to polling

---

## 3. Database Transaction Patterns {#database-transactions}

### Atomic Timeline Creation

**File**: `backend/src/database/db.ts`

**Pattern**: Multi-table insert with foreign key integrity

```typescript
async function createTimeline(timelineData: TimelineData): Promise<string> {
  const db = getDatabase();

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      try {
        // 1. Insert timeline (parent)
        const timelineId = uuidv4();
        db.run(
          `INSERT INTO timelines (id, user_name, start_age, end_age, end_goal, num_layers)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [timelineId, timelineData.user_name, timelineData.start_age,
           timelineData.end_age, timelineData.end_goal, timelineData.num_layers],
          (err) => { if (err) throw err; }
        );

        // 2. Insert layers (children of timeline)
        timelineData.layers.forEach((layer) => {
          const layerId = uuidv4();
          db.run(
            `INSERT INTO layers (id, timeline_id, layer_number, name)
             VALUES (?, ?, ?, ?)`,
            [layerId, timelineId, layer.layer_number, layer.name],
            (err) => { if (err) throw err; }
          );

          // 3. Insert blocks (children of layers)
          layer.blocks.forEach((block) => {
            db.run(
              `INSERT INTO blocks (id, layer_id, layer_number, title, description,
                                   start_age, end_age, duration_years, parent_block_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [uuidv4(), layerId, layer.layer_number, block.title, block.description,
               block.start_age, block.end_age, block.duration_years, block.parent_block_id],
              (err) => { if (err) throw err; }
            );
          });
        });

        db.run('COMMIT', (err) => {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
          } else {
            resolve(timelineId);
          }
        });

      } catch (error) {
        db.run('ROLLBACK');
        reject(error);
      }
    });
  });
}
```

**Key Points**:
- `serialize()` ensures sequential execution (SQLite is single-threaded)
- `BEGIN TRANSACTION` + `COMMIT`/`ROLLBACK` provides atomicity
- Foreign key constraints enforced by SQLite schema
- Any failure triggers full rollback (timeline + layers + blocks)

### Soft Delete Pattern

**Implementation**:
```typescript
async function softDeleteTimeline(timelineId: string): Promise<void> {
  const db = getDatabase();

  // Don't actually delete - just set deleted_at timestamp
  await db.run(
    `UPDATE timelines SET deleted_at = datetime('now') WHERE id = ?`,
    [timelineId]
  );

  // Cascade handled by application logic (not database)
  // Allows "undo delete" feature in future
}

async function permanentlyDeleteTimeline(timelineId: string): Promise<void> {
  const db = getDatabase();

  // ON DELETE CASCADE handles layers/blocks/messages automatically
  await db.run(`DELETE FROM timelines WHERE id = ?`, [timelineId]);
}
```

**Rationale**:
- Soft delete enables "trash" feature for user recovery
- Hard delete uses database cascading (fewer queries)
- `deleted_at IS NULL` filters in all queries

---

## 4. Task Queue & Memory Management {#task-queue-memory}

### In-Memory Task Queue Design

**File**: `backend/src/services/parallel-mcp.ts`

**Data Structure**:
```typescript
interface ResearchTask {
  id: string;
  blockId: string;
  blockTitle: string;
  query: string;
  processor: ResearchProcessor;
  researchType: ResearchType;
  status: 'pending' | 'running' | 'complete' | 'error';
  results?: ResearchResults;
  error?: string;
  createdAt: number;  // Unix timestamp
  completedAt?: number;
}

class ParallelMCPService {
  private tasks: Map<string, ResearchTask> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup old tasks every 15 minutes
    this.cleanupInterval = setInterval(() => {
      this.clearOldTasks();
    }, 15 * 60 * 1000);
  }
}
```

**Memory Management**:
```typescript
private clearOldTasks(): void {
  const now = Date.now();
  const TTL = 15 * 60 * 1000;  // 15 minutes

  let deletedCount = 0;

  this.tasks.forEach((task, taskId) => {
    // Delete completed/error tasks older than TTL
    if ((task.status === 'complete' || task.status === 'error') &&
        (now - task.createdAt) > TTL) {
      this.tasks.delete(taskId);
      deletedCount++;
    }
  });

  if (deletedCount > 0) {
    Logger.info('[ParallelMCP] Cleaned up old tasks', { deletedCount });
  }
}
```

**Why In-Memory?**:
- **Fast**: O(1) lookup, no database I/O
- **Simple**: No external dependencies (Redis) for MVP
- **Stateless-compatible**: Multiple instances don't share state (acceptable for research tasks)

**Migration Path to Redis/BullMQ**:
```typescript
// Future production implementation:
import Queue from 'bull';

const researchQueue = new Queue('research-tasks', {
  redis: { host: 'localhost', port: 6379 }
});

researchQueue.process(async (job) => {
  const { taskId, query, processor } = job.data;
  const results = await executeResearch(query, processor);

  // WebSocket broadcast handled by queue event
  researchQueue.emit('completed', { taskId, results });

  return results;
});
```

---

## 5. LangChain/LangSmith Integration {#langchain-integration}

### Tracing Architecture

**File**: `backend/src/utils/langsmith-tracer.ts`

**Environment Configuration**:
```bash
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=lsv2_pt_...
LANGCHAIN_PROJECT=career-trajectory
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
```

**Tracer Implementation**:
```typescript
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

// LangSmith automatically traces when env vars set
const model = new ChatAnthropic({
  model: 'claude-sonnet-4-5-20250929',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  temperature: 0.1,  // Low temp for consistent agent behavior
  maxTokens: 4096
});

async function invokeAgent(systemPrompt: string, userPrompt: string, metadata: Record<string, any>) {
  // Metadata appears in LangSmith trace
  const response = await model.invoke(
    [
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ],
    {
      tags: [metadata.agentName, metadata.timelineId],
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    }
  );

  return response.content;
}
```

**Trace Data Captured**:
- Input prompts (system + user)
- Output responses (full LLM completion)
- Token usage (input + output counts)
- Latency (ms)
- Metadata (agent name, timeline ID, confidence scores)

**Viewing Traces**:
```
https://smith.langchain.com/projects/career-trajectory
Filter by tags: pre-validation, conversational, internal-review, configuration
```

---

## 6. Parallel AI API Integration {#parallel-ai-integration}

### API Client Implementation

**File**: `backend/src/services/parallel-research.ts`

**Authentication**:
```typescript
const PARALLEL_API_KEY = process.env.PARALLEL_API_KEY;
const PARALLEL_API_URL = 'https://api.parallel.ai/v1/research';

const headers = {
  'Authorization': `Bearer ${PARALLEL_API_KEY}`,
  'Content-Type': 'application/json'
};
```

**Request Format**:
```typescript
interface ParallelResearchRequest {
  query: string;
  processor: 'lite' | 'base' | 'pro' | 'ultra' | 'ultra2x' | 'ultra4x' | 'ultra8x';
  format?: 'concise' | 'detailed' | 'comprehensive';
  max_results?: number;
  timeout?: number;  // seconds
}

async function executeResearch(params: ParallelResearchRequest): Promise<ResearchResults> {
  try {
    const response = await axios.post(
      PARALLEL_API_URL,
      {
        query: params.query,
        processor: params.processor,
        format: params.format || 'detailed',
        max_results: params.max_results || 10,
        timeout: params.timeout || 120
      },
      {
        headers,
        timeout: (params.timeout || 120) * 1000  // Convert to ms
      }
    );

    return response.data;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error('Invalid Parallel API key');
      } else if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded - retry in 60s');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Research timeout - try lower tier');
      }
    }
    throw error;
  }
}
```

**Cost Tracking**:
```typescript
const PROCESSOR_COSTS = {
  lite: 0.005,
  base: 0.02,
  pro: 0.10,
  ultra: 0.30,
  ultra2x: 0.60,
  ultra4x: 1.20,
  ultra8x: 2.40
};

let totalCost = 0;

function trackResearchCost(processor: ResearchProcessor): void {
  const cost = PROCESSOR_COSTS[processor];
  totalCost += cost;

  Logger.info('[Cost] Research query', { processor, cost, totalCost });

  if (totalCost > 20.0) {
    Logger.warn('[Cost] Daily budget exceeded', { totalCost });
  }
}
```

---

## 7. Error Recovery Strategies {#error-recovery}

### UserError Class Design

**File**: `backend/src/utils/UserError.ts`

**Class Structure**:
```typescript
export class UserError extends Error {
  public readonly type = 'user_error';
  public readonly severity: 'info' | 'warning' | 'error' | 'critical';
  public readonly userMessage: string;
  public readonly suggestions: string[];
  public readonly field?: string;
  public readonly code?: string;

  constructor(
    userMessage: string,
    severity: 'info' | 'warning' | 'error' | 'critical' = 'error',
    suggestions: string[] = [],
    field?: string,
    code?: string
  ) {
    super(userMessage);
    this.name = 'UserError';
    this.userMessage = userMessage;
    this.severity = severity;
    this.suggestions = suggestions;
    this.field = field;
    this.code = code;

    // Maintain proper stack trace in V8
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      type: this.type,
      severity: this.severity,
      userMessage: this.userMessage,
      suggestions: this.suggestions,
      field: this.field,
      code: this.code
    };
  }
}
```

**Express Error Middleware**:
```typescript
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof UserError) {
    // User-facing error - send clean response
    res.status(error.severity === 'critical' ? 500 : 400).json(error.toJSON());
  } else {
    // Internal error - log stack trace, hide from user
    Logger.error('Unhandled error', error);
    res.status(500).json({
      type: 'internal_error',
      severity: 'critical',
      userMessage: 'An unexpected error occurred. Please try again.',
      suggestions: ['Refresh the page', 'Contact support if this persists'],
      code: 'INTERNAL_ERROR'
    });
  }
});
```

**Usage Pattern**:
```typescript
// In agent code:
if (confidence < 0.95) {
  throw new UserError(
    'We need more information to create your timeline',
    'info',
    [
      'Please answer the clarification questions',
      'Provide more detail about your career goals'
    ],
    'user_input',
    'INSUFFICIENT_CONFIDENCE'
  );
}
```

### Retry Logic for External APIs

**Exponential Backoff**:
```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on client errors (4xx)
      if (axios.isAxiosError(error) && error.response?.status < 500) {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);  // 1s, 2s, 4s
        Logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

// Usage:
const results = await retryWithBackoff(() =>
  executeResearch({ query, processor: 'pro' })
);
```

---

## 8. TypeScript Type System Architecture {#typescript-types}

### Discriminated Unions for Agent Responses

```typescript
// Agent response types use discriminated unions for type safety
type AgentResponse =
  | { confident: true; confidence_score: number; ready: true }
  | { confident: false; confidence_score: number; question: string; ready: false };

function handleAgentResponse(response: AgentResponse) {
  if (response.confident) {
    // TypeScript knows 'ready' must be true here
    proceedToNextAgent();
  } else {
    // TypeScript knows 'question' exists here
    sendQuestionToUser(response.question);
  }
}
```

### Zod Schema Validation

**File**: `backend/src/utils/validation.ts`

```typescript
import { z } from 'zod';

export const UserConfigSchema = z.object({
  user_name: z.string().min(1, 'Name is required').max(100),
  start_age: z.number().int().min(18).max(60),
  end_age: z.number().int().min(18).max(60),
  end_goal: z.string().min(10, 'Goal must be at least 10 characters'),
  num_layers: z.union([z.literal(2), z.literal(3)])
}).refine(
  data => data.end_age > data.start_age,
  { message: 'End age must be greater than start age' }
);

export type UserConfig = z.infer<typeof UserConfigSchema>;

// Usage in API routes:
app.post('/api/configure', (req, res) => {
  try {
    const validated = UserConfigSchema.parse(req.body);
    // validated is type-safe UserConfig
    processUserConfig(validated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        issues: error.errors
      });
    }
  }
});
```

---

## 9. Performance Optimization Patterns {#performance-optimization}

### Database Index Strategy

**File**: `backend/src/database/schema.sql`

```sql
-- Indexes for common query patterns

-- Timeline lookup by ID (most common)
CREATE INDEX idx_timelines_id ON timelines(id) WHERE deleted_at IS NULL;

-- Blocks by layer (for timeline display)
CREATE INDEX idx_blocks_layer_id ON blocks(layer_id);

-- Research tasks by block (for status checks)
CREATE INDEX idx_research_tasks_block_id ON research_tasks(block_id);

-- Research tasks by status (for queue processing)
CREATE INDEX idx_research_tasks_status ON research_tasks(status) WHERE status IN ('pending', 'running');

-- Messages by timeline (for chat history)
CREATE INDEX idx_messages_timeline_id ON messages(timeline_id, created_at DESC);
```

**Query Optimization**:
```typescript
// BAD: N+1 query problem
const timeline = await db.get('SELECT * FROM timelines WHERE id = ?', [id]);
const layers = await Promise.all(
  timeline.layers.map(layerId =>
    db.get('SELECT * FROM layers WHERE id = ?', [layerId])
  )
);

// GOOD: Single JOIN query
const timeline = await db.all(`
  SELECT
    t.*,
    l.id as layer_id, l.layer_number, l.name as layer_name,
    b.id as block_id, b.title, b.description, b.start_age, b.end_age
  FROM timelines t
  LEFT JOIN layers l ON t.id = l.timeline_id
  LEFT JOIN blocks b ON l.id = b.layer_id
  WHERE t.id = ? AND t.deleted_at IS NULL
  ORDER BY l.layer_number, b.start_age
`, [id]);

// Transform flat rows into nested structure
const structured = transformToNestedTimeline(timeline);
```

### Frontend Bundle Optimization

**File**: `frontend/vite.config.ts`

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor bundle (cached across deploys)
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // Heavy dependencies split out
          charts: ['recharts'],  // If using charts in future
        }
      }
    },
    chunkSizeWarningLimit: 1000  // KB
  }
});
```

---

## 10. Edge Cases & Error Handling {#edge-cases}

### Timeline Age Boundary Cases

**Scenario**: User sets start_age=60, end_age=60 (0-year timeline)

**Handling**:
```typescript
// Database constraint prevents this
CHECK (end_age > start_age)

// Application validation provides helpful error
if (userConfig.end_age <= userConfig.start_age) {
  throw new UserError(
    'Your timeline must span at least 1 year',
    'error',
    ['Increase your end age', 'Set a more distant career goal'],
    'end_age'
  );
}
```

### WebSocket Connection Loss During Research

**Scenario**: User loses internet mid-research, reconnects 5 minutes later

**Handling**:
```typescript
// Frontend auto-reconnect logic
const reconnect = () => {
  const ws = new WebSocket('ws://localhost:3001/ws');

  ws.onopen = () => {
    setIsConnected(true);

    // Fetch missed updates from REST API
    researchingBlocks.forEach(async (blockId) => {
      const status = await apiClient.research.getStatus(blockId);
      if (status.complete) {
        setCompletedBlocks(prev => new Set(prev).add(blockId));
        setResearchingBlocks(prev => {
          const next = new Set(prev);
          next.delete(blockId);
          return next;
        });
      }
    });
  };

  ws.onclose = () => {
    setIsConnected(false);
    // Retry after 3 seconds
    setTimeout(reconnect, 3000);
  };
};
```

### Parallel Research Task Collisions

**Scenario**: User triggers research on same block twice (race condition)

**Handling**:
```typescript
async createResearchTask(params: ResearchParams): Promise<TaskResponse> {
  // Check for existing task on same block
  const existingTask = Array.from(this.tasks.values()).find(
    task => task.blockId === params.blockId &&
            (task.status === 'pending' || task.status === 'running')
  );

  if (existingTask) {
    Logger.info('[ParallelMCP] Task already running', { blockId: params.blockId });
    return {
      taskId: existingTask.id,
      estimatedTime: this.calculateRemainingTime(existingTask)
    };
  }

  // Create new task...
}
```

---

## Conclusion

This document covers the critical low-level implementation details for debugging, optimizing, and extending the Career Trajectory AI system. For architectural context, see `01_HIGH_LEVEL.md`. For API contracts and development workflows, see `02_MEDIUM_LEVEL.md`.

**Key Takeaways**:
- Confidence calculation uses heuristic scoring with diminishing returns
- WebSocket protocol includes heartbeat mechanism for connection stability
- Database transactions use SQLite serialization for atomicity
- Task queue uses in-memory Map with TTL-based cleanup (migrate to Redis for production scale)
- Error handling separates user-facing (UserError) from internal errors
- TypeScript discriminated unions provide compile-time safety
- Performance optimizations focus on database indexes and bundle splitting
- Edge cases handled with validation, auto-reconnect, and deduplication logic
