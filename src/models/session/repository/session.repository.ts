import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import {
  ISessionRepository,
  SessionWithSeats,
} from '../interface/session.repository.interface';
import { CreateSessionDto } from '../dtos/create-session.dto';

@Injectable()
export class SessionRepository implements ISessionRepository {
  constructor(private readonly prisma: PrismaService) {}
  // 🔹 Criar sessão + assentos em transação
  async create(
    dto: CreateSessionDto,
    seats: { sessionId: string; seatNumber: string }[],
  ): Promise<SessionWithSeats> {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.session.create({
        data: {
          movie: dto.movie,
          room: dto.room,
          startsAt: new Date(dto.startsAt),
          ticketPrice: dto.ticketPrice,
        },
      });

      await tx.seat.createMany({
        data: seats.map((seat) => ({
          sessionId: session.id,
          seatNumber: seat.seatNumber,
        })),
      });

      return tx.session.findUniqueOrThrow({
        where: { id: session.id },
        include: { seats: true },
      });
    });
  }

  // 🔹 Listar todas as sessões
  async findAll() {
    return this.prisma.session.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  // 🔹 Buscar sessão por ID com assentos
  async findById(id: string): Promise<SessionWithSeats | null> {
    return this.prisma.session.findUnique({
      where: { id },
      include: { seats: true },
    });
  }
}
