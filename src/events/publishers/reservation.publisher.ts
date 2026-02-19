import { Injectable } from '@nestjs/common';
import { RabbitMQService } from '../../infra/rabbitmq/rabbitmq.service';
import { LoggerService } from '../../common/logger/logger.service';

export interface ReservationCreatedEvent {
  event: 'reservation.created';
  reservationId: string;
  seatId: string;
  userId: string;
  expiresAt: string;
}

@Injectable()
export class ReservationPublisher {
  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('ReservationPublisher');
  }

  publishCreated(data: Omit<ReservationCreatedEvent, 'event'>): void {
    this.rabbitmq.publish('reservations', {
      event: 'reservation.created',
      ...data,
    });
  }
}