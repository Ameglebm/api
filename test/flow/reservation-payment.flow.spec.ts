import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ReservationService } from '../../src/models/reservation/service/reservation.service';
import { PaymentService } from '../../src/models/payment/service/payment.service';
import { RESERVATION_REPOSITORY } from '../../src/models/reservation/reservation.constants';
import { SEAT_REPOSITORY } from '../../src/models/seat/seat.constants';
import { PrismaService } from '../../src/infra/prisma/prisma.service';
import { RedisService } from '../../src/infra/redis/redis.service';
import { RabbitMQService } from '../../src/infra/rabbitmq/rabbitmq.service';
import { LoggerService } from '../../src/common/logger/logger.service';
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

const mockSale = {
  id: 'sale-001',
  reservationId: 'reservation-001',
  seatId: 'seat-001',
  userId: 'usuario-001',
  paidAt: new Date(),
};

// ─── Mocks ───────────────────────────────────────────────────────
const mockReservationRepo = {
  create: jest.fn().mockResolvedValue(mockReservation),
  findById: jest.fn().mockResolvedValue(mockReservation),
  findByUserId: jest.fn().mockResolvedValue([mockReservation]),
  expire: jest.fn().mockResolvedValue(undefined),
};

const mockSeatRepo = {
  findById: jest.fn().mockResolvedValue(mockSeat),
  updateStatus: jest.fn().mockResolvedValue(mockSeat),
};

const mockTx = {
  reservation: {
    update: jest.fn().mockResolvedValue({
      ...mockReservation,
      status: ReservationStatus.CONFIRMED,
    }),
  },
  seat: {
    update: jest
      .fn()
      .mockResolvedValue({ ...mockSeat, status: SeatStatus.SOLD }),
  },
  sale: { create: jest.fn().mockResolvedValue(mockSale) },
};

const mockPrisma = {
  $transaction: jest.fn().mockImplementation(async (cb) => cb(mockTx)),
};

const mockRedis = {
  acquireLock: jest.fn().mockResolvedValue(true),
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

// ─── Suite ───────────────────────────────────────────────────────
describe('Fluxo: Reserva → Pagamento', () => {
  let reservationService: ReservationService;
  let paymentService: PaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationService,
        PaymentService,
        { provide: RESERVATION_REPOSITORY, useValue: mockReservationRepo },
        { provide: SEAT_REPOSITORY, useValue: mockSeatRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: RabbitMQService, useValue: mockRabbitMQ },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    reservationService = module.get<ReservationService>(ReservationService);
    paymentService = module.get<PaymentService>(PaymentService);

    jest.clearAllMocks();
  });

  // ─── Happy path ───────────────────────────────────────────────
  describe('fluxo completo com sucesso', () => {
    it('deve criar reserva e confirmar pagamento em sequência', async () => {
      // Step 1 — cria reserva
      const reservation = await reservationService.create({
        seatId: 'seat-001',
        userId: 'usuario-001',
      });

      expect(reservation.id).toBe('reservation-001');
      expect(reservation.status).toBe(ReservationStatus.PENDING);

      // Step 2 — confirma pagamento
      const sale = await paymentService.confirm(reservation.id);

      expect(sale.id).toBe('sale-001');
      expect(sale.reservationId).toBe('reservation-001');
      expect(sale.seatId).toBe('seat-001');
    });

    it('deve adquirir lock Redis na reserva e liberar no pagamento', async () => {
      await reservationService.create({
        seatId: 'seat-001',
        userId: 'usuario-001',
      });
      expect(mockRedis.acquireLock).toHaveBeenCalledWith('seat-001', 30000);

      await paymentService.confirm('reservation-001');
      expect(mockRedis.releaseLock).toHaveBeenCalledWith('seat-001');
    });

    it('deve publicar reservation.created e payment.confirmed em sequência', async () => {
      await reservationService.create({
        seatId: 'seat-001',
        userId: 'usuario-001',
      });
      await paymentService.confirm('reservation-001');

      const calls = (mockRabbitMQ.publish as jest.Mock).mock.calls;
      expect(calls[0][0]).toBe('reservations');
      expect(calls[0][1]).toMatchObject({ event: 'reservation.created' });
      expect(calls[1][0]).toBe('payments');
      expect(calls[1][1]).toMatchObject({ event: 'payment.confirmed' });
    });
  });

  // ─── Race condition ───────────────────────────────────────────
  describe('race condition: dois usuários no mesmo assento', () => {
    it('deve bloquear segundo usuário quando assento já está com lock', async () => {
      // Primeiro usuário — sucesso
      await reservationService.create({
        seatId: 'seat-001',
        userId: 'usuario-001',
      });

      // Segundo usuário — lock já existe
      (mockRedis.acquireLock as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        reservationService.create({
          seatId: 'seat-001',
          userId: 'usuario-002',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('deve garantir que apenas uma reserva é criada em concorrência', async () => {
      (mockRedis.acquireLock as jest.Mock)
        .mockResolvedValueOnce(true) // primeiro usuário — sucesso
        .mockResolvedValueOnce(false); // segundo usuário — bloqueado

      const [result1, result2] = await Promise.allSettled([
        reservationService.create({
          seatId: 'seat-001',
          userId: 'usuario-001',
        }),
        reservationService.create({
          seatId: 'seat-001',
          userId: 'usuario-002',
        }),
      ]);

      expect(result1.status).toBe('fulfilled');
      expect(result2.status).toBe('rejected');
      expect(mockReservationRepo.create).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Assento inexistente ──────────────────────────────────────
  describe('assento inexistente', () => {
    it('deve lançar NotFoundException se assento não existe', async () => {
      (mockSeatRepo.findById as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        reservationService.create({
          seatId: 'seat-invalido',
          userId: 'usuario-001',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('não deve adquirir lock se assento não existe', async () => {
      (mockSeatRepo.findById as jest.Mock).mockResolvedValueOnce(null);

      try {
        await reservationService.create({
          seatId: 'seat-invalido',
          userId: 'usuario-001',
        });
      } catch {}

      expect(mockRedis.acquireLock).not.toHaveBeenCalled();
    });
  });
});
