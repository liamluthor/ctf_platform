import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
});

export function logRequest(method: string, path: string, statusCode?: number, duration?: number) {
  const logData: Record<string, unknown> = {
    method,
    path,
  };

  if (statusCode !== undefined) {
    logData.statusCode = statusCode;
  }

  if (duration !== undefined) {
    logData.duration = `${duration}ms`;
  }

  if (statusCode && statusCode >= 500) {
    logger.error(logData, 'HTTP Request');
  } else if (statusCode && statusCode >= 400) {
    logger.warn(logData, 'HTTP Request');
  } else {
    logger.info(logData, 'HTTP Request');
  }
}

export function logError(error: Error | unknown, context?: string) {
  const errorData: Record<string, unknown> = {
    error: error instanceof Error ? error.message : String(error),
  };

  if (context) {
    errorData.context = context;
  }

  if (error instanceof Error && error.stack) {
    errorData.stack = error.stack;
  }

  logger.error(errorData);
}

export default logger;
