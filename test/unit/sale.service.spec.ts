import { Test, TestingModule } from '@nestjs/testing';
import { SaleService } from '../../src/models/sale/service/sale.service';
import { ISaleRepository } from '../../src/models/sale/interface/sale.repository.interface';
import { SALE_REPOSITORY } from '../../src/models/sale/sale.constants';
import { LoggerService } from '../../src/common/logger/logger.service';

// ─── Dados fake com include encadeado ────────────────────────────
const mockSaleWithDetails = {
  id: 'sale-001',
  reservationId: 'reservation-001',
  seatId: 'seat-001',
  userId: 'usuario-001',
  paidAt: new Date('2026-02-19T06:00:02.000Z'),
  reservation: {
    seat: {
      seatNumber: 'A1',
      session: {
        movie: 'Interestelar',
        room: 'Sala 7',
        startsAt: new Date('2026-03-01T19:00:00.000Z'),
        ticketPrice: 25,
      },
    },
  },
};

const mockSaleWithDetails2 = {
  id: 'sale-002',
  reservationId: 'reservation-002',
  seatId: 'seat-002',
  userId: 'usuario-001',
  paidAt: new Date('2026-02-19T07:00:00.000Z'),
  reservation: {
    seat: {
      seatNumber: 'B3',
      session: {
        movie: 'Oppenheimer',
        room: 'Sala 3',
        startsAt: new Date('2026-03-02T21:00:00.000Z'),
        ticketPrice: 30,
      },
    },
  },
};

// ─── Mocks ───────────────────────────────────────────────────────
const mockSaleRepository: Partial<ISaleRepository> = {
  findByUserId: jest.fn().mockResolvedValue([mockSaleWithDetails]),
};

const mockLogger = {
  setContext: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('SaleService', () => {
  let service: SaleService;
  let saleRepo: ISaleRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaleService,
        { provide: SALE_REPOSITORY, useValue: mockSaleRepository },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<SaleService>(SaleService);
    saleRepo = module.get<ISaleRepository>(SALE_REPOSITORY);

    jest.clearAllMocks();
  });

  describe('findByUserId', () => {
    it('deve retornar histórico com dados completos da sessão', async () => {
      const result = await service.findByUserId('usuario-001');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sale-001');
      expect(result[0].seatNumber).toBe('A1');
      expect(result[0].movie).toBe('Interestelar');
      expect(result[0].room).toBe('Sala 7');
      expect(result[0].ticketPrice).toBe(25);
    });

    it('deve retornar array vazio quando usuário não tem compras', async () => {
      (saleRepo.findByUserId as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.findByUserId('usuario-sem-compra');

      expect(result).toHaveLength(0);
    });

    it('deve retornar múltiplas vendas quando usuário tem várias compras', async () => {
      (saleRepo.findByUserId as jest.Mock).mockResolvedValueOnce([
        mockSaleWithDetails,
        mockSaleWithDetails2,
      ]);

      const result = await service.findByUserId('usuario-001');

      expect(result).toHaveLength(2);
      expect(result[0].movie).toBe('Interestelar');
      expect(result[1].movie).toBe('Oppenheimer');
      expect(result[1].ticketPrice).toBe(30);
    });

    it('deve converter ticketPrice para number', async () => {
      const result = await service.findByUserId('usuario-001');

      expect(typeof result[0].ticketPrice).toBe('number');
    });

    it('deve logar histórico consultado com total', async () => {
      await service.findByUserId('usuario-001');

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Histórico consultado',
        { userId: 'usuario-001', total: 1 },
      );
    });

    it('deve chamar repository com userId correto', async () => {
      await service.findByUserId('usuario-001');

      expect(saleRepo.findByUserId).toHaveBeenCalledWith('usuario-001');
    });
  });
});