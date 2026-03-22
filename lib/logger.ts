type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LOG_LEVELS[(process.env.LOG_LEVEL as LogLevel) || 'info'] ?? LOG_LEVELS.info;

export const logger = {
  debug: (...args: unknown[]) => { if (currentLevel <= 0) console.log('[DEBUG]', ...args); },
  info:  (...args: unknown[]) => { if (currentLevel <= 1) console.log('[INFO]', ...args); },
  warn:  (...args: unknown[]) => { if (currentLevel <= 2) console.warn('[WARN]', ...args); },
  error: (...args: unknown[]) => { if (currentLevel <= 3) console.error('[ERROR]', ...args); },
};