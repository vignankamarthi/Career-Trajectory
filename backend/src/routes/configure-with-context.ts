/**
 * Configuration with Agent Context Routes
 *
 * NEW ARCHITECTURE: Implements the full 4-agent workflow with 95% confidence threshold
 *
 * Flow:
 * 1. POST /api/configure-with-context/init - Initialize context, run Pre-Validation Agent
 * 2. POST /api/configure-with-context/clarify - Conversational clarification loop
 * 3. POST /api/configure-with-context/generate - Generate timeline after all agents pass
 */

import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Logger from '../utils/logger';
import { execute, query, queryOne } from '../database/db';
import { analyzeInitialInput } from '../agents/pre-validation-agent';
import { gatherClarifications } from '../agents/conversational-clarification-agent';
import { reviewBeforeGeneration } from '../agents/internal-agent';
import { generateWithContext } from '../agents/configuration-agent';
import { AgentContext, ConversationMessage } from '../types/agent-context';
import { UserError, ValidationErrors } from '../utils/user-errors';
import { processUploadedFiles } from '../utils/pdf-extractor';

const router = express.Router();

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|txt|png|jpg|jpeg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, TXT, PNG, JPG, JPEG allowed.'));
    }
  },
});

/**
 * Initialize context and run Pre-Validation Agent
 *
 * POST /api/configure-with-context/init
 *
 * Body: {
 *   user_name: string
 *   start_age: number
 *   end_age: number
 *   end_goal: string
 *   num_layers: number
 * }
 *
 * Returns: {
 *   context_id: string
 *   is_confident: boolean
 *   confidence_score: number
 *   questions?: string[]
 *   next_question?: string
 * }
 */
router.post('/init', upload.array('files', 10), async (req: Request, res: Response) => {
  Logger.entry('POST /api/configure-with-context/init', {
    body: req.body,
    files: (req.files as Express.Multer.File[])?.map((f) => f.originalname),
  });

  try {
    const { user_name, start_age, end_age, end_goal, num_layers } = req.body;
    const uploadedFiles = req.files as Express.Multer.File[] | undefined;

    // Validate required fields using UserError system
    if (!user_name) throw ValidationErrors.MISSING_FIELD('name');
    if (!start_age) throw ValidationErrors.MISSING_FIELD('starting age');
    if (!end_age) throw ValidationErrors.MISSING_FIELD('target age');
    if (!end_goal) throw ValidationErrors.MISSING_FIELD('goal');
    if (!num_layers) throw ValidationErrors.MISSING_FIELD('planning layers');

    // Validate age range
    const parsedStartAge = parseInt(start_age);
    const parsedEndAge = parseInt(end_age);

    if (parsedEndAge <= parsedStartAge) {
      throw ValidationErrors.INVALID_AGE_RANGE(parsedStartAge, parsedEndAge);
    }

    if (parsedEndAge > 60) {
      throw ValidationErrors.AGE_TOO_HIGH(60);
    }

    // Validate layers
    const parsedLayers = parseInt(num_layers);
    if (![2, 3].includes(parsedLayers)) {
      throw ValidationErrors.INVALID_LAYERS();
    }

    // Process uploaded files (extract text from PDFs, etc.)
    let processedFiles;
    if (uploadedFiles && uploadedFiles.length > 0) {
      Logger.info('Processing uploaded files', { count: uploadedFiles.length });
      processedFiles = await processUploadedFiles(uploadedFiles);
    }

    // Create initial context
    const context_id = uuidv4();
    const context: AgentContext = {
      user_config: {
        user_name,
        start_age,
        end_age,
        end_goal,
        num_layers,
      },
      attention: {},
      conversation_history: [],
      workflow: {
        current_stage: 'validation',
        attempt_count: 1,
        started_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
      },
      uploaded_files: processedFiles,
    };

    // Run Pre-Validation Agent
    Logger.info('Running Pre-Validation Agent');
    const validationResult = await analyzeInitialInput(context);

    // Update context with validation attention
    context.attention.validation_agent = validationResult.attention;
    context.workflow.last_updated_at = new Date().toISOString();

    // Save context to database
    execute(
      'INSERT INTO agent_contexts (id, user_config, attention, conversation_history, workflow, uploaded_files, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        context_id,
        JSON.stringify(context.user_config),
        JSON.stringify(context.attention),
        JSON.stringify(context.conversation_history),
        JSON.stringify(context.workflow),
        JSON.stringify(context.uploaded_files || []),
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );

    // CRITICAL: ALWAYS start conversation, regardless of confidence
    // The chat interface is the main interaction point - generate button lives there
    // If confidence >= 90%, generate button is enabled immediately

    Logger.info(
      validationResult.is_confident
        ? 'Validation passed (>= 95% confident), entering chat with generation enabled'
        : 'Validation needs clarification (< 95% confident), entering chat for questions',
      {
        confidence: validationResult.confidence_score,
        questions_count: validationResult.questions?.length || 0,
      }
    );

    // Start conversational flow
    context.workflow.current_stage = 'conversation';
    const conversationalResult = await gatherClarifications(context);

    // Determine initial message based on confidence
    const initialMessage = validationResult.is_confident
      ? "I have enough information to create your timeline! Review your details and click 'Generate Timeline' when ready, or ask me any questions first."
      : conversationalResult.response;

    // Add assistant's first message to conversation history
    const assistantMessage: ConversationMessage = {
      role: 'assistant',
      content: initialMessage,
      agent: validationResult.is_confident ? 'pre-validation-agent' : 'conversational-clarification-agent',
      timestamp: new Date().toISOString(),
    };
    context.conversation_history?.push(assistantMessage);

    // Update context in database
    execute(
      'UPDATE agent_contexts SET attention = ?, conversation_history = ?, workflow = ?, uploaded_files = ?, updated_at = ? WHERE id = ?',
      [
        JSON.stringify(context.attention),
        JSON.stringify(context.conversation_history),
        JSON.stringify(context.workflow),
        JSON.stringify(context.uploaded_files || []),
        new Date().toISOString(),
        context_id,
      ]
    );

    // ALWAYS return chat-ready state
    return res.json({
      context_id,
      is_confident: validationResult.is_confident,
      confidence_score: validationResult.confidence_score,
      next_question: initialMessage,
      ready_for_generation: validationResult.is_confident,
    });
  } catch (error) {
    // Handle UserError separately from other errors
    if (error instanceof UserError) {
      return res.status(400).json(error.toResponse());
    }

    // Log and return generic error for unexpected issues
    Logger.error('Failed to initialize context', error as Error);
    return res.status(500).json({
      type: 'user_error',
      severity: 'error',
      userMessage: 'An unexpected error occurred. Please try again.',
      suggestions: ['Check your internet connection', 'Refresh the page and try again'],
    });
  }
});

