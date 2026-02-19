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
    const req = context.switchToHttp().getRequest();
    const method = req.method;
    const url = req.url;
    const start = Date.now();
    return next.handle().pipe(
      tap((body) => {
        const ms = Date.now() - start;
        const statusCode = context.switchToHttp().getResponse().statusCode;
        const meta: Record<string, any> = { statusCode, ms: `${ms}ms` };
        if (Array.isArray(body)) {
          meta.total = body.length;
        } else if (body?.id) {
          meta.id = body.id;
        }
        this.logger.log(`${method} ${url}`, meta);
      }),
    );
  }
}
