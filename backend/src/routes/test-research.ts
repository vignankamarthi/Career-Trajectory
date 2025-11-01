/**
 * TEST RESEARCH ENDPOINT
 * For backend validation checkpoint - triggers async research to test WebSocket flow
 */

import express from 'express';
import { Logger } from '../utils/logger';
import parallelMCPService, { ResearchProcessor } from '../services/parallel-mcp';

const router = express.Router();

/**
 * POST /api/test/research
 * Triggers a test research task to validate async + WebSocket flow
 */
router.post('/research', async (req, res) => {
  try {
    Logger.info('[TestResearch] Creating test research task');

    const { taskId, estimatedTime } = await parallelMCPService.createResearchTask({
      blockId: 'test-block-123',
      blockTitle: 'Test: Becoming an AI Researcher',
      query: 'What are the best universities for AI research?',
      processor: ResearchProcessor.LITE, // Fast test (5-60s)
      researchType: 'quick'
    });

    Logger.info('[TestResearch] Test research task created', {
      taskId,
      estimatedTime
    });

    res.json({
      success: true,
      taskId,
      estimatedTime,
      message: 'Test research task created. Check WebSocket for updates!',
      websocketUrl: 'ws://localhost:3001/ws'
    });

  } catch (error) {
    Logger.error('[TestResearch] Failed to create test research', error as Error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/test/research/:taskId
 * Check status of a test research task
 */
router.get('/research/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await parallelMCPService.checkTaskStatus(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    Logger.info('[TestResearch] Task status checked', {
      taskId,
      status: task.status
    });

    res.json({
      success: true,
      task
    });

  } catch (error) {
    Logger.error('[TestResearch] Failed to check task status', error as Error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/test/websocket
 * Returns HTML page for testing WebSocket connection
 */
router.get('/websocket', (req, res) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>WebSocket Test</title>
  <style>
    body { font-family: 'JetBrains Mono', monospace; padding: 20px; background: #1a1a1a; color: #e0e0e0; }
    h1 { color: #00ff00; }
    button { padding: 10px 20px; margin: 5px; background: #00ff00; border: none; cursor: pointer; font-weight: bold; }
    button:hover { background: #00cc00; }
    #log { background: #000; padding: 15px; border: 1px solid #333; height: 400px; overflow-y: auto; font-size: 12px; }
    .success { color: #00ff00; }
    .error { color: #ff0000; }
    .info { color: #00aaff; }
    .warning { color: #ffaa00; }
  </style>
</head>
<body>
  <h1>🚀 WebSocket + Async Research Test</h1>
  <div>
    <button onclick="connectWS()">1. Connect WebSocket</button>
    <button onclick="triggerResearch()">2. Trigger Test Research</button>
    <button onclick="clearLog()">Clear Log</button>
  </div>
  <h2>WebSocket Log:</h2>
  <div id="log"></div>

  <script>
    let ws = null;
    let taskId = null;

    function log(message, type = 'info') {
      const logDiv = document.getElementById('log');
      const timestamp = new Date().toLocaleTimeString();
      logDiv.innerHTML += \`<div class="\${type}">[</ span>\${timestamp}] \${message}</div>\`;
      logDiv.scrollTop = logDiv.scrollHeight;
    }

    function clearLog() {
      document.getElementById('log').innerHTML = '';
    }

    function connectWS() {
      if (ws) {
        log('WebSocket already connected!', 'warning');
        return;
      }

      log('Connecting to ws://localhost:3001/ws...', 'info');
      ws = new WebSocket('ws://localhost:3001/ws');

      ws.onopen = () => {
        log('✅ WebSocket CONNECTED!', 'success');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        log(\`📨 Received: \${data.type}\`, 'info');
        log(JSON.stringify(data, null, 2), 'info');

        if (data.type === 'research_complete') {
          log('✅ RESEARCH COMPLETE!', 'success');
        }
      };

      ws.onerror = (error) => {
        log('❌ WebSocket ERROR: ' + error, 'error');
      };

      ws.onclose = () => {
        log('❌ WebSocket CLOSED', 'warning');
        ws = null;
      };
    }

    async function triggerResearch() {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        log('❌ Connect WebSocket first!', 'error');
        return;
      }

      log('Triggering test research task...', 'info');

      try {
        const response = await fetch('http://localhost:3001/api/test/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();
        taskId = data.taskId;

        log(\`✅ Research task created: \${taskId}\`, 'success');
        log(\`⏱️ Estimated time: \${data.estimatedTime}s\`, 'info');
        log('👀 Watch for WebSocket updates!', 'info');

      } catch (error) {
        log('❌ Failed to trigger research: ' + error, 'error');
      }
    }
  </script>
</body>
</html>
  `;

  res.send(html);
});

export default router;
