import { Router, Request, Response } from 'express';
import { query, queryOne, execute } from '../database/db';
import { validate, TimelineSchema } from '../utils/validation';
import Logger from '../utils/logger';

const router = Router();

/**
 * GET /api/timelines/:id
 *
 * Fetch a complete timeline with all layers and blocks
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    Logger.info('Fetching timeline', { timelineId: id });

    // Get timeline
    const timeline = queryOne<any>(
      'SELECT * FROM timelines WHERE id = ?',
      [id]
    );

    if (!timeline) {
      return res.status(404).json({ error: 'Timeline not found' });
    }

    // Get layers for this timeline
    const layers = query<any>(
      'SELECT * FROM layers WHERE timeline_id = ? ORDER BY layer_number',
      [id]
    );

    // Get all blocks for these layers
    const layerIds = layers.map((l) => l.id);
    const blocks: any[] = [];

    for (const layerId of layerIds) {
      const layerBlocks = query<any>(
        'SELECT * FROM blocks WHERE layer_id = ? ORDER BY position',
        [layerId]
      );
      blocks.push(...layerBlocks);
    }

    // Group blocks by layer
    const layersWithBlocks = layers.map((layer) => ({
      ...layer,
      blocks: blocks.filter((b) => b.layer_id === layer.id),
    }));

    Logger.info('Timeline fetched successfully', {
      timelineId: id,
      layers: layers.length,
      blocks: blocks.length,
    });

    res.json({
      timeline,
      layers: layersWithBlocks,
    });
  } catch (error) {
    Logger.error('Failed to fetch timeline', error as Error, {
      timelineId: req.params.id,
    });
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

/**
 * PATCH /api/timelines/:id
 *
 * Update timeline metadata (name, goal, research model)
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    Logger.info('Updating timeline', { timelineId: id, updates });

    // Check timeline exists
    const existing = queryOne('SELECT id FROM timelines WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Timeline not found' });
    }

    // Build update query dynamically
    const allowedFields = ['user_name', 'end_goal', 'global_research_model'];
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

    const sql = `UPDATE timelines SET ${updateFields.join(', ')} WHERE id = ?`;
    execute(sql, updateValues);

    // Fetch updated timeline
    const updated = queryOne('SELECT * FROM timelines WHERE id = ?', [id]);

    Logger.info('Timeline updated successfully', { timelineId: id });

    res.json(updated);
  } catch (error) {
    Logger.error('Failed to update timeline', error as Error, {
      timelineId: req.params.id,
      body: req.body,
    });
    res.status(500).json({ error: 'Failed to update timeline' });
  }
});

/**
 * DELETE /api/timelines/:id
 *
 * Delete a timeline (cascades to layers and blocks)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    Logger.info('Deleting timeline', { timelineId: id });

    const result = execute('DELETE FROM timelines WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Timeline not found' });
    }

    Logger.info('Timeline deleted successfully', { timelineId: id });

    res.json({ success: true, message: 'Timeline deleted' });
  } catch (error) {
    Logger.error('Failed to delete timeline', error as Error, {
      timelineId: req.params.id,
    });
    res.status(500).json({ error: 'Failed to delete timeline' });
  }
});

/**
 * GET /api/timelines/:id/export
 *
 * Export timeline in LLM-friendly format
 */
router.get('/:id/export', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    Logger.info('Exporting timeline for LLM', { timelineId: id });

    // Get timeline
    const timeline = queryOne<any>(
      'SELECT * FROM timelines WHERE id = ?',
      [id]
    );

    if (!timeline) {
      return res.status(404).json({ error: 'Timeline not found' });
    }

    // Get layers for this timeline
    const layers = query<any>(
      'SELECT * FROM layers WHERE timeline_id = ? ORDER BY layer_number',
      [id]
    );

    // Get all blocks for these layers
    const layerIds = layers.map((l) => l.id);
    const blocks: any[] = [];

    for (const layerId of layerIds) {
      const layerBlocks = query<any>(
        'SELECT * FROM blocks WHERE layer_id = ? ORDER BY position',
        [layerId]
      );
      blocks.push(...layerBlocks);
    }

    // Group blocks by layer
    const layersWithBlocks = layers.map((layer) => ({
      ...layer,
      blocks: blocks.filter((b) => b.layer_id === layer.id),
    }));

    // Format for LLM consumption
    const exportText = formatTimelineForLLM(timeline, layersWithBlocks);

    Logger.info('Timeline exported successfully', {
      timelineId: id,
      exportLength: exportText.length,
    });

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${timeline.user_name}-career-timeline.txt"`);
    res.send(exportText);
  } catch (error) {
    Logger.error('Failed to export timeline', error as Error, {
      timelineId: req.params.id,
    });
    res.status(500).json({ error: 'Failed to export timeline' });
  }
});

