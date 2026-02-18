import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { RedisModule } from '../../infra/redis/redis.module';
import { SessionModule } from '../session/session.module';
import { SeatController } from './controller/seat.controller';
import { SeatRepository } from './repository/seat.repository';
import { SeatService } from './service/seat.service';
import { SEAT_REPOSITORY, SEAT_SERVICE } from './seat.constants';

@Module({
  imports: [PrismaModule, RedisModule, SessionModule],
  controllers: [SeatController],
  providers: [
    {
      provide: SEAT_SERVICE,
      useClass: SeatService,
    },
    {
      provide: SEAT_REPOSITORY,
      useClass: SeatRepository,
    },
  ],
  exports: [SEAT_SERVICE, SEAT_REPOSITORY],
})
export class SeatModule {}
