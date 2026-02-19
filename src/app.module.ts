import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerModule } from './common/logger/logger.module';
import { RedisModule } from './infra/redis/redis.module';
import { RabbitMQModule } from './infra/rabbitmq/rabbitmq.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { SessionModule } from './models/session/session.module';
import { SeatModule } from './models/seat/seat.module';
import { ReservationModule } from './models/reservation/reservation.module';
import { PaymentModule } from './models/payment/payment.module';

@Module({
  imports: [
    LoggerModule,
    RedisModule,
    RabbitMQModule,
    PrismaModule,
    SessionModule,
    SeatModule,
    ReservationModule,
    PaymentModule,
  ], // ← aqui vai entrar PrismaModule, RedisModule, etc.
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
