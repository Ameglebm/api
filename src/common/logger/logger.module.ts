import { Module, Global } from '@nestjs/common';
import { LoggerService } from './logger.service';

@Global() // ← Torna disponível em toda a aplicação
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}