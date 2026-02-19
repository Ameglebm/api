import { Injectable } from '@nestjs/common';
import { RabbitMQService } from '../../infra/rabbitmq/rabbitmq.service';
import { LoggerService } from '../../common/logger/logger.service';

export interface PaymentConfirmedEvent {
  event: 'payment.confirmed';
  data: {
    saleId: string;
    seatId: string;
    userId: string;
    reservationId: string;
  };
}

@Injectable()
export class PaymentPublisher {
  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('PaymentPublisher');
  }

  publishConfirmed(data: PaymentConfirmedEvent['data']): void {
    this.rabbitmq.publish('payments', {
      event: 'payment.confirmed',
      data,
    });
  }
}