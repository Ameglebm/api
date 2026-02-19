import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  GoneException,
} from '@nestjs/common';
import { IPaymentService } from '../interface/payment.service.interface';
import { IReservationRepository } from '../../reservation/interface/reservation.repository.interface';
import { ISeatRepository } from '../../seat/interface/seat.repository.interface';
import { RESERVATION_REPOSITORY } from '../../reservation/reservation.constants';
import { SEAT_REPOSITORY } from '../../seat/seat.constants';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { RedisService } from '../../../infra/redis/redis.service';
import { RabbitMQService } from '../../../infra/rabbitmq/rabbitmq.service';
import { LoggerService } from '../../../common/logger/logger.service';
import { ReservationStatus } from '../../../common/enums/reservation-status.enum';
import { SeatStatus } from '../../../common/enums/seat-status.enum';
import { ResponsePaymentDto } from '../dtos/response-payment.dto';

@Injectable()
export class PaymentService implements IPaymentService {
  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepo: IReservationRepository,
    @Inject(SEAT_REPOSITORY)
    private readonly seatRepo: ISeatRepository,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rabbitmq: RabbitMQService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('PaymentService');
  }

  async confirm(reservationId: string): Promise<ResponsePaymentDto> {
    // 1. Buscar reserva
    const reservation = await this.reservationRepo.findById(reservationId);
    if (!reservation) {
      throw new NotFoundException('Reserva não encontrada');
    }
    // 2. Já confirmada?
    if (reservation.status === ReservationStatus.CONFIRMED) {
      throw new ConflictException('Reserva já foi confirmada');
    }
    // 3. Expirou?
    if (new Date() > reservation.expiresAt) {
      this.logger.warn('Tentativa de confirmar reserva expirada', {
        reservationId,
      });
      throw new GoneException('Reserva expirada');
    }

    // 4. Defesa em profundidade — seat já vendido por outro caminho?
    const seat = await this.seatRepo.findById(reservation.seatId);
    if (!seat || seat.status === SeatStatus.SOLD) {
      throw new ConflictException('Assento já foi vendido');
    }
    // 5. Transaction atômica — tudo ou nada
    const sale = await this.prisma.$transaction(async (tx) => {
      // 5a. Reservation → CONFIRMED
      await tx.reservation.update({
        where: { id: reservationId },
        data: { status: ReservationStatus.CONFIRMED },
      });
      // 5b. Seat → SOLD
      await tx.seat.update({
        where: { id: reservation.seatId },
        data: { status: SeatStatus.SOLD },
      });
      // 5c. Cria Sale — registro permanente
      return tx.sale.create({
        data: {
          reservationId,
          seatId: reservation.seatId,
          userId: reservation.userId,
          paidAt: new Date(),
        },
      });
    });
    // 6. Remove lock Redis — fora da transaction
    //    Se falhar, expira sozinho em 30s — sem dano
    try {
      await this.redis.releaseLock(reservation.seatId);
    } catch (error) {
      this.logger.warn('Falha ao remover lock Redis — expira sozinho', {
        seatId: reservation.seatId,
      });
    }
    // 7. Publica evento — fora da transaction
    //    Se falhar, a venda já está no banco — DLQ reprocessa
    try {
      await this.rabbitmq.publish('payments', {
        event: 'payment.confirmed',
        data: {
          saleId: sale.id,
          seatId: sale.seatId,
          userId: sale.userId,
          reservationId,
        },
      });
    } catch (error) {
      this.logger.warn('Falha ao publicar evento payment.confirmed', {
        saleId: sale.id,
      });
    }
    // Se o pagamento for OK!
    this.logger.log('Pagamento confirmado com sucesso', {
      saleId: sale.id,
      reservationId,
      seatId: sale.seatId,
      userId: sale.userId,
    });

    return {
      id: sale.id,
      reservationId: sale.reservationId,
      seatId: sale.seatId,
      userId: sale.userId,
      paidAt: sale.paidAt,
    };
  }
}