/**
 * Continue conversational clarification
 *
 * POST /api/configure-with-context/clarify
 *
 * Body (FormData): {
 *   context_id: string
 *   user_message: string
 *   files?: File[] (optional)
 * }
 *
 * Returns: {
 *   is_confident: boolean
 *   confidence_score: number
 *   next_question?: string
 *   ready_for_generation?: boolean
 * }
 */
router.post('/clarify', upload.array('files', 10), async (req: Request, res: Response) => {
  Logger.entry('POST /api/configure-with-context/clarify', {
    context_id: req.body.context_id,
    message_length: req.body.user_message?.length,
    files: (req.files as Express.Multer.File[])?.map((f) => f.originalname),
  });

  try {
    const { context_id, user_message } = req.body;
    const uploadedFiles = req.files as Express.Multer.File[] | undefined;

    if (!context_id || !user_message) {
      return res.status(400).json({ error: 'Missing required fields: context_id, user_message' });
    }

    // Load context from database
    const { queryOne } = require('../database/db');
    const row = queryOne('SELECT * FROM agent_contexts WHERE id = ?', [context_id]);

    if (!row) {
      return res.status(404).json({ error: 'Context not found' });
    }

    const context: AgentContext = {
      user_config: JSON.parse(row.user_config),
      attention: JSON.parse(row.attention),
      conversation_history: JSON.parse(row.conversation_history),
      workflow: JSON.parse(row.workflow),
      uploaded_files: row.uploaded_files ? JSON.parse(row.uploaded_files) : undefined,
    };

    // Add newly uploaded files to context
    if (uploadedFiles && uploadedFiles.length > 0) {
      const newFiles = uploadedFiles.map((file) => ({
        originalname: file.originalname,
        filename: file.filename,
        path: file.path,
        mimetype: file.mimetype,
        size: file.size,
      }));

      if (!context.uploaded_files) {
        context.uploaded_files = [];
      }
      context.uploaded_files.push(...newFiles);
    }

    // Add user message to conversation history
    const userMsg: ConversationMessage = {
      role: 'user',
      content: user_message,
      agent: 'user',
      timestamp: new Date().toISOString(),
    };
    context.conversation_history?.push(userMsg);

    // Run Conversational Agent
    Logger.info('Running Conversational Clarification Agent');
    const conversationalResult = await gatherClarifications(context, user_message);

    // Update attention
    context.attention.conversational_agent = conversationalResult.attention;

    // Add assistant response to conversation history
    const assistantMsg: ConversationMessage = {
      role: 'assistant',
      content: conversationalResult.response,
      agent: 'conversational-clarification-agent',
      timestamp: new Date().toISOString(),
    };
    context.conversation_history?.push(assistantMsg);

    if (conversationalResult.is_confident) {
      // Conversational agent is confident! Move to Internal Agent
      Logger.info('Conversational agent confident, running Internal Agent');

      context.workflow.current_stage = 'internal_review';
      const internalResult = await reviewBeforeGeneration(context);

      // Update attention
      context.attention.internal_agent = internalResult.attention;

      if (internalResult.is_confident) {
        // Ready for generation!
        Logger.info('Internal agent confident, ready for generation');
        context.workflow.current_stage = 'ready_for_generation';

        // Update context in database
        execute(
          'UPDATE agent_contexts SET attention = ?, conversation_history = ?, workflow = ?, updated_at = ? WHERE id = ?',
          [
            JSON.stringify(context.attention),
            JSON.stringify(context.conversation_history),
            JSON.stringify(context.workflow),
            new Date().toISOString(),
            context_id,
          ]
        );

        return res.json({
          is_confident: true,
          confidence_score: internalResult.confidence_score,
          ready_for_generation: true,
          should_research: internalResult.should_research,
          research_queries: internalResult.research_queries,
        });
      } else {
        // Internal agent needs more info - shouldn't happen if conversational was confident
        Logger.info('Internal agent not confident despite conversational confidence');

        execute(
          'UPDATE agent_contexts SET attention = ?, conversation_history = ?, workflow = ?, updated_at = ? WHERE id = ?',
          [
            JSON.stringify(context.attention),
            JSON.stringify(context.conversation_history),
            JSON.stringify(context.workflow),
            new Date().toISOString(),
            context_id,
          ]
        );

        return res.json({
          is_confident: false,
          confidence_score: internalResult.confidence_score,
          next_question:
            'I need a bit more information to ensure we create the best timeline for you. Can you provide more details about your goals?',
        });
      }
    } else {
      // Need more clarification
      Logger.info('Conversational agent needs more clarification');

      // Update context in database
      execute(
        'UPDATE agent_contexts SET attention = ?, conversation_history = ?, workflow = ?, uploaded_files = ?, updated_at = ? WHERE id = ?',
        [
          JSON.stringify(context.attention),
          JSON.stringify(context.conversation_history),
          JSON.stringify(context.workflow),
          JSON.stringify(context.uploaded_files || []),
          new Date().toISOString(),
          context_id,
        ]
      );

      return res.json({
        is_confident: false,
        confidence_score: conversationalResult.confidence_score,
        next_question: conversationalResult.response,
      });
    }
  } catch (error) {
    Logger.error('Failed to process clarification', error as Error);
    return res.status(500).json({ error: 'Failed to process clarification' });
  }
});

