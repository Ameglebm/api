import { Test, TestingModule } from '@nestjs/testing';
import { ReservationConsumer } from '../../src/events/consumers/reservation.consumer';
import { RabbitMQService } from '../../src/infra/rabbitmq/rabbitmq.service';
import { LoggerService } from '../../src/common/logger/logger.service';
import { IReservationRepository } from '../../src/models/reservation/interface/reservation.repository.interface';
import { ISeatRepository } from '../../src/models/seat/interface/seat.repository.interface';
import { RESERVATION_REPOSITORY } from '../../src/models/reservation/reservation.constants';
import { SEAT_REPOSITORY } from '../../src/models/seat/seat.constants';
import { ReservationStatus } from '../../src/common/enums/reservation-status.enum';
import { SeatStatus } from '../../src/common/enums/seat-status.enum';

// ─── Dados fake ──────────────────────────────────────────────────
const mockPayload = {
  event: 'reservation.created' as const,
  reservationId: 'reservation-001',
  seatId: 'seat-001',
  userId: 'usuario-001',
  expiresAt: new Date(Date.now() - 1000).toISOString(), // já expirou → delay = 0
};

const mockReservationPending = {
  id: 'reservation-001',
  seatId: 'seat-001',
  userId: 'usuario-001',
  status: ReservationStatus.PENDING,
  expiresAt: new Date(),
  createdAt: new Date(),
};

// ─── Mocks ───────────────────────────────────────────────────────
const mockReservationRepo: Partial<IReservationRepository> = {
  findById: jest.fn().mockResolvedValue(mockReservationPending),
  expire: jest.fn().mockResolvedValue(undefined),
};

const mockSeatRepo: Partial<ISeatRepository> = {
  updateStatus: jest.fn().mockResolvedValue(undefined),
};

const mockRabbitMQ = {
  consume: jest.fn(),
  publish: jest.fn(),
};

const mockLogger = {
  setContext: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('ReservationConsumer', () => {
  let consumer: ReservationConsumer;
  let handler: (payload: any) => Promise<void>;

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

    jest.clearAllMocks();

    // Captura o handler que o consumer registra no onModuleInit
    await consumer.onModuleInit();
    handler = (mockRabbitMQ.consume as jest.Mock).mock.calls[0][1];

    // Mock do sleep pra não esperar 30s no teste
    jest.spyOn(consumer as any, 'sleep').mockResolvedValue(undefined);
  });

  describe('onModuleInit', () => {
    it('deve registrar consumer na fila reservations', () => {
      expect(mockRabbitMQ.consume).toHaveBeenCalledWith(
        'reservations',
        expect.any(Function),
      );
    });
  });

  describe('handler: reserva ainda PENDING', () => {
    it('deve expirar reserva quando ainda está PENDING', async () => {
      await handler(mockPayload);

      expect(mockReservationRepo.expire).toHaveBeenCalledWith(
        'reservation-001',
      );
    });

    it('deve liberar assento para AVAILABLE', async () => {
      await handler(mockPayload);

      expect(mockSeatRepo.updateStatus).toHaveBeenCalledWith(
        'seat-001',
        SeatStatus.AVAILABLE,
      );
    });

    it('deve publicar evento reservation.expired na fila expirations', async () => {
      await handler(mockPayload);

      expect(mockRabbitMQ.publish).toHaveBeenCalledWith(
        'expirations',
        expect.objectContaining({
          event: 'reservation.expired',
          reservationId: 'reservation-001',
          seatId: 'seat-001',
          userId: 'usuario-001',
        }),
      );
    });

    it('deve logar expiração automática', async () => {
      await handler(mockPayload);

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Reserva expirada automaticamente',
        expect.objectContaining({
          reservationId: 'reservation-001',
          seatId: 'seat-001',
        }),
      );
    });
  });

  describe('handler: reserva já confirmada', () => {
    it('deve ignorar quando reserva já foi CONFIRMED', async () => {
      (mockReservationRepo.findById as jest.Mock).mockResolvedValueOnce({
        ...mockReservationPending,
        status: ReservationStatus.CONFIRMED,
      });

      await handler(mockPayload);

      expect(mockReservationRepo.expire).not.toHaveBeenCalled();
      expect(mockSeatRepo.updateStatus).not.toHaveBeenCalled();
      expect(mockRabbitMQ.publish).not.toHaveBeenCalled();
    });

    it('deve logar que reserva já foi processada', async () => {
      (mockReservationRepo.findById as jest.Mock).mockResolvedValueOnce({
        ...mockReservationPending,
        status: ReservationStatus.CONFIRMED,
      });

      await handler(mockPayload);

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Reserva já processada, ignorando',
        expect.objectContaining({
          reservationId: 'reservation-001',
          status: ReservationStatus.CONFIRMED,
        }),
      );
    });
  });

  describe('handler: reserva não encontrada', () => {
    it('deve logar warn e não fazer nada quando reserva não existe', async () => {
      (mockReservationRepo.findById as jest.Mock).mockResolvedValueOnce(null);

      await handler(mockPayload);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Reserva não encontrada ao tentar expirar',
        expect.objectContaining({ reservationId: 'reservation-001' }),
      );
      expect(mockReservationRepo.expire).not.toHaveBeenCalled();
      expect(mockSeatRepo.updateStatus).not.toHaveBeenCalled();
    });
  });
});
