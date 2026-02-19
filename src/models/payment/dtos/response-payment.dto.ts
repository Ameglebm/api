import { ApiProperty } from '@nestjs/swagger';
export class ResponsePaymentDto {
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
}
