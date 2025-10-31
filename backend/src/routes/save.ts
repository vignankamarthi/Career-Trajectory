import { Router, Request, Response } from 'express';
import { execute, query } from '../database/db';
import { sendMessage } from '../services/anthropic';
import { getTimelineSnapshot, analyzeAndResearch } from '../agents/internal-agent';
import Logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * POST /api/save/save-only
 *
 * Save Mode 1: Save Only ($0)
 * - No LLM involvement
 * - Just saves current state snapshot
 * - Instant
 */
router.post('/save-only', async (req: Request, res: Response) => {
  try {
    const { timeline_id } = req.body;

    if (!timeline_id) {
      return res.status(400).json({ error: 'timeline_id is required' });
    }

    Logger.info('Save Only started', { timelineId: timeline_id });

    // Get current timeline snapshot
    const snapshot = await getTimelineSnapshot(timeline_id);

    // Save to history
    const saveId = uuidv4();
    execute(
      `INSERT INTO save_history (id, timeline_id, state_snapshot, save_type, research_cost)
       VALUES (?, ?, ?, ?, ?)`,
      [saveId, timeline_id, JSON.stringify(snapshot), 'save_only', 0]
    );

    Logger.info('Save Only completed', { timelineId: timeline_id });

    res.json({
      success: true,
      saveId,
      cost: 0,
      message: 'Timeline saved successfully',
    });
  } catch (error) {
    Logger.error('Save Only failed', error as Error, { body: req.body });
    res.status(500).json({
      error: 'Save failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/save/lite
 *
 * Save Mode 2: Lite Check (~$0.005)
 * - Quick Anthropic validation
 * - Checks: age bounds, durations, timeline coherence
 * - Returns validation errors if any
 * - 5-10 seconds
 */
router.post('/lite', async (req: Request, res: Response) => {
  try {
    const { timeline_id } = req.body;

    if (!timeline_id) {
      return res.status(400).json({ error: 'timeline_id is required' });
    }

    Logger.info('Lite Check started', { timelineId: timeline_id });

    // Get current timeline snapshot
    const snapshot = await getTimelineSnapshot(timeline_id);

    // Build validation prompt
    const systemPrompt = `You are validating a career timeline for errors and inconsistencies.

HARD BOUNDS TO CHECK:
- Timeline: Age ${snapshot.timeline.start_age} to ${snapshot.timeline.end_age}
- Layer 1 blocks: 4-10 years each
- Layer 2 blocks: 0-5 years each
- Layer 3 blocks: 0-1 years each

VALIDATION CHECKS:
1. Age bounds respected
2. Block durations within layer bounds
3. No gaps or overlaps within layers
4. Timeline coherence (blocks lead toward goal)
5. Reasonable progression

Return "valid" if no issues, or list specific errors.`;

    const userPrompt = `Validate this timeline:

TIMELINE:
- Goal: ${snapshot.timeline.end_goal}
- Age: ${snapshot.timeline.start_age} to ${snapshot.timeline.end_age}

BLOCKS:
${snapshot.blocks.map((b: any) => `- Layer ${b.layer_number}: ${b.title} (Age ${b.start_age}-${b.end_age}, ${b.duration_years}yr)`).join('\n')}

Are there any validation errors or concerns?`;

    const response = await sendMessage(
      [{ role: 'user', content: userPrompt }],
      { system: systemPrompt, maxTokens: 1024 }
    );

    // Save to history
    const saveId = uuidv4();
    execute(
      `INSERT INTO save_history (id, timeline_id, state_snapshot, save_type, research_cost)
       VALUES (?, ?, ?, ?, ?)`,
      [saveId, timeline_id, JSON.stringify(snapshot), 'lite', response.cost]
    );

    // Determine if validation passed
    const validationPassed = response.content.toLowerCase().includes('valid') &&
      !response.content.toLowerCase().includes('error') &&
      !response.content.toLowerCase().includes('issue');

    Logger.info('Lite Check completed', {
      timelineId: timeline_id,
      cost: response.cost,
      validationPassed,
    });

    res.json({
      success: true,
      saveId,
      cost: response.cost,
      validationPassed,
      validationMessage: response.content,
    });
  } catch (error) {
    Logger.error('Lite Check failed', error as Error, { body: req.body });
    res.status(500).json({
      error: 'Validation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/save/refactor
 *
 * Save Mode 3: Refactor (~$0.15)
 * - Uses Internal Agent
 * - Compares old vs new state
 * - Researches changed blocks via Parallel
 * - Returns research-backed recommendations
 * - 30-60 seconds
 */
router.post('/refactor', async (req: Request, res: Response) => {
  try {
    const { timeline_id, processor = 'pro' } = req.body;

    if (!timeline_id) {
      return res.status(400).json({ error: 'timeline_id is required' });
    }

    Logger.info('Refactor started', { timelineId: timeline_id, processor });

    // Get most recent save to compare against
    const previousSaves = query(
      `SELECT * FROM save_history
       WHERE timeline_id = ?
       ORDER BY timestamp DESC
       LIMIT 1`,
      [timeline_id]
    );

    if (previousSaves.length === 0) {
      return res.status(400).json({
        error: 'No previous save found',
        message: 'Please use Save Only first to create a baseline',
      });
    }

    const previousSnapshot = previousSaves[0].state_snapshot;

    // Run analysis and research via Internal Agent
    const analysis = await analyzeAndResearch(timeline_id, previousSnapshot, processor);

    // Get current snapshot
    const currentSnapshot = await getTimelineSnapshot(timeline_id);

    // Save to history
    const saveId = uuidv4();
    execute(
      `INSERT INTO save_history (id, timeline_id, state_snapshot, save_type, research_cost)
       VALUES (?, ?, ?, ?, ?)`,
      [
        saveId,
        timeline_id,
        JSON.stringify(currentSnapshot),
        'refactor',
        analysis.totalResearchCost,
      ]
    );

    Logger.info('Refactor completed', {
      timelineId: timeline_id,
      changesCount: analysis.changes.length,
      researchCount: analysis.researchResults.length,
      totalCost: analysis.totalResearchCost,
    });

    res.json({
      success: true,
      saveId,
      cost: analysis.totalResearchCost,
      changes: analysis.changes,
      recommendations: analysis.recommendations,
      researchResults: analysis.researchResults.map((r: any) => ({
        blockId: r.blockId,
        blockTitle: r.blockTitle,
        resultCount: r.researchData.results.length,
      })),
    });
  } catch (error) {
    Logger.error('Refactor failed', error as Error, { body: req.body });
    res.status(500).json({
      error: 'Refactor failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/save/history/:timelineId
 *
 * Get save history for a timeline
 */
router.get('/history/:timelineId', async (req: Request, res: Response) => {
  try {
    const { timelineId } = req.params;

    Logger.info('Fetching save history', { timelineId });

    const history = query(
      `SELECT id, timeline_id, save_type, research_cost, timestamp
       FROM save_history
       WHERE timeline_id = ?
       ORDER BY timestamp DESC`,
      [timelineId]
    );

    Logger.info('Save history fetched', {
      timelineId,
      count: history.length,
    });

    res.json(history);
  } catch (error) {
    Logger.error('Failed to fetch save history', error as Error, {
      timelineId: req.params.timelineId,
    });
    res.status(500).json({ error: 'Failed to fetch save history' });
  }
});

/**
 * GET /api/save/:saveId
 *
 * Get details of a specific save (including full snapshot)
 */
router.get('/:saveId', async (req: Request, res: Response) => {
  try {
    const { saveId } = req.params;

    Logger.info('Fetching save details', { saveId });

    const save = query('SELECT * FROM save_history WHERE id = ?', [saveId]);

    if (save.length === 0) {
      return res.status(404).json({ error: 'Save not found' });
    }

    Logger.info('Save details fetched', { saveId });

    res.json(save[0]);
  } catch (error) {
    Logger.error('Failed to fetch save details', error as Error, {
      saveId: req.params.saveId,
    });
    res.status(500).json({ error: 'Failed to fetch save details' });
  }
});

export default router;
