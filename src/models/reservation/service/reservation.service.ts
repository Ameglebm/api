import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RabbitMQService } from '../../../infra/rabbitmq/rabbitmq.service';
import { RedisService } from '../../../infra/redis/redis.service';
import { SeatRepository } from '../../seat/repository/seat.repository';
import { SEAT_REPOSITORY } from '../../seat/seat.constants';
import { ReservationStatus } from '../../../common/enums/reservation-status.enum';
import { CreateReservationDto } from '../dtos/create-reservation.dto';
import { ResponseReservationDto } from '../dtos/response-reservation.dto';
import { IReservationRepository } from '../interface/reservation.repository.interface';
import { IReservationService } from '../interface/reservation.service.interface';
import { RESERVATION_REPOSITORY } from '../reservation.constants';

const RESERVATION_TTL_MS = 30_000;

@Injectable()
export class ReservationService implements IReservationService {
  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservationRepository: IReservationRepository,
    @Inject(SEAT_REPOSITORY)
    private readonly seatRepository: SeatRepository,
    private readonly redisService: RedisService,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  // Criar reserva com lock Redis
  async create(dto: CreateReservationDto): Promise<ResponseReservationDto> {
    const seat = await this.seatRepository.findById(dto.seatId);
    if (!seat) {
      throw new NotFoundException('Assento não encontrado');
    }
    // Tenta adquirir lock atômico no Redis — SET NX EX 30
    const locked = await this.redisService.acquireLock(
      dto.seatId,
      RESERVATION_TTL_MS,
    );
    if (!locked) {
      throw new ConflictException(
        'Assento já está sendo reservado por outro usuário',
      );
    }
    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS);
    const reservation = await this.reservationRepository.create(dto, expiresAt);

    // Publica evento no RabbitMQ
    await this.rabbitMQService.publish('reservations', {
      event: 'reservation.created',
      reservationId: reservation.id,
      seatId: dto.seatId,
      userId: dto.userId,
      expiresAt,
    });
    return this.toResponse(reservation);
  }

  // Buscar reserva por ID
  async findById(id: string): Promise<ResponseReservationDto> {
    const reservation = await this.reservationRepository.findById(id);
    if (!reservation) {
      throw new NotFoundException('Reserva não encontrada');
    }
    return this.toResponse(reservation);
  }

  // Buscar reservas por usuário
  async findByUserId(userId: string): Promise<ResponseReservationDto[]> {
    const reservations = await this.reservationRepository.findByUserId(userId);
    return reservations.map((r) => this.toResponse(r));
  }

  // Serializa Prisma → DTO
  private toResponse(reservation: any): ResponseReservationDto {
    const dto = new ResponseReservationDto();
    dto.id = reservation.id;
    dto.seatId = reservation.seatId;
    dto.userId = reservation.userId;
    dto.status = reservation.status as ReservationStatus;
    dto.expiresAt = reservation.expiresAt;
    dto.createdAt = reservation.createdAt;
    return dto;
  }
}
