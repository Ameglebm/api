import { Session, Seat } from '@prisma/client';
import { CreateSessionDto } from '../dtos/create-session.dto';

export type SessionWithSeats = Session & { seats: Seat[] };

export interface ISessionRepository {
  create(
    dto: CreateSessionDto,
    seats: Omit<Seat, 'id' | 'updatedAt'>[],
  ): Promise<SessionWithSeats>;
  findAll(): Promise<Session[]>;
  findById(id: string): Promise<SessionWithSeats | null>;
}

export const SESSION_REPOSITORY = 'SESSION_REPOSITORY';
