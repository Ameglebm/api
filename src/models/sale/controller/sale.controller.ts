import { Controller, Get, Param, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { SALE_SERVICE } from '../sale.constants';
import { ISaleService } from '../interface/sale.service.interface';
import { ResponseSaleDto } from '../dtos/response-sale.dto';

@ApiTags('Sales')
@Controller('sales')
export class SaleController {
  constructor(
    @Inject(SALE_SERVICE)
    private readonly saleService: ISaleService,
  ) {}

  @Get('history/:userId')
  @ApiOperation({ summary: 'Histórico de compras confirmadas do usuário' })
  @ApiParam({ name: 'userId', description: 'ID do usuário' })
  @ApiResponse({
    status: 200,
    description: 'Lista de vendas',
    type: [ResponseSaleDto],
  })
  async findByUserId(
    @Param('userId') userId: string,
  ): Promise<ResponseSaleDto[]> {
    return this.saleService.findByUserId(userId);
  }
}
