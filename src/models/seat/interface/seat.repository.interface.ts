import { Seat } from '@prisma/client';
export interface ISeatRepository {
  findBySessionId(sessionId: string): Promise<Seat[]>;
  findById(id: string): Promise<Seat | null>;
}
