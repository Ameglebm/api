import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { RabbitMQModule } from '../../infra/rabbitmq/rabbitmq.module';
import { RedisModule } from '../../infra/redis/redis.module';
import { SeatModule } from '../seat/seat.module';
import { ReservationController } from './controller/reservation.controller';
import { ReservationRepository } from './repository/reservation.repository';
import { ReservationService } from './service/reservation.service';
import {
  RESERVATION_REPOSITORY,
  RESERVATION_SERVICE,
} from './reservation.constants';

@Module({
  imports: [PrismaModule, RedisModule, RabbitMQModule, SeatModule],
  controllers: [ReservationController],
  providers: [
    {
      provide: RESERVATION_SERVICE,
      useClass: ReservationService,
    },
    {
      provide: RESERVATION_REPOSITORY,
      useClass: ReservationRepository,
    },
  ],
  exports: [RESERVATION_SERVICE, RESERVATION_REPOSITORY],
})
export class ReservationModule {}
