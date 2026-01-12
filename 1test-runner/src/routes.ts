import { Express } from 'express';
import { deployTest } from './handlers/deploy';
import { getLogs } from './handlers/logs';
import { executeTest } from './handlers/execute';

export function setupRoutes(app: Express) {
  // Deploy a test plan
  app.post('/api/tests/deploy', deployTest);

  // Get logs for a test
  app.get('/api/tests/:name/logs', getLogs);

  // Execute a test immediately
  app.post('/api/tests/:name/execute', executeTest);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
}
