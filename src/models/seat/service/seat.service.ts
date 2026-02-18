import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { RedisService } from '../../../infra/redis/redis.service';
import { SessionRepository } from '../../session/repository/session.repository';
import { SESSION_REPOSITORY } from '../../session/session.constants';
import { ResponseSeatDto } from '../dtos/response-seat.dto';
import { ISeatRepository } from '../interface/seat.repository.interface';
import { ISeatService } from '../interface/seat.service.interface';
import { SEAT_REPOSITORY } from '../seat.constants';
import { SeatStatus } from '../../../common/enums/seat-status.enum';

@Injectable()
export class SeatService implements ISeatService {
  constructor(
    @Inject(SEAT_REPOSITORY)
    private readonly seatRepository: ISeatRepository,
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: SessionRepository,
    private readonly redisService: RedisService,
  ) {}
  // 🔹 Buscar assentos com disponibilidade em tempo real
  async findBySessionId(sessionId: string): Promise<ResponseSeatDto[]> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Sessão não encontrada');
    }
    const seats = await this.seatRepository.findBySessionId(sessionId);
    return Promise.all(
      seats.map(async (seat) => {
        const isLocked = await this.redisService.isLocked(seat.id);
        const dto = new ResponseSeatDto();
        dto.id = seat.id;
        dto.seatNumber = seat.seatNumber;
        dto.status = seat.status as SeatStatus;
        dto.isLocked = isLocked;
        return dto;
      }),
    );
  }
}
