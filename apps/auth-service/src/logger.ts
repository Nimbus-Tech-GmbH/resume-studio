/**
 * Fastify logger configuration.
 * Returns logger instance for use in middleware/controllers.
 */
export function getLoggerConfig() {
  return {
    level: process.env.LOG_LEVEL ?? 'info',
    transport:
      process.env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
  };
}
