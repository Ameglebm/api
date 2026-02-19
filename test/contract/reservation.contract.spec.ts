import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ReservationController } from '../../src/models/reservation/controller/reservation.controller';
import { RESERVATION_SERVICE } from '../../src/models/reservation/reservation.constants';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ReservationStatus } from '../../src/common/enums/reservation-status.enum';

// ─── Dados fake ──────────────────────────────────────────────────
const mockReservationResponse = {
  id: 'reservation-001',
  seatId: 'seat-001',
  userId: 'usuario-001',
  status: ReservationStatus.PENDING,
  expiresAt: new Date(Date.now() + 30000),
  createdAt: new Date(),
};

// ─── Mock do Service ─────────────────────────────────────────────
const mockReservationService = {
  create: jest.fn().mockResolvedValue(mockReservationResponse),
  findById: jest.fn().mockResolvedValue(mockReservationResponse),
  findByUserId: jest.fn().mockResolvedValue([mockReservationResponse]),
};

describe('ReservationController (contract)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReservationController],
      providers: [
        { provide: RESERVATION_SERVICE, useValue: mockReservationService },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── POST /reservations ────────────────────────────────────────
  describe('POST /reservations', () => {
    it('deve retornar 201 com shape correto', async () => {
      const res = await request(app.getHttpServer())
        .post('/reservations')
        .send({ seatId: 'seat-001', userId: 'usuario-001' })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('seatId');
      expect(res.body).toHaveProperty('userId');
      expect(res.body).toHaveProperty('status', ReservationStatus.PENDING);
      expect(res.body).toHaveProperty('expiresAt');
      expect(res.body).toHaveProperty('createdAt');
    });

    it('deve retornar 404 quando assento não existe', async () => {
      (mockReservationService.create as jest.Mock).mockRejectedValueOnce(
        new NotFoundException('Assento não encontrado'),
      );

      const res = await request(app.getHttpServer())
        .post('/reservations')
        .send({ seatId: 'id-inexistente', userId: 'usuario-001' })
        .expect(404);

      expect(res.body).toHaveProperty('statusCode', 404);
    });

    it('deve retornar 409 quando assento já está reservado', async () => {
      (mockReservationService.create as jest.Mock).mockRejectedValueOnce(
        new ConflictException('Assento já está sendo reservado'),
      );

      const res = await request(app.getHttpServer())
        .post('/reservations')
        .send({ seatId: 'seat-001', userId: 'usuario-001' })
        .expect(409);

      expect(res.body).toHaveProperty('statusCode', 409);
    });
  });

  // ─── GET /reservations/:id ─────────────────────────────────────
  describe('GET /reservations/:id', () => {
    it('deve retornar 200 com reserva quando existe', async () => {
      const res = await request(app.getHttpServer())
        .get('/reservations/reservation-001')
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('expiresAt');
    });

    it('deve retornar 404 quando reserva não existe', async () => {
      (mockReservationService.findById as jest.Mock).mockRejectedValueOnce(
        new NotFoundException('Reserva não encontrada'),
      );

      const res = await request(app.getHttpServer())
        .get('/reservations/id-inexistente')
        .expect(404);

      expect(res.body).toHaveProperty('statusCode', 404);
    });
  });

  // ─── GET /reservations/user/:userId ────────────────────────────
  describe('GET /reservations/user/:userId', () => {
    it('deve retornar 200 com array de reservas', async () => {
      const res = await request(app.getHttpServer())
        .get('/reservations/user/usuario-001')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toHaveProperty('userId', 'usuario-001');
    });

    it('deve retornar 200 com array vazio quando não tem reservas', async () => {
      (mockReservationService.findByUserId as jest.Mock).mockResolvedValueOnce([]);

      const res = await request(app.getHttpServer())
        .get('/reservations/user/usuario-sem-reserva')
        .expect(200);

      expect(res.body).toHaveLength(0);
    });
  });
});