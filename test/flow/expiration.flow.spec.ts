import { Test, TestingModule } from '@nestjs/testing';
import { ReservationConsumer } from '../../src/events/consumers/reservation.consumer';
import { RabbitMQService } from '../../src/infra/rabbitmq/rabbitmq.service';
import { LoggerService } from '../../src/common/logger/logger.service';
import { RESERVATION_REPOSITORY } from '../../src/models/reservation/reservation.constants';
import { SEAT_REPOSITORY } from '../../src/models/seat/seat.constants';
import { ReservationStatus } from '../../src/common/enums/reservation-status.enum';
import { SeatStatus } from '../../src/common/enums/seat-status.enum';

// ─── Dados fake ──────────────────────────────────────────────────
const mockReservation = {
  id: 'reservation-001',
  seatId: 'seat-001',
  userId: 'usuario-001',
  status: ReservationStatus.PENDING,
  expiresAt: new Date(Date.now() + 100), // expira em 100ms
  createdAt: new Date(),
};

const mockPayload = {
  event: 'reservation.created' as const,
  reservationId: 'reservation-001',
  seatId: 'seat-001',
  userId: 'usuario-001',
  expiresAt: new Date(Date.now() + 100).toISOString(), // expira em 100ms
};

// ─── Mocks ───────────────────────────────────────────────────────
const mockReservationRepo = {
  findById: jest.fn().mockResolvedValue(mockReservation),
  expire: jest.fn().mockResolvedValue(undefined),
};

const mockSeatRepo = {
  updateStatus: jest.fn().mockResolvedValue(undefined),
};

// Captura o handler registrado para chamar manualmente nos testes
let capturedHandler: (payload: any) => Promise<void>;

const mockRabbitMQ = {
  consume: jest.fn().mockImplementation(async (_queue, handler) => {
    capturedHandler = handler;
  }),
  publish: jest.fn(),
};

const mockLogger = {
  setContext: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// ─── Suite ───────────────────────────────────────────────────────
describe('Fluxo: Expiração Automática de Reservas', () => {
  let consumer: ReservationConsumer;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationConsumer,
        { provide: RabbitMQService, useValue: mockRabbitMQ },
        { provide: LoggerService, useValue: mockLogger },
        { provide: RESERVATION_REPOSITORY, useValue: mockReservationRepo },
        { provide: SEAT_REPOSITORY, useValue: mockSeatRepo },
      ],
    }).compile();

    consumer = module.get<ReservationConsumer>(ReservationConsumer);
    await consumer.onModuleInit();

    jest.clearAllMocks();
  });

  // ─── Happy path: expiração automática ────────────────────────
  describe('expiração automática após TTL', () => {
    it('deve expirar reserva PENDING após o tempo', async () => {
      (mockReservationRepo.findById as jest.Mock).mockResolvedValueOnce(
        mockReservation,
      );

      await capturedHandler(mockPayload);

      expect(mockReservationRepo.expire).toHaveBeenCalledWith(
        'reservation-001',
      );
    });

    it('deve liberar assento para AVAILABLE após expiração', async () => {
      (mockReservationRepo.findById as jest.Mock).mockResolvedValueOnce(
        mockReservation,
      );

      await capturedHandler(mockPayload);

      expect(mockSeatRepo.updateStatus).toHaveBeenCalledWith(
        'seat-001',
        SeatStatus.AVAILABLE,
      );
    });

    it('deve publicar evento reservation.expired após expiração', async () => {
      (mockReservationRepo.findById as jest.Mock).mockResolvedValueOnce(
        mockReservation,
      );

      await capturedHandler(mockPayload);

      expect(mockRabbitMQ.publish).toHaveBeenCalledWith(
        'expirations',
        expect.objectContaining({
          event: 'reservation.expired',
          reservationId: 'reservation-001',
          seatId: 'seat-001',
        }),
      );
    });
  });

  // ─── Idempotência: reserva já confirmada ─────────────────────
  describe('idempotência: reserva já confirmada', () => {
    it('não deve expirar reserva que já foi CONFIRMED', async () => {
      (mockReservationRepo.findById as jest.Mock).mockResolvedValueOnce({
        ...mockReservation,
        status: ReservationStatus.CONFIRMED,
      });

      await capturedHandler(mockPayload);

      expect(mockReservationRepo.expire).not.toHaveBeenCalled();
      expect(mockSeatRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('não deve publicar evento se reserva já foi CONFIRMED', async () => {
      (mockReservationRepo.findById as jest.Mock).mockResolvedValueOnce({
        ...mockReservation,
        status: ReservationStatus.CONFIRMED,
      });

      await capturedHandler(mockPayload);

      expect(mockRabbitMQ.publish).not.toHaveBeenCalled();
    });

    it('não deve expirar reserva que já está EXPIRED', async () => {
      (mockReservationRepo.findById as jest.Mock).mockResolvedValueOnce({
        ...mockReservation,
        status: ReservationStatus.EXPIRED,
      });

      await capturedHandler(mockPayload);

      expect(mockReservationRepo.expire).not.toHaveBeenCalled();
    });
  });

  // ─── Reserva não encontrada ───────────────────────────────────
  describe('reserva não encontrada', () => {
    it('não deve quebrar se reserva não existe mais', async () => {
      (mockReservationRepo.findById as jest.Mock).mockResolvedValueOnce(null);

      await expect(capturedHandler(mockPayload)).resolves.not.toThrow();
    });

    it('deve logar warn se reserva não existe', async () => {
      (mockReservationRepo.findById as jest.Mock).mockResolvedValueOnce(null);

      await capturedHandler(mockPayload);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Reserva não encontrada ao tentar expirar',
        expect.objectContaining({ reservationId: 'reservation-001' }),
      );
    });
  });
});
