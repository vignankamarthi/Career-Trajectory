-- Migration: Add research_tasks table for async research tracking
-- Date: 2025-10-31
-- Description: Track background research tasks spawned by ParallelMCPService

-- Research tasks table
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
CREATE INDEX IF NOT EXISTS idx_research_tasks_block ON research_tasks(block_id);
CREATE INDEX IF NOT EXISTS idx_research_tasks_status ON research_tasks(status);
CREATE INDEX IF NOT EXISTS idx_research_tasks_created ON research_tasks(created_at);
