import { Sale } from '@prisma/client';
import { CreatePaymentDto } from '../dtos/create-payment.dto';

export interface IPaymentRepository {
  create(dto: CreatePaymentDto, seatId: string): Promise<Sale>;
  findByUserId(userId: string): Promise<Sale[]>;
}