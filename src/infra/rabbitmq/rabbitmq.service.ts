import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqplib from 'amqplib';
import { LoggerService } from '../../common/logger/logger.service';
export type QueueName = 'reservations' | 'payments' | 'expirations';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: amqplib.Connection;
  private channel: amqplib.Channel;
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('RabbitMQService');
  }
  async onModuleInit() {
    const url = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@rabbitmq:5672';
    this.connection = await amqplib.connect(url);
    this.channel = await this.connection.createChannel();
    // Garante que as filas existem antes de publicar ou consumir
    const queues: QueueName[] = ['reservations', 'payments', 'expirations'];
    for (const queue of queues) {
      await this.channel.assertQueue(queue, {
        durable: true,      // fila sobrevive ao restart do RabbitMQ
        arguments: {
          'x-dead-letter-exchange': `${queue}.dlq`, // DLQ automática
        },
      });
      this.logger.log(`Fila declarada: ${queue}`);
    }
    this.logger.log('Conectado ao RabbitMQ');
  }
  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
    this.logger.log('Desconectado do RabbitMQ');
  }
  /**
   * Publica uma mensagem em uma fila.
   * persistent: true → mensagem sobrevive ao restart do broker.
   */
  publish<T>(queue: QueueName, payload: T): void {
    const content = Buffer.from(JSON.stringify(payload));
    this.channel.sendToQueue(queue, content, { persistent: true });
    this.logger.log(`Evento publicado em [${queue}]`, { payload });
  }
  /**
   * Registra um consumer para uma fila.
   * prefetch(1) → processa 1 mensagem por vez, sem sobrecarregar.
   */
  async consume<T>(
    queue: QueueName,
    handler: (payload: T) => Promise<void>,
  ): Promise<void> {
    await this.channel.prefetch(1);
    await this.channel.consume(queue, async (msg) => {
      if (!msg) return;
      try {
        const payload: T = JSON.parse(msg.content.toString());
        await handler(payload);
        this.channel.ack(msg); // confirma processamento
      } catch (error) {
        this.logger.error(`Falha ao processar mensagem em [${queue}]`, error.message);
        this.channel.nack(msg, false, false); // envia para DLQ (não recoloca na fila)
      }
    });
    this.logger.log(`Consumer registrado em [${queue}]`);
  }
}