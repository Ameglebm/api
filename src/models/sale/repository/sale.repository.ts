import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { ISaleRepository } from '../interface/sale.repository.interface';

@Injectable()
export class SaleRepository implements ISaleRepository {
  constructor(private readonly prisma: PrismaService) {}
  async findByUserId(userId: string) {
    return this.prisma.sale.findMany({
      where: { userId },
      include: {
        reservation: {
          include: {
            seat: {
              include: {
                session: true,
              },
            },
          },
        },
      },
      orderBy: { paidAt: 'desc' },
    });
  }
}
