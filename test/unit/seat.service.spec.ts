import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SeatService } from '../../src/models/seat/service/seat.service';
import { ISeatRepository } from '../../src/models/seat/interface/seat.repository.interface';
import { SEAT_REPOSITORY } from '../../src/models/seat/seat.constants';
import { SESSION_REPOSITORY } from '../../src/models/session/session.constants';
import { RedisService } from '../../src/infra/redis/redis.service';
import { SeatStatus } from '../../src/common/enums/seat-status.enum';

// ─── Dados fake ──────────────────────────────────────────────────
const mockSession = {
  id: 'session-001',
  movie: 'Interestelar',
  room: 'Sala 7',
  startsAt: new Date(),
  ticketPrice: 25,
  createdAt: new Date(),
  seats: [],
};

const mockSeats = [
  {
    id: 'seat-001',
    sessionId: 'session-001',
    seatNumber: 'A1',
    status: SeatStatus.AVAILABLE,
  },
  {
    id: 'seat-002',
    sessionId: 'session-001',
    seatNumber: 'A2',
    status: SeatStatus.AVAILABLE,
  },
  {
    id: 'seat-003',
    sessionId: 'session-001',
    seatNumber: 'A3',
    status: SeatStatus.SOLD,
  },
];

// ─── Mocks ───────────────────────────────────────────────────────
const mockSeatRepository: Partial<ISeatRepository> = {
  findBySessionId: jest.fn().mockResolvedValue(mockSeats),
};

const mockSessionRepository = {
  findById: jest.fn().mockResolvedValue(mockSession),
};

const mockRedisService = {
  isLocked: jest.fn().mockResolvedValue(false),
};

describe('SeatService', () => {
  let service: SeatService;
  let seatRepo: ISeatRepository;
  let sessionRepo: typeof mockSessionRepository;
  let redis: typeof mockRedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeatService,
        { provide: SEAT_REPOSITORY, useValue: mockSeatRepository },
        { provide: SESSION_REPOSITORY, useValue: mockSessionRepository },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<SeatService>(SeatService);
    seatRepo = module.get<ISeatRepository>(SEAT_REPOSITORY);
    sessionRepo = module.get(SESSION_REPOSITORY);
    redis = module.get(RedisService);

    jest.clearAllMocks();
  });

  describe('findBySessionId', () => {
    it('deve retornar assentos com isLocked false quando nenhum está lockado', async () => {
      const result = await service.findBySessionId('session-001');

      expect(result).toHaveLength(3);
      expect(result[0].seatNumber).toBe('A1');
      expect(result[0].isLocked).toBe(false);
      expect(result[2].status).toBe(SeatStatus.SOLD);
    });

    it('deve retornar isLocked true quando assento está lockado no Redis', async () => {
      // Arrange — primeiro assento lockado, resto não
      (redis.isLocked as jest.Mock)
        .mockResolvedValueOnce(true) // seat-001 → lockado
        .mockResolvedValueOnce(false) // seat-002 → livre
        .mockResolvedValueOnce(false); // seat-003 → livre

      const result = await service.findBySessionId('session-001');

      expect(result[0].isLocked).toBe(true);
      expect(result[1].isLocked).toBe(false);
    });

    it('deve chamar redis.isLocked para cada assento', async () => {
      await service.findBySessionId('session-001');

      expect(redis.isLocked).toHaveBeenCalledTimes(3);
      expect(redis.isLocked).toHaveBeenCalledWith('seat-001');
      expect(redis.isLocked).toHaveBeenCalledWith('seat-002');
      expect(redis.isLocked).toHaveBeenCalledWith('seat-003');
    });

    it('deve lançar NotFoundException quando sessão não existe', async () => {
      (sessionRepo.findById as jest.Mock).mockResolvedValueOnce(null);

      await expect(service.findBySessionId('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('não deve chamar seatRepository se sessão não existe', async () => {
      (sessionRepo.findById as jest.Mock).mockResolvedValueOnce(null);

      try {
        await service.findBySessionId('id-inexistente');
      } catch {}

      expect(seatRepo.findBySessionId).not.toHaveBeenCalled();
    });

    it('deve retornar array vazio quando sessão não tem assentos', async () => {
      (seatRepo.findBySessionId as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.findBySessionId('session-001');

      expect(result).toHaveLength(0);
    });
  });
});