/**
 * Generate timeline with full context
 *
 * POST /api/configure-with-context/generate
 *
 * Body: {
 *   context_id: string
 * }
 *
 * Returns: {
 *   timeline_id: string
 *   timeline: object
 *   confidence_score: number
 *   cost: object
 * }
 */
router.post('/generate', async (req: Request, res: Response) => {
  Logger.entry('POST /api/configure-with-context/generate', {
    context_id: req.body.context_id,
  });

  try {
    const { context_id, confidence_threshold } = req.body;

    if (!context_id) {
      return res.status(400).json({ error: 'Missing required field: context_id' });
    }

    // Optional threshold for testing (defaults to 90 in agent)
    // NOTE: 90% threshold chosen after extensive Phase 1 & 2 testing
    // - Provides excellent quality while maintaining reliability
    // - 95% was too strict and rejected quality timelines at 92% confidence

    // Load context from database
    const { queryOne } = require('../database/db');
    const row = queryOne('SELECT * FROM agent_contexts WHERE id = ?', [context_id]);

    if (!row) {
      return res.status(404).json({ error: 'Context not found' });
    }

    const context: AgentContext = {
      user_config: JSON.parse(row.user_config),
      attention: JSON.parse(row.attention),
      conversation_history: JSON.parse(row.conversation_history),
      workflow: JSON.parse(row.workflow),
      uploaded_files: row.uploaded_files ? JSON.parse(row.uploaded_files) : undefined,
    };

    // Verify workflow stage
    if (context.workflow.current_stage !== 'ready_for_generation') {
      return res.status(400).json({
        error: 'Context not ready for generation. Complete clarification first.',
        current_stage: context.workflow.current_stage,
      });
    }

    // Check timeline limit (max 15 active timelines)
    const { query } = require('../database/db');
    const activeTimelines = query('SELECT COUNT(*) as count FROM timelines WHERE is_deleted = 0', []);

    if (activeTimelines[0].count >= 15) {
      return res.status(400).json({
        error: 'Timeline limit reached. Maximum of 15 timelines. Please delete one before creating a new timeline.',
      });
    }

    // Run Configuration Agent with full context
    Logger.info('Running Configuration Agent with context', {
      confidence_threshold: confidence_threshold || 90,
    });
    const configResult = await generateWithContext(context, confidence_threshold);

    if (!configResult.is_confident || !configResult.timeline) {
      Logger.error('Configuration agent failed to generate timeline');
      return res.status(500).json({
        error: 'Failed to generate timeline',
        issues: configResult.issues,
      });
    }

    // Store timeline in database
    const timeline_id = uuidv4();
    const { timeline } = configResult;
    const { user_name, start_age, end_age, end_goal, num_layers } = context.user_config;

    // Insert timeline
    execute(
      'INSERT INTO timelines (id, user_name, start_age, end_age, end_goal, num_layers) VALUES (?, ?, ?, ?, ?, ?)',
      [timeline_id, user_name, start_age, end_age, end_goal, num_layers]
    );

    // Insert layers and blocks
    for (const layer of timeline.layers) {
      const layer_id = uuidv4();
      execute(
        'INSERT INTO layers (id, timeline_id, layer_number, title, start_age, end_age) VALUES (?, ?, ?, ?, ?, ?)',
        [layer_id, timeline_id, layer.layer_number, layer.title, layer.start_age, layer.end_age]
      );

      for (const block of layer.blocks) {
        const block_id = uuidv4();
        execute(
          'INSERT INTO blocks (id, layer_id, layer_number, position, title, description, start_age, end_age, duration_years) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [block_id, layer_id, layer.layer_number, 0, block.title, block.description || '', block.start_age, block.end_age, block.duration_years]
        );
      }
    }

    // Link timeline to context
    context.timeline_id = timeline_id;
    execute('UPDATE agent_contexts SET timeline_id = ?, updated_at = ? WHERE id = ?', [
      timeline_id,
      new Date().toISOString(),
      context_id,
    ]);

    // Save conversation history to conversations table for this timeline
    if (context.conversation_history) {
      for (const msg of context.conversation_history) {
        execute(
          'INSERT INTO conversations (id, timeline_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), timeline_id, msg.role, msg.content, msg.timestamp]
        );
      }
    }

    Logger.info('Timeline generated successfully with context', {
      timeline_id,
      confidence: configResult.confidence_score,
    });

    return res.json({
      timeline_id,
      timeline: configResult.timeline,
      confidence_score: configResult.confidence_score,
      cost: {
        // TODO: Track costs from all agents
      },
    });
  } catch (error) {
    Logger.error('Failed to generate timeline', error as Error);
    return res.status(500).json({ error: 'Failed to generate timeline' });
  }
});

