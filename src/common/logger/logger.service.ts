import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

@Injectable()
export class LoggerService implements NestLoggerService {
  private context?: string;
  // Cores ANSI para console
  private readonly colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
  };
  setContext(context: string) {
    this.context = context;
  }
  log(message: string, metadata?: Record<string, any>) {
    this.writeLog(LogLevel.INFO, message, metadata);
  }
  error(message: string, trace?: string, metadata?: Record<string, any>) {
    this.writeLog(LogLevel.ERROR, message, { ...metadata, trace });
  }
  warn(message: string, metadata?: Record<string, any>) {
    this.writeLog(LogLevel.WARN, message, metadata);
  }
  debug(message: string, metadata?: Record<string, any>) {
    this.writeLog(LogLevel.DEBUG, message, metadata);
  }
  verbose(message: string, metadata?: Record<string, any>) {
    this.writeLog(LogLevel.DEBUG, message, metadata);
  }
  private writeLog(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
  ) {
    const timestamp = new Date().toISOString();
    const context = this.context || 'Application';
    // JSON estruturado para parsing/análise
    const logEntry = {
      timestamp,
      level,
      context,
      message,
      ...(metadata && { metadata }),
    };
    // Formatação colorida para console
    const levelColor = this.getLevelColor(level);
    const levelIcon = this.getLevelIcon(level);
    const prettyLog = [
      `${this.colors.dim}[${timestamp}]${this.colors.reset}`,
      `${levelColor}${levelIcon} ${level}${this.colors.reset}`,
      `${this.colors.cyan}[${context}]${this.colors.reset}`,
      `${this.colors.bright}${message}${this.colors.reset}`,
      metadata
        ? `\n${this.colors.dim}${JSON.stringify(metadata, null, 2)}${this.colors.reset}`
        : '',
    ]
      .filter(Boolean)
      .join(' ');
    // Envia ambos: JSON estruturado + versão colorida
    switch (level) {
      case LogLevel.ERROR:
        console.error(prettyLog);
        break;
      case LogLevel.WARN:
        console.warn(prettyLog);
        break;
      case LogLevel.DEBUG:
        console.debug(prettyLog);
        break;
      default:
        console.log(prettyLog);
    }
    // Opcional: também loga o JSON puro (útil pra parsers)
    if (process.env.LOG_JSON === 'true') {
      console.log(JSON.stringify(logEntry));
    }
  }
  private getLevelColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR:
        return this.colors.red;
      case LogLevel.WARN:
        return this.colors.yellow;
      case LogLevel.DEBUG:
        return this.colors.magenta;
      default:
        return this.colors.green;
    }
  }
  private getLevelIcon(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR:
        return '✖';
      case LogLevel.WARN:
        return '⚠';
      case LogLevel.DEBUG:
        return '🔍';
      default:
        return '✓';
    }
  }
}
