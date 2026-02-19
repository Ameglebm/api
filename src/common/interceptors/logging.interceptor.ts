import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req    = context.switchToHttp().getRequest();
    const method = req.method;
    const url    = req.url;
    const start  = Date.now();
    return next.handle().pipe(
      tap((body) => {
        const ms         = Date.now() - start;
        const statusCode = context.switchToHttp().getResponse().statusCode;
        // Não loga body de listagens grandes — só o status e tempo
        const meta: Record<string, any> = { statusCode, ms: `${ms}ms` };
        // Inclui body apenas se for pequeno (criações, buscas por ID)
        if (body && !Array.isArray(body)) {
          meta.body = body;
        } else if (Array.isArray(body)) {
          meta.total = body.length;
        }
        this.logger.log(`${method} ${url}`, meta);
      }),
    );
  }
}