/**
 * Get timeline history
 *
 * GET /api/configure-with-context/history
 *
 * Returns: {
 *   timelines: Array<{
 *     id: string
 *     user_name: string
 *     end_goal: string
 *     created_at: string
 *     is_deleted: boolean
 *   }>
 *   count: number
 * }
 */
router.get('/history', async (req: Request, res: Response) => {
  Logger.entry('GET /api/configure-with-context/history');

  try {
    // Fetch active timelines (not deleted), limit to 15
    const { query } = require('../database/db');
    const timelines = query(
      'SELECT id, user_name, start_age, end_age, end_goal, num_layers, created_at FROM timelines WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT 15',
      []
    );

    // Fetch deleted timelines for trash (last 5)
    const deletedTimelines = query(
      'SELECT id, user_name, start_age, end_age, end_goal, num_layers, created_at, deleted_at FROM timelines WHERE is_deleted = 1 ORDER BY deleted_at DESC LIMIT 5',
      []
    );

    Logger.info('Timeline history fetched', {
      active_count: timelines.length,
      deleted_count: deletedTimelines.length,
    });

    return res.json({
      timelines,
      trash: deletedTimelines,
      count: timelines.length,
    });
  } catch (error) {
    Logger.error('Failed to fetch timeline history', error as Error);
    return res.status(500).json({ error: 'Failed to fetch timeline history' });
  }
});

