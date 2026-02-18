import { Reservation } from '@prisma/client';
import { CreateReservationDto } from '../dtos/create-reservation.dto';

export interface IReservationRepository {
  create(dto: CreateReservationDto, expiresAt: Date): Promise<Reservation>;
  findById(id: string): Promise<Reservation | null>;
  findByUserId(userId: string): Promise<Reservation[]>;
  expire(id: string): Promise<Reservation>;
}
