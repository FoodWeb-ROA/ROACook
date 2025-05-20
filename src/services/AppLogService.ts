const logBuffer: string[] = [];

const addLogEntry = (level: string, ...args: any[]) => {
  const timestamp = new Date().toISOString();
  // Attempt to stringify objects, otherwise convert to string
  const messageParts = args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg);
      } catch (e) {
        return '[Unserializable Object]';
      }
    }
    return String(arg);
  });
  const message = messageParts.join(' ');
  
  const logEntry = `${timestamp} [${level.toUpperCase()}]: ${message}`;
  
  logBuffer.push(logEntry);
};

export const appLogger = {
  log: (...args: any[]) => {
    addLogEntry('log', ...args);
    console.log(...args);
  },
  warn: (...args: any[]) => {
    addLogEntry('warn', ...args);
    console.warn(...args);
  },
  error: (...args: any[]) => {
    addLogEntry('error', ...args);
    console.error(...args);
  },
  getLogs: (): string => {
    const combinedLogs = logBuffer.join('\n');
    // Truncate to the last 2000 characters if longer
    if (combinedLogs.length > 2000) {
      return '...truncated...\n' + combinedLogs.slice(-2000);
    }
    return combinedLogs;
  },
  clearLogs: () => {
    logBuffer.length = 0;
  },
};
