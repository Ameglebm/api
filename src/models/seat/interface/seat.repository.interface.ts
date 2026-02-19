import { Seat } from '@prisma/client';
import { SeatStatus } from '../../../common/enums/seat-status.enum';
export interface ISeatRepository {
  findBySessionId(sessionId: string): Promise<Seat[]>;
  findById(id: string): Promise<Seat | null>;
  updateStatus(id: string, status: SeatStatus): Promise<Seat>;
}
