import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { LoggerService } from '../../common/logger/logger.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('RedisService');
  }
  onModuleInit() {
    this.client = new Redis({
      host: process.env.REDIS_HOST ?? 'redis',
      port: Number(process.env.REDIS_PORT) || 6379,
    });
    this.client.on('connect', () => this.logger.log('Conectado ao Redis'));
    this.client.on('error', (err) => this.logger.error('Erro Redis', err.message));
  }
  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('Desconectado do Redis');
  }
  /**
   * Tenta adquirir lock atômico.
   * SET NX PX → só seta se a chave NÃO existe. Retorna true se conseguiu o lock.
   */
  async acquireLock(seatId: string, ttlMs = 30_000): Promise<boolean> {
    const key = `seat:${seatId}`;
    const result = await this.client.set(key, '1', 'EX', Math.ceil(ttlMs / 1000), 'NX');
    return result === 'OK';
  }
  /**
   * Libera o lock manualmente (após pagamento confirmado ou cancelamento).
   */
  async releaseLock(seatId: string): Promise<void> {
    const key = `seat:${seatId}`;
    await this.client.del(key);
  }
  /**
   * Verifica se o assento está travado (lock ativo).
   */
  async isLocked(seatId: string): Promise<boolean> {
    const key = `seat:${seatId}`;
    const exists = await this.client.exists(key);
    return exists === 1;
  }
}