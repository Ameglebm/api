import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { SaleController } from './controller/sale.controller';
import { SaleRepository } from './repository/sale.repository';
import { SaleService } from './service/sale.service';
import { SALE_REPOSITORY, SALE_SERVICE } from './sale.constants';

@Module({
  imports: [PrismaModule],
  controllers: [SaleController],
  providers: [
    {
      provide: SALE_REPOSITORY,
      useClass: SaleRepository,
    },
    {
      provide: SALE_SERVICE,
      useClass: SaleService,
    },
  ],
  exports: [SALE_REPOSITORY, SALE_SERVICE],
})
export class SaleModule {}