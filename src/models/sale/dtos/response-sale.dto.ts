import { ApiProperty } from '@nestjs/swagger';

export class ResponseSaleDto {
  @ApiProperty({ example: 'uuid-sale' })
  id: string;

  @ApiProperty({ example: 'uuid-reservation' })
  reservationId: string;

  @ApiProperty({ example: 'uuid-seat' })
  seatId: string;

  @ApiProperty({ example: 'usuario-001' })
  userId: string;

  @ApiProperty({ example: '2026-02-19T15:30:00.000Z' })
  paidAt: Date;

  @ApiProperty({ example: 'A1' })
  seatNumber: string;

  @ApiProperty({ example: 'Interestelar' })
  movie: string;

  @ApiProperty({ example: 'Sala 7' })
  room: string;

  @ApiProperty({ example: '2026-03-01T19:00:00.000Z' })
  startsAt: Date;

  @ApiProperty({ example: 25.0 })
  ticketPrice: number;
}