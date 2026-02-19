import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../logger/logger.service';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('HttpExceptionFilter');
  }

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx    = host.switchToHttp();
    const res    = ctx.getResponse<Response>();
    const req    = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const body   = exception.getResponse();
    const message =
      typeof body === 'object' && 'message' in body
        ? (body as any).message
        : body;

    // 4xx → warn, 5xx → error
    if (status >= 500) {
      this.logger.error(`${req.method} ${req.url} → ${status}`, undefined, {
        message,
        statusCode: status,
      });
    } else {
      this.logger.warn(`${req.method} ${req.url} → ${status}`, {
        message,
        statusCode: status,
      });
    }

    res.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: req.url,
      message,
    });
  }
}