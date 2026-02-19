import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResponseSeatDto } from '../dtos/response-seat.dto';
import { ISeatService } from '../interface/seat.service.interface';
import { SEAT_SERVICE } from '../seat.constants';

@ApiTags('seats')
@Controller('seats')
export class SeatController {
  constructor(
    @Inject(SEAT_SERVICE)
    private readonly seatService: ISeatService,
  ) {}
  // Buscar assentos por sessão
  @ApiOperation({
    summary: 'Lista assentos de uma sessão com disponibilidade em tempo real',
  })
  @ApiResponse({
    status: 200,
    description: 'Assentos listados com sucesso',
    content: {
      'application/json': {
        example: [
          {
            id: 'uuid-assento',
            seatNumber: 'A1',
            status: 'AVAILABLE',
            isLocked: false,
          },
          {
            id: 'uuid-assento',
            seatNumber: 'A2',
            status: 'AVAILABLE',
            isLocked: true,
          },
          {
            id: 'uuid-assento',
            seatNumber: 'A3',
            status: 'SOLD',
            isLocked: false,
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Sessão não encontrada' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  @Get(':sessionId')
  async findBySessionId(
    @Param('sessionId') sessionId: string,
  ): Promise<ResponseSeatDto[]> {
    return this.seatService.findBySessionId(sessionId);
  }
}
