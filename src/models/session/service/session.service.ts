import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ISessionService } from '../interface/session.service.interface';
import {
  ISessionRepository,
  SessionWithSeats,
} from '../interface/session.repository.interface';
import { CreateSessionDto } from '../dtos/create-session.dto';
import {
  ResponseSessionDto,
  ResponseSeatDto,
} from '../dtos/response-session.dto';
import { SESSION_REPOSITORY } from '../session.constants';
import { SeatStatus } from '../../../common/enums/seat-status.enum';

@Injectable()
export class SessionService implements ISessionService {
  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository,
  ) {}

  // 🔹 Criar sessão + gerar assentos vinculados
  async create(dto: CreateSessionDto): Promise<ResponseSessionDto> {
    const seats = this.generateSeats(dto.totalSeats);
    const session = await this.sessionRepository.create(dto, seats);
    return this.toResponse(session);
  }

  // 🔹 Listar todas as sessões
  async findAll(): Promise<ResponseSessionDto[]> {
    const sessions = await this.sessionRepository.findAll();
    return sessions.map((session) => this.toResponse(session));
  }

  // 🔹 Buscar sessão por ID
  async findById(id: string): Promise<ResponseSessionDto> {
    const session = await this.sessionRepository.findById(id);

    if (!session) {
      throw new NotFoundException('Sessão não encontrada');
    }

    return this.toResponse(session);
  }

  // 🔹 Gera array de assentos numerados (A1, A2... B1, B2...)
  private generateSeats(
    total: number,
  ): { sessionId: string; seatNumber: string; status: SeatStatus }[] {
    const seats: {
      sessionId: string;
      seatNumber: string;
      status: SeatStatus;
    }[] = [];
    const seatsPerRow = 8;
    const rows = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < total; i++) {
      const rowIndex = Math.floor(i / seatsPerRow);
      const seatIndex = (i % seatsPerRow) + 1;
      seats.push({
        sessionId: '',
        seatNumber: `${rows[rowIndex]}${seatIndex}`,
        status: SeatStatus.AVAILABLE,
      });
    }
    return seats;
  }

  // 🔹 Serializa Session → ResponseSessionDto
  private toResponse(session: SessionWithSeats | any): ResponseSessionDto {
    const dto = new ResponseSessionDto();
    dto.id = session.id;
    dto.movie = session.movie;
    dto.room = session.room;
    dto.startsAt = session.startsAt;
    dto.ticketPrice = session.ticketPrice;
    dto.createdAt = session.createdAt;
    if (session.seats) {
      dto.seats = session.seats.map((seat: any) => {
        const seatDto = new ResponseSeatDto();
        seatDto.id = seat.id;
        seatDto.seatNumber = seat.seatNumber;
        seatDto.status = seat.status as SeatStatus;
        return seatDto;
      });
    }

    return dto;
  }
}
