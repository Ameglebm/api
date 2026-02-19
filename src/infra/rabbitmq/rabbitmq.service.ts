import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqplib from 'amqplib';
import { LoggerService } from '../../common/logger/logger.service';

export type QueueName = 'reservations' | 'payments' | 'expirations';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: amqplib.ChannelModel;
  private channel: amqplib.Channel;
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('RabbitMQService');
  }

  async onModuleInit(): Promise<void> {
    const url = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@rabbitmq:5672';
    this.connection = await amqplib.connect(url);
    this.channel = await this.connection.createChannel();
    const queues: QueueName[] = ['reservations', 'payments', 'expirations'];
    for (const queue of queues) {
      await this.channel.assertQueue(queue, {
        durable: true,
        arguments: { 'x-dead-letter-exchange': `${queue}.dlq` },
      });
      this.logger.log(`Fila declarada: ${queue}`);
    }
    this.logger.log('Conectado ao RabbitMQ');
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
    this.logger.log('Desconectado do RabbitMQ');
  }

  publish<T>(queue: QueueName, payload: T): void {
    const content = Buffer.from(JSON.stringify(payload));
    this.channel.sendToQueue(queue, content, { persistent: true });
    this.logger.log(`Evento publicado em [${queue}]`, { payload });
  }

  async consume<T>(
    queue: QueueName,
    handler: (payload: T) => void | Promise<void>,
  ): Promise<void> {
    await this.channel.prefetch(1);
    await this.channel.consume(queue, (msg) => {
      if (!msg) return;
      Promise.resolve()
        .then(async () => {
          const payload = JSON.parse(msg.content.toString()) as T;
          await Promise.resolve(handler(payload));
          this.channel.ack(msg);
        })
        .catch((error: Error) => {
          this.logger.error(
            `Falha ao processar mensagem em [${queue}]`,
            error.message,
          );
          this.channel.nack(msg, false, false);
        });
    });
    this.logger.log(`Consumer registrado em [${queue}]`);
  }
}
