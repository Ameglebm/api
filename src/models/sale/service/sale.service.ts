import { Injectable, Inject } from '@nestjs/common';
import { ISaleService } from '../interface/sale.service.interface';
import { ISaleRepository } from '../interface/sale.repository.interface';
import { SALE_REPOSITORY } from '../sale.constants';
import { ResponseSaleDto } from '../dtos/response-sale.dto';
import { LoggerService } from '../../../common/logger/logger.service';

@Injectable()
export class SaleService implements ISaleService {
  constructor(
    @Inject(SALE_REPOSITORY)
    private readonly saleRepo: ISaleRepository,

    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('SaleService');
  }

  async findByUserId(userId: string): Promise<ResponseSaleDto[]> {
    const sales = await this.saleRepo.findByUserId(userId);

    this.logger.log('Histórico consultado', {
      userId,
      total: sales.length,
    });

    return sales.map((sale) => ({
      id: sale.id,
      reservationId: sale.reservationId,
      seatId: sale.seatId,
      userId: sale.userId,
      paidAt: sale.paidAt,
      seatNumber: sale.reservation.seat.seatNumber,
      movie: sale.reservation.seat.session.movie,
      room: sale.reservation.seat.session.room,
      startsAt: sale.reservation.seat.session.startsAt,
      ticketPrice: Number(sale.reservation.seat.session.ticketPrice),
    }));
  }
}
