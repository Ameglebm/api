import { ResponseSeatDto } from '../dtos/response-seat.dto';
export interface ISeatService {
  findBySessionId(sessionId: string): Promise<ResponseSeatDto[]>;
}
export const SEAT_SERVICE = 'SEAT_SERVICE';
