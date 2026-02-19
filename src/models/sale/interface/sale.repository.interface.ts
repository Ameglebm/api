import { Sale, Reservation, Seat, Session } from '@prisma/client';

export type SaleWithDetails = Sale & {
  reservation: Reservation & {
    seat: Seat & {
      session: Session;
    };
  };
};

export interface ISaleRepository {
  findByUserId(userId: string): Promise<SaleWithDetails[]>;
}