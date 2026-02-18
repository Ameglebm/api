import { CreateReservationDto } from '../dtos/create-reservation.dto';
import { ResponseReservationDto } from '../dtos/response-reservation.dto';

export interface IReservationService {
  create(dto: CreateReservationDto): Promise<ResponseReservationDto>;
  findById(id: string): Promise<ResponseReservationDto>;
  findByUserId(userId: string): Promise<ResponseReservationDto[]>;
}
