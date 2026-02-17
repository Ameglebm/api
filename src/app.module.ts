import { Module } from '@nestjs/common';
import { AppController } from './app.controller'; // ← FALTOU IMPORTAR
import { AppService } from './app.service';
import { LoggerModule } from './common/logger/logger.module';

@Module({
  imports: [
    LoggerModule,
  ],            // ← aqui vai entrar PrismaModule, RedisModule, etc.
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}