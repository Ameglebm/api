import { Module } from '@nestjs/common';
import { RabbitMQModule } from '../infra/rabbitmq/rabbitmq.module';
import { ReservationModule } from '../models/reservation/reservation.module';
import { SeatModule } from '../models/seat/seat.module';
import { ReservationPublisher } from './publishers/reservation.publisher';
import { PaymentPublisher } from './publishers/payment.publisher';
import { ReservationConsumer } from './consumers/reservation.consumer';
import { PaymentConsumer } from './consumers/payment.consumer';

@Module({
  imports: [RabbitMQModule, ReservationModule, SeatModule],
  providers: [
    ReservationPublisher,
    PaymentPublisher,
    ReservationConsumer,
    PaymentConsumer,
  ],
  exports: [ReservationPublisher, PaymentPublisher],
})
export class EventsModule {}
