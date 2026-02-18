import { Controller, Post, Get, Body, Param, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ISessionService } from '../interface/session.service.interface';
import { CreateSessionDto } from '../dtos/create-session.dto';
import { ResponseSessionDto } from '../dtos/response-session.dto';
import { SESSION_SERVICE } from '../session.constants';

@ApiTags('sessions')
@Controller('sessions')
export class SessionController {
  constructor(
    @Inject(SESSION_SERVICE)
    private readonly sessionService: ISessionService,
  ) {}

  // 🔹 Criar sessão
  @ApiOperation({
    summary:
      'Cria uma nova sessão de cinema com assentos gerados automaticamente',
  })
  @ApiResponse({
    status: 201,
    description: 'Sessão criada com sucesso',
    content: {
      'application/json': {
        example: {
          id: 'uuid-sessao',
          movie: 'Interstellar',
          room: 'Sala 3',
          startsAt: '2026-03-01T19:00:00.000Z',
          ticketPrice: 25.0,
          createdAt: '2026-02-18T00:00:00.000Z',
          seats: [
            { id: 'uuid-assento', seatNumber: 'A1', status: 'AVAILABLE' },
            { id: 'uuid-assento', seatNumber: 'A2', status: 'AVAILABLE' },
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Requisição inválida' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  @Post()
  async create(@Body() dto: CreateSessionDto): Promise<ResponseSessionDto> {
    return this.sessionService.create(dto);
  }

  // 🔹 Listar sessões
  @ApiOperation({ summary: 'Lista todas as sessões disponíveis' })
  @ApiResponse({
    status: 200,
    description: 'Sessões listadas com sucesso',
    content: {
      'application/json': {
        example: [
          {
            id: 'uuid-sessao',
            movie: 'Interstellar',
            room: 'Sala 3',
            startsAt: '2026-03-01T19:00:00.000Z',
            ticketPrice: 25.0,
            createdAt: '2026-02-18T00:00:00.000Z',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  @Get()
  async findAll(): Promise<ResponseSessionDto[]> {
    return this.sessionService.findAll();
  }

  // 🔹 Buscar sessão por ID
  @ApiOperation({ summary: 'Busca uma sessão pelo ID com seus assentos' })
  @ApiResponse({
    status: 200,
    description: 'Sessão encontrada com sucesso',
    content: {
      'application/json': {
        example: {
          id: 'uuid-sessao',
          movie: 'Interstellar',
          room: 'Sala 3',
          startsAt: '2026-03-01T19:00:00.000Z',
          ticketPrice: 25.0,
          createdAt: '2026-02-18T00:00:00.000Z',
          seats: [
            { id: 'uuid-assento', seatNumber: 'A1', status: 'AVAILABLE' },
            { id: 'uuid-assento', seatNumber: 'A2', status: 'AVAILABLE' },
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Sessão não encontrada' })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  @Get(':id')
  async findById(@Param('id') id: string): Promise<ResponseSessionDto> {
    return this.sessionService.findById(id);
  }
}
