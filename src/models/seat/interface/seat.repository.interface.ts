import { Seat } from '@prisma/client';
export interface ISeatRepository {
  findBySessionId(sessionId: string): Promise<Seat[]>;
}
export const SEAT_REPOSITORY = 'SEAT_REPOSITORY';
