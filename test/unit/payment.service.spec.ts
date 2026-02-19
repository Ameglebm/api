import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  GoneException,
} from '@nestjs/common';
import { PaymentService } from '../../src/models/payment/service/payment.service';
import { IReservationRepository } from '../../src/models/reservation/interface/reservation.repository.interface';
import { ISeatRepository } from '../../src/models/seat/interface/seat.repository.interface';
import { RESERVATION_REPOSITORY } from '../../src/models/reservation/reservation.constants';
import { SEAT_REPOSITORY } from '../../src/models/seat/seat.constants';
import { PrismaService } from '../../src/infra/prisma/prisma.service';
import { RedisService } from '../../src/infra/redis/redis.service';
import { RabbitMQService } from '../../src/infra/rabbitmq/rabbitmq.service';
import { LoggerService } from '../../src/common/logger/logger.service';
import { ReservationStatus } from '../../src/common/enums/reservation-status.enum';
import { SeatStatus } from '../../src/common/enums/seat-status.enum';

// ─── Dados fake ──────────────────────────────────────────────────
const mockReservation = {
  id: 'reservation-001',
  seatId: 'seat-001',
  userId: 'usuario-001',
  status: ReservationStatus.PENDING,
  expiresAt: new Date(Date.now() + 30000), // 30s no futuro — válida
  createdAt: new Date(),
};

const mockSeat = {
  id: 'seat-001',
  sessionId: 'session-001',
  seatNumber: 'A1',
  status: SeatStatus.AVAILABLE,
};

const mockSale = {
  id: 'sale-001',
  reservationId: 'reservation-001',
  seatId: 'seat-001',
  userId: 'usuario-001',
  paidAt: new Date(),
};

// ─── Mocks ───────────────────────────────────────────────────────
const mockReservationRepo: Partial<IReservationRepository> = {
  findById: jest.fn().mockResolvedValue(mockReservation),
};

const mockSeatRepo: Partial<ISeatRepository> = {
  findById: jest.fn().mockResolvedValue(mockSeat),
};

// Mock do Prisma.$transaction — executa o callback com um tx fake
const mockTx = {
  reservation: { update: jest.fn().mockResolvedValue(mockReservation) },
  seat: { update: jest.fn().mockResolvedValue(mockSeat) },
  sale: { create: jest.fn().mockResolvedValue(mockSale) },
};

const mockPrisma = {
  $transaction: jest.fn().mockImplementation(async (callback) => {
    return callback(mockTx);
  }),
};

const mockRedis = {
  releaseLock: jest.fn().mockResolvedValue(true),
};

const mockRabbitMQ = {
  publish: jest.fn(),
};

const mockLogger = {
  setContext: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('PaymentService', () => {
  let service: PaymentService;
  let reservationRepo: IReservationRepository;
  let seatRepo: ISeatRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: RESERVATION_REPOSITORY, useValue: mockReservationRepo },
        { provide: SEAT_REPOSITORY, useValue: mockSeatRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: RabbitMQService, useValue: mockRabbitMQ },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    reservationRepo = module.get<IReservationRepository>(RESERVATION_REPOSITORY);
    seatRepo = module.get<ISeatRepository>(SEAT_REPOSITORY);

    jest.clearAllMocks();
  });

  // ─── Validação 1: Reserva não existe → 404 ────────────────────
  describe('validação: reserva não existe', () => {
    it('deve lançar NotFoundException quando reserva não existe', async () => {
      (reservationRepo.findById as jest.Mock).mockResolvedValueOnce(null);

      await expect(service.confirm('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('não deve iniciar transaction se reserva não existe', async () => {
      (reservationRepo.findById as jest.Mock).mockResolvedValueOnce(null);

      try { await service.confirm('id-inexistente'); } catch {}

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ─── Validação 2: Reserva já confirmada → 409 ─────────────────
  describe('validação: reserva já confirmada', () => {
    it('deve lançar ConflictException quando reserva já foi confirmada', async () => {
      (reservationRepo.findById as jest.Mock).mockResolvedValueOnce({
        ...mockReservation,
        status: ReservationStatus.CONFIRMED,
      });

      await expect(service.confirm('reservation-001')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─── Validação 3: Reserva expirada → 410 ──────────────────────
  describe('validação: reserva expirada', () => {
    it('deve lançar GoneException quando reserva expirou', async () => {
      (reservationRepo.findById as jest.Mock).mockResolvedValueOnce({
        ...mockReservation,
        expiresAt: new Date(Date.now() - 1000), // 1s no passado — expirada
      });

      await expect(service.confirm('reservation-001')).rejects.toThrow(
        GoneException,
      );
    });

    it('deve logar warn quando reserva expirou', async () => {
      (reservationRepo.findById as jest.Mock).mockResolvedValueOnce({
        ...mockReservation,
        expiresAt: new Date(Date.now() - 1000),
      });

      try { await service.confirm('reservation-001'); } catch {}

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Tentativa de confirmar reserva expirada',
        expect.objectContaining({ reservationId: 'reservation-001' }),
      );
    });
  });

  // ─── Validação 4: Assento já vendido → 409 ────────────────────
  describe('validação: assento já vendido', () => {
    it('deve lançar ConflictException quando assento já está SOLD', async () => {
      (seatRepo.findById as jest.Mock).mockResolvedValueOnce({
        ...mockSeat,
        status: SeatStatus.SOLD,
      });

      await expect(service.confirm('reservation-001')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─── Happy path: pagamento confirmado ──────────────────────────
  describe('confirmação com sucesso', () => {
    it('deve retornar Sale com dados corretos', async () => {
      const result = await service.confirm('reservation-001');

      expect(result.id).toBe('sale-001');
      expect(result.reservationId).toBe('reservation-001');
      expect(result.seatId).toBe('seat-001');
      expect(result.userId).toBe('usuario-001');
    });

    it('deve executar transaction com 3 operações atômicas', async () => {
      await service.confirm('reservation-001');

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.reservation.update).toHaveBeenCalledWith({
        where: { id: 'reservation-001' },
        data: { status: ReservationStatus.CONFIRMED },
      });
      expect(mockTx.seat.update).toHaveBeenCalledWith({
        where: { id: 'seat-001' },
        data: { status: SeatStatus.SOLD },
      });
      expect(mockTx.sale.create).toHaveBeenCalledTimes(1);
    });

    it('deve liberar lock Redis após transaction', async () => {
      await service.confirm('reservation-001');

      expect(mockRedis.releaseLock).toHaveBeenCalledWith('seat-001');
    });

    it('deve publicar evento payment.confirmed no RabbitMQ', async () => {
      await service.confirm('reservation-001');

      expect(mockRabbitMQ.publish).toHaveBeenCalledWith(
        'payments',
        expect.objectContaining({
          event: 'payment.confirmed',
          data: expect.objectContaining({
            saleId: 'sale-001',
            seatId: 'seat-001',
            userId: 'usuario-001',
          }),
        }),
      );
    });

    it('deve logar sucesso com dados da venda', async () => {
      await service.confirm('reservation-001');

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Pagamento confirmado com sucesso',
        expect.objectContaining({
          saleId: 'sale-001',
          reservationId: 'reservation-001',
        }),
      );
    });
  });

  // ─── Resiliência: falha no Redis/RabbitMQ não quebra ───────────
  describe('resiliência pós-transaction', () => {
    it('não deve quebrar se Redis falhar ao liberar lock', async () => {
      (mockRedis.releaseLock as jest.Mock).mockRejectedValueOnce(
        new Error('Redis offline'),
      );

      // Não deve lançar erro — sale já foi criada
      const result = await service.confirm('reservation-001');

      expect(result.id).toBe('sale-001');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Falha ao remover lock Redis — expira sozinho',
        expect.objectContaining({ seatId: 'seat-001' }),
      );
    });

    it('não deve quebrar se RabbitMQ falhar ao publicar', async () => {
      (mockRabbitMQ.publish as jest.Mock).mockRejectedValueOnce(
        new Error('RabbitMQ offline'),
      );

      const result = await service.confirm('reservation-001');

      expect(result.id).toBe('sale-001');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Falha ao publicar evento payment.confirmed',
        expect.objectContaining({ saleId: 'sale-001' }),
      );
    });
  });
});