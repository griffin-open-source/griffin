import express from 'express';
import { setupRoutes } from './routes';
import { setupScheduler } from './scheduler';
import { setupDatabase } from './database';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

async function start() {
  // Initialize database connection
  await setupDatabase();

  // Setup API routes
  setupRoutes(app);

  // Setup test scheduler
  setupScheduler();

  app.listen(PORT, () => {
    console.log(`1test Runner listening on port ${PORT}`);
  });
}

start().catch(console.error);
