import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PaymentController } from '../../src/models/payment/controller/payment.controller';
import { PAYMENT_SERVICE } from '../../src/models/payment/payment.constants';
import {
  NotFoundException,
  ConflictException,
  GoneException,
} from '@nestjs/common';

// ─── Dados fake ──────────────────────────────────────────────────
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

const mockPaymentResponse = {
  id: 'sale-001',
  reservationId: VALID_UUID,
  seatId: 'seat-001',
  userId: 'usuario-001',
  paidAt: new Date(),
};

// ─── Mock do Service ─────────────────────────────────────────────
const mockPaymentService = {
  confirm: jest.fn().mockResolvedValue(mockPaymentResponse),
};

describe('PaymentController (contract)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        { provide: PAYMENT_SERVICE, useValue: mockPaymentService },
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

  // ─── POST /payments/confirm/:reservationId ─────────────────────
  describe('POST /payments/confirm/:reservationId', () => {
    it('deve retornar 201 com shape correto', async () => {
      const res = await request(app.getHttpServer())
        .post(`/payments/confirm/${VALID_UUID}`)
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('reservationId');
      expect(res.body).toHaveProperty('seatId');
      expect(res.body).toHaveProperty('userId');
      expect(res.body).toHaveProperty('paidAt');
    });

    it('deve chamar service.confirm com o reservationId', async () => {
      await request(app.getHttpServer())
        .post(`/payments/confirm/${VALID_UUID}`);

      expect(mockPaymentService.confirm).toHaveBeenCalledWith(VALID_UUID);
    });

    it('deve retornar 404 quando reserva não existe', async () => {
      (mockPaymentService.confirm as jest.Mock).mockRejectedValueOnce(
        new NotFoundException('Reserva não encontrada'),
      );

      const res = await request(app.getHttpServer())
        .post(`/payments/confirm/${VALID_UUID}`)
        .expect(404);

      expect(res.body).toHaveProperty('statusCode', 404);
    });

    it('deve retornar 409 quando reserva já confirmada', async () => {
      (mockPaymentService.confirm as jest.Mock).mockRejectedValueOnce(
        new ConflictException('Reserva já foi confirmada'),
      );

      const res = await request(app.getHttpServer())
        .post(`/payments/confirm/${VALID_UUID}`)
        .expect(409);

      expect(res.body).toHaveProperty('statusCode', 409);
    });

    it('deve retornar 410 quando reserva expirou', async () => {
      (mockPaymentService.confirm as jest.Mock).mockRejectedValueOnce(
        new GoneException('Reserva expirada'),
      );

      const res = await request(app.getHttpServer())
        .post(`/payments/confirm/${VALID_UUID}`)
        .expect(410);

      expect(res.body).toHaveProperty('statusCode', 410);
    });

    it('deve retornar 422 quando reservationId não é UUID válido', async () => {
      await request(app.getHttpServer())
        .post('/payments/confirm/id-invalido')
        .expect(422);
    });
  });
});