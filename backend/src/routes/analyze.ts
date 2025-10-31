import { Router, Request, Response } from 'express';
import { analyzeAndResearch, getTimelineSnapshot } from '../agents/internal-agent';
import Logger from '../utils/logger';

const router = Router();

/**
 * POST /api/analyze
 *
 * Trigger Internal Agent analysis and research
 *
 * Body:
 * - timelineId: string
 * - oldStateSnapshot?: string (JSON snapshot of old state, if available)
 * - processor?: 'base' | 'pro' (default: 'pro')
 *
 * Returns: Analysis results with recommendations and research
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { timelineId, oldStateSnapshot, processor = 'pro' } = req.body;

    if (!timelineId) {
      return res.status(400).json({
        error: 'timelineId is required',
      });
    }

    Logger.info('Received analyze request', {
      timelineId,
      processor,
      hasOldSnapshot: !!oldStateSnapshot,
    });

    // If no old snapshot provided, use current state as baseline
    // (this means we'll analyze all blocks as "new")
    let oldSnapshot = oldStateSnapshot;
    if (!oldSnapshot) {
      const currentState = await getTimelineSnapshot(timelineId);
      // Create empty old state
      oldSnapshot = JSON.stringify({
        timeline: currentState.timeline,
        layers: [],
        blocks: [],
      });
    }

    // Run analysis and research
    const result = await analyzeAndResearch(timelineId, oldSnapshot, processor);

    Logger.info('Analysis completed', {
      timelineId,
      changesCount: result.changes.length,
      researchCount: result.researchResults.length,
      anthropicCost: result.anthropicCost,
      parallelCost: result.parallelCost,
      totalCost: result.anthropicCost + result.parallelCost,
    });

    res.json({
      changes: result.changes,
      blocksNeedingResearch: result.blocksNeedingResearch,
      recommendations: result.recommendations,
      costs: {
        anthropic: result.anthropicCost,
        parallel: result.parallelCost,
        total: result.anthropicCost + result.parallelCost,
      },
      researchResults: result.researchResults.map((r) => ({
        blockId: r.blockId,
        blockTitle: r.blockTitle,
        cost: r.cost,
        // Include summarized research data (not full results to save bandwidth)
        summary: r.researchData.results?.slice(0, 3) || [],
      })),
    });
  } catch (error) {
    Logger.error('Analysis failed', error as Error, {
      body: req.body,
    });

    res.status(500).json({
      error: 'Analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/analyze/snapshot/:timelineId
 *
 * Get current timeline snapshot (for saving as oldState before edits)
 */
router.get('/snapshot/:timelineId', async (req: Request, res: Response) => {
  try {
    const { timelineId } = req.params;

    Logger.info('Fetching timeline snapshot', { timelineId });

    const snapshot = await getTimelineSnapshot(timelineId);

    Logger.info('Snapshot fetched', {
      timelineId,
      layersCount: snapshot.layers.length,
      blocksCount: snapshot.blocks.length,
    });

    res.json(snapshot);
  } catch (error) {
    Logger.error('Failed to fetch snapshot', error as Error, {
      timelineId: req.params.timelineId,
    });

    res.status(500).json({
      error: 'Failed to fetch snapshot',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
