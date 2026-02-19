import { Injectable, Scope, LoggerService as NestLoggerService } from '@nestjs/common';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO  = 'INFO',
  WARN  = 'WARN',
  ERROR = 'ERROR',
}

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  private context?: string;

  private readonly c = {
    reset:    '\x1b[0m',
    bold:     '\x1b[1m',
    dim:      '\x1b[2m',
    // Foreground
    red:      '\x1b[31m',
    green:    '\x1b[32m',
    yellow:   '\x1b[33m',
    blue:     '\x1b[34m',
    magenta:  '\x1b[35m',
    cyan:     '\x1b[36m',
    // Bright foreground
    bRed:     '\x1b[91m',
    bGreen:   '\x1b[92m',
    bYellow:  '\x1b[93m',
    bBlue:    '\x1b[94m',
    bMagenta: '\x1b[95m',
    bCyan:    '\x1b[96m',
    // Neutro (substitui branco)
    gray:     '\x1b[38;5;245m',
    silver:   '\x1b[38;5;250m',
  };

  private readonly contextThemes: Record<string, { badge: string; color: string }> = {
    // Infra
    RedisService:          { badge: '🟢', color: this.c.bGreen },   // verde = conectado/online
    RabbitMQService:       { badge: '🐇', color: this.c.magenta },
    PrismaService:         { badge: '🗄️', color: this.c.bBlue },    // banco/storage
    // Domínio
    SessionService:        { badge: '🎬', color: this.c.green },
    SessionRepository:     { badge: '🎬', color: this.c.green },
    SeatService:           { badge: '🪑', color: this.c.cyan },      // cadeira mais clara
    SeatRepository:        { badge: '🪑', color: this.c.cyan },
    ReservationService:    { badge: '🗒️', color: this.c.bMagenta }, // bloco de notas/reserva — diferente do pagamento
    ReservationRepository: { badge: '🗒️', color: this.c.bMagenta },
    PaymentService:        { badge: '💳', color: this.c.yellow },
    SaleService:           { badge: '🧾', color: this.c.bGreen },
    SaleRepository:        { badge: '🧾', color: this.c.bGreen },
    // Events — 📡 publisher (emite), 📻 consumer (recebe)
    ReservationPublisher:  { badge: '🗒️ 📡', color: this.c.bMagenta },
    ReservationConsumer:   { badge: '🗒️ 📻', color: this.c.bMagenta },
    PaymentPublisher:      { badge: '💳 📡', color: this.c.bYellow },
    PaymentConsumer:       { badge: '💳 📻', color: this.c.bYellow },
  };

  setContext(context: string) {
    this.context = context;
  }

  log(message: string, metadata?: Record<string, any>) {
    this.writeLog(LogLevel.INFO, message, metadata);
  }

  error(message: string, trace?: string, metadata?: Record<string, any>) {
    this.writeLog(LogLevel.ERROR, message, { ...metadata, ...(trace && { trace }) });
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

  private writeLog(level: LogLevel, message: string, metadata?: Record<string, any>) {
    const { c } = this;
    const context   = this.context ?? 'App';
    const theme     = this.contextThemes[context] ?? { badge: '◈', color: c.gray };
    const levelCfg  = this.getLevelStyle(level);

    // Timestamp: apenas HH:MM:SS
    const time = new Date().toISOString().split('T')[1].slice(0, 8);

    // Largura fixa para o badge de nível (5 chars)
    const lvlLabel = level.padEnd(5);

    // Linha principal — formato original com colchetes, tudo em negrito
    // ex: 08:14:01 ✓ INFO  🐇 [RabbitMQService] Fila declarada: reservations
    const line = [
      `${c.dim}${time}${c.reset}`,
      `${c.bold}${levelCfg.color}${levelCfg.icon} ${lvlLabel}${c.reset}`,
      `${c.bold}${theme.color}${theme.badge} [${context}]${c.reset}`,
      `${c.bold}${c.bCyan}${message}${c.reset}`,
    ].join(' ');

    // Metadata — negrito + branco puro, bem legível
    const metaLine = metadata && Object.keys(metadata).length > 0
      ? `\n${c.bold}\x1b[97m${JSON.stringify(metadata, null, 2)
          .split('\n')
          .map(l => `         ${l}`)
          .join('\n')}${c.reset}`
      : '';

    const output = `${line}${metaLine}`;

    switch (level) {
      case LogLevel.ERROR: console.error(output); break;
      case LogLevel.WARN:  console.warn(output);  break;
      case LogLevel.DEBUG: console.debug(output); break;
      default:             console.log(output);
    }

    if (process.env.LOG_JSON === 'true') {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        context,
        message,
        ...(metadata && Object.keys(metadata).length > 0 && { metadata }),
      }));
    }
  }

  private getLevelStyle(level: LogLevel): { color: string; icon: string } {
    const { c } = this;
    switch (level) {
      case LogLevel.ERROR: return { color: c.bRed,    icon: '✖' };
      case LogLevel.WARN:  return { color: c.bYellow, icon: '⚠' };
      case LogLevel.DEBUG: return { color: c.dim,     icon: '·' };
      default:             return { color: c.bGreen,  icon: '✓' };
    }
  }
}