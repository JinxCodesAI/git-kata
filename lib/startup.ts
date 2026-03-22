import { containerPool } from './container-pool';
import { logger } from './logger';

// Initialize pool when this module is first imported
containerPool.initialize().catch(e => {
  logger.error('Failed to initialize container pool:', e);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down container pool...');
  await containerPool.drainAll();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down container pool...');
  await containerPool.drainAll();
  process.exit(0);
});