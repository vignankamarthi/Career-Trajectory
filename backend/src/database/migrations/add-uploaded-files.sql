-- Migration: Add uploaded_files column to agent_contexts table
-- Date: 2025-01-27

-- Add uploaded_files column (stores JSON array of UploadedFile objects)
ALTER TABLE agent_contexts ADD COLUMN uploaded_files TEXT;