/**
 * Delete a timeline (soft delete to trash)
 *
 * DELETE /api/configure-with-context/timeline/:id
 *
 * Returns: { success: boolean }
 */
router.delete('/timeline/:id', async (req: Request, res: Response) => {
  Logger.entry('DELETE /api/configure-with-context/timeline/:id', { id: req.params.id });

  try {
    const { id } = req.params;

    // Soft delete: Mark as deleted
    execute('UPDATE timelines SET is_deleted = 1, deleted_at = ? WHERE id = ?', [
      new Date().toISOString(),
      id,
    ]);

    // Check if we have more than 5 deleted timelines, permanently delete oldest
    const { query } = require('../database/db');
    const deletedTimelines = query(
      'SELECT id FROM timelines WHERE is_deleted = 1 ORDER BY deleted_at DESC',
      []
    );

    if (deletedTimelines.length > 5) {
      // Permanently delete timelines beyond the 5 most recent
      const toDelete = deletedTimelines.slice(5);
      for (const timeline of toDelete) {
        // Delete blocks first
        execute('DELETE FROM blocks WHERE layer_id IN (SELECT id FROM layers WHERE timeline_id = ?)', [
          timeline.id,
        ]);
        // Delete layers
        execute('DELETE FROM layers WHERE timeline_id = ?', [timeline.id]);
        // Delete conversations
        execute('DELETE FROM conversations WHERE timeline_id = ?', [timeline.id]);
        // Delete timeline
        execute('DELETE FROM timelines WHERE id = ?', [timeline.id]);
      }
    }

    Logger.info('Timeline deleted', { id });
    return res.json({ success: true });
  } catch (error) {
    Logger.error('Failed to delete timeline', error as Error);
    return res.status(500).json({ error: 'Failed to delete timeline' });
  }
});

/**
 * Restore a timeline from trash
 *
 * POST /api/configure-with-context/timeline/:id/restore
 *
 * Returns: { success: boolean }
 */
router.post('/timeline/:id/restore', async (req: Request, res: Response) => {
  Logger.entry('POST /api/configure-with-context/timeline/:id/restore', { id: req.params.id });

  try {
    const { id } = req.params;

    // Check if we already have 15 active timelines
    const { query } = require('../database/db');
    const activeTimelines = query('SELECT COUNT(*) as count FROM timelines WHERE is_deleted = 0', []);

    if (activeTimelines[0].count >= 15) {
      return res.status(400).json({
        error: 'Cannot restore timeline. Maximum of 15 timelines reached. Delete one first.',
      });
    }

    // Restore: Mark as not deleted
    execute('UPDATE timelines SET is_deleted = 0, deleted_at = NULL WHERE id = ?', [id]);

    Logger.info('Timeline restored', { id });
    return res.json({ success: true });
  } catch (error) {
    Logger.error('Failed to restore timeline', error as Error);
    return res.status(500).json({ error: 'Failed to restore timeline' });
  }
});

/**
 * Permanently delete a timeline from trash
 *
 * DELETE /api/configure-with-context/timeline/:id/permanent
 *
 * Returns: { success: boolean }
 */
router.delete('/timeline/:id/permanent', async (req: Request, res: Response) => {
  Logger.entry('DELETE /api/configure-with-context/timeline/:id/permanent', { id: req.params.id });

  try {
    const { id } = req.params;

    // Delete blocks first (foreign key constraint)
    execute('DELETE FROM blocks WHERE layer_id IN (SELECT id FROM layers WHERE timeline_id = ?)', [id]);
    // Delete layers
    execute('DELETE FROM layers WHERE timeline_id = ?', [id]);
    // Delete conversations
    execute('DELETE FROM conversations WHERE timeline_id = ?', [id]);
    // Delete timeline
    execute('DELETE FROM timelines WHERE id = ?', [id]);

    Logger.info('Timeline permanently deleted', { id });
    return res.json({ success: true });
  } catch (error) {
    Logger.error('Failed to permanently delete timeline', error as Error);
    return res.status(500).json({ error: 'Failed to permanently delete timeline' });
  }
});

export default router;
