import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SessionService } from '../../src/models/session/service/session.service';
import { ISessionRepository } from '../../src/models/session/interface/session.repository.interface';
import { SESSION_REPOSITORY } from '../../src/models/session/session.constants';
import { SeatStatus } from '../../src/common/enums/seat-status.enum';

// ─── Dados fake reutilizáveis
const mockSession = {
  id: 'session-001',
  movie: 'Interestelar',
  room: 'Sala 7',
  startsAt: new Date('2026-03-01T19:00:00.000Z'),
  ticketPrice: 25,
  createdAt: new Date(),
  seats: [
    { id: 'seat-001', seatNumber: 'A1', status: SeatStatus.AVAILABLE },
    { id: 'seat-002', seatNumber: 'A2', status: SeatStatus.AVAILABLE },
  ],
};

const mockCreateDto = {
  movie: 'Interestelar',
  room: 'Sala 7',
  startsAt: '2026-03-01T19:00:00.000Z',
  ticketPrice: 25,
  totalSeats: 16,
};

// ─── Mock do Repository ──────────────────────────────────────────
// Todas as funções são fake — não acessam banco nenhum
const mockSessionRepository: Partial<ISessionRepository> = {
  create: jest.fn().mockResolvedValue(mockSession),
  findAll: jest.fn().mockResolvedValue([mockSession]),
  findById: jest.fn().mockResolvedValue(mockSession),
};

describe('SessionService', () => {
  let service: SessionService;
  let repository: ISessionRepository;

  // ─── Setup — roda antes de CADA teste ──────────────────────────
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: SESSION_REPOSITORY, // token
          useValue: mockSessionRepository, // objeto fake no lugar do real
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    repository = module.get<ISessionRepository>(SESSION_REPOSITORY);

    // Limpa contadores entre testes
    jest.clearAllMocks();
  });

  // ─── Testes do create ──────────────────────────────────────────
  describe('create', () => {
    it('deve criar sessão e retornar ResponseSessionDto', async () => {
      // Act — chama o método
      const result = await service.create(mockCreateDto);

      // Assert — verifica o resultado
      expect(result.id).toBe('session-001');
      expect(result.movie).toBe('Interestelar');
      expect(result.room).toBe('Sala 7');
      expect(result.ticketPrice).toBe(25);
      expect(result.seats).toHaveLength(2);
      expect(result.seats![0].seatNumber).toBe('A1');
    });

    it('deve chamar repository.create com os assentos gerados', async () => {
      // Act
      await service.create(mockCreateDto);

      // Assert — verifica se o repository foi chamado
      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(repository.create).toHaveBeenCalledWith(
        mockCreateDto,
        expect.arrayContaining([
          expect.objectContaining({
            seatNumber: 'A1',
            status: SeatStatus.AVAILABLE,
          }),
        ]),
      );
    });

    it('deve gerar assentos com numeração correta (A1-A8, B1-B8)', async () => {
      // Act
      await service.create(mockCreateDto);

      // Assert — pega o segundo argumento passado ao repository.create
      const seatsArg = (repository.create as jest.Mock).mock.calls[0][1];
      expect(seatsArg).toHaveLength(16);
      expect(seatsArg[0].seatNumber).toBe('A1');
      expect(seatsArg[7].seatNumber).toBe('A8');
      expect(seatsArg[8].seatNumber).toBe('B1');
      expect(seatsArg[15].seatNumber).toBe('B8');
    });
  });

  // ─── Testes do findAll ─────────────────────────────────────────
  describe('findAll', () => {
    it('deve retornar array de sessões', async () => {
      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].movie).toBe('Interestelar');
    });

    it('deve retornar array vazio quando não há sessões', async () => {
      // Arrange — muda o mock só pra esse teste
      (repository.findAll as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.findAll();

      expect(result).toHaveLength(0);
    });
  });

  // ─── Testes do findById ────────────────────────────────────────
  describe('findById', () => {
    it('deve retornar sessão quando existe', async () => {
      const result = await service.findById('session-001');

      expect(result.id).toBe('session-001');
      expect(result.movie).toBe('Interestelar');
      expect(result.seats).toHaveLength(2);
    });

    it('deve lançar NotFoundException quando sessão não existe', async () => {
      // Arrange — mock retorna null
      (repository.findById as jest.Mock).mockResolvedValueOnce(null);

      // Act + Assert — espera que lance 404
      await expect(service.findById('id-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deve chamar repository.findById com o id correto', async () => {
      await service.findById('session-001');

      expect(repository.findById).toHaveBeenCalledWith('session-001');
    });
  });
});