/**
 * Format timeline data into LLM-friendly text format
 */
function formatTimelineForLLM(timeline: any, layers: any[]): string {
  const lines: string[] = [];

  // Header
  lines.push('='.repeat(60));
  lines.push('CAREER TRAJECTORY TIMELINE');
  lines.push('='.repeat(60));
  lines.push('');

  // Timeline metadata
  lines.push(`Person: ${timeline.user_name}`);
  lines.push(`Goal: ${timeline.end_goal}`);
  lines.push(`Age Range: ${timeline.start_age} - ${timeline.end_age} years old`);
  lines.push(`Total Duration: ${timeline.end_age - timeline.start_age} years`);
  lines.push(`Created: ${new Date(timeline.created_at).toLocaleDateString()}`);
  lines.push('');

  // Timeline structure
  lines.push('-'.repeat(40));
  lines.push('TIMELINE STRUCTURE');
  lines.push('-'.repeat(40));
  lines.push('');

  for (const layer of layers) {
    lines.push(`LAYER ${layer.layer_number}: ${layer.title}`);
    lines.push(`Duration: Age ${layer.start_age} - ${layer.end_age}`);
    lines.push('');

    if (layer.blocks && layer.blocks.length > 0) {
      for (const block of layer.blocks) {
        lines.push(`  • ${block.title}`);
        lines.push(`    Age: ${block.start_age} - ${block.end_age} (${block.duration_years} years)`);

        if (block.description) {
          lines.push(`    Description: ${block.description}`);
        }

        if (block.status && block.status !== 'not_started') {
          lines.push(`    Status: ${block.status.replace('_', ' ').toUpperCase()}`);
        }

        if (block.user_notes) {
          lines.push(`    Notes: ${block.user_notes}`);
        }

        // Add research data if available
        if (block.research_data) {
          try {
            const research = JSON.parse(block.research_data);
            if (research.results && research.results.length > 0) {
              lines.push(`    Research found ${research.results.length} resources:`);
              research.results.slice(0, 3).forEach((result: any, idx: number) => {
                lines.push(`      ${idx + 1}. ${result.title}`);
                if (result.url) {
                  lines.push(`         ${result.url}`);
                }
              });
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
        }

        lines.push('');
      }
    } else {
      lines.push('  (No blocks defined for this layer)');
      lines.push('');
    }
  }

  // Footer
  lines.push('-'.repeat(40));
  lines.push('END OF TIMELINE');
  lines.push('-'.repeat(40));
  lines.push('');
  lines.push('This timeline was generated by Career Trajectory AI');
  lines.push('A 95% confidence multi-agent system for personalized career planning');
  lines.push('');
  lines.push('You can use this timeline with any LLM (ChatGPT, Claude, Grok, etc.) by');
  lines.push('copying and pasting this text into your conversation.');
  lines.push('');

  return lines.join('\n');
}

/**
 * GET /api/timelines
 *
 * List all timelines (without full details)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    Logger.info('Listing all timelines');

    const timelines = query<any>('SELECT * FROM timelines ORDER BY created_at DESC');

    Logger.info('Timelines listed', { count: timelines.length });

    res.json(timelines);
  } catch (error) {
    Logger.error('Failed to list timelines', error as Error);
    res.status(500).json({ error: 'Failed to list timelines' });
  }
});

export default router;
