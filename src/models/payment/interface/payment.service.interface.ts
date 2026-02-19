import { Sale } from '@prisma/client';
export interface IPaymentService {
  confirm(reservationId: string): Promise<Sale>;
}
