import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerModule } from './common/logger/logger.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RedisModule } from './infra/redis/redis.module';
import { RabbitMQModule } from './infra/rabbitmq/rabbitmq.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { SessionModule } from './models/session/session.module';
import { SeatModule } from './models/seat/seat.module';
import { ReservationModule } from './models/reservation/reservation.module';
import { PaymentModule } from './models/payment/payment.module';
import { SaleModule } from './models/sale/sale.module';
import { EventsModule } from './events/events.module';

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
    SaleModule,
    EventsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
