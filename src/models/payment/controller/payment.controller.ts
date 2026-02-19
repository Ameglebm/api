import { Controller, Post, Param, Inject, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { PAYMENT_SERVICE } from '../payment.constants';
import { IPaymentService } from '../interface/payment.service.interface';
import { ResponsePaymentDto } from '../dtos/response-payment.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(
    @Inject(PAYMENT_SERVICE)
    private readonly paymentService: IPaymentService,
  ) {}

  @Post('confirm/:reservationId')
  @ApiOperation({ summary: 'Confirma pagamento e converte reserva em venda' })
  @ApiParam({ name: 'reservationId', description: 'ID da reserva' })
  @ApiResponse({
    status: 201,
    description: 'Venda criada',
    type: ResponsePaymentDto,
  })
  @ApiResponse({ status: 404, description: 'Reserva não encontrada' })
  @ApiResponse({ status: 409, description: 'Já confirmada ou assento vendido' })
  @ApiResponse({ status: 410, description: 'Reserva expirada' })
  async confirm(
    @Param('reservationId', new ParseUUIDPipe({ errorHttpStatusCode: 422 })) reservationId: string,
  ): Promise<ResponsePaymentDto> {
    return this.paymentService.confirm(reservationId);
  }
}
