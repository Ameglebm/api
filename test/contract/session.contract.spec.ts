import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SessionController } from '../../src/models/session/controller/session.controller';
import { SESSION_SERVICE } from '../../src/models/session/session.constants';
import { NotFoundException } from '@nestjs/common';
import { SeatStatus } from '../../src/common/enums/seat-status.enum';

// ─── Dados fake ──────────────────────────────────────────────────
const mockSessionResponse = {
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

// ─── Mock do Service ─────────────────────────────────────────────
const mockSessionService = {
  create: jest.fn().mockResolvedValue(mockSessionResponse),
  findAll: jest.fn().mockResolvedValue([mockSessionResponse]),
  findById: jest.fn().mockResolvedValue(mockSessionResponse),
};

describe('SessionController (contract)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionController],
      providers: [{ provide: SESSION_SERVICE, useValue: mockSessionService }],
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

  // ─── POST /sessions ────────────────────────────────────────────
  describe('POST /sessions', () => {
    it('deve retornar 201 com shape correto', async () => {
      const res = await request(app.getHttpServer())
        .post('/sessions')
        .send({
          movie: 'Interestelar',
          room: 'Sala 7',
          startsAt: '2026-03-01T19:00:00.000Z',
          ticketPrice: 25,
          totalSeats: 16,
        })
        .expect(201);

      // Verifica shape do response
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('movie');
      expect(res.body).toHaveProperty('room');
      expect(res.body).toHaveProperty('startsAt');
      expect(res.body).toHaveProperty('ticketPrice');
      expect(res.body).toHaveProperty('seats');
      expect(Array.isArray(res.body.seats)).toBe(true);
    });

    it('deve ter seats com shape correto', async () => {
      const res = await request(app.getHttpServer())
        .post('/sessions')
        .send({
          movie: 'Interestelar',
          room: 'Sala 7',
          startsAt: '2026-03-01T19:00:00.000Z',
          ticketPrice: 25,
          totalSeats: 16,
        })
        .expect(201);

      const seat = res.body.seats[0];
      expect(seat).toHaveProperty('id');
      expect(seat).toHaveProperty('seatNumber');
      expect(seat).toHaveProperty('status');
    });

    it('deve chamar service.create com o dto', async () => {
      await request(app.getHttpServer()).post('/sessions').send({
        movie: 'Interestelar',
        room: 'Sala 7',
        startsAt: '2026-03-01T19:00:00.000Z',
        ticketPrice: 25,
        totalSeats: 16,
      });

      expect(mockSessionService.create).toHaveBeenCalledTimes(1);
    });
  });

  // ─── GET /sessions ─────────────────────────────────────────────
  describe('GET /sessions', () => {
    it('deve retornar 200 com array de sessões', async () => {
      const res = await request(app.getHttpServer())
        .get('/sessions')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toHaveProperty('movie', 'Interestelar');
    });

    it('deve retornar 200 com array vazio quando não há sessões', async () => {
      (mockSessionService.findAll as jest.Mock).mockResolvedValueOnce([]);

      const res = await request(app.getHttpServer())
        .get('/sessions')
        .expect(200);

      expect(res.body).toHaveLength(0);
    });
  });

  // ─── GET /sessions/:id ─────────────────────────────────────────
  describe('GET /sessions/:id', () => {
    it('deve retornar 200 com sessão quando existe', async () => {
      const res = await request(app.getHttpServer())
        .get('/sessions/session-001')
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('movie', 'Interestelar');
      expect(res.body).toHaveProperty('seats');
    });

    it('deve retornar 404 quando sessão não existe', async () => {
      (mockSessionService.findById as jest.Mock).mockRejectedValueOnce(
        new NotFoundException('Sessão não encontrada'),
      );

      const res = await request(app.getHttpServer())
        .get('/sessions/id-inexistente')
        .expect(404);

      expect(res.body).toHaveProperty('statusCode', 404);
      expect(res.body).toHaveProperty('message', 'Sessão não encontrada');
    });
  });
});
