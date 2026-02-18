import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { CreateReservationDto } from '../dtos/create-reservation.dto';
import { IReservationRepository } from '../interface/reservation.repository.interface';
import { ReservationStatus } from '../../../common/enums/reservation-status.enum';

@Injectable()
export class ReservationRepository implements IReservationRepository {
  constructor(private readonly prisma: PrismaService) {}
  // 🔹 Criar reserva
  async create(dto: CreateReservationDto, expiresAt: Date) {
    return this.prisma.reservation.create({
      data: {
        seatId: dto.seatId,
        userId: dto.userId,
        status: ReservationStatus.PENDING,
        expiresAt,
      },
    });
  }

  // 🔹 Buscar reserva por ID
  async findById(id: string) {
    return this.prisma.reservation.findUnique({
      where: { id },
    });
  }

  // 🔹 Buscar reservas por usuário
  async findByUserId(userId: string) {
    return this.prisma.reservation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 🔹 Expirar reserva
  async expire(id: string) {
    return this.prisma.reservation.update({
      where: { id },
      data: { status: ReservationStatus.EXPIRED },
    });
  }
}
