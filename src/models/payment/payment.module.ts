import { Module } from '@nestjs/common';
import { PaymentController } from './controller/payment.controller';
import { PaymentService } from './service/payment.service';
import { PAYMENT_SERVICE } from './payment.constants';
import { ReservationModule } from '../reservation/reservation.module';
import { SeatModule } from '../seat/seat.module';

@Module({
  imports: [ReservationModule, SeatModule],
  controllers: [PaymentController],
  providers: [
    {
      provide: PAYMENT_SERVICE,
      useClass: PaymentService,
    },
  ],
})
export class PaymentModule {}
