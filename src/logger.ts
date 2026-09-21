export interface Logger {
  info: (message: string, extra?: Record<string, unknown>) => void;
  warn: (message: string, extra?: Record<string, unknown>) => void;
  error: (message: string, extra?: Record<string, unknown>) => void;
  debug: (message: string, extra?: Record<string, unknown>) => void;
}

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;

function formatExtra(extra?: Record<string, unknown>): string {
  if (!extra || Object.keys(extra).length === 0) {
    return '';
  }
  return ` ${JSON.stringify(extra)}`;
}

export function createLogger(levelName: string): Logger {
  const min = LEVELS[levelName as keyof typeof LEVELS] ?? LEVELS.info;

  const write = (level: keyof typeof LEVELS, message: string, extra?: Record<string, unknown>) => {
    if (LEVELS[level] < min) {
      return;
    }
    const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}${formatExtra(extra)}`;
    if (level === 'error') {
      console.error(line);
      return;
    }
    if (level === 'warn') {
      console.warn(line);
      return;
    }
    console.log(line);
  };

  return {
    debug: (message, extra) => write('debug', message, extra),
    info: (message, extra) => write('info', message, extra),
    warn: (message, extra) => write('warn', message, extra),
    error: (message, extra) => write('error', message, extra),
  };
}
