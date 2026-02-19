import { Injectable, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../../infra/rabbitmq/rabbitmq.service';
import { LoggerService } from '../../common/logger/logger.service';
import { PaymentConfirmedEvent } from '../publishers/payment.publisher';

@Injectable()
export class PaymentConsumer implements OnModuleInit {
  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('PaymentConsumer');
  }

  async onModuleInit() {
    await this.rabbitmq.consume<PaymentConfirmedEvent>(
      'payments',
      async (payload) => {
        this.logger.log('Venda confirmada processada', {
          saleId: payload.data.saleId,
          userId: payload.data.userId,
          seatId: payload.data.seatId,
        });
        // Futuro: enviar email, gerar nota fiscal, atualizar dashboard
      },
    );
  }
}