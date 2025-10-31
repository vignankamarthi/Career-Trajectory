import { Router, Request, Response } from 'express';
import { query, queryOne, execute } from '../database/db';
import { validate, BlockSchema } from '../utils/validation';
import { researchBlock } from '../services/parallel';
import Logger from '../utils/logger';

const router = Router();

/**
 * GET /api/blocks/:id
 *
 * Get a single block with full details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    Logger.info('Fetching block', { blockId: id });

    const block = queryOne<any>('SELECT * FROM blocks WHERE id = ?', [id]);

    if (!block) {
      return res.status(404).json({ error: 'Block not found' });
    }

    Logger.info('Block fetched successfully', { blockId: id });

    res.json(block);
  } catch (error) {
    Logger.error('Failed to fetch block', error as Error, {
      blockId: req.params.id,
    });
    res.status(500).json({ error: 'Failed to fetch block' });
  }
});

/**
 * PATCH /api/blocks/:id
 *
 * Update a block
 * Allowed updates: title, description, status, user_notes
 * Age/duration changes require validation
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    Logger.info('Updating block', { blockId: id, updates });

    // Get existing block
    const existing = queryOne<any>('SELECT * FROM blocks WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Block not found' });
    }

    // Merge updates with existing data
    const merged = { ...existing, ...updates };

    // Validate the merged block
    try {
      validate(BlockSchema, merged);
    } catch (validationError) {
      return res.status(400).json({
        error: 'Validation failed',
        message: (validationError as Error).message,
      });
    }

    // Build update query
    const allowedFields = [
      'title',
      'description',
      'start_age',
      'end_age',
      'duration_years',
      'status',
      'user_notes',
      'research_data',
    ];

    const updateFields: string[] = [];
    const updateValues: any[] = [];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updates[field]);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Add updated_at
    updateFields.push('updated_at = datetime("now")');
    updateValues.push(id);

    const sql = `UPDATE blocks SET ${updateFields.join(', ')} WHERE id = ?`;
    execute(sql, updateValues);

    // Fetch updated block
    const updated = queryOne('SELECT * FROM blocks WHERE id = ?', [id]);

    Logger.info('Block updated successfully', { blockId: id });

    res.json(updated);
  } catch (error) {
    Logger.error('Failed to update block', error as Error, {
      blockId: req.params.id,
      body: req.body,
    });
    res.status(500).json({ error: 'Failed to update block' });
  }
});

/**
 * POST /api/blocks/:id/research
 *
 * Research a specific block using Parallel AI
 * Saves research data to the block
 */
router.post('/:id/research', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { processor = 'pro' } = req.body;

    Logger.info('Researching block', { blockId: id, processor });

    // Get block details
    const block = queryOne<any>('SELECT * FROM blocks WHERE id = ?', [id]);
    if (!block) {
      return res.status(404).json({ error: 'Block not found' });
    }

    // Get layer and timeline for context
    const layer = queryOne<any>('SELECT * FROM layers WHERE id = ?', [block.layer_id]);
    const timeline = queryOne<any>('SELECT * FROM timelines WHERE id = ?', [layer.timeline_id]);

    // Execute research via Parallel AI
    const researchResult = await researchBlock({
      blockTitle: block.title,
      blockDescription: block.description,
      startAge: block.start_age,
      endAge: block.end_age,
      overallGoal: timeline.end_goal,
      processor: processor as 'base' | 'pro',
    });

    // Save research data to block
    const researchData = JSON.stringify({
      searchId: researchResult.searchId,
      objective: researchResult.objective,
      processor: researchResult.processor,
      results: researchResult.results,
      timestamp: new Date().toISOString(),
      cost: researchResult.cost,
    });

    execute(
      'UPDATE blocks SET research_data = ?, updated_at = datetime("now") WHERE id = ?',
      [researchData, id]
    );

    Logger.info('Block research completed', {
      blockId: id,
      cost: researchResult.cost,
      resultCount: researchResult.results.length,
    });

    res.json({
      blockId: id,
      research: researchResult,
      cost: researchResult.cost,
    });
  } catch (error) {
    Logger.error('Block research failed', error as Error, {
      blockId: req.params.id,
    });
    res.status(500).json({
      error: 'Research failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/blocks/:id
 *
 * Delete a block (use carefully - may break timeline continuity)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    Logger.info('Deleting block', { blockId: id });

    const result = execute('DELETE FROM blocks WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Block not found' });
    }

    Logger.info('Block deleted successfully', { blockId: id });

    res.json({ success: true, message: 'Block deleted' });
  } catch (error) {
    Logger.error('Failed to delete block', error as Error, {
      blockId: req.params.id,
    });
    res.status(500).json({ error: 'Failed to delete block' });
  }
});

/**
 * GET /api/blocks/layer/:layerId
 *
 * Get all blocks for a specific layer
 */
router.get('/layer/:layerId', async (req: Request, res: Response) => {
  try {
    const { layerId } = req.params;
    Logger.info('Fetching blocks for layer', { layerId });

    const blocks = query<any>(
      'SELECT * FROM blocks WHERE layer_id = ? ORDER BY position',
      [layerId]
    );

    Logger.info('Blocks fetched for layer', {
      layerId,
      count: blocks.length,
    });

    res.json(blocks);
  } catch (error) {
    Logger.error('Failed to fetch blocks for layer', error as Error, {
      layerId: req.params.layerId,
    });
    res.status(500).json({ error: 'Failed to fetch blocks' });
  }
});

export default router;
