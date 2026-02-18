import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateReservationDto } from '../dtos/create-reservation.dto';
import { ResponseReservationDto } from '../dtos/response-reservation.dto';
import { IReservationService } from '../interface/reservation.service.interface';
import { RESERVATION_SERVICE } from '../reservation.constants';

@ApiTags('reservations')
@Controller('reservations')
export class ReservationController {
  constructor(
    @Inject(RESERVATION_SERVICE)
    private readonly reservationService: IReservationService,
  ) {}

  // Criar reserva
  @ApiOperation({ summary: 'Reserva um assento com lock de 30 segundos' })
  @ApiResponse({
    status: 201,
    description: 'Reserva criada com sucesso',
    content: {
      'application/json': {
        example: {
          id: 'uuid-reserva',
          seatId: 'uuid-assento',
          userId: 'uuid-usuario',
          status: 'PENDING',
          expiresAt: '2026-02-18T19:00:30.000Z',
          createdAt: '2026-02-18T19:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Assento não encontrado' })
  @ApiResponse({
    status: 409,
    description: 'Assento já está sendo reservado por outro usuário',
  })
  @ApiResponse({ status: 400, description: 'Requisição inválida' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  @Post()
  async create(
    @Body() dto: CreateReservationDto,
  ): Promise<ResponseReservationDto> {
    return this.reservationService.create(dto);
  }

  // Buscar reserva por ID
  @ApiOperation({ summary: 'Busca uma reserva pelo ID' })
  @ApiResponse({
    status: 200,
    description: 'Reserva encontrada com sucesso',
    content: {
      'application/json': {
        example: {
          id: 'uuid-reserva',
          seatId: 'uuid-assento',
          userId: 'uuid-usuario',
          status: 'PENDING',
          expiresAt: '2026-02-18T19:00:30.000Z',
          createdAt: '2026-02-18T19:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Reserva não encontrada' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  @Get(':id')
  async findById(@Param('id') id: string): Promise<ResponseReservationDto> {
    return this.reservationService.findById(id);
  }

  // Buscar reservas por usuário
  @ApiOperation({ summary: 'Lista reservas de um usuário' })
  @ApiResponse({
    status: 200,
    description: 'Reservas listadas com sucesso',
    content: {
      'application/json': {
        example: [
          {
            id: 'uuid-reserva',
            seatId: 'uuid-assento',
            userId: 'uuid-usuario',
            status: 'PENDING',
            expiresAt: '2026-02-18T19:00:30.000Z',
            createdAt: '2026-02-18T19:00:00.000Z',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  @Get('user/:userId')
  async findByUserId(
    @Param('userId') userId: string,
  ): Promise<ResponseReservationDto[]> {
    return this.reservationService.findByUserId(userId);
  }
}
