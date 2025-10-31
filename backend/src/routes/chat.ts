import { Router, Request, Response } from 'express';
import { chat, chatStream } from '../agents/conversational-assistant';
import { execute, query } from '../database/db';
import Logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * POST /api/chat
 *
 * Send a message to the Conversational Assistant
 *
 * Body:
 * - timeline_id: string
 * - message: string
 * - stream?: boolean (default: false)
 *
 * Returns: Assistant response or stream
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { timeline_id, message, stream = false } = req.body;

    if (!timeline_id || !message) {
      return res.status(400).json({
        error: 'timeline_id and message are required',
      });
    }

    Logger.info('Received chat request', {
      timelineId: timeline_id,
      messageLength: message.length,
      stream,
    });

    // Save user message to conversation history
    const userMessageId = uuidv4();
    execute(
      'INSERT INTO conversations (id, timeline_id, role, content) VALUES (?, ?, ?, ?)',
      [userMessageId, timeline_id, 'user', message]
    );

    if (stream) {
      // Streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let fullResponse = '';

      try {
        const result = await chatStream(timeline_id, message, (chunk) => {
          fullResponse += chunk;
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        });

        // Save assistant response to conversation history
        const assistantMessageId = uuidv4();
        execute(
          'INSERT INTO conversations (id, timeline_id, role, content) VALUES (?, ?, ?, ?)',
          [assistantMessageId, timeline_id, 'assistant', fullResponse]
        );

        // Send completion event
        res.write(`data: ${JSON.stringify({ done: true, cost: result.cost })}\n\n`);
        res.end();

        Logger.info('Chat stream completed', {
          timelineId: timeline_id,
          cost: result.cost,
        });
      } catch (error) {
        res.write(`data: ${JSON.stringify({ error: 'Chat failed' })}\n\n`);
        res.end();
        throw error;
      }
    } else {
      // Regular response
      const result = await chat(timeline_id, message);

      // Save assistant response to conversation history
      const assistantMessageId = uuidv4();
      execute(
        'INSERT INTO conversations (id, timeline_id, role, content) VALUES (?, ?, ?, ?)',
        [assistantMessageId, timeline_id, 'assistant', result.content]
      );

      Logger.info('Chat response sent', {
        timelineId: timeline_id,
        cost: result.cost,
      });

      res.json({
        message: result.content,
        costs: {
          anthropic: result.cost,
          parallel: 0,
          total: result.cost,
        },
      });
    }
  } catch (error) {
    Logger.error('Chat request failed', error as Error, {
      body: req.body,
    });
    res.status(500).json({
      error: 'Chat failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/chat/:timelineId
 *
 * Get conversation history for a timeline
 */
router.get('/:timelineId', async (req: Request, res: Response) => {
  try {
    const { timelineId } = req.params;

    Logger.info('Fetching conversation history', { timelineId });

    const history = query(
      'SELECT * FROM conversations WHERE timeline_id = ? ORDER BY timestamp ASC',
      [timelineId]
    );

    Logger.info('Conversation history fetched', {
      timelineId,
      count: history.length,
    });

    res.json(history);
  } catch (error) {
    Logger.error('Failed to fetch conversation history', error as Error, {
      timelineId: req.params.timelineId,
    });
    res.status(500).json({ error: 'Failed to fetch conversation history' });
  }
});

/**
 * DELETE /api/chat/:timelineId
 *
 * Clear conversation history for a timeline
 */
router.delete('/:timelineId', async (req: Request, res: Response) => {
  try {
    const { timelineId } = req.params;

    Logger.info('Clearing conversation history', { timelineId });

    const result = execute(
      'DELETE FROM conversations WHERE timeline_id = ?',
      [timelineId]
    );

    Logger.info('Conversation history cleared', {
      timelineId,
      deletedCount: result.changes,
    });

    res.json({
      success: true,
      deletedCount: result.changes,
    });
  } catch (error) {
    Logger.error('Failed to clear conversation history', error as Error, {
      timelineId: req.params.timelineId,
    });
    res.status(500).json({ error: 'Failed to clear conversation history' });
  }
});

export default router;
