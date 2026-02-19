import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ReservationService } from '../../src/models/reservation/service/reservation.service';
import { IReservationRepository } from '../../src/models/reservation/interface/reservation.repository.interface';
import { RESERVATION_REPOSITORY } from '../../src/models/reservation/reservation.constants';
import { SEAT_REPOSITORY } from '../../src/models/seat/seat.constants';
import { RedisService } from '../../src/infra/redis/redis.service';
import { RabbitMQService } from '../../src/infra/rabbitmq/rabbitmq.service';
import { ReservationStatus } from '../../src/common/enums/reservation-status.enum';
import { SeatStatus } from '../../src/common/enums/seat-status.enum';

// ─── Dados fake ──────────────────────────────────────────────────
const mockSeat = {
  id: 'seat-001',
  sessionId: 'session-001',
  seatNumber: 'A1',
  status: SeatStatus.AVAILABLE,
};

const mockReservation = {
  id: 'reservation-001',
  seatId: 'seat-001',
  userId: 'usuario-001',
  status: ReservationStatus.PENDING,
  expiresAt: new Date(Date.now() + 30000),
  createdAt: new Date(),
};

const mockCreateDto = {
  seatId: 'seat-001',
  userId: 'usuario-001',
};

// ─── Mocks ───────────────────────────────────────────────────────
const mockReservationRepository: Partial<IReservationRepository> = {
  create: jest.fn().mockResolvedValue(mockReservation),
  findById: jest.fn().mockResolvedValue(mockReservation),
  findByUserId: jest.fn().mockResolvedValue([mockReservation]),
};

const mockSeatRepository = {
  findById: jest.fn().mockResolvedValue(mockSeat),
};

const mockRedisService = {
  acquireLock: jest.fn().mockResolvedValue(true),
};

const mockRabbitMQService = {
  publish: jest.fn(),
};

describe('ReservationService', () => {
  let service: ReservationService;
  let reservationRepo: IReservationRepository;
  let seatRepo: typeof mockSeatRepository;
  let redis: typeof mockRedisService;
  let rabbitmq: typeof mockRabbitMQService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationService,
        { provide: RESERVATION_REPOSITORY, useValue: mockReservationRepository },
        { provide: SEAT_REPOSITORY, useValue: mockSeatRepository },
        { provide: RedisService, useValue: mockRedisService },
        { provide: RabbitMQService, useValue: mockRabbitMQService },
      ],
    }).compile();

    service = module.get<ReservationService>(ReservationService);
    reservationRepo = module.get<IReservationRepository>(RESERVATION_REPOSITORY);
    seatRepo = module.get(SEAT_REPOSITORY);
    redis = module.get(RedisService);
    rabbitmq = module.get(RabbitMQService);

    jest.clearAllMocks();
  });

  // ─── Testes do create ──────────────────────────────────────────
  describe('create', () => {
    it('deve criar reserva com sucesso quando assento existe e lock é adquirido', async () => {
      const result = await service.create(mockCreateDto);

      expect(result.id).toBe('reservation-001');
      expect(result.seatId).toBe('seat-001');
      expect(result.userId).toBe('usuario-001');
      expect(result.status).toBe(ReservationStatus.PENDING);
    });

    it('deve adquirir lock no Redis antes de criar', async () => {
      await service.create(mockCreateDto);

      expect(redis.acquireLock).toHaveBeenCalledTimes(1);
      expect(redis.acquireLock).toHaveBeenCalledWith('seat-001', 30000);
    });

    it('deve publicar evento reservation.created no RabbitMQ', async () => {
      await service.create(mockCreateDto);

      expect(rabbitmq.publish).toHaveBeenCalledTimes(1);
      expect(rabbitmq.publish).toHaveBeenCalledWith(
        'reservations',
        expect.objectContaining({
          event: 'reservation.created',
          reservationId: 'reservation-001',
          seatId: 'seat-001',
          userId: 'usuario-001',
        }),
      );
    });

    it('deve lançar NotFoundException quando assento não existe', async () => {
      (seatRepo.findById as jest.Mock).mockResolvedValueOnce(null);

      await expect(service.create(mockCreateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('não deve tentar lock se assento não existe', async () => {
      (seatRepo.findById as jest.Mock).mockResolvedValueOnce(null);

      try {
        await service.create(mockCreateDto);
      } catch {}

      expect(redis.acquireLock).not.toHaveBeenCalled();
    });

    it('deve lançar ConflictException quando lock falha (assento já reservado)', async () => {
      (redis.acquireLock as jest.Mock).mockResolvedValueOnce(false);

      await expect(service.create(mockCreateDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('não deve criar reserva no banco se lock falhou', async () => {
      (redis.acquireLock as jest.Mock).mockResolvedValueOnce(false);

      try {
        await service.create(mockCreateDto);
      } catch {}

      expect(reservationRepo.create).not.toHaveBeenCalled();
    });

    it('não deve publicar evento se lock falhou', async () => {
      (redis.acquireLock as jest.Mock).mockResolvedValueOnce(false);

      try {
        await service.create(mockCreateDto);
      } catch {}

      expect(rabbitmq.publish).not.toHaveBeenCalled();
    });
  });

  // ─── Testes do findById ────────────────────────────────────────
  describe('findById', () => {
    it('deve retornar reserva quando existe', async () => {
      const result = await service.findById('reservation-001');

      expect(result.id).toBe('reservation-001');
      expect(result.status).toBe(ReservationStatus.PENDING);
    });

    it('deve lançar NotFoundException quando reserva não existe', async () => {
      (reservationRepo.findById as jest.Mock).mockResolvedValueOnce(null);

      await expect(service.findById('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── Testes do findByUserId ────────────────────────────────────
  describe('findByUserId', () => {
    it('deve retornar reservas do usuário', async () => {
      const result = await service.findByUserId('usuario-001');

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('usuario-001');
    });

    it('deve retornar array vazio quando usuário não tem reservas', async () => {
      (reservationRepo.findByUserId as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.findByUserId('usuario-sem-reserva');

      expect(result).toHaveLength(0);
    });
  });
});
// Esse é o mais importante — testa o fluxo de concorrência

