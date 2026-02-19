import { Injectable, Scope, LoggerService as NestLoggerService } from '@nestjs/common';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  private context?: string;

  // Cores ANSI
  private readonly c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    italic: '\x1b[3m',
    underline: '\x1b[4m',
    // Foreground
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    // Bright foreground
    bRed: '\x1b[91m',
    bGreen: '\x1b[92m',
    bYellow: '\x1b[93m',
    bBlue: '\x1b[94m',
    bMagenta: '\x1b[95m',
    bCyan: '\x1b[96m',
    bWhite: '\x1b[97m',
    // Background
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
    bgWhite: '\x1b[47m',
  };

  // Cor por contexto — cada módulo tem sua identidade visual
  private readonly contextThemes: Record<string, { badge: string; color: string }> = {
    // Infra
    RedisService:       { badge: '🔴', color: this.c.red },
    RabbitMQService:    { badge: '🐇', color: this.c.magenta },
    PrismaService:      { badge: '💎', color: this.c.bBlue },

    // Domínio
    SessionService:     { badge: '🎬', color: this.c.green },
    SessionRepository:  { badge: '🎬', color: this.c.green },
    SeatService:        { badge: '💺', color: this.c.cyan },
    SeatRepository:     { badge: '💺', color: this.c.cyan },
    ReservationService: { badge: '🎫', color: this.c.blue },
    ReservationRepository: { badge: '🎫', color: this.c.blue },
    PaymentService:     { badge: '💳', color: this.c.yellow },
    SaleService:        { badge: '🧾', color: this.c.bGreen },
    SaleRepository:     { badge: '🧾', color: this.c.bGreen },

    // Events — cor mesclada (domínio + infra)
    ReservationPublisher: { badge: '🎫📤', color: this.c.bMagenta },
    ReservationConsumer:  { badge: '🎫📥', color: this.c.bMagenta },
    PaymentPublisher:     { badge: '💳📤', color: this.c.bYellow },
    PaymentConsumer:      { badge: '💳📥', color: this.c.bYellow },
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
    const theme = this.contextThemes[context] || { badge: '◈', color: this.c.white };
    const levelStyle = this.getLevelStyle(level);

    // Formato limpo:
    // 07:38:31 ✓ INFO  🐇 [RabbitMQService] Fila declarada: reservations
    const time = timestamp.split('T')[1].split('.')[0]; // HH:MM:SS

    const line = [
      `${this.c.dim}${time}${this.c.reset}`,
      `${levelStyle.color}${levelStyle.icon}${this.c.reset}`,
      `${levelStyle.color}${level.padEnd(5)}${this.c.reset}`,
      `${theme.color}${theme.badge} [${context}]${this.c.reset}`,
      `${this.c.bold}${message}${this.c.reset}`,
    ].join(' ');

    const metaLine = metadata
      ? `  ${this.c.dim}${JSON.stringify(metadata, null, 2)}${this.c.reset}`
      : '';

    const output = metaLine ? `${line}\n${metaLine}` : line;

    switch (level) {
      case LogLevel.ERROR:
        console.error(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      case LogLevel.DEBUG:
        console.debug(output);
        break;
      default:
        console.log(output);
    }

    if (process.env.LOG_JSON === 'true') {
      console.log(JSON.stringify({ timestamp, level, context, message, ...(metadata && { metadata }) }));
    }
  }

  private getLevelStyle(level: LogLevel): { color: string; icon: string } {
    switch (level) {
      case LogLevel.ERROR:
        return { color: this.c.red, icon: '✖' };
      case LogLevel.WARN:
        return { color: this.c.yellow, icon: '⚠' };
      case LogLevel.DEBUG:
        return { color: this.c.dim, icon: '🔍' };
      default:
        return { color: this.c.green, icon: '✓' };
    }
  }
}
