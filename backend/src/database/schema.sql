-- Career Trajectory Planning Tool Database Schema
-- SQLite database with hard bounds enforcement

-- Timelines table
CREATE TABLE IF NOT EXISTS timelines (
    id TEXT PRIMARY KEY,
    user_name TEXT NOT NULL,
    start_age REAL NOT NULL CHECK (start_age >= 10 AND start_age <= 18),
    end_age REAL NOT NULL CHECK (end_age >= start_age AND end_age <= 60),
    end_goal TEXT NOT NULL,
    num_layers INTEGER NOT NULL CHECK (num_layers IN (2, 3)),
    global_research_model TEXT DEFAULT 'pro',
    is_deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    -- Ensure end comes after start
    CHECK (end_age > start_age)
);

-- Layers table
CREATE TABLE IF NOT EXISTS layers (
    id TEXT PRIMARY KEY,
    timeline_id TEXT NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
    layer_number INTEGER NOT NULL CHECK (layer_number IN (1, 2, 3)),
    title TEXT NOT NULL,
    start_age REAL NOT NULL,
    end_age REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    CHECK (end_age > start_age)
);

-- Blocks table with hard bounds
CREATE TABLE IF NOT EXISTS blocks (
    id TEXT PRIMARY KEY,
    layer_id TEXT NOT NULL REFERENCES layers(id) ON DELETE CASCADE,
    layer_number INTEGER NOT NULL CHECK (layer_number IN (1, 2, 3)),
    position INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    description TEXT,
    start_age REAL NOT NULL CHECK (start_age >= 10 AND start_age <= 60),
    end_age REAL NOT NULL CHECK (end_age >= 10 AND end_age <= 60),
    duration_years REAL NOT NULL,
    status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
    research_data TEXT, -- JSON from Parallel API
    user_notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    -- HARD BOUNDS ENFORCEMENT
    CHECK (
        (layer_number = 1 AND duration_years >= 4.0 AND duration_years <= 10.0) OR
        (layer_number = 2 AND duration_years >= 0.0 AND duration_years <= 5.0) OR
        (layer_number = 3 AND duration_years >= 0.0 AND duration_years <= 1.0)
    ),

    -- Ensure block end comes after start
    CHECK (end_age > start_age),

    -- Ensure duration matches age range
    CHECK (ABS((end_age - start_age) - duration_years) < 0.01)
);

-- Metadata (documents) table
CREATE TABLE IF NOT EXISTS metadata (
    id TEXT PRIMARY KEY,
    block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Conversations table (LLM chat history)
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    timeline_id TEXT NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Agent Contexts table (stores shared context between agents)
CREATE TABLE IF NOT EXISTS agent_contexts (
    id TEXT PRIMARY KEY,
    timeline_id TEXT REFERENCES timelines(id) ON DELETE CASCADE,
    user_config TEXT NOT NULL, -- JSON: UserConfig
    attention TEXT NOT NULL, -- JSON: Attention (all agent contributions)
    conversation_history TEXT, -- JSON: ConversationMessage[]
    workflow TEXT NOT NULL, -- JSON: Workflow (current stage, attempts, timestamps)
    uploaded_files TEXT, -- JSON: UploadedFile[] (resumes, transcripts, etc.)
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Save history table (state snapshots)
CREATE TABLE IF NOT EXISTS save_history (
    id TEXT PRIMARY KEY,
    timeline_id TEXT NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
    state_snapshot TEXT NOT NULL, -- JSON of entire timeline state
    save_type TEXT NOT NULL CHECK (save_type IN ('save_only', 'lite', 'refactor')),
    research_cost REAL DEFAULT 0.0,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Research tasks table (async research tracking)
CREATE TABLE IF NOT EXISTS research_tasks (
    id TEXT PRIMARY KEY, -- task_id from ParallelMCP
    block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    block_title TEXT NOT NULL,
    query TEXT NOT NULL,
    processor TEXT NOT NULL CHECK (processor IN ('lite', 'base', 'pro', 'ultra', 'ultra2x', 'ultra4x', 'ultra8x')),
    research_type TEXT NOT NULL CHECK (research_type IN ('university', 'career', 'skills', 'timeline', 'quick')),
    estimated_time INTEGER NOT NULL, -- in seconds
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'complete', 'error')),
    results TEXT, -- JSON results from research agent
    error TEXT, -- Error message if failed
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_layers_timeline ON layers(timeline_id);
CREATE INDEX IF NOT EXISTS idx_blocks_layer ON blocks(layer_id);
CREATE INDEX IF NOT EXISTS idx_metadata_block ON metadata(block_id);
CREATE INDEX IF NOT EXISTS idx_conversations_timeline ON conversations(timeline_id);
CREATE INDEX IF NOT EXISTS idx_agent_contexts_timeline ON agent_contexts(timeline_id);
CREATE INDEX IF NOT EXISTS idx_save_history_timeline ON save_history(timeline_id);
CREATE INDEX IF NOT EXISTS idx_save_history_timestamp ON save_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_research_tasks_block ON research_tasks(block_id);
CREATE INDEX IF NOT EXISTS idx_research_tasks_status ON research_tasks(status);
CREATE INDEX IF NOT EXISTS idx_research_tasks_created ON research_tasks(created_at);
