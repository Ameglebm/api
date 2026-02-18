import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { ISeatRepository } from '../interface/seat.repository.interface';

@Injectable()
export class SeatRepository implements ISeatRepository {
  constructor(private readonly prisma: PrismaService) {}
  // 🔹 Buscar assentos por sessão
  async findBySessionId(sessionId: string) {
    return this.prisma.seat.findMany({
      where: { sessionId },
      orderBy: { seatNumber: 'asc' },
    });
  }
  // 🔹 Buscar assento por ID
  async findById(id: string) {
    return this.prisma.seat.findUnique({
      where: { id },
    });
  }
}
