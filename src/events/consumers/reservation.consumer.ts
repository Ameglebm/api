import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../../infra/rabbitmq/rabbitmq.service';
import { LoggerService } from '../../common/logger/logger.service';
import { IReservationRepository } from '../../models/reservation/interface/reservation.repository.interface';
import { ISeatRepository } from '../../models/seat/interface/seat.repository.interface';
import { RESERVATION_REPOSITORY } from '../../models/reservation/reservation.constants';
import { SEAT_REPOSITORY } from '../../models/seat/seat.constants';
import { ReservationStatus } from '../../common/enums/reservation-status.enum';
import { SeatStatus } from '../../common/enums/seat-status.enum';
import { ReservationCreatedEvent } from '../publishers/reservation.publisher';

@Injectable()
export class ReservationConsumer implements OnModuleInit {
  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly logger: LoggerService,
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepo: IReservationRepository,
    @Inject(SEAT_REPOSITORY)
    private readonly seatRepo: ISeatRepository,
  ) {
    this.logger.setContext('ReservationConsumer');
  }

  async onModuleInit() {
    await this.rabbitmq.consume<ReservationCreatedEvent>(
      'reservations',
      async (payload) => {
        this.logger.log('Evento recebido: reservation.created', {
          reservationId: payload.reservationId,
        });
        // Calcula quanto tempo falta pra expirar
        const now = Date.now();
        const expiresAt = new Date(payload.expiresAt).getTime();
        const delay = Math.max(expiresAt - now, 0);
        // Espera o tempo restante
        await this.sleep(delay);
        // Checa se ainda tá PENDING
        const reservation = await this.reservationRepo.findById(
          payload.reservationId,
        );
        if (!reservation) {
          this.logger.warn('Reserva não encontrada ao tentar expirar', {
            reservationId: payload.reservationId,
          });
          return;
        }
        if (reservation.status !== ReservationStatus.PENDING) {
          this.logger.log('Reserva já processada, ignorando', {
            reservationId: payload.reservationId,
            status: reservation.status,
          });
          return;
        }

        // Expira reserva
        await this.reservationRepo.expire(payload.reservationId);
        // Libera assento
        await this.seatRepo.updateStatus(payload.seatId, SeatStatus.AVAILABLE);

        // Publica evento de expiração
        this.rabbitmq.publish('expirations', {
          event: 'reservation.expired',
          reservationId: payload.reservationId,
          seatId: payload.seatId,
          userId: payload.userId,
        });
        this.logger.log('Reserva expirada automaticamente', {
          reservationId: payload.reservationId,
          seatId: payload.seatId,
        });
      },
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
