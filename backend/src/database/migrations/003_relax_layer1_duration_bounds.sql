-- Migration: Relax Layer 1 duration bounds for long timelines
-- Date: 2025-11-08
-- Description: Update Layer 1 maximum duration from 10.0 to 20.0 years to accommodate long timelines

-- SQLite doesn't support ALTER TABLE to modify CHECK constraints
-- So we need to recreate the blocks table with the new constraint

BEGIN TRANSACTION;

-- Create new blocks table with relaxed constraints
CREATE TABLE blocks_new (
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

    -- UPDATED HARD BOUNDS ENFORCEMENT - Layer 1 max increased from 10.0 to 20.0
    CHECK (
        (layer_number = 1 AND duration_years >= 4.0 AND duration_years <= 20.0) OR
        (layer_number = 2 AND duration_years >= 0.0 AND duration_years <= 5.0) OR
        (layer_number = 3 AND duration_years >= 0.0 AND duration_years <= 1.0)
    ),

    -- Ensure block end comes after start
    CHECK (end_age > start_age),

    -- Ensure duration matches age range
    CHECK (ABS((end_age - start_age) - duration_years) < 0.01)
);

-- Copy data from old table to new table
INSERT INTO blocks_new SELECT * FROM blocks;

-- Drop old table and rename new table
DROP TABLE blocks;
ALTER TABLE blocks_new RENAME TO blocks;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_blocks_layer ON blocks(layer_id);

COMMIT